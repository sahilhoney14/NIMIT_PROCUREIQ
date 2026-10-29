const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 5000;

function httpRequest({ method = "GET", urlPath, token, body, headers = {} }) {
    return new Promise((resolve, reject) => {
        const reqHeaders = { "x-test-bypass-rate-limit": "1", ...headers };
        let payload = null;

        if (token) {
            reqHeaders["Authorization"] = `Bearer ${token}`;
        }
        if (body) {
            reqHeaders["Content-Type"] = "application/json";
            payload = typeof body === "string" ? body : JSON.stringify(body);
            reqHeaders["Content-Length"] = Buffer.byteLength(payload);
        }

        const options = {
            hostname: "localhost",
            port: PORT,
            path: urlPath,
            method,
            headers: reqHeaders
        };

        const req = http.request(options, (res) => {
            const chunks = [];
            res.on("data", c => chunks.push(c));
            res.on("end", () => {
                const raw = Buffer.concat(chunks).toString("utf8");
                let json = null;
                try { json = JSON.parse(raw); } catch {}
                resolve({
                    status: res.statusCode,
                    headers: res.headers,
                    raw,
                    json
                });
            });
        });

        req.on("error", reject);
        if (payload) req.write(payload);
        req.end();
    });
}

const checks = [];
function assert(category, name, condition, details = "") {
    checks.push({ category, name, condition: !!condition, details });
    const mark = condition ? "\x1b[32m✔ PASS\x1b[0m" : "\x1b[31m✖ FAIL\x1b[0m";
    console.log(`  [${category}] ${mark}: ${name} ${details ? `(${details})` : ""}`);
}

