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

async function runSingleDeviceTest() {
    console.log('=== TESTING STRICT SINGLE ACTIVE DEVICE ENFORCEMENT ===\n');
    let allPassed = true;

    function assert(condition, title, details = '') {
        if (condition) {
            console.log(`[PASS] ${title}`);
        } else {
            console.error(`[FAIL] ${title} - ${details}`);
            allPassed = false;
        }
    }

    // Step 1: Login on Device 1
    console.log('--- Step 1: Login on Device 1 (admin) ---');
    const dev1Login = await request({
        hostname: '127.0.0.1',
        port: 5000,
        path: '/login',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
    }, { username: 'admin', password: 'Password@123' });

    assert(dev1Login.status === 200, 'Device 1 login status is 200 OK');
    const token1 = dev1Login.body?.token;
    const refresh1 = dev1Login.body?.refreshToken;
    assert(!!token1, 'Device 1 received Token 1');

    // Step 2: Device 1 verifies it can access protected resources
    console.log('\n--- Step 2: Device 1 makes authenticated request ---');
    const dev1Verify = await request({
        hostname: '127.0.0.1',
        port: 5000,
        path: '/verify',
        method: 'GET',
        headers: {
            'Accept': 'application/json',
            'Authorization': `Bearer ${token1}`
        }
    });
    assert(dev1Verify.status === 200, 'Device 1 /verify returns 200 OK');
    assert(dev1Verify.body?.authenticated === true, 'Device 1 is active & authenticated');

    // Step 3: Login on Device 2 using the same account
    console.log('\n--- Step 3: Login on Device 2 (admin) with same account ---');
    const dev2Login = await request({
        hostname: '127.0.0.1',
        port: 5000,
        path: '/login',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
    }, { username: 'admin', password: 'Password@123' });

    assert(dev2Login.status === 200, 'Device 2 login status is 200 OK');
    const token2 = dev2Login.body?.token;
    assert(!!token2, 'Device 2 received Token 2');
    assert(token1 !== token2, 'Token 2 is different from Token 1');

    // Step 4: Device 2 makes authenticated request
    console.log('\n--- Step 4: Device 2 makes authenticated request ---');
    const dev2Verify = await request({
        hostname: '127.0.0.1',
        port: 5000,
        path: '/verify',
        method: 'GET',
        headers: {
            'Accept': 'application/json',
            'Authorization': `Bearer ${token2}`
        }
    });
    assert(dev2Verify.status === 200, 'Device 2 /verify returns 200 OK');
    assert(dev2Verify.body?.authenticated === true, 'Device 2 is active');

    // Step 5: Device 1 tries to access protected endpoint with Token 1 (MUST BE KICKED OUT!)
    console.log('\n--- Step 5: Device 1 makes request with old Token 1 (MUST FAIL) ---');
    const dev1OldVerify = await request({
        hostname: '127.0.0.1',
        port: 5000,
        path: '/verify',
        method: 'GET',
        headers: {
            'Accept': 'application/json',
            'Authorization': `Bearer ${token1}`
        }
    });
    assert(dev1OldVerify.status === 401, 'Device 1 is blocked with 401 Unauthorized', `got ${dev1OldVerify.status}`);
    assert(dev1OldVerify.body?.reason === 'logged_in_elsewhere', 'Reason indicates logged_in_elsewhere');

    // Step 6: Device 1 tries to refresh with old Refresh Token 1 (MUST FAIL)
    console.log('\n--- Step 6: Device 1 tries silent refresh with old refresh token (MUST FAIL) ---');
    const dev1Refresh = await request({
        hostname: '127.0.0.1',
        port: 5000,
        path: '/refresh',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
    }, { refresh_token: refresh1 });
    assert(dev1Refresh.status === 403, 'Device 1 refresh blocked with 403 Forbidden', `got ${dev1Refresh.status}`);

    // Step 7: Device 2 remains completely functional
    console.log('\n--- Step 7: Device 2 remains unaffected and working ---');
    const dev2Users = await request({
        hostname: '127.0.0.1',
        port: 5000,
        path: '/users',
        method: 'GET',
        headers: {
            'Accept': 'application/json',
            'Authorization': `Bearer ${token2}`
        }
    });
    assert(dev2Users.status === 200, 'Device 2 /users returns 200 OK');

    console.log('\n===================================================');
    if (allPassed) {
        console.log('SINGLE ACTIVE DEVICE POLICY VERIFIED AND WORKING 100%!');
    } else {
        console.log('TESTS FAILED - SEE ABOVE');
    }
    console.log('===================================================');
}

runSingleDeviceTest().catch(err => {
    console.error('Fatal test error:', err);
});

