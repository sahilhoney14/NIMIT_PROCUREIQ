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
        if (window.location.pathname !== target && window.location.pathname !== target + "/") {
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

    // 2. Synchronous pre-check of local storage credentials
    const token = localStorage.getItem("auth_token");
    let cachedUser = null;
    try {
        cachedUser = JSON.parse(localStorage.getItem("auth_user") || "null");
    } catch {
        cachedUser = null;
    }

    // If client has no token and no injected server session variable, redirect immediately
    const serverUser = window.currentUsername;
    if (!token && !cachedUser && !serverUser) {
        redirectToLogin("unauthenticated");
        return;
    }

    // If cached role is present and not allowed for this route, redirect immediately
    if (cachedUser && cachedUser.role && allowedRoles.length > 0) {
        if (!allowedRoles.includes(cachedUser.role.toUpperCase())) {
            console.warn(`[AuthGuard] Role '${cachedUser.role}' is not authorized for this page.`);
            redirectToPortal(cachedUser.role.toUpperCase());
            return;
        }
    }

    // 3. Asynchronous server verification with backend /verify
    const headers = { "Accept": "application/json" };
    if (token) {
        headers["Authorization"] = `Bearer ${token}`;
    }

    fetch("/verify", {
        method: "GET",
        headers,
        credentials: "include"
    })
    .then(async response => {
        if (!response.ok) {
            throw new Error(`Auth verification failed with status: ${response.status}`);
        }
        return response.json();
    })
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
                localStorage.removeItem("auth_user");
                window.location.replace("/");
            }
        }
    };
})();
