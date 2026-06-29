## Goal
- Fix referral code processing on live server deployment and fix default/penalty system bugs causing incorrect customer defaults.
- Deduction job pays contributions from wallet when possible; creates defaults when wallet can't cover even one account.
- Defaults are settled exclusively via Lotus Bank payments — wallet balance is NEVER used to settle defaults.

## Constraints & Preferences
- Cron jobs create a default when wallet can't cover even one full account's contribution.
- Cron jobs NEVER clear defaults — only via Lotus Bank payment or admin from user management dashboard.
- When wallet has enough for ≥1 account: pay for those full accounts, no default created.
- When wallet can't cover even 1 account: create a default for the full contribution amount (penalty = perAccountAmount × numAccounts).
- All amounts must be whole numbers (`Math.floor()`).
- All timezone handling must use Africa/Lagos (WAT) consistently across deduction job.
- Live server referral code issue is confirmed to be a deployment/code version problem, not a database problem.

## Progress
### Done
- Diagnostics created: connected to and tested Neon DB schema — all migrations applied, `referral_codes` table exists, all referral columns on `users` exist.
- Tested full `subscribeToPlan` referral flow (SELECT lookup, transaction updates, referred_by set, code marked used) against Neon directly — works 100% correctly.
- Confirmed issue is on live server itself (likely older code deployed).
- Cleaned up all diagnostic scripts and test user data from Neon.
- Removed `seed_users.js` and `list_users.js` helper scripts.
- Listed all 124 local DB users (latest 10 shown).
- Analyzed `deductionJob.js` (runs daily 6PM WAT) for default/penalty bugs.
- Fixed `deductionJob.js` (`server/src/jobs/deductionJob.js`):
  - Added penalty transactions to `existingTransactions` query (`type IN ('savings', 'penalty')`).
  - Added `todayDefault` check to skip plans already defaulted today.
  - Changed `missed_date` from `CURRENT_DATE` to WAT-aware date string.
  - Added `watDateStr` variable for WAT date.
  - Per-account granularity: `payableAccounts = Math.floor(balance / perAccountAmount)`.
  - Added `SKIP-` marker penalty transactions (amount=0) to prevent infinite isDue on skipped days.
  - **Removed incorrect sweep block** that used wallet balance to settle defaults — defaults are only settled via Lotus Bank payments.
- Fixed `settleOutstandingPenalties` in `transactionModel.js`:
  - Added `FOR UPDATE` lock on defaults query to prevent race conditions on concurrent payments.
- Verified the full Lotus Bank → default settlement flow:
  - Frontend (`Defaults.jsx`) sends `type: 'deposit'` with total default amount.
  - `initializeTransaction` creates pending `deposit` transaction (no plan_id), initializes Lotus checkout.
  - `lotusWebhook` → `handleLotusCheckout` → `processCompletedPayment` → `settleOutstandingPenalties` intercepts payment, settles oldest defaults first (full or partial), remainder credited to wallet.
  - `verifyTransaction` also calls `processCompletedPayment` idempotently (duplicate-safe).

### In Progress
- (none)

### Blocked
- (none)

## Key Decisions
- Referral code issue on live is a deployment/code version mismatch — database and local code are both fine.
- **Wallet balance is NEVER used to settle defaults.** Defaults are cleared only when user pays via Lotus Bank (user defaults page) or admin action.
- Deduction job only: (a) pays contributions if wallet can afford ≥1 account, (b) creates a default if can't cover even 1 account.
- `missed_date` in defaults table should consistently be Africa/Lagos date to match deduction job's 6PM WAT schedule.
- `available_balance` only is read (no longer reads `wallet_balance`) from users table in deduction job since `wallet_balance` is derived.
- `settleOutstandingPenalties` supports both full and partial default settlement from incoming deposits.

## Next Steps
- Deploy the updated `deductionJob.js` to the live server.
- Verify live server has latest code for referral code processing.

## Critical Context
- `deductionJob.js` runs at 6PM WAT (`0 18 * * *` with `{ timezone: 'Africa/Lagos' }`).
- `expectedInstallment` is already scaled by `number_of_accounts`.
- `generateUniqueReferralCode()` in `savingsController.js` uses pool-level `query()` instead of transaction `client.query()` — potential race condition but not causing current issues.
- Marker transactions (`type='penalty', amount=0`) are inserted for "skipped" days to prevent the isDue check from firing again the next day.
- Default settlement flow: Lotus Bank payment → `lotusWebhook` → `processCompletedPayment` → `settleOutstandingPenalties` — intercepts incoming `deposit`/`wallet_topup`/`contribution`, settles oldest defaults first, remainder goes to wallet.
- `settleOutstandingPenalties` uses `FOR UPDATE` on defaults rows to prevent double-settlement from concurrent payments.
- `penaltyJob.js` was never created on disk; only `deductionJob.js` handles deduction/default logic.

## Relevant Files
- `server/src/jobs/deductionJob.js`: Main deduction cron (6PM WAT) — per-account granularity, no sweep logic.
- `server/src/models/transactionModel.js`: Contains `settleOutstandingPenalties()` (with `FOR UPDATE`) for deposit-time settlement + `createWalletLedgerEntry()` for ledger entries.
- `server/src/controllers/transactionController.js`: `lotusWebhook`, `handleLotusCheckout`, `handleLotusVADeposit`, `initializeTransaction` — the full Lotus payment pipeline.
- `client/src/pages/dashboard/Defaults.jsx`: Frontend UI for paying defaults via Lotus.
- `server/src/controllers/savingsController.js`: `subscribeToPlan` — referral code processing (confirmed working on Neon).
- `server/src/middleware/authMiddleware.js`: `protect`, `checkMembership` — gate the subscription endpoint.
- `server/src/config/db.js`: DB connection pool, `getClient()` with monkey-patched query tracking.
- `server/.env`: Local DB via `DB_*` fields; `DATABASE_URL` (Neon) is commented out.
