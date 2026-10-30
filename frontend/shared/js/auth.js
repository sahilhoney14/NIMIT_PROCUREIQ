/**
 * Shared Auth Helpers
 */

async function logoutUser() {
    try {
        localStorage.removeItem("auth_token");
        localStorage.removeItem("refresh_token");
        localStorage.removeItem("auth_user");
        const response = await fetch("/logout", { 
            method: "POST",
            credentials: "include"
        });
        const result = await response.json();
        window.location.href = result.redirect_url || "/";
    } catch {
        window.location.href = "/";
    }
}
