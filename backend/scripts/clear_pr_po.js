const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
const { db, logDb } = require("../src/config/db");

async function clearPrPoDatabase() {
    console.log("=================================================");
    console.log("     CLEARING ALL PR & PO DATA IN DATABASE      ");
    console.log("=================================================");

    const mainConn = await db.getConnection();
    try {
        await mainConn.query("SET FOREIGN_KEY_CHECKS = 0");

        console.log("1. Truncating Goods Returns & Goods Received...");
        await mainConn.query("TRUNCATE TABLE goods_returns");
        await mainConn.query("TRUNCATE TABLE goods_received");

        console.log("2. Truncating Purchase Orders...");
        await mainConn.query("TRUNCATE TABLE purchase_orders");

        console.log("3. Truncating Vendor Inquiry Quotations & Vendor Inquiries...");
        await mainConn.query("TRUNCATE TABLE vendor_inquiry_vendors");
        await mainConn.query("TRUNCATE TABLE vendor_inquiries");

        console.log("4. Truncating Purchase Requests...");
        await mainConn.query("TRUNCATE TABLE purchase_requests");

        console.log("5. Resetting PR Sequences (next PR will start from 0001)...");
        await mainConn.query("TRUNCATE TABLE pr_sequences");

        await mainConn.query("SET FOREIGN_KEY_CHECKS = 1");
        console.log("-> Main DB PR & PO tables cleared successfully.");

        // Clear PR/PO related activity logs from report_logs
        console.log("6. Clearing PR/PO historical report logs in ProcureIQ_Logs...");
        const [delResult] = await logDb.query(`
            DELETE FROM report_logs 
            WHERE action IN (
                'PR_CREATED', 
                'VENDOR_INQUIRY_CREATED', 
                'VENDOR_QUOTATION_ADDED', 
                'VENDOR_SELECTED', 
                'PO_CREATED', 
                'PO_ISSUED', 
                'PO_COMPLETED', 
                'PO_RESELECT', 
                'INQUIRY_CANCELLED', 
                'REQUIREMENT_CANCELLED', 
                'GOODS_RECEIVED', 
                'GOODS_RETURNED'
            )
        `);
        console.log(`-> Deleted ${delResult.affectedRows} PR/PO log entries from report_logs.`);

        // Verification of Table Counts
        console.log("\n=================================================");
        console.log("              VERIFICATION SUMMARY               ");
        console.log("=================================================");

        const prPoTables = [
            "purchase_requests",
            "vendor_inquiries",
            "vendor_inquiry_vendors",
            "purchase_orders",
            "goods_received",
            "goods_returns",
            "pr_sequences"
        ];

        for (const tbl of prPoTables) {
            const [rows] = await mainConn.query(`SELECT COUNT(*) AS c FROM \`${tbl}\``);
            console.log(` [CLEARED] ${tbl}: ${rows[0].c} rows`);
        }

        console.log("\n--- PRESERVED MASTER DATA ---");
        const masterTables = [
            "vendor_oem_masters",
            "product_categories",
            "sub_product_categories",
            "users"
        ];

        for (const tbl of masterTables) {
            const [rows] = await mainConn.query(`SELECT COUNT(*) AS c FROM \`${tbl}\``);
            console.log(` [SAFE]    ${tbl}: ${rows[0].c} rows intact`);
        }

        console.log("\n>>> ALL PR AND PO DATA CLEARED SUCCESSFULLY! <<<");
    } catch (error) {
        console.error("ERROR clearing PR/PO database:", error);
    } finally {
        await mainConn.query("SET FOREIGN_KEY_CHECKS = 1").catch(() => {});
        mainConn.release();
        process.exit(0);
    }
}

clearPrPoDatabase();

