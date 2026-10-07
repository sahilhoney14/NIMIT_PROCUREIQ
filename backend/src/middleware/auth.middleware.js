const { log } = require("../utils/logger");
const { resolveAuthUser } = require("../services/jwt.service");

function requireAuth(req, res, next) {
    const authUser = resolveAuthUser(req);
    if (!authUser) {
        log("Unauthorized access attempt - No active authentication");
        if (req.xhr || req.headers.accept?.includes("json") || req.path.startsWith("/api/")) {
            return res.status(401).json({ success: false, message: "Unauthorized: Please log in" });
        }
        return res.redirect("/");
    }
    req.user = authUser;
    next();
}

function requireRole(...allowedRoles) {
    return (req, res, next) => {
        const authUser = resolveAuthUser(req);
        if (!authUser) {
            log("Access denied - User not authenticated");
            if (req.xhr || req.headers.accept?.includes("json") || req.path.startsWith("/api/")) {
                return res.status(401).json({ success: false, message: "Please log in to continue" });
            }
            return res.redirect("/");
        }

        req.user = authUser;
        const userRole = authUser.role;
        if (!allowedRoles.includes(userRole)) {
            log(`Access forbidden - User role '${userRole}' not authorized. Allowed: ${allowedRoles.join(", ")}`);
            if (req.xhr || req.headers.accept?.includes("json") || req.path.startsWith("/api/")) {
                return res.status(403).json({ success: false, message: "Forbidden: You do not have permission to perform this action" });
            }
            if (userRole === "ADMIN") return res.redirect("/admin");
            if (userRole === "PROCUREMENT_MANAGER") return res.redirect("/procurement-manager");
            if (userRole === "PROCUREMENT") return res.redirect("/procurement");
            return res.redirect("/");
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

