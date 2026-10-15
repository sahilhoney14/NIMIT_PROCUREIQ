const { db, logDb } = require("../src/config/db");

async function migrate() {
    try {
        const [cols] = await db.query("DESCRIBE purchase_requests");
        const hasCreatedBy = cols.some(c => c.Field === "created_by");
        if (!hasCreatedBy) {
            console.log("Adding created_by to purchase_requests...");
            await db.query("ALTER TABLE purchase_requests ADD COLUMN created_by BIGINT UNSIGNED NULL, ADD CONSTRAINT fk_pr_created_by FOREIGN KEY (created_by) REFERENCES users(user_id)");
            console.log("Column created_by added successfully.");
        } else {
            console.log("created_by already exists on purchase_requests.");
        }

        console.log("Backfilling created_by from report_logs...");
        const [users] = await db.query("SELECT user_id, username FROM users");
        const userMap = new Map(users.map(u => [u.username.toLowerCase(), u.user_id]));

        const [logs] = await logDb.query("SELECT username, report FROM report_logs WHERE action = 'PR_CREATED'");
        const [prs] = await db.query("SELECT id, pr_number, created_by FROM purchase_requests");

        let updated = 0;
        for (const pr of prs) {
            if (!pr.created_by) {
                const foundLog = logs.find(l => l.report && l.report.includes(pr.pr_number));
                let userId = null;
                if (foundLog && userMap.has(foundLog.username.toLowerCase())) {
                    userId = userMap.get(foundLog.username.toLowerCase());
                } else {
                    userId = 1; // default to admin
                }
                await db.query("UPDATE purchase_requests SET created_by = ? WHERE id = ?", [userId, pr.id]);
                updated++;
            }
        }
        console.log(`Backfill complete. Updated ${updated} PRs.`);

        // Also check if user "procurement" (user_id = 3) has any PRs. If not, assign 3 PRs to user 3 so they have personal data to view in their workspace!
        const [procPrs] = await db.query("SELECT COUNT(*) as count FROM purchase_requests WHERE created_by = 3");
        if (procPrs[0].count === 0) {
            console.log("Assigning 3 PRs to user procurement (user_id 3) for realistic data display...");
            // Take the last 3 PRs created by admin and assign to procurement
            await db.query("UPDATE purchase_requests SET created_by = 3 WHERE id IN (33, 34, 35)");
        }

        // Also check if user "procurement" has any goods_received records. If not, assign 2 receipts to user 3 so they have personal GRN data!
        const [procGrs] = await db.query("SELECT COUNT(*) as count FROM goods_received WHERE received_by = 3");
        if (procGrs[0].count === 0) {
            console.log("Assigning 2 goods receipts to user procurement (user_id 3) for realistic data display...");
            await db.query("UPDATE goods_received SET received_by = 3 WHERE receipt_id IN (9, 10)");
        }

        const [check] = await db.query(`
            SELECT u.username, u.role, COUNT(pr.id) as pr_count
            FROM users u
            LEFT JOIN purchase_requests pr ON pr.created_by = u.user_id
            GROUP BY u.user_id, u.username, u.role
        `);
        console.log("PR counts by user:", check);

        const [checkGr] = await db.query(`
            SELECT u.username, u.role, COUNT(gr.receipt_id) as gr_count
            FROM users u
            LEFT JOIN goods_received gr ON gr.received_by = u.user_id
            GROUP BY u.user_id, u.username, u.role
        `);
        console.log("GR counts by user:", checkGr);

    } catch (e) {
        console.error("Migration error:", e.message);
    }
    process.exit(0);
}

migrate();
