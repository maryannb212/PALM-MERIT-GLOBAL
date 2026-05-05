import { query } from '../config/db.js';

/**
 * Log a webhook event to the webhook_logs table.
 *
 * @param {object} opts
 * @param {'paystack'|'flutterwave'} opts.source     - Gateway name
 * @param {string|null}              opts.reference  - Transaction reference (if available)
 * @param {string|null}              opts.eventType  - e.g. 'charge.success'
 * @param {object|null}              opts.payload    - Full raw body
 * @param {boolean}                  opts.signatureOk - Whether HMAC verified
 * @param {'received'|'processed'|'duplicate'|'rejected'|'error'} opts.status
 * @param {string|null}              opts.note       - Human-readable note
 * @returns {Promise<object>}        Inserted log row
 */
export const logWebhookEvent = async ({
  source = 'paystack',
  reference = null,
  eventType = null,
  payload = null,
  signatureOk = false,
  status = 'received',
  note = null,
}) => {
  try {
    const sql = `
      INSERT INTO webhook_logs
        (source, reference, event_type, payload, signature_ok, status, note)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *;
    `;
    const { rows } = await query(sql, [
      source,
      reference,
      eventType,
      payload ? JSON.stringify(payload) : null,
      signatureOk,
      status,
      note,
    ]);
    return rows[0];
  } catch (err) {
    // Logging must NEVER crash the main flow
    console.error('[WebhookLogger] Failed to write log entry:', err.message);
    return null;
  }
};
