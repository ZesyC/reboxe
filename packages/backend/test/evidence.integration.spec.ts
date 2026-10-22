import { createHash, randomUUID } from "node:crypto";
import { Pool } from "pg";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { EvidenceModule } from "../src/modules/claims/evidence";
import { ClaimsAiModule } from "../src/modules/claims/ai-triage";
import type { S3EvidenceStorage } from "../src/modules/claims/s3-evidence-storage";

const namespace = `evidence_test_${randomUUID().replaceAll("-", "")}`;
const connectionString = process.env.DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const admin = new Pool({ connectionString });
const pool = new Pool({ connectionString, options: `-c search_path=${namespace},public` });
const buyer = randomUUID(); const stranger = randomUUID();
const bytes = Buffer.from("synthetic media validated by the fake media boundary");
const checksum = createHash("sha256").update(bytes).digest("hex");
const storage = {
  bucket: "private-evidence-test", region: "test-region",
  uploadIntent: vi.fn(async () => ({ uploadUrl: "https://example.test/upload", headers: {}, expiresAt: new Date(Date.now()+300_000).toISOString() })),
  inspect: vi.fn(async () => ({ version: "immutable-version", checksum, mimeType: "image/png", sizeBytes: bytes.length, retainUntil: new Date(Date.now()+91*86400_000) })),
  read: vi.fn(async () => bytes)
};
const evidence = new EvidenceModule(pool, storage as unknown as S3EvidenceStorage, "http://internal-media.test", "internal-test-token");
beforeAll(async () => {
  await admin.query(`CREATE SCHEMA ${namespace}`);
  for (const table of ["profiles", "shop_memberships", "dispute_cases", "processing_records", "evidence_uploads", "dispute_evidences", "dispute_case_events", "platform_staff_roles", "ai_triage_reports"]) {
    await admin.query(`CREATE TABLE ${namespace}.${table} (LIKE public.${table} INCLUDING ALL)`);
  }
  await pool.query("INSERT INTO profiles(id,status) VALUES($1,'ACTIVE'),($2,'ACTIVE')", [buyer, stranger]);
  await pool.query("INSERT INTO platform_staff_roles(user_id,role,status) VALUES($1,'DISPUTE_ARBITRATOR','ACTIVE')", [stranger]);
  await pool.query("INSERT INTO dispute_cases(id,order_id,buyer_id,shop_id,reason,buyer_payable_vnd) VALUES('case','order',$1,'shop','Synthetic complaint',100000)", [buyer]);
  await pool.query("INSERT INTO processing_records(id,actor_id,purpose,target_type,target_id,notice_version) VALUES('record',$1,'DISPUTE_EVIDENCE','DISPUTE','case','test')", [buyer]);
});
afterEach(() => vi.unstubAllGlobals());
afterAll(async () => { await pool.end(); await admin.query(`DROP SCHEMA ${namespace} CASCADE`); await admin.end(); });
const input = { processingRecordId: "record", mimeType: "image/png" as const, sizeBytes: bytes.length, checksum };
describe("private evidence uploads", () => {
  it("requires a party and matching consent record before issuing an upload", async () => {
    await expect(evidence.prepare(stranger, "case", input)).rejects.toMatchObject({ code: "RESOURCE_NOT_FOUND" });
    await expect(evidence.prepare(buyer, "case", { ...input, processingRecordId: "missing" })).rejects.toMatchObject({ code: "PROCESSING_RECORD_REQUIRED" });
    expect(storage.uploadIntent).not.toHaveBeenCalled();
  });
  it("binds completion to its uploader, rejects altered objects and records an exact version once", async () => {
    const upload = await evidence.prepare(buyer, "case", input);
    await expect(evidence.complete(stranger, "case", upload.id)).rejects.toMatchObject({ code: "RESOURCE_NOT_FOUND" });
    storage.inspect.mockResolvedValueOnce({ version: "changed", checksum: "a".repeat(64), mimeType: "image/png", sizeBytes: bytes.length, retainUntil: new Date(Date.now()+91*86400_000) });
    await expect(evidence.complete(buyer, "case", upload.id)).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ checksum, durationSeconds: 0 })));
    const results = await Promise.all(Array.from({ length: 5 }, () => evidence.complete(buyer, "case", upload.id)));
    expect(new Set(results.map((result) => result.id)).size).toBe(1);
    expect((await pool.query("SELECT provider,object_version,checksum FROM dispute_evidences")).rows).toEqual([
      { provider: "S3_WORM", object_version: "immutable-version", checksum }
    ]);
    expect(storage.read).toHaveBeenCalledWith(expect.stringContaining("original/case/"), "immutable-version");
    expect((await pool.query("SELECT count(*)::int AS count FROM dispute_case_events")).rows[0].count).toBe(1);
  });
  it("requires reviewer MFA and analyzes only the recorded private version", async () => {
    const ai = new ClaimsAiModule(pool, "http://internal-media.test", "synthetic-token-longer-than-32-characters", storage as unknown as S3EvidenceStorage);
    await expect(ai.evidences({ id: stranger, aal: "aal1" }, "case")).rejects.toMatchObject({ code: "MFA_REQUIRED" });
    await expect(ai.evidences({ id: buyer, aal: "aal2" }, "case")).rejects.toMatchObject({ code: "FORBIDDEN" });
    const reviewer = { id: stranger, aal: "aal2" };
    const [item] = await ai.evidences(reviewer, "case");
    expect(item).toMatchObject({ stored: true, mimeType: "image/png" });
    const report = { schemaVersion: "triage-v1", modelId: "synthetic-test-model", modelRevision: "b".repeat(40), promptVersion: "unboxing-v1",
      evidenceChecksum: checksum, durationSeconds: 0, sampledTimestamps: [0],
      visualAssessment: { assessment: "INSUFFICIENT_EVIDENCE", observations: [], limitations: ["Synthetic test response"] },
      recommendation: "ADMIN_REVIEW", financialAction: "NONE", calibrated: false };
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ ...report, financialAction: "REFUND" })));
    await expect(ai.analyzeStored(reviewer, "case", item!.id)).rejects.toMatchObject({ code: "AI_UNAVAILABLE" });
    expect((await pool.query("SELECT count(*)::int AS count FROM ai_triage_reports")).rows[0].count).toBe(0);
    vi.stubGlobal("fetch", vi.fn(async () => Response.json(report)));
    const reports = await ai.analyzeStored(reviewer, "case", item!.id);
    expect(reports).toHaveLength(1);
    expect(reports[0]!.report).toMatchObject({ financialAction: "NONE", recommendation: "ADMIN_REVIEW" });
    expect(storage.read).toHaveBeenCalledWith(expect.stringContaining("original/case/"), "immutable-version");
  });
});
