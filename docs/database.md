# Database Documentation

## Databases
ProcureIQ employs a dual-database architecture:
1. **`ProcureIQ`**: Primary transactional database containing all business entities.
2. **`ProcureIQ_Logs`**: High-throughput audit and reporting database containing `report_logs` (business audit trail) and `audit_logs` (record-level diff tracking).

## Entity Relationship Overview
- `users`: Core identity table with roles (`ADMIN`, `PROCUREMENT_MANAGER`, `PROCUREMENT`).
- `vendor_oem_masters`: Complete vendor profiles including commercial, contact, and compliance data.
- `purchase_requests`: PR definitions generated from requirements.
- `vendor_inquiries`: Links PR to inquiry lifecycle.
- `vendor_inquiry_vendors`: Quotations collected per vendor against an inquiry.
- `purchase_orders`: Official issued POs generated upon vendor quotation selection.
- `goods_received`: GRN tracking incoming shipments against open POs.
- `goods_returns`: Vendor returns tracking defective or rejected items.
- `report_logs`: Immutable activity logs recording actor, action, and human-readable narrative.
- `audit_logs`: Technical state changes recording before and after snapshots.
