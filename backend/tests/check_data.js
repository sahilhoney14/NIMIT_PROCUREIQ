const { db, logDb } = require("../src/config/database");

async function run() {
    try {
        const [models] = await db.execute(`
            SELECT DISTINCT
                model,
                make,
                item_name,
                product_category
            FROM purchase_orders
            WHERE model IS NOT NULL AND model != ''
            ORDER BY model ASC
        `);
        console.log("Models in purchase_orders:", models);

        const [vendors] = await db.execute("SELECT vendor_id, vendor_code, vendor_name FROM vendor_oem_masters");
        console.log("Vendors in DB:", vendors);

        const [pos] = await db.execute("SELECT po_id, po_number, status, total_price, vendor_id FROM purchase_orders");
        console.log("POs in DB:", pos);

        const [prs] = await db.execute("SELECT id, pr_number, status, party_name FROM purchase_requests");
        console.log("PRs in DB:", prs);

        const [grn] = await db.execute("SELECT gr_id, po_id, received_date FROM goods_received");
        console.log("GRNs in DB:", grn);

        const [rl] = await logDb.execute("SELECT report_log_id, username, action FROM report_logs LIMIT 5");
        console.log("Report logs in DB:", rl);
    } catch (e) {
        console.error("Error:", e.message);
    }
    process.exit(0);
}

run();
