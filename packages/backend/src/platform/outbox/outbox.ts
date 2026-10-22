import type { Pool, PoolClient } from "pg";

type OutboxRow = {
  id: string;
  topic: string;
  aggregate_id: string | null;
};

const supportedTopics = new Set([
  "listing.published", "listing.pending_review", "listing.reviewed", "commerce.reservation_expire",
  "commerce.order_confirmed", "fulfillment.status_changed", "claims.opened"
]);

export class OutboxModule {
  constructor(private readonly pool: Pool) {}

  async processBatch(limit = 10): Promise<number> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const claimed = await client.query<OutboxRow>(
        `SELECT id, topic, aggregate_id
         FROM outbox_events
         WHERE status = 'PENDING' AND available_at <= now()
         ORDER BY created_at ASC
         FOR UPDATE SKIP LOCKED
         LIMIT $1`,
        [limit]
      );

      for (const event of claimed.rows) {
        if (!supportedTopics.has(event.topic)) {
          await client.query(
            `UPDATE outbox_events
             SET status = 'DEAD', attempts = attempts + 1,
                 claimed_at = now(), last_error = 'UNSUPPORTED_TOPIC'
             WHERE id = $1 AND status = 'PENDING'`,
            [event.id]
          );
          continue;
        }
        await client.query("SAVEPOINT outbox_event");
        try {
          await this.createInAppNotifications(client, event);
          await client.query(
          `UPDATE outbox_events
           SET status = 'PROCESSED', attempts = attempts + 1,
               claimed_at = now(), processed_at = now(), last_error = NULL
           WHERE id = $1 AND status = 'PENDING'`,
          [event.id]
          );
          await client.query("RELEASE SAVEPOINT outbox_event");
        } catch (error) {
          await client.query("ROLLBACK TO SAVEPOINT outbox_event");
          await client.query("RELEASE SAVEPOINT outbox_event");
          const code = (error as { code?: string }).code;
          await client.query(`UPDATE outbox_events SET attempts=attempts+1,
            status=CASE WHEN attempts+1>=8 THEN 'DEAD' ELSE 'PENDING' END,
            available_at=now()+least(3600,power(2,least(attempts+1,12))) * interval '1 second',
            claimed_at=now(),last_error=$2 WHERE id=$1`,
          [event.id, code && /^[A-Z0-9_]{1,40}$/.test(code) ? code : "EVENT_PROCESSING_FAILED"]);
        }
      }

      await client.query("COMMIT");
      return claimed.rowCount ?? 0;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  private async createInAppNotifications(client: PoolClient, event: OutboxRow): Promise<void> {
    if (!event.aggregate_id || event.topic === "commerce.reservation_expire") return;
    let users: string[] = [];
    if (event.topic.startsWith("listing.")) {
      users = (await client.query<{ user_id: string }>(
        `SELECT m.user_id::text FROM listings l JOIN shop_memberships m ON m.shop_id=l.shop_id
         WHERE l.id=$1 AND m.status='ACTIVE'`, [event.aggregate_id]
      )).rows.map((row) => row.user_id);
    } else if (event.topic === "commerce.order_confirmed" || event.topic === "fulfillment.status_changed") {
      users = (await client.query<{ buyer_id: string }>("SELECT buyer_id::text FROM orders WHERE id=$1", [event.aggregate_id])).rows.map((row) => row.buyer_id);
    } else if (event.topic === "claims.opened") {
      users = (await client.query<{ user_id: string }>(
        `SELECT m.user_id::text FROM dispute_cases c JOIN shop_memberships m ON m.shop_id=c.shop_id
         WHERE c.id=$1 AND m.status='ACTIVE'`, [event.aggregate_id]
      )).rows.map((row) => row.user_id);
    }
    const title = event.topic === "commerce.order_confirmed" ? "Đơn sandbox đã xác nhận"
      : event.topic === "fulfillment.status_changed" ? "Trạng thái giao hàng đã cập nhật"
      : event.topic === "claims.opened" ? "Có tranh chấp mới" : "Trạng thái listing đã cập nhật";
    for (const userId of users) {
      await client.query(
        `INSERT INTO notifications(id,user_id,stable_key,kind,mandatory,title,body,delivered_at)
         VALUES($1,$2,$3,$4,true,$5,$6,now()) ON CONFLICT(stable_key) DO NOTHING`,
        [`NTF-${event.id}-${userId}`, userId, `${event.id}:${userId}:IN_APP`, event.topic, title, `Sự kiện ${event.topic} đã được xử lý trong sandbox.`]
      );
    }
  }
}
