import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { startCronJobs } from './jobs/penaltyJob.js';
import './jobs/maturityCron.js';
import { startStaffDeactivationJob } from './jobs/staffDeactivationJob.js';
import { query } from './config/db.js';

dotenv.config();

const app = express();

// Middleware
app.use(helmet());
app.use(cors());

// Raw body parser for Paystack webhook (must be before express.json())
// This allows HMAC-SHA512 signature verification to work correctly.
app.use('/api/transactions/webhook/paystack', express.raw({ type: 'application/json' }));
app.use('/api/transactions/webhook/virtual-account', express.raw({ type: 'application/json' }));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static('uploads'));

// Routes
import authRoutes from './routes/authRoutes.js';
import savingsRoutes from './routes/savingsRoutes.js';
import transactionRoutes from './routes/transactionRoutes.js';
import membershipRoutes from './routes/membershipRoutes.js';
import kycRoutes from './routes/kycRoutes.js';
import ticketRoutes from './routes/ticketRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import ambassadorRoutes from './routes/ambassadorRoutes.js';
import payoutRoutes from './routes/payoutRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';
import bankRoutes from './routes/bankRoutes.js';


// Basic health check route
app.get('/', (req, res) => {
  res.json({ message: 'Palm Merit Global API is running' });
});

app.use('/api/auth', authRoutes);
app.use('/api/savings', savingsRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/membership', membershipRoutes);
app.use('/api/kyc', kycRoutes);
app.use('/api/tickets', ticketRoutes);
app.use('/api/ambassadors', ambassadorRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/payouts', payoutRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/bank-details', bankRoutes);


// Port configuration
const PORT = process.env.PORT || 5000;

startCronJobs();
startStaffDeactivationJob();

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  
  // Ensure Core Tables exist and are up to date
  const initDb = async () => {
    try {
      // 1. Users table migrations/creation
      await query(`
        CREATE TABLE IF NOT EXISTS users (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          first_name VARCHAR(100) NOT NULL,
          last_name VARCHAR(100) NOT NULL,
          email VARCHAR(255) UNIQUE NOT NULL,
          password_hash VARCHAR(255) NOT NULL,
          phone VARCHAR(20),
          role VARCHAR(20) DEFAULT 'user',
          has_paid_membership BOOLEAN DEFAULT FALSE,
          kyc_status VARCHAR(20) DEFAULT 'unverified',
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `);
      
      // Ensure wallet_balance column exists
      await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS wallet_balance DECIMAL(12, 2) DEFAULT 0.00;`);
      await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS available_balance DECIMAL(12, 2) DEFAULT 0.00;`);
      await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS held_balance DECIMAL(12, 2) DEFAULT 0.00;`);
      await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS tshirt_paid BOOLEAN DEFAULT FALSE;`);
      await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS tshirt_payment_date TIMESTAMP WITH TIME ZONE;`);
      
      // Virtual Account columns
      await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS virtual_account_number VARCHAR(20);`);
      await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS virtual_account_name VARCHAR(100);`);
      await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS virtual_bank_name VARCHAR(100);`);
      await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS virtual_provider VARCHAR(50);`);
      await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS virtual_account_slug VARCHAR(100);`);
      await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active';`);
      await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login TIMESTAMP WITH TIME ZONE;`);

      // 6. Support & Tickets
      await query(`
        CREATE TABLE IF NOT EXISTS tickets (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            subject VARCHAR(255) NOT NULL,
            message TEXT NOT NULL,
            status VARCHAR(20) DEFAULT 'open',
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // 7. Ambassadors (Team Leads)
      await query(`
        CREATE TABLE IF NOT EXISTS ambassadors (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            name VARCHAR(100) NOT NULL,
            role VARCHAR(100) NOT NULL,
            bio TEXT,
            image_url VARCHAR(255),
            order_index INTEGER DEFAULT 0,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // 2. OTP table
      await query(`
        CREATE TABLE IF NOT EXISTS otp_codes (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          code VARCHAR(10) NOT NULL,
          type VARCHAR(20) DEFAULT 'login',
          expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
          used BOOLEAN DEFAULT FALSE,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // 3. Savings Plans migrations
      await query(`
        CREATE TABLE IF NOT EXISTS savings_plans (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          plan_name VARCHAR(50) NOT NULL,
          status VARCHAR(20) DEFAULT 'active',
          target_amount DECIMAL(12, 2) NOT NULL,
          current_amount DECIMAL(12, 2) DEFAULT 0.00,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `);
      await query(`ALTER TABLE savings_plans ADD COLUMN IF NOT EXISTS interest_rate DECIMAL(5, 2) DEFAULT 10.00;`);
      await query(`ALTER TABLE savings_plans ADD COLUMN IF NOT EXISTS number_of_accounts INTEGER DEFAULT 1;`);
      await query(`ALTER TABLE savings_plans ADD COLUMN IF NOT EXISTS clearance_required BOOLEAN DEFAULT FALSE;`);
      await query(`ALTER TABLE savings_plans ADD COLUMN IF NOT EXISTS clearance_paid BOOLEAN DEFAULT FALSE;`);
      await query(`ALTER TABLE savings_plans ADD COLUMN IF NOT EXISTS clearance_date TIMESTAMP WITH TIME ZONE;`);
      await query(`ALTER TABLE savings_plans ADD COLUMN IF NOT EXISTS maturity_date TIMESTAMP WITH TIME ZONE;`);
      await query(`ALTER TABLE savings_plans ADD COLUMN IF NOT EXISTS payout_date TIMESTAMP WITH TIME ZONE;`);
      await query(`ALTER TABLE savings_plans ADD COLUMN IF NOT EXISTS refund_only BOOLEAN DEFAULT FALSE;`);

      // Update savings_plans status check constraint
      try {
        await query(`ALTER TABLE savings_plans DROP CONSTRAINT IF EXISTS savings_plans_status_check;`);
        await query(`ALTER TABLE savings_plans ADD CONSTRAINT savings_plans_status_check CHECK (status IN ('active', 'completed', 'cancelled', 'matured', 'pending_clearance', 'pending_settlement', 'settled'));`);
      } catch (e) {}

      // Create Payouts table
      await query(`
        CREATE TABLE IF NOT EXISTS payouts (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            plan_id UUID NOT NULL REFERENCES savings_plans(id) ON DELETE CASCADE,
            amount DECIMAL(12, 2),
            payout_type VARCHAR(20) NOT NULL,
            status VARCHAR(20) DEFAULT 'pending',
            approved_by UUID REFERENCES users(id),
            approved_at TIMESTAMP WITH TIME ZONE,
            notes TEXT,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `);
      try {
        await query(`ALTER TABLE payouts DROP CONSTRAINT IF EXISTS payouts_payout_type_check;`);
        await query(`ALTER TABLE payouts ADD CONSTRAINT payouts_payout_type_check CHECK (payout_type IN ('cash', 'goods'));`);
        await query(`ALTER TABLE payouts DROP CONSTRAINT IF EXISTS payouts_status_check;`);
        await query(`ALTER TABLE payouts ADD CONSTRAINT payouts_status_check CHECK (status IN ('pending', 'approved', 'settled', 'rejected'));`);
      } catch (e) {}

      // 4. Transactions migrations
      await query(`
        CREATE TABLE IF NOT EXISTS transactions (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          plan_id UUID REFERENCES savings_plans(id) ON DELETE SET NULL,
          type VARCHAR(20) NOT NULL,
          amount DECIMAL(12, 2) NOT NULL,
          status VARCHAR(20) DEFAULT 'pending',
          reference VARCHAR(100) UNIQUE,
          receipt_url VARCHAR(255),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `);
      // Ensure receipt_url column exists if table was already created
      await query(`ALTER TABLE transactions ADD COLUMN IF NOT EXISTS receipt_url VARCHAR(255);`);
      await query(`ALTER TABLE transactions ADD COLUMN IF NOT EXISTS gateway_reference VARCHAR(255);`);
      await query(`ALTER TABLE transactions ADD COLUMN IF NOT EXISTS payment_provider VARCHAR(20);`);
      await query(`ALTER TABLE transactions ADD COLUMN IF NOT EXISTS provider_reference VARCHAR(255);`);
      
      await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMP WITH TIME ZONE;`);
      await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_verified_at TIMESTAMP WITH TIME ZONE;`);
      
      await query(`ALTER TABLE kyc_details ADD COLUMN IF NOT EXISTS document_back_url VARCHAR(255);`);
      await query(`ALTER TABLE kyc_details ADD COLUMN IF NOT EXISTS selfie_url VARCHAR(255);`);
      await query(`ALTER TABLE kyc_details ADD COLUMN IF NOT EXISTS bank_code VARCHAR(20);`);

      // Create bank_accounts table if not exists
      await query(`
        CREATE TABLE IF NOT EXISTS bank_accounts (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            account_name VARCHAR(100) NOT NULL,
            account_number VARCHAR(20) NOT NULL,
            bank_name VARCHAR(100) NOT NULL,
            bank_code VARCHAR(10),
            is_primary BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // Update check constraint for payment_provider
      try {
        await query(`ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_payment_provider_check;`);
        await query(`ALTER TABLE transactions ADD CONSTRAINT transactions_payment_provider_check CHECK (payment_provider IN ('paystack', 'flutterwave'));`);
      } catch (e) { /* Already exists */ }
      try {
        await query(`ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_type_check;`);
        await query(`ALTER TABLE transactions ADD CONSTRAINT transactions_type_check CHECK (type IN ('deposit', 'withdrawal', 'penalty', 'membership', 'interest', 'wallet_topup', 'clearance', 'contribution'));`);
      } catch (e) { /* Already exists */ }

      try {
        await query(`ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_status_check;`);
        await query(`ALTER TABLE transactions ADD CONSTRAINT transactions_status_check CHECK (status IN ('pending', 'completed', 'failed', 'cancelled'));`);
      } catch (e) { /* Already exists */ }

      // ── IDEMPOTENCY: Named UNIQUE constraint on transactions.reference ────
      // The column already has an inline UNIQUE, but adding a named constraint
      // makes conflict error messages unambiguous in pg logs.
      try {
        await query(`
          ALTER TABLE transactions
            ADD CONSTRAINT unique_transaction_reference UNIQUE (reference);
        `);
      } catch (e) { /* Constraint already exists — safe to ignore */ }

      // ── Webhook audit log table ───────────────────────────────────────────
      await query(`
        CREATE TABLE IF NOT EXISTS webhook_logs (
          id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          source        VARCHAR(50)  NOT NULL DEFAULT 'paystack',
          reference     VARCHAR(100),
          event_type    VARCHAR(100),
          payload       JSONB,
          signature_ok  BOOLEAN      NOT NULL DEFAULT FALSE,
          status        VARCHAR(20)  NOT NULL DEFAULT 'received',
          note          TEXT,
          created_at    TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `);
      await query(`CREATE INDEX IF NOT EXISTS idx_webhook_logs_reference ON webhook_logs (reference);`);
      await query(`CREATE INDEX IF NOT EXISTS idx_webhook_logs_created_at ON webhook_logs (created_at);`);

      // ── New financial tables ─────────────────────────────────────────────
      await query(`
        CREATE TABLE IF NOT EXISTS wallet_transactions (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          type VARCHAR(10) NOT NULL,
          amount DECIMAL(12, 2) NOT NULL,
          reference VARCHAR(100) NOT NULL,
          description TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `);
      try {
        await query(`ALTER TABLE wallet_transactions DROP CONSTRAINT IF EXISTS wallet_transactions_type_check;`);
        await query(`ALTER TABLE wallet_transactions ADD CONSTRAINT wallet_transactions_type_check CHECK (type IN ('credit', 'debit'));`);
      } catch (e) {}

      await query(`
        CREATE TABLE IF NOT EXISTS withdrawal_details (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          transaction_id UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
          account_name VARCHAR(100) NOT NULL,
          account_number VARCHAR(20) NOT NULL,
          bank_name VARCHAR(100) NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // 5. Notifications table
      await query(`
        CREATE TABLE IF NOT EXISTS notifications (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID REFERENCES users(id) ON DELETE CASCADE,
            type VARCHAR(50) NOT NULL,
            title VARCHAR(255) NOT NULL,
            message TEXT NOT NULL,
            is_read BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // 6. Defaults table
      await query(`
        CREATE TABLE IF NOT EXISTS defaults (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID REFERENCES users(id) ON DELETE CASCADE,
            plan_id UUID REFERENCES savings_plans(id) ON DELETE CASCADE,
            missed_date DATE NOT NULL,
            penalty_amount DECIMAL(10, 2) NOT NULL,
            resolved BOOLEAN DEFAULT FALSE,
            resolved_at TIMESTAMP WITH TIME ZONE,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // 7. Audit Logs table
      await query(`
        CREATE TABLE IF NOT EXISTS audit_logs (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            admin_id UUID REFERENCES users(id),
            action VARCHAR(100) NOT NULL,
            entity_type VARCHAR(50),
            entity_id UUID,
            details JSONB,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // 8. KYC Details table
      await query(`
        CREATE TABLE IF NOT EXISTS kyc_details (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
            first_name VARCHAR(100),
            last_name VARCHAR(100),
            middle_name VARCHAR(100),
            phone VARCHAR(20),
            email VARCHAR(100),
            address TEXT,
            gender VARCHAR(20),
            dob DATE,
            bvn VARCHAR(20),
            bank_name VARCHAR(100),
            account_number VARCHAR(20),
            id_type VARCHAR(50),
            id_number VARCHAR(100),
            document_url VARCHAR(255),
            submitted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `);

      console.log('Database tables verified and updated successfully');
    } catch (err) {
      console.error("Database initialization error:", err.message);
    }
  };

  initDb();

  // Initialize scheduled tasks
  startCronJobs();
});

export default app;
