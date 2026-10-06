const path = require("path");
const authService = require("./auth.service");
const { log } = require("../../utils/logger");
const { generateToken, resolveAuthUser } = require("../../services/jwt.service");

const roleUrls = {
    ADMIN: "/admin",
    PROCUREMENT_MANAGER: "/procurement-manager",
    PROCUREMENT: "/procurement"
};

function getRoleUrl(role) {
    return roleUrls[role] || "/";
}

async function renderLogin(req, res) {
    const user = resolveAuthUser(req);
    if (user) {
        return res.redirect(getRoleUrl(user.role));
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

        const tokenPayload = {
            user_id: user.user_id,
            username: user.username,
            role: user.role
        };

        const token = generateToken(tokenPayload);

        res.cookie("jwt_token", token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            maxAge: 8 * 60 * 60 * 1000
        });

        if (req.session) {
            req.session.user = tokenPayload;
            req.session.save();
        }

        const redirectUrl = getRoleUrl(user.role);
        log(`Login successful - ${username} (${user.role}) redirecting to ${redirectUrl}`);
        return res.json({
            success: true,
            token,
            role: user.role,
            user: tokenPayload,
            redirect_url: redirectUrl
        });
    } catch (error) {
        log(`Login exception: ${error.message}`);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
}

async function verify(req, res) {
    const user = resolveAuthUser(req);
    if (!user) {
        return res.status(401).json({ authenticated: false });
    }
    return res.json({
        authenticated: true,
        user_id: user.user_id,
        username: user.username,
        role: user.role
    });
}

async function logout(req, res) {
    const username = resolveAuthUser(req)?.username || req.session?.user?.username || "Anonymous";
    res.clearCookie("jwt_token");
    res.clearCookie("auth_token");
    res.clearCookie("login_session");

    if (req.session) {
        req.session.destroy(err => {
            if (err) {
                log(`Logout error: ${err.message}`);
                return res.status(500).json({ success: false, message: "Logout failed" });
            }
            log(`Logout successful for: ${username}`);
            return res.json({ success: true, redirect_url: "/" });
        });
    } else {
        log(`Logout successful for: ${username}`);
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
