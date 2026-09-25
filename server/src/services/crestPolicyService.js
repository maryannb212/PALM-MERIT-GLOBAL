import { query as poolQuery } from '../config/db.js';

export const CREST_POLICY = Object.freeze({
  planName: 'CREST',
  referralLinkDelayDays: 25,
  referralLinkValidityDays: 7,
  programmeDurationDays: 90,
  earliestSettlementDay: 92,
  latestSettlementDay: 98,
  requiredDirectWeeks: 10,
  requiredSecondLevelWeeks: 2,
  requiredCumulativeWeeks: 12
});

const addDays = (value, days) => {
  const date = new Date(value);
  date.setUTCDate(date.getUTCDate() + days);
  return date;
};

const startOfWeek = (value) => {
  const date = new Date(value);
  date.setUTCHours(0, 0, 0, 0);
  const day = date.getUTCDay();
  date.setUTCDate(date.getUTCDate() - day);
  return date;
};

const getPlanDates = (plan) => {
  const startDate = new Date(plan.start_date || plan.created_at);
  const completionDate = addDays(startDate, CREST_POLICY.programmeDurationDays);
  return {
    startDate,
    completionDate,
    earliestSettlementDate: addDays(startDate, CREST_POLICY.earliestSettlementDay),
    latestSettlementDate: addDays(startDate, CREST_POLICY.latestSettlementDay)
  };
};

const getWeeksForUser = async (client, userId) => {
  const { rows } = await client.query(
    `SELECT COUNT(DISTINCT DATE_TRUNC('week', t.created_at))::int AS weeks
     FROM transactions t
     JOIN savings_plans sp ON sp.id = t.plan_id
     WHERE t.user_id = $1
       AND sp.plan_name = 'CREST'
       AND t.type IN ('savings', 'contribution')
       AND t.status = 'completed'`,
    [userId]
  );
  return Number(rows[0]?.weeks || 0);
};

const getReferralCandidates = async (client, userId) => {
  const { rows: directRows } = await client.query(
    `SELECT DISTINCT u.id, u.first_name, u.last_name
     FROM referral_codes rc
     JOIN users u ON u.id = rc.used_by_user_id
     JOIN savings_plans sp ON sp.id = rc.plan_id
     WHERE rc.user_id = $1
       AND rc.status = 'used'
       AND sp.plan_name = 'CREST'
       AND rc.used_by_user_id IS NOT NULL
       AND rc.user_id <> rc.used_by_user_id`,
    [userId]
  );

  const directs = [];
  for (const direct of directRows) {
    directs.push({
      ...direct,
      weeks: await getWeeksForUser(client, direct.id)
    });
  }

  const qualifiedDirects = directs.filter((direct) => direct.weeks >= CREST_POLICY.requiredDirectWeeks);
  let secondLevel = null;

  for (const direct of qualifiedDirects) {
    const { rows: secondRows } = await client.query(
      `SELECT DISTINCT u.id, u.first_name, u.last_name
       FROM referral_codes rc
       JOIN users u ON u.id = rc.used_by_user_id
       JOIN savings_plans sp ON sp.id = rc.plan_id
       WHERE rc.user_id = $1
         AND rc.status = 'used'
         AND sp.plan_name = 'CREST'
         AND rc.used_by_user_id IS NOT NULL
         AND rc.user_id <> rc.used_by_user_id`,
      [direct.id]
    );

    for (const candidate of secondRows) {
      const weeks = await getWeeksForUser(client, candidate.id);
      if (!secondLevel || weeks > secondLevel.weeks) {
        secondLevel = { ...candidate, weeks, directId: direct.id };
      }
    }
  }

  const direct = qualifiedDirects.sort((left, right) => right.weeks - left.weeks)[0] || directs.sort((left, right) => right.weeks - left.weeks)[0] || null;
  return { directs, direct, secondLevel };
};

