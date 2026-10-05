const { forbidden, unauthorized } = require("../utils/response");

function requireRole(...allowedRoles) {
    return (req, res, next) => {
        const user = req.user || req.session?.user;
        if (!user) {
            return unauthorized(res, "Authentication required");
        }
        if (!allowedRoles.includes(user.role)) {
            return forbidden(res, `Forbidden: Requires one of [${allowedRoles.join(", ")}]`);
        }
        next();
    };
}

module.exports = {
    requireRole
};
