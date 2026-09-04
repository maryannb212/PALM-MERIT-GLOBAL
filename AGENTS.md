## Goal
- Fix referral code processing on live server deployment and fix default/penalty system bugs causing incorrect customer defaults.
- Deduction job pays contributions from wallet when possible; creates defaults when wallet can't cover even one account.
- **Defaults are DOUBLED** (2x per account: missed contribution + equal penalty) and cleared via **wallet balance** on the defaults page.
- Admin `/referrals` page downlines display — fixed self-referral noise (13 users had `referred_by` set to own ID).
- Build per-account clearance system (₦3,000/account) with user-facing and admin-facing clearance management.

## Constraints & Preferences
- Cron jobs create a default when wallet can't cover even one full account's contribution.
- Cron jobs NEVER clear defaults — only via wallet clearance button or admin from user management dashboard.
- When wallet has enough for ≥1 account: pay for those full accounts, no default created.
- When wallet can't cover even 1 account: create a default for the double penalty (penalty = perAccountAmount × numAccounts × 2).
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
- Verified the full Lotus Bank → default settlement flow (legacy — no longer used for user-facing defaults):
  - Frontend (`Defaults.jsx`) sends `type: 'deposit'` with total default amount.
  - `initializeTransaction` creates pending `deposit` transaction (no plan_id), initializes Lotus checkout.
  - `lotusWebhook` → `handleLotusCheckout` → `processCompletedPayment` → `settleOutstandingPenalties` intercepts payment, settles oldest defaults first (full or partial), remainder credited to wallet.
  - `verifyTransaction` also calls `processCompletedPayment` idempotently (duplicate-safe).
- **Replaced Lotus payment with wallet-based default clearance**:
  - `deductionJob.js`: Default penalty_amount is now **doubled** — `fullDue * 2` (missed contribution + equal penalty, 2x per account).
  - `savingsController.js`: Added `clearDefaults` endpoint (`POST /api/savings/clear-defaults`) — debits wallet, splits half to plan savings (current_amount) and half to penalty settlement.
  - `savingsRoutes.js`: Added route for `clear-defaults`.
  - `client/src/pages/dashboard/Defaults.jsx`: Removed Lotus Bank payment modal. Added "Clear All Defaults" wallet-based button with confirmation modal. Removed per-default "Pay Now" buttons.
  - `client/src/services/api.js`: Added `clearDefaults()` API function.
  - `getMyDefaults` & `getPlanDefaultsDetail`: Updated `planConfig` to show doubled `penalty_per_account` (e.g., SILVER: 1500→3000).
  - Partial clearance: clears as many accounts as wallet balance allows (per-account granularity).
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
- **Fixed `createReferralCodeForPlan` for all plan types** (`server/src/models/referralModel.js`):
  - Previously only CREST and SILVER generated codes; GOLDEN_BASKET and ISUSU returned `null`.
  - Now all 4 plan types generate one referral code per account.
  - CREST: `locked` (30-day unlock); SILVER/GOLDEN_BASKET/ISUSU: `available`.
- **Added referral codes display on subscriptions page** (`client/src/pages/dashboard/Subscriptions.jsx`, `server/src/models/savingsModel.js`):
  - `getUserSavingsPlans` now LEFT JOINs `referral_codes` and aggregates them as JSON array per plan.
  - Each plan card shows a "Referral Codes" section with each code's monospace display + status pill (Active/Locked/Used).
- **Fixed `subscribeToPlan` referral logic** (`server/src/controllers/savingsController.js`):
  - **Self-referral now works**: User can use their own code to create another account → code is consumed, `referred_by` set to own ID, user becomes their own downline.
  - **Codes no longer wasted**: If a user already has a `referred_by`, new codes they enter are NOT consumed (warn and skip). Code stays available for others.
  - **Race condition prevention**: Added `SELECT ... FOR UPDATE` lock inside the transaction on the `referral_codes` row before marking as used.
  - **Diagnostics confirmed live DB bugs**: 232 self-use codes (consumed by owner), 552 total used codes, multiple subscribers consumed codes from different owners wasting their codes.
- **Fixed `authController.register`** (`server/src/controllers/authController.js`):
  - Added re-check that code is still `available` before marking as used (race condition guard).
- **Decimal consistency fixes** across codebase:
  - `deductionJob.js`: `Math.floor()` on catch-up `availableBalance`, `savingsAmount`
  - `transactionModel.js`: `Math.floor()` in `settleOutstandingPenalties` and `creditAmount`
  - `savingsController.js`: `Math.floor()` on refund amount
