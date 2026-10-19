const fs = require("fs");
const path = require("path");

const rootDir = path.resolve(__dirname, "../..");

console.log("Root directory:", rootDir);

const cssReplacement = `/* ─── Reports & Audits ────────────────────────────────────── */

.logs-filter-bar {
    flex-wrap: wrap;
    gap: 12px;
}

.logs-report-cell,
.logs-value-cell {
    white-space: normal;
    word-break: break-word;
    font-size: 13px;
    line-height: 1.5;
    vertical-align: top;
    padding: 12px 14px;
}

.logs-report-cell {
    max-width: 650px;
    color: #1e293b;
}

.logs-value-cell {
    max-width: 480px;
    min-width: 240px;
}

.audit-old-cell {
    background-color: #fafbfd;
}

.audit-new-cell {
    background-color: #ffffff;
}

/* User pill */
.user-pill {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 3px 8px;
    background: #f1f5f9;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    font-size: 12px;
    font-weight: 600;
    color: #334155;
    white-space: nowrap;
}

.user-pill svg {
    color: #64748b;
    flex-shrink: 0;
}

/* Action container & badges */
.log-action-wrap {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 5px;
}

.log-badge {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 4px 10px;
    border-radius: 9999px;
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.03em;
    line-height: 1.2;
    white-space: nowrap;
}

.log-badge-danger {
    background: #fee2e2;
    color: #b91c1c;
    border: 1px solid #fecaca;
}

.log-badge-success {
    background: #dcfce7;
    color: #15803d;
    border: 1px solid #bbf7d0;
}

.log-badge-info {
    background: #e0f2fe;
    color: #0369a1;
    border: 1px solid #bae6fd;
}

.log-badge-warning {
    background: #fef3c7;
    color: #b45309;
    border: 1px solid #fde68a;
}

.log-badge-primary {
    background: #eff6ff;
    color: #1d4ed8;
    border: 1px solid #bfdbfe;
}

.log-badge-purple {
    background: #f3e8ff;
    color: #7e22ce;
    border: 1px solid #e9d5ff;
}

.log-badge-neutral {
    background: #f1f5f9;
    color: #475569;
    border: 1px solid #e2e8f0;
}

.log-action-subtext {
    font-size: 11.5px;
    color: #64748b;
    font-weight: 500;
    line-height: 1.35;
}

/* Audit cards & diffs */
.audit-card {
    background: #ffffff;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    padding: 10px 12px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.02);
    font-size: 12.5px;
}

.audit-card-danger {
    border-left: 3px solid #ef4444;
    background: #fffafa;
}

.audit-card-success {
    border-left: 3px solid #10b981;
    background: #f8fdf9;
}

.audit-card-old {
    border-left: 3px solid #cbd5e1;
}

.audit-card-new {
    border-left: 3px solid #3b82f6;
}

.audit-card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    margin-bottom: 6px;
    padding-bottom: 6px;
    border-bottom: 1px dashed #e2e8f0;
}

.audit-card-title {
    font-size: 13px;
    font-weight: 700;
    color: #0f172a;
}

.audit-card-code {
    font-size: 11px;
    font-weight: 700;
    font-family: monospace;
    background: #f1f5f9;
    color: #0f172a;
    padding: 2px 6px;
    border-radius: 4px;
    border: 1px solid #cbd5e1;
}

.audit-card-body {
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-size: 12px;
    color: #334155;
    line-height: 1.45;
}

.audit-field {
    display: flex;
    gap: 6px;
    align-items: baseline;
}

.audit-label {
    font-weight: 600;
    color: #64748b;
    font-size: 11px;
    min-width: 80px;
    flex-shrink: 0;
}

.audit-val {
    color: #0f172a;
    font-weight: 500;
    word-break: break-word;
}

.audit-diff-item {
    display: flex;
    gap: 6px;
    align-items: baseline;
    font-size: 12px;
    padding: 3px 0;
    border-bottom: 1px dotted #f1f5f9;
}

.audit-diff-item:last-child {
    border-bottom: none;
}

.audit-diff-label {
    font-weight: 600;
    color: #64748b;
    font-size: 11px;
    min-width: 130px;
    flex-shrink: 0;
}

.audit-diff-old-val {
    color: #b91c1c;
    background: #fee2e2;
    padding: 1px 6px;
    border-radius: 4px;
    font-weight: 500;
    text-decoration: line-through;
    word-break: break-word;
}

.audit-diff-new-val {
    color: #15803d;
    background: #dcfce7;
    padding: 1px 6px;
    border-radius: 4px;
    font-weight: 600;
    word-break: break-word;
}

.audit-pill-danger {
    display: inline-block;
    padding: 2px 7px;
    background: #fee2e2;
    color: #b91c1c;
    border-radius: 9999px;
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.02em;
}

.audit-pill-success {
    display: inline-block;
    padding: 2px 7px;
    background: #dcfce7;
    color: #15803d;
    border-radius: 9999px;
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.02em;
}

.audit-pill-warning {
    display: inline-block;
    padding: 2px 7px;
    background: #fef3c7;
    color: #b45309;
    border-radius: 9999px;
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.02em;
}

.audit-deleted-state,
.audit-state-revoked {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    font-size: 12px;
    color: #991b1b;
    font-weight: 500;
    background: #fff5f5;
    border: 1px dashed #fca5a5;
    padding: 7px 11px;
    border-radius: 6px;
}

.audit-state-granted {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    font-size: 12px;
    color: #166534;
    font-weight: 500;
    background: #f0fdf4;
    border: 1px dashed #86efac;
    padding: 7px 11px;
    border-radius: 6px;
}

.audit-state-info {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    font-size: 12px;
    color: #854d0e;
    font-weight: 500;
    background: #fefce8;
    border: 1px dashed #fde047;
    padding: 7px 11px;
    border-radius: 6px;
}

.audit-muted-box {
    color: #94a3b8;
    font-style: italic;
    font-size: 12px;
    padding: 4px 0;
}

.audit-raw-details {
    margin-top: 8px;
    padding-top: 6px;
    border-top: 1px solid #f1f5f9;
}

.audit-raw-details summary {
    font-size: 11px;
    color: #94a3b8;
    cursor: pointer;
    user-select: none;
    font-weight: 600;
}

.audit-raw-details summary:hover {
    color: #2563eb;
    text-decoration: underline;
}

.audit-raw-details pre {
    background: #0f172a;
    color: #e2e8f0;
    font-size: 10.5px;
    padding: 8px 10px;
    border-radius: 6px;
    overflow-x: auto;
    max-height: 160px;
    margin-top: 5px;
    font-family: Consolas, Monaco, monospace;
    line-height: 1.4;
}

/* Activity Report Styling */
.activity-report-lead {
    font-size: 13px;
    line-height: 1.5;
    color: #1e293b;
}

.activity-actor {
    display: inline-block;
    padding: 1px 7px;
    background: #f1f5f9;
    border: 1px solid #cbd5e1;
    border-radius: 4px;
    font-size: 12px;
    font-weight: 700;
    color: #334155;
    margin-right: 3px;
}

.report-entity {
    color: #0f172a;
    font-weight: 700;
}

.report-meta {
    color: #64748b;
    font-size: 12px;
    margin-left: 3px;
}

.report-code-badge {
    display: inline-block;
    font-family: monospace;
    font-size: 11.5px;
    font-weight: 700;
    background: #f1f5f9;
    color: #0f172a;
    padding: 1px 6px;
    border-radius: 4px;
    border: 1px solid #cbd5e1;
}

.report-ref-badge {
    display: inline-block;
    font-family: monospace;
    font-size: 11.5px;
    font-weight: 700;
    color: #1d4ed8;
    background: #eff6ff;
    padding: 1px 6px;
    border-radius: 4px;
    border: 1px solid #bfdbfe;
}

.report-amount {
    color: #15803d;
    font-weight: 700;
}

.report-status-pill {
    display: inline-block;
    font-size: 11px;
    font-weight: 700;
    padding: 1px 6px;
    border-radius: 4px;
    background: #f1f5f9;
    color: #0f172a;
    border: 1px solid #cbd5e1;
}

.activity-report-text {
    font-size: 12.5px;
    line-height: 1.55;
    color: #334155;
}

.logs-empty-row td {
    text-align: center;
    color: #94a3b8;
    font-style: italic;
    padding: 24px;
}`;

