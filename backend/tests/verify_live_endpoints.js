const http = require("http");

const BASE_URL = "http://localhost:5000";
const PORT = 5000;

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

        const options = {
            hostname: "localhost",
            port: PORT,
            path,
            method,
            headers: reqHeaders
        };

        const req = http.request(options, (res) => {
            const chunks = [];
            res.on("data", chunk => chunks.push(chunk));
            res.on("end", () => {
                const buffer = Buffer.concat(chunks);
                const contentType = res.headers["content-type"] || "";
                let data = null;
                if (contentType.includes("application/json")) {
                    try {
                        data = JSON.parse(buffer.toString("utf8"));
                    } catch {
                        data = buffer.toString("utf8");
                    }
                } else if (contentType.startsWith("text/")) {
                    data = buffer.toString("utf8");
                } else {
                    data = buffer;
                }

                resolve({
                    status: res.statusCode,
                    headers: res.headers,
                    data
                });
            });
        });

        req.on("error", reject);
        if (payload) {
            req.write(payload);
        }
        req.end();
    });
}

let total = 0;
let passed = 0;
let failed = 0;
const results = [];

function check(name, ok, details = "") {
    total++;
    if (ok) {
        passed++;
        results.push({ name, status: "PASS", details });
        console.log(`  \x1b[32m✔ [PASS]\x1b[0m ${name} ${details ? `(${details})` : ""}`);
    } else {
        failed++;
        results.push({ name, status: "FAIL", details });
        console.log(`  \x1b[31m✖ [FAIL]\x1b[0m ${name} -> ${details}`);
    }
}

