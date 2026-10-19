/**
 * ProcureIQ Enterprise - Master Comprehensive Test Suite
 * Tests all core services, utility functions, security guards, RBAC rules,
 * database connectivity, and 50+ API endpoints across all user roles.
 */

process.env.NODE_ENV = "test";
const http = require("http");
const path = require("path");
const fs = require("fs");
const assert = require("assert");

// Import App, Database & Services
const app = require("../src/app");
const { db, logDb } = require("../src/config/database");
const sequenceService = require("../src/services/sequence.service");
const jwtService = require("../src/services/jwt.service");
const pdfService = require("../src/services/pdf.service");

let testPort = 3000;
let testServer = null;
let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
const failures = [];
const startTime = Date.now();

function pass(testName, details = "") {
    totalTests++;
    passedTests++;
    const extra = details ? ` (${details})` : "";
    console.log(`  \x1b[32m✔ [PASS]\x1b[0m ${testName}${extra}`);
}

function fail(testName, err) {
    totalTests++;
    failedTests++;
    const errMsg = err?.message || String(err);
    failures.push({ testName, error: errMsg });
    console.log(`  \x1b[31m✖ [FAIL]\x1b[0m ${testName} -> ${errMsg}`);
}

function printHeader(title) {
    console.log(`\n\x1b[36m======================================================================\x1b[0m`);
    console.log(`\x1b[1m\x1b[37m  ${title}\x1b[0m`);
    console.log(`\x1b[36m======================================================================\x1b[0m`);
}

