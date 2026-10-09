const path = require("path");
const authService = require("./auth.service");
const { log } = require("../../utils/logger");
const { 
    generateAccessToken, 
    generateRefreshToken, 
    generateToken, 
    verifyRefreshToken,
    resolveAuthUser 
} = require("../../services/jwt.service");
const { SESSION_MAX_AGE } = require("../../config/env");
const COOKIE_MAX_AGE = SESSION_MAX_AGE || (12 * 60 * 60 * 1000); // 12 hours

const roleUrls = {
    ADMIN: "/admin",
    PROCUREMENT_MANAGER: "/procurement-manager",
    PROCUREMENT: "/procurement"
};

const { invalidateUserCache } = require("../../services/jwt.service");

function getRoleUrl(role) {
    return roleUrls[role] || "/";
}

async function renderLogin(req, res) {
    if (req.query.reason) {
        res.clearCookie("jwt_token");
        res.clearCookie("access_token");
        res.clearCookie("refresh_token");
        res.clearCookie("auth_token");
        res.clearCookie("login_session");
        if (req.session) {
            req.session.destroy(() => {});
        }
        return res.sendFile(path.resolve(__dirname, "../../../../frontend/auth-service/index.html"));
    }
    const user = await resolveAuthUser(req);
    if (user) {
        return res.redirect(getRoleUrl(user.role));
    }
    return res.sendFile(path.resolve(__dirname, "../../../../frontend/auth-service/index.html"));
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
            role: user.role,
            token_version: user.token_version || 1
        };

        const accessToken = generateAccessToken(tokenPayload);
        const refreshToken = generateRefreshToken(tokenPayload);

        const isProduction = process.env.NODE_ENV === "production";

        // Access token cookies (12 hours)
        res.cookie("jwt_token", accessToken, {
            httpOnly: true,
            secure: isProduction,
            sameSite: "lax",
            path: "/",
            maxAge: COOKIE_MAX_AGE
        });
        res.cookie("access_token", accessToken, {
            httpOnly: true,
            secure: isProduction,
            sameSite: "lax",
            path: "/",
            maxAge: COOKIE_MAX_AGE
        });

        // Refresh token cookie (12 hours)
        res.cookie("refresh_token", refreshToken, {
            httpOnly: true,
            secure: isProduction,
            sameSite: "lax",
            path: "/",
            maxAge: COOKIE_MAX_AGE
        });

        if (req.session) {
            req.session.user = tokenPayload;
            await new Promise(resolve => req.session.save(resolve));
        }

        const redirectUrl = getRoleUrl(user.role);
        log(`Login successful - ${username} (${user.role}) redirecting to ${redirectUrl}`);
        return res.json({
            success: true,
            token: accessToken,
            refreshToken,
            role: user.role,
            user: tokenPayload,
            redirect_url: redirectUrl
        });
    } catch (error) {
        log(`Login exception: ${error.message}`);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
}

async function refresh(req, res) {
    try {
        const rawToken = req.cookies?.refresh_token || req.body?.refresh_token;
        if (!rawToken) {
            return res.status(401).json({ success: false, message: "Refresh token missing" });
        }

        const decoded = verifyRefreshToken(rawToken);
        if (!decoded || !decoded.user_id) {
            res.clearCookie("jwt_token");
            res.clearCookie("access_token");
            res.clearCookie("refresh_token");
            res.clearCookie("auth_token");
            res.clearCookie("login_session");
            if (req.session) req.session.destroy(() => {});
            return res.status(401).json({ success: false, message: "Invalid or expired refresh token" });
        }

        const user = await authService.findUserById(decoded.user_id);
        if (!user || !user.is_active || (user.token_version !== decoded.token_version)) {
            res.clearCookie("jwt_token");
            res.clearCookie("access_token");
            res.clearCookie("refresh_token");
            res.clearCookie("auth_token");
            res.clearCookie("login_session");
            if (req.session) req.session.destroy(() => {});
            return res.status(403).json({ success: false, message: "Session revoked or account deactivated" });
        }

        const tokenPayload = {
            user_id: user.user_id,
            username: user.username,
            role: user.role,
            token_version: user.token_version
        };

        const newAccessToken = generateAccessToken(tokenPayload);
        const newRefreshToken = generateRefreshToken(tokenPayload);
        const isProduction = process.env.NODE_ENV === "production";

        res.cookie("jwt_token", newAccessToken, {
            httpOnly: true,
            secure: isProduction,
            sameSite: "lax",
            path: "/",
            maxAge: COOKIE_MAX_AGE
        });
        res.cookie("access_token", newAccessToken, {
            httpOnly: true,
            secure: isProduction,
            sameSite: "lax",
            path: "/",
            maxAge: COOKIE_MAX_AGE
        });
        res.cookie("refresh_token", newRefreshToken, {
            httpOnly: true,
            secure: isProduction,
            sameSite: "lax",
            path: "/",
            maxAge: COOKIE_MAX_AGE
        });

        if (req.session) {
            req.session.user = tokenPayload;
            await new Promise(resolve => req.session.save(resolve));
        }

        log(`Token refreshed successfully for user: ${user.username}`);
        return res.json({
            success: true,
            token: newAccessToken,
            refreshToken: newRefreshToken,
            user: tokenPayload
        });
    } catch (error) {
        log(`Token refresh error: ${error.message}`);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
}

async function verify(req, res) {
    const user = await resolveAuthUser(req);
    if (!user) {
        res.clearCookie("jwt_token");
        res.clearCookie("access_token");
        res.clearCookie("refresh_token");
        res.clearCookie("auth_token");
        res.clearCookie("login_session");
        if (req.session) req.session.destroy(() => {});
        return res.status(401).json({ success: false, authenticated: false, message: "Session revoked or expired" });
    }

    return res.json({
        success: true,
        authenticated: true,
        user_id: user.user_id,
        username: user.username,
        role: user.role
    });
}

async function logout(req, res) {
    const authUser = await resolveAuthUser(req);
    const userId = authUser?.user_id || req.session?.user?.user_id;
    const username = authUser?.username || req.session?.user?.username || "Anonymous";

    if (userId) {
        try {
            await authService.incrementTokenVersion(userId);
            invalidateUserCache(userId);
            log(`Revoked all tokens for user: ${username} (ID: ${userId})`);
        } catch (e) {
            log(`Warning: Failed to increment token version: ${e.message}`);
        }
    }

    res.clearCookie("jwt_token");
    res.clearCookie("access_token");
    res.clearCookie("refresh_token");
    res.clearCookie("auth_token");
    res.clearCookie("login_session");

    const isHtml = req.headers.accept?.includes("text/html") || req.method === "GET";

    if (req.session) {
        req.session.destroy(err => {
            if (err) {
                log(`Logout error: ${err.message}`);
                if (!isHtml) return res.status(500).json({ success: false, message: "Logout failed" });
            }
            log(`Logout successful for: ${username}`);
            if (isHtml) return res.redirect("/");
            return res.json({ success: true, redirect_url: "/" });
        });
    } else {
        log(`Logout successful for: ${username}`);
        if (isHtml) return res.redirect("/");
        return res.json({ success: true, redirect_url: "/" });
    }
}

module.exports = {
    renderLogin,
    login,
    refresh,
    verify,
    logout,
    getRoleUrl
};
