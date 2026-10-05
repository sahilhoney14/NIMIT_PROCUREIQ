# End-to-End Procurement Workflow

```mermaid
sequenceDiagram
    autonumber
    actor P as Procurement Officer
    actor M as Procurement Manager
    actor V as Vendor OEM
    participant S as ProcureIQ Server
    participant DB as MySQL DB

    P->>S: 1. Create Purchase Request (PR)
    S->>DB: Store PR (NEE/YY-YY/PR/XXXX)
    P->>S: 2. Create Vendor Inquiry / RFQ
    S->>DB: Associate PR with Inquiry
    P->>V: 3. Dispatch RFQ to Vendor(s)
    V-->>P: 4. Provide Commercial Quotation
    P->>S: 5. Record Quotation & Attachments
    M->>S: 6. Compare Quotations & Select Vendor
    S->>DB: Draft Purchase Order (NEE/YY-YY/PO/XXXX)
    M->>S: 7. Approve & Issue PO
    S->>S: 8. Generate Stamped PDF
    V-->>P: 9. Physical Goods Delivered
    P->>S: 10. Record Goods Received (GRN)
    S->>DB: Update Stock & Progress Ledger
    alt If Defects Found
        P->>S: 11. Record Goods Return
        S->>DB: Reverse Received Quantity
    end
    opt PO Fully Fulfilled
        M->>S: 12. Mark PO Completed
    end
```

## Step-by-Step Lifecycle
1. **Requisition**: Initiated by project site or engineering team. Auto-assigned serial number `NEE/YY-YY/PR/XXXX`.
2. **Vendor Inquiry / RFQ**: Multiple eligible OEM vendors are invited to bid on specification.
3. **Quotation Comparison**: Commercial evaluation of unit rates, delivery timelines, payment terms (Advance, Credit, Advance+Balance), and freight.
4. **PO Issuance**: Generates formal purchase order with legally binding terms and auto-generated PDF with company header.
5. **Inventory Receipt (GRN)**: Gatekeeper checks shipment against PO line items. Partial receipts supported.
6. **Returns & Fulfillment**: Returned goods are logged with reason; order auto-tracks remaining balance.
