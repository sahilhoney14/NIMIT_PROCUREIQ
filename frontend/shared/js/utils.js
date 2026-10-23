/**
 * ProcureIQ Enterprise Shared Client Utilities
 * Shared across Admin and Procurement portals.
 */

// Global namespace guard
window.ProcureIQUtils = window.ProcureIQUtils || {};

/**
 * Encodes special characters to prevent DOM-based XSS attacks
 */
function escapeHtml(str) {
    if (str === null || str === undefined) return "";
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

/**
 * Formats a numeric value into standard Indian Currency (₹ 1,23,456.00)
 */
function formatRupee(amount, decimals = 2) {
    if (amount === null || amount === undefined || isNaN(amount)) return "₹ 0.00";
    return Number(amount).toLocaleString("en-IN", {
        style: "currency",
        currency: "INR",
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
    });
}

function formatCurrency(amount) {
    return formatRupee(amount);
}

/**
 * Formats a Date or ISO string to Indian standard DD/MM/YYYY
 */
function formatDate(value) {
    if (!value) return "-";
    if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)) {
        const [y, m, d] = value.slice(0, 10).split("-");
        return `${d}/${m}/${y}`;
    }
    const d = new Date(value);
    if (isNaN(d.getTime())) return String(value);
    return d.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric"
    });
}

/**
 * Formats a Date or ISO string to standard DD MMM YYYY, hh:mm A
 */
function formatDateTime(dateStr) {
    if (!dateStr) return "-";
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return String(dateStr);
    return d.toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true
    });
}

/**
 * Debounce a callback function for search inputs and dynamic filters
 */
function debounce(func, delay = 300) {
    let timeoutId;
    return function (...args) {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => func.apply(this, args), delay);
    };
}

/**
 * Standard status badge generator mapping status codes to component classes
 */
function renderStatusBadge(status) {
    const raw = String(status || "").trim().toUpperCase();
    let badgeClass = "c-badge-slate";
    let label = raw;

    switch (raw) {
        case "COMPLETED":
        case "CLOSED":
        case "ISSUED":
        case "ACTIVE":
            badgeClass = "c-badge-green";
            break;
        case "OPEN":
        case "VENDOR_SELECTED":
        case "PENDING":
        case "IN_REVIEW":
            badgeClass = "c-badge-blue";
            break;
        case "DRAFT":
        case "AWAITING_QUOTES":
            badgeClass = "c-badge-amber";
            break;
        case "CANCELLED":
        case "REJECTED":
        case "INACTIVE":
        case "BLACKLISTED":
            badgeClass = "c-badge-red";
            break;
    }

    return `<span class="c-badge ${badgeClass}">${escapeHtml(label || "UNKNOWN")}</span>`;
}

/**
 * Returns a styled empty state table row
 */
function renderEmptyRow(colspan, message = "No matching records found") {
    return `<tr><td colspan="${colspan}" style="text-align:center; padding: 36px 16px; color: var(--text-muted); font-size: 13.5px;"><div style="font-weight: 500;">${escapeHtml(message)}</div></td></tr>`;
}

/**
 * Safely downloads an in-memory blob (e.g. generated PDF or Excel workbook)
 */
function downloadBlob(blob, filename) {
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
}

// Attach to namespace
window.ProcureIQUtils = {
    escapeHtml,
    formatRupee,
    formatCurrency,
    formatDate,
    formatDateTime,
    debounce,
    renderStatusBadge,
    renderEmptyRow,
    downloadBlob
};