- **Downline display now counts each referral code usage as a separate entry** (same person appears multiple times if they used multiple codes). Fixed across all 6 locations:
  - `adminController.js:getAllUsers`: downline_count = `COUNT(*) FROM referral_codes WHERE used_by_user_id IS NOT NULL AND user_id = u.id`
  - `adminController.js:getUserById`: JOINs `referral_codes` with `users` — each code usage is one row, no dedup
  - `adminController.js:getDashboardStats`: total_downlines = `COUNT(*) FROM referral_codes WHERE used`
  - `adminController.js:getAdminReferralStats`: pre-fetches all individual code usages as array (not Set), each usage = one entry in downline list
  - `referralHelper.js:getReferredDownlines`: JOINs `referral_codes` with `users` — each code usage is one row, no dedup
  - `adminController.js:getAdminReferralStats` aggregate: total = `COUNT(*) FROM referral_codes WHERE used`
- **Fixed 7 self-referrals in DB** (`referred_by = own id` → `NULL`): Chinonye Sodiyan, Damilola Bayo, Ogechi Obimma, IFEOMA EZEWANMA, Jane Osufe, Chiazaram Okonkwo, Chinaro Maduako
- **Diagnosed live DB history** via 3 diagnostic scripts:
  - Scenario A (fixable, code consumed, no `referred_by`): **0 rows** — no cases found
  - Scenario B (stolen, code consumed, different `referred_by`): **138 rows** across **9 subscribers** (Charity Eke consumed 28 codes from 4 owners, Chiamaka Nwanozie consumed 24 codes from 5 owners, etc.)
  - Scenario C (self-consumed, no `referred_by`): **93 rows** across **13 users** (Gabriel Egele: 27 self-codes, Chioma Ugochukwu: 18, chiemerie Okoye: 9)
  - Scenario D (self-referrals `referred_by = own id`): **7 users** (fixed)
- **Fixed Scenarios B & C via query changes** — all 138 stolen + 93 self-consumed downlines now appear in the respective code owner's downline lists because queries reference `referral_codes` table directly. No `referred_by` column changes needed for B & C.

### Done (new)
- **Removed `runStartupCatchupDeductions` server startup calls** from both `app.js:151` and `server.js:57`. Deductions now only run at 6PM WAT via the cron job.
- **Fixed downline double-counting bug**: `getAllUsers`, `getDashboardStats`, and `getAdminReferralStats` aggregate were adding `COUNT(referred_by) + COUNT(DISTINCT code_users)`, double-counting people who appeared in both. Fixed all 3 to count each code usage as a separate entry.
- **Ann Chukwuemeka downlines**: Now correctly shows **20** downlines (Taiwo ×5, Charity ×15) instead of 4 or 2.

### Done (new)
- **Added referral code usage timestamp (`usedAt`) to admin referral audit display**:
  - Backend: Added `rc.updated_at` to all 3 downline queries (`getAdminReferralStats`, `getUserById`, `getReferredDownlines`) and passed it through as `usedAt` in results.
  - Frontend admin (`AdminReferrals.jsx`): Added "Code" and "Date Used" columns to the expanded downline sub-table, showing the referral code used and when it was consumed.

### Done (new)
- **Fixed over-target deduction bug** (reported via Chinaza Uzochukwu: savings showed ₦952k vs ₦912k target):
  - Root cause: `processDuePlan` in `deductionJob.js` never checked `target_amount` — it kept deducting weekly while a plan was still `active` (plans only leave `active` on maturity date via `maturityCron`). Chinaza's plan hit exactly ₦912,000, then the Aug 17 run deducted another ₦40,000 (10 accounts × ₦4,000 — all her wallet had) → ₦952,000, wallet left at ₦417.67.
  - Fix in `deductionJob.js` `processDuePlan`: skip plan entirely when `current_amount >= target_amount`; cap final `savingsAmount` at remaining-to-target (`Math.min(payableAmount, fullDue, remainingToTarget)`).
  - Same target cap added to `runStartupCatchupDeductions` (`owedAmount = Math.min(expectedTotal - currentAmount, remainingToTarget)`).
  - The user-visible "saved 48k → cleared default → now 50k" was the per-account view: 912k/19 = ₦48k target vs 952k/19 ≈ ₦50k actual.
  - **Data fix applied on live Neon DB** (transactional, with audit trail): clamped `current_amount` to target and refunded over-deduction to wallet (`available_balance` + `wallet_balance`) with `refund` transaction + `wallet_transactions` credit entry (refs `ADJ-OVERTGT-*`):
    - Chinaza Uzochukwu (CREST ×19): 952,000 → 912,000; wallet +40,000 (now ₦40,417.67)
    - Edwin Mitx (ISUSU): 19,000 → 15,000; wallet +4,000
    - Ifechukwu Nelson (ISUSU): 17,500 → 15,000; wallet +2,500
  - Verified: 0 plans remain over target in live DB.
