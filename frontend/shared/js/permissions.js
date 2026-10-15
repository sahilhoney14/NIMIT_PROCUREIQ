/**
 * Shared Client Permissions Checker
 */

const ROLE_PERMISSIONS = {
    ADMIN: ["ALL"],
    PROCUREMENT: ["PR_CREATE", "PR_VIEW", "PR_APPROVE", "RFQ_CREATE", "RFQ_MANAGE", "QUOTATION_SUBMIT", "PO_ISSUE", "GRN_CREATE", "INVENTORY_VIEW"]
};

function hasPermission(role, permission) {
    if (!role) return false;
    if (role === "ADMIN") return true;
    const perms = ROLE_PERMISSIONS[role] || [];
    return perms.includes(permission);
}
