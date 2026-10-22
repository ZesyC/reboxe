CREATE TABLE marketplace_authorizations (
  id uuid PRIMARY KEY,
  shop_id text NOT NULL REFERENCES shops(id),
  actor_id uuid NOT NULL REFERENCES profiles(id),
  platform text NOT NULL CHECK (platform IN ('SHOPEE','TIKTOK')),
  state_hash text NOT NULL UNIQUE,
  notice_version text NOT NULL,
  status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','EXCHANGING','SELECT_SHOP','COMPLETED','FAILED')),
  grants_enc bytea,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);
CREATE INDEX marketplace_authorizations_expiry ON marketplace_authorizations(expires_at);
--> statement-breakpoint
CREATE TABLE marketplace_connections (
  id uuid PRIMARY KEY,
  shop_id text NOT NULL REFERENCES shops(id),
  platform text NOT NULL CHECK (platform IN ('SHOPEE','TIKTOK')),
  external_shop_id text NOT NULL,
  shop_name text NOT NULL,
  credentials_enc bytea,
  status text NOT NULL CHECK (status IN ('CONNECTED','REAUTH_REQUIRED','DISCONNECTED')),
  consent_actor_id uuid NOT NULL REFERENCES profiles(id),
  notice_version text NOT NULL,
  token_expires_at timestamptz NOT NULL,
  refresh_expires_at timestamptz NOT NULL,
  connected_at timestamptz NOT NULL DEFAULT now(),
  disconnected_at timestamptz,
  last_synced_at timestamptz,
  refresh_retry_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(shop_id,platform),
  UNIQUE(platform,external_shop_id),
  CHECK ((status = 'DISCONNECTED') = (credentials_enc IS NULL))
);
--> statement-breakpoint
CREATE TABLE marketplace_connection_events (
  id uuid PRIMARY KEY,
  shop_id text NOT NULL REFERENCES shops(id),
  platform text NOT NULL,
  actor_id uuid NOT NULL REFERENCES profiles(id),
  event text NOT NULL CHECK (event IN ('CONSENT','CONNECTED','DISCONNECTED','REAUTH_REQUIRED')),
  notice_version text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE marketplace_authorizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketplace_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketplace_connection_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON marketplace_authorizations, marketplace_connections, marketplace_connection_events FROM anon,authenticated;
