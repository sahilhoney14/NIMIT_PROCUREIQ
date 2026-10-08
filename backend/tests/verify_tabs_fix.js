const http = require("http");

function req(options, data) {
    return new Promise((resolve, reject) => {
        const r = http.request(options, res => {
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

async function verifyAll() {
    console.log("=== VERIFYING API AND PAGE ROUTE DISTINCTION ===");

    // Check 1: Unauthenticated API call to /vendor-performance MUST return 401 JSON, NOT 302 Redirect
    const unauthApi = await req({
        hostname: "localhost",
        port: 3000,
        path: "/vendor-performance",
        method: "GET"
    });
    console.log(`Unauth API (/vendor-performance) -> Status: ${unauthApi.status} (Expected 401)`);
    console.log(`Response is JSON: ${typeof unauthApi.data === "object"}`);
    if (unauthApi.status !== 401 || !unauthApi.data || unauthApi.data.success !== false) {
        throw new Error("Check 1 Failed: Unauth API did not return 401 JSON!");
    }

    // Check 2: Unauthenticated Page Request to /admin with Accept: text/html MUST return 302 Redirect
    const unauthPage = await req({
        hostname: "localhost",
        port: 3000,
        path: "/admin",
        method: "GET",
        headers: { "Accept": "text/html,application/xhtml+xml" }
    });
    console.log(`Unauth Page (/admin) -> Status: ${unauthPage.status} (Expected 302), Location: ${unauthPage.headers.location}`);
    if (unauthPage.status !== 302) {
        throw new Error("Check 2 Failed: Unauth Page did not redirect!");
    }

    // Check 3: Login as admin
    console.log("\nLogging in as admin...");
    const login = await req({
        hostname: "localhost",
        port: 3000,
        path: "/login",
        method: "POST",
        headers: { "Content-Type": "application/json" }
    }, { username: "admin", password: "Password@123" });
    const token = login.data.token;
    const cookie = (login.cookies || []).map(c => c.split(";")[0]).join("; ");
    console.log(`Login status: ${login.status}, Token: ${token.slice(0, 20)}...`);

    // Check 4: Fetch all 5 previously failing endpoints with Bearer token & cookie
    const endpoints = [
        { path: "/vendor-performance", name: "Vendor Performance" },
        { path: "/vendors/all", name: "Edit Vendor (All Vendors)" },
        { path: "/past-price-reference/models", name: "Past Price Reference Models" },
        { path: "/management-insights?period=current_month", name: "Management Insights" },
        { path: "/report-logs?page=1&limit=25", name: "Report Logs" }
    ];

    for (const ep of endpoints) {
        const res = await req({
            hostname: "localhost",
            port: 3000,
            path: ep.path,
            method: "GET",
            headers: {
                "Authorization": `Bearer ${token}`,
                "Cookie": cookie,
                "Accept": "application/json",
                "X-Requested-With": "XMLHttpRequest"
            }
        });
        console.log(`[PASS] ${ep.name} (${ep.path}) -> Status: ${res.status}, Success: ${res.data.success}`);
        if (res.status !== 200 || !res.data.success) {
            throw new Error(`Failed endpoint ${ep.name}: ${JSON.stringify(res.data)}`);
        }
    }

    console.log("\n>>> ALL 5 PREVIOUSLY FAILING DASHBOARD TABS WORK PERFECTLY NOW! <<<");
}

verifyAll().catch(err => {
    console.error("VERIFICATION FAILED:", err);
    process.exit(1);
});