async function runLiveAudit() {
    console.log(`\n======================================================`);
    console.log(`  AUDITING ALL LIVE ENDPOINTS ON HTTP://LOCALHOST:5000 `);
    console.log(`======================================================\n`);

    // 1. Public / Auth
    console.log(`-- Authentication & Public Endpoints --`);
    try {
        const res = await request({ path: "/" });
        check("GET /", res.status === 200 || res.status === 302, `Status: ${res.status}`);
    } catch (e) { check("GET /", false, e.message); }

    try {
        const res = await request({ path: "/login" });
        check("GET /login", res.status === 200, `Status: ${res.status}`);
    } catch (e) { check("GET /login", false, e.message); }

    let adminToken = "";
    try {
        const res = await request({
            method: "POST",
            path: "/login",
            body: { username: "admin", password: "Password@123" }
        });
        adminToken = res.data?.token || "";
        check("POST /login (Admin)", res.status === 200 && !!adminToken, `Role: ${res.data?.role}`);
    } catch (e) { check("POST /login (Admin)", false, e.message); }

    let procToken = "";
    try {
        const res = await request({
            method: "POST",
            path: "/login",
            body: { username: "user1", password: "Password@123" }
        });
        procToken = res.data?.token || "";
        check("POST /login (Procurement)", res.status === 200 && !!procToken, `Role: ${res.data?.role}`);
    } catch (e) { check("POST /login (Procurement)", false, e.message); }

    if (!adminToken) {
        console.error("Cannot proceed without adminToken.");
        return;
    }

    try {
        const res = await request({ path: "/verify", token: adminToken });
        check("GET /verify", res.status === 200 && res.data?.authenticated === true, `Role: ${res.data?.role}`);
    } catch (e) { check("GET /verify", false, e.message); }

    // 2. Core Business Endpoints
    console.log(`\n-- Core Business & Workspace Endpoints --`);

    const endpoints = [
        { path: "/workspace/dashboard", desc: "Workspace Dashboard Analytics" },
        { path: "/users", desc: "Users Registry (Admin)" },
        { path: "/vendors", desc: "Approved Vendors List" },
        { path: "/vendors/all", desc: "All Vendors Master (Admin)" },
        { path: "/vendors/check-gst?gst_number=24AAHPS5083K1ZO", desc: "Check GST Registry" },
        { path: "/vendor-inquiries", desc: "Vendor Inquiries (RFQs)" },
        { path: "/quotation-comparisons", desc: "Quotation & Comparisons" },
        { path: "/purchase-orders", desc: "Purchase Orders" },
        { path: "/order-tracking", desc: "Order Tracking" },
        { path: "/goods-received", desc: "Goods Received (GRN)" },
        { path: "/vendor-performance", desc: "Vendor Performance & Scoring" },
        { path: "/past-price-reference/models", desc: "Past Price Reference Item Models" },
        { path: "/management-insights", desc: "Management Insights Analytics" },
        { path: "/report-logs", desc: "Export / Report Activity Logs" },
        { path: "/audit-logs", desc: "Security Audit Logs" },
        { path: "/login-logs", desc: "User Authentication Logs" }
    ];

    for (const ep of endpoints) {
        try {
            const res = await request({ path: ep.path, token: adminToken });
            const isOk = res.status === 200 && (res.data?.success !== false);
            const countInfo = Array.isArray(res.data) ? `${res.data.length} items`
                : res.data?.vendors ? `${res.data.vendors.length} vendors`
                : res.data?.users ? `${res.data.users.length} users`
                : res.data?.inquiries ? `${res.data.inquiries.length} inquiries`
                : res.data?.purchase_orders ? `${res.data.purchase_orders.length} POs`
                : res.data?.models ? `${res.data.models.length} models`
                : res.data?.logs ? `${res.data.logs.length} logs`
                : `HTTP ${res.status}`;
            check(`GET ${ep.path}`, isOk, `${ep.desc} -> ${countInfo}`);
        } catch (e) {
            check(`GET ${ep.path}`, false, e.message);
        }
    }

    // 3. Export Endpoints
    console.log(`\n-- Export Downloads (Excel / Reports) --`);
    const exportEndpoints = [
        { path: "/vendors/export/excel", desc: "Vendor Master Excel Export" },
        { path: "/purchase-orders/export", desc: "Purchase Orders Excel Export" },
        { path: "/order-tracking/export", desc: "Order Tracking Excel Export" }
    ];

    for (const ep of exportEndpoints) {
        try {
            const res = await request({ path: ep.path, token: adminToken });
            const isOk = res.status === 200 && Buffer.isBuffer(res.data) && res.data.length > 500;
            check(`GET ${ep.path}`, isOk, `${ep.desc} -> ${res.data?.length || 0} bytes`);
        } catch (e) {
            check(`GET ${ep.path}`, false, e.message);
        }
    }

    // 4. Modular /api Routes
    console.log(`\n-- Modular API Service Routes (/api) --`);
    const apiRoutes = [
        "/api/users",
        "/api/vendors",
        "/api/purchase-orders",
        "/api/goods-received",
        "/api/approvals",
        "/api/inquiries",
        "/api/pr",
        "/api/report-logs"
    ];

    for (const p of apiRoutes) {
        try {
            const res = await request({ path: p, token: adminToken });
            check(`GET ${p}`, res.status === 200, `HTTP ${res.status}`);
        } catch (e) {
            check(`GET ${p}`, false, e.message);
        }
    }

    // 5. Security & RBAC Protection
    console.log(`\n-- Security & RBAC Enforcement Checks --`);
    try {
        const res = await request({ path: "/admin" }); // unauthenticated
        const isProtected = res.status === 302 || res.status === 401;
        check("Unauthenticated access to /admin blocked", isProtected, `HTTP ${res.status}`);
    } catch (e) { check("Unauthenticated /admin check", false, e.message); }

    if (procToken) {
        try {
            const res = await request({ path: "/users", token: procToken });
            check("Procurement role blocked from /users (403)", res.status === 403, `HTTP ${res.status}`);
        } catch (e) { check("Procurement role /users check", false, e.message); }

        try {
            const res = await request({ path: "/audit-logs", token: procToken });
            check("Procurement role blocked from /audit-logs (403)", res.status === 403, `HTTP ${res.status}`);
        } catch (e) { check("Procurement role /audit-logs check", false, e.message); }

        try {
            const res = await request({ path: "/management-insights", token: procToken });
            check("Procurement role blocked from /management-insights (403)", res.status === 403, `HTTP ${res.status}`);
        } catch (e) { check("Procurement role /management-insights check", false, e.message); }
    }

    console.log(`\n======================================================`);
    console.log(`  LIVE ENDPOINT AUDIT SUMMARY`);
    console.log(`======================================================`);
    console.log(`  Total Checks : ${total}`);
    console.log(`  Passed       : ${passed}`);
    console.log(`  Failed       : ${failed}`);
    console.log(`  Health Status: ${failed === 0 ? "100% HEALTHY - ALL ENDPOINTS OPERATIONAL" : "ISSUES FOUND"}`);
    console.log(`======================================================\n`);
}

runLiveAudit().catch(console.error);
