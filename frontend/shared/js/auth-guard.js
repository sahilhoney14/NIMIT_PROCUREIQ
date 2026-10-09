/**
 * ProcureIQ Enterprise - Unified Frontend Route Guard & Authorization Protection
 * Prevents unauthorized or unauthenticated users from opening protected dashboard URLs.
 */
(function () {
    "use strict";

    // 1. Prevent any flash of protected UI before authentication is verified
    document.documentElement.classList.add("auth-pending");
    if (!document.getElementById("auth-guard-style")) {
        const style = document.createElement("style");
        style.id = "auth-guard-style";
        style.textContent = `
            html.auth-pending body {
                visibility: hidden !important;
                opacity: 0 !important;
                pointer-events: none !important;
            }
        `;
        (document.head || document.documentElement).appendChild(style);
    }

    // Determine allowed roles from current script tag or URL path
    const currentScript = document.currentScript;
    let allowedRoles = [];
    if (currentScript && currentScript.dataset.allowedRoles) {
        allowedRoles = currentScript.dataset.allowedRoles.split(",").map(r => r.trim().toUpperCase());
    } else {
        const path = window.location.pathname.toLowerCase();
        if (path.includes("/admin")) {
            allowedRoles = ["ADMIN"];
        } else if (path.includes("/procurement-manager")) {
            allowedRoles = ["ADMIN", "PROCUREMENT_MANAGER"];
        } else if (path.includes("/procurement")) {
            allowedRoles = ["ADMIN", "PROCUREMENT_MANAGER", "PROCUREMENT"];
        }
    }

    // Role portal redirect destinations
    const ROLE_HOME = {
        ADMIN: "/admin",
        PROCUREMENT_MANAGER: "/procurement-manager",
        PROCUREMENT: "/procurement"
    };

    function redirectToLogin(reason) {
        localStorage.removeItem("auth_token");
        localStorage.removeItem("refresh_token");
        localStorage.removeItem("auth_user");
        const currentPath = window.location.pathname;
        let target = "/";
        if (reason) {
            target += `?reason=${encodeURIComponent(reason)}`;
        }
        window.location.replace(target);
    }

    function redirectToPortal(role) {
        const target = ROLE_HOME[role] || "/";
        const currentClean = window.location.pathname.replace(/\/+$/, "") || "/";
        const targetClean = target.replace(/\/+$/, "") || "/";
        if (currentClean !== targetClean) {
            window.location.replace(target);
        } else {
            // Already on correct portal, reveal
            revealPage();
        }
    }

    function revealPage() {
        document.documentElement.classList.remove("auth-pending");
        const style = document.getElementById("auth-guard-style");
        if (style) {
            style.remove();
        }
    }

    // Failsafe: Never leave the page blank white if network or verification stalls
    setTimeout(revealPage, 800);

    // 2. Synchronous pre-check of local storage or server-injected credentials
    const token = localStorage.getItem("auth_token");
    let cachedUser = null;
    try {
        cachedUser = JSON.parse(localStorage.getItem("auth_user") || "null");
    } catch {
        cachedUser = null;
    }

    const serverUser = window.currentUsername;
    const serverRole = (window.currentUserRole || "").toUpperCase();

    // If server already verified and injected user credentials, reveal immediately
    if (serverUser) {
        if (allowedRoles.length > 0 && serverRole && !allowedRoles.includes(serverRole)) {
            redirectToPortal(serverRole);
            return;
        }
        revealPage();
    } else if (!token && !cachedUser) {
        // If client has no token, no cached user, and no server session, redirect to login
        redirectToLogin("unauthenticated");
        return;
    }

    // If cached role is present and not allowed for this route, redirect
    if (cachedUser && cachedUser.role && allowedRoles.length > 0) {
        if (!allowedRoles.includes(cachedUser.role.toUpperCase())) {
            console.warn(`[AuthGuard] Role '${cachedUser.role}' is not authorized for this page.`);
            redirectToPortal(cachedUser.role.toUpperCase());
            return;
        }
    }

    // 3. Asynchronous server verification with backend /verify & silent refresh
    async function verifySession() {
        let currentToken = localStorage.getItem("auth_token");
        const headers = { "Accept": "application/json" };
        if (currentToken) {
            headers["Authorization"] = `Bearer ${currentToken}`;
        }

        let response = await fetch("/verify", {
            method: "GET",
            headers,
            credentials: "include"
        });

        if (response.status === 401) {
            try {
                const storedRefresh = localStorage.getItem("refresh_token");
                const refreshRes = await fetch("/refresh", {
                    method: "POST",
                    credentials: "include",
                    headers: { "Content-Type": "application/json" },
                    body: storedRefresh ? JSON.stringify({ refresh_token: storedRefresh }) : undefined
                });
                if (refreshRes.ok) {
                    const refreshData = await refreshRes.json();
                    if (refreshData && refreshData.token) {
                        localStorage.setItem("auth_token", refreshData.token);
                        if (refreshData.refreshToken) {
                            localStorage.setItem("refresh_token", refreshData.refreshToken);
                        }
                        headers["Authorization"] = `Bearer ${refreshData.token}`;
                        response = await fetch("/verify", {
                            method: "GET",
                            headers,
                            credentials: "include"
                        });
                    }
                }
            } catch (e) {
                // Refresh attempt failed
            }
        }

        if (!response.ok) {
            throw new Error(`Auth verification failed with status: ${response.status}`);
        }
        return response.json();
    }

    verifySession()
    .then(data => {
        if (!data || !data.authenticated) {
            throw new Error("User session is not authenticated");
        }

        const role = (data.role || "").toUpperCase();

        // Check if role is authorized for this specific dashboard
        if (allowedRoles.length > 0 && !allowedRoles.includes(role)) {
            console.warn(`[AuthGuard] Access Forbidden: Role '${role}' not authorized.`);
            redirectToPortal(role);
            return;
        }

        // Store refreshed user info
        localStorage.setItem("auth_user", JSON.stringify({
            user_id: data.user_id,
            username: data.username,
            role: data.role
        }));

        window.currentUser = data;

        // Reveal the UI safely
        revealPage();

        // Dispatch authentication event for page scripts
        window.dispatchEvent(new CustomEvent("procureiq:authenticated", { detail: data }));
    })
    .catch(err => {
        console.warn("[AuthGuard] Session validation error:", err.message);
        localStorage.removeItem("auth_token");
        localStorage.removeItem("refresh_token");
        localStorage.removeItem("auth_user");
        redirectToLogin("session_expired");
    });

    // Expose global auth controller
    window.ProcureAuth = {
        getUser: () => cachedUser || window.currentUser,
        getToken: () => localStorage.getItem("auth_token"),
        logout: async () => {
            try {
                await fetch("/logout", { method: "POST", credentials: "include" });
            } finally {
                localStorage.removeItem("auth_token");
                localStorage.removeItem("refresh_token");
                localStorage.removeItem("auth_user");
                window.location.replace("/");
            }
        }
    };
})();
