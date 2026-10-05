# Production Deployment Guide

## Prerequisites
- **Node.js**: v18.x or v20.x LTS
- **MySQL**: 8.0 or 8.4+
- **OS**: Windows Server, Linux (Ubuntu 22.04 LTS), or Docker

## Environment Configuration
Create a `.env` file in `backend/.env`:
```env
PORT=3000
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=YourSecurePassword
DB_NAME=ProcureIQ
DB2_NAME=ProcureIQ_Logs
SESSION_SECRET=your_production_random_secret_string_32chars
NODE_ENV=production
```

## Database Provisioning
Run the consolidated schema:
```bash
mysql -u root -p < database/schemas/procureiq.sql
```
And initialize baseline data:
```bash
node scripts/seed-database.js
```

## Running the Application
### Option A: Standard Node Process
```bash
cd backend
npm install --omit=dev
node server.js
```

### Option B: Process Manager (PM2 Recommended)
```bash
npm install -g pm2
pm2 start backend/server.js --name "procureiq"
pm2 save
pm2 startup
```

### Option C: Windows Service or Script
```cmd
start-services.bat
```
