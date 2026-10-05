const { db } = require("../../config/database");

async function findAll() {
    const [rows] = await db.query("SELECT * FROM purchase_requests ORDER BY id DESC");
    return rows;
}

async function findById(id) {
    const [rows] = await db.execute("SELECT * FROM purchase_requests WHERE id = ? LIMIT 1", [id]);
    return rows[0] || null;
}

async function findByNumber(prNumber) {
    const [rows] = await db.execute("SELECT * FROM purchase_requests WHERE pr_number = ? LIMIT 1", [prNumber]);
    return rows[0] || null;
}

module.exports = {
    findAll,
    findById,
    findByNumber
};
