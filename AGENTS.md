## Goal
- Fix referral code processing on live server deployment and fix default/penalty system bugs causing incorrect customer defaults.

## Constraints & Preferences
- Default should only trigger when user has no money in wallet on contribution day.
- Default penalty must be exactly twice the savings contribution amount.
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

### In Progress
- (none)

### Blocked
- (none)

## Key Decisions
- Referral code issue on live is a deployment/code version mismatch — database and local code are both fine.
- Default/penalty system bugs were in `penaltyJob.js` and `deductionJob.js` — both now fixed.
- `missed_date` in defaults table should consistently be Africa/Lagos date to match deduction job's 6PM WAT schedule.

## Next Steps
- Deploy the updated `penaltyJob.js` and `deductionJob.js` to the live server to fix the default/penalty system.
- Verify live server has latest code for referral code processing.

## Critical Context
- `deductionJob.js` runs at 6PM WAT (`0 18 * * *` with `{ timezone: 'Africa/Lagos' }`).
- `penaltyJob.js` runs at midnight UTC (`0 0 * * *`) which is 1AM WAT — after deduction job.
- `expectedInstallment` in both jobs already scaled by `number_of_accounts`; `penaltyAmount` in penalty job did NOT scale (fixed).
- `generateUniqueReferralCode()` in `savingsController.js` uses pool-level `query()` instead of transaction `client.query()` — potential race condition but not causing current issues.
- The root cause of duplicate defaults: `lastTx` queries only checked `type = 'savings' AND status = 'completed'` — default creates a `failed` savings + `completed` penalty, so `lastTx` always returned stale data, causing `isDue = true` every day.

## Relevant Files
- `server/src/jobs/deductionJob.js`: Main deduction cron (6PM WAT) — checks balance, deducts or records default.
- `server/src/jobs/penaltyJob.js`: Penalty check cron (midnight UTC) — catch-up deductions, creates defaults.
- `server/src/models/transactionModel.js`: Contains `settleOutstandingPenalties()`, ledger entries, wallet deductions.
- `server/src/controllers/savingsController.js`: `subscribeToPlan` — referral code processing (confirmed working on Neon).
- `server/src/middleware/authMiddleware.js`: `protect`, `checkMembership` — gate the subscription endpoint.
- `server/src/config/db.js`: DB connection pool, `getClient()` with monkey-patched query tracking.
- `server/.env`: Local DB via `DB_*` fields; `DATABASE_URL` (Neon) is commented out.
