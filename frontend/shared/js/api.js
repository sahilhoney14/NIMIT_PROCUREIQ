/**
 * Shared API Client with Silent Token Refresh & Retry
 */

let sharedRefreshPromise = null;

async function silentRefreshToken() {
    if (!sharedRefreshPromise) {
        sharedRefreshPromise = (async () => {
            try {
                const storedRefresh = localStorage.getItem("refresh_token");
                const res = await fetch("/refresh", {
                    method: "POST",
                    credentials: "include",
                    headers: { "Content-Type": "application/json" },
                    body: storedRefresh ? JSON.stringify({ refresh_token: storedRefresh }) : undefined
                });
                if (res.ok) {
                    const data = await res.json();
                    if (data && data.token) {
                        localStorage.setItem("auth_token", data.token);
                        if (data.refreshToken) {
                            localStorage.setItem("refresh_token", data.refreshToken);
                        }
                        return data.token;
                    }
                }
                return null;
            } catch {
                return null;
            } finally {
                sharedRefreshPromise = null;
            }
        })();
    }
    return sharedRefreshPromise;
}

async function apiFetch(endpoint, options = {}) {
    const defaultHeaders = {
        "Accept": "application/json"
    };

    const token = localStorage.getItem("auth_token");
    if (token) {
        defaultHeaders["Authorization"] = `Bearer ${token}`;
    }

    if (!(options.body instanceof FormData)) {
        defaultHeaders["Content-Type"] = "application/json";
    }

    const config = {
        credentials: "include",
        ...options,
        headers: {
            ...defaultHeaders,
            ...options.headers
        }
    };

    const response = await fetch(endpoint, config);

    if (response.status === 401 && !options._retry && !window.location.pathname.startsWith("/login") && window.location.pathname !== "/") {
        const refreshedToken = await silentRefreshToken();
        if (refreshedToken) {
            const retryHeaders = {
                ...config.headers,
                "Authorization": `Bearer ${refreshedToken}`
            };
            return apiFetch(endpoint, { ...options, headers: retryHeaders, _retry: true });
        }
        localStorage.removeItem("auth_token");
        localStorage.removeItem("refresh_token");
        localStorage.removeItem("auth_user");
        window.location.href = "/?reason=session_expired";
        return null;
    }

    if (response.status === 401 && options._retry && !window.location.pathname.startsWith("/login") && window.location.pathname !== "/") {
        localStorage.removeItem("auth_token");
        localStorage.removeItem("refresh_token");
        localStorage.removeItem("auth_user");
        window.location.href = "/?reason=session_expired";
        return null;
    }

    if (response.status === 403) {
        console.warn(`[API] 403 Forbidden for endpoint: ${endpoint}`);
    }

    return response;
}