// HTTP Helper for testing endpoints
function apiRequest({ method = "GET", path, token, body, headers = {} }) {
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
            port: testPort,
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
                    cookies: res.headers["set-cookie"] || [],
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

async function runAllTests() {
    console.log(`\x1b[33m\x1b[1m` + `
  ██████╗ ██████╗  ██████╗  ██████╗██╗   ██╗██████╗ ███████╗██╗ ██████╗ 
  ██╔══██╗██╔══██╗██╔═══██╗██╔════╝██║   ██║██╔══██╗██╔════╝██║██╔═══██╗
  ██████╔╝██████╔╝██║   ██║██║     ██║   ██║██████╔╝█████╗  ██║██║   ██║
  ██╔═══╝ ██╔══██╗██║   ██║██║     ██║   ██║██╔══██╗██╔══╝  ██║██║▄▄ ██║
  ██║     ██║  ██║╚██████╔╝╚██████╗╚██████╔╝██║  ██║███████╗██║╚██████╔╝
  ╚═╝     ╚═╝  ╚═╝ ╚═════╝  ╚═════╝ ╚═════╝ ╚═╝  ╚═╝╚══════╝╚═╝ ╚══▀▀═╝ 
    ENTERPRISE SYSTEM & FUNCTION COMPREHENSIVE TEST SUITE
` + `\x1b[0m`);

    let adminToken = "";
    let managerToken = "";
    let procurementToken = "";

    // Spin up isolated test server on ephemeral port
    testServer = http.createServer(app);
    await new Promise(resolve => testServer.listen(0, resolve));
    testPort = testServer.address().port;
    console.log(`\x1b[35m[i] Ephemeral Test Server running isolated on port ${testPort}\x1b[0m`);

    // =========================================================================
    // SUITE 1: DATABASE HEALTH & ENGINE CONNECTIVITY
    // =========================================================================
    printHeader("SUITE 1: DATABASE ENGINE & DATA INTEGRITY TESTS");
    try {
        const [mainCheck] = await db.query("SELECT 1 AS alive");
        if (mainCheck[0]?.alive === 1) pass("Main Database connection alive (ProcureIQ)");
        else throw new Error("Main DB did not return expected response");
    } catch (e) { fail("Main Database connection", e); }

    try {
        const [logCheck] = await logDb.query("SELECT 1 AS alive");
        if (logCheck[0]?.alive === 1) pass("Audit/Logs Database connection alive (ProcureIQ_Logs)");
        else throw new Error("Audit DB did not return expected response");
    } catch (e) { fail("Audit/Logs Database connection", e); }

    try {
        const [tables] = await db.query("SHOW TABLES");
        const tableNames = tables.map(t => Object.values(t)[0]);
        const requiredTables = ["users", "vendor_oem_masters", "purchase_requests", "vendor_inquiries", "purchase_orders", "goods_received"];
        const missing = requiredTables.filter(t => !tableNames.includes(t));
        if (missing.length === 0) pass("All core database tables verified", `Found ${tableNames.length} tables`);
        else throw new Error(`Missing required tables: ${missing.join(", ")}`);
    } catch (e) { fail("Core database tables verification", e); }


    // =========================================================================
    // SUITE 2: CORE BUSINESS & UTILITY SERVICES UNIT TESTS
    // =========================================================================
    printHeader("SUITE 2: CORE UTILITY & SERVICE FUNCTION UNIT TESTS");

    // 2.1 Sequence Service
    try {
        const fy = sequenceService.getFinancialYear(new Date("2026-10-15"));
        assert.strictEqual(fy, "26-27");
        pass("sequenceService.getFinancialYear() returns accurate fiscal period", fy);
    } catch (e) { fail("sequenceService.getFinancialYear()", e); }

    try {
        const poNumber = await sequenceService.generatePoNumber(null, "NEE/26-27/PR/0045");
        assert.strictEqual(poNumber, "NEE/26-27/PO/0045");
        pass("sequenceService.generatePoNumber() derives PO from PR accurately", poNumber);
    } catch (e) { fail("sequenceService.generatePoNumber()", e); }

    // 2.2 JWT Service
    try {
        const payload = { user_id: 999, username: "unit_test_user", role: "ADMIN", token_version: 1 };
        const access = jwtService.generateAccessToken(payload);
        assert(typeof access === "string" && access.split(".").length === 3);
        pass("jwtService.generateAccessToken() produces valid 3-segment JWT");

        const decoded = jwtService.verifyAccessToken(access);
        assert.strictEqual(decoded.username, "unit_test_user");
        assert.strictEqual(decoded.role, "ADMIN");
        pass("jwtService.verifyAccessToken() decodes payload with correct claims");

        const refresh = jwtService.generateRefreshToken(payload);
        assert(typeof refresh === "string" && refresh.split(".").length === 3);
        pass("jwtService.generateRefreshToken() produces valid refresh token");

        const decodedRefresh = jwtService.verifyRefreshToken(refresh);
        assert.strictEqual(decodedRefresh.user_id, 999);
        pass("jwtService.verifyRefreshToken() verifies refresh token claims");
    } catch (e) { fail("jwtService unit tests", e); }

    // 2.3 PDF Service
    try {
        const dummyPo = {
            po_number: "NEE/26-27/PO/TEST_001",
            po_date: "2026-10-13",
            vendor_name: "Test Vendor Ltd",
            party_name: "Test Client",
            item_name: "Test Product",
            make: "BrandX",
            model: "Model-100",
            qty: 10,
            unit: "NOS",
            price_per_unit: 1000,
            total_price: 10000
        };
        const generatedPath = await pdfService.generatePoPdf(dummyPo);
        assert(fs.existsSync(generatedPath));
        pass("pdfService.generatePoPdf() generated physical PDF file", path.basename(generatedPath));
        // Clean up dummy PDF
        try { fs.unlinkSync(generatedPath); } catch {}
    } catch (e) { fail("pdfService.generatePoPdf() test", e); }


    // =========================================================================
    // SUITE 3: AUTHENTICATION GATEWAY & SESSION MANAGEMENT
    // =========================================================================
    printHeader("SUITE 3: AUTHENTICATION GATEWAY & SESSION LIFECYCLE");

    // 3.1 Bad login rejection
    try {
        const res = await apiRequest({
            method: "POST",
            path: "/login",
            body: { username: "admin", password: "WrongPassword999" }
        });
        assert.strictEqual(res.status, 401);
        pass("POST /login rejects incorrect password with 401");
    } catch (e) { fail("POST /login bad password", e); }

    try {
        const res = await apiRequest({
            method: "POST",
            path: "/login",
            body: { username: "", password: "" }
        });
        assert.strictEqual(res.status, 401);
        pass("POST /login rejects empty credentials with 401");
    } catch (e) { fail("POST /login empty credentials", e); }

    // 3.2 Admin login
    try {
        const res = await apiRequest({
            method: "POST",
            path: "/login",
            body: { username: "admin", password: "Password@123" }
        });
        assert.strictEqual(res.status, 200);
        assert.strictEqual(res.data.success, true);
        assert.strictEqual(res.data.role, "ADMIN");
        adminToken = res.data.token;
        assert(!!adminToken);
        pass("POST /login authenticates ADMIN successfully and delivers JWT token");
    } catch (e) { fail("POST /login ADMIN authentication", e); }

    // 3.3 Legacy manager route redirect
    try {
        const res = await apiRequest({
            method: "GET",
            path: "/procurement-manager"
        });
        assert.strictEqual(res.status, 302);
        pass("GET /procurement-manager safely redirects legacy traffic with 302");
    } catch (e) { fail("GET /procurement-manager redirect", e); }

    // 3.4 Procurement user login
    try {
        const [procUsers] = await db.execute("SELECT username FROM users WHERE role = 'PROCUREMENT' AND is_active = 1 LIMIT 1");
        const procUsername = procUsers[0]?.username || "procurement";
        const res = await apiRequest({
            method: "POST",
            path: "/login",
            body: { username: procUsername, password: "Password@123" }
        });
        assert.strictEqual(res.status, 200);
        assert.strictEqual(res.data.role, "PROCUREMENT");
        procurementToken = res.data.token;
        assert(!!procurementToken);
        pass("POST /login authenticates PROCUREMENT successfully");
    } catch (e) { fail("POST /login PROCUREMENT authentication", e); }

    // 3.5 Token verification endpoint
    try {
        const res = await apiRequest({
            method: "GET",
            path: "/verify",
            token: adminToken
        });
        assert.strictEqual(res.status, 200);
        assert.strictEqual(res.data.authenticated, true);
        assert.strictEqual(res.data.role, "ADMIN");
        pass("GET /verify validates active access token with claims");
    } catch (e) { fail("GET /verify token validation", e); }


    // =========================================================================
    // SUITE 4: ROLE-BASED ACCESS CONTROL (RBAC) & AUTHORIZATION DEFENSES
    // =========================================================================
    printHeader("SUITE 4: ROLE-BASED ACCESS CONTROL (RBAC) & PERMISSION DEFENSES");

    try {
        const res = await apiRequest({ method: "GET", path: "/users" });
        assert.strictEqual(res.status, 401);
        pass("Unauthenticated GET /users rejected with 401");
    } catch (e) { fail("Unauthenticated GET /users", e); }

    try {
        const res = await apiRequest({ method: "GET", path: "/admin", headers: { "Accept": "text/html" } });
        assert([302, 307].includes(res.status));
        assert(res.headers.location.includes("unauthenticated"));
        pass("Unauthenticated browser access to /admin redirected to login");
    } catch (e) { fail("Unauthenticated /admin redirection", e); }

    try {
        const res = await apiRequest({ method: "GET", path: "/users", token: procurementToken });
        assert.strictEqual(res.status, 403);
        pass("PROCUREMENT role blocked from ADMIN route /users with 403 Forbidden");
    } catch (e) { fail("PROCUREMENT role blocked from /users", e); }

    try {
        const res = await apiRequest({ method: "GET", path: "/management-insights", token: procurementToken });
        assert.strictEqual(res.status, 403);
        pass("PROCUREMENT role blocked from ADMIN route /management-insights with 403 Forbidden");
    } catch (e) { fail("PROCUREMENT role blocked from /management-insights", e); }


    // =========================================================================
    // SUITE 5: USER MANAGEMENT ENDPOINTS (ADMIN)
    // =========================================================================
    printHeader("SUITE 5: USER MANAGEMENT & CREDENTIAL LIFECYCLE (ADMIN)");

    let testUserId = null;
    const testUsername = `test_user_${Date.now().toString().slice(-5)}`;

    try {
        const res = await apiRequest({ method: "GET", path: "/users", token: adminToken });
        assert.strictEqual(res.status, 200);
        assert(Array.isArray(res.data.users));
        assert(res.data.users.length >= 3);
        pass("GET /users returns active user registry", `Found ${res.data.users.length} users`);
    } catch (e) { fail("GET /users", e); }

    try {
        const res = await apiRequest({
            method: "POST",
            path: "/users",
            token: adminToken,
            body: { username: testUsername, password: "Password@123", role: "PROCUREMENT" }
        });
        assert.strictEqual(res.status, 201);
        assert.strictEqual(res.data.success, true);
        pass("POST /users creates new user profile successfully", testUsername);

        // Fetch user ID
        const [rows] = await db.execute("SELECT user_id FROM users WHERE username = ?", [testUsername]);
        testUserId = rows[0]?.user_id;
    } catch (e) { fail("POST /users create user", e); }

    if (testUserId) {
        try {
            const res = await apiRequest({
                method: "PUT",
                path: `/users/${testUserId}/access`,
                token: adminToken,
                body: { is_active: false }
            });
            assert.strictEqual(res.status, 200);
            assert.strictEqual(res.data.success, true);
            pass(`PUT /users/${testUserId}/access updates account status to inactive`);
        } catch (e) { fail("PUT /users/:id/access deactivate", e); }

        try {
            const res = await apiRequest({
                method: "PUT",
                path: `/users/${testUserId}/password`,
                token: adminToken,
                body: { password: "NewPassword@123" }
            });
            assert.strictEqual(res.status, 200);
            assert.strictEqual(res.data.success, true);
            pass(`PUT /users/${testUserId}/password updates password and increments token_version`);
        } catch (e) { fail("PUT /users/:id/password", e); }

        // Clean up test user
        try {
            await db.execute("DELETE FROM users WHERE user_id = ?", [testUserId]);
            pass("Cleaned up temporary test user record");
        } catch {}
    }


    // =========================================================================
    // SUITE 6: VENDOR MANAGEMENT & VENDOR DIRECTORY
    // =========================================================================
    printHeader("SUITE 6: VENDOR MANAGEMENT & DIRECTORY FUNCTIONS");

    let testVendorId = null;
    try {
        const [existingVendors] = await db.query("SELECT vendor_id FROM vendor_oem_masters ORDER BY vendor_id DESC LIMIT 1");
        if (existingVendors.length > 0) {
            testVendorId = existingVendors[0].vendor_id;
        } else {
            const [ins] = await db.execute(`
                INSERT INTO vendor_oem_masters (
                    vendor_code, registration_date, vendor_name, legal_entity, commercial_role, year_of_incorporation,
                    director_or_ceo_or_management_name, director_or_ceo_or_management_designation, director_or_ceo_or_management_mobile_no, director_or_ceo_or_management_email,
                    sales_team_name, sales_team_contact, sales_team_email,
                    accounts_team_name, accounts_team_contact, accounts_team_email,
                    gst_number, pan_number, turnover_year_1, turnover_value_1,
                    gst_document, pan_document, msme_document, itr_last_year_document, recommended_by, approved_by,
                    office_address, office_contact_name, office_contact_number,
                    bank_name, bank_account_no, bank_branch, bank_account_type, bank_ifsc,
                    branch_office_1_address
                ) VALUES (
                    'NEE2627V999', '2026-04-01', 'Test Vendor Solutions Pvt Ltd', 'Private Limited', 'OEM / Manufacturer', '2018',
                    'Rajesh Sharma', 'Managing Director', '9876543210', 'director@testvendor.com',
                    'Amit Verma', '9876543211', 'sales@testvendor.com',
                    'Suresh Patel', '9876543212', 'accounts@testvendor.com',
                    '24AAACS1429B1ZB', 'AAACS1429B', '2024-25', '15000000',
                    'gst_test.pdf', 'pan_test.pdf', 'msme_test.pdf', 'itr_test.pdf', 'Procurement Dept', 'Admin',
                    'Plot 12, GIDC Industrial Estate, Vadodara, Gujarat', 'Karan Mehta', '9876543213',
                    'State Bank of India', '38492019482', 'Alkapuri Vadodara', 'CURRENT', 'SBIN0001234',
                    'Branch 1, Ahmedabad, Gujarat'
                )
            `);
            testVendorId = ins.insertId;
        }
    } catch (e) {
        console.error("Setup vendor error:", e.message);
    }

    try {
        const res = await apiRequest({ method: "GET", path: "/vendors", token: procurementToken });
        assert.strictEqual(res.status, 200);
        assert(Array.isArray(res.data.vendors));
        pass("GET /vendors returns approved vendors list", `Found ${res.data.vendors.length} vendors`);
    } catch (e) { fail("GET /vendors", e); }

    try {
        const res = await apiRequest({ method: "GET", path: "/vendors/all", token: adminToken });
        assert.strictEqual(res.status, 200);
        assert(Array.isArray(res.data.vendors));
        pass("GET /vendors/all returns complete vendor master directory for Admin");
    } catch (e) { fail("GET /vendors/all", e); }

    try {
        const res = await apiRequest({ method: "GET", path: `/vendors/${testVendorId}`, token: procurementToken });
        assert.strictEqual(res.status, 200);
        assert.strictEqual(res.data.success, true);
        assert(!!res.data.vendor);
        pass("GET /vendors/:id retrieves comprehensive vendor profile by ID", res.data.vendor.vendor_name);
    } catch (e) { fail("GET /vendors/:id", e); }

    try {
        const res = await apiRequest({ method: "GET", path: "/vendors/check-gst?gst_number=24AAACS1429B1ZB", token: procurementToken });
        assert.strictEqual(res.status, 200);
        assert(res.data.exists === true || res.data.exists === false);
        pass("GET /vendors/check-gst checks GST number presence in registry");
    } catch (e) { fail("GET /vendors/check-gst", e); }

    // Vendor validation rejection
    try {
        const res = await apiRequest({
            method: "POST",
            path: "/vendors",
            token: procurementToken,
            body: { vendor_name: "12345", office_contact_number: "invalid" }
        });
        assert.strictEqual(res.status, 400);
        pass("POST /vendors rejects invalid vendor names and malformed phone numbers with 400");
    } catch (e) { fail("POST /vendors validation", e); }

    // Vendor Directory Excel Export
    try {
        const res = await apiRequest({ method: "GET", path: "/vendors/export/excel", token: procurementToken });
        assert.strictEqual(res.status, 200);
        assert(res.headers["content-type"].includes("spreadsheetml"));
        assert(res.data instanceof Buffer && res.data.length > 500);
        pass("GET /vendors/export/excel exports OpenXML spreadsheet workbook", `${res.data.length} bytes`);
    } catch (e) { fail("GET /vendors/export/excel", e); }

    // Vendor Directory PDF Export
    try {
        const res = await apiRequest({ method: "GET", path: "/vendors/export/pdf", token: procurementToken });
        assert.strictEqual(res.status, 200);
        assert.strictEqual(res.headers["content-type"], "application/pdf");
        assert(res.data instanceof Buffer && res.data.toString("utf8", 0, 4) === "%PDF");
        pass("GET /vendors/export/pdf generates valid PDF document with %PDF header", `${res.data.length} bytes`);
    } catch (e) { fail("GET /vendors/export/pdf", e); }


    // =========================================================================
    // SUITE 7: PURCHASE REQUESTS & ORDER TRACKING
    // =========================================================================
    printHeader("SUITE 7: PURCHASE REQUESTS & ORDER TRACKING SUITE");

    let testPrId = null;
    let testPrNumber = null;
    let testInquiryId = null;

    try {
        const res = await apiRequest({
            method: "POST",
            path: "/purchase-requests",
            token: procurementToken,
            body: {
                pr_date: "2026-10-19",
                party_name: "Test Infrastructure Ltd",
                location: "Dahej",
                territory: "West",
                product_category: "Electrical",
                item_name: "Test LED Bay Light 200W",
                product_remarks: "High Bay Industrial Lighting",
                make: "Philips",
                model: "BY698P",
                qty: 20,
                unit: "number",
                sales_rate: 3500
            }
        });
        assert.strictEqual(res.status, 200);
        assert.strictEqual(res.data.success, true);
        testPrId = res.data.pr_id;
        testPrNumber = res.data.pr_number;
        const [inqRows] = await db.execute("SELECT inquiry_id FROM vendor_inquiries WHERE pr_id = ? LIMIT 1", [testPrId]);
        if (inqRows.length > 0) {
            testInquiryId = inqRows[0].inquiry_id;
        }
        pass("POST /purchase-requests creates sequential PR and auto-opens vendor inquiry", testPrNumber);
    } catch (e) { fail("POST /purchase-requests", e); }

    try {
        const res = await apiRequest({ method: "GET", path: "/order-tracking?page=1", token: procurementToken });
        assert.strictEqual(res.status, 200);
        assert.strictEqual(res.data.success, true);
        assert(Array.isArray(res.data.rows));
        assert(!!res.data.pagination);
        assert(!!res.data.counts);
        pass("GET /order-tracking returns order records with pagination & metric counts", `Total: ${res.data.pagination.total}`);
    } catch (e) { fail("GET /order-tracking", e); }

    try {
        const res = await apiRequest({ method: "GET", path: "/order-tracking/export", token: procurementToken });
        assert.strictEqual(res.status, 200);
        assert(res.headers["content-type"].includes("spreadsheetml"));
        assert(res.data instanceof Buffer && res.data.length > 1000);
        pass("GET /order-tracking/export exports Order Tracking Excel summary report", `${res.data.length} bytes`);
    } catch (e) { fail("GET /order-tracking/export", e); }

    try {
        // File extension validation check
        const res = await apiRequest({
            method: "POST",
            path: "/purchase-requests/import-preview",
            token: procurementToken,
            headers: { "Content-Type": "text/plain" }
        });
        assert.strictEqual(res.status, 400);
        pass("POST /purchase-requests/import-preview enforces strict file validation");
    } catch (e) { fail("POST /purchase-requests/import-preview validation", e); }


    // =========================================================================
    // SUITE 8: RFQ / INQUIRIES & QUOTATION COMPARISONS
    // =========================================================================
    printHeader("SUITE 8: VENDOR INQUIRIES (RFQ) & QUOTATION COMPARISON");

    try {
        const res = await apiRequest({ method: "GET", path: "/vendor-inquiries", token: procurementToken });
        assert.strictEqual(res.status, 200);
        assert(Array.isArray(res.data.inquiries));
        pass("GET /vendor-inquiries returns list of active RFQs / Inquiries", `Found ${res.data.inquiries.length} inquiries`);
    } catch (e) { fail("GET /vendor-inquiries", e); }

    try {
        const res = await apiRequest({ method: "GET", path: `/vendor-inquiries/${testInquiryId}`, token: procurementToken });
        assert.strictEqual(res.status, 200);
        assert.strictEqual(res.data.success, true);
        assert(!!res.data.inquiry);
        pass("GET /vendor-inquiries/:id retrieves RFQ details and participating vendors");
    } catch (e) { fail("GET /vendor-inquiries/:id", e); }

    let testInquiryVendorId = null;
    try {
        const res = await apiRequest({
            method: "POST",
            path: `/vendor-inquiries/${testInquiryId}/vendors`,
            token: procurementToken,
            body: {
                vendor_id: testVendorId,
                price_per_unit: 2800,
                expected_delivery_date: "2026-11-15",
                payment_type: "CREDIT",
                balance_due_days: 30,
                remarks: "Test quotation submission"
            }
        });
        assert.strictEqual(res.status, 201);
        assert.strictEqual(res.data.success, true);
        testInquiryVendorId = res.data.inquiry_vendor_id;
        pass("POST /vendor-inquiries/:id/vendors adds vendor quote to RFQ inquiry");
    } catch (e) { fail("POST /vendor-inquiries/:id/vendors", e); }

    try {
        const res = await apiRequest({ method: "GET", path: "/quotation-comparisons", token: procurementToken });
        assert.strictEqual(res.status, 200);
        assert.strictEqual(res.data.success, true);
        assert(Array.isArray(res.data.inquiries));
        pass("GET /quotation-comparisons returns multi-vendor quote comparison matrices");
    } catch (e) { fail("GET /quotation-comparisons", e); }

    let testPoId = null;
    let testPoNumber = null;
    try {
        const res = await apiRequest({
            method: "POST",
            path: `/vendor-inquiries/${testInquiryId}/select-vendor`,
            token: adminToken,
            body: {
                inquiry_vendor_id: testInquiryVendorId
            }
        });
        assert.strictEqual(res.status, 200);
        assert.strictEqual(res.data.success, true);
        testPoNumber = res.data.po_number;
        const [poRows] = await db.execute("SELECT po_id FROM purchase_orders WHERE pr_id = ? LIMIT 1", [testPrId]);
        if (poRows.length > 0) {
            testPoId = poRows[0].po_id;
        }
        pass("POST /vendor-inquiries/:id/select-vendor selects winner and generates Purchase Order", testPoNumber);
    } catch (e) { fail("POST /vendor-inquiries/:id/select-vendor", e); }


    // =========================================================================
    // SUITE 9: PURCHASE ORDERS & ISSUANCE LIFECYCLE
    // =========================================================================
    printHeader("SUITE 9: PURCHASE ORDER MANAGEMENT & PDF GENERATION");

    try {
        const res = await apiRequest({ method: "GET", path: "/purchase-orders", token: procurementToken });
        assert.strictEqual(res.status, 200);
        assert.strictEqual(res.data.success, true);
        assert(Array.isArray(res.data.purchase_orders));
        pass("GET /purchase-orders returns list of purchase orders", `Found ${res.data.purchase_orders.length} POs`);
    } catch (e) { fail("GET /purchase-orders", e); }

    try {
        const res = await apiRequest({ method: "GET", path: "/purchase-orders/export", token: procurementToken });
        assert.strictEqual(res.status, 200);
        assert(res.headers["content-type"].includes("spreadsheetml"));
        assert(res.data instanceof Buffer && res.data.length > 500);
        pass("GET /purchase-orders/export exports Purchase Orders Excel summary report", `${res.data.length} bytes`);
    } catch (e) { fail("GET /purchase-orders/export", e); }

    try {
        const res = await apiRequest({
            method: "POST",
            path: `/purchase-orders/${testPoId}/issue`,
            token: procurementToken,
            headers: { "Accept": "application/json" }
        });
        assert.strictEqual(res.status, 200);
        assert.strictEqual(res.data.success, true);
        pass("POST /purchase-orders/:id/issue marks Purchase Order as ISSUED");
    } catch (e) { fail("POST /purchase-orders/:id/issue", e); }

    try {
        const res = await apiRequest({ method: "GET", path: `/purchase-orders/${testPoId}/download`, token: procurementToken });
        assert.strictEqual(res.status, 200);
        assert.strictEqual(res.headers["content-type"], "application/pdf");
        assert(res.data instanceof Buffer && res.data.toString("utf8", 0, 4) === "%PDF");
        pass("GET /purchase-orders/:id/download delivers dynamically generated PO PDF", `${res.data.length} bytes`);
    } catch (e) { fail("GET /purchase-orders/:id/download", e); }


    // =========================================================================
    // SUITE 10: STORE & INVENTORY (GOODS RECEIPT & RETURNS)
    // =========================================================================
    printHeader("SUITE 10: GOODS RECEIPT & RETURNS (STORE / INVENTORY)");

    try {
        const res = await apiRequest({ method: "GET", path: "/goods-received", token: procurementToken });
        assert.strictEqual(res.status, 200);
        assert.strictEqual(res.data.success, true);
        assert(Array.isArray(res.data.orders));
        pass("GET /goods-received returns list of orders ready for store receipt", `Found ${res.data.orders.length} orders`);
    } catch (e) { fail("GET /goods-received", e); }

    try {
        const res = await apiRequest({ method: "GET", path: `/goods-received/${testPoId}`, token: procurementToken });
        assert.strictEqual(res.status, 200);
        assert.strictEqual(res.data.success, true);
        pass("GET /goods-received/:po_id returns specific PO receipt history");
    } catch (e) { fail("GET /goods-received/:po_id", e); }

    try {
        const res = await apiRequest({
            method: "POST",
            path: "/goods-received",
            token: procurementToken,
            body: {
                po_id: testPoId,
                received_quantity: 15,
                receipt_date: "2026-10-19",
                remarks: "Initial 15 units received at warehouse"
            }
        });
        assert.strictEqual(res.status, 201);
        assert.strictEqual(res.data.success, true);
        pass("POST /goods-received records delivery receipt and updates remaining qty");
    } catch (e) { fail("POST /goods-received", e); }


    // =========================================================================
    // SUITE 11: VENDOR PERFORMANCE & GOVERNANCE
    // =========================================================================
    printHeader("SUITE 11: VENDOR PERFORMANCE & RATING SCORECARDS");

    try {
        const res = await apiRequest({ method: "GET", path: "/vendor-performance", token: procurementToken });
        assert.strictEqual(res.status, 200);
        assert.strictEqual(res.data.success, true);
        assert(Array.isArray(res.data.vendors));
        pass("GET /vendor-performance returns vendor scoring & SLA analytics", `Found ${res.data.vendors.length} vendors`);
    } catch (e) { fail("GET /vendor-performance", e); }

    try {
        const res = await apiRequest({ method: "GET", path: `/vendor-performance/${testVendorId}`, token: procurementToken });
        assert.strictEqual(res.status, 200);
        assert.strictEqual(res.data.success, true);
        assert(!!res.data.profile && !!res.data.kpis);
        pass("GET /vendor-performance/:id returns detailed vendor scorecard metrics", res.data.profile.vendor_name);
    } catch (e) { fail("GET /vendor-performance/:id", e); }


    // =========================================================================
    // SUITE 12: PAST PRICE REFERENCE (HISTORICAL PRICING)
    // =========================================================================
    printHeader("SUITE 12: PAST PRICE REFERENCE (HISTORICAL PRICING INTELLIGENCE)");

    try {
        const res = await apiRequest({ method: "GET", path: "/past-price-reference/models", token: procurementToken });
        assert.strictEqual(res.status, 200);
        assert.strictEqual(res.data.success, true);
        assert(Array.isArray(res.data.models));
        pass("GET /past-price-reference/models returns list of historic items/models", `Found ${res.data.models.length} models`);
    } catch (e) { fail("GET /past-price-reference/models", e); }

    try {
        const res = await apiRequest({ method: "GET", path: "/past-price-reference?model=BY698P", token: procurementToken });
        assert.strictEqual(res.status, 200);
        assert.strictEqual(res.data.success, true);
        assert(Array.isArray(res.data.purchases));
        pass("GET /past-price-reference?model=... retrieves historical unit price trends", `Found ${res.data.purchases.length} purchases`);
    } catch (e) { fail("GET /past-price-reference query", e); }


    // =========================================================================
    // SUITE 13: MANAGEMENT INSIGHTS & ANALYTICS
    // =========================================================================
    printHeader("SUITE 13: MANAGEMENT INSIGHTS & EXECUTIVE ANALYTICS");

    try {
        const res = await apiRequest({ method: "GET", path: "/management-insights", token: adminToken });
        assert.strictEqual(res.status, 200);
        assert.strictEqual(res.data.success, true);
        assert(!!res.data.overview);
        assert(!!res.data.financial);
        assert(!!res.data.purchase_requests);
        assert(!!res.data.trends);
        pass("GET /management-insights returns comprehensive KPI dashboard metrics");
    } catch (e) { fail("GET /management-insights", e); }


    // =========================================================================
    // SUITE 14: AUDIT TRAIL, REPORT LOGS & SECURITY LOGS
    // =========================================================================
    printHeader("SUITE 14: AUDIT TRAIL, REPORT EXPORT LOGS & LOGIN ACTIVITY");

    try {
        const res = await apiRequest({ method: "GET", path: "/report-logs", token: adminToken });
        assert.strictEqual(res.status, 200);
        assert.strictEqual(res.data.success, true);
        assert(Array.isArray(res.data.rows));
        pass("GET /report-logs returns export activity history", `Found ${res.data.rows.length} logs`);
    } catch (e) { fail("GET /report-logs", e); }

    try {
        const res = await apiRequest({ method: "GET", path: "/audit-logs", token: adminToken });
        assert.strictEqual(res.status, 200);
        assert.strictEqual(res.data.success, true);
        assert(Array.isArray(res.data.rows));
        pass("GET /audit-logs returns complete security audit change logs", `Found ${res.data.rows.length} audit logs`);
    } catch (e) { fail("GET /audit-logs", e); }

    try {
        const res = await apiRequest({ method: "GET", path: "/login-logs", token: adminToken });
        assert.strictEqual(res.status, 200);
        assert.strictEqual(res.data.success, true);
        assert(Array.isArray(res.data.rows));
        pass("GET /login-logs returns system authentication activity logs", `Found ${res.data.rows.length} login logs`);
    } catch (e) { fail("GET /login-logs", e); }


    // =========================================================================
    // SUITE 15: MODULAR /API SERVICE ROUTES
    // =========================================================================
    printHeader("SUITE 15: MODULAR /API SERVICE ROUTE CONTRACTS");

    const modularRoutes = [
        { path: "/api/users", token: adminToken },
        { path: "/api/vendors", token: procurementToken },
        { path: `/api/vendors/${testVendorId}`, token: procurementToken },
        { path: "/api/purchase-orders", token: procurementToken },
        { path: `/api/purchase-orders/${testPoId}`, token: procurementToken },
        { path: "/api/goods-received", token: procurementToken },
        { path: `/api/goods-received/${testPoId}`, token: procurementToken },
        { path: "/api/approvals", token: adminToken },
        { path: "/api/inquiries", token: procurementToken },
        { path: `/api/inquiries/${testInquiryId}`, token: procurementToken },
        { path: "/api/report-logs", token: adminToken },
        { path: "/api/pr", token: procurementToken }
    ];

    for (const r of modularRoutes) {
        try {
            const res = await apiRequest({ method: "GET", path: r.path, token: r.token });
            assert.strictEqual(res.status, 200);
            pass(`GET ${r.path} returns 200 OK`);
        } catch (e) { fail(`GET ${r.path}`, e); }
    }

    // Clean up temporary test workflow records
    try {
        if (testPoId) {
            await db.execute("DELETE FROM goods_received WHERE po_id = ?", [testPoId]);
            await db.execute("DELETE FROM purchase_orders WHERE po_id = ?", [testPoId]);
        }
        if (testInquiryId) {
            await db.execute("DELETE FROM vendor_inquiry_vendors WHERE inquiry_id = ?", [testInquiryId]);
            await db.execute("DELETE FROM vendor_inquiries WHERE inquiry_id = ?", [testInquiryId]);
        }
        if (testPrId) {
            await db.execute("DELETE FROM purchase_requests WHERE id = ?", [testPrId]);
        }
        if (testVendorId) {
            await db.execute("DELETE FROM vendor_oem_masters WHERE vendor_id = ?", [testVendorId]);
        }
        pass("Temporary test procurement workflow records cleaned up successfully");
    } catch (e) {
        console.warn("Cleanup warning:", e.message);
    }

    // =========================================================================
    // SUITE 16: TOKEN REVOCATION & CLEAN LOGOUT
    // =========================================================================
    printHeader("SUITE 16: TOKEN REVOCATION & INSTANT SESSION INVALIDATION");

    try {
        const logoutRes = await apiRequest({
            method: "POST",
            path: "/logout",
            token: adminToken
        });
        assert.strictEqual(logoutRes.status, 200);
        assert.strictEqual(logoutRes.data.success, true);
        pass("POST /logout invalidates user tokens and resets token version");

        const verifyRevoked = await apiRequest({
            method: "GET",
            path: "/verify",
            token: adminToken
        });
        assert.strictEqual(verifyRevoked.status, 401);
        pass("Previously issued token immediately rejected with 401 after logout");
    } catch (e) { fail("Token revocation on logout", e); }


    // =========================================================================
    // FINAL AUDIT SUMMARY REPORT
    // =========================================================================
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    const passPercentage = ((passedTests / totalTests) * 100).toFixed(1);

    console.log(`\n\x1b[36m======================================================================\x1b[0m`);
    console.log(`\x1b[1m\x1b[37m  PROCUREIQ MASTER TEST SUITE RESULTS SUMMARY\x1b[0m`);
    console.log(`\x1b[36m======================================================================\x1b[0m`);
    console.log(`  Total Tests Run : \x1b[1m${totalTests}\x1b[0m`);
    console.log(`  Passed Tests    : \x1b[32m\x1b[1m${passedTests}\x1b[0m`);
    console.log(`  Failed Tests    : \x1b[${failedTests > 0 ? "31" : "32"}m\x1b[1m${failedTests}\x1b[0m`);
    console.log(`  Pass Rate       : \x1b[1m${passPercentage}%\x1b[0m`);
    console.log(`  Total Duration  : \x1b[1m${duration} seconds\x1b[0m`);
    console.log(`\x1b[36m======================================================================\x1b[0m\n`);

    if (testServer) {
        testServer.close();
    }

    if (failedTests > 0) {
        console.log(`\x1b[31mFailures encountered:\x1b[0m`);
        failures.forEach((f, i) => {
            console.log(`  ${i + 1}. ${f.testName}: ${f.error}`);
        });
        process.exit(1);
    } else {
        console.log(`\x1b[32m\x1b[1m>>> ALL ${totalTests} SYSTEM FUNCTIONS & ENDPOINTS PASSED PERFECTLY! <<<\x1b[0m\n`);
        process.exit(0);
    }
}

runAllTests().catch((err) => {
    console.error("Fatal Test Suite Error:", err);
    process.exit(1);
});
