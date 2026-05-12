# Palm Merit Global Platform

A production-grade, secure, and scalable fintech platform for Palm Merit Global. Built with React (Vite), Node.js (Express), and PostgreSQL (Neon).

## Features

- **User Dashboard**: Savings management, automated maturity, KYC verification, and support tickets.
- **Admin Command Center**: Member management, manual payment approval, financial reconciliation, and broadcast notifications.
- **Financial Engine**: Automated daily interest, missed contribution detection, and penalty enforcement.
- **Payment Integration**: Secure processing with Paystack & Flutterwave (Webhooks supported).
- **Security**: JWT authentication, OTP verification, and RBAC (Role-Based Access Control).

## Tech Stack

- **Frontend**: React, Vite, CSS3, React Icons.
- **Backend**: Node.js, Express, PostgreSQL (Neon).
- **Automated Jobs**: node-cron.
- **Cloud Storage**: Cloudinary.
- **Infrastructure**: Railway (Backend), Vercel/Netlify (Frontend).

## Project Structure

```
/
├── client/          # React frontend (Vite)
├── server/          # Node.js backend (Express)
│   ├── src/
│   │   ├── config/       # Database, Cloudinary config
│   │   ├── controllers/  # Route handlers
│   │   ├── jobs/         # Cron jobs (penalties, maturity, deactivation)
│   │   ├── middleware/   # Auth, upload middleware
│   │   ├── models/       # Database models
│   │   ├── routes/       # API route definitions
│   │   ├── services/     # OTP, virtual accounts
│   │   ├── utils/        # Email, SMS, webhook logging
│   │   ├── app.js        # Express app setup
│   │   └── server.js     # Entry point
│   ├── knexfile.js       # Database migrations config
│   ├── package.json
│   └── .env.example
└── README.md
```

## Getting Started

### Prerequisites

- Node.js (v18+)
- Neon PostgreSQL database

### Installation

1. Clone the repository.
2. Install dependencies for both server and client:
   ```bash
   # Server
   cd server
   npm install

   # Client
   cd ../client
   npm install
   ```

3. Set up environment variables:
   - Copy `server/.env.example` to `server/.env` and fill in your details.

4. Database Setup:
   - The system automatically initializes tables on first run. Ensure your Neon PostgreSQL credentials in `.env` are correct.

### Running Locally

1. **Start the Backend**:
   ```bash
   cd server
   npm run dev
   ```

2. **Start the Frontend**:
   ```bash
   cd client
   npm run dev
   ```

---

## Railway Deployment (Backend)

> **IMPORTANT**: This is a monorepo. Railway must be configured to deploy only the `/server` directory.

### Step-by-Step

1. **Create a new Railway project** and connect your GitHub repository.

2. **Set the Root Directory**:
   - Go to your Railway service → **Settings** → **Root Directory**
   - Set it to: **`server`**
   - This tells Railway to treat `/server` as the project root.

3. **Configure Build & Start Commands** (Railway Settings → Deploy):
   - **Build Command**: `npm install && npx knex migrate:latest`
   - **Start Command**: `npm start`

4. **Set Environment Variables** in Railway dashboard:
   ```
   NODE_ENV=production
   DATABASE_URL=postgresql://user:pass@host/db?sslmode=require
   JWT_SECRET=your_production_jwt_secret
   CLIENT_URL=https://your-frontend-domain.com
   PAYSTACK_SECRET_KEY=sk_live_xxx
   SENDGRID_API_KEY=SG.xxx
   CLOUDINARY_CLOUD_NAME=xxx
   CLOUDINARY_API_KEY=xxx
   CLOUDINARY_API_SECRET=xxx
   TERMII_API_KEY=xxx
   ```

5. **Deploy**. Railway will:
   - Detect Node.js from `package.json`
   - Run `npm install` (installs dependencies)
   - Run migrations against Neon PostgreSQL
   - Start the server with `node src/server.js`
   - Assign a `PORT` automatically (the server reads `process.env.PORT`)

### Health Check

After deployment, verify with:
```
GET https://your-railway-url.up.railway.app/health
GET https://your-railway-url.up.railway.app/api/health/db
```

### Notes

- **Do NOT set PORT manually** — Railway assigns it automatically.
- The backend uses **Neon PostgreSQL** with SSL enabled.
- File uploads use **Cloudinary** in production (Railway filesystem is ephemeral).
- CORS is configured via `CLIENT_URL` — set this to your frontend domain.
- For multiple frontend origins, use comma-separated values: `https://palmmeritglobal.com,https://www.palmmeritglobal.com`

---

## Frontend Deployment

The frontend (`/client`) is deployed separately (e.g., Vercel, Netlify). This README does not cover frontend deployment.

## Admin Access

The system initializes with a default admin role capabilities. To promote a user to admin, update the `role` column in the `users` table to `admin`.

## License

Copyright © 2026 Palm Merit Global. All rights reserved.
