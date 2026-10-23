/**
 * Comprehensive Endpoint & Security Injection Audit Script
 * Tests live server on PORT (defaults to process.env.PORT || 5000)
 */

const http = require("http");
const app = require("../src/app");
let port = 0; // Use ephemeral dynamic port
let serverInstance = null;

function request({ method = "GET", path, token, body, headers = {} }) {
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

        const req = http.request({
            hostname: "localhost",
            port,
            path,
            method,
            headers: reqHeaders
        }, res => {
            const chunks = [];
            res.on("data", c => chunks.push(c));
            res.on("end", () => {
                const buffer = Buffer.concat(chunks);
                let data = null;
                const str = buffer.toString("utf8");
                try {
                    data = JSON.parse(str);
                } catch {
                    data = str;
                }
                resolve({
                    status: res.statusCode,
                    headers: res.headers,
                    cookies: res.headers["set-cookie"] || [],
                    data,
                    raw: str
                });
            });
        });

        req.on("error", reject);
        if (payload) req.write(payload);
        req.end();
    });
}

async function runAudit() {
    console.log("======================================================================");
    console.log(`    PROCUREIQ ENDPOINT & INJECTION SECURITY AUDIT (Port ${port})    `);
    console.log("======================================================================\n");

    let totalChecks = 0;
    let passedChecks = 0;
    let issuesFound = [];

    function check(title, condition, details = "") {
        totalChecks++;
        if (condition) {
            passedChecks++;
            console.log(`  [SAFE] ${title}`);
        } else {
            issuesFound.push({ title, details });
            console.log(`  [VULNERABLE / ISSUE] ${title} - ${details}`);
        }
    }

    // --- STEP 1: AUTHENTICATION ---
    console.log("--- 1. AUTHENTICATION & TOKEN ACQUISITION ---");
    const adminLogin = await request({
        method: "POST",
        path: "/login",
        body: { username: "admin", password: "Password@123" }
    });
    check("Admin login successful", adminLogin.status === 200 && adminLogin.data?.success === true);
    const adminToken = adminLogin.data?.token;

    const procLogin = await request({
        method: "POST",
        path: "/login",
        body: { username: "user1", password: "Password@123" }
    });
    check("Procurement login successful", procLogin.status === 200 && procLogin.data?.success === true);
    const procToken = procLogin.data?.token;

    // --- STEP 2: SQL INJECTION IN LOGIN GATEWAY ---
    console.log("\n--- 2. SQL INJECTION (SQLi) - AUTHENTICATION GATEWAY ---");
    const authSqliPayloads = [
        "' OR '1'='1",
        "admin' --",
        "admin' #",
        "' OR 1=1 --",
        "' UNION SELECT 1, 'hacker', '$2b$10$abcdef', 'ADMIN', 1, 1 --",
        "\" OR \"\"=\"",
        "1' OR '1' = '1' /*"
    ];

    for (const p of authSqliPayloads) {
        const res = await request({
            method: "POST",
            path: "/login",
            body: { username: p, password: "randompassword123" }
        });
        const isSafe = (res.status === 401 || res.status === 400) &&
                       !res.raw.toLowerCase().includes("syntax error") &&
                       !res.raw.toLowerCase().includes("sql") &&
                       res.data?.success !== true;
        check(`SQLi in Login (${p}) safely rejected`, isSafe, `status=${res.status}, resp=${JSON.stringify(res.data)}`);
    }

    // --- STEP 3: SQL INJECTION IN SEARCH & QUERY PARAMETERS ---
    console.log("\n--- 3. SQL INJECTION (SQLi) - SEARCH & FILTER QUERY PARAMS ---");
    const querySqliPayloads = [
        "' OR '1'='1",
        "'; DROP TABLE test; --",
        "1 UNION SELECT 1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30--",
        "%27%20OR%201=1--",
        "' AND (SELECT 1 FROM (SELECT COUNT(*), CONCAT(version(), FLOOR(RAND(0)*2)) x FROM information_schema.tables GROUP BY x) a)--"
    ];

    const searchEndpoints = [
        { path: "/order-tracking?search=", token: procToken },
        { path: "/order-tracking?party=", token: procToken },
        { path: "/order-tracking?from=", token: procToken },
        { path: "/past-price-reference?model=", token: procToken },
        { path: "/past-price-reference?make=", token: procToken },
        { path: "/report-logs?username=", token: adminToken },
        { path: "/audit-logs?action=", token: adminToken },
        { path: "/login-logs?username=", token: adminToken }
    ];

    for (const ep of searchEndpoints) {
        for (const p of querySqliPayloads) {
            const url = ep.path + encodeURIComponent(p);
            const res = await request({ method: "GET", path: url, token: ep.token });
            const isSafe = res.status !== 500 &&
                           !res.raw.toLowerCase().includes("syntax error") &&
                           !res.raw.toLowerCase().includes("sql") &&
                           !res.raw.toLowerCase().includes("mysql");
            check(`SQLi in ${ep.path} with payload (${p.slice(0, 15)})`, isSafe, `status=${res.status}, error=${res.raw.slice(0, 80)}`);
        }
    }

    // --- STEP 4: SQL INJECTION IN ROUTE PARAMETERS (ID INJECTION) ---
    console.log("\n--- 4. SQL INJECTION (SQLi) - ROUTE / PATH PARAMETERS ---");
    const routeIdPayloads = [
        "1' OR '1'='1",
        "1; SELECT 1",
        "1 UNION SELECT 1,2,3",
        "99999 OR 1=1",
        "../../etc/passwd"
    ];

    const idEndpoints = [
        { prefix: "/vendors/", token: procToken },
        { prefix: "/purchase-orders/", token: procToken },
        { prefix: "/vendor-inquiries/", token: procToken },
        { prefix: "/goods-received/", token: procToken },
        { prefix: "/vendor-performance/", token: procToken }
    ];

    for (const ep of idEndpoints) {
        for (const p of routeIdPayloads) {
            const res = await request({ method: "GET", path: ep.prefix + encodeURIComponent(p), token: ep.token });
            // Should be 400 Bad Request (Invalid ID) or 404, never 500 or SQL leak
            const isSafe = (res.status === 400 || res.status === 404) &&
                           !res.raw.toLowerCase().includes("syntax error") &&
                           !res.raw.toLowerCase().includes("mysql");
            check(`Route param injection in ${ep.prefix}${p}`, isSafe, `status=${res.status}, resp=${JSON.stringify(res.data)}`);
        }
    }

    // --- STEP 5: PATH TRAVERSAL IN DOWNLOAD / STATIC ENDPOINTS ---
    console.log("\n--- 5. PATH TRAVERSAL & ARBITRARY FILE ACCESS ---");
    const traversalPayloads = [
        "../../../etc/passwd",
        "..\\..\\..\\Windows\\System32\\drivers\\etc\\hosts",
        "....//....//....//package.json",
        "%2e%2e%2f%2e%2e%2fpackage.json",
        "..%2f..%2f.env"
    ];

    for (const p of traversalPayloads) {
        // Test PDF download endpoint
        const poDlRes = await request({ method: "GET", path: `/purchase-orders/${encodeURIComponent(p)}/download`, token: procToken });
        check(`Path traversal in /purchase-orders/:id/download (${p.slice(0, 15)})`, poDlRes.status === 400 || poDlRes.status === 404);

        // Test static vendor folder
        const vendorRes = await request({ method: "GET", path: `/backend/vendor/${p}`, token: procToken });
        check(`Path traversal in /backend/vendor/ (${p.slice(0, 15)})`, vendorRes.status === 404 || vendorRes.status === 403 || vendorRes.status === 400);
    }

    // --- STEP 6: RBAC & PRIVILEGE ESCALATION AUDIT ---
    console.log("\n--- 6. RBAC & PRIVILEGE ESCALATION AUDIT ---");
    const adminRestrictedRoutes = [
        { method: "GET", path: "/users" },
        { method: "POST", path: "/users", body: { username: "hacker", password: "password123", role: "ADMIN" } },
        { method: "PUT", path: "/users/1/password", body: { password: "newpassword123" } },
        { method: "PUT", path: "/users/1/access", body: { is_active: false } },
        { method: "DELETE", path: "/users/1" },
        { method: "GET", path: "/vendors/all" },
        { method: "PUT", path: "/vendors/1", body: { vendor_name: "Tampered" } },
        { method: "PUT", path: "/vendors/1/bank", body: { bank_name: "Tampered Bank" } },
        { method: "DELETE", path: "/vendors/1" },
        { method: "GET", path: "/audit-logs" },
        { method: "GET", path: "/login-logs" },
        { method: "GET", path: "/management-insights" },
        { method: "GET", path: "/report-logs" },
        { method: "POST", path: "/vendor-inquiries/1/cancel" },
        { method: "POST", path: "/vendor-inquiries/1/select-vendor", body: { vendor_id: 1 } },
        { method: "POST", path: "/purchase-orders/1/cancel" },
        { method: "POST", path: "/purchase-orders/1/reselect" },
        { method: "POST", path: "/vendor-performance/1/blacklist", body: { reason: "test" } },
        { method: "POST", path: "/vendor-performance/1/unblacklist", body: { reason: "test" } }
    ];

    for (const r of adminRestrictedRoutes) {
        // Test 1: Unauthenticated request must be 401
        const unauth = await request({ method: r.method, path: r.path, body: r.body });
        check(`Unauthenticated ${r.method} ${r.path} returns 401 Unauthorized`, unauth.status === 401, `got status ${unauth.status}`);

        // Test 2: Procurement user accessing Admin route must be 403 Forbidden
        const procOnAdmin = await request({ method: r.method, path: r.path, token: procToken, body: r.body });
        check(`Procurement user on Admin route ${r.method} ${r.path} returns 403 Forbidden`, procOnAdmin.status === 403, `got status ${procOnAdmin.status}`);
    }

    // --- STEP 7: SENSITIVE DATA EXPOSURE / STACK TRACES ---
    console.log("\n--- 7. INFORMATION DISCLOSURE & ERROR HANDLING ---");
    const badReq = await request({
        method: "POST",
        path: "/goods-received",
        token: procToken,
        body: { po_id: "not_a_number", received_quantity: -10 }
    });
    check("Malformed POST /goods-received returns 400 Bad Request", badReq.status === 400);
    check("Response does not leak database stack traces", !badReq.raw.includes("at ") && !badReq.raw.includes("node_modules"));

    // --- AUDIT REPORT SUMMARY ---
    console.log("\n======================================================================");
    console.log(`AUDIT SUMMARY: ${passedChecks}/${totalChecks} checks passed.`);
    if (issuesFound.length === 0) {
        console.log("STATUS: ALL INJECTION AND ENDPOINT SECURITY CHECKS PASSED!");
    } else {
        console.log(`STATUS: ${issuesFound.length} POTENTIAL CONCERNS DETECTED:`);
        issuesFound.forEach((iss, idx) => console.log(`  ${idx + 1}. ${iss.title} (${iss.details})`));
    }
    console.log("======================================================================\n");
}

async function main() {
    serverInstance = app.listen(port, async () => {
        port = serverInstance.address().port;
        try {
            await runAudit();
        } catch (err) {
            console.error("Audit Execution Error:", err);
            process.exitCode = 1;
        } finally {
            serverInstance.close();
            process.exit(process.exitCode || 0);
        }
    });
}

main();
