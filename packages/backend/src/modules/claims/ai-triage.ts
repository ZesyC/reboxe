import { createHash, randomUUID } from "node:crypto";
import type { Pool } from "pg";
import { aiReportSchema, type AiReport } from "@reboxe/shared";
import { DomainError } from "../../errors";
import type { S3EvidenceStorage } from "./s3-evidence-storage";

export class ClaimsAiModule {
  constructor(private readonly pool: Pool, private readonly url?: string, private readonly token?: string, private readonly storage?: S3EvidenceStorage) {
    if (url) {
      const parsed = new URL(url);
      if (!["http:", "https:"].includes(parsed.protocol) || parsed.username || parsed.password || parsed.search || parsed.hash) {
        throw new Error("AI_SERVICE_URL must be an HTTP(S) service URL without embedded credentials");
      }
    }
  }
  async evidences(actor: { id: string; aal?: string }, caseId: string) {
    await this.requireReviewer(actor);
    return (await this.pool.query<{ id: string; provider: string; mime_type: string | null }>(
      "SELECT id,provider,mime_type FROM dispute_evidences WHERE case_id=$1 ORDER BY created_at", [caseId])).rows
      .map((row) => ({ id: row.id, stored: row.provider === "S3_WORM", mimeType: row.mime_type }));
  }
  async analyzeStored(actor: { id: string; aal?: string }, caseId: string, evidenceId: string) {
    await this.requireReviewer(actor);
    if (!this.storage) throw new DomainError("AI_UNAVAILABLE", 503, "Evidence storage is unavailable; continue manual review");
    const row = (await this.pool.query<{ storage_bucket: string; storage_region: string; object_key: string; object_version: string; mime_type: string }>(
      `SELECT storage_bucket,storage_region,object_key,object_version,mime_type FROM dispute_evidences
       WHERE id=$1 AND case_id=$2 AND provider='S3_WORM'`, [evidenceId, caseId])).rows[0];
    if (!row || row.storage_bucket !== this.storage.bucket || row.storage_region !== this.storage.region) {
      throw new DomainError("RESOURCE_NOT_FOUND", 404, "Recorded evidence object not found");
    }
    // Original bytes stay between private services; no original URL is returned to a browser.
    const bytes = await this.storage.read(row.object_key, row.object_version);
    return this.analyze(actor, caseId, evidenceId, bytes, row.mime_type);
  }
  async list(actor: { id: string; aal?: string }, caseId: string): Promise<Array<{ id: string; evidenceId: string; report: AiReport; createdAt: string }>> {
    await this.requireReviewer(actor);
    const rows = await this.pool.query<{ id: string; evidence_id: string; report: AiReport; created_at: Date }>(
      "SELECT id,evidence_id,report,created_at FROM ai_triage_reports WHERE case_id=$1 ORDER BY created_at DESC", [caseId]);
    return rows.rows.map((row) => ({ id: row.id, evidenceId: row.evidence_id, report: aiReportSchema.parse(row.report), createdAt: row.created_at.toISOString() }));
  }
  async analyze(actor: { id: string; aal?: string }, caseId: string, evidenceId: string, bytes: Buffer, mimeType: string) {
    await this.requireReviewer(actor);
    if (!this.url || !this.token || this.token.length < 32) throw new DomainError("AI_UNAVAILABLE", 503, "AI is not configured; continue manual review");
    if (!bytes.length || bytes.length > 20 * 1024 * 1024 || !["image/jpeg", "image/png", "image/webp", "video/mp4", "video/webm", "video/quicktime"].includes(mimeType)) {
      throw new DomainError("VALIDATION_FAILED", 422, "Unsupported or oversized evidence");
    }
    const evidence = (await this.pool.query<{ object_version: string; checksum: string }>(
      "SELECT object_version,checksum FROM dispute_evidences WHERE id=$1 AND case_id=$2", [evidenceId, caseId])).rows[0];
    const checksum = createHash("sha256").update(bytes).digest("hex");
    if (!evidence || evidence.checksum !== checksum) throw new DomainError("VALIDATION_FAILED", 422, "File does not match the recorded evidence checksum");
    const form = new FormData();
    form.set("file", new Blob([new Uint8Array(bytes)], { type: mimeType }), "evidence");
    form.set("checksum", checksum);
    let report: AiReport;
    try {
      const response = await fetch(new URL("/v1/triage", this.url), { method: "POST", redirect: "error", body: form,
        headers: { authorization: `Bearer ${this.token}` }, signal: AbortSignal.timeout(180_000) });
      if (!response.ok) throw new Error("AI_REQUEST_FAILED");
      report = aiReportSchema.parse(await response.json());
      if (report.evidenceChecksum !== checksum) throw new Error("AI_EVIDENCE_MISMATCH");
    } catch { throw new DomainError("AI_UNAVAILABLE", 503, "AI analysis unavailable; continue manual review"); }
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await this.requireReviewer(actor, client);
      const current = (await client.query<{ object_version: string; checksum: string }>(
        "SELECT object_version,checksum FROM dispute_evidences WHERE id=$1 AND case_id=$2 FOR KEY SHARE", [evidenceId, caseId])).rows[0];
      if (!current || current.object_version !== evidence.object_version || current.checksum !== checksum) throw new DomainError("IDEMPOTENCY_CONFLICT", 409, "Evidence changed during analysis");
      await client.query(`INSERT INTO ai_triage_reports(id,case_id,evidence_id,evidence_version,evidence_checksum,requested_by,
        model_id,model_revision,prompt_version,report) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb)
        ON CONFLICT(evidence_id,evidence_version,evidence_checksum,model_id,model_revision,prompt_version) DO NOTHING`,
      [randomUUID(), caseId, evidenceId, evidence.object_version, checksum, actor.id, report.modelId, report.modelRevision, report.promptVersion, JSON.stringify(report)]);
      await client.query("COMMIT");
      return this.list(actor, caseId);
    } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
  }
  private async requireReviewer(actor: { id: string; aal?: string }, query: Pick<Pool, "query"> = this.pool) {
    if (actor.aal !== "aal2") throw new DomainError("MFA_REQUIRED", 403, "AI evidence review requires MFA");
    const result = await query.query(`SELECT 1 FROM platform_staff_roles r JOIN profiles p ON p.id=r.user_id
      WHERE r.user_id=$1 AND r.status='ACTIVE' AND r.role IN ('DISPUTE_ARBITRATOR','SUPER_ADMIN') AND p.status='ACTIVE'`, [actor.id]);
    if (!result.rowCount) throw new DomainError("FORBIDDEN", 403, "Dispute reviewer role required");
  }
}
