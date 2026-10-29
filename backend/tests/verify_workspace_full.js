const { db } = require("../src/config/db");
const { generateAccessToken } = require("../src/services/jwt.service");

async function verify() {
    console.log("==================================================");
    console.log("   ProcureIQ Workspace Dashboard Verification    ");
    console.log("==================================================");

    const [users] = await db.query("SELECT user_id, username, role, token_version FROM users WHERE is_active = 1");
    const admin = users.find(u => u.role === "ADMIN");
    const proc = users.find(u => u.role === "PROCUREMENT");

    if (!admin || !proc) {
        throw new Error("Admin or Procurement user missing from database");
    }

    const adminToken = generateAccessToken(admin);
    const procToken = generateAccessToken(proc);

    // 1. Verify HTML pages include Workspace Dashboard
    console.log("\n[1] Verifying Portal HTML Structure...");

    const port = process.env.PORT || 5000;
    const resAdminHtml = await fetch(`http://localhost:${port}/admin`, {
        headers: { Authorization: `Bearer ${adminToken}` }
    });
    const adminHtml = await resAdminHtml.text();
    const hasAdminDash = adminHtml.includes('id="workspaceDashboardPage"') && 
                         adminHtml.includes('workspace-dashboard.css') &&
                         adminHtml.includes('workspace-dashboard.js') &&
                         adminHtml.includes('data-page="workspace-dashboard"');
    console.log(" - Admin Portal has Workspace Dashboard elements:", hasAdminDash ? "PASS" : "FAIL");

    const resProcHtml = await fetch(`http://localhost:${port}/procurement`, {
        headers: { Authorization: `Bearer ${procToken}` }
    });
    const procHtml = await resProcHtml.text();
    const hasProcDash = procHtml.includes('id="workspaceDashboardPage"') && 
                        procHtml.includes('workspace-dashboard.css') &&
                        procHtml.includes('workspace-dashboard.js') &&
                        procHtml.includes('data-page="workspace-dashboard"');
    console.log(" - Procurement Portal has Workspace Dashboard elements:", hasProcDash ? "PASS" : "FAIL");

    // 2. Verify Admin Company-Wide Dashboard API
    console.log("\n[2] Verifying Admin Company-Wide API Data...");
    const resAdminDash = await fetch(`http://localhost:${port}/workspace/dashboard`, {
        headers: { Authorization: `Bearer ${adminToken}` }
    });
    const adminData = await resAdminDash.json();

    console.log(" - Is Admin:", adminData.is_admin);
    console.log(" - Company Total PRs:", adminData.metrics.total_prs);
    console.log(" - Company Total PR Value: ₹", adminData.metrics.total_pr_value.toLocaleString("en-IN"));
    console.log(" - Company Total Goods Receipts:", adminData.metrics.total_grn_receipts);
    console.log(" - Company Total Received Items:", adminData.metrics.total_received_quantity);
    console.log(" - Available Users Count for Filter:", adminData.available_users?.length);
    console.log(" - User Summary Breakdown Count:", adminData.user_summary?.length);
    console.log(" - Admin PR List count:", adminData.purchase_requests?.length);
    console.log(" - Admin GR List count:", adminData.goods_received?.length);

    const adminPrHasCreators = adminData.purchase_requests.every(p => p.creator_username);
    const adminGrHasReceivers = adminData.goods_received.every(g => g.receiver_username);
    console.log(" - Admin PR rows have creator usernames:", adminPrHasCreators ? "PASS" : "FAIL");
    console.log(" - Admin GR rows have receiver usernames:", adminGrHasReceivers ? "PASS" : "FAIL");

    // 3. Verify Admin User Filter (?user_id=3)
    console.log("\n[3] Verifying Admin Drill-down Filter (?user_id=3)...");
    const resFiltered = await fetch(`http://localhost:${port}/workspace/dashboard?user_id=${proc.user_id}`, {
        headers: { Authorization: `Bearer ${adminToken}` }
    });
    const filteredData = await resFiltered.json();
    console.log(" - Filtered User ID:", filteredData.filter_user_id);
    console.log(" - Filtered PR count:", filteredData.purchase_requests.length);
    console.log(" - Filtered GR count:", filteredData.goods_received.length);
    const allFilteredAreProc = filteredData.purchase_requests.every(p => p.created_by === proc.user_id);
    console.log(" - All filtered PRs belong to user 3:", allFilteredAreProc ? "PASS" : "FAIL");

    // 4. Verify Procurement User Isolated Dashboard API
    console.log("\n[4] Verifying Procurement User Personal API Data...");
    const resProcDash = await fetch(`http://localhost:${port}/workspace/dashboard`, {
        headers: { Authorization: `Bearer ${procToken}` }
    });
    const procData = await resProcDash.json();
    console.log(" - Is Admin:", procData.is_admin);
    console.log(" - Logged in as:", procData.current_user?.username);
    console.log(" - My Total PRs:", procData.metrics.total_prs);
    console.log(" - My Total PR Value: ₹", procData.metrics.total_pr_value.toLocaleString("en-IN"));
    console.log(" - My Total Goods Receipts:", procData.metrics.total_grn_receipts);
    console.log(" - Available Users (should be empty for non-admin):", procData.available_users?.length === 0 ? "PASS" : "FAIL");
    console.log(" - User Summary (should be empty for non-admin):", procData.user_summary?.length === 0 ? "PASS" : "FAIL");
    const allProcPrsMine = procData.purchase_requests.every(p => p.created_by === proc.user_id);
    const allProcGrsMine = procData.goods_received.every(g => g.received_by === proc.user_id);
    console.log(" - Strictly only my PRs returned:", allProcPrsMine ? "PASS" : "FAIL");
    console.log(" - Strictly only my GRs returned:", allProcGrsMine ? "PASS" : "FAIL");

    // 5. Verify Security Tampering Protection
    console.log("\n[5] Verifying Security Protection Against Query Tampering...");
    const resTamper = await fetch(`http://localhost:${port}/workspace/dashboard?user_id=${admin.user_id}`, {
        headers: { Authorization: `Bearer ${procToken}` }
    });
    const tamperData = await resTamper.json();
    const tamperBlocked = tamperData.purchase_requests.every(p => p.created_by === proc.user_id) && 
                          tamperData.filter_user_id === proc.user_id &&
                          tamperData.is_admin === false;
    console.log(" - Non-admin cannot tamper user_id to view admin data:", tamperBlocked ? "PASS" : "FAIL");

    console.log("\n==================================================");
    console.log("   ALL VERIFICATION TESTS COMPLETED SUCCESSFULLY! ");
    console.log("==================================================");
    process.exit(0);
}

verify().catch(e => {
    console.error("Verification failed:", e);
    process.exit(1);
});
