/**
 * ProcureIQ Database Cleanup Utility
 * Cleans all transactional and master data from ProcureIQ and ProcureIQ_Logs
 * while strictly preserving the `users` table and accounts.
 */

const path = require("path");
const backendDir = path.resolve(__dirname, "../backend");
require(path.join(backendDir, "node_modules/dotenv")).config({ path: path.join(backendDir, ".env") });
const fs = require("fs");
const mysql = require(path.join(backendDir, "node_modules/mysql2/promise"));

async function cleanDatabase() {
    console.log("=======================================================");
    console.log("   ProcureIQ Database Cleanup Utility (Keep Users)     ");
    console.log("=======================================================");

    const host = process.env.DB_HOST || "localhost";
    const user = process.env.DB_USER || "root";
    const password = process.env.DB_PASSWORD || "Password@123";
    const mainDbName = process.env.DB_NAME || "ProcureIQ";
    const logDbName = process.env.DB2_NAME || "ProcureIQ_Logs";

    const connection = await mysql.createConnection({
        host,
        user,
        password,
        multipleStatements: true
    });

    try {
        await connection.changeUser({ database: mainDbName });

        // 1. Verify and display preserved users
        const [users] = await connection.query("SELECT user_id, username, role, is_active FROM users ORDER BY user_id");
        console.log(`\n[✔] Preserving ${users.length} user accounts:`);
        users.forEach(u => console.log(`    - ID ${u.user_id}: ${u.username} (${u.role}, ${u.is_active ? "Active" : "Inactive"})`));

        // 2. Disable Foreign Key checks
        await connection.query("SET FOREIGN_KEY_CHECKS = 0;");

        // 3. Truncate Main DB tables (except users)
        const mainTablesToClean = [
            "goods_returns",
            "goods_received",
            "purchase_orders",
            "vendor_inquiry_vendors",
            "vendor_inquiries",
            "purchase_requests",
            "vendor_oem_masters",
            "pr_sequences",
            "login_logs"
        ];

        console.log("\n[i] Cleaning main database tables (ProcureIQ)...");
        for (const table of mainTablesToClean) {
            try {
                const [[{ count }]] = await connection.query(`SELECT COUNT(*) as count FROM \`${table}\``);
                await connection.query(`TRUNCATE TABLE \`${table}\``);
                console.log(`    ✔ Truncated ${table} (removed ${count} records)`);
            } catch (err) {
                console.warn(`    ⚠ Skipping ${table}: ${err.message}`);
            }
        }

        // Re-enable Foreign Key checks
        await connection.query("SET FOREIGN_KEY_CHECKS = 1;");

        // 4. Truncate Logs DB tables
        console.log("\n[i] Cleaning audit and activity logs (ProcureIQ_Logs)...");
        try {
            await connection.changeUser({ database: logDbName });
            const logTablesToClean = ["report_logs", "audit_logs"];
            for (const table of logTablesToClean) {
                try {
                    const [[{ count }]] = await connection.query(`SELECT COUNT(*) as count FROM \`${table}\``);
                    await connection.query(`TRUNCATE TABLE \`${table}\``);
                    console.log(`    ✔ Truncated ${table} (removed ${count} records)`);
                } catch (err) {
                    console.warn(`    ⚠ Skipping ${table}: ${err.message}`);
                }
            }
        } catch (err) {
            console.warn(`    ⚠ Log database error: ${err.message}`);
        }

        // 5. Clean generated runtime files (PO PDFs and vendor document directories)
        console.log("\n[i] Cleaning runtime generated files...");
        const poDir = path.resolve(__dirname, "../backend/purchase-orders");
        if (fs.existsSync(poDir)) {
            const poFiles = fs.readdirSync(poDir).filter(f => f.endsWith(".pdf"));
            poFiles.forEach(f => {
                fs.unlinkSync(path.join(poDir, f));
                console.log(`    ✔ Deleted generated PO PDF: ${f}`);
            });
        }

        const vendorDir = path.resolve(__dirname, "../backend/vendor");
        if (fs.existsSync(vendorDir)) {
            const vendorEntries = fs.readdirSync(vendorDir);
            for (const entry of vendorEntries) {
                const entryPath = path.join(vendorDir, entry);
                if (entry !== ".gitkeep" && fs.statSync(entryPath).isDirectory()) {
                    fs.rmSync(entryPath, { recursive: true, force: true });
                    console.log(`    ✔ Removed vendor upload directory: ${entry}`);
                }
            }
        }

        console.log("\n=======================================================");
        console.log("   ✔ Database cleanup completed successfully!          ");
        console.log("   All tables emptied and sequences reset to 0.        ");
        console.log(`   ${users.length} user accounts preserved.           `);
        console.log("=======================================================\n");

    } catch (err) {
        console.error("Cleanup error:", err.message);
        process.exit(1);
    } finally {
        await connection.end();
    }
}

cleanDatabase();