// 1. Update style.css and css/admin.css
for (const relPath of ["frontend/admin/style.css", "frontend/admin/css/admin.css"]) {
    const fullPath = path.join(rootDir, relPath);
    if (!fs.existsSync(fullPath)) continue;
    let content = fs.readFileSync(fullPath, "utf8");

    // Replace from .logs-filter-bar through .logs-empty-row td { ... }
    const regex = /\/\* ─── Reports & Audits ──[^\n]*\*\/[\s\S]*?\.logs-empty-row td\s*\{[\s\S]*?\}/;
    if (regex.test(content)) {
        content = content.replace(regex, cssReplacement);
        fs.writeFileSync(fullPath, content, "utf8");
        console.log(`Updated CSS in ${relPath}`);
    } else {
        console.warn(`Could not match Reports & Audits CSS block in ${relPath}`);
    }
}

// 2. Update index.html
const indexPath = path.join(rootDir, "frontend/admin/index.html");
if (fs.existsSync(indexPath)) {
    let html = fs.readFileSync(indexPath, "utf8");

    // Update reportLogsSection headers
    const oldReportTh = `                                <tr>\r\n                                    <th>Timestamp</th>\r\n                                    <th>Username</th>\r\n                                    <th>Action</th>\r\n                                    <th>Report</th>\r\n                                </tr>`;
    const oldReportThLf = `                                <tr>\n                                    <th>Timestamp</th>\n                                    <th>Username</th>\n                                    <th>Action</th>\n                                    <th>Report</th>\n                                </tr>`;
    const newReportTh = `                                <tr>\n                                    <th style="width: 145px;">Timestamp</th>\n                                    <th style="width: 120px;">User</th>\n                                    <th style="width: 180px;">Action</th>\n                                    <th>Activity Report</th>\n                                </tr>`;

    if (html.includes(oldReportTh)) {
        html = html.replace(oldReportTh, newReportTh.replace(/\n/g, "\r\n"));
    } else if (html.includes(oldReportThLf)) {
        html = html.replace(oldReportThLf, newReportTh);
    }

    // Update auditLogsSection headers
    const oldAuditTh = `                                <tr>\r\n                                    <th>Timestamp</th>\r\n                                    <th>Username</th>\r\n                                    <th>Action</th>\r\n                                    <th>Old Value</th>\r\n                                    <th>New Value</th>\r\n                                </tr>`;
    const oldAuditThLf = `                                <tr>\n                                    <th>Timestamp</th>\n                                    <th>Username</th>\n                                    <th>Action</th>\n                                    <th>Old Value</th>\n                                    <th>New Value</th>\n                                </tr>`;
    const newAuditTh = `                                <tr>\n                                    <th style="width: 145px;">Timestamp</th>\n                                    <th style="width: 120px;">User</th>\n                                    <th style="width: 220px;">Action Taken</th>\n                                    <th style="min-width: 260px;">Previous State (Before)</th>\n                                    <th style="min-width: 260px;">Updated State (After)</th>\n                                </tr>`;

    if (html.includes(oldAuditTh)) {
        html = html.replace(oldAuditTh, newAuditTh.replace(/\n/g, "\r\n"));
    } else if (html.includes(oldAuditThLf)) {
        html = html.replace(oldAuditThLf, newAuditTh);
    }

    // Bump version query
    html = html.replace(/admin\/script\.js\?v=2\.\d+/, "admin/script.js?v=2.6");

    fs.writeFileSync(indexPath, html, "utf8");
    console.log("Updated index.html");
}

