-- Palm Merit Global Initial Schema

-- 1. Users Table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    surname VARCHAR(100) NOT NULL,
    middle_name VARCHAR(100),
    first_name VARCHAR(100) NOT NULL,
    dob DATE NOT NULL,
    phone VARCHAR(20) NOT NULL,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE,
    
    -- Address
    address_street TEXT NOT NULL,
    address_city VARCHAR(100) NOT NULL,
    address_state VARCHAR(100) NOT NULL,
    address_nearest_bus_stop VARCHAR(255),
    
    -- Next of Kin
    nok_name VARCHAR(255) NOT NULL,
    nok_relationship VARCHAR(50) NOT NULL,
    nok_phone VARCHAR(20) NOT NULL,
    nok_address TEXT NOT NULL,
    nok_dob DATE,
    
    -- Profile / Financial details
    nin VARCHAR(20),
    bvn VARCHAR(20),
    bank_account_name VARCHAR(255),
    bank_name VARCHAR(100),
    bank_account_number VARCHAR(20),
    passport_photo_url TEXT,
    
    -- System status
    is_activated BOOLEAN DEFAULT FALSE,
    is_admin BOOLEAN DEFAULT FALSE,
    status VARCHAR(20) DEFAULT 'ACTIVE', -- ACTIVE, SUSPENDED, DELETED
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. OTP Codes
CREATE TABLE otp_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    code VARCHAR(10) NOT NULL,
    type VARCHAR(20) NOT NULL, -- LOGIN, VERIFY
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    used BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Savings Packages
CREATE TABLE savings_packages (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE, -- CREST, SILVER, GOLDEN_BASKET, ISUSU
    duration_days INTEGER NOT NULL,
    registration_fee NUMERIC(10, 2) NOT NULL,
    weekly_amount NUMERIC(10, 2) NOT NULL,
    total_contribution NUMERIC(12, 2) NOT NULL,
    roi_amount TEXT NOT NULL, -- Text to allow 'Foodstuff equivalent...'
    clearance_fee NUMERIC(10, 2) DEFAULT 0,
    contribution_frequency VARCHAR(20) DEFAULT 'WEEKLY' -- WEEKLY, DAILY
);

-- 4. User Subscriptions
CREATE TABLE user_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    package_id INTEGER REFERENCES savings_packages(id),
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    maturity_date DATE,
    clearance_date DATE,
    status VARCHAR(20) DEFAULT 'ACTIVE', -- ACTIVE, COMPLETED, DEFAULTED
    total_paid NUMERIC(12, 2) DEFAULT 0,
    weeks_completed INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. Transactions
CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    subscription_id UUID REFERENCES user_subscriptions(id),
    type VARCHAR(20) NOT NULL, -- DEPOSIT, WITHDRAWAL, PENALTY, REGISTRATION, CLEARANCE, CONTRIBUTION
    amount NUMERIC(12, 2) NOT NULL,
    reference VARCHAR(100) UNIQUE NOT NULL,
    payment_gateway VARCHAR(50), -- PAYSTACK, FLUTTERWAVE, WALLET
    gateway_reference VARCHAR(255),
    status VARCHAR(20) DEFAULT 'PENDING', -- PENDING, SUCCESS, FAILED
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 6. Wallets
CREATE TABLE wallets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE UNIQUE,
    balance NUMERIC(12, 2) DEFAULT 0,
    virtual_account_number VARCHAR(50),
    virtual_bank_name VARCHAR(100),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 7. Defaults & Penalties
CREATE TABLE defaults (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    subscription_id UUID REFERENCES user_subscriptions(id),
    missed_date DATE NOT NULL,
    penalty_amount NUMERIC(10, 2) NOT NULL,
    resolved BOOLEAN DEFAULT FALSE,
    resolved_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 8. Support Tickets
CREATE TABLE support_tickets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    subject VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    status VARCHAR(20) DEFAULT 'OPEN', -- OPEN, IN_PROGRESS, RESOLVED
    admin_response TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 9. Notifications
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL, -- SYSTEM, PAYMENT, ALERT
    channel VARCHAR(20) DEFAULT 'DASHBOARD', -- DASHBOARD, SMS, EMAIL
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 10. Audit Logs
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id UUID REFERENCES users(id),
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50),
    entity_id UUID,
    details JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 11. Payment Idempotency
CREATE TABLE payment_idempotency (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reference VARCHAR(100) UNIQUE NOT NULL,
    user_id UUID REFERENCES users(id),
    status VARCHAR(20) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Insert Seed Packages
INSERT INTO savings_packages (name, duration_days, registration_fee, weekly_amount, total_contribution, roi_amount, clearance_fee, contribution_frequency)
VALUES 
('CREST', 90, 3000, 4000, 48000, '96000', 3000, 'WEEKLY'),
('SILVER', 360, 2500, 1500, 75000, '150000', 3000, 'WEEKLY'),
('GOLDEN_BASKET', 360, 3000, 2000, 100000, 'Foodstuff equivalent ≥ 100000', 0, 'WEEKLY'),
('ISUSU', 30, 0, 500, 15000, 'Flexible', 0, 'DAILY');

