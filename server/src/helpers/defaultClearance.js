import { createWalletLedgerEntry } from '../models/transactionModel.js';

const PLAN_ACCOUNT_AMOUNTS = {
  CREST: 4000,
  SILVER: 1500,
  GOLDEN_BASKET: 2000,
  ISUSU: 500
};

const createReference = () => `CLRDFT-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

export const clearDefaultsWithWallet = async (client, userId, defaultId = null) => {
  const { rows: users } = await client.query(
    'SELECT id, available_balance FROM users WHERE id = $1 FOR UPDATE',
    [userId]
  );
  if (users.length === 0) return { ok: false, reason: 'user_not_found' };

  const params = defaultId ? [userId, defaultId] : [userId];
  const defaultFilter = defaultId ? 'AND d.id = $2' : '';
  const { rows: defaults } = await client.query(`
    SELECT d.id, d.plan_id, d.penalty_amount, d.missed_date,
           sp.plan_name, sp.number_of_accounts, sp.current_amount, sp.target_amount
    FROM defaults d
    JOIN savings_plans sp ON sp.id = d.plan_id
    WHERE d.user_id = $1 AND d.resolved = FALSE ${defaultFilter}
    ORDER BY d.missed_date ASC, d.id ASC
    FOR UPDATE OF d, sp
  `, params);

  if (defaults.length === 0) return { ok: false, reason: 'no_defaults' };

  const balance = Math.floor(Number(users[0].available_balance) || 0);
  let remainingBalance = balance;
  let totalDeducted = 0;
  let totalToSavings = 0;
  let resolvedDefaults = 0;
  const results = [];
  const remainingByPlan = new Map();

  for (const record of defaults) {
    const perAccountAmount = PLAN_ACCOUNT_AMOUNTS[record.plan_name];
    if (!perAccountAmount) continue;

    const penaltyAmount = Math.floor(Number(record.penalty_amount) || 0);
    if (defaultId) {
      if (penaltyAmount <= 0) continue;
      if (remainingBalance < penaltyAmount) {
        return {
          ok: false,
          reason: 'insufficient_balance',
          needed: penaltyAmount,
          balance
        };
      }

      const targetAmount = Number(record.target_amount) || 0;
      const currentAmount = Number(record.current_amount) || 0;
      const remainingToTarget = targetAmount > 0
        ? Math.max(0, Math.floor(targetAmount - currentAmount))
        : Infinity;
      const savingsPortion = Math.min(Math.floor(penaltyAmount / 2), remainingToTarget);
      const cost = penaltyAmount;

      if (savingsPortion > 0) {
        await client.query(
          'UPDATE savings_plans SET current_amount = COALESCE(current_amount, 0) + $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
          [savingsPortion, record.plan_id]
        );
      }
      await client.query(
        'UPDATE defaults SET resolved = TRUE, resolved_at = CURRENT_TIMESTAMP WHERE id = $1',
        [record.id]
      );

      remainingBalance -= cost;
      totalDeducted += cost;
      totalToSavings += savingsPortion;
      resolvedDefaults++;
      results.push({ defaultId: record.id, plan_name: record.plan_name, amountPaid: cost, savingsCredited: savingsPortion, fullyResolved: true });
      continue;
    }

    if (remainingBalance <= 0) break;
    const perAccountCost = perAccountAmount * 2;
    const accountsRemaining = Math.floor(penaltyAmount / perAccountCost);
    const accountsAffordable = Math.floor(remainingBalance / perAccountCost);
    const accountsToClear = Math.min(accountsAffordable, accountsRemaining);
    if (accountsToClear <= 0) continue;

    if (!remainingByPlan.has(record.plan_id)) {
      const targetAmount = Number(record.target_amount) || 0;
      const currentAmount = Number(record.current_amount) || 0;
      remainingByPlan.set(
        record.plan_id,
        targetAmount > 0 ? Math.max(0, Math.floor(targetAmount - currentAmount)) : Infinity
      );
    }

    const cost = accountsToClear * perAccountCost;
    const savingsPortion = Math.min(
      accountsToClear * perAccountAmount,
      remainingByPlan.get(record.plan_id)
    );
    remainingByPlan.set(record.plan_id, remainingByPlan.get(record.plan_id) - savingsPortion);

    if (savingsPortion > 0) {
      await client.query(
        'UPDATE savings_plans SET current_amount = COALESCE(current_amount, 0) + $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
        [savingsPortion, record.plan_id]
      );
    }

    const newPenaltyAmount = penaltyAmount - cost;
    if (newPenaltyAmount <= 0) {
      await client.query(
        'UPDATE defaults SET resolved = TRUE, resolved_at = CURRENT_TIMESTAMP WHERE id = $1',
        [record.id]
      );
      resolvedDefaults++;
    } else {
      await client.query('UPDATE defaults SET penalty_amount = $1 WHERE id = $2', [newPenaltyAmount, record.id]);
    }

    remainingBalance -= cost;
    totalDeducted += cost;
    totalToSavings += savingsPortion;
    results.push({
      defaultId: record.id,
      plan_name: record.plan_name,
      accountsCleared: accountsToClear,
      amountPaid: cost,
      savingsCredited: savingsPortion,
      fullyResolved: newPenaltyAmount <= 0
    });
  }

  if (totalDeducted <= 0) {
    return {
      ok: false,
      reason: defaultId ? 'invalid_default_amount' : 'insufficient_balance',
      needed: defaultId ? null : (PLAN_ACCOUNT_AMOUNTS[defaults[0]?.plan_name] || 1500) * 2,
      balance
    };
  }

  await client.query(
    'UPDATE users SET available_balance = available_balance - $1, wallet_balance = wallet_balance - $1 WHERE id = $2',
    [totalDeducted, userId]
  );

  const reference = createReference();
  const transactionPlanId = defaultId ? defaults[0].plan_id : null;
  await client.query(
    `INSERT INTO transactions (user_id, plan_id, type, amount, status, reference)
     VALUES ($1, $2, 'default_clearance', $3, 'completed', $4)`,
    [userId, transactionPlanId, totalDeducted, reference]
  );
  await createWalletLedgerEntry(
    client,
    userId,
    'debit',
    totalDeducted,
    reference,
    `Default clearance: ₦${totalToSavings.toLocaleString()} credited to savings and ₦${(totalDeducted - totalToSavings).toLocaleString()} settled as penalty`
  );

  return {
    ok: true,
    totalDeducted,
    totalToSavings,
    resolvedDefaults,
    results,
    newBalance: balance - totalDeducted
  };
};