// 3. Update JavaScript formatters in script.js and js/admin.js
const jsReplacement = `/* ─── Reports & Audits Formatters ────────────────────────── */

const LOG_ACTION_META = {
    // Vendor actions
    "VENDOR_DELETED": {
        label: "Vendor Deleted",
        badgeClass: "log-badge-danger",
        narrative: (user, oldObj) => {
            const vName = oldObj?.vendor_name || "";
            const vCode = oldObj?.vendor_code || (oldObj?.vendor_id ? "ID #" + oldObj.vendor_id : "");
            const details = [vCode, vName].filter(Boolean).join(" - ");
            return (user || "Admin") + " deleted this vendor" + (details ? " (" + details + ")" : "");
        }
    },
    "VENDOR_CREATED": {
        label: "Vendor Added",
        badgeClass: "log-badge-success",
        narrative: (user) => (user || "Admin") + " registered a new vendor"
    },
    "VENDOR_IMPORTED": {
        label: "Vendor Imported",
        badgeClass: "log-badge-info",
        narrative: (user) => (user || "Admin") + " imported vendor from Excel"
    },
    "VENDOR_UPDATED": {
        label: "Vendor Updated",
        badgeClass: "log-badge-info",
        narrative: (user) => (user || "Admin") + " updated vendor details"
    },
    "VENDOR_BANK_UPDATED": {
        label: "Bank Details Updated",
        badgeClass: "log-badge-warning",
        narrative: (user) => (user || "Admin") + " updated vendor bank & legal details"
    },
    "VENDOR_BLACKLISTED": {
        label: "Vendor Blacklisted",
        badgeClass: "log-badge-danger",
        narrative: (user) => (user || "Admin") + " blacklisted vendor"
    },
    "VENDOR_UNBLACKLISTED": {
        label: "Vendor Whitelisted",
        badgeClass: "log-badge-success",
        narrative: (user) => (user || "Admin") + " restored vendor from blacklist"
    },
    "VENDOR_SELECTED": {
        label: "Vendor Finalized",
        badgeClass: "log-badge-purple",
        narrative: (user) => (user || "Admin") + " selected winning vendor quotation"
    },
    "VENDOR_QUOTATION_ADDED": {
        label: "Quotation Added",
        badgeClass: "log-badge-primary",
        narrative: (user) => (user || "Admin") + " added vendor quotation"
    },
    "VENDOR_INQUIRY_CREATED": {
        label: "Inquiry Created",
        badgeClass: "log-badge-primary",
        narrative: (user) => (user || "Admin") + " created vendor inquiry"
    },

    // Purchase Order & Goods actions
    "PO_COMPLETED": {
        label: "PO Completed",
        badgeClass: "log-badge-success",
        narrative: (user) => (user || "Admin") + " marked purchase order as completed"
    },
    "GOODS_RECEIVED": {
        label: "Goods Received",
        badgeClass: "log-badge-info",
        narrative: (user) => (user || "Admin") + " recorded goods receipt"
    },
    "GOODS_RETURNED": {
        label: "Goods Returned",
        badgeClass: "log-badge-warning",
        narrative: (user) => (user || "Admin") + " recorded goods return"
    },
    "PO_ISSUED": {
        label: "PO Issued",
        badgeClass: "log-badge-primary",
        narrative: (user) => (user || "Admin") + " issued purchase order to vendor"
    },
    "PO_CREATED": {
        label: "Draft PO Created",
        badgeClass: "log-badge-neutral",
        narrative: (user) => (user || "Admin") + " generated draft purchase order"
    },
    "PO_RESELECT": {
        label: "PO Reselection",
        badgeClass: "log-badge-warning",
        narrative: (user) => (user || "Admin") + " initiated vendor re-selection"
    },
    "INQUIRY_CANCELLED": {
        label: "Inquiry Cancelled",
        badgeClass: "log-badge-danger",
        narrative: (user) => (user || "Admin") + " cancelled inquiry"
    },
    "REQUIREMENT_CANCELLED": {
        label: "Requirement Cancelled",
        badgeClass: "log-badge-danger",
        narrative: (user) => (user || "Admin") + " cancelled requirement"
    },

    // PR actions
    "PR_CREATED": {
        label: "PR Created",
        badgeClass: "log-badge-primary",
        narrative: (user) => (user || "Admin") + " created purchase requisition"
    },
    "PR_UPDATED": {
        label: "PR Updated",
        badgeClass: "log-badge-info",
        narrative: (user) => (user || "Admin") + " updated purchase requisition"
    },
    "PR_EXCEL_IMPORTED": {
        label: "Excel PRs Imported",
        badgeClass: "log-badge-info",
        narrative: (user) => (user || "Admin") + " bulk-imported PRs via Excel"
    },

    // User management actions
    "USER_CREATED": {
        label: "User Created",
        badgeClass: "log-badge-success",
        narrative: (user, oldObj, newObj) => {
            const u = newObj?.username || "";
            return (user || "Admin") + " created new user account" + (u ? ' "' + u + '"' : "");
        }
    },
    "USER_PASSWORD_CHANGED": {
        label: "Password Reset",
        badgeClass: "log-badge-warning",
        narrative: (user, oldObj, newObj) => {
            const u = newObj?.username || oldObj?.username || "";
            return (user || "Admin") + " changed password for user" + (u ? ' "' + u + '"' : "");
        }
    },
    "USER_ACCESS_REVOKED": {
        label: "Access Revoked",
        badgeClass: "log-badge-danger",
        narrative: (user, oldObj, newObj) => {
            const u = newObj?.username || oldObj?.username || "";
            return (user || "Admin") + " deactivated account" + (u ? ' for "' + u + '"' : "");
        }
    },
    "USER_ACCESS_GRANTED": {
        label: "Access Granted",
        badgeClass: "log-badge-success",
        narrative: (user, oldObj, newObj) => {
            const u = newObj?.username || oldObj?.username || "";
            return (user || "Admin") + " activated account" + (u ? ' for "' + u + '"' : "");
        }
    },
    "USER_DELETED": {
        label: "User Deleted",
        badgeClass: "log-badge-danger",
        narrative: (user, oldObj) => {
            const u = oldObj?.username || "";
            return (user || "Admin") + " deleted user account" + (u ? ' "' + u + '"' : "");
        }
    }
};

const AUDIT_FIELD_LABELS = {
    vendor_name: "Vendor Name",
    vendor_code: "Vendor Code / Number",
    vendor_id: "Vendor ID",
    legal_entity: "Legal Entity",
    commercial_role: "Commercial Role",
    year_of_incorporation: "Year of Incorporation",
    director_or_ceo_or_management_name: "Director / CEO Name",
    director_or_ceo_or_management_designation: "Director Designation",
    director_or_ceo_or_management_mobile_no: "Director Mobile",
    director_or_ceo_or_management_email: "Director Email",
    director_or_ceo_or_management_web_address: "Website",
    sales_team_name: "Sales Contact Name",
    sales_team_contact: "Sales Contact Phone",
    sales_team_email: "Sales Email",
    accounts_team_name: "Accounts Contact Name",
    accounts_team_contact: "Accounts Contact Phone",
    accounts_team_email: "Accounts Email",
    office_address: "Office Address",
    office_contact_name: "Office Contact Person",
    office_contact_number: "Office Phone",
    factory_address: "Factory Address",
    factory_contact_name: "Factory Contact Person",
    factory_contact_number: "Factory Phone",
    warehouse_address: "Warehouse Address",
    warehouse_contact_name: "Warehouse Contact Person",
    warehouse_contact_number: "Warehouse Phone",
    workshop_address: "Workshop Address",
    workshop_contact_name: "Workshop Contact Person",
    workshop_contact_number: "Workshop Phone",
    gst_number: "GST Number",
    pan_number: "PAN Number",
    msme_number: "MSME / Udyam Number",
    turnover_year_1: "Turnover Year 1",
    turnover_value_1: "Turnover Value 1",
    turnover_year_2: "Turnover Year 2",
    turnover_value_2: "Turnover Value 2",
    turnover_year_3: "Turnover Year 3",
    turnover_value_3: "Turnover Value 3",
    bank_name: "Bank Name",
    bank_account_no: "Bank Account Number",
    bank_branch: "Bank Branch",
    bank_account_type: "Account Type",
    bank_ifsc: "Bank IFSC Code",
    recommended_by: "Recommended By",
    approved_by: "Approved By",
    is_blacklisted: "Blacklisted",
    registration_date: "Registration Date",
    username: "Username",
    role: "User Role",
    is_active: "Account Status",
    password_hash: "Password",
    pr_number: "PR Number",
    pr_date: "PR Date",
    item_name: "Item Name",
    product_category: "Product Category",
    make: "Make / Brand",
    model: "Model",
    qty: "Quantity",
    unit: "Unit",
    sales_rate: "Sales Rate",
    taxable_value: "Taxable Value",
    party_name: "Party Name",
    location: "Location",
    territory: "Territory",
    product_remarks: "Remarks"
};

function tryParseJson(str) {
    if (!str || typeof str !== "string") return null;
    const trimmed = str.trim();
    if (!((trimmed.startsWith("{") && trimmed.endsWith("}")) || (trimmed.startsWith("[") && trimmed.endsWith("]")))) {
        return null;
    }
    try {
        return JSON.parse(str);
    } catch {
        return null;
    }
}

function formatAuditFieldValue(key, val) {
    if (val === null || val === undefined || val === "") return \`<span class="audit-empty-val">— None</span>\`;
    if (typeof val === "boolean") {
        return val ? \`<span class="audit-pill-success">Active / Yes</span>\` : \`<span class="audit-pill-danger">Inactive / No</span>\`;
    }
    if (key === "is_active") {
        return val ? \`<span class="audit-pill-success">Active</span>\` : \`<span class="audit-pill-danger">Disabled</span>\`;
    }
    if (key === "is_blacklisted") {
        return Number(val) === 1 ? \`<span class="audit-pill-danger">Blacklisted</span>\` : \`<span class="audit-pill-success">Not Blacklisted</span>\`;
    }
    if (key === "password_hash") {
        return \`<span class="audit-pill-warning">Encrypted</span>\`;
    }
    if (key.includes("date") && typeof val === "string" && val.includes("T")) {
        return escapeHtml(val.split("T")[0]);
    }
    if ((key.includes("rate") || key.includes("taxable_value") || key.includes("turnover_value")) && !isNaN(Number(val))) {
        return "₹" + Number(val).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    return escapeHtml(String(val));
}

function formatAuditAction(action, username, oldObj, newObj) {
    const meta = LOG_ACTION_META[action] || {
        label: (action || "").replace(/_/g, " ").replace(/\\b\\w/g, c => c.toUpperCase()),
        badgeClass: "log-badge-neutral",
        narrative: (u) => (u || "Admin") + " performed " + action
    };

    const narrativeText = meta.narrative ? meta.narrative(username, oldObj, newObj) : "";

    return \`
        <div class="log-action-wrap">
            <span class="log-badge \${meta.badgeClass}">\${escapeHtml(meta.label)}</span>
            \${narrativeText ? \`<div class="log-action-subtext">\${escapeHtml(narrativeText)}</div>\` : ""}
        </div>
    \`;
}

function formatAuditCell(rawVal, side, action, username, oldObj, newObj) {
    if (!rawVal || rawVal === "-" || rawVal === "null") {
        if (side === "old") {
            return \`<div class="audit-muted-box">— None (New Entry)</div>\`;
        } else {
            if (action === "VENDOR_DELETED") {
                return \`
                    <div class="audit-deleted-state">
                        <span class="audit-pill-danger">Removed</span>
                        <span>Vendor permanently deleted from system</span>
                    </div>
                \`;
            }
            if (action === "USER_DELETED") {
                return \`
                    <div class="audit-deleted-state">
                        <span class="audit-pill-danger">Deleted</span>
                        <span>User account deleted & purged</span>
                    </div>
                \`;
            }
            return \`<div class="audit-muted-box">— None (Record Removed)</div>\`;
        }
    }

    const obj = tryParseJson(rawVal);
    if (!obj || typeof obj !== "object") {
        return \`<div class="audit-plain-text">\${escapeHtml(String(rawVal))}</div>\`;
    }

    // Special handling for VENDOR_DELETED
    if (action === "VENDOR_DELETED" && side === "old") {
        const vCode = obj.vendor_code || (obj.vendor_id ? "ID #" + obj.vendor_id : "");
        return \`
            <div class="audit-card audit-card-danger">
                <div class="audit-card-header">
                    <span class="audit-card-title">\${escapeHtml(obj.vendor_name || "Deleted Vendor")}</span>
                    \${vCode ? \`<span class="audit-card-code">\${escapeHtml(vCode)}</span>\` : ""}
                </div>
                <div class="audit-card-body">
                    \${obj.legal_entity ? \`<div class="audit-field"><span class="audit-label">Entity:</span><span class="audit-val">\${escapeHtml(obj.legal_entity)}</span></div>\` : ""}
                    \${obj.commercial_role ? \`<div class="audit-field"><span class="audit-label">Role:</span><span class="audit-val">\${escapeHtml(obj.commercial_role)}</span></div>\` : ""}
                    \${obj.director_or_ceo_or_management_name ? \`<div class="audit-field"><span class="audit-label">Director:</span><span class="audit-val">\${escapeHtml(obj.director_or_ceo_or_management_name)}\${obj.director_or_ceo_or_management_mobile_no ? " (" + escapeHtml(obj.director_or_ceo_or_management_mobile_no) + ")" : ""}</span></div>\` : ""}
                    \${obj.office_address ? \`<div class="audit-field"><span class="audit-label">Address:</span><span class="audit-val">\${escapeHtml(obj.office_address)}</span></div>\` : ""}
                    \${obj.gst_number ? \`<div class="audit-field"><span class="audit-label">GST / PAN:</span><span class="audit-val">\${escapeHtml(obj.gst_number)}\${obj.pan_number ? " / " + escapeHtml(obj.pan_number) : ""}</span></div>\` : ""}
                    \${obj.bank_name ? \`<div class="audit-field"><span class="audit-label">Bank:</span><span class="audit-val">\${escapeHtml(obj.bank_name)} (A/C: \${escapeHtml(obj.bank_account_no || "")}, IFSC: \${escapeHtml(obj.bank_ifsc || "")})</span></div>\` : ""}
                </div>
                <details class="audit-raw-details">
                    <summary>View raw JSON</summary>
                    <pre>\${escapeHtml(JSON.stringify(obj, null, 2))}</pre>
                </details>
            </div>
        \`;
    }

    // Special handling for USER_CREATED
    if (action === "USER_CREATED" && side === "new") {
        return \`
            <div class="audit-card audit-card-success">
                <div class="audit-card-header">
                    <span class="audit-card-title">User: \${escapeHtml(obj.username || "")}</span>
                    <span class="audit-pill-success">Active</span>
                </div>
                <div class="audit-card-body">
                    <div class="audit-field"><span class="audit-label">Role:</span><span class="audit-val"><strong>\${escapeHtml(obj.role || "")}</strong></span></div>
                    <div class="audit-field"><span class="audit-label">User ID:</span><span class="audit-val">#\${escapeHtml(String(obj.user_id || ""))}</span></div>
                </div>
            </div>
        \`;
    }

    // Special handling for USER_DELETED
    if (action === "USER_DELETED" && side === "old") {
        return \`
            <div class="audit-card audit-card-danger">
                <div class="audit-card-header">
                    <span class="audit-card-title">User: \${escapeHtml(obj.username || "")}</span>
                    <span class="audit-pill-danger">Deleted</span>
                </div>
                <div class="audit-card-body">
                    <div class="audit-field"><span class="audit-label">Role:</span><span class="audit-val">\${escapeHtml(obj.role || "")}</span></div>
                    <div class="audit-field"><span class="audit-label">User ID:</span><span class="audit-val">#\${escapeHtml(String(obj.user_id || ""))}</span></div>
                    <div class="audit-field"><span class="audit-label">Status Before:</span><span class="audit-val">\${obj.is_active ? "Active" : "Inactive"}</span></div>
                </div>
            </div>
        \`;
    }

    // Special handling for USER_PASSWORD_CHANGED
    if (action === "USER_PASSWORD_CHANGED") {
        if (side === "old") {
            return \`
                <div class="audit-state-info">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                    <span>Previous encrypted password</span>
                </div>
            \`;
        } else {
            return \`
                <div class="audit-state-info">
                    <span class="audit-pill-warning">Password Reset</span>
                    <span>New password saved & encrypted</span>
                </div>
            \`;
        }
    }

    // Special handling for USER_ACCESS_REVOKED
    if (action === "USER_ACCESS_REVOKED") {
        if (side === "old") {
            return \`<div class="audit-field"><span class="audit-label">Status Before:</span> <span class="audit-pill-success">Active</span></div>\`;
        } else {
            return \`
                <div class="audit-state-revoked">
                    <span class="audit-pill-danger">Access Revoked</span>
                    <span>Account deactivated (cannot log in)</span>
                </div>
            \`;
        }
    }

    // Special handling for USER_ACCESS_GRANTED
    if (action === "USER_ACCESS_GRANTED") {
        if (side === "old") {
            return \`<div class="audit-field"><span class="audit-label">Status Before:</span> <span class="audit-pill-danger">Inactive</span></div>\`;
        } else {
            return \`
                <div class="audit-state-granted">
                    <span class="audit-pill-success">Access Granted</span>
                    <span>Account activated (login enabled)</span>
                </div>
            \`;
        }
    }

    // General object or diff
    const entries = Object.entries(obj).filter(([k]) => !["created_at", "updated_at"].includes(k));
    if (!entries.length) {
        return \`<div class="audit-muted-box">— No modified fields</div>\`;
    }

    const fieldRows = entries.map(([key, val]) => {
        const label = AUDIT_FIELD_LABELS[key] || key.replace(/_/g, " ").replace(/\\b\\w/g, c => c.toUpperCase());
        const formattedVal = formatAuditFieldValue(key, val);
        const diffClass = side === "old" ? "audit-diff-old-val" : "audit-diff-new-val";
        return \`
            <div class="audit-diff-item">
                <span class="audit-diff-label">\${escapeHtml(label)}:</span>
                <span class="\${diffClass}">\${formattedVal}</span>
            </div>
        \`;
    }).join("");

    return \`
        <div class="audit-card \${side === 'old' ? 'audit-card-old' : 'audit-card-new'}">
            <div class="audit-card-body">
                \${fieldRows}
            </div>
            <details class="audit-raw-details">
                <summary>View raw JSON</summary>
                <pre>\${escapeHtml(JSON.stringify(obj, null, 2))}</pre>
            </details>
        </div>
    \`;
}

function formatReportText(row) {
    const raw = row.report || "";
    const user = row.username || "Admin";

    // Specialize VENDOR_DELETED
    if (row.action === "VENDOR_DELETED") {
        const match = raw.match(/Vendor "([^"]+)" \\(([^,]+),\\s*vendor ID (\\d+)\\) was deleted/i) ||
                      raw.match(/(?:Admin|admin|[A-Za-z0-9_]+) deleted vendor "([^"]+)" \\(Vendor (?:Code|Number): ([^,]+),\\s*ID: (\\d+)\\)/i);
        if (match) {
            const vName = match[1];
            const vCode = match[2];
            return \`
                <div class="activity-report-lead">
                    <span class="activity-actor">\${escapeHtml(user)}</span> deleted vendor
                    <strong class="report-entity">"\${escapeHtml(vName)}"</strong>
                    <span class="report-meta">(Vendor Number: <code class="report-code-badge">\${escapeHtml(vCode)}</code>)</span>
                </div>
            \`;
        }
        return \`
            <div class="activity-report-lead">
                <span class="activity-actor">\${escapeHtml(user)}</span> deleted vendor: \${escapeHtml(raw)}
            </div>
        \`;
    }

    // Specialize USER_DELETED
    if (row.action === "USER_DELETED") {
        const match = raw.match(/User deleted\\. Username: "([^"]+)", Role: ([^,]+), User ID: (\\d+)\\./i) ||
                      raw.match(/(?:Admin|admin|[A-Za-z0-9_]+) deleted user account "([^"]+)" \\(Role: ([^,]+),\\s*ID: (\\d+)\\)/i);
        if (match) {
            return \`
                <div class="activity-report-lead">
                    <span class="activity-actor">\${escapeHtml(user)}</span> deleted user account
                    <strong class="report-entity">"\${escapeHtml(match[1])}"</strong>
                    <span class="report-meta">(Role: <strong>\${escapeHtml(match[2])}</strong>, ID: #\${escapeHtml(match[3])})</span>
                </div>
            \`;
        }
    }

    // Specialize USER_CREATED
    if (row.action === "USER_CREATED") {
        const match = raw.match(/New user created\\. Username: "([^"]+)", Role: ([^,]+), User ID: (\\d+)\\./i);
        if (match) {
            return \`
                <div class="activity-report-lead">
                    <span class="activity-actor">\${escapeHtml(user)}</span> created user account
                    <strong class="report-entity">"\${escapeHtml(match[1])}"</strong>
                    <span class="report-meta">(Role: <strong>\${escapeHtml(match[2])}</strong>, ID: #\${escapeHtml(match[3])})</span>
                </div>
            \`;
        }
    }

    // Specialize USER_PASSWORD_CHANGED
    if (row.action === "USER_PASSWORD_CHANGED") {
        const match = raw.match(/Password changed for user ID (\\d+)\\. Username: "([^"]+)", Role: ([^.]+)\\./i);
        if (match) {
            return \`
                <div class="activity-report-lead">
                    <span class="activity-actor">\${escapeHtml(user)}</span> reset password for user
                    <strong class="report-entity">"\${escapeHtml(match[2])}"</strong>
                    <span class="report-meta">(Role: <strong>\${escapeHtml(match[3])}</strong>)</span>
                </div>
            \`;
        }
    }

    // Specialize USER_ACCESS_REVOKED / USER_ACCESS_GRANTED
    if (row.action === "USER_ACCESS_REVOKED" || row.action === "USER_ACCESS_GRANTED") {
        const match = raw.match(/User access changed\\. User ID: (\\d+), Username: "([^"]+)", Role: ([^,]+)/i);
        const isRevoked = row.action === "USER_ACCESS_REVOKED";
        if (match) {
            return \`
                <div class="activity-report-lead">
                    <span class="activity-actor">\${escapeHtml(user)}</span> \${isRevoked ? "revoked access for" : "granted access to"} user
                    <strong class="report-entity">"\${escapeHtml(match[2])}"</strong>
                    <span class="report-meta">(\${isRevoked ? '<span class="audit-pill-danger">Deactivated</span>' : '<span class="audit-pill-success">Activated</span>'})</span>
                </div>
            \`;
        }
    }

    // General procurement report formatting
    let formatted = escapeHtml(raw);

    // Highlight quoted vendor or entity names
    formatted = formatted.replace(/"([^"]+)"/g, '<strong class="report-entity">"$1"</strong>');

    // Highlight PO and PR numbers
    formatted = formatted.replace(/\\b(NEE\\/[\\w\\-\\/]+)\\b/g, '<span class="report-ref-badge">$1</span>');

    // Highlight vendor codes
    formatted = formatted.replace(/\\b((?:NEE2627V|DEL_)\\w+)\\b/g, '<code class="report-code-badge">$1</code>');

    // Highlight money amounts
    formatted = formatted.replace(/(PO value:\\s*)([\\d,]+\\.\\d{2})/g, '$1<strong class="report-amount">₹$2</strong>');
    formatted = formatted.replace(/(sales rate\\s*)([\\d,]+\\.\\d{2})/g, '$1<strong class="report-amount">₹$2</strong>');
    formatted = formatted.replace(/(taxable value\\s*)([\\d,]+\\.\\d{2})/g, '$1<strong class="report-amount">₹$2</strong>');

    // Highlight status transitions
    formatted = formatted.replace(/\\b(COMPLETED|ISSUED|DRAFT|VENDOR_SELECTED|OPEN|CANCELLED)\\b/g, '<span class="report-status-pill">$1</span>');

    return \`<div class="activity-report-text">\${formatted}</div>\`;
}

function renderReportLogs(rows) {
    if (!rows.length) {
        reportLogsBody.innerHTML = \`<tr class="logs-empty-row"><td colspan="4">No report logs found</td></tr>\`;
        return;
    }

    reportLogsBody.innerHTML = rows.map(row => {
        const meta = LOG_ACTION_META[row.action] || {
            label: (row.action || "").replace(/_/g, " ").replace(/\\b\\w/g, c => c.toUpperCase()),
            badgeClass: "log-badge-neutral"
        };

        return \`
            <tr>
                <td style="white-space: nowrap; font-size: 12.5px; color: #64748b;">\${formatDateTime(row.log_timestamp)}</td>
                <td>
                    <div class="user-pill">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                        <span>\${escapeHtml(row.username || "System")}</span>
                    </div>
                </td>
                <td>
                    <span class="log-badge \${meta.badgeClass}">\${escapeHtml(meta.label)}</span>
                </td>
                <td class="logs-report-cell">\${formatReportText(row)}</td>
            </tr>
        \`;
    }).join("");
}

function renderAuditLogs(rows) {
    if (!rows.length) {
        auditLogsBody.innerHTML = \`<tr class="logs-empty-row"><td colspan="5">No audit logs found</td></tr>\`;
        return;
    }

    auditLogsBody.innerHTML = rows.map(row => {
        const oldObj = tryParseJson(row.old_value);
        const newObj = tryParseJson(row.new_value);

        return \`
            <tr>
                <td style="white-space: nowrap; font-size: 12.5px; color: #64748b; vertical-align: top; padding-top: 14px;">\${formatDateTime(row.log_timestamp)}</td>
                <td style="vertical-align: top; padding-top: 14px;">
                    <div class="user-pill">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                        <span>\${escapeHtml(row.username || "System")}</span>
                    </div>
                </td>
                <td style="vertical-align: top; padding-top: 14px;">
                    \${formatAuditAction(row.action, row.username, oldObj, newObj)}
                </td>
                <td class="logs-value-cell audit-old-cell">\${formatAuditCell(row.old_value, "old", row.action, row.username, oldObj, newObj)}</td>
                <td class="logs-value-cell audit-new-cell">\${formatAuditCell(row.new_value, "new", row.action, row.username, oldObj, newObj)}</td>
            </tr>
        \`;
    }).join("");
}

function renderLoginLogs(rows) {
    if (!rows.length) {
        loginLogsBody.innerHTML = \`<tr class="logs-empty-row"><td colspan="3">No access logs found</td></tr>\`;
        return;
    }

    loginLogsBody.innerHTML = rows.map(row => \`
        <tr>
            <td style="white-space: nowrap; font-size: 12.5px; color: #64748b;">\${formatDateTime(row.login_time)}</td>
            <td>
                <div class="user-pill">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                    <span>\${escapeHtml(row.username || "System")}</span>
                </div>
            </td>
            <td>
                <span class="\${row.login_status === "SUCCESS" ? "access-granted" : "access-revoked"}">
                    \${escapeHtml(row.login_status)}
                </span>
            </td>
        </tr>
    \`).join("");
}`;

for (const relJs of ["frontend/admin/script.js", "frontend/admin/js/admin.js"]) {
    const fullJsPath = path.join(rootDir, relJs);
    if (!fs.existsSync(fullJsPath)) continue;
    let jsCode = fs.readFileSync(fullJsPath, "utf8");

    // Replace renderReportLogs through renderLoginLogs
    const regexJs = /function renderReportLogs\(rows\)\s*\{[\s\S]*?function renderLoginLogs\(rows\)\s*\{[\s\S]*?^\}/m;
    if (regexJs.test(jsCode)) {
        jsCode = jsCode.replace(regexJs, jsReplacement);
        fs.writeFileSync(fullJsPath, jsCode, "utf8");
        console.log(`Updated JS formatters in ${relJs}`);
    } else {
        console.warn(`Could not match renderReportLogs block in ${relJs}`);
    }
}

console.log("All updates completed successfully!");
