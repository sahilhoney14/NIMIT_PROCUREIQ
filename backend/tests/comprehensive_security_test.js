/**
 * ProcureIQ Comprehensive Security & Endpoint Test Suite
 * Validates authentication, RBAC, input validation, SQL injection safety,
 * token invalidation, and data security.
 */

const http = require("http");

function request(options, data, headers = {}) {
    return new Promise((resolve, reject) => {
        const mergedHeaders = { ...options.headers, ...headers };
        if (data && typeof data === "object" && !(data instanceof Buffer) && !mergedHeaders["Content-Type"]) {
            mergedHeaders["Content-Type"] = "application/json";
        }

        const req = http.request({ ...options, headers: mergedHeaders }, (res) => {
            let body = "";
            res.on("data", chunk => body += chunk);
            res.on("end", () => {
                let parsed = null;
                try {
                    parsed = JSON.parse(body);
                } catch {
                    parsed = body;
                }
                resolve({
                    status: res.statusCode,
                    headers: res.headers,
                    cookies: res.headers["set-cookie"] || [],
                    data: parsed
                });
            });
        });
        req.on("error", reject);
        if (data) {
            req.write(typeof data === "string" || data instanceof Buffer ? data : JSON.stringify(data));
        }
        req.end();
    });
}

function extractCookie(cookies, name) {
    const prefix = `${name}=`;
    const found = cookies.find(c => c.startsWith(prefix));
    return found ? found.split(";")[0] : null;
}

