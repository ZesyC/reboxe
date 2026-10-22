CREATE SEQUENCE payos_promotion_order_code_seq START WITH 1000000000 MAXVALUE 9007199254740991;
CREATE TABLE promotion_credit_topups (
  id uuid PRIMARY KEY,
  actor_id uuid NOT NULL REFERENCES profiles(id),
  shop_id text NOT NULL REFERENCES shops(id),
  idempotency_key uuid NOT NULL,
  merchant_client_id text NOT NULL,
  order_code bigint NOT NULL UNIQUE DEFAULT nextval('payos_promotion_order_code_seq'),
  amount_vnd bigint NOT NULL CHECK (amount_vnd BETWEEN 10000 AND 10000000),
  payment_link_id text UNIQUE,
  checkout_url text,
  status text NOT NULL DEFAULT 'CREATING' CHECK (status IN ('CREATING','UNKNOWN','PENDING','PAID','CANCELLED','EXPIRED')),
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  paid_at timestamptz,
  UNIQUE(actor_id,idempotency_key)
);
CREATE TABLE payos_receipts (
  reference text PRIMARY KEY,
  topup_id uuid NOT NULL REFERENCES promotion_credit_topups(id),
  payload_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE promotion_credit_topups ENABLE ROW LEVEL SECURITY;
ALTER TABLE payos_receipts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON promotion_credit_topups,payos_receipts FROM anon,authenticated;
REVOKE ALL ON SEQUENCE payos_promotion_order_code_seq FROM anon,authenticated;
--> statement-breakpoint
ALTER TABLE ledger_transactions DROP CONSTRAINT ledger_transactions_kind_check;
ALTER TABLE ledger_transactions ADD CONSTRAINT ledger_transactions_kind_check CHECK (kind IN (
 'SANDBOX_BALANCE_SEED','HOLD_CREATE','HOLD_RELEASE','HOLD_CAPTURE_SIMULATED',
 'PROMOTION_CREDIT_SEED','PROMOTION_PURCHASE','PROMOTION_REFUND','PROMOTION_CREDIT_PAID'
));
--> statement-breakpoint
CREATE OR REPLACE FUNCTION reboxe_guard_ledger() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_TABLE_NAME='ledger_transactions' THEN
    IF OLD.status='POSTED' THEN RAISE EXCEPTION 'POSTED_LEDGER_IMMUTABLE'; END IF;
  ELSE
    IF TG_OP<>'INSERT' AND EXISTS(SELECT 1 FROM ledger_transactions WHERE id=OLD.transaction_id AND status='POSTED') THEN
      RAISE EXCEPTION 'POSTED_LEDGER_IMMUTABLE';
    END IF;
    IF TG_OP<>'DELETE' AND EXISTS(SELECT 1 FROM ledger_transactions WHERE id=NEW.transaction_id AND status='POSTED') THEN
      RAISE EXCEPTION 'POSTED_LEDGER_IMMUTABLE';
    END IF;
  END IF;
  RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
END $$;
DROP TRIGGER ledger_postings_immutable ON ledger_postings;
CREATE TRIGGER ledger_postings_immutable BEFORE INSERT OR UPDATE OR DELETE ON ledger_postings FOR EACH ROW EXECUTE FUNCTION reboxe_guard_ledger();
