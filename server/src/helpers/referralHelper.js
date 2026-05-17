import { query } from '../config/db.js';

/**
 * Calculates the individual referral status of a referred user.
 * 
 * Statuses:
 * - 'disqualified': If user is suspended/inactive or only has 'GOLDEN_BASKET' subscriptions.
 * - 'active' / 'qualified': If user has a standard active savings plan (CREST, SILVER, ISUSU) with positive contributions.
 * - 'pending': If user has savings plans but total contributions are 0.
 * - 'inactive': If user has 0 savings plans started.
 */
export const calculateDownlineStatus = (user, plans) => {
  if (user.status && user.status.toLowerCase() !== 'active') {
    return 'disqualified';
  }

  // Filter plans
  const totalPlansCount = plans.length;
  const goldenBasketPlans = plans.filter(p => p.plan_name === 'GOLDEN_BASKET');
  const standardPlans = plans.filter(p => p.plan_name !== 'GOLDEN_BASKET');

  if (totalPlansCount === 0) {
    return 'inactive';
  }

  // If they ONLY have Golden Basket subscriptions, they are marked as disqualified from referral bonuses
  if (goldenBasketPlans.length > 0 && standardPlans.length === 0) {
    return 'disqualified';
  }

  // Check contributions in standard plans
  const totalStandardPaid = standardPlans.reduce((sum, p) => sum + parseFloat(p.current_amount || p.total_paid || 0), 0);
  if (totalStandardPaid > 0) {
    return 'qualified';
  }

  return 'pending';
};

/**
 * Retrieves all referred downlines of a user with full details and calculated status.
 */
export const getReferredDownlines = async (userId) => {
  const sql = `
    SELECT id, first_name, last_name, email, phone, status, created_at, referral_code, referral_unlock_date
    FROM users
    WHERE referred_by = $1
    ORDER BY created_at DESC
  `;
  const { rows: downlines } = await query(sql, [userId]);

  const detailedDownlines = [];
  for (const downline of downlines) {
    // Fetch all savings plans for this downline
    const { rows: plans } = await query(
      `SELECT plan_name, status, target_amount, current_amount, number_of_accounts, created_at 
       FROM savings_plans 
       WHERE user_id = $1`,
      [downline.id]
    );

    const status = calculateDownlineStatus(downline, plans);

    detailedDownlines.push({
      id: downline.id,
      firstName: downline.first_name,
      lastName: downline.last_name,
      email: downline.email,
      phone: downline.phone,
      status: downline.status,
      createdAt: downline.created_at,
      referralCode: downline.referral_code,
      referralUnlockDate: downline.referral_unlock_date,
      plans: plans.map(p => ({
        planName: p.plan_name,
        status: p.status,
        targetAmount: p.target_amount,
        currentAmount: p.current_amount,
        numberOfAccounts: p.number_of_accounts,
        createdAt: p.created_at
      })),
      referralStatus: status // locked, inactive, pending, active, qualified, disqualified
    });
  }

  return detailedDownlines;
};

/**
 * Returns the count of active qualified referrals for a user.
 */
export const getActiveQualifiedCount = async (userId) => {
  const downlines = await getReferredDownlines(userId);
  return downlines.filter(d => d.referralStatus === 'qualified').length;
};

/**
 * Validates payout multiplier eligibility for a user.
 * Must have at least 2 active qualified referrals.
 */
export const isReferrerEligibleForMultiplier = async (userId) => {
  const activeCount = await getActiveQualifiedCount(userId);
  return activeCount >= 2;
};
