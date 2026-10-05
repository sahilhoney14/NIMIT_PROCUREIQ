const { db } = require("../../config/database");

async function findAll() {
    const [rows] = await db.execute(
        "SELECT * FROM vendor_oem_masters ORDER BY vendor_id DESC"
    );
    return rows;
}

async function findById(vendorId) {
    const [rows] = await db.execute(
        "SELECT * FROM vendor_oem_masters WHERE vendor_id = ? LIMIT 1",
        [vendorId]
    );
    return rows[0] || null;
}

module.exports = {
    findAll,
    findById
};
