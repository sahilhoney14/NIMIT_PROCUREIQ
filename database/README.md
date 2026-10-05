# ProcureIQ Database Management

This directory contains the database migration scripts, baseline seeds, and production schemas for ProcureIQ.

## Structure

```
database/
├── migrations/          # Incremental DDL migrations
│   ├── 001_create_users.sql
│   ├── 002_create_roles.sql
│   ├── 003_create_vendors.sql
│   ├── 004_create_purchase_requests.sql
│   ├── 005_create_rfq.sql
│   ├── 006_create_quotations.sql
│   ├── 007_create_purchase_orders.sql
│   ├── 008_create_inventory.sql
│   └── 009_create_audit_logs.sql
├── seeds/               # Seed data for initialization
│   ├── roles.seed.sql
│   ├── users.seed.sql
│   ├── vendors.seed.sql
│   └── demo-data.seed.sql
└── schemas/             # Consolidated schema definition
    └── procureiq.sql
```

## Running Migrations & Seeds

Use the automated script from the root:
```bash
node scripts/seed-database.js
```
Or apply manually via MySQL CLI:
```bash
mysql -u root -p < database/schemas/procureiq.sql
```
