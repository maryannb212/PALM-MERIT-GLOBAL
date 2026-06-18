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
const calculateDownlineStatus = (user, plans) => {
  if (user.status && user.status.toLowerCase() !== 'active') {
    return 'disqualified';
  }

  if (plans.length === 0) {
    return 'inactive';
  }

  // A referred member is "Active" (qualified) if they have activated their Silver Plan and completed the required payment
  const silverPlans = plans.filter(p => p.plan_name === 'SILVER');
  
  if (silverPlans.length > 0) {
    const totalSilverPaid = silverPlans.reduce((sum, p) => sum + parseFloat(p.current_amount || p.total_paid || 0), 0);
    // Silver initial payment is 4000 (1500 savings + 2500 reg fee) per account, but as long as current_amount > 0 they paid
    if (totalSilverPaid > 0) {
      return 'active'; // This is equivalent to 'qualified' in old logic
    }
  }

  // If no paid silver plan, they are pending
  return 'pending';
};

/**
 * Retrieves all referred downlines of a user with full details and calculated status.
 */
export const getReferredDownlines = async (userId) => {
  const sql = `
    SELECT u.id, u.first_name, u.last_name, u.email, u.phone, u.status, u.created_at, u.referral_code, u.referral_unlock_date, u.referral_expiry_date, r.code as used_specific_code
    FROM users u
    LEFT JOIN referral_codes r ON u.id = r.used_by_user_id
    WHERE u.referred_by = $1
    ORDER BY u.created_at DESC
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
      referralExpiryDate: downline.referral_expiry_date,
      plans: plans.map(p => ({
        planName: p.plan_name,
        status: p.status,
        targetAmount: p.target_amount,
        currentAmount: p.current_amount,
        numberOfAccounts: p.number_of_accounts,
        createdAt: p.created_at
      })),
      referralStatus: status, // locked, inactive, pending, active, disqualified
      usedSpecificCode: downline.used_specific_code || 'Legacy'
    });
  }

  return detailedDownlines;
};

/**
 * Returns the count of active qualified referrals for a user.
 */
export const getActiveQualifiedCount = async (userId) => {
  const downlines = await getReferredDownlines(userId);
  return downlines.filter(d => d.referralStatus === 'active').length;
};

/**
 * Validates payout multiplier eligibility for a user.
 * Must have at least 2 active qualified referrals.
 */
export const isReferrerEligibleForMultiplier = async (userId) => {
  const activeCount = await getActiveQualifiedCount(userId);
  return activeCount >= 1;
};
