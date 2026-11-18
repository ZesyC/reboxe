import { createHash } from "node:crypto";
import { adminKycQuerySchema, kycDecisionSchema, kycIdempotencyKeySchema } from "@reboxe/shared";
import type {
  AdminKycDetail, AdminKycQuery, AdminKycQueue, KycDecisionInput, KycDecisionResult,
  KycStatus,
  KycStatusResponse,
  SubmitKycBankInput,
  SubmitKycDocumentInput,
  SubmitKycTaxInput
} from "@reboxe/shared";
import type { Pool, PoolClient } from "pg";
import { ulid } from "ulid";
import { DomainError } from "../../errors";
import { createPiiKey, decryptPii, encryptPii } from "../identity/pii";
import type { CatalogImageObject, CatalogMediaStorage } from "../inventory/catalog-media-storage";
import type { BusinessVerificationProvider, KycImage, KycProvider } from "./kyc-provider";

type KycRow = {
  id: string;
  user_id: string;
  shop_id: string;
  citizen_id_enc: Buffer | null;
  full_name_enc: Buffer | null;
  dob_enc: Buffer | null;
  gender_enc: Buffer | null;
  address_enc: Buffer | null;
  issued_at_enc: Buffer | null;
  front_ref: string | null;
  back_ref: string | null;
  selfie_ref: string | null;
  front_valid: boolean | null;
  back_valid: boolean | null;
  face_matched: boolean | null;
  face_match_score: number | null;
  liveness_passed: boolean | null;
  liveness_score: number | null;
  status: KycStatus;
  provider: string;
  created_at: Date;
  reason: string | null;
  reviewed_at: Date | null;
};

type EvaluationRow = KycRow & {
  tax_status: "VERIFIED" | "NOT_FOUND" | "UNAVAILABLE" | null;
  taxpayer_name_enc: Buffer | null;
  bank_status: "VERIFIED" | "NOT_FOUND" | "UNAVAILABLE" | null;
  name_match_score: number | null;
};

export class KycModule {
  private readonly piiKey: Buffer;

  constructor(
    private readonly pool: Pool,
    piiSecret: string,
    private readonly storage: CatalogMediaStorage,
    private readonly provider: KycProvider,
    private readonly businessVerification: BusinessVerificationProvider
  ) {
    this.piiKey = createPiiKey(piiSecret);
  }

