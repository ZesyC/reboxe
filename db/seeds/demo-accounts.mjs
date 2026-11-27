/* global console, process */
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { Pool } = require("../../packages/backend/node_modules/pg");
const { createClient } = require("../../apps/api/node_modules/@supabase/supabase-js");
const { createPiiKey, encryptPii } = require("../../packages/backend/dist/modules/identity/pii.js");

const supabaseUrl = process.env.SUPABASE_URL ?? "http://127.0.0.1:54321";
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseSecretKey) {
  throw new Error("SUPABASE_SECRET_KEY or SUPABASE_SERVICE_ROLE_KEY is required");
}

const databaseUrl = process.env.DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const piiSecret = process.env.SELLER_PII_ENCRYPTION_KEY ?? "local-dev-only-seller-pii-encryption-key-change-before-production";
const piiKey = createPiiKey(piiSecret);

const supabase = createClient(supabaseUrl, supabaseSecretKey, {
  auth: { persistSession: false, autoRefreshToken: false }
});

const pool = new Pool({
  connectionString: databaseUrl,
  ssl: process.env.PGSSLMODE === "require" ? { rejectUnauthorized: false } : undefined
});

async function upsertAuthUser({ email, password, phone, userMetadata }) {
  const existing = await pool.query("SELECT id FROM auth.users WHERE email = $1", [email]);
  const existingId = existing.rows[0]?.id;

  const basePayload = {
    email,
    password,
    email_confirm: true,
    user_metadata: userMetadata
  };

  if (existingId) {
    let res = await supabase.auth.admin.updateUserById(existingId, {
      ...basePayload,
      phone,
      phone_confirm: true
    });
    if (res.error && phone) {
      console.warn(`Warning: updateUserById with phone failed for ${email} (${res.error.message}); retrying without phone`);
      res = await supabase.auth.admin.updateUserById(existingId, basePayload);
    }
    if (res.error || !res.data.user) {
      throw new Error(`Failed to update auth user ${email}: ${res.error?.message ?? "unknown error"}`);
    }
    return res.data.user.id;
  }

  let res = await supabase.auth.admin.createUser({
    ...basePayload,
    phone,
    phone_confirm: true
  });
  if (res.error && phone) {
    console.warn(`Warning: createUser with phone failed for ${email} (${res.error.message}); retrying without phone`);
    res = await supabase.auth.admin.createUser(basePayload);
  }
  if (res.error || !res.data.user) {
    throw new Error(`Failed to create auth user ${email}: ${res.error?.message ?? "unknown error"}`);
  }
  return res.data.user.id;
}

