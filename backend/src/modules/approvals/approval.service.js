const { db } = require("../../config/database");

async function getPendingApprovals() {
    const [inquiries] = await db.query(`
        SELECT vi.*, pr.pr_number, pr.item_name, pr.qty, pr.unit, pr.party_name
        FROM vendor_inquiries vi
        JOIN purchase_requests pr ON vi.pr_id = pr.id
        WHERE vi.status = 'OPEN'
        ORDER BY vi.inquiry_id DESC
    `);
    const [draftPOs] = await db.query(`
        SELECT * FROM purchase_orders WHERE status = 'DRAFT' ORDER BY po_id DESC
    `);
    return { inquiries, draftPOs };
}

module.exports = {
    getPendingApprovals
};