  async start(actorId: string, shopId: string): Promise<KycStatusResponse & { id: string }> {
    const owned = await this.pool.query(
      `SELECT 1 FROM shop_memberships
       WHERE user_id = $1 AND shop_id = $2 AND role = 'OWNER' AND status = 'ACTIVE'`,
      [actorId, shopId]
    );
    if (!owned.rowCount) throw new DomainError("RESOURCE_NOT_FOUND", 404, "Shop not found");

    const id = `RBXKYC-${ulid()}`;
    const client = await this.pool.connect();
    let kycId: string;
    try {
      await client.query("BEGIN");
      const existing = (await client.query<{ id: string }>("SELECT id FROM seller_kyc WHERE shop_id=$1 FOR UPDATE", [shopId])).rows[0];
      if (existing) {
        kycId = existing.id;
      } else {
        await client.query(
          `INSERT INTO processing_records(id,actor_id,purpose,target_type,target_id,notice_version)
           VALUES($1,$2,'KYC','SELLER_KYC',$3,coalesce(
             (SELECT version FROM legal_artifacts WHERE slug='processing-notice' AND effective_at<=now()
              ORDER BY effective_at DESC LIMIT 1), '2026-09-07'))`,
          [`RBX-PR-${ulid()}`, actorId, id]
        );
        await client.query(
          `INSERT INTO seller_kyc (id, shop_id, user_id, provider, status) VALUES ($1, $2, $3, $4, 'PROCESSING')`,
          [id, shopId, actorId, this.provider.name]
        );
        await client.query("UPDATE shops SET kyc_status = 'PROCESSING' WHERE id = $1 AND kyc_status = 'PENDING'", [shopId]);
        kycId = id;
      }
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
    return { id: kycId, ...(await this.getStatus(actorId, kycId)) };
  }

  async submitDocument(
    actorId: string,
    side: "front" | "back",
    input: SubmitKycDocumentInput
  ): Promise<KycStatusResponse> {
    const row = await this.requireOwnedKyc(actorId, input.kycId);
    this.requireMutable(row);
    if ((side === "front" ? row.front_ref : row.back_ref) === input.objectKey
      && (side === "front" ? row.front_valid : row.back_valid) !== null) {
      return this.getStatus(actorId, input.kycId);
    }
    const otherRef = side === "front" ? row.back_ref : row.front_ref;
    if (input.objectKey === otherRef) {
      throw new DomainError("VALIDATION_FAILED", 422, "CCCD front and back must use different images");
    }
    const expectedFolder = `seller-onboarding/${actorId}/cccd/`;
    const image = await this.readImage(input.objectKey, expectedFolder);
    const result = await this.callProvider(() => this.provider.analyzeDocument(side, image));
    const refColumn = side === "front" ? "front_ref" : "back_ref";
    const validColumn = side === "front" ? "front_valid" : "back_valid";
    const identity = result.identity;
    await this.withMutableKyc(actorId, input.kycId, async (client) => {
      await client.query(
        `UPDATE seller_kyc SET
           ${refColumn} = $2, ${validColumn} = $3,
           citizen_id_enc = COALESCE($4, citizen_id_enc),
           full_name_enc = COALESCE($5, full_name_enc),
           dob_enc = COALESCE($6, dob_enc), gender_enc = COALESCE($7, gender_enc),
           address_enc = COALESCE($8, address_enc), issued_at_enc = COALESCE($9, issued_at_enc),
           provider_reference = COALESCE($10, provider_reference), updated_at = now()
         WHERE id = $1`,
        [
          input.kycId,
          input.objectKey,
          result.documentValid,
          this.encryptOptional(identity.citizenId),
          this.encryptOptional(identity.fullName),
          this.encryptOptional(identity.dateOfBirth),
          this.encryptOptional(identity.gender),
          this.encryptOptional(identity.address),
          this.encryptOptional(identity.issuedAt),
          result.reference ?? null
        ]
      );
    });
    return this.getStatus(actorId, input.kycId);
  }

  async submitSelfie(actorId: string, input: SubmitKycDocumentInput): Promise<KycStatusResponse> {
    const row = await this.requireOwnedKyc(actorId, input.kycId);
    this.requireMutable(row);
    if (row.selfie_ref === input.objectKey && row.face_matched !== null && row.liveness_passed !== null) {
      return this.getStatus(actorId, input.kycId);
    }
    if (!row.front_ref || !row.back_ref || row.front_valid !== true || row.back_valid !== true) {
      throw new DomainError("INVALID_KYC_STATE", 409, "Both valid CCCD sides are required before selfie verification");
    }
    const [document, selfie] = await Promise.all([
      this.readImage(row.front_ref, `seller-onboarding/${actorId}/cccd/`),
      this.readImage(input.objectKey, `seller-onboarding/${actorId}/selfie/`)
    ]);
    const [face, liveness] = await Promise.all([
      this.callProvider(() => this.provider.compareFace(document, selfie)),
      this.callProvider(() => this.provider.checkLiveness(selfie))
    ]);
    await this.withMutableKyc(actorId, input.kycId, async (client) => {
      await client.query(
        `UPDATE seller_kyc SET selfie_ref = $2, face_matched = $3, face_match_score = $4,
           liveness_passed = $5, liveness_score = $6,
           provider_reference = COALESCE($7, $8, provider_reference), updated_at = now()
         WHERE id = $1`,
        [input.kycId, input.objectKey, face.matched, face.score, liveness.passed, liveness.score,
          face.reference ?? null, liveness.reference ?? null]
      );
    });
    return this.getStatus(actorId, input.kycId);
  }

  async submitTax(actorId: string, input: SubmitKycTaxInput): Promise<KycStatusResponse> {
    const row = await this.requireOwnedKyc(actorId, input.kycId);
    this.requireMutable(row);
    const result = await this.businessVerification.verifyTax(input.taxCode);
    await this.withMutableKyc(actorId, input.kycId, async (client) => {
      await client.query(
        `INSERT INTO seller_tax_info (kyc_id, user_id, tax_code_enc, taxpayer_name_enc, verification_status, verified)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (kyc_id) DO UPDATE SET tax_code_enc = EXCLUDED.tax_code_enc,
           taxpayer_name_enc = EXCLUDED.taxpayer_name_enc, verification_status = EXCLUDED.verification_status,
           verified = EXCLUDED.verified, created_at = now()`,
        [input.kycId, actorId, encryptPii(input.taxCode, this.piiKey), this.encryptOptional(result.registeredName),
          result.status, result.status === "VERIFIED"]
      );
    });
    return this.getStatus(actorId, input.kycId);
  }

  async submitBank(actorId: string, input: SubmitKycBankInput): Promise<KycStatusResponse> {
    const row = await this.requireOwnedKyc(actorId, input.kycId);
    this.requireMutable(row);
    const result = await this.businessVerification.verifyBank(input.bankCode, input.accountNumber);
    const identityName = decryptPii(row.full_name_enc, this.piiKey);
    const nameScore = identityName && result.registeredName
      ? Number(normalizePersonName(identityName) === normalizePersonName(result.registeredName))
      : null;
    await this.withMutableKyc(actorId, input.kycId, async (client) => {
      await client.query(
        `INSERT INTO seller_bank_accounts (
           kyc_id, user_id, bank_code, account_number_enc, account_holder_name_enc,
           name_match_score, verification_status, verified
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (kyc_id) DO UPDATE SET bank_code = EXCLUDED.bank_code,
           account_number_enc = EXCLUDED.account_number_enc,
           account_holder_name_enc = EXCLUDED.account_holder_name_enc,
           name_match_score = EXCLUDED.name_match_score,
           verification_status = EXCLUDED.verification_status,
           verified = EXCLUDED.verified, created_at = now()`,
        [input.kycId, actorId, input.bankCode, encryptPii(input.accountNumber, this.piiKey),
          this.encryptOptional(result.registeredName), nameScore, result.status,
          result.status === "VERIFIED" && nameScore === 1]
      );
    });
    return this.getStatus(actorId, input.kycId);
  }


  async getStatus(actorId: string, kycId: string): Promise<KycStatusResponse> {
    const row = await this.requireOwnedKyc(actorId, kycId);
    return this.statusResponse(row);
  }

  private statusResponse(row: KycRow): KycStatusResponse {
    return {
      success: true,
      kycStatus: row.status,
      review: row.reason && row.reviewed_at ? { reason: row.reason, reviewedAt: row.reviewed_at.toISOString() } : null,
      identity: {
        citizenId: maskPii(decryptPii(row.citizen_id_enc, this.piiKey)),
        fullName: decryptPii(row.full_name_enc, this.piiKey),
        dateOfBirth: decryptPii(row.dob_enc, this.piiKey),
        gender: decryptPii(row.gender_enc, this.piiKey),
        address: decryptPii(row.address_enc, this.piiKey),
        issuedAt: decryptPii(row.issued_at_enc, this.piiKey)
      },
      verification: {
        documentValid: row.front_valid === null || row.back_valid === null
          ? null
          : row.front_valid && row.back_valid,
        faceMatched: row.face_matched,
        faceScore: row.face_match_score,
        livenessPassed: row.liveness_passed,
        livenessScore: row.liveness_score
      }
    };
  }

  async requireReviewer(actor: { id: string; aal?: string }): Promise<void> {
    if (actor.aal !== "aal2") throw new DomainError("MFA_REQUIRED", 403, "Staff access requires AAL2");
    const result = await this.pool.query(
      `SELECT 1 FROM platform_staff_roles r JOIN profiles p ON p.id = r.user_id
       WHERE r.user_id = $1 AND r.role IN ('MODERATOR', 'SUPER_ADMIN')
         AND r.status = 'ACTIVE' AND p.status = 'ACTIVE'`, [actor.id]
    );
    if (!result.rowCount) throw new DomainError("FORBIDDEN", 403, "KYC review permission required");
  }

  async listReviews(actor: { id: string; aal?: string }, query: AdminKycQuery): Promise<AdminKycQueue> {
    await this.requireReviewer(actor);
    const parsed = adminKycQuerySchema.safeParse(query);
    if (!parsed.success) throw new DomainError("VALIDATION_FAILED", 422, "Invalid queue query");
    const [date, id] = parsed.data.cursor?.split("|") ?? [];
    if (date && !Number.isFinite(Date.parse(date))) throw new DomainError("VALIDATION_FAILED", 422, "Invalid queue cursor");
    const result = await this.pool.query<{
      kycId: string; shopId: string; shopDisplayName: string; status: "MANUAL_REVIEW";
      provider: string; submittedAt: Date; cursor: string;
    }>(
      `SELECT k.id AS "kycId", k.shop_id AS "shopId", s.display_name AS "shopDisplayName",
         k.status, k.provider, k.created_at AS "submittedAt",
         to_char(k.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') || '|' || k.id AS cursor
       FROM seller_kyc k JOIN shops s ON s.id = k.shop_id
       WHERE k.status = 'MANUAL_REVIEW' AND ($1::timestamptz IS NULL OR (k.created_at, k.id) > ($1::timestamptz, $2::text))
       ORDER BY k.created_at, k.id LIMIT 26`, [date ?? null, id ?? null]
    );
    const rows = result.rows.slice(0, 25);
    return {
      items: rows.map((row) => ({ kycId: row.kycId, shopId: row.shopId, shopDisplayName: row.shopDisplayName,
        status: row.status, provider: row.provider, submittedAt: row.submittedAt.toISOString() })),
      nextCursor: result.rows.length > 25 ? rows.at(-1)!.cursor : null
    };
  }

  async getReviewDetail(actor: { id: string; aal?: string }, kycId: string): Promise<AdminKycDetail> {
    await this.requireReviewer(actor);
    const result = await this.pool.query<EvaluationRow & {
      display_name: string; bank_code: string | null; account_number_enc: Buffer | null;
      account_holder_name_enc: Buffer | null;
    }>(
      `SELECT k.*, s.display_name, t.verification_status AS tax_status, t.taxpayer_name_enc,
         b.verification_status AS bank_status, b.bank_code, b.account_number_enc,
         b.account_holder_name_enc, b.name_match_score, r.reason, r.created_at AS reviewed_at
       FROM seller_kyc k JOIN shops s ON s.id = k.shop_id
       LEFT JOIN seller_tax_info t ON t.kyc_id = k.id
       LEFT JOIN seller_bank_accounts b ON b.kyc_id = k.id
       LEFT JOIN seller_kyc_reviews r ON r.kyc_id = k.id WHERE k.id = $1`, [kycId]
    );
    const row = result.rows[0];
    if (!row) throw new DomainError("RESOURCE_NOT_FOUND", 404, "KYC request not found");
    const status = this.statusResponse(row);
    return {
      kycId: row.id, shopId: row.shop_id, shopDisplayName: row.display_name,
      status: row.status, provider: row.provider, submittedAt: row.created_at.toISOString(),
      identity: status.identity, verification: status.verification, review: status.review,
      tax: { status: row.tax_status, registeredName: decryptPii(row.taxpayer_name_enc, this.piiKey) },
      bank: {
        bankCode: row.bank_code, accountNumber: maskPii(decryptPii(row.account_number_enc, this.piiKey)),
        status: row.bank_status, registeredName: decryptPii(row.account_holder_name_enc, this.piiKey),
        nameMatchScore: row.name_match_score
      }
    };
  }

  async decideReview(actor: { id: string; aal?: string }, kycId: string, input: KycDecisionInput, key: string): Promise<KycDecisionResult> {
    await this.requireReviewer(actor);
    const parsed = kycDecisionSchema.safeParse(input);
    const parsedKey = kycIdempotencyKeySchema.safeParse(key);
    if (!parsed.success || !parsedKey.success) throw new DomainError("VALIDATION_FAILED", 422, "Decision, reason and UUID Idempotency-Key required");
    const { decision, reason } = parsed.data;
    const hash = createHash("sha256").update(JSON.stringify({ kycId, decision, reason })).digest("hex");
    const client = await this.pool.connect();
    let source: KycRow | undefined;
    try {
      await client.query("BEGIN");
      // Serialize retries across different KYC IDs too; the unique key remains the database backstop.
      await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [`${actor.id}:${key.toLowerCase()}`]);
      const previous = await client.query<{
        kyc_id: string; decision: "APPROVE" | "REJECT"; reason: string; request_hash: string; created_at: Date;
      }>("SELECT * FROM seller_kyc_reviews WHERE reviewer_id = $1 AND idempotency_key = $2", [actor.id, key]);
      const review = previous.rows[0];
      if (review) {
        if (review.request_hash !== hash) throw new DomainError("IDEMPOTENCY_CONFLICT", 409, "Idempotency key already used with another payload");
        await client.query("COMMIT");
        return { kycId: review.kyc_id, kycStatus: review.decision === "APPROVE" ? "VERIFIED" : "REJECTED",
          review: { reason: review.reason, reviewedAt: review.created_at.toISOString() } };
      }
      const locked = await client.query<KycRow>("SELECT * FROM seller_kyc WHERE id = $1 FOR UPDATE", [kycId]);
      const row = locked.rows[0];
      if (!row) throw new DomainError("RESOURCE_NOT_FOUND", 404, "KYC request not found");
      if (row.status !== "MANUAL_REVIEW") throw new DomainError("INVALID_KYC_STATE", 409, "Only MANUAL_REVIEW can be decided");
      const inserted = await client.query<{ created_at: Date }>(
        `INSERT INTO seller_kyc_reviews (id, kyc_id, reviewer_id, decision, reason, idempotency_key, request_hash)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING created_at`,
        [`RBXKYCR-${ulid()}`, kycId, actor.id, decision, reason, key, hash]
      );
      const status = decision === "APPROVE" ? "VERIFIED" : "REJECTED";
      await this.setStatus(client, kycId, row.shop_id, status);
      await client.query("COMMIT");
      source = row;
      return { kycId, kycStatus: status, review: { reason, reviewedAt: inserted.rows[0]!.created_at.toISOString() } };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
      if (source) await this.deleteSourceImages(source);
    }
  }

