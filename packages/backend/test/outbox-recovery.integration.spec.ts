import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { expect, it } from "vitest";
import { OutboxModule } from "../src/platform/outbox";

it("isolates a failed event, backs it off and processes the next event", async () => {
  const connectionString = process.env.DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
  const namespace = `outbox_test_${randomUUID().replaceAll("-", "")}`;
  const admin = new Pool({ connectionString });
  const pool = new Pool({ connectionString, options: `-c search_path=${namespace},public` });
  try {
    await admin.query(`CREATE SCHEMA ${namespace}`);
    for (const table of ["outbox_events", "notifications", "listings", "shop_memberships"]) {
      await admin.query(`CREATE TABLE ${namespace}.${table} (LIKE public.${table} INCLUDING ALL)`);
    }
    await pool.query("INSERT INTO shop_memberships(shop_id,user_id,role,status) VALUES('shop',$1,'OWNER','ACTIVE')", [randomUUID()]);
    // Force the first listing query to fail at the database boundary, without changing application code.
    await pool.query("ALTER TABLE listings RENAME COLUMN shop_id TO intentionally_unavailable");
    await pool.query(`INSERT INTO outbox_events(id,topic,aggregate_id,payload) VALUES
      ('poison','listing.published','listing','{}'),('healthy','commerce.reservation_expire','order','{}')`);
    expect(await new OutboxModule(pool).processBatch()).toBe(2);
    const rows = (await pool.query("SELECT id,status,attempts,last_error,available_at>now() AS delayed FROM outbox_events ORDER BY id")).rows;
    expect(rows).toEqual([
      expect.objectContaining({ id: "healthy", status: "PROCESSED", attempts: 1, last_error: null }),
      expect.objectContaining({ id: "poison", status: "PENDING", attempts: 1, last_error: "42703", delayed: true })
    ]);
  } finally { await pool.end(); await admin.query(`DROP SCHEMA IF EXISTS ${namespace} CASCADE`); await admin.end(); }
});
