const path = require("path");
const authService = require("./auth.service");
const { log } = require("../../utils/logger");

const roleUrls = {
    ADMIN: "/admin",
    PROCUREMENT_MANAGER: "/procurement-manager",
    PROCUREMENT: "/procurement"
};

function getRoleUrl(role) {
    return roleUrls[role] || "/";
}

async function renderLogin(req, res) {
    if (req.session && req.session.user) {
        return res.redirect(getRoleUrl(req.session.user.role));
    }
    return res.sendFile(path.resolve(__dirname, "../../../../frontend/auth/index.html"));
}

async function login(req, res) {
    try {
        const { username, password } = req.body;
        log(`POST /login - Attempt for user: ${username}`);

        const user = await authService.findUserByUsername(username);
        if (!user) {
            log(`Login failed - User not found: ${username}`);
            return res.status(401).json({ success: false, message: "Invalid username or password" });
        }

        if (!user.is_active) {
            log(`Login failed - Inactive account: ${username}`);
            await authService.recordLoginAttempt(user.user_id, "FAILED");
            return res.status(403).json({ success: false, message: "User account has no access" });
        }

        const match = await authService.verifyPassword(password, user.password_hash);
        if (!match) {
            log(`Login failed - Invalid password: ${username}`);
            await authService.recordLoginAttempt(user.user_id, "FAILED");
            return res.status(401).json({ success: false, message: "Invalid username or password" });
        }

        await authService.recordLoginAttempt(user.user_id, "SUCCESS");

        req.session.user = {
            user_id: user.user_id,
            username: user.username,
            role: user.role
        };

        req.session.save(err => {
            if (err) {
                log(`Session save error: ${err.message}`);
                return res.status(500).json({ success: false, message: "Session creation error" });
            }
            const redirectUrl = getRoleUrl(user.role);
            log(`Login successful - ${username} (${user.role}) redirecting to ${redirectUrl}`);
            return res.json({
                success: true,
                role: user.role,
                redirect_url: redirectUrl
            });
        });
    } catch (error) {
        log(`Login exception: ${error.message}`);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
}

async function verify(req, res) {
    if (!req.session?.user) {
        return res.status(401).json({ authenticated: false });
    }
    return res.json({
        authenticated: true,
        user_id: req.session.user.user_id,
        username: req.session.user.username,
        role: req.session.user.role
    });
}

async function logout(req, res) {
    const username = req.session?.user?.username || "Anonymous";
    if (req.session) {
        req.session.destroy(err => {
            if (err) {
                log(`Logout error: ${err.message}`);
                return res.status(500).json({ success: false, message: "Logout failed" });
            }
            res.clearCookie("login_session");
            log(`Logout successful for: ${username}`);
            return res.json({ success: true, redirect_url: "/" });
        });
    } else {
        return res.json({ success: true, redirect_url: "/" });
    }
}

module.exports = {
    renderLogin,
    login,
    verify,
    logout,
    getRoleUrl
};
