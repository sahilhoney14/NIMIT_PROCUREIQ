# Role-Based Access Control (RBAC)

## User Roles
ProcureIQ defines three distinct authorization tiers:

### 1. `ADMIN`
- Full administrative authority over all modules.
- User management: create accounts, update passwords, grant or revoke access.
- System auditing: access to `report_logs`, `audit_logs`, and `login_logs`.
- Emergency PO override and status management.

### 2. `PROCUREMENT_MANAGER`
- Management oversight of all ongoing requisitions and inquiries.
- Vendor quotation evaluation and comparison.
- Final approval and issuance authority for Purchase Orders (`POST /purchase-orders/:id/issue`).
- Review of Goods Received and Returns ledger.

### 3. `PROCUREMENT`
- Creation and excel upload of Purchase Requests (`PR`).
- Creation of RFQs and Vendor Inquiries.
- Data entry of vendor quotations and attachments.
- Recording Goods Received Notes (`GRN`) and Goods Returns upon warehouse physical delivery.

## Enforcing Middleware
- `verifyAdmin`: Confirms active session with `role === "ADMIN"`.
- `verifyManager`: Confirms active session with `role in ["ADMIN", "PROCUREMENT_MANAGER"]`.
- `verifyProcurement`: Confirms active session with any valid authenticated user role.
