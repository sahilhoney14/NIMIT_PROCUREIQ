const http = require("http");

function request(options, data) {
    return new Promise((resolve, reject) => {
        const req = http.request(options, (res) => {
            let body = "";
            res.on("data", chunk => body += chunk);
            res.on("end", () => {
                let parsed = null;
                try {
                    parsed = JSON.parse(body);
                } catch (e) {
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
            req.write(typeof data === "string" ? data : JSON.stringify(data));
        }
        req.end();
    });
}

async function runTests() {
    console.log("=== STARTING AUTH & JWT ARCHITECTURE TEST ===");

    // Test 1: Login
    console.log("\n[Test 1] Login as admin...");
    const loginRes = await request({
        hostname: "localhost",
        port: 3000,
        path: "/login",
        method: "POST",
        headers: { "Content-Type": "application/json" }
    }, { username: "admin", password: "Password@123" });

    console.log(`Status: ${loginRes.status}`);
    console.log(`Success: ${loginRes.data.success}, Role: ${loginRes.data.role}`);
    console.log(`Has Access Token: ${!!loginRes.data.token}`);
    console.log(`Has Refresh Token: ${!!loginRes.data.refreshToken}`);
    console.log(`Cookies Set: ${loginRes.cookies.map(c => c.split(";")[0]).join(", ")}`);

    if (!loginRes.data.success || !loginRes.data.token || !loginRes.data.refreshToken) {
        throw new Error("Test 1 Failed: Login did not return valid token payload");
    }

    const accessToken = loginRes.data.token;
    const refreshToken = loginRes.data.refreshToken;
    const refreshCookie = loginRes.cookies.find(c => c.startsWith("refresh_token="));

    // Test 2: Verify Access Token
    console.log("\n[Test 2] Verify access token on /verify...");
    const verifyRes = await request({
        hostname: "localhost",
        port: 3000,
        path: "/verify",
        method: "GET",
        headers: { "Authorization": `Bearer ${accessToken}` }
    });
    console.log(`Status: ${verifyRes.status}, Authenticated: ${verifyRes.data.authenticated}, Role: ${verifyRes.data.role}`);
    if (verifyRes.status !== 200 || !verifyRes.data.authenticated) {
        throw new Error("Test 2 Failed: Access token failed verification");
    }

    // Test 3: Token Refresh
    console.log("\n[Test 3] Request new access token using /refresh (with cookie)...");
    const refreshRes = await request({
        hostname: "localhost",
        port: 3000,
        path: "/refresh",
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Cookie": refreshCookie ? refreshCookie.split(";")[0] : ""
        }
    });
    console.log(`Status: ${refreshRes.status}, Success: ${refreshRes.data.success}`);
    console.log(`New Access Token: ${!!refreshRes.data.token}`);
    console.log(`New Refresh Token: ${!!refreshRes.data.refreshToken}`);
    if (refreshRes.status !== 200 || !refreshRes.data.token) {
        throw new Error("Test 3 Failed: Refresh token exchange failed");
    }

    const newAccessToken = refreshRes.data.token;

    // Test 4: Verify New Access Token
    console.log("\n[Test 4] Verify new access token on /verify...");
    const verifyNewRes = await request({
        hostname: "localhost",
        port: 3000,
        path: "/verify",
        method: "GET",
        headers: { "Authorization": `Bearer ${newAccessToken}` }
    });
    console.log(`Status: ${verifyNewRes.status}, Authenticated: ${verifyNewRes.data.authenticated}`);
    if (verifyNewRes.status !== 200 || !verifyNewRes.data.authenticated) {
        throw new Error("Test 4 Failed: New access token failed verification");
    }

    // Test 5: Instant Revocation on Logout
    console.log("\n[Test 5] Test instant token revocation on Logout...");
    const logoutRes = await request({
        hostname: "localhost",
        port: 3000,
        path: "/logout",
        method: "POST",
        headers: {
            "Authorization": `Bearer ${newAccessToken}`,
            "Cookie": refreshCookie ? refreshCookie.split(";")[0] : ""
        }
    });
    console.log(`Logout Status: ${logoutRes.status}, Success: ${logoutRes.data.success}`);

    // Verify previously issued token is now rejected because token_version was incremented
    console.log("Testing revoked access token against /verify...");
    const verifyRevoked = await request({
        hostname: "localhost",
        port: 3000,
        path: "/verify",
        method: "GET",
        headers: { "Authorization": `Bearer ${newAccessToken}` }
    });
    console.log(`Status with revoked token: ${verifyRevoked.status} (Expected 401)`);
    if (verifyRevoked.status !== 401) {
        throw new Error("Test 5 Failed: Revoked token was not rejected by /verify!");
    }

    // Test refresh with old refresh token is also rejected
    console.log("Testing revoked refresh token against /refresh...");
    const refreshRevoked = await request({
        hostname: "localhost",
        port: 3000,
        path: "/refresh",
        method: "POST",
        headers: { "Content-Type": "application/json" },
        data: { refresh_token: refreshToken }
    });
    console.log(`Status with revoked refresh token: ${refreshRevoked.status} (Expected 403 or 401)`);
    if (refreshRevoked.status !== 403 && refreshRevoked.status !== 401) {
        throw new Error("Test 5 Failed: Revoked refresh token was not rejected!");
    }

    // Test 6: Manager and User Roles
    console.log("\n[Test 6] Login as procurement manager...");
    const managerLogin = await request({
        hostname: "localhost",
        port: 3000,
        path: "/login",
        method: "POST",
        headers: { "Content-Type": "application/json" }
    }, { username: "manager", password: "Password@123" });
    console.log(`Manager Login: Status ${managerLogin.status}, Role: ${managerLogin.data.role}, Redirect: ${managerLogin.data.redirect_url}`);
    if (managerLogin.data.role !== "PROCUREMENT_MANAGER" || managerLogin.data.redirect_url !== "/procurement-manager") {
        throw new Error("Test 6 Failed: Manager role/redirect mismatch");
    }

    console.log("\n[Test 7] Login as procurement user...");
    const userLogin = await request({
        hostname: "localhost",
        port: 3000,
        path: "/login",
        method: "POST",
        headers: { "Content-Type": "application/json" }
    }, { username: "user", password: "Password@123" });
    console.log(`User Login: Status ${userLogin.status}, Role: ${userLogin.data.role}, Redirect: ${userLogin.data.redirect_url}`);
    if (userLogin.data.role !== "PROCUREMENT" || userLogin.data.redirect_url !== "/procurement") {
        throw new Error("Test 7 Failed: User role/redirect mismatch");
    }

    console.log("\n>>> ALL AUTH & JWT TESTS PASSED PERFECTLY! <<<");
}

runTests().catch(err => {
    console.error("TEST FAILED:", err);
    process.exit(1);
});
