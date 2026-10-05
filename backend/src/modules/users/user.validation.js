function validateCreateUser(req, res, next) {
    const { username, password, role } = req.body;
    if (!username || !password || !role) {
        return res.status(400).json({ success: false, message: "Username, password and role are required" });
    }
    if (!["ADMIN", "PROCUREMENT_MANAGER", "PROCUREMENT"].includes(role)) {
        return res.status(400).json({ success: false, message: "Invalid role" });
    }
    next();
}

function validateChangePassword(req, res, next) {
    const { password } = req.body;
    if (!password || String(password).trim() === "") {
        return res.status(400).json({ success: false, message: "Password is required" });
    }
    next();
}

function validateChangeAccess(req, res, next) {
    const { is_active } = req.body;
    if (typeof is_active !== "boolean") {
        return res.status(400).json({ success: false, message: "is_active must be true or false" });
    }
    next();
}

module.exports = {
    validateCreateUser,
    validateChangePassword,
    validateChangeAccess
};
