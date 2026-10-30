const http = require('http');

function request(options, body = null) {
    return new Promise((resolve, reject) => {
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
                    cookies: res.headers['set-cookie'] || [],
                    body: parsed
                });
            });
        });
        req.on('error', reject);
        if (body) {
            req.write(typeof body === 'string' ? body : JSON.stringify(body));
        }
        req.end();
    });
}

function parseCookies(cookieHeaders) {
    const cookies = {};
    for (const h of cookieHeaders) {
        const [cookiePart] = h.split(';');
        const [name, ...val] = cookiePart.split('=');
        cookies[name.trim()] = val.join('=').trim();
    }
    return cookies;
}

function formatCookieHeader(cookieObj) {
    return Object.entries(cookieObj).map(([k, v]) => `${k}=${v}`).join('; ');
}

async function runTests() {
    console.log('=== STARTING COMPREHENSIVE AUTH & SESSION TESTS ===\n');

    let allPassed = true;
    function assert(condition, testName, details = '') {
        if (condition) {
            console.log(`[PASS] ${testName}`);
        } else {
            console.error(`[FAIL] ${testName} - ${details}`);
            allPassed = false;
        }
    }

    // 1. Test Login with Admin Credentials
    console.log('--- TEST 1: Admin Login ---');
    const loginRes = await request({
        hostname: '127.0.0.1',
        port: 5000,
        path: '/login',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
    }, { username: 'admin', password: 'Password@123' });

    assert(loginRes.status === 200, 'Login status is 200 OK', `got ${loginRes.status}`);
    assert(loginRes.body?.success === true, 'Login body success is true');
    assert(!!loginRes.body?.token, 'JWT access token returned in JSON body');
    assert(!!loginRes.body?.refreshToken, 'JWT refresh token returned in JSON body');
    assert(loginRes.body?.role === 'ADMIN', 'User role is ADMIN');

    const adminToken = loginRes.body?.token;
    const adminRefreshToken = loginRes.body?.refreshToken;
    const loginCookies = parseCookies(loginRes.cookies);

    assert(!!loginCookies['login_session'], 'Session cookie (login_session) is set');
    assert(!!loginCookies['jwt_token'], 'JWT cookie (jwt_token) is set');
    assert(!!loginCookies['access_token'], 'Access token cookie (access_token) is set');
    assert(!!loginCookies['refresh_token'], 'Refresh token cookie (refresh_token) is set');

    // 2. Test /verify endpoint with JWT Bearer Token
    console.log('\n--- TEST 2: /verify with Authorization: Bearer <token> ---');
    const verifyJwtRes = await request({
        hostname: '127.0.0.1',
        port: 5000,
        path: '/verify',
        method: 'GET',
        headers: {
            'Accept': 'application/json',
            'Authorization': `Bearer ${adminToken}`
        }
    });
    assert(verifyJwtRes.status === 200, 'JWT /verify returns 200 OK');
    assert(verifyJwtRes.body?.authenticated === true, 'Authenticated is true');
    assert(verifyJwtRes.body?.role === 'ADMIN', 'Role matches ADMIN');

    // 3. Test /verify endpoint with Session Cookie ONLY (no Authorization header, no JWT cookies)
    console.log('\n--- TEST 3: /verify with Session Cookie ONLY ---');
    const verifySessionRes = await request({
        hostname: '127.0.0.1',
        port: 5000,
        path: '/verify',
        method: 'GET',
        headers: {
            'Accept': 'application/json',
            'Cookie': `login_session=${loginCookies['login_session']}`
        }
    });
    assert(verifySessionRes.status === 200, 'Session-only /verify returns 200 OK', `status=${verifySessionRes.status}`);
    assert(verifySessionRes.body?.authenticated === true, 'Authenticated is true via session cookie');
    assert(verifySessionRes.body?.username === 'admin', 'Username matches admin');

    // 4. Test /verify endpoint with JWT Cookie ONLY (no Authorization header, no session cookie)
    console.log('\n--- TEST 4: /verify with JWT Cookie ONLY ---');
    const verifyJwtCookieRes = await request({
        hostname: '127.0.0.1',
        port: 5000,
        path: '/verify',
        method: 'GET',
        headers: {
            'Accept': 'application/json',
            'Cookie': `access_token=${loginCookies['access_token']}`
        }
    });
    assert(verifyJwtCookieRes.status === 200, 'JWT cookie-only /verify returns 200 OK');
    assert(verifyJwtCookieRes.body?.authenticated === true, 'Authenticated is true via access_token cookie');

    // 5. Test Protected API (/users) with Bearer token (Admin only)
    console.log('\n--- TEST 5: Protected API (/users) with Bearer token ---');
    const usersRes = await request({
        hostname: '127.0.0.1',
        port: 5000,
        path: '/users',
        method: 'GET',
        headers: {
            'Accept': 'application/json',
            'Authorization': `Bearer ${adminToken}`
        }
    });
    assert(usersRes.status === 200, '/users with Bearer token returns 200 OK');
    assert(Array.isArray(usersRes.body?.users), 'Users list returned');

    // 6. Test Protected API (/users) with Session Cookie ONLY
    console.log('\n--- TEST 6: Protected API (/users) with Session Cookie ONLY ---');
    const usersSessionRes = await request({
        hostname: '127.0.0.1',
        port: 5000,
        path: '/users',
        method: 'GET',
        headers: {
            'Accept': 'application/json',
            'Cookie': `login_session=${loginCookies['login_session']}`
        }
    });
    assert(usersSessionRes.status === 200, '/users with Session Cookie returns 200 OK');

    // 7. Test Protected API without any credentials (should return 401)
    console.log('\n--- TEST 7: Unauthenticated Request to Protected API ---');
    const unauthRes = await request({
        hostname: '127.0.0.1',
        port: 5000,
        path: '/users',
        method: 'GET',
        headers: { 'Accept': 'application/json' }
    });
    assert(unauthRes.status === 401, 'Unauthenticated API returns 401 Unauthorized', `got ${unauthRes.status}`);

    // 8. Test Invalid / Tampered JWT (should return 401)
    console.log('\n--- TEST 8: Invalid / Tampered JWT Token ---');
    const tamperedRes = await request({
        hostname: '127.0.0.1',
        port: 5000,
        path: '/users',
        method: 'GET',
        headers: {
            'Accept': 'application/json',
            'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalid.signature'
        }
    });
    assert(tamperedRes.status === 401, 'Tampered token returns 401 Unauthorized');

    // 9. Test Token Refresh Endpoint (/refresh)
    console.log('\n--- TEST 9: Token Refresh (/refresh) ---');
    const refreshRes = await request({
        hostname: '127.0.0.1',
        port: 5000,
        path: '/refresh',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
    }, { refresh_token: adminRefreshToken });
    assert(refreshRes.status === 200, 'Refresh token returns 200 OK');
    assert(!!refreshRes.body?.token, 'New access token issued');
    assert(!!refreshRes.body?.refreshToken, 'New refresh token issued');

    const newAccessToken = refreshRes.body?.token;

    // 10. Test Procurement User Login & RBAC
    console.log('\n--- TEST 10: Procurement User Login & RBAC (/users Admin-Only check) ---');
    const procLoginRes = await request({
        hostname: '127.0.0.1',
        port: 5000,
        path: '/login',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
    }, { username: 'user1', password: 'Password@123' });

    assert(procLoginRes.status === 200, 'Procurement login status is 200 OK');
    const procToken = procLoginRes.body?.token;
    assert(procLoginRes.body?.role === 'PROCUREMENT', 'Procurement role confirmed');

    // Procurement accessing /users (ADMIN ONLY) -> should return 403 Forbidden
    const procUsersRes = await request({
        hostname: '127.0.0.1',
        port: 5000,
        path: '/users',
        method: 'GET',
        headers: {
            'Accept': 'application/json',
            'Authorization': `Bearer ${procToken}`
        }
    });
    assert(procUsersRes.status === 403, 'Procurement accessing /users is 403 Forbidden', `got ${procUsersRes.status}`);

    // Procurement accessing /purchase-requests (PROCUREMENT ALLOWED) -> should return 200 OK
    const procPrRes = await request({
        hostname: '127.0.0.1',
        port: 5000,
        path: '/product-categories',
        method: 'GET',
        headers: {
            'Accept': 'application/json',
            'Authorization': `Bearer ${procToken}`
        }
    });
    assert(procPrRes.status === 200, 'Procurement accessing /product-categories is 200 OK', `got ${procPrRes.status}`);

    // 11. Test Logout & Instant Revocation
    console.log('\n--- TEST 11: Logout & Instant Revocation ---');
    const logoutRes = await request({
        hostname: '127.0.0.1',
        port: 5000,
        path: '/logout',
        method: 'POST',
        headers: {
            'Accept': 'application/json',
            'Authorization': `Bearer ${adminToken}`,
            'Cookie': formatCookieHeader(loginCookies)
        }
    });
    assert(logoutRes.status === 200, 'Logout status is 200 OK');

    const logoutCookies = parseCookies(logoutRes.cookies);
    assert(logoutCookies['jwt_token'] === '' || !logoutCookies['jwt_token'], 'jwt_token cookie cleared');
    assert(logoutCookies['login_session'] === '' || !logoutCookies['login_session'], 'login_session cookie cleared');

    // Now test that the old adminToken is revoked because token_version was incremented in DB
    const postLogoutVerifyRes = await request({
        hostname: '127.0.0.1',
        port: 5000,
        path: '/verify',
        method: 'GET',
        headers: {
            'Accept': 'application/json',
            'Authorization': `Bearer ${adminToken}`
        }
    });
    assert(postLogoutVerifyRes.status === 401, 'Previously valid JWT is now 401 (revoked via token_version increment)', `got ${postLogoutVerifyRes.status}`);

    console.log('\n===================================================');
    if (allPassed) {
        console.log('ALL AUTH & SESSION TESTS PASSED PERFECTLY!');
    } else {
        console.log('SOME TESTS FAILED - SEE LOGS ABOVE');
    }
    console.log('===================================================');
}

runTests().catch(err => {
    console.error('Fatal test error:', err);
});
