import cron from 'node-cron';
import pool from '../config/db.js';
import logger from '../utils/logger.js';

const PLAN_CYCLES = {
  CREST: { cycleDays: 90, clearanceRequired: true, clearanceDaysAfterReview: 3 },
  SILVER: { cycleDays: 350, clearanceRequired: true, clearanceDaysAfterReview: 3 },
  GOLDEN_BASKET: { cycleDays: 350, clearanceRequired: false, clearanceDaysAfterReview: 0 },
  ISUSU: { cycleDays: 30, clearanceRequired: false, clearanceDaysAfterReview: 0 },
};

const BATCH_SIZE = 500;

const getCycleDates = (startDate, planName) => {
  const msPerDay = 24 * 60 * 60 * 1000;
  const config = PLAN_CYCLES[planName] || { cycleDays: 90, clearanceRequired: false, clearanceDaysAfterReview: 0 };
  const startDateInLagos = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Lagos', year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(new Date(startDate));
  const cycleStart = new Date(`${startDateInLagos}T00:00:00+01:00`);
  const cycleEndDate = new Date(cycleStart.getTime() + (config.cycleDays * msPerDay));
  const clearanceDate = new Date(cycleStart.getTime() + ((config.cycleDays + config.clearanceDaysAfterReview) * msPerDay));
  return { cycleEndDate, clearanceDate, config };
};

const getAdminUserIds = async (client) => {
  const { rows } = await client.query(`SELECT id FROM users WHERE role = 'admin'`);
  return rows.map(r => r.id);
};

const buildAdminNotification = (plan, cycleEndLabel, clearanceDateLabel, config, action) => {
  const userName = `${plan.first_name} ${plan.last_name}`;
  const planName = plan.plan_name;
  const accounts = plan.number_of_accounts || 1;
  const targetAmount = parseFloat(plan.target_amount || 0).toLocaleString();
  
  if (action === 'eligibility_review') {
    return {
      title: `Plan Ready for Eligibility Review: ${planName}`,
      message: `${userName}'s ${planName} plan (${accounts} account${accounts > 1 ? 's' : ''}, ₦${targetAmount} target) has completed its savings cycle on ${cycleEndLabel} and is now in eligibility review. Admin approval required for payout.`,
      type: 'admin_approval'
    };
  }
  
  if (action === 'pending_clearance') {
    return {
      title: `Clearance Started: ${planName}`,
      message: `${userName}'s ${planName} plan has entered the clearance phase. User can now pay ₦3,000 per account. Admin payout approval will be required after clearance completes.`,
      type: 'admin_approval'
    };
  }
  
  return null;
};

const hasCompletedContributions = (plan) => {
  const targetAmount = parseFloat(plan.target_amount || 0);
  return targetAmount > 0 && parseFloat(plan.current_amount || 0) >= targetAmount;
};

const buildNotificationMessage = (plan, cycleEndLabel, clearanceDateLabel, config) => {
  const title = `Congratulations: ${plan.plan_name} savings cycle complete`;
  const msg = config.clearanceRequired
    ? `Congratulations! You have completed your ${plan.plan_name} savings cycle. Your cycle ends today (${cycleEndLabel}). Your clearance will be available in ${config.clearanceDaysAfterReview} days (on ${clearanceDateLabel}). You can then pay ₦3,000 per account under Dashboard > Clearance. Admin payout approval happens after your clearance is complete.`
    : `Congratulations! You have completed your ${plan.plan_name} savings cycle and your cycle ended on ${cycleEndLabel}. Your plan is now ready for admin payout review.`;
  return { title, message: msg };
};

const buildClearanceMessage = (plan) => ({
  title: `${plan.plan_name} clearance is now available`,
  message: `Your clearance period has started. Pay ₦3,000 per account under Dashboard > Clearance. After all accounts are cleared, your plan will be ready for admin payout approval.`
});

