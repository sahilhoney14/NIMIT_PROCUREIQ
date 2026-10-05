const { db } = require("../../config/database");

async function findAll() {
    const [rows] = await db.execute(
        "SELECT user_id, username, role, is_active, created_at, updated_at FROM users ORDER BY user_id"
    );
    return rows;
}

async function findById(userId) {
    const [rows] = await db.execute(
        "SELECT user_id, username, role, is_active, created_at, updated_at FROM users WHERE user_id = ? LIMIT 1",
        [userId]
    );
    return rows[0] || null;
}

async function create({ username, passwordHash, role }) {
    const [result] = await db.execute(
        "INSERT INTO users (username, password_hash, role, is_active) VALUES (?, ?, ?, TRUE)",
        [username, passwordHash, role]
    );
    return result.insertId;
}

async function updatePassword(userId, passwordHash) {
    return db.execute("UPDATE users SET password_hash = ? WHERE user_id = ?", [passwordHash, userId]);
}

async function updateAccess(userId, isActive) {
    return db.execute("UPDATE users SET is_active = ? WHERE user_id = ?", [isActive, userId]);
}

module.exports = {
    findAll,
    findById,
    create,
    updatePassword,
    updateAccess
};
