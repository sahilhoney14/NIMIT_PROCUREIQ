# API Documentation

## Base URL
All API requests are made relative to: `http://localhost:3000` (or `http://localhost:3000/api`)

## Core Endpoints Summary

### Authentication
- `POST /login` - Session authentication with username and password.
- `POST /logout` - Terminates user session and clears cookie.
- `GET /me` - Returns currently authenticated user context.

### Purchase Requests
- `GET /pr` - List purchase requests.
- `POST /pr` - Create new purchase request.
- `POST /upload-pr` - Bulk import PRs from Excel spreadsheet.

### Vendor OEM Master
- `GET /vendors` - List registered vendors.
- `POST /vendors` - Register new OEM vendor with compliance documents.
- `PUT /vendors/:id` - Update vendor master details.

### Vendor Inquiries & RFQs
- `GET /inquiries` - List RFQs and inquiries.
- `POST /inquiries/:id/vendors` - Add vendor to inquiry.
- `POST /inquiries/:id/quotations` - Submit vendor quotation details.
- `POST /inquiries/:id/select-vendor` - Select winning vendor & trigger PO draft creation.

### Purchase Orders
- `GET /purchase-orders` - List purchase orders.
- `GET /purchase-orders/:id` - Retrieve PO details.
- `POST /purchase-orders/:id/issue` - Approve & issue PO, generates PDF.
- `GET /purchase-orders/:id/pdf` - Stream generated PDF document.

### Goods Receipt & Returns
- `GET /goods-received` - List active orders with receipt progress.
- `GET /goods-received/:po_id` - Detailed receipt and return ledger for PO.
- `POST /goods-received` - Record new incoming shipment.
- `POST /goods-returns` - Record return to vendor.

### Reports & Audits
- `GET /report-logs` - Business activity audit log.
- `GET /audit-logs` - System state modification audit log.
- `GET /login-logs` - User access authentication log.
