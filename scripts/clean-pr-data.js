/**
 * ProcureIQ PR & Transactional Data Cleanup Utility
 * Cleans all Purchase Requisitions (PRs) and downstream transactions:
 *   - purchase_requests
 *   - pr_sequences
 *   - vendor_inquiries
 *   - vendor_inquiry_vendors
 *   - purchase_orders
 *   - goods_received
 *   - goods_returns
 *   - generated PO PDF files
 *
 * STRICTLY PRESERVES:
 *   - users (User accounts & credentials)
 *   - vendor_oem_masters (Vendor directory master records)
 *   - login_logs
 */

const path = require("path");
const fs = require("fs");
const backendDir = path.resolve(__dirname, "../backend");
require(path.join(backendDir, "node_modules/dotenv")).config({ path: path.join(backendDir, ".env") });
const mysql = require(path.join(backendDir, "node_modules/mysql2/promise"));

async function cleanPRData() {
    console.log("===============================================================");
    console.log("   ProcureIQ - PR Transaction Cleanup Utility                  ");
    console.log("===============================================================");

    const host = process.env.DB_HOST || "localhost";
    const user = process.env.DB_USER || "root";
    const password = process.env.DB_PASSWORD || "Password@123";
    const dbName = process.env.DB_NAME || "ProcureIQ";

    const connection = await mysql.createConnection({
        host,
        user,
        password,
        database: dbName,
        multipleStatements: true
    });

    try {
        console.log(`\n[✔] Connected to database: ${dbName} on ${host}`);

        // 1. Verify preserved tables
        const [users] = await connection.query("SELECT user_id, username, role, is_active FROM users ORDER BY user_id");
        const [[{ vendorCount }]] = await connection.query("SELECT COUNT(*) as vendorCount FROM vendor_oem_masters");

        console.log(`\n[✔] Preserving Users (${users.length} accounts):`);
        users.forEach(u => console.log(`    - [ID ${u.user_id}] ${u.username} (${u.role})`));

        console.log(`[✔] Preserving Vendor Masters: ${vendorCount} vendor records intact.`);

        // 2. Tables to clean
        const prTables = [
            "goods_returns",
            "goods_received",
            "purchase_orders",
            "vendor_inquiry_vendors",
            "vendor_inquiries",
            "purchase_requests",
            "pr_sequences"
        ];

        // 3. Backup existing PR data to a JSON snapshot before wiping
        const backupDir = path.resolve(__dirname, "../database/backups");
        if (!fs.existsSync(backupDir)) {
            fs.mkdirSync(backupDir, { recursive: true });
        }
        const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
        const backupData = {};

        console.log("\n[i] Creating pre-cleanup snapshot backup...");
        for (const table of prTables) {
            try {
                const [rows] = await connection.query(`SELECT * FROM \`${table}\``);
                backupData[table] = rows;
            } catch (err) {
                backupData[table] = [];
            }
        }
        const backupFile = path.join(backupDir, `pr_tables_backup_${timestamp}.json`);
        fs.writeFileSync(backupFile, JSON.stringify(backupData, null, 2), "utf8");
        console.log(`    ✔ Pre-cleanup snapshot saved: ${backupFile}`);

        // 4. Disable foreign keys and truncate PR tables
        console.log("\n[i] Cleaning PR transaction tables...");
        await connection.query("SET FOREIGN_KEY_CHECKS = 0;");

        const removalSummary = [];
        for (const table of prTables) {
            try {
                const [[{ count }]] = await connection.query(`SELECT COUNT(*) as count FROM \`${table}\``);
                await connection.query(`TRUNCATE TABLE \`${table}\``);
                removalSummary.push({ table, removed: count });
                console.log(`    ✔ Truncated ${table} (removed ${count} records)`);
            } catch (err) {
                console.warn(`    ⚠ Error truncating ${table}: ${err.message}`);
            }
        }

        // Re-enable foreign key checks
        await connection.query("SET FOREIGN_KEY_CHECKS = 1;");

        // 5. Clean generated PO PDF files
        console.log("\n[i] Cleaning generated PO PDFs...");
        const poDir = path.resolve(__dirname, "../backend/purchase-orders");
        let deletedPdfs = 0;
        if (fs.existsSync(poDir)) {
            const poFiles = fs.readdirSync(poDir).filter(f => f.endsWith(".pdf"));
            poFiles.forEach(f => {
                fs.unlinkSync(path.join(poDir, f));
                deletedPdfs++;
                console.log(`    ✔ Deleted generated PO PDF: ${f}`);
            });
        }
        if (deletedPdfs === 0) {
            console.log("    ✔ No generated PO PDFs to remove.");
        }

        // 6. Final verification
        console.log("\n[i] Verifying database state post-cleanup...");
        for (const item of removalSummary) {
            const [[{ count }]] = await connection.query(`SELECT COUNT(*) as count FROM \`${item.table}\``);
            console.log(`    - ${item.table}: ${count} rows`);
        }
        const [[{ finalVendorCount }]] = await connection.query("SELECT COUNT(*) as finalVendorCount FROM vendor_oem_masters");
        const [[{ finalUserCount }]] = await connection.query("SELECT COUNT(*) as finalUserCount FROM users");
        console.log(`    - vendor_oem_masters: ${finalVendorCount} rows (PRESERVED)`);
        console.log(`    - users: ${finalUserCount} rows (PRESERVED)`);

        console.log("\n===============================================================");
        console.log("   ✔ All PR transactional data has been successfully cleaned!   ");
        console.log("   Next PR created will restart sequence counter at 0001.     ");
        console.log("===============================================================\n");

    } catch (err) {
        console.error("Cleanup failed:", err.message);
        process.exit(1);
    } finally {
        await connection.end();
    }
}

cleanPRData();
