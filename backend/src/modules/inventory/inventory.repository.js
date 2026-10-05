const { db } = require("../../config/database");

async function findGoodsReceivedByPo(poId) {
    const [rows] = await db.execute(`
        SELECT receipt_id, received_date, received_quantity, remarks, received_by
        FROM goods_received
        WHERE po_id = ?
        ORDER BY received_date DESC, receipt_id DESC
    `, [poId]);
    return rows;
}

async function findGoodsReturnsByPo(poId) {
    const [rows] = await db.execute(`
        SELECT return_id, return_date, return_quantity, return_reason, returned_by
        FROM goods_returns
        WHERE po_id = ?
        ORDER BY return_date DESC, return_id DESC
    `, [poId]);
    return rows;
}

module.exports = {
    findGoodsReceivedByPo,
    findGoodsReturnsByPo
};
