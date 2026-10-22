-- TEST ONLY: minimal platform relations for business-module PostgreSQL tests.
-- This is not Supabase Auth/Storage and cannot run browser/auth-provider E2E tests.
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE SCHEMA auth;
CREATE SCHEMA storage;
CREATE EXTENSION pgcrypto;
CREATE TABLE auth.users (
  id uuid PRIMARY KEY, instance_id uuid, aud text, role text, email text, encrypted_password text,
  email_confirmed_at timestamptz, confirmation_token text, recovery_token text,
  email_change_token_new text, email_change text, raw_app_meta_data jsonb, raw_user_meta_data jsonb,
  created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now()
);
CREATE TABLE auth.identities (
  provider_id text, user_id uuid REFERENCES auth.users(id), identity_data jsonb, provider text,
  last_sign_in_at timestamptz, created_at timestamptz, updated_at timestamptz,
  UNIQUE(provider_id,provider)
);
CREATE TABLE storage.buckets (
  id text PRIMARY KEY, name text NOT NULL, public boolean DEFAULT false,
  file_size_limit bigint, allowed_mime_types text[]
);
