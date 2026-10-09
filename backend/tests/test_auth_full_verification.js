const http = require("http");
const app = require("../src/app");
const { db } = require("../src/config/database");

let server;
let port;

function req(path, options = {}, data = null) {
    return new Promise((resolve, reject) => {
        const reqOptions = {
            hostname: "localhost",
            port,
            path,
            method: options.method || "GET",
            headers: options.headers || {}
        };
        const r = http.request(reqOptions, res => {
            let body = "";
            res.on("data", c => body += c);
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
        r.on("error", reject);
        if (data) {
            r.write(typeof data === "string" ? data : JSON.stringify(data));
        }
        r.end();
    });
}

async function run() {
    // Start ephemeral server on random port
    server = http.createServer(app);
    await new Promise(r => server.listen(0, r));
    port = server.address().port;
    console.log(`Ephemeral test server running on port ${port}`);

    try {
        console.log("\n[Test 1] Unauthenticated request to /admin with Accept: text/html");
        const resAdmin = await req("/admin", { headers: { "Accept": "text/html" } });
        console.log("Status:", resAdmin.status, "Location:", resAdmin.headers.location);
        if (resAdmin.status !== 302 || !resAdmin.headers.location.includes("reason=unauthenticated")) {
            throw new Error("Test 1 Failed: Expected 302 redirect with reason=unauthenticated");
        }

        console.log("\n[Test 2] Unauthenticated API request to /users");
        const resUsersUnauth = await req("/users", { headers: { "Accept": "application/json" } });
        console.log("Status:", resUsersUnauth.status, "Data:", resUsersUnauth.data);
        if (resUsersUnauth.status !== 401) {
            throw new Error("Test 2 Failed: Expected 401 for unauth /users");
        }

        console.log("\n[Test 3] Login as admin");
        const loginRes = await req("/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" }
        }, { username: "admin", password: "Password@123" });
        console.log("Login Status:", loginRes.status, "Role:", loginRes.data.role);
        if (loginRes.status !== 200 || !loginRes.data.token) {
            throw new Error("Test 3 Failed: Login failed");
        }
        const token = loginRes.data.token;
        const cookieHeader = loginRes.cookies.map(c => c.split(";")[0]).join("; ");

        console.log("\n[Test 4] Access /users with Bearer token");
        const resUsersAuth = await req("/users", {
            headers: { "Authorization": `Bearer ${token}`, "Accept": "application/json" }
        });
        console.log("Status:", resUsersAuth.status, "User count:", resUsersAuth.data.users?.length);
        if (resUsersAuth.status !== 200 || !resUsersAuth.data.success) {
            throw new Error("Test 4 Failed: Expected 200 with valid Bearer token");
        }

        console.log("\n[Test 5] Access /users with Cookie only");
        const resUsersCookie = await req("/users", {
            headers: { "Cookie": cookieHeader, "Accept": "application/json" }
        });
        console.log("Status:", resUsersCookie.status, "Success:", resUsersCookie.data.success);
        if (resUsersCookie.status !== 200 || !resUsersCookie.data.success) {
            throw new Error("Test 5 Failed: Expected 200 with cookies");
        }

        console.log("\n[Test 6] Logout user (revokes token version)");
        const logoutRes = await req("/logout", {
            method: "POST",
            headers: { "Authorization": `Bearer ${token}`, "Cookie": cookieHeader, "Accept": "application/json" }
        });
        console.log("Logout Status:", logoutRes.status, "Success:", logoutRes.data.success);
        if (logoutRes.status !== 200) {
            throw new Error("Test 6 Failed: Logout failed");
        }

        console.log("\n[Test 7] Verify previously issued Bearer token is REJECTED by /verify");
        const verifyRevoked = await req("/verify", {
            headers: { "Authorization": `Bearer ${token}`, "Accept": "application/json" }
        });
        console.log("Status:", verifyRevoked.status, "(Expected 401)");
        if (verifyRevoked.status !== 401) {
            throw new Error("Test 7 Failed: Expected 401 for revoked token on /verify");
        }

        console.log("\n[Test 8] Verify previously issued Bearer token is REJECTED by protected API /users");
        const usersRevoked = await req("/users", {
            headers: { "Authorization": `Bearer ${token}`, "Accept": "application/json" }
        });
        console.log("Status:", usersRevoked.status, "(Expected 401)");
        if (usersRevoked.status !== 401) {
            throw new Error(`Test 8 Failed: Expected 401 for revoked token on /users, got ${usersRevoked.status}`);
        }

        console.log("\n[Test 9] Access GET /?reason=session_expired clears session & cookies");
        const reasonReq = await req("/?reason=session_expired", {
            headers: { "Cookie": cookieHeader, "Accept": "text/html" }
        });
        console.log("Status:", reasonReq.status, "Set-Cookie count:", reasonReq.cookies.length);
        if (reasonReq.status !== 200 || reasonReq.cookies.length === 0) {
            throw new Error("Test 9 Failed: Expected 200 and clearing of cookies");
        }

        console.log("\n>>> ALL TESTS PASSED SUCCESSFULLY WITH NEW CODE! <<<");
    } finally {
        server.close();
        process.exit(0);
    }
}

run().catch(err => {
    console.error("Test error:", err);
    if (server) server.close();
    process.exit(1);
});
