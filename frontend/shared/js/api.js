/**
 * Shared API Client
 */

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

    if (response.status === 401 && !window.location.pathname.startsWith("/login") && window.location.pathname !== "/") {
        localStorage.removeItem("auth_token");
        localStorage.removeItem("auth_user");
        window.location.href = "/?reason=session_expired";
        return null;
    }

    if (response.status === 403) {
        console.warn(`[API] 403 Forbidden for endpoint: ${endpoint}`);
    }

    return response;
}