async function processBatch(client, batch, now, summary) {
  const plansToReview = [];
  const plansToClearance = [];
  const notificationsToSend = [];
  const clearanceNotificationsToSend = [];
  const adminNotificationsToSend = [];

  const adminUserIds = await getAdminUserIds(client);

  for (const plan of batch) {
    const contributionDate = new Date(plan.first_contribution);
    const { cycleEndDate, clearanceDate, config } = getCycleDates(contributionDate, plan.plan_name);
    const contributionsComplete = hasCompletedContributions(plan);

    if (now < cycleEndDate) continue;

    summary.matured += 1;

    const cycleEndLabel = cycleEndDate.toLocaleDateString('en-NG', {
      timeZone: 'Africa/Lagos', day: 'numeric', month: 'long', year: 'numeric'
    });
    const clearanceDateLabel = clearanceDate.toLocaleDateString('en-NG', {
      timeZone: 'Africa/Lagos', day: 'numeric', month: 'long', year: 'numeric'
    });

    if (!contributionsComplete) {
      summary.skippedIncomplete += 1;
    }

    if (plan.status !== 'eligibility_review' && now < clearanceDate) {
      plansToReview.push({
        id: plan.id,
        cycleEndDate,
        maturityDate: cycleEndDate,
        plan
      });
    } else if (plan.status !== 'eligibility_review' && now >= clearanceDate) {
      plansToClearance.push({
        id: plan.id,
        cycleEndDate,
        clearanceRequired: config.clearanceRequired,
        plan
      });
    } else if (plan.status === 'eligibility_review' && now >= clearanceDate) {
      plansToClearance.push({
        id: plan.id,
        cycleEndDate,
        clearanceRequired: config.clearanceRequired,
        plan
      });
    }

    const { title, message } = buildNotificationMessage(plan, cycleEndLabel, clearanceDateLabel, config);
    notificationsToSend.push({
      user_id: plan.user_id,
      title,
      message,
      type: 'clearance'
    });

    if (config.clearanceRequired && now >= clearanceDate && plan.status !== 'pending_clearance') {
      const { title: cTitle, message: cMessage } = buildClearanceMessage(plan);
      clearanceNotificationsToSend.push({
        user_id: plan.user_id,
        title: cTitle,
        message: cMessage,
        type: 'clearance'
      });
    }
  }

  if (plansToReview.length > 0) {
    const ids = plansToReview.map(p => p.id);
    const maturityDates = plansToReview.map(p => p.cycleEndDate.toISOString());
    const caseClauses = plansToReview.map((p, i) => `WHEN id = '${p.id}' THEN $${i + 1}::timestamptz`).join(' ');
    const query = `
      UPDATE savings_plans
      SET status = 'eligibility_review',
          maturity_date = CASE ${caseClauses} END,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ANY($${plansToReview.length + 1})
    `;
    await client.query(query, [...maturityDates, ids]);
    logger.info(`Moved ${plansToReview.length} plans to eligibility_review`);

    for (const p of plansToReview) {
      for (const adminId of adminUserIds) {
        const adminNotif = buildAdminNotification(p.plan, 
          p.cycleEndDate.toLocaleDateString('en-NG', { timeZone: 'Africa/Lagos', day: 'numeric', month: 'long', year: 'numeric' }),
          new Date(p.cycleEndDate.getTime() + (p.plan.clearanceRequired ? 3 * 24 * 60 * 60 * 1000 : 0)).toLocaleDateString('en-NG', { timeZone: 'Africa/Lagos', day: 'numeric', month: 'long', year: 'numeric' }),
          PLAN_CYCLES[p.plan.plan_name] || { cycleDays: 90, clearanceRequired: false, clearanceDaysAfterReview: 0 },
          'eligibility_review'
        );
        if (adminNotif) {
          adminNotificationsToSend.push({ user_id: adminId, ...adminNotif });
        }
      }
    }
  }

  if (plansToClearance.length > 0) {
    const clearanceIds = plansToClearance.filter(p => p.clearanceRequired).map(p => p.id);
    const clearanceMaturityDates = plansToClearance.filter(p => p.clearanceRequired).map(p => p.cycleEndDate.toISOString());

    if (clearanceIds.length > 0) {
      const caseClauses = plansToClearance
        .filter(p => p.clearanceRequired)
        .map((p, i) => `WHEN id = '${p.id}' THEN $${i + 1}::timestamptz`).join(' ');
      const query = `
        UPDATE savings_plans
        SET status = 'pending_clearance',
            clearance_required = TRUE,
            maturity_date = CASE ${caseClauses} END,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ANY($${clearanceIds.length + 1})
      `;
      await client.query(query, [...clearanceMaturityDates, clearanceIds]);
      logger.info(`Moved ${clearanceIds.length} plans to pending_clearance`);

      for (const p of plansToClearance.filter(p => p.clearanceRequired)) {
        for (const adminId of adminUserIds) {
          const adminNotif = buildAdminNotification(p.plan,
            p.cycleEndDate.toLocaleDateString('en-NG', { timeZone: 'Africa/Lagos', day: 'numeric', month: 'long', year: 'numeric' }),
            new Date(p.cycleEndDate.getTime() + 3 * 24 * 60 * 60 * 1000).toLocaleDateString('en-NG', { timeZone: 'Africa/Lagos', day: 'numeric', month: 'long', year: 'numeric' }),
            PLAN_CYCLES[p.plan.plan_name] || { cycleDays: 90, clearanceRequired: true, clearanceDaysAfterReview: 3 },
            'pending_clearance'
          );
          if (adminNotif) {
            adminNotificationsToSend.push({ user_id: adminId, ...adminNotif });
          }
        }
      }
    }
  }

  const allNotifications = [...notificationsToSend, ...clearanceNotificationsToSend, ...adminNotificationsToSend];
  if (allNotifications.length > 0) {
    const placeholders = allNotifications.map((_, i) =>
      `($${i * 4 + 1}, $${i * 4 + 2}, $${i * 4 + 3}, $${i * 4 + 4})`
    ).join(', ');

    const values = allNotifications.flatMap(n => [n.user_id, n.title, n.message, n.type]);

    const query = `
      INSERT INTO notifications (user_id, title, message, type)
      VALUES ${placeholders}
    `;

    const result = await client.query(query, values);
    summary.notifications += result.rowCount || 0;
    logger.info(`Sent ${result.rowCount || 0} notifications in this batch (${adminNotificationsToSend.length} admin)`);
  }
}

