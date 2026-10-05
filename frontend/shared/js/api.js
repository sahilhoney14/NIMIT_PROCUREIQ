/**
 * Shared API Client
 */

async function apiFetch(endpoint, options = {}) {
    const defaultHeaders = {
        "Accept": "application/json"
    };

    if (!(options.body instanceof FormData)) {
        defaultHeaders["Content-Type"] = "application/json";
    }

    const config = {
        ...options,
        headers: {
            ...defaultHeaders,
            ...options.headers
        }
    };

    const response = await fetch(endpoint, config);

    if (response.status === 401 && !window.location.pathname.startsWith("/login") && window.location.pathname !== "/") {
        window.location.href = "/";
        return null;
    }

    return response;
}
