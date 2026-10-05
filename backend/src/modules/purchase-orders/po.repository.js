const { db } = require("../../config/database");

async function findAll() {
    const [rows] = await db.query(`
        SELECT po.*, 
               COALESCE((SELECT SUM(gr.received_quantity) FROM goods_received gr WHERE gr.po_id = po.po_id), 0) AS total_received,
               COALESCE((SELECT SUM(ret.return_quantity) FROM goods_returns ret WHERE ret.po_id = po.po_id), 0) AS total_returned
        FROM purchase_orders po
        ORDER BY po.po_id DESC
    `);
    return rows;
}

async function findById(poId) {
    const [rows] = await db.execute(`
        SELECT * FROM purchase_orders WHERE po_id = ? LIMIT 1
    `, [poId]);
    return rows[0] || null;
}

module.exports = {
    findAll,
    findById
};