export const runMaturityCheck = async () => {
  logger.info('Running maturity check job...');
  const summary = { checked: 0, matured: 0, skippedIncomplete: 0, notifications: 0 };
  const now = new Date();

  try {
    let lastId = null;
    let hasMore = true;
    let batchNum = 0;

    while (hasMore) {
      batchNum++;
      const client = await pool.connect();

      try {
        await client.query('BEGIN');

        let query = `
          SELECT sp.id, sp.user_id, sp.plan_name, sp.start_date, sp.current_amount, sp.target_amount,
                 sp.number_of_accounts, sp.clearance_required, sp.status,
                 COALESCE(MIN(t.created_at), sp.start_date) as first_contribution
          FROM savings_plans sp
          LEFT JOIN transactions t ON t.plan_id = sp.id AND t.type = 'savings'
          WHERE sp.status IN ('active', 'matured', 'eligibility_review')
        `;
        const params = [];

        if (lastId !== null) {
          query += ` AND sp.id > $${params.length + 1}`;
          params.push(lastId);
        }

        query += ` GROUP BY sp.id ORDER BY sp.id LIMIT $${params.length + 1}`;
        params.push(BATCH_SIZE);

        const { rows: batch } = await client.query(query, params);

        if (batch.length === 0) {
          hasMore = false;
          await client.query('COMMIT');
          break;
        }

        summary.checked += batch.length;
        lastId = batch[batch.length - 1].id;

        await processBatch(client, batch, now, summary);

        await client.query('COMMIT');
        logger.info(`Batch ${batchNum} completed. Processed ${batch.length} plans. Total checked: ${summary.checked}`);
      } catch (error) {
        await client.query('ROLLBACK');
        logger.error(`Error in batch ${batchNum}:`, error);
        throw error;
      } finally {
        client.release();
      }
    }

    logger.info('Maturity check job completed successfully.', summary);
    return { success: true, message: 'Maturity check completed', summary };
  } catch (error) {
    logger.error('Error running maturity check job:', error);
    throw error;
  }
};

export const startMaturityJob = () => {
  cron.schedule('0 0 * * *', async () => {
    try {
      await runMaturityCheck();
    } catch (error) {
      logger.error('Error in maturity cron execution:', error);
    }
  }, { timezone: 'Africa/Lagos' });
};