async function runSuite() {
    console.log("======================================================================");
    console.log("    PROCUREIQ ENTERPRISE ENDPOINT & COMPREHENSIVE SECURITY AUDIT    ");
    console.log("======================================================================\n");

    let totalTests = 0;
    let passedTests = 0;
    let failedTests = 0;

    function assert(name, condition, details = "") {
        totalTests++;
        if (condition) {
            passedTests++;
            console.log(`  [PASS] ${name}`);
        } else {
            failedTests++;
            console.log(`  [FAIL] ${name} ${details ? `(${details})` : ""}`);
        }
    }

    // -------------------------------------------------------------------------
    // 1. PUBLIC AND AUTHENTICATION GATEWAY
    // -------------------------------------------------------------------------
    console.log("--- 1. AUTHENTICATION & LOGIN GATEWAY TESTS ---");

    // 1.1 Unauthenticated login page
    const loginPage = await request({ hostname: "localhost", port: 3000, path: "/login", method: "GET" });
    assert("GET /login returns 200 with HTML login page", loginPage.status === 200 && typeof loginPage.data === "string");

    // 1.2 Invalid credentials rejected
    const badLogin = await request({ hostname: "localhost", port: 3000, path: "/login", method: "POST" }, { username: "admin", password: "WrongPassword!999" });
    assert("POST /login with bad credentials returns 401 Unauthorized", badLogin.status === 401 && badLogin.data.success === false);

    // 1.3 Missing credentials rejected
    const emptyLogin = await request({ hostname: "localhost", port: 3000, path: "/login", method: "POST" }, { username: "", password: "" });
    assert("POST /login with empty credentials returns 401", emptyLogin.status === 401 && emptyLogin.data.success === false);

    // 1.4 Admin Login
    const adminLogin = await request({ hostname: "localhost", port: 3000, path: "/login", method: "POST" }, { username: "admin", password: "Password@123" });
    assert("POST /login as ADMIN returns 200 with JWT tokens", adminLogin.status === 200 && adminLogin.data.success === true && adminLogin.data.role === "ADMIN");
    const adminToken = adminLogin.data.token;
    const adminCookies = adminLogin.cookies;

    // Check cookie flags
    const hasHttpOnly = adminCookies.some(c => c.toLowerCase().includes("httponly"));
    const hasSameSite = adminCookies.some(c => c.toLowerCase().includes("samesite=lax"));
    assert("Auth cookies contain HttpOnly flag", hasHttpOnly);
    assert("Auth cookies contain SameSite=Lax flag", hasSameSite);

    // 1.5 Procurement Login
    const procLogin = await request({ hostname: "localhost", port: 3000, path: "/login", method: "POST" }, { username: "procurement", password: "Password@123" });
    assert("POST /login as PROCUREMENT returns 200", procLogin.status === 200 && procLogin.data.role === "PROCUREMENT");
    const procToken = procLogin.data.token;

    // -------------------------------------------------------------------------
    // 2. UNAUTHENTICATED ENDPOINT ACCESS PROTECTION
    // -------------------------------------------------------------------------
    console.log("\n--- 2. UNAUTHENTICATED ACCESS PREVENTION (EXPECT 401 / REDIRECT) ---");

    // HTML route without auth redirects
    const anonAdminHtml = await request({ hostname: "localhost", port: 3000, path: "/admin", method: "GET", headers: { "Accept": "text/html" } });
    assert("GET /admin (HTML) without token redirects to /?reason=unauthenticated", anonAdminHtml.status === 302 && anonAdminHtml.headers.location === "/?reason=unauthenticated");

    const anonManagerHtml = await request({ hostname: "localhost", port: 3000, path: "/procurement-manager", method: "GET", headers: { "Accept": "text/html" } });
    assert("GET /procurement-manager (HTML) without token redirects", anonManagerHtml.status === 302 && anonManagerHtml.headers.location === "/?reason=unauthenticated");

    const anonProcHtml = await request({ hostname: "localhost", port: 3000, path: "/procurement", method: "GET", headers: { "Accept": "text/html" } });
    assert("GET /procurement (HTML) without token redirects", anonProcHtml.status === 302 && anonProcHtml.headers.location === "/?reason=unauthenticated");

    // API routes without auth return 401
    const unauthRoutes = [
        { path: "/verify", method: "GET" },
        { path: "/users", method: "GET" },
        { path: "/vendors", method: "GET" },
        { path: "/vendors/all", method: "GET" },
        { path: "/order-tracking", method: "GET" },
        { path: "/purchase-orders", method: "GET" },
        { path: "/management-insights", method: "GET" },
        { path: "/report-logs", method: "GET" },
        { path: "/audit-logs", method: "GET" },
        { path: "/login-logs", method: "GET" },
        { path: "/past-price-reference", method: "GET" }
    ];

    for (const r of unauthRoutes) {
        const res = await request({ hostname: "localhost", port: 3000, path: r.path, method: r.method });
        assert(`Unauthenticated ${r.method} ${r.path} returns 401`, res.status === 401, `got status ${res.status}`);
    }

    // -------------------------------------------------------------------------
    // 3. ROLE-BASED ACCESS CONTROL & PRIVILEGE ESCALATION GUARDS
    // -------------------------------------------------------------------------
    console.log("\n--- 3. ROLE-BASED ACCESS CONTROL (RBAC) & PRIVILEGE ESCALATION ---");

    // Procurement user trying to access ADMIN routes (expect 403 Forbidden)
    const procOnAdminRoutes = [
        "/users",
        "/vendors/all",
        "/audit-logs",
        "/login-logs",
        "/management-insights",
        "/report-logs"
    ];

    for (const route of procOnAdminRoutes) {
        const res = await request(
            { hostname: "localhost", port: 3000, path: route, method: "GET" },
            null,
            { "Authorization": `Bearer ${procToken}` }
        );
        assert(`PROCUREMENT role accessing ADMIN route ${route} returns 403 Forbidden`, res.status === 403, `got ${res.status}`);
    }

    // Authorized Admin Access (expect 200 OK across all portals and sensitive routes)
    const adminUsers = await request(
        { hostname: "localhost", port: 3000, path: "/users", method: "GET" },
        null,
        { "Authorization": `Bearer ${adminToken}` }
    );
    assert("ADMIN role accessing /users returns 200 OK", adminUsers.status === 200 && (Array.isArray(adminUsers.data) || Array.isArray(adminUsers.data?.users)));

    const adminVendorsAll = await request(
        { hostname: "localhost", port: 3000, path: "/vendors/all", method: "GET" },
        null,
        { "Authorization": `Bearer ${adminToken}` }
    );
    assert("ADMIN role accessing /vendors/all returns 200 OK", adminVendorsAll.status === 200 && adminVendorsAll.data.success === true);

    const adminAuditLogs = await request(
        { hostname: "localhost", port: 3000, path: "/audit-logs", method: "GET" },
        null,
        { "Authorization": `Bearer ${adminToken}` }
    );
    assert("ADMIN role accessing /audit-logs returns 200 OK", adminAuditLogs.status === 200 && adminAuditLogs.data.success === true);

    const adminLoginLogs = await request(
        { hostname: "localhost", port: 3000, path: "/login-logs", method: "GET" },
        null,
        { "Authorization": `Bearer ${adminToken}` }
    );
    assert("ADMIN role accessing /login-logs returns 200 OK", adminLoginLogs.status === 200 && adminLoginLogs.data.success === true);

    // Authorized Procurement Access (expect 200 OK)
    const procOrderTracking = await request(
        { hostname: "localhost", port: 3000, path: "/order-tracking", method: "GET" },
        null,
        { "Authorization": `Bearer ${procToken}` }
    );
    assert("PROCUREMENT role accessing /order-tracking returns 200 OK", procOrderTracking.status === 200 && procOrderTracking.data.success === true);

    const procVendors = await request(
        { hostname: "localhost", port: 3000, path: "/vendors", method: "GET" },
        null,
        { "Authorization": `Bearer ${procToken}` }
    );
    assert("PROCUREMENT role accessing /vendors returns 200 OK", procVendors.status === 200 && procVendors.data.success === true);

    // -------------------------------------------------------------------------
    // 4. SQL INJECTION RESILIENCE & INPUT HARDENING
    // -------------------------------------------------------------------------
    console.log("\n--- 4. SQL INJECTION RESILIENCE & PARAMETERIZED QUERIES ---");

    const sqliPayloads = [
        "' OR '1'='1",
        "'; DROP TABLE users; --",
        "1 UNION SELECT 1,2,3,4,5,6,7,8,9,10--",
        "admin'--",
        "' OR 1=1#"
    ];

    for (const payload of sqliPayloads) {
        const encoded = encodeURIComponent(payload);
        const res = await request(
            { hostname: "localhost", port: 3000, path: `/order-tracking?search=${encoded}`, method: "GET" },
            null,
            { "Authorization": `Bearer ${procToken}` }
        );
        assert(`SQL Injection payload (${payload.slice(0, 15)}...) handled safely`, res.status === 200 && res.data.success === true, `status: ${res.status}`);
    }

    // -------------------------------------------------------------------------
    // 5. INPUT VALIDATION DEFENSES
    // -------------------------------------------------------------------------
    console.log("\n--- 5. INPUT VALIDATION & BUSINESS LOGIC DEFENSES ---");

    // Rejection of invalid vendor numeric names
    const invalidVendor = await request(
        { hostname: "localhost", port: 3000, path: "/vendors", method: "POST" },
        { vendor_data: JSON.stringify({ vendor_name: "12345678", office_contact_name: "999" }) },
        { "Authorization": `Bearer ${procToken}` }
    );
    assert("Rejects numeric-only vendor names with 400 Bad Request", invalidVendor.status === 400 && invalidVendor.data.success === false);

    // Rejection of invalid phone numbers
    const invalidPhoneVendor = await request(
        { hostname: "localhost", port: 3000, path: "/vendors", method: "POST" },
        { vendor_data: JSON.stringify({ vendor_name: "Valid Corp", office_contact_number: "123" }) },
        { "Authorization": `Bearer ${procToken}` }
    );
    assert("Rejects invalid contact phone numbers with 400 Bad Request", invalidPhoneVendor.status === 400 && invalidPhoneVendor.data.success === false);

    // -------------------------------------------------------------------------
    // 6. TOKEN REVOCATION & SESSION LOGOUT LIFECYCLE
    // -------------------------------------------------------------------------
    console.log("\n--- 6. TOKEN REVOCATION & SESSION LIFECYCLE ---");

    // Login a dedicated temporary user to test logout
    const tempLogin = await request({ hostname: "localhost", port: 3000, path: "/login", method: "POST" }, { username: "procurement", password: "Password@123" });
    const tempToken = tempLogin.data.token;
    const tempCookie = extractCookie(tempLogin.cookies, "jwt_token");

    // Verify token works
    const verifyBefore = await request(
        { hostname: "localhost", port: 3000, path: "/verify", method: "GET" },
        null,
        { "Authorization": `Bearer ${tempToken}` }
    );
    assert("Active token verifies successfully before logout", verifyBefore.status === 200 && verifyBefore.data.authenticated === true);

    // Logout
    const logoutRes = await request(
        { hostname: "localhost", port: 3000, path: "/logout", method: "POST" },
        null,
        { "Authorization": `Bearer ${tempToken}`, "Cookie": tempCookie }
    );
    assert("POST /logout revokes session and clears cookies", logoutRes.status === 200 && logoutRes.data.success === true);

    // Verify token is NOW REVOKED (token_version was incremented)
    const verifyAfter = await request(
        { hostname: "localhost", port: 3000, path: "/verify", method: "GET" },
        null,
        { "Authorization": `Bearer ${tempToken}` }
    );
    assert("Token immediately rejected as 401 after logout (token version revoked)", verifyAfter.status === 401 && verifyAfter.data.authenticated === false);

    // -------------------------------------------------------------------------
    // 7. SUMMARY
    // -------------------------------------------------------------------------
    console.log("\n======================================================================");
    console.log(`AUDIT RESULTS: Total: ${totalTests} | Passed: ${passedTests} | Failed: ${failedTests}`);
    console.log("======================================================================");

    if (failedTests > 0) {
        process.exit(1);
    } else {
        process.exit(0);
    }
}

runSuite().catch(err => {
    console.error("Test Suite Unhandled Exception:", err);
    process.exit(1);
});
