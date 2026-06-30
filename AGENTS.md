## Goal
- Fix referral code processing on live server deployment and fix default/penalty system bugs causing incorrect customer defaults.
- Deduction job pays contributions from wallet when possible; creates defaults when wallet can't cover even one account.
- Defaults are settled exclusively via Lotus Bank payments — wallet balance is NEVER used to settle defaults.
- Admin `/referrals` page downlines display — fixed self-referral noise (13 users had `referred_by` set to own ID).
- Build per-account clearance system (₦3,000/account) with user-facing and admin-facing clearance management.

## Constraints & Preferences
- Cron jobs create a default when wallet can't cover even one full account's contribution.
- Cron jobs NEVER clear defaults — only via Lotus Bank payment or admin from user management dashboard.
- When wallet has enough for ≥1 account: pay for those full accounts, no default created.
- When wallet can't cover even 1 account: create a default for the full contribution amount (penalty = perAccountAmount × numAccounts).
- All amounts must be whole numbers (`Math.floor()`).
- All timezone handling must use Africa/Lagos (WAT) consistently across deduction job.
- Live server referral code issue is confirmed to be a deployment/code version problem, not a database problem.
- Self-referrals (`referred_by = own id`) must be excluded from downline counts and display — ~13 self-referrals found in production data.
- Per-account clearance: each account in a plan costs ₦3,000 to clear; users can pay per-account or bulk per-plan.
- Clearance is tracked via `accounts_cleared` column on `savings_plans` (0 up to `number_of_accounts`).
- Plan transitions to `pending_settlement` only when `accounts_cleared >= number_of_accounts`.
- Wallet balance is used for clearance payments (deducted from available_balance), NOT Lotus Bank.

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
- **Fixed admin referrals downlines display** (`server/src/controllers/adminController.js`):
  - Diagnosed: 13 of 28 users with `referred_by` had self-referrals (own ID), polluting the admin page.
  - `getAdminReferralStats`: added `&& down.id !== u.id` to JS filter to exclude self-referrals from downlines.
  - `getAllUsers`: added `AND sub.id != u.id` to SQL downline count subquery.
  - After fix: 20→8 users shown with genuine downlines, 13 self-referral noise entries removed.
- **Re-enabled referral code capture at registration** (`client/src/pages/auth/RegisterPage.jsx`):
  - Diagnosed root cause: RegisterPage had stripped ALL referral tracking (no `useLocation`, no `?ref=` capture, no `referredByCode` sent to API). This meant every registration via a referral link produced 0 downlines for the referrer.
  - Re-added `useLocation` to read `?ref=` URL parameter on mount.
  - Added `referredByCode` to form state and passed it to `register()` API call.
  - No visible input field shown to users — the code is silently captured from the URL.

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
- Self-referrals (`referred_by = own id`) must be excluded from downline counts — these are data errors where users registered using their own referral code.
- Clearance payments use wallet `available_balance` (deducted directly), NOT Lotus — different from defaults which require Lotus.
- `accounts_cleared` is tracked incrementally per-account; `clearance_paid` only set `TRUE` on final account.
- Paying `payClearanceFee` without `accountIndex` charges ₦3,000 × all remaining accounts (bulk per-plan).

## Next Steps
- Deploy the updated `deductionJob.js` to the live server.
- Verify live server has latest code for referral code processing.
- Consider a data cleanup migration to NULL out self-referrals (13 rows: `UPDATE users SET referred_by = NULL WHERE id = referred_by`).
- After deploy, run migration: `ALTER TABLE savings_plans ADD COLUMN IF NOT EXISTS accounts_cleared INTEGER DEFAULT 0;`

## Critical Context
- `deductionJob.js` runs at 6PM WAT (`0 18 * * *` with `{ timezone: 'Africa/Lagos' }`).
- `expectedInstallment` is already scaled by `number_of_accounts`.
- `generateUniqueReferralCode()` in `savingsController.js` uses pool-level `query()` instead of transaction `client.query()` — potential race condition but not causing current issues.
- Marker transactions (`type='penalty', amount=0`) are inserted for "skipped" days to prevent the isDue check from firing again the next day.
- Default settlement flow: Lotus Bank payment → `lotusWebhook` → `processCompletedPayment` → `settleOutstandingPenalties` — intercepts incoming `deposit`/`wallet_topup`/`contribution`, settles oldest defaults first, remainder goes to wallet.
- `settleOutstandingPenalties` uses `FOR UPDATE` on defaults rows to prevent double-settlement from concurrent payments.
- `penaltyJob.js` was never created on disk; only `deductionJob.js` handles deduction/default logic.
- **Self-referral data issue**: 13 users in Neon have `referred_by` set to their own ID. Root cause: registration or `subscribeToPlan` allowed using one's own referral code. The `RegisterPage.jsx` no longer has the referral code field (removed), but existing data remains.

## Relevant Files
- `server/src/jobs/deductionJob.js`: Main deduction cron (6PM WAT) — per-account granularity, no sweep logic.
- `server/src/models/transactionModel.js`: Contains `settleOutstandingPenalties()` (with `FOR UPDATE`) for deposit-time settlement + `createWalletLedgerEntry()` for ledger entries.
- `server/src/controllers/transactionController.js`: `lotusWebhook`, `handleLotusCheckout`, `handleLotusVADeposit`, `initializeTransaction` — the full Lotus payment pipeline.
- `client/src/pages/dashboard/Defaults.jsx`: Frontend UI for paying defaults via Lotus.
- `server/src/controllers/savingsController.js`: `subscribeToPlan` (referral processing), `payClearanceFee` (per-account + bulk), `bulkClearance` (multi-plan bulk with accounts_cleared tracking).
- `client/src/pages/dashboard/Clearance.jsx`: User-facing clearance page — per-account Pay buttons, bulk per-plan Pay All, progress bar.
- `client/src/pages/admin/AdminClearance.jsx`: Admin clearance management — filter by status, Settle button for pending_settlement plans.
- `server/src/controllers/adminController.js`: `getAdminReferralStats`, `getAllUsers` (self-referral exclusion), `getClearancePlans`, `adminSettleClearance`, `approveEligibility` (clearance notification).
- `client/src/components/Sidebar.jsx`: Added "Clearance" link.
- `client/src/components/AdminSidebar.jsx`: Added "Clearance" link.
- `server/src/config/schema.sql`: Added `accounts_cleared INTEGER DEFAULT 0` column to `savings_plans`.
- `server/src/routes/savingsRoutes.js`: Clearance routes (`pay-clearance`, `bulk-clearance`).
- `server/src/routes/adminRoutes.js`: Clearance routes (`GET /clearance`, `POST /clearance/settle`).
- `server/src/middleware/authMiddleware.js`: `protect`, `checkMembership` — gate the subscription endpoint.
- `server/src/config/db.js`: DB connection pool, `getClient()` with monkey-patched query tracking.
- `server/.env`: Local DB via `DB_*` fields; `DATABASE_URL` (Neon) is commented out.
