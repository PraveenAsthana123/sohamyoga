import { query } from '@/lib/db';
import { Notification, NotificationProps, NotificationRecipientKind } from './Notification';

interface NotificationRow {
  id: string;
  recipient_kind: NotificationRecipientKind;
  recipient_id: string | null;
  type: string;
  title: string;
  body: string;
  related_call_id: string | null;
  read_at: Date | null;
  created_at: Date;
}

function toEntity(row: NotificationRow): Notification {
  const props: NotificationProps = {
    id: row.id,
    recipientKind: row.recipient_kind,
    recipientId: row.recipient_id,
    type: row.type,
    title: row.title,
    body: row.body,
    relatedCallId: row.related_call_id,
    readAt: row.read_at ? new Date(row.read_at) : null,
    createdAt: new Date(row.created_at),
  };
  return new Notification(props);
}

export async function createNotification(input: {
  recipientKind: NotificationRecipientKind;
  recipientId?: string | null;
  type: string;
  title: string;
  body: string;
  relatedCallId?: string | null;
}): Promise<Notification> {
  new Notification({
    id: '00000000-0000-0000-0000-000000000000',
    recipientKind: input.recipientKind,
    recipientId: input.recipientId ?? null,
    type: input.type,
    title: input.title,
    body: input.body,
    relatedCallId: input.relatedCallId ?? null,
    readAt: null,
    createdAt: new Date(),
  });

  const { rows } = await query<NotificationRow>(
    `INSERT INTO notification (recipient_kind, recipient_id, type, title, body, related_call_id)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [input.recipientKind, input.recipientId ?? null, input.type, input.title, input.body, input.relatedCallId ?? null]
  );
  return toEntity(rows[0]);
}

export async function listNotifications(recipientKind: NotificationRecipientKind, recipientId: string | null, limit = 50): Promise<Notification[]> {
  const { rows } = recipientKind === 'admin'
    ? await query<NotificationRow>(
        `SELECT * FROM notification WHERE recipient_kind = 'admin' ORDER BY created_at DESC LIMIT $1`,
        [limit]
      )
    : await query<NotificationRow>(
        `SELECT * FROM notification WHERE recipient_kind = 'business_customer' AND recipient_id = $1 ORDER BY created_at DESC LIMIT $2`,
        [recipientId, limit]
      );
  return rows.map(toEntity);
}

export async function countUnreadNotifications(recipientKind: NotificationRecipientKind, recipientId: string | null): Promise<number> {
  const { rows } = recipientKind === 'admin'
    ? await query<{ count: string }>(
        `SELECT COUNT(*)::text AS count FROM notification WHERE recipient_kind = 'admin' AND read_at IS NULL`
      )
    : await query<{ count: string }>(
        `SELECT COUNT(*)::text AS count FROM notification WHERE recipient_kind = 'business_customer' AND recipient_id = $1 AND read_at IS NULL`,
        [recipientId]
      );
  return Number(rows[0]?.count ?? 0);
}

export async function markNotificationRead(id: string): Promise<Notification | null> {
  const { rows } = await query<NotificationRow>(
    `UPDATE notification SET read_at = now() WHERE id = $1 AND read_at IS NULL RETURNING *`,
    [id]
  );
  return rows[0] ? toEntity(rows[0]) : null;
}

/** Scoped variant for business-customer routes -- a business can only ever
 * mark its OWN notifications read, never another tenant's by guessing an id. */
export async function markNotificationReadForCustomer(id: string, customerId: string): Promise<Notification | null> {
  const { rows } = await query<NotificationRow>(
    `UPDATE notification SET read_at = now()
     WHERE id = $1 AND recipient_kind = 'business_customer' AND recipient_id = $2 AND read_at IS NULL
     RETURNING *`,
    [id, customerId]
  );
  return rows[0] ? toEntity(rows[0]) : null;
}

/** Throttle guard for recurring alerts (e.g. monthly cost-cap breach) --
 * avoids firing the same notification on every single call once a
 * threshold is crossed. */
export async function hasNotificationThisMonth(recipientKind: NotificationRecipientKind, recipientId: string | null, type: string): Promise<boolean> {
  const { rows } = await query<{ exists: boolean }>(
    `SELECT EXISTS(
       SELECT 1 FROM notification
       WHERE recipient_kind = $1 AND recipient_id IS NOT DISTINCT FROM $2 AND type = $3
         AND date_trunc('month', created_at) = date_trunc('month', now())
     ) AS exists`,
    [recipientKind, recipientId, type]
  );
  return rows[0]?.exists ?? false;
}

export async function markAllNotificationsRead(recipientKind: NotificationRecipientKind, recipientId: string | null): Promise<number> {
  const { rows } = recipientKind === 'admin'
    ? await query(`UPDATE notification SET read_at = now() WHERE recipient_kind = 'admin' AND read_at IS NULL RETURNING id`)
    : await query(`UPDATE notification SET read_at = now() WHERE recipient_kind = 'business_customer' AND recipient_id = $1 AND read_at IS NULL RETURNING id`, [recipientId]);
  return rows.length;
}
