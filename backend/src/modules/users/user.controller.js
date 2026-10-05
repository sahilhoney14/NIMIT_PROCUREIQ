const userService = require("./user.service");
const { log } = require("../../utils/logger");
const { writeReportLog, writeAuditLog } = require("../../services/audit.service");

async function getUsers(req, res) {
    log("GET /users - Fetching users");
    try {
        const users = await userService.listUsers();
        log(`Returning ${users.length} users`);
        res.json({ success: true, users });
    } catch (error) {
        log(`ERROR fetching users: ${error.message}`);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
}

async function createUser(req, res) {
    log("POST /users - Add User request");
    try {
        const { username, password, role } = req.body;
        const newUserId = await userService.createUser({ username, password, role });

        await writeReportLog(
            req,
            "USER_CREATED",
            `New user created. Username: "${username}", Role: ${role}, User ID: ${newUserId}. Account activated: YES.`
        );
        await writeAuditLog(
            req,
            "USER_CREATED",
            null,
            JSON.stringify({ user_id: newUserId, username, role, is_active: true })
        );

        log(`User added: ${username}`);
        res.status(201).json({ success: true, message: "User added successfully" });
    } catch (error) {
        if (error.code === "ER_DUP_ENTRY") {
            return res.status(409).json({ success: false, message: "Username already exists" });
        }
        log(`ERROR adding user: ${error.message}`);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
}

async function updatePassword(req, res) {
    const userId = Number(req.params.user_id);
    log(`PUT /users/${userId}/password - Change Password request`);
    if (!Number.isInteger(userId) || userId <= 0) {
        return res.status(400).json({ success: false, message: "Invalid user ID" });
    }

    try {
        const { password } = req.body;
        const user = await userService.getUserById(userId);
        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        await userService.changePassword(userId, password);

        await writeReportLog(
            req,
            "USER_PASSWORD_CHANGED",
            `Password changed for user ID ${userId}. Username: "${user.username}", Role: ${user.role}.`
        );
        await writeAuditLog(
            req,
            "USER_PASSWORD_CHANGED",
            JSON.stringify({ user_id: userId, username: user.username, role: user.role, password_hash: "[REDACTED]" }),
            JSON.stringify({ user_id: userId, username: user.username, role: user.role, password_hash: "[REDACTED]" })
        );

        log(`Password changed for user ID: ${userId}`);
        res.json({ success: true, message: "Password changed successfully" });
    } catch (error) {
        log(`ERROR changing password: ${error.message}`);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
}

async function updateAccess(req, res) {
    const userId = Number(req.params.user_id);
    log(`PUT /users/${userId}/access - Access change request`);
    if (!Number.isInteger(userId) || userId <= 0) {
        return res.status(400).json({ success: false, message: "Invalid user ID" });
    }

    try {
        const { is_active } = req.body;
        const user = await userService.getUserById(userId);
        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        await userService.changeAccess(userId, is_active);

        const action = is_active ? "USER_ACCESS_GRANTED" : "USER_ACCESS_REVOKED";
        await writeReportLog(
            req,
            action,
            `User access changed. User ID: ${userId}, Username: "${user.username}", Role: ${user.role}, Previous active status: ${user.is_active}, New active status: ${is_active}.`
        );
        await writeAuditLog(
            req,
            action,
            JSON.stringify({ user_id: userId, username: user.username, role: user.role, is_active: Boolean(user.is_active) }),
            JSON.stringify({ user_id: userId, username: user.username, role: user.role, is_active })
        );

        log(`${is_active ? "Access granted to" : "Access revoked from"} user ID: ${userId}`);
        res.json({
            success: true,
            message: is_active ? "Access granted successfully" : "Access revoked successfully"
        });
    } catch (error) {
        log(`ERROR changing access: ${error.message}`);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
}

module.exports = {
    getUsers,
    createUser,
    updatePassword,
    updateAccess
};
