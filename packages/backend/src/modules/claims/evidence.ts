import { createHash, randomUUID } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import { ulid } from "ulid";
import type { EvidenceUploadInput, EvidenceUploadIntent } from "@reboxe/shared";
import { DomainError } from "../../errors";
import type { S3EvidenceStorage } from "./s3-evidence-storage";

type Upload = { id: string; evidence_id: string; case_id: string; actor_id: string; actor_role: string; processing_record_id: string;
  bucket: string; region: string; object_key: string; mime_type: string; size_bytes: string; checksum: string;
  retain_until: Date; expires_at: Date; status: string };

export class EvidenceModule {
  constructor(private readonly pool: Pool, private readonly storage?: S3EvidenceStorage,
    private readonly mediaUrl?: string, private readonly mediaToken?: string) {}

  async prepare(actorId: string, caseId: string, input: EvidenceUploadInput): Promise<EvidenceUploadIntent> {
    const storage = this.requireStorage();
    const client = await this.pool.connect();
    const id = randomUUID();
    const objectKey = `original/${caseId}/${id}`;
    const retainUntil = new Date(Date.now() + 90 * 86400_000);
    try {
      await client.query("BEGIN");
      const role = await this.requireParty(client, actorId, caseId);
      await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`evidence:${caseId}`]);
      const record = await client.query(`SELECT 1 FROM processing_records WHERE id=$1 AND actor_id=$2 AND target_id=$3
        AND target_type='DISPUTE' AND purpose=$4`, [input.processingRecordId, actorId, caseId, role === "BUYER" ? "DISPUTE_EVIDENCE" : "SELLER_EVIDENCE"]);
      if (!record.rowCount) throw new DomainError("PROCESSING_RECORD_REQUIRED", 409, "A matching processing record is required before upload");
      const count = Number((await client.query<{ count: string }>(`SELECT count(*)::text AS count FROM evidence_uploads
        WHERE case_id=$1 AND actor_id=$2 AND (status='READY' OR expires_at>now())`, [caseId, actorId])).rows[0]!.count);
      if (count >= 10) throw new DomainError("RATE_LIMITED", 429, "A party may upload at most ten evidence objects per case");
      await client.query(`INSERT INTO evidence_uploads(id,evidence_id,case_id,actor_id,actor_role,processing_record_id,
        bucket,region,object_key,mime_type,size_bytes,checksum,retain_until,expires_at)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,now()+interval '30 minutes')`,
      [id, `RBX-EV-${ulid()}`, caseId, actorId, role, input.processingRecordId, storage.bucket, storage.region,
        objectKey, input.mimeType, input.sizeBytes, input.checksum, retainUntil]);
      await client.query("COMMIT");
    } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
    const intent = await storage.uploadIntent(objectKey, input.mimeType, input.checksum, retainUntil);
    return { id, ...intent };
  }

  async complete(actorId: string, caseId: string, id: string) {
    const storage = this.requireStorage();
    const reader = await this.pool.connect();
    let upload: Upload;
    try {
      await this.requireParty(reader, actorId, caseId);
      const row = (await reader.query<Upload>("SELECT * FROM evidence_uploads WHERE id=$1 AND case_id=$2 AND actor_id=$3", [id, caseId, actorId])).rows[0];
      if (!row) throw new DomainError("RESOURCE_NOT_FOUND", 404, "Evidence upload not found");
      upload = row;
    } finally { reader.release(); }
    if (upload.status === "READY") return { id: upload.evidence_id, status: "READY" as const };
    if (upload.expires_at.getTime() < Date.now()) throw new DomainError("VALIDATION_FAILED", 422, "Upload expired; create a new upload");
    if (upload.bucket !== storage.bucket || upload.region !== storage.region) throw new DomainError("VALIDATION_FAILED", 422, "Evidence storage configuration changed");
    const metadata = await storage.inspect(upload.object_key);
    if (metadata.checksum !== upload.checksum || metadata.mimeType !== upload.mime_type || metadata.sizeBytes !== Number(upload.size_bytes)
      || metadata.retainUntil.getTime() < upload.retain_until.getTime() - 1000) {
      throw new DomainError("VALIDATION_FAILED", 422, "Stored evidence metadata or Object Lock does not match upload");
    }
    const bytes = await storage.read(upload.object_key, metadata.version);
    if (createHash("sha256").update(bytes).digest("hex") !== upload.checksum) throw new DomainError("VALIDATION_FAILED", 422, "Stored evidence checksum mismatch");
    const duration = await this.validateMedia(bytes, upload.mime_type, upload.checksum);
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await this.requireParty(client, actorId, caseId);
      const current = (await client.query<Upload>("SELECT * FROM evidence_uploads WHERE id=$1 FOR UPDATE", [id])).rows[0]!;
      if (current.status === "READY") { await client.query("COMMIT"); return { id: upload.evidence_id, status: "READY" as const }; }
      await client.query(`INSERT INTO dispute_evidences(id,case_id,uploader_id,processing_record_id,provider,object_key,object_version,
        checksum,original_owner,storage_bucket,storage_region,mime_type,duration_seconds)
        VALUES($1,$2,$3,$4,'S3_WORM',$5,$6,$7,$8,$9,$10,$11,$12)`,
      [upload.evidence_id, caseId, actorId, upload.processing_record_id, upload.object_key, metadata.version,
        upload.checksum, upload.actor_role, upload.bucket, upload.region, upload.mime_type, duration]);
      await client.query("UPDATE evidence_uploads SET status='READY' WHERE id=$1", [id]);
      await client.query(`INSERT INTO dispute_case_events(id,case_id,actor_id,type,body) VALUES($1,$2,$3,'EVIDENCE_RECEIVED',$4)`,
      [`RBX-DCE-${ulid()}`, caseId, actorId, `Evidence ${upload.evidence_id} verified by checksum and object version`]);
      await client.query("COMMIT");
      return { id: upload.evidence_id, status: "READY" as const };
    } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
  }
  private async validateMedia(bytes: Buffer, mimeType: string, checksum: string): Promise<number> {
    if (!this.mediaUrl || !this.mediaToken) throw new DomainError("AI_UNAVAILABLE", 503, "Media validation service is unavailable; retry upload confirmation later");
    const form = new FormData(); form.set("file", new Blob([new Uint8Array(bytes)], { type: mimeType }), "evidence"); form.set("checksum", checksum);
    try {
      const response = await fetch(new URL("/v1/media/inspect", this.mediaUrl), { method: "POST", body: form, redirect: "error",
        headers: { authorization: `Bearer ${this.mediaToken}` }, signal: AbortSignal.timeout(120_000) });
      const result = await response.json() as { checksum?: string; durationSeconds?: number };
      if (!response.ok || result.checksum !== checksum || typeof result.durationSeconds !== "number"
        || !Number.isFinite(result.durationSeconds) || result.durationSeconds < 0 || result.durationSeconds > 90) throw new Error("INVALID_MEDIA");
      return result.durationSeconds;
    } catch { throw new DomainError("VALIDATION_FAILED", 422, "Evidence media could not be validated; videos must be at most 90 seconds"); }
  }
  private requireStorage() {
    if (!this.storage) throw new DomainError("FORBIDDEN", 503, "Private evidence storage is not configured");
    return this.storage;
  }
  private async requireParty(client: PoolClient, actorId: string, caseId: string): Promise<"BUYER" | "SELLER"> {
    const row = (await client.query<{ buyer_id: string; seller: boolean }>(`SELECT c.buyer_id,
      EXISTS(SELECT 1 FROM shop_memberships m WHERE m.shop_id=c.shop_id AND m.user_id=$2 AND m.status='ACTIVE'
        AND m.role IN ('OWNER','MANAGER')) AS seller FROM dispute_cases c
      JOIN profiles p ON p.id=$2 AND p.status='ACTIVE' WHERE c.id=$1 AND c.status IN ('OPEN','APPEALED','RESOLVED_APPEAL_WINDOW')`, [caseId, actorId])).rows[0];
    if (row?.buyer_id === actorId) return "BUYER";
    if (row?.seller) return "SELLER";
    throw new DomainError("RESOURCE_NOT_FOUND", 404, "Open dispute not found");
  }
}
