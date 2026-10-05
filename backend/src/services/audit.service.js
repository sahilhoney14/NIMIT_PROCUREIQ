const { logDb } = require("../config/db");
const { log } = require("../utils/logger");

async function getActor(req) {
    return req.session?.user?.username || "SYSTEM";
}

async function writeReportLog(req, action, report) {
    try {
        const username = await getActor(req);
        await logDb.execute(
            `INSERT INTO report_logs (username, action, report) VALUES (?, ?, ?)`,
            [String(username).slice(0, 100), String(action).slice(0, 100), String(report)]
        );
    } catch (error) {
        log(`ERROR writing report log (${action}): ${error.message}`);
    }
}

async function writeAuditLog(req, action, oldValue, newValue) {
    try {
        const username = await getActor(req);
        await logDb.execute(
            `INSERT INTO audit_logs (username, action, old_value, new_value) VALUES (?, ?, ?, ?)`,
            [String(username).slice(0, 100), String(action).slice(0, 100), oldValue ?? null, newValue ?? null]
        );
    } catch (error) {
        log(`ERROR writing audit log (${action}): ${error.message}`);
    }
}

function money(value) {
    return Number(value || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function orDash(value) {
    if (value === null || value === undefined) return "-";
    const text = String(value).trim();
    return text === "" ? "-" : text;
}

function dateText(value) {
    if (!value) return "-";
    if (value instanceof Date) return value.toISOString().split("T")[0];
    return String(value).split("T")[0];
}

function describePr(pr) {
    return `PR ${pr.pr_number} dated ${dateText(pr.pr_date)} for party "${orDash(pr.party_name)}" ` +
        `(location: ${orDash(pr.location)}, territory: ${orDash(pr.territory)}). ` +
        `Product: ${orDash(pr.item_name)} [category: ${orDash(pr.product_category)}], make: ${orDash(pr.make)}, model: ${orDash(pr.model)}. ` +
        `Quantity: ${Number(pr.qty || 0)} ${orDash(pr.unit)} at sales rate ${money(pr.sales_rate)}, taxable value ${money(pr.taxable_value)}. ` +
        `Remarks: ${orDash(pr.product_remarks)}.`;
}

function describePayment(q) {
    let text = `Payment type: ${orDash(q.payment_type)}`;
    if (q.advance_type) text += `, advance: ${q.advance_value} (${q.advance_type})`;
    if (q.balance_due_days) text += `, balance due in ${q.balance_due_days} days`;
    if (q.payment_terms_remarks) text += `, terms: ${q.payment_terms_remarks}`;
    return text;
}

module.exports = {
    getActor,
    writeReportLog,
    writeAuditLog,
    money,
    orDash,
    dateText,
    describePr,
    describePayment
};