  private async withMutableKyc(actorId: string, kycId: string, write: (client: PoolClient) => Promise<void>): Promise<void> {
    const client = await this.pool.connect();
    let row: KycRow | undefined;
    try {
      await client.query("BEGIN");
      const locked = await client.query<KycRow>("SELECT * FROM seller_kyc WHERE id = $1 FOR UPDATE", [kycId]);
      if (!locked.rows[0] || locked.rows[0].user_id !== actorId) throw new DomainError("RESOURCE_NOT_FOUND", 404, "KYC request not found");
      this.requireMutable(locked.rows[0]);
      await write(client);
      row = await this.refreshStatus(client, kycId);
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
    if (row && (row.status === "VERIFIED" || row.status === "REJECTED")) await this.deleteSourceImages(row);
  }

  private async refreshStatus(client: PoolClient, kycId: string): Promise<KycRow> {
    const result = await client.query<EvaluationRow>(
      `SELECT k.*, t.verification_status AS tax_status, t.taxpayer_name_enc,
              b.verification_status AS bank_status, b.name_match_score
       FROM seller_kyc k
       LEFT JOIN seller_tax_info t ON t.kyc_id = k.id
       LEFT JOIN seller_bank_accounts b ON b.kyc_id = k.id
       WHERE k.id = $1`,
      [kycId]
    );
    const row = result.rows[0]!;
    const status = this.evaluate(row);
    await this.setStatus(client, kycId, row.shop_id, status);
    return { ...row, status };
  }

  private async setStatus(client: PoolClient, kycId: string, shopId: string, status: KycStatus): Promise<void> {
    await client.query(
      `UPDATE seller_kyc SET status = $2,
         verified_at = CASE WHEN $2 = 'VERIFIED' THEN now() ELSE NULL END,
         updated_at = now() WHERE id = $1`, [kycId, status]
    );
    await client.query(
      `UPDATE shops SET kyc_status = $2,
         status = CASE WHEN $2 = 'VERIFIED' AND status = 'ONBOARDING' THEN 'ACTIVE' ELSE status END,
         kyc_verified_at = CASE WHEN $2 = 'VERIFIED' THEN now() ELSE NULL END
       WHERE id = $1`, [shopId, status]
    );
  }

  private evaluate(row: EvaluationRow): KycStatus {
    const identityName = decryptPii(row.full_name_enc, this.piiKey);
    const taxpayerName = decryptPii(row.taxpayer_name_enc, this.piiKey);
    // ponytail: exact normalized matching is conservative; add an audited fuzzy matcher only with real false-reject data.
    return evaluateKycStatus({
      frontValid: row.front_valid,
      backValid: row.back_valid,
      faceMatched: row.face_matched,
      livenessPassed: row.liveness_passed,
      taxStatus: row.tax_status,
      bankStatus: row.bank_status,
      taxNameMatched: Boolean(identityName && taxpayerName
        && normalizePersonName(identityName) === normalizePersonName(taxpayerName)),
      bankNameMatched: row.name_match_score === 1
    });
  }

  private async requireOwnedKyc(actorId: string, kycId: string): Promise<KycRow> {
    const result = await this.pool.query<KycRow>(
      `SELECT k.*, r.reason, r.created_at AS reviewed_at FROM seller_kyc k
       LEFT JOIN seller_kyc_reviews r ON r.kyc_id = k.id
       JOIN shop_memberships m ON m.shop_id = k.shop_id
       WHERE k.id = $1 AND k.user_id = $2 AND m.user_id = $2 AND m.role = 'OWNER' AND m.status = 'ACTIVE'`,
      [kycId, actorId]
    );
    if (!result.rows[0]) throw new DomainError("RESOURCE_NOT_FOUND", 404, "KYC request not found");
    return result.rows[0];
  }

  private requireMutable(row: KycRow): void {
    if (row.status !== "PENDING" && row.status !== "PROCESSING") {
      throw new DomainError("INVALID_KYC_STATE", 409, `KYC request is already ${row.status.toLowerCase()}`);
    }
  }

  private async readImage(key: string, expectedPrefix: string): Promise<KycImage> {
    if (!key.startsWith(expectedPrefix)) throw new DomainError("RESOURCE_NOT_FOUND", 404, "KYC image not found");
    const metadata = await this.storage.inspectObject(key);
    requireKycImage(metadata);
    return { bytes: await this.storage.readObject(key), mimeType: metadata!.mimeType };
  }

  private encryptOptional(value: string | undefined): Buffer | null {
    return value ? encryptPii(value, this.piiKey) : null;
  }

  private async callProvider<T>(call: () => Promise<T>): Promise<T> {
    try {
      return await call();
    } catch {
      throw new DomainError("KYC_PROVIDER_UNAVAILABLE", 503, "KYC provider is temporarily unavailable");
    }
  }

  private async deleteSourceImages(row: KycRow): Promise<void> {
    const keys = [row.front_ref, row.back_ref, row.selfie_ref].filter((key): key is string => Boolean(key));
    await Promise.allSettled(keys.map((key) => this.storage.deleteObject(key)));
  }
}

export function normalizePersonName(value: string): string {
  return value.normalize("NFD").replace(/[Đđ]/g, "D").replace(/[\u0300-\u036f]/g, "")
    .toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function evaluateKycStatus(input: {
  frontValid: boolean | null;
  backValid: boolean | null;
  faceMatched: boolean | null;
  livenessPassed: boolean | null;
  taxStatus: "VERIFIED" | "NOT_FOUND" | "UNAVAILABLE" | null;
  bankStatus: "VERIFIED" | "NOT_FOUND" | "UNAVAILABLE" | null;
  taxNameMatched: boolean;
  bankNameMatched: boolean;
}): KycStatus {
  if (input.frontValid === false || input.backValid === false || input.faceMatched === false
    || input.livenessPassed === false || input.taxStatus === "NOT_FOUND" || input.bankStatus === "NOT_FOUND") {
    return "REJECTED";
  }
  if (input.frontValid !== true || input.backValid !== true || input.faceMatched !== true
    || input.livenessPassed !== true || !input.taxStatus || !input.bankStatus) return "PROCESSING";
  if (input.taxStatus === "UNAVAILABLE" || input.bankStatus === "UNAVAILABLE"
    || !input.taxNameMatched || !input.bankNameMatched) return "MANUAL_REVIEW";
  return "VERIFIED";
}

function requireKycImage(image: CatalogImageObject | null): asserts image is CatalogImageObject {
  if (!image || !["image/jpeg", "image/png", "image/webp"].includes(image.mimeType)
    || image.sizeBytes <= 0 || image.sizeBytes > 5 * 1024 * 1024
    || image.width <= 0 || image.height <= 0 || !/^[a-f0-9]{64}$/.test(image.sha256)) {
    throw new DomainError("VALIDATION_FAILED", 422, "KYC image must be a readable JPEG, PNG or WebP up to 5 MiB");
  }
}

function maskPii(value: string | null): string | null {
  return value ? "*".repeat(Math.max(4, value.length - 4)) + (value.length > 4 ? value.slice(-4) : "") : null;
}
