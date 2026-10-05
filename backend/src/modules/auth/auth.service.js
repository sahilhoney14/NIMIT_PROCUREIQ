const bcrypt = require("bcrypt");
const { db } = require("../../config/database");

async function findUserByUsername(username) {
    const [rows] = await db.execute(
        "SELECT user_id, username, password_hash, role, is_active FROM users WHERE username = ? LIMIT 1",
        [username]
    );
    return rows[0] || null;
}

async function verifyPassword(password, hash) {
    return bcrypt.compare(password, hash);
}

async function recordLoginAttempt(userId, status) {
    return db.execute("INSERT INTO login_logs (user_id, login_status) VALUES (?, ?)", [userId, status]);
}

module.exports = {
    findUserByUsername,
    verifyPassword,
    recordLoginAttempt
};
