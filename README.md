# Palm Merit Global Platform

A production-grade, secure, and scalable fintech platform for Palm Merit Global. Built with React (Vite), Node.js (Express), and PostgreSQL.

## Features

- **User Dashboard**: Savings management, automated maturity, KYC verification, and support tickets.
- **Admin Command Center**: Member management, manual payment approval, financial reconciliation, and broadcast notifications.
- **Financial Engine**: Automated daily interest, missed contribution detection, and penalty enforcement.
- **Payment Integration**: Secure processing with Paystack (Webhooks supported).
- **Security**: JWT authentication, OTP verification, and RBAC (Role-Based Access Control).

## Tech Stack

- **Frontend**: React, Vite, CSS3, React Icons.
- **Backend**: Node.js, Express, PostgreSQL (node-postgres).
- **Automated Jobs**: node-cron.
- **Infrastructure**: Docker, Docker Compose.

## Getting Started

### Prerequisites

- Node.js (v18+)
- PostgreSQL (v15+)
- Docker (Optional, for containerized setup)

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
   - Copy `.env.example` to `server/.env` and fill in your details.

4. Database Setup:
   - The system automatically initializes tables on first run. Ensure your PostgreSQL service is running and credentials in `.env` are correct.

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

### Running with Docker

```bash
docker-compose up --build
```

## Admin Access

The system initializes with a default admin role capabilities. To promote a user to admin, update the `role` column in the `users` table to `admin`.

## License

Copyright © 2026 Palm Merit Global. All rights reserved.
