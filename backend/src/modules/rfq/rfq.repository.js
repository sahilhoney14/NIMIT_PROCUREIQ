const { db } = require("../../config/database");

async function findAllInquiries() {
    const [rows] = await db.query(`
        SELECT vi.*, pr.pr_number, pr.item_name, pr.qty, pr.unit, pr.party_name
        FROM vendor_inquiries vi
        JOIN purchase_requests pr ON vi.pr_id = pr.id
        ORDER BY vi.inquiry_id DESC
    `);
    return rows;
}

async function findInquiryById(inquiryId) {
    const [rows] = await db.execute(`
        SELECT vi.*, pr.pr_number, pr.item_name, pr.qty, pr.unit, pr.party_name, pr.make, pr.model
        FROM vendor_inquiries vi
        JOIN purchase_requests pr ON vi.pr_id = pr.id
        WHERE vi.inquiry_id = ?
        LIMIT 1
    `, [inquiryId]);
    return rows[0] || null;
}

module.exports = {
    findAllInquiries,
    findInquiryById
};