export const evaluateCrestEligibility = async (client, planId, evaluatedBy = null, options = {}) => {
  const { rows } = await client.query(
    `SELECT sp.*, u.kyc_status
     FROM savings_plans sp
     JOIN users u ON u.id = sp.user_id
     WHERE sp.id = $1
     FOR UPDATE`,
    [planId]
  );

  if (!rows[0]) {
    throw new Error('Crest plan not found');
  }

  const plan = rows[0];
  if (plan.plan_name !== CREST_POLICY.planName) {
    return {
      plan,
      isCrest: false,
      isEligible: true,
      reasons: [],
      dates: getPlanDates(plan),
      directWeeks: 0,
      secondLevelWeeks: 0,
      cumulativeWeeks: 0
    };
  }

  const dates = getPlanDates(plan);
  const { direct, secondLevel } = await getReferralCandidates(client, plan.user_id);
  const directWeeks = direct?.weeks || 0;
  const secondLevelWeeks = secondLevel?.weeks || 0;
  const cumulativeWeeks = directWeeks + secondLevelWeeks;
  const currentAmount = Number(plan.current_amount || 0);
  const targetAmount = Number(plan.target_amount || 0);
  const now = new Date();
  const programmeCompleted = now >= dates.completionDate && (currentAmount >= targetAmount || ['eligibility_review', 'pending_clearance', 'pending_settlement', 'settled'].includes(plan.status));
  const clearanceCompleted = Boolean(plan.clearance_paid) || plan.status === 'pending_settlement' || plan.status === 'settled';
  const reasons = [];

  if (!direct || directWeeks < CREST_POLICY.requiredDirectWeeks) {
    reasons.push(`At least one direct Crest referral needs ${CREST_POLICY.requiredDirectWeeks} completed contribution weeks.`);
  }
  if (!secondLevel || secondLevelWeeks < CREST_POLICY.requiredSecondLevelWeeks) {
    reasons.push(`A second-level Crest referral needs ${CREST_POLICY.requiredSecondLevelWeeks} active contribution weeks.`);
  }
  if (cumulativeWeeks < CREST_POLICY.requiredCumulativeWeeks) {
    reasons.push(`Qualifying first- and second-level contribution weeks must total ${CREST_POLICY.requiredCumulativeWeeks}.`);
  }
  if (now < dates.completionDate) reasons.push(`The Crest programme completes on ${dates.completionDate.toISOString()}.`);
  if (!programmeCompleted) reasons.push('The Crest programme has not completed its savings target.');
  // KYC verification restriction removed per policy update
  // if (plan.kyc_status !== 'verified') reasons.push('KYC verification is required before settlement.');
  if (!clearanceCompleted && options.ignoreClearance !== true) reasons.push('Clearance has not been completed.');
  if (options.ignoreSettlementWindow !== true) {
    if (now < dates.earliestSettlementDate) reasons.push(`Settlement opens on ${dates.earliestSettlementDate.toISOString()}.`);
    if (now > dates.latestSettlementDate) reasons.push(`The settlement window ended on ${dates.latestSettlementDate.toISOString()}.`);
  }

  const isEligible = reasons.length === 0;
  const result = {
    plan,
    isCrest: true,
    isEligible,
    status: plan.status === 'settled' ? 'SETTLED' : isEligible ? 'SETTLEMENT_WINDOW_OPEN' : programmeCompleted && clearanceCompleted ? 'CLEARED' : programmeCompleted ? 'QUALIFIED' : 'IN_PROGRESS',
    dates,
    directReferral: direct,
    secondLevelReferral: secondLevel,
    directWeeks,
    secondLevelWeeks,
    cumulativeWeeks,
    programmeCompleted,
    clearanceCompleted,
    reasons
  };

  if (!options.skipSnapshot) {
    await client.query(
      `INSERT INTO crest_eligibility_evaluations
       (plan_id, user_id, is_eligible, direct_referral_id, direct_weeks,
        second_level_referral_id, second_level_weeks, cumulative_weeks,
        programme_completed, clearance_completed, earliest_settlement_date,
        latest_settlement_date, reasons, evaluated_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
      [
        plan.id,
        plan.user_id,
        isEligible,
        direct?.id || null,
        directWeeks,
        secondLevel?.id || null,
        secondLevelWeeks,
        cumulativeWeeks,
        programmeCompleted,
        clearanceCompleted,
        dates.earliestSettlementDate,
        dates.latestSettlementDate,
        JSON.stringify(reasons),
        evaluatedBy
      ]
    );
  }

  return result;
};

export const assertCrestSettlementEligible = async (client, planId, actorId = null) => {
  const result = await evaluateCrestEligibility(client, planId, actorId);
  if (result.isCrest && !result.isEligible) {
    const error = new Error(`Crest settlement is not eligible: ${result.reasons.join(' ')}`);
    error.statusCode = 400;
    error.policy = result;
    throw error;
  }
  return result;
};

export const assertCrestClearanceEligible = async (client, planId, actorId = null) => {
  const result = await evaluateCrestEligibility(client, planId, actorId, {
    ignoreClearance: true,
    ignoreSettlementWindow: true
  });
  if (result.isCrest && !result.isEligible) {
    const error = new Error(`Crest clearance is not eligible: ${result.reasons.join(' ')}`);
    error.statusCode = 400;
    error.policy = result;
    throw error;
  }
  return result;
};

export const getCrestEligibility = async (planId) => {
  const client = { query: poolQuery };
  return evaluateCrestEligibility(client, planId, null, { skipSnapshot: true });
};

export const getCrestPolicyDates = (plan) => getPlanDates(plan);

export const getContributionWeekStart = (value) => startOfWeek(value);
