const bcrypt = require("bcrypt");
const path = require("path");
const { db } = require("../config/db");
const { log } = require("../utils/logger");

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
        const dest = getRoleUrl(req.session.user.role);
        return res.redirect(dest);
    }
    return res.sendFile(path.resolve(__dirname, "../../../frontend/auth-service/index.html"));
}

async function login(req, res) {
    try {
        const { username, password } = req.body;
        log(`POST /login - Attempt for user: ${username}`);

        if (!username || !password) {
            return res.status(400).json({ success: false, message: "Username and password are required" });
        }

        const [rows] = await db.execute(
            "SELECT user_id, username, password_hash, role, is_active FROM users WHERE username = ? LIMIT 1",
            [username]
        );

        if (rows.length === 0) {
            log(`Login failed - User not found: ${username}`);
            return res.status(401).json({ success: false, message: "Invalid username or password" });
        }

        const user = rows[0];

        if (!user.is_active) {
            log(`Login failed - Inactive account: ${username}`);
            await db.execute("INSERT INTO login_logs (user_id, login_status) VALUES (?, 'FAILED')", [user.user_id]);
            return res.status(403).json({ success: false, message: "User account has no access" });
        }

        const passwordCorrect = await bcrypt.compare(password, user.password_hash);
        if (!passwordCorrect) {
            log(`Login failed - Invalid password for: ${username}`);
            await db.execute("INSERT INTO login_logs (user_id, login_status) VALUES (?, 'FAILED')", [user.user_id]);
            return res.status(401).json({ success: false, message: "Invalid username or password" });
        }

        await db.execute("INSERT INTO login_logs (user_id, login_status) VALUES (?, 'SUCCESS')", [user.user_id]);

        req.session.user = {
            user_id: user.user_id,
            username: user.username,
            role: user.role
        };

        req.session.save(err => {
            if (err) {
                log(`ERROR saving session: ${err.message}`);
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
    if (!req.session || !req.session.user) {
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
