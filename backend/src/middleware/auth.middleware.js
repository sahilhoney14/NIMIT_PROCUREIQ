const { log } = require("../utils/logger");
const { resolveAuthUser } = require("../services/jwt.service");

function isDashboardPageRequest(req) {
    const p = (req.path || "").replace(/\/+$/, "") || "/";
    const acceptsHtml = req.headers.accept?.includes("text/html");
    return acceptsHtml && (p === "/admin" || p === "/procurement-manager" || p === "/procurement");
}

async function requireAuth(req, res, next) {
    try {
        const authUser = await resolveAuthUser(req);
        if (!authUser) {
            log("Unauthorized access attempt - No active authentication");
            if (!isDashboardPageRequest(req)) {
                return res.status(401).json({ success: false, message: "Unauthorized: Please log in" });
            }
            return res.redirect("/?reason=unauthenticated");
        }
        req.user = authUser;
        next();
    } catch (err) {
        log(`requireAuth error: ${err.message}`);
        return res.status(500).json({ success: false, message: "Authentication error" });
    }
}

function requireRole(...allowedRoles) {
    return async (req, res, next) => {
        try {
            const authUser = await resolveAuthUser(req);
            if (!authUser) {
                log("Access denied - User not authenticated");
                if (!isDashboardPageRequest(req)) {
                    return res.status(401).json({ success: false, message: "Please log in to continue" });
                }
                return res.redirect("/?reason=unauthenticated");
            }

            req.user = authUser;
            const userRole = authUser.role;
            if (!allowedRoles.includes(userRole)) {
                log(`Access forbidden - User role '${userRole}' not authorized. Allowed: ${allowedRoles.join(", ")}`);
                if (!isDashboardPageRequest(req)) {
                    return res.status(403).json({ success: false, message: "Forbidden: You do not have permission to perform this action" });
                }
                if (userRole === "ADMIN") return res.redirect("/admin");
                if (userRole === "PROCUREMENT_MANAGER") return res.redirect("/procurement-manager");
                if (userRole === "PROCUREMENT") return res.redirect("/procurement");
                return res.redirect("/");
            }

            next();
        } catch (err) {
            log(`requireRole error: ${err.message}`);
            return res.status(500).json({ success: false, message: "Authorization error" });
        }
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

