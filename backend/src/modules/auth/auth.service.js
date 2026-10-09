const bcrypt = require("bcrypt");
const { db } = require("../../config/database");

async function findUserByUsername(username) {
    const [rows] = await db.execute(
        "SELECT user_id, username, password_hash, role, is_active, token_version FROM users WHERE username = ? LIMIT 1",
        [username]
    );
    return rows[0] || null;
}

async function findUserById(userId) {
    const [rows] = await db.execute(
        "SELECT user_id, username, role, is_active, token_version FROM users WHERE user_id = ? LIMIT 1",
        [userId]
    );
    return rows[0] || null;
}

const { invalidateUserCache } = require("../../services/jwt.service");

async function incrementTokenVersion(userId) {
    invalidateUserCache(userId);
    return db.execute("UPDATE users SET token_version = token_version + 1 WHERE user_id = ?", [userId]);
}

async function verifyPassword(password, hash) {
    return bcrypt.compare(password, hash);
}

async function recordLoginAttempt(userId, status) {
    return db.execute("INSERT INTO login_logs (user_id, login_status) VALUES (?, ?)", [userId, status]);
}

module.exports = {
    findUserByUsername,
    findUserById,
    incrementTokenVersion,
    verifyPassword,
    recordLoginAttempt
};