async function runSiteHealthCheck() {
    console.log("\n===============================================================================");
    console.log("            PROCUREIQ FULL SITE HEALTH & WORKFLOW VERIFICATION                ");
    console.log(`                       Target: http://localhost:${PORT}                       `);
    console.log("===============================================================================\n");

    // 1. PUBLIC & AUTHENTICATION FLOW
    console.log("--> Category 1: Authentication & RBAC Access Control");
    const rootRes = await httpRequest({ urlPath: "/" });
    assert("Auth", "Landing page accessible", rootRes.status === 200 || rootRes.status === 302, `HTTP ${rootRes.status}`);

    const loginPageRes = await httpRequest({ urlPath: "/login" });
    assert("Auth", "Login page serves HTML interface", loginPageRes.status === 200 && loginPageRes.raw.includes("ProcureIQ"), `HTTP ${loginPageRes.status}`);

    const adminLoginRes = await httpRequest({
        method: "POST",
        urlPath: "/login",
        body: { username: "admin", password: "Password@123" }
    });
    const adminToken = adminLoginRes.json?.token;
    assert("Auth", "Admin login succeeds with JWT and ADMIN role", adminLoginRes.status === 200 && adminLoginRes.json?.role === "ADMIN" && !!adminToken, `Role: ${adminLoginRes.json?.role}`);

    const procLoginRes = await httpRequest({
        method: "POST",
        urlPath: "/login",
        body: { username: "user1", password: "Password@123" }
    });
    const procToken = procLoginRes.json?.token;
    assert("Auth", "Procurement user login succeeds with JWT and PROCUREMENT role", procLoginRes.status === 200 && procLoginRes.json?.role === "PROCUREMENT" && !!procToken, `Role: ${procLoginRes.json?.role}`);

    const unauthRes = await httpRequest({ urlPath: "/admin" });
    assert("Auth", "Unauthenticated access to /admin blocked", unauthRes.status === 302 || unauthRes.status === 401, `HTTP ${unauthRes.status}`);

    const rbacUserRes = await httpRequest({ urlPath: "/users", token: procToken });
    assert("Auth", "Procurement user blocked from Admin-only /users with 403 Forbidden", rbacUserRes.status === 403, `HTTP ${rbacUserRes.status}`);

    const rbacAuditRes = await httpRequest({ urlPath: "/audit-logs", token: procToken });
    assert("Auth", "Procurement user blocked from Admin-only /audit-logs with 403 Forbidden", rbacAuditRes.status === 403, `HTTP ${rbacAuditRes.status}`);

    // 2. STATIC ASSETS & JAVASCRIPT / CSS FILES
    console.log("\n--> Category 2: Static Assets & Client Bundles");
    const adminCss = await httpRequest({ urlPath: "/admin/style.css", token: adminToken });
    assert("Assets", "Admin stylesheet (/admin/style.css) loads with 200 OK", adminCss.status === 200 && adminCss.raw.includes("sidebar"), `Size: ${adminCss.raw.length} bytes`);

    const adminJs = await httpRequest({ urlPath: "/admin/script.js", token: adminToken });
    assert("Assets", "Admin script bundle (/admin/script.js) loads with 200 OK", adminJs.status === 200, `Size: ${adminJs.raw.length} bytes`);

    const procCss = await httpRequest({ urlPath: "/procurement/style.css", token: procToken });
    assert("Assets", "Procurement stylesheet (/procurement/style.css) loads with 200 OK", procCss.status === 200 && procCss.raw.includes("nav-submenu"), `Size: ${procCss.raw.length} bytes`);

    const procJs = await httpRequest({ urlPath: "/procurement/script.js", token: procToken });
    assert("Assets", "Procurement script bundle (/procurement/script.js) loads with 200 OK", procJs.status === 200 && procJs.raw.includes("nav-dropdown-toggle"), `Size: ${procJs.raw.length} bytes`);

    const sharedJs = await httpRequest({ urlPath: "/shared/js/workspace-dashboard.js" });
    assert("Assets", "Shared workspace dashboard bundle (/shared/js/workspace-dashboard.js) loads with 200 OK", sharedJs.status === 200, `Size: ${sharedJs.raw.length} bytes`);

    // 3. UI PARITY & SIDEBAR STRUCTURE (Admin vs Procurement)
    console.log("\n--> Category 3: UI Parity (Sidebar, Dashboard & Quotations Modal)");
    const adminPage = await httpRequest({ urlPath: "/admin", token: adminToken });
    const procPage = await httpRequest({ urlPath: "/procurement", token: procToken });

    assert("UI Parity", "Admin portal returns HTTP 200 with injected session", adminPage.status === 200 && adminPage.raw.includes("window.currentUsername=\"admin\""));
    assert("UI Parity", "Procurement portal returns HTTP 200 with injected session", procPage.status === 200 && procPage.raw.includes("window.currentUsername=\"user1\""));

    // Check procurement sidebar matching admin
    assert("UI Parity", "Procurement has modern sidebar (<aside class=\"sidebar\" id=\"mainSidebar\">)", procPage.raw.includes('id="mainSidebar"'));
    assert("UI Parity", "Procurement has modern dropdown group (.nav-dropdown-group)", procPage.raw.includes('class="nav-dropdown-group'));
    assert("UI Parity", "Procurement has modern dropdown toggle button (.nav-dropdown-toggle)", procPage.raw.includes('class="nav-dropdown-toggle'));
    assert("UI Parity", "Procurement has modern tree submenu (.nav-submenu)", procPage.raw.includes('class="nav-submenu"'));
    assert("UI Parity", "Procurement has modern bullet dot item (.submenu-dot)", procPage.raw.includes('class="submenu-dot"'));

    // Check dashboard table headers
    assert("UI Parity", "Procurement PR table contains Created By column header", procPage.raw.includes('id="wdThPrCreator"'));
    assert("UI Parity", "Procurement GR table contains Received By column header", procPage.raw.includes('id="wdThGrReceiver"'));

    // Check vendor selection modal in procurement
    assert("UI Parity", "Procurement HTML has #selectVendorModal for Quotation Comparisons", procPage.raw.includes('id="selectVendorModal"'));
    assert("UI Parity", "Procurement JS contains confirmVendorSelection handler", procJs.raw.includes("confirmVendorSelection"));
    assert("UI Parity", "Procurement JS contains select-vendor-btn click binding", procJs.raw.includes("select-vendor-btn"));

    // 4. PERMISSIONS: SELECT VENDOR ENDPOINT
    console.log("\n--> Category 4: Quotation & Comparisons Vendor Selection RBAC Check");
    // Attempting select-vendor with procurement token:
    // If permission was denied, server would return 403 Forbidden.
    // Since permission is granted, validation will process the inquiry ID (returns 400 for bad ID or 404 for nonexistent, but NOT 403!)
    const selectVendorTest = await httpRequest({
        method: "POST",
        urlPath: "/vendor-inquiries/999999/select-vendor",
        token: procToken,
        body: { inquiry_vendor_id: 999999 }
    });
    assert(
        "Permissions",
        "POST /vendor-inquiries/:id/select-vendor permits PROCUREMENT role (No 403 Forbidden)",
        selectVendorTest.status !== 403,
        `Status: ${selectVendorTest.status} (${selectVendorTest.json?.message || "Processed"})`
    );

    // 5. CORE WORKSPACE & BUSINESS APIS
    console.log("\n--> Category 5: Live API Endpoints & Core Data Operations");
    const wsDashboard = await httpRequest({ urlPath: "/workspace/dashboard", token: procToken });
    assert("APIs", "GET /workspace/dashboard returns HTTP 200 with pipeline metrics", wsDashboard.status === 200 && wsDashboard.json?.success === true, `User: ${wsDashboard.json?.user?.username}, PRs: ${wsDashboard.json?.pipeline?.total_prs || 0}`);

    const wsAdminDashboard = await httpRequest({ urlPath: "/workspace/dashboard", token: adminToken });
    assert("APIs", "GET /workspace/dashboard (Admin) returns company metrics & users", wsAdminDashboard.status === 200 && wsAdminDashboard.json?.is_admin === true, `Company PRs: ${wsAdminDashboard.json?.pipeline?.total_prs || 0}`);

    const inquiries = await httpRequest({ urlPath: "/vendor-inquiries", token: procToken });
    assert("APIs", "GET /vendor-inquiries returns HTTP 200", inquiries.status === 200);

    const comparisons = await httpRequest({ urlPath: "/quotation-comparisons", token: procToken });
    assert("APIs", "GET /quotation-comparisons returns HTTP 200", comparisons.status === 200);

    const pos = await httpRequest({ urlPath: "/purchase-orders", token: procToken });
    assert("APIs", "GET /purchase-orders returns HTTP 200", pos.status === 200);

    const goods = await httpRequest({ urlPath: "/goods-received", token: procToken });
    assert("APIs", "GET /goods-received returns HTTP 200", goods.status === 200);

    const vendors = await httpRequest({ urlPath: "/vendors", token: procToken });
    assert("APIs", "GET /vendors returns HTTP 200", vendors.status === 200, `${vendors.json?.length || 0} vendors`);

    const pastPrices = await httpRequest({ urlPath: "/past-price-reference/models", token: procToken });
    assert("APIs", "GET /past-price-reference/models returns HTTP 200", pastPrices.status === 200);

    // SUMMARY
    const totalChecks = checks.length;
    const passedChecks = checks.filter(c => c.condition).length;
    const failedChecks = totalChecks - passedChecks;

    console.log("\n===============================================================================");
    console.log("                        FINAL SITE HEALTH REPORT                               ");
    console.log("===============================================================================");
    console.log(`  Total Verification Checks : ${totalChecks}`);
    console.log(`  Passed Checks             : ${passedChecks}`);
    console.log(`  Failed Checks             : ${failedChecks}`);
    console.log(`  Pass Rate                 : ${((passedChecks / totalChecks) * 100).toFixed(1)}%`);
    console.log("===============================================================================");

    if (failedChecks === 0) {
        console.log("\n>>> SITE STATUS: 100% PERFECTLY OPERATIONAL AND FUNCTIONING FLAWLESSLY! <<<\n");
    } else {
        console.log("\n>>> SITE STATUS: ISSUES DETECTED - INSPECT FAILED CHECKS ABOVE <<<\n");
    }

    process.exit(failedChecks === 0 ? 0 : 1);
}

runSiteHealthCheck().catch(err => {
    console.error("Test execution failed:", err);
    process.exit(1);
});
