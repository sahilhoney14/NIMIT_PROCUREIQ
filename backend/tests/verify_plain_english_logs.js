const assert = require("assert");
const http = require("http");
const { logDb } = require("../src/config/db");

// Load the formatters directly from frontend/admin/script.js to test real code
const fs = require("fs");
const path = require("path");
const scriptContent = fs.readFileSync(path.resolve(__dirname, "../../frontend/admin/script.js"), "utf8");

// Extract format functions using Function or eval in a clean context
function escapeHtml(str) {
    if (str === null || str === undefined) return "";
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function formatDateTime(val) {
    if (!val) return "-";
    const d = new Date(val);
    return isNaN(d.getTime()) ? String(val) : d.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
}

// Evaluate formatting functions in isolated context
const sandbox = {
    escapeHtml,
    formatDateTime
};

const fnDefinitions = scriptContent.slice(
    scriptContent.indexOf("/* ─── Reports & Audits Formatters ──"),
    scriptContent.indexOf("function renderLoginLogs")
);

const evaluateCode = `
${fnDefinitions}
return {
    LOG_ACTION_META,
    AUDIT_FIELD_LABELS,
    tryParseJson,
    formatAuditFieldValue,
    formatAuditAction,
    formatAuditCell,
    formatReportText,
    renderReportLogs,
    renderAuditLogs
};
`;

const formatters = new Function("escapeHtml", "formatDateTime", evaluateCode)(escapeHtml, formatDateTime);

console.log("Successfully loaded frontend formatters from script.js!\n");

(async () => {
    try {
        console.log("=== 1. TESTING CHANGE LOG (AUDIT LOGS) FORMATTING ===");

        // Fetch sample audit rows from DB
        const [auditRows] = await logDb.execute(
            "SELECT * FROM audit_logs WHERE action IN ('VENDOR_DELETED', 'USER_PASSWORD_CHANGED', 'USER_ACCESS_REVOKED', 'VENDOR_UPDATED') ORDER BY audit_log_id DESC LIMIT 10"
        );

        console.log(`Found ${auditRows.length} audit sample rows.`);

        for (const row of auditRows) {
            console.log(`\n--- Action: ${row.action} (Audit ID: ${row.audit_log_id}) ---`);
            const oldObj = formatters.tryParseJson(row.old_value);
            const newObj = formatters.tryParseJson(row.new_value);

            const actionHtml = formatters.formatAuditAction(row.action, row.username, oldObj, newObj);
            const oldHtml = formatters.formatAuditCell(row.old_value, "old", row.action, row.username, oldObj, newObj);
            const newHtml = formatters.formatAuditCell(row.new_value, "new", row.action, row.username, oldObj, newObj);

            // Assert action badge is present
            assert(actionHtml.includes("log-badge"), "Action badge must be present");

            if (row.action === "VENDOR_DELETED") {
                assert(actionHtml.includes("deleted this vendor"), "Vendor deletion must have narrative 'deleted this vendor'");
                assert(oldHtml.includes("audit-card-danger"), "Old value must be rendered as an audit card");
                assert(oldHtml.includes("Entity:"), "Old value must display Entity label");
                assert(newHtml.includes("Removed"), "New value must display Removed badge");
                assert(newHtml.includes("Vendor permanently deleted from system"), "New value must state vendor was permanently deleted");
                console.log("✔ VENDOR_DELETED: Formatted into structured card + English deletion statement!");
            }

            if (row.action === "USER_PASSWORD_CHANGED") {
                assert(actionHtml.includes("Password Reset") || actionHtml.includes("changed password"), "Password change narrative verified");
                assert(newHtml.includes("New password saved & encrypted") || newHtml.includes("Password Reset"), "New password statement verified");
                console.log("✔ USER_PASSWORD_CHANGED: Formatted into password reset pill and status!");
            }

            if (row.action === "USER_ACCESS_REVOKED") {
                assert(actionHtml.includes("deactivated account") || actionHtml.includes("Access Revoked"), "Access revoked narrative verified");
                assert(newHtml.includes("Account deactivated (cannot log in)"), "Deactivated status verified");
                console.log("✔ USER_ACCESS_REVOKED: Formatted into clear account deactivation status!");
            }

            if (row.action === "VENDOR_UPDATED") {
                assert(oldHtml.includes("audit-diff-item"), "Diff items must be rendered for vendor update");
                assert(newHtml.includes("audit-diff-item"), "New values must be rendered as diff items");
                console.log("✔ VENDOR_UPDATED: Formatted into clean field diffs with readable labels!");
            }
        }

        console.log("\n=== 2. TESTING ACTIVITY LOG (REPORT LOGS) FORMATTING ===");

        // Fetch sample report rows
        const [reportRows] = await logDb.execute(
            "SELECT * FROM report_logs WHERE action IN ('VENDOR_DELETED', 'PO_COMPLETED', 'GOODS_RECEIVED', 'PO_ISSUED') ORDER BY report_log_id DESC LIMIT 10"
        );

        console.log(`Found ${reportRows.length} report sample rows.`);

        for (const row of reportRows) {
            console.log(`\n--- Action: ${row.action} (Report ID: ${row.report_log_id}) ---`);
            const formatted = formatters.formatReportText(row);

            if (row.action === "VENDOR_DELETED") {
                assert(formatted.includes("deleted vendor"), "Must state actor deleted vendor");
                assert(formatted.includes("Vendor Number:"), "Must state Vendor Number");
                console.log("✔ VENDOR_DELETED Report:", formatted.trim());
            }

            if (row.action === "PO_COMPLETED") {
                assert(formatted.includes("report-ref-badge") || formatted.includes("COMPLETED"), "PO reference or status badge highlighted");
                console.log("✔ PO_COMPLETED Report:", formatted.trim());
            }
        }

        console.log("\n=======================================================");
        console.log("ALL TESTS PASSED! Plain English formatting verified.");
        console.log("=======================================================");
        process.exit(0);

    } catch (err) {
        console.error("Test failed:", err);
        process.exit(1);
    }
})();
