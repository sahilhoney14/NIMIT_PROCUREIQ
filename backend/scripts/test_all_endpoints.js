const http = require('http');

function request(options, body = null) {
    return new Promise((resolve) => {
        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                let parsed = null;
                try {
                    parsed = JSON.parse(data);
                } catch {
                    parsed = data;
                }
                resolve({
                    status: res.statusCode,
                    headers: res.headers,
                    body: parsed
                });
            });
        });
        req.on('error', (err) => {
            resolve({ status: 500, error: err.message });
        });
        if (body) {
            req.write(typeof body === 'string' ? body : JSON.stringify(body));
        }
        req.end();
    });
}

async function runAudit() {
    console.log('===============================================================');
    console.log('     PROCUREIQ COMPREHENSIVE ENDPOINT & SECURITY AUDIT       ');
    console.log('============================================== =================\n');

    let totalTests = 0;
    let passedTests = 0;

    function check(passed, description, details = '') {
        totalTests++;
        if (passed) {
            passedTests++;
            console.log(`[PASS] ${description}`);
        } else {
            console.error(`[FAIL] ${description} | Details: ${details}`);
        }
    }

    // ── 1. AUTHENTICATE BOTH ROLES ──────────────────────────────────────────
    console.log('--- 1. Authenticating Admin and Procurement ---');
    const adminLogin = await request({
        hostname: '127.0.0.1',
        port: 5000,
        path: '/login',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
    }, { username: 'admin', password: 'Password@123' });

    const adminToken = adminLogin.body?.token;
    check(adminLogin.status === 200 && !!adminToken, 'Admin Login successful', `status=${adminLogin.status}`);

    const procLogin = await request({
        hostname: '127.0.0.1',
        port: 5000,
        path: '/login',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
    }, { username: 'user1', password: 'Password@123' });

    const procToken = procLogin.body?.token;
    check(procLogin.status === 200 && !!procToken, 'Procurement Login successful', `status=${procLogin.status}`);

    // Helper fetchers
    const fetchUnauth = (path) => request({ hostname: '127.0.0.1', port: 5000, path, method: 'GET', headers: { 'Accept': 'application/json' } });
    const fetchAdmin = (path) => request({ hostname: '127.0.0.1', port: 5000, path, method: 'GET', headers: { 'Accept': 'application/json', 'Authorization': `Bearer ${adminToken}` } });
    const fetchProc = (path) => request({ hostname: '127.0.0.1', port: 5000, path, method: 'GET', headers: { 'Accept': 'application/json', 'Authorization': `Bearer ${procToken}` } });

    // ── 2. SECURITY HEADERS VERIFICATION ────────────────────────────────────
    console.log('\n--- 2. Security Headers Audit ---');
    const rootRes = await request({ hostname: '127.0.0.1', port: 5000, path: '/', method: 'GET' });
    check(!!rootRes.headers['x-content-type-options'], 'X-Content-Type-Options: nosniff header present');
    check(!!rootRes.headers['x-frame-options'], 'X-Frame-Options: SAMEORIGIN header present');
    check(!!rootRes.headers['x-dns-prefetch-control'], 'X-DNS-Prefetch-Control header present');

    // ── 3. UNAUTHENTICATED PROTECTION CHECK (Zero Trust) ────────────────────
    console.log('\n--- 3. Unauthenticated Access Protection (Must return 401) ---');
    const protectedEndpoints = [
        '/users',
        '/workspace/dashboard',
        '/product-categories',
        '/sub-product-categories',
        '/purchase-requests/export',
        '/vendors',
        '/vendor-inquiries',
        '/quotation-comparisons',
        '/purchase-orders',
        '/order-tracking',
        '/goods-received',
        '/audit-logs',
        '/login-logs',
        '/management-insights'
    ];

    for (const ep of protectedEndpoints) {
        const res = await fetchUnauth(ep);
        check(res.status === 401, `Unauthenticated ${ep} blocked with 401`, `got status ${res.status}`);
    }

    // ── 4. ROLE-BASED ACCESS CONTROL (RBAC) - Procurement access to Admin ───
    console.log('\n--- 4. RBAC Check: Procurement blocked from Admin-Only endpoints (Must return 403) ---');
    const adminOnlyEndpoints = [
        '/users',
        '/audit-logs',
        '/login-logs'
    ];

    for (const ep of adminOnlyEndpoints) {
        const res = await fetchProc(ep);
        check(res.status === 403, `Procurement accessing ${ep} blocked with 403`, `got status ${res.status}`);
    }

    // ── 5. FUNCTIONAL ENDPOINT CHECKS (Must return 200 with valid data) ─────
    console.log('\n--- 5. Functional API Endpoint Verification ---');

    // Admin endpoints
    const usersRes = await fetchAdmin('/users');
    check(usersRes.status === 200 && Array.isArray(usersRes.body?.users), 'GET /users returns 200 with users list');

    const auditRes = await fetchAdmin('/audit-logs');
    check(auditRes.status === 200, 'GET /audit-logs returns 200 OK');

    const loginLogsRes = await fetchAdmin('/login-logs');
    check(loginLogsRes.status === 200, 'GET /login-logs returns 200 OK');

    // Shared / Procurement endpoints
    const dashRes = await fetchProc('/workspace/dashboard');
    check(dashRes.status === 200 && dashRes.body?.success === true, 'GET /workspace/dashboard returns 200 OK');

    const catRes = await fetchProc('/product-categories');
    check(catRes.status === 200, 'GET /product-categories returns 200 OK');

    const subcatRes = await fetchProc('/sub-product-categories');
    check(subcatRes.status === 200, 'GET /sub-product-categories returns 200 OK');

    const prExportRes = await fetchProc('/purchase-requests/export');
    check(prExportRes.status === 200, 'GET /purchase-requests/export returns 200 OK');

    const prTemplateRes = await fetchProc('/purchase-requests/template');
    check(prTemplateRes.status === 200, 'GET /purchase-requests/template returns 200 OK');

    const vendorsRes = await fetchProc('/vendors');
    check(vendorsRes.status === 200, 'GET /vendors returns 200 OK');

    const vendorInqRes = await fetchProc('/vendor-inquiries');
    check(vendorInqRes.status === 200, 'GET /vendor-inquiries returns 200 OK');

    const quoteCompRes = await fetchProc('/quotation-comparisons');
    check(quoteCompRes.status === 200, 'GET /quotation-comparisons returns 200 OK');

    const poRes = await fetchProc('/purchase-orders');
    check(poRes.status === 200, 'GET /purchase-orders returns 200 OK');

    const poExportRes = await fetchProc('/purchase-orders/export');
    check(poExportRes.status === 200, 'GET /purchase-orders/export returns 200 OK');

    const grnRes = await fetchProc('/goods-received');
    check(grnRes.status === 200, 'GET /goods-received returns 200 OK');

    const orderTrackRes = await fetchProc('/order-tracking');
    check(orderTrackRes.status === 200, 'GET /order-tracking returns 200 OK');

    const orderTrackExportRes = await fetchProc('/order-tracking/export');
    check(orderTrackExportRes.status === 200, 'GET /order-tracking/export returns 200 OK');

    const insightsRes = await fetchAdmin('/management-insights');
    check(insightsRes.status === 200, 'GET /management-insights returns 200 OK');

    // ── 6. RATE LIMITING CHECK ──────────────────────────────────────────────
    console.log('\n--- 6. Security Brute-Force Rate Limiting Audit ---');
    console.log('Sending rapid invalid login attempts to test rate-limiter trigger...');
    let rateLimited = false;
    for (let i = 0; i < 35; i++) {
        const attempt = await request({
            hostname: '127.0.0.1',
            port: 5000,
            path: '/login',
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        }, { username: 'invalid_user_test', password: 'wrong_password' });

        if (attempt.status === 429) {
            rateLimited = true;
            break;
        }
    }
    check(rateLimited, 'Rate limiter activates with 429 Too Many Requests after threshold');

    console.log('\n===============================================================');
    console.log(`TOTAL AUDIT CHECKS: ${totalTests}`);
    console.log(`PASSED: ${passedTests}`);
    console.log(`FAILED: ${totalTests - passedTests}`);
    console.log('===============================================================');

    process.exit(totalTests === passedTests ? 0 : 1);
}

runAudit().catch(err => {
    console.error('Fatal audit error:', err);
    process.exit(1);
});