async function seedBuyer(buyerId) {
  const addressId = "RBXADDR-01JDM0BUYER000000000000001";
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `INSERT INTO profiles (id, status) VALUES ($1, 'ACTIVE')
       ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status`,
      [buyerId]
    );
    await client.query(
      `INSERT INTO account_preferences (user_id) VALUES ($1)
       ON CONFLICT (user_id) DO NOTHING`,
      [buyerId]
    );
    await client.query(
      `UPDATE account_addresses SET is_default = false, updated_at = now()
       WHERE user_id = $1 AND id <> $2 AND is_default = true`,
      [buyerId, addressId]
    );
    await client.query(
      `INSERT INTO account_addresses (
         id, user_id, label, recipient_name_enc, phone_enc, address_line_enc,
         ward, district, province, is_default
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true)
       ON CONFLICT (id) DO UPDATE SET
         user_id = EXCLUDED.user_id,
         label = EXCLUDED.label,
         recipient_name_enc = EXCLUDED.recipient_name_enc,
         phone_enc = EXCLUDED.phone_enc,
         address_line_enc = EXCLUDED.address_line_enc,
         ward = EXCLUDED.ward,
         district = EXCLUDED.district,
         province = EXCLUDED.province,
         is_default = EXCLUDED.is_default,
         updated_at = now()`,
      [
        addressId,
        buyerId,
        "Nhà riêng",
        encryptPii("Nguyễn Minh Anh", piiKey),
        encryptPii("0901234501", piiKey),
        encryptPii("128 Nguyễn Huệ", piiKey),
        "Phường Bến Nghé",
        "Quận 1",
        "TP. Hồ Chí Minh"
      ]
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function seedSeller(sellerId) {
  const addressId = "RBXADDR-01JDM0SELLER00000000000001";
  const shopId = "RBX-01JDM0SELLER00000000000001";
  const kycId = "RBXKYC-01JDM0SELLER00000000000001";
  const prId = "RBX-PR-01JDM0SELLER00000000000001";
  const ledgerTxId = "RBX-LTX-DEMO-NGUOIBAN1-SEED";

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `INSERT INTO profiles (id, status) VALUES ($1, 'ACTIVE')
       ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status`,
      [sellerId]
    );
    await client.query(
      `INSERT INTO account_preferences (user_id) VALUES ($1)
       ON CONFLICT (user_id) DO NOTHING`,
      [sellerId]
    );
    await client.query(
      `UPDATE account_addresses SET is_default = false, updated_at = now()
       WHERE user_id = $1 AND id <> $2 AND is_default = true`,
      [sellerId, addressId]
    );
    await client.query(
      `INSERT INTO account_addresses (
         id, user_id, label, recipient_name_enc, phone_enc, address_line_enc,
         ward, district, province, is_default
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true)
       ON CONFLICT (id) DO UPDATE SET
         user_id = EXCLUDED.user_id,
         label = EXCLUDED.label,
         recipient_name_enc = EXCLUDED.recipient_name_enc,
         phone_enc = EXCLUDED.phone_enc,
         address_line_enc = EXCLUDED.address_line_enc,
         ward = EXCLUDED.ward,
         district = EXCLUDED.district,
         province = EXCLUDED.province,
         is_default = EXCLUDED.is_default,
         updated_at = now()`,
      [
        addressId,
        sellerId,
        "Kho / Nhà riêng",
        encryptPii("Trần Quốc Bảo", piiKey),
        encryptPii("0901234502", piiKey),
        encryptPii("45 Lê Lợi", piiKey),
        "Phường Bến Thành",
        "Quận 1",
        "TP. Hồ Chí Minh"
      ]
    );

    await client.query(
      `INSERT INTO shops (id, display_name, legal_type, kyc_status, kyc_verified_at, status)
       VALUES ($1, $2, 'INDIVIDUAL', 'VERIFIED', now(), 'ACTIVE')
       ON CONFLICT (id) DO UPDATE SET
         display_name = EXCLUDED.display_name,
         legal_type = EXCLUDED.legal_type,
         kyc_status = 'VERIFIED',
         kyc_verified_at = COALESCE(shops.kyc_verified_at, now()),
         status = 'ACTIVE'`,
      [shopId, "Kho Hoàn Demo 1"]
    );

    await client.query(
      `INSERT INTO shop_memberships (user_id, shop_id, role, status)
       VALUES ($1, $2, 'OWNER', 'ACTIVE')
       ON CONFLICT (user_id, shop_id) DO UPDATE SET
         role = 'OWNER',
         status = 'ACTIVE'`,
      [sellerId, shopId]
    );

    await client.query(
      `INSERT INTO shop_onboarding_profiles (
         shop_id, description, avatar_ref, phone_enc, pickup_contact_enc, pickup_address_enc,
         pickup_province, pickup_district, pickup_ward, kyc_mode, kyc_front_ref, kyc_back_ref,
         kyc_front_sha256, kyc_back_sha256, tax_code_enc, payout_bank_code,
         payout_account_enc, payout_holder_enc, carrier_codes
       ) VALUES (
         $1, $2, $3, $4, $5, $6,
         $7, $8, $9, 'MANUAL', $10, $11,
         $12, $13, $14, $15,
         $16, $17, $18::jsonb
       )
       ON CONFLICT (shop_id) DO UPDATE SET
         description = EXCLUDED.description,
         avatar_ref = EXCLUDED.avatar_ref,
         phone_enc = EXCLUDED.phone_enc,
         pickup_contact_enc = EXCLUDED.pickup_contact_enc,
         pickup_address_enc = EXCLUDED.pickup_address_enc,
         pickup_province = EXCLUDED.pickup_province,
         pickup_district = EXCLUDED.pickup_district,
         pickup_ward = EXCLUDED.pickup_ward,
         kyc_mode = 'MANUAL',
         kyc_front_ref = EXCLUDED.kyc_front_ref,
         kyc_back_ref = EXCLUDED.kyc_back_ref,
         kyc_front_sha256 = EXCLUDED.kyc_front_sha256,
         kyc_back_sha256 = EXCLUDED.kyc_back_sha256,
         tax_code_enc = EXCLUDED.tax_code_enc,
         payout_bank_code = EXCLUDED.payout_bank_code,
         payout_account_enc = EXCLUDED.payout_account_enc,
         payout_holder_enc = EXCLUDED.payout_holder_enc,
         carrier_codes = EXCLUDED.carrier_codes`,
      [
        shopId,
        "Gian hàng demo người bán đã hoàn tất eKYC, chuyên thanh lý kiện hàng hoàn nguyên trạng tại TP. Hồ Chí Minh.",
        "test-fixtures/seller-avatar.png",
        encryptPii("0901234502", piiKey),
        encryptPii("Trần Quốc Bảo", piiKey),
        encryptPii("45 Lê Lợi", piiKey),
        "TP. Hồ Chí Minh",
        "Quận 1",
        "Phường Bến Thành",
        "test-fixtures/cccd-front.png",
        "test-fixtures/cccd-back.png",
        "a".repeat(64),
        "b".repeat(64),
        encryptPii("0312345678", piiKey),
        "VCB",
        encryptPii("0071001234567", piiKey),
        encryptPii("TRAN QUOC BAO", piiKey),
        JSON.stringify(["GHN", "GHTK"])
      ]
    );

    await client.query(
      `INSERT INTO processing_records (id, actor_id, purpose, target_type, target_id, notice_version)
       VALUES (
         $1, $2, 'KYC', 'SELLER_KYC', $3,
         coalesce(
           (SELECT version FROM legal_artifacts WHERE slug = 'processing-notice' AND effective_at <= now() ORDER BY effective_at DESC LIMIT 1),
           '2.0'
         )
       )
       ON CONFLICT (id) DO NOTHING`,
      [prId, sellerId, kycId]
    );

    await client.query(
      `INSERT INTO seller_kyc (
         id, shop_id, user_id,
         citizen_id_enc, full_name_enc, dob_enc, gender_enc, address_enc, issued_at_enc,
         provider, provider_reference, front_ref, back_ref, selfie_ref,
         front_valid, back_valid, face_matched, face_match_score,
         liveness_passed, liveness_score, status, verified_at
       ) VALUES (
         $1, $2, $3,
         $4, $5, $6, $7, $8, $9,
         'TEST_FIXTURE', 'DEMO-EKYC-PASS-NGUOIBAN1',
         'test-fixtures/cccd-front.png', 'test-fixtures/cccd-back.png', 'test-fixtures/selfie.png',
         true, true, true, 0.992,
         true, 0.995, 'VERIFIED', now()
       )
       ON CONFLICT (shop_id) DO UPDATE SET
         user_id = EXCLUDED.user_id,
         citizen_id_enc = EXCLUDED.citizen_id_enc,
         full_name_enc = EXCLUDED.full_name_enc,
         dob_enc = EXCLUDED.dob_enc,
         gender_enc = EXCLUDED.gender_enc,
         address_enc = EXCLUDED.address_enc,
         issued_at_enc = EXCLUDED.issued_at_enc,
         provider = EXCLUDED.provider,
         provider_reference = EXCLUDED.provider_reference,
         front_ref = EXCLUDED.front_ref,
         back_ref = EXCLUDED.back_ref,
         selfie_ref = EXCLUDED.selfie_ref,
         front_valid = true,
         back_valid = true,
         face_matched = true,
         face_match_score = EXCLUDED.face_match_score,
         liveness_passed = true,
         liveness_score = EXCLUDED.liveness_score,
         status = 'VERIFIED',
         verified_at = COALESCE(seller_kyc.verified_at, now()),
         updated_at = now()`,
      [
        kycId,
        shopId,
        sellerId,
        encryptPii("079093005678", piiKey),
        encryptPii("TRẦN QUỐC BẢO", piiKey),
        encryptPii("20/03/1993", piiKey),
        encryptPii("Nam", piiKey),
        encryptPii("45 Lê Lợi, Phường Bến Thành, Quận 1, TP. Hồ Chí Minh", piiKey),
        encryptPii("15/05/2022", piiKey)
      ]
    );

    const effectiveKycRow = await client.query("SELECT id FROM seller_kyc WHERE shop_id = $1", [shopId]);
    const effectiveKycId = effectiveKycRow.rows[0].id;

    await client.query(
      `INSERT INTO seller_tax_info (kyc_id, user_id, tax_code_enc, taxpayer_name_enc, verification_status, verified)
       VALUES ($1, $2, $3, $4, 'VERIFIED', true)
       ON CONFLICT (kyc_id) DO UPDATE SET
         user_id = EXCLUDED.user_id,
         tax_code_enc = EXCLUDED.tax_code_enc,
         taxpayer_name_enc = EXCLUDED.taxpayer_name_enc,
         verification_status = 'VERIFIED',
         verified = true`,
      [
        effectiveKycId,
        sellerId,
        encryptPii("0312345678", piiKey),
        encryptPii("TRẦN QUỐC BẢO", piiKey)
      ]
    );

    await client.query(
      `INSERT INTO seller_bank_accounts (
         kyc_id, user_id, bank_code, account_number_enc, account_holder_name_enc,
         name_match_score, verification_status, verified
       ) VALUES ($1, $2, 'VCB', $3, $4, 1, 'VERIFIED', true)
       ON CONFLICT (kyc_id) DO UPDATE SET
         user_id = EXCLUDED.user_id,
         bank_code = EXCLUDED.bank_code,
         account_number_enc = EXCLUDED.account_number_enc,
         account_holder_name_enc = EXCLUDED.account_holder_name_enc,
         name_match_score = 1,
         verification_status = 'VERIFIED',
         verified = true`,
      [
        effectiveKycId,
        sellerId,
        encryptPii("0071001234567", piiKey),
        encryptPii("TRAN QUOC BAO", piiKey)
      ]
    );

    await client.query(
      `WITH seeded AS (
         INSERT INTO ledger_transactions (id, kind, reference_id, status)
         VALUES ($1, 'SANDBOX_BALANCE_SEED', $2, 'DRAFT')
         ON CONFLICT (kind, reference_id) DO NOTHING
         RETURNING id
       )
       INSERT INTO ledger_postings (id, transaction_id, account_key, amount_vnd)
       SELECT 'RBX-LP-DEMO-NGUOIBAN1-SHOP', id, $3, 10000000 FROM seeded
       UNION ALL
       SELECT 'RBX-LP-DEMO-NGUOIBAN1-CLEARING', id, 'sandbox:clearing', -10000000 FROM seeded`,
      [ledgerTxId, `${shopId}:DEFAULT`, `shop:${shopId}:available`]
    );

    await client.query(
      `UPDATE ledger_transactions SET status = 'POSTED'
       WHERE id = $1 AND status = 'DRAFT'`,
      [ledgerTxId]
    );

    await client.query("COMMIT");
    return { shopId, kycId: effectiveKycId };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function main() {
  const buyerId = await upsertAuthUser({
    email: "nguoimua1@reboxe.demo",
    password: "nguoimua1",
    phone: "+84901234501",
    userMetadata: {
      full_name: "Nguyễn Minh Anh",
      gender: "Nữ",
      date_of_birth: "15/06/1998",
      phone: "0901234501",
      citizen_id: "079198012345",
      address: "128 Nguyễn Huệ, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh",
      avatar_url: "",
      demo: true
    }
  });
  await seedBuyer(buyerId);

  const sellerId = await upsertAuthUser({
    email: "nguoiban1@reboxe.demo",
    password: "nguoiban1",
    phone: "+84901234502",
    userMetadata: {
      full_name: "Trần Quốc Bảo",
      gender: "Nam",
      date_of_birth: "20/03/1993",
      phone: "0901234502",
      citizen_id: "079093005678",
      address: "45 Lê Lợi, Phường Bến Thành, Quận 1, TP. Hồ Chí Minh",
      avatar_url: "",
      demo: true
    }
  });
  const sellerResult = await seedSeller(sellerId);

  console.log(JSON.stringify({
    buyer: { username: "nguoimua1", email: "nguoimua1@reboxe.demo", userId: buyerId },
    seller: { username: "nguoiban1", email: "nguoiban1@reboxe.demo", userId: sellerId, ...sellerResult }
  }, null, 2));
}

try {
  await main();
} finally {
  await pool.end();
}
