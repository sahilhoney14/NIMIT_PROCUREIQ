/**
 * Shared Auth Helpers
 */

async function logoutUser() {
    try {
        const response = await fetch("/logout", { method: "POST" });
        const result = await response.json();
        window.location.href = result.redirect_url || "/";
    } catch {
        window.location.href = "/";
    }
}
