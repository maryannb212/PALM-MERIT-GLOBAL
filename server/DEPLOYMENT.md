# PALM MERIT GLOBAL - Production Deployment Guide

This guide provides instructions for deploying the Palm Merit Global backend to a persistent Ubuntu VPS using PM2 and Nginx.

## 1. Prerequisites
- Ubuntu 20.04+ VPS
- Node.js 18+ & npm
- PostgreSQL (e.g. Neon PostgreSQL DATABASE_URL)
- Domain name pointed to your VPS IP

## 2. Server Setup
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Nginx
sudo apt install nginx -y

# Install Node.js (via NVM)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.5/install.sh | bash
source ~/.bashrc
nvm install 18
nvm use 18

# Install PM2
npm install pm2 -g
```

## 3. Application Deployment
```bash
# Clone the repository
git clone <your-repo-url>
cd palm-merit-global/server

# Install dependencies
npm install

# Setup environment variables
cp .env.example .env.production
nano .env.production # Edit with production values

# Run migrations
export NODE_ENV=production
npm run migrate
```

## 4. Process Management (PM2)
```bash
# Start the backend in cluster mode
pm2 start ecosystem.config.cjs --env production

# Setup PM2 to start on boot
pm2 startup
# Follow the command provided by the output above
pm2 save
```

## 5. Reverse Proxy (Nginx)
```bash
# Copy nginx config template
sudo cp nginx.conf /etc/nginx/sites-available/palmmerit
sudo ln -s /etc/nginx/sites-available/palmmerit /etc/nginx/sites-enabled/

# Test and restart nginx
sudo nginx -t
sudo systemctl restart nginx
```

## 6. SSL Setup (Let's Encrypt)
```bash
sudo apt install certbot python3-certbot-nginx -y
sudo certbot --nginx -d api.palmmeritglobal.com
```

## 7. Environment Variables Checklist
Ensure the following are set in `.env.production`:
- `DATABASE_URL`: Neon PostgreSQL connection string
- `JWT_SECRET`: Strong random string
- `PAYSTACK_SECRET_KEY`: Production secret
- `FLUTTERWAVE_SECRET_KEY`: Production secret
- `CLOUDINARY_CLOUD_NAME`: Production name
- `CLOUDINARY_API_KEY`: Production key
- `CLOUDINARY_API_SECRET`: Production secret
- `CLIENT_URL`: `https://palmmeritglobal.com`
- `NODE_ENV`: `production`

## 8. Health Check
Once deployed, verify the status:
`https://api.palmmeritglobal.com/health`
