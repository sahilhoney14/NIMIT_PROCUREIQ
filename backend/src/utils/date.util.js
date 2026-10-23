/**
 * ProcureIQ Backend Date & Formatting Utilities
 * Standardized date validation, conversion, and currency helpers.
 */

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Validates that a string is a valid calendar date in YYYY-MM-DD format.
 */
function isRealDate(str) {
    if (!str || typeof str !== "string" || !DATE_RE.test(str.trim())) return false;
    const [y, m, d] = str.trim().split("-").map(Number);
    const dt = new Date(y, m - 1, d);
    return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d;
}

/**
 * Cleans and converts input date strings (DD/MM/YYYY or YYYY-MM-DD) into YYYY-MM-DD
 */
function cleanDate(value) {
    if (!value) return null;
    if (value instanceof Date) return value.toISOString().split("T")[0];
    const text = String(value).trim();
    if (text === "" || text === "-") return null;
    if (isRealDate(text)) return text;
    const match = text.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
    if (match) {
        const candidate = `${match[3]}-${match[2].padStart(2, "0")}-${match[1].padStart(2, "0")}`;
        return isRealDate(candidate) ? candidate : null;
    }
    return null;
}

/**
 * Formats a number as Indian Currency string
 */
function money(val) {
    return Number(val || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function orDash(val) {
    if (val === null || val === undefined) return "-";
    const text = String(val).trim();
    return text === "" ? "-" : text;
}

module.exports = {
    isRealDate,
    cleanDate,
    money,
    orDash
};
