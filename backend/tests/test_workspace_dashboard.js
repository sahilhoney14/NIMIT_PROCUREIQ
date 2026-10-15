const { db } = require("../src/config/db");
const { generateAccessToken } = require("../src/services/jwt.service");

async function run() {
    try {
        const [users] = await db.query("SELECT user_id, username, role, token_version FROM users");
        const adminUser = users.find(u => u.role === "ADMIN");
        const procUser = users.find(u => u.role === "PROCUREMENT");

        console.log("Admin user:", adminUser);
        console.log("Procurement user:", procUser);

        const adminToken = generateAccessToken(adminUser);
        const procToken = generateAccessToken(procUser);

        // Test with fetch
        const resAdmin = await fetch("http://localhost:3000/workspace/dashboard", {
            headers: { Authorization: `Bearer ${adminToken}` }
        });
        console.log("Admin response status:", resAdmin.status);
        if (resAdmin.ok) {
            const dataAdmin = await resAdmin.json();
            console.log("Admin data:", {
                is_admin: dataAdmin.is_admin,
                metrics: dataAdmin.metrics,
                pr_count: dataAdmin.purchase_requests.length,
                gr_count: dataAdmin.goods_received.length,
                user_summary_count: dataAdmin.user_summary.length,
                available_users_count: dataAdmin.available_users.length
            });
        }

        const resProc = await fetch("http://localhost:3000/workspace/dashboard", {
            headers: { Authorization: `Bearer ${procToken}` }
        });
        console.log("Procurement response status:", resProc.status);
        if (resProc.ok) {
            const dataProc = await resProc.json();
            console.log("Procurement data:", {
                is_admin: dataProc.is_admin,
                user: dataProc.current_user,
                metrics: dataProc.metrics,
                pr_count: dataProc.purchase_requests.length,
                gr_count: dataProc.goods_received.length,
                all_prs_belong_to_proc: dataProc.purchase_requests.every(p => p.created_by === procUser.user_id),
                all_grs_belong_to_proc: dataProc.goods_received.every(g => g.received_by === procUser.user_id)
            });
        }

    } catch (e) {
        console.error("Test error:", e.message);
    }
    process.exit(0);
}

run();
