CREATE TABLE evidence_uploads (
  id uuid PRIMARY KEY,
  evidence_id text NOT NULL UNIQUE,
  case_id text NOT NULL REFERENCES dispute_cases(id),
  actor_id uuid NOT NULL REFERENCES profiles(id),
  actor_role text NOT NULL CHECK (actor_role IN ('BUYER','SELLER')),
  processing_record_id text NOT NULL REFERENCES processing_records(id),
  bucket text NOT NULL,
  region text NOT NULL,
  object_key text NOT NULL UNIQUE,
  mime_type text NOT NULL,
  size_bytes bigint NOT NULL CHECK (size_bytes>0 AND size_bytes<=20971520),
  checksum text NOT NULL,
  retain_until timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'UPLOADING' CHECK (status IN ('UPLOADING','READY')),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE evidence_uploads ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON evidence_uploads FROM anon,authenticated;
--> statement-breakpoint
ALTER TABLE dispute_evidences ADD COLUMN storage_bucket text;
ALTER TABLE dispute_evidences ADD COLUMN storage_region text;
ALTER TABLE dispute_evidences ADD COLUMN mime_type text;
ALTER TABLE dispute_evidences ADD COLUMN duration_seconds numeric;
