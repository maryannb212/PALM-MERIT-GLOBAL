## Goal
- Fix referral code processing on live server deployment and fix default/penalty system bugs causing incorrect customer defaults.
- Replace automatic default creation with smart wallet allocation: pay contribution first, sweep remaining to settle defaults.

## Constraints & Preferences
- Cron jobs create a default when wallet can't cover even one full account's contribution.
- Cron jobs NEVER clear defaults — only admin can do that from user management dashboard.
- When wallet has enough for ≥1 account: pay for those full accounts, no default created.
- When wallet can't cover even 1 account: create a default for the full contribution amount (penalty = perAccountAmount × numAccounts).
- All amounts must be whole numbers (`Math.floor()`).
- All timezone handling must use Africa/Lagos (WAT) consistently across deduction and penalty jobs.
- Live server referral code issue is confirmed to be a deployment/code version problem, not a database problem.

## Progress
### Done
- Diagnostics created: connected to and tested Neon DB schema — all migrations applied, `referral_codes` table exists, all referral columns on `users` exist.
- Tested full `subscribeToPlan` referral flow (SELECT lookup, transaction updates, referred_by set, code marked used) against Neon directly — works 100% correctly.
- Confirmed issue is on live server itself (likely older code deployed).
- Cleaned up all diagnostic scripts and test user data from Neon.
- Removed `seed_users.js` and `list_users.js` helper scripts.
- Listed all 124 local DB users (latest 10 shown).
- Analyzed `deductionJob.js` (runs daily 6PM WAT) and `penaltyJob.js` (runs midnight UTC) for default/penalty bugs.
- Fixed `penaltyJob.js` (`server/src/jobs/penaltyJob.js`):
  - Changed `created_at >= CURRENT_DATE` and `missed_date = CURRENT_DATE` to use Africa/Lagos timezone.
  - Scaled penaltyAmount by `(plan.number_of_accounts || 1)`.
  - Added `BEGIN/COMMIT/ROLLBACK` transaction around balance check/deduction/default.
  - Added `FOR UPDATE` on user balance read.
  - Added penalty transactions to `lastTx` query (`type IN ('savings', 'penalty')`).
  - Added `todayDefault` check to skip plans already defaulted today.
- Fixed `deductionJob.js` (`server/src/jobs/deductionJob.js`):
  - Added penalty transactions to `existingTransactions` query (`type IN ('savings', 'penalty')`).
  - Added `todayDefault` check to skip plans already defaulted today.
  - Changed `missed_date` from `CURRENT_DATE` to WAT-aware date string.
  - Added `watDateStr` variable for WAT date.
- **Rewrote deduction logic in both jobs** to implement smart wallet allocation:
  - If wallet can cover full payment: pay contribution, then sweep remaining wallet to settle oldest defaults (full or partial).
  - If wallet can cover some accounts but not all: pay for as many full accounts as possible, then sweep leftover to defaults.
  - If wallet can't cover even one account AND defaults exist: use entire wallet to settle defaults (no new default created).
  - If wallet can't cover even one account AND no defaults: leave money alone, mark day as processed (no default).
  - All amounts floored to integers via `Math.floor()`.
  - Per-account granularity: `payableAccounts = Math.floor(balance / perAccountAmount)`, pays for those accounts, leftover goes to defaults.
  - Used `penalty_settlement` transactions + wallet ledger entries for settlement tracking.
  - Added `SKIP-` marker penalty transactions (amount=0) to prevent infinite isDue on skipped days.

### In Progress
- (none)

### Blocked
- (none)

## Key Decisions
- Referral code issue on live is a deployment/code version mismatch — database and local code are both fine.
- Cron jobs no longer create defaults. Defaults are only created from older code or admin actions.
- `missed_date` in defaults table should consistently be Africa/Lagos date to match deduction job's 6PM WAT schedule.
- `createWalletLedgerEntry` added as import to `penaltyJob.js` for settlement ledger entries.
- `available_balance` only is read (no longer reads `wallet_balance`) from users table in deduction job since `wallet_balance` is derived.

## Next Steps
- Deploy the updated `penaltyJob.js` and `deductionJob.js` to the live server.
- Verify live server has latest code for referral code processing.

## Critical Context
- `deductionJob.js` runs at 6PM WAT (`0 18 * * *` with `{ timezone: 'Africa/Lagos' }`).
- `penaltyJob.js` runs at midnight UTC (`0 0 * * *`) which is 1AM WAT — after deduction job.
- `expectedInstallment` in both jobs already scaled by `number_of_accounts`.
- `generateUniqueReferralCode()` in `savingsController.js` uses pool-level `query()` instead of transaction `client.query()` — potential race condition but not causing current issues.
- Settlement uses same pattern as `settleOutstandingPenalties` in `transactionModel.js` but done inline in job files (debits wallet directly instead of intercepting incoming payments).
- Marker transactions (`type='penalty', amount=0`) are inserted for "skipped" days to prevent the isDue check from firing again the next day.

## Relevant Files
- `server/src/jobs/deductionJob.js`: Main deduction cron (6PM WAT) — smart wallet allocation flow.
- `server/src/jobs/penaltyJob.js`: Backup penalty check cron (midnight UTC) — same smart allocation.
- `server/src/models/transactionModel.js`: Contains `settleOutstandingPenalties()` for deposit-time settlement + `createWalletLedgerEntry()` for ledger entries.
- `server/src/controllers/savingsController.js`: `subscribeToPlan` — referral code processing (confirmed working on Neon).
- `server/src/middleware/authMiddleware.js`: `protect`, `checkMembership` — gate the subscription endpoint.
- `server/src/config/db.js`: DB connection pool, `getClient()` with monkey-patched query tracking.
- `server/.env`: Local DB via `DB_*` fields; `DATABASE_URL` (Neon) is commented out.
