const { log } = require("../utils/logger");

function requireAuth(req, res, next) {
    if (!req.session || !req.session.user) {
        log("Unauthorized access attempt - No active session");
        if (req.xhr || req.headers.accept?.includes("json") || req.path.startsWith("/api/")) {
            return res.status(401).json({ success: false, message: "Unauthorized: Please log in" });
        }
        return res.redirect("/");
    }
    next();
}

function requireRole(...allowedRoles) {
    return (req, res, next) => {
        if (!req.session || !req.session.user) {
            log("Access denied - User not authenticated");
            if (req.xhr || req.headers.accept?.includes("json")) {
                return res.status(401).json({ success: false, message: "Please log in to continue" });
            }
            return res.redirect("/");
        }

        const userRole = req.session.user.role;
        if (!allowedRoles.includes(userRole)) {
            log(`Access forbidden - User role '${userRole}' not authorized. Allowed: ${allowedRoles.join(", ")}`);
            return res.status(403).json({ success: false, message: "Forbidden: You do not have permission to perform this action" });
        }

        next();
    };
}

const verifyAdmin = requireRole("ADMIN");
const verifyManager = requireRole("ADMIN", "PROCUREMENT_MANAGER");
const verifyProcurement = requireRole("ADMIN", "PROCUREMENT_MANAGER", "PROCUREMENT");

module.exports = {
    requireAuth,
    requireRole,
    verifyAdmin,
    verifyManager,
    verifyProcurement
};