- **Hardened ALL `current_amount` writers against target overshoot** (audit found 3 residual paths beyond the deduction job):
  - `transactionModel.js` `processCompletedPayment` (plan-tagged deposit/wallet_topup/contribution): plan credit capped at remaining-to-target (`SELECT ... FOR UPDATE` on plan); excess routed to user wallet.
  - `savingsController.js` `clearDefaults`: savings portion per cleared account capped at remaining-to-target (tracked per plan across loop iterations — multiple defaults can hit one plan); excess shifts to penalty settlement so books stay balanced (wallet debited = savings credited + penalty settled).
  - `savingsController.js` `clearDefaultById`: same cap — `savingsPortion = min(penaltyAmount/2, remainingToTarget)`, remainder settles penalty.
- **Verification performed**: 23-case logic simulation of all capped paths (all pass — at-target skip, final-week cap, per-account granularity preserved, NULL-target legacy behavior unchanged, clearance book balancing, deposit split) + 14-point live DB integrity check (all pass — no plans over target, wallets restored exactly, avail==wallet_balance for all users, no negative balances, audit trail complete: 3 refund txns + 3 ledger credits totaling ₦46,500, Chinaza's resolved default untouched, txn history intact).

### In Progress
- (none)

### Blocked
- (none)

## Key Decisions
- Referral code issue on live is a deployment/code version mismatch — database and local code are both fine.
- **Downline calculation now uses `referral_codes` table** alongside `referred_by`. This means ALL code owners see their downlines even if the subscriber already had a different `referred_by` from registration. "Stolen" and self-consumed downlines are returned to their code owners automatically — no `referred_by` column changes needed.
- **Wallet balance IS used to settle defaults** (via the Clear Defaults button on the defaults page). Lotus Bank is no longer used for user-facing default clearance.
- Deduction job only: (a) pays contributions if wallet can afford ≥1 account, (b) creates a default if can't cover even 1 account.
- **Deductions must never exceed `target_amount`**: plans stay `active` until maturity date, so the deduction job itself enforces the target cap (skip when reached; final payment capped at remaining-to-target).
- `missed_date` in defaults table should consistently be Africa/Lagos date to match deduction job's 6PM WAT schedule.
- `available_balance` only is read (no longer reads `wallet_balance`) from users table in deduction job since `wallet_balance` is derived.
- `settleOutstandingPenalties` supports both full and partial default settlement from incoming deposits (legacy — still works for general deposits but defaults page no longer uses Lotus).
- Self-referrals are now ALLOWED: a user can use their own referral code to create another account and become their own downline. The `referred_by` is set to their own ID and the code is consumed.
- If a user already has `referred_by` set (from a previous subscription or registration), new codes they enter are NOT consumed — the code stays available for genuine referrals.
- Clearance payments use wallet `available_balance` (deducted directly), NOT Lotus — different from defaults which require Lotus.
- `accounts_cleared` is tracked incrementally per-account; `clearance_paid` only set `TRUE` on final account.
- Paying `payClearanceFee` without `accountIndex` charges ₦3,000 × all remaining accounts (bulk per-plan).
- Default penalty_amount is DOUBLED in deductionJob: `perAccountAmount * numAccounts * 2` (missed contribution + equal penalty).
- When user clears defaults via wallet: half of payment goes to plan savings (current_amount), half settles the penalty (reduces penalty_amount until resolved).
- Partial per-account clearance: user can clear only as many accounts as their wallet balance covers. Each account costs `perAccountAmount * 2`. Oldest defaults are processed first.

## Next Steps
- Deploy all updated files to the live server (Neon).
- After deploy, verify: existing 232 self-consumed codes and 552 used codes now appear as downlines (via `referral_codes`-based queries). No `referred_by` changes needed.
- Monitor admin `/referrals` page, `/admin/users/:id` downline lists, and user-facing downlines to confirm all stolen and self-consumed downlines appear correctly.
- Verify that `DISTINCT ON` works in Neon PostgreSQL (should — it's standard PG).
- Run `UPDATE users SET referred_by = NULL WHERE id = referred_by;` if not already done (7 self-referrals fixed in this session).

## Critical Context
- `deductionJob.js` runs at 6PM WAT (`0 18 * * *` with `{ timezone: 'Africa/Lagos' }`).
- `expectedInstallment` is already scaled by `number_of_accounts`.
- `generateUniqueReferralCode()` in `savingsController.js` uses pool-level `query()` instead of transaction `client.query()` — potential race condition but not causing current issues.
- Marker transactions (`type='penalty', amount=0`) are inserted for "skipped" days to prevent the isDue check from firing again the next day.
- Default settlement flow: Lotus Bank payment → `lotusWebhook` → `processCompletedPayment` → `settleOutstandingPenalties` — intercepts incoming `deposit`/`wallet_topup`/`contribution`, settles oldest defaults first, remainder goes to wallet.
- Defaults page uses **wallet-based clearance** (`POST /api/savings/clear-defaults`) instead of Lotus Bank.
- `settleOutstandingPenalties` uses `FOR UPDATE` on defaults rows to prevent double-settlement from concurrent payments.
- `penaltyJob.js` was never created on disk; only `deductionJob.js` handles deduction/default logic.
- **Self-referral data issue**: 13 users in Neon have `referred_by` set to their own ID. Root cause: registration or `subscribeToPlan` allowed using one's own referral code. The `RegisterPage.jsx` no longer has the referral code field (removed), but existing data remains. **7 of these were fixed by setting `referred_by = NULL`** where `id = referred_by`.
- **232 self-consumed codes**: codes where `used_by_user_id = user_id` (owner used own code). Caused by live server's `subscribeToPlan` lacking a self-referral check — the code was marked as 'used' by the owner but `referred_by` was never set. Now fixed: self-referral both marks the code and sets `referred_by`. These 232 self-consumed downlines now appear in the owner's downline lists via `referral_codes`-based queries.
- **Multiple code consumption bug**: subscribers like Charity (930ea164) consumed codes from 4 different owners, but only the FIRST owner who set `referred_by` gets credit. Now fixed: codes are only consumed if `referred_by` is actually set by this operation.
- `authController.register` now re-checks code availability before marking as used to prevent race conditions.
- `subscribeToPlan` uses `SELECT ... FOR UPDATE` inside the transaction before marking referral_codes as used.

## Relevant Files
- `server/src/jobs/deductionJob.js`: Main deduction cron (6PM WAT) — per-account granularity, no sweep logic.
- `server/src/models/transactionModel.js`: Contains `settleOutstandingPenalties()` (with `FOR UPDATE`) for deposit-time settlement + `createWalletLedgerEntry()` for ledger entries.
- `server/src/controllers/transactionController.js`: `lotusWebhook`, `handleLotusCheckout`, `handleLotusVADeposit`, `initializeTransaction` — the full Lotus payment pipeline.
- `client/src/pages/dashboard/Defaults.jsx`: Frontend UI for paying defaults via wallet (Clear All Defaults button).
- `server/src/controllers/savingsController.js`: `subscribeToPlan` (referral processing), `payClearanceFee` (per-account + bulk), `bulkClearance` (multi-plan bulk with accounts_cleared tracking), `clearDefaults` (wallet-based default clearance with per-account granularity).
- `client/src/pages/dashboard/Clearance.jsx`: User-facing clearance page — per-account Pay buttons, bulk per-plan Pay All, progress bar.
- `client/src/pages/admin/AdminClearance.jsx`: Admin clearance management — filter by status, Settle button for pending_settlement plans.
- `server/src/controllers/adminController.js`: `getAdminReferralStats`, `getAllUsers` (self-referral exclusion), `getClearancePlans`, `adminSettleClearance`, `approveEligibility` (clearance notification).
- `client/src/components/Sidebar.jsx`: Added "Clearance" link.
- `client/src/components/AdminSidebar.jsx`: Added "Clearance" link.
- `server/src/config/schema.sql`: Added `accounts_cleared INTEGER DEFAULT 0` column to `savings_plans`.
- `server/src/routes/savingsRoutes.js`: Clearance routes (`pay-clearance`, `bulk-clearance`, `clear-defaults`) + `clear-default` (per-default).
- `server/src/routes/adminRoutes.js`: Clearance routes (`GET /clearance`, `POST /clearance/settle`).
- `server/src/middleware/authMiddleware.js`: `protect`, `checkMembership` — gate the subscription endpoint.
- `server/src/config/db.js`: DB connection pool, `getClient()` with monkey-patched query tracking.
- `server/.env`: Local DB via `DB_*` fields; `DATABASE_URL` (Neon) is commented out.
- `server/src/models/referralModel.js`: `createReferralCodeForPlan` (per-account code generation), `generateUniqueReferralCode`, `getUserReferralCodes`.
- `server/src/controllers/authController.js`: `register` (referral code handling with race condition guard).
