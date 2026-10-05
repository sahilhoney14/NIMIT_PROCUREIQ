const { db } = require("../../config/database");

async function findByInquiryId(inquiryId) {
    const [rows] = await db.execute(`
        SELECT viv.*, v.vendor_name, v.vendor_code
        FROM vendor_inquiry_vendors viv
        JOIN vendor_oem_masters v ON viv.vendor_id = v.vendor_id
        WHERE viv.inquiry_id = ?
        ORDER BY viv.price_per_unit ASC
    `, [inquiryId]);
    return rows;
}

module.exports = {
    findByInquiryId
};
