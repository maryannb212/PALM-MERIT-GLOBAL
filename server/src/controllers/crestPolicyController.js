import { getCrestEligibility } from '../services/crestPolicyService.js';

export const getMyCrestEligibility = async (req, res) => {
  try {
    const { rows } = await req.app.locals.dbQuery(
      `SELECT id FROM savings_plans WHERE id = $1 AND user_id = $2`,
      [req.query.planId, req.user.id]
    );
    if (!rows[0]) return res.status(404).json({ message: 'Crest plan not found.' });

    const result = await getCrestEligibility(rows[0].id);
    res.json(result);
  } catch (error) {
    console.error('Error loading Crest eligibility:', error);
    res.status(500).json({ message: 'Unable to load Crest settlement eligibility.' });
  }
};

export const acceptTerms = async (req, res) => {
  try {
    const { acceptanceType, termsVersion = '1.0' } = req.body;
    if (!['REGISTRATION', 'FUNDING'].includes(acceptanceType)) {
      return res.status(400).json({ message: 'A valid terms acceptance type is required.' });
    }
    // Some production databases pre-date the unique terms index. Use a portable
    // update-or-insert statement instead of ON CONFLICT inference.
    const sql = `WITH updated AS (
       UPDATE terms_acceptances
       SET accepted = TRUE, accepted_at = CURRENT_TIMESTAMP, ip_address = $4, user_agent = $5
       WHERE user_id = $1 AND terms_version = $2 AND acceptance_type = $3
       RETURNING id
     )
     INSERT INTO terms_acceptances
       (user_id, terms_version, acceptance_type, accepted, accepted_at, ip_address, user_agent)
     SELECT $1, $2, $3, TRUE, CURRENT_TIMESTAMP, $4, $5
     WHERE NOT EXISTS (SELECT 1 FROM updated)`;
    const params = [req.user.id, termsVersion, acceptanceType, req.ip || null, req.get('user-agent') || null];
    // Neon pooler connections can occasionally close while being acquired. This
    // upsert is idempotent, so one short retry is safe and avoids a false 500.
    let lastError;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        await req.app.locals.dbQuery(sql, params);
        lastError = null;
        break;
      } catch (error) {
        lastError = error;
        if (!/connection terminated|ECONNRESET|timeout|ECONNREFUSED/i.test(error.message || '') || attempt === 2) break;
        await new Promise(resolve => setTimeout(resolve, 500 * (attempt + 1)));
      }
    }
    if (lastError) throw lastError;
    res.json({ message: 'Terms acceptance recorded.', termsVersion, acceptanceType });
  } catch (error) {
    console.error('Error recording terms acceptance:', error);
    const unavailable = /connection terminated|ECONNRESET|timeout|ECONNREFUSED/i.test(error.message || '');
    res.status(unavailable ? 503 : 500).json({
      message: unavailable
        ? 'Palm Merit could not reach the database. Please try again in a moment.'
        : 'Unable to record terms acceptance.'
    });
  }
};
