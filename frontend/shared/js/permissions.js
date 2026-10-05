/**
 * Shared Client Permissions Checker
 */

const ROLE_PERMISSIONS = {
    ADMIN: ["ALL"],
    PROCUREMENT_MANAGER: ["PR_VIEW", "PR_APPROVE", "RFQ_MANAGE", "PO_ISSUE", "INVENTORY_VIEW"],
    PROCUREMENT: ["PR_CREATE", "PR_VIEW", "RFQ_CREATE", "QUOTATION_SUBMIT", "GRN_CREATE"]
};

function hasPermission(role, permission) {
    if (!role) return false;
    if (role === "ADMIN") return true;
    const perms = ROLE_PERMISSIONS[role] || [];
    return perms.includes(permission);
}
