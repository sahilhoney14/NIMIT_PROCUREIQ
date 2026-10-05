/**
 * Shared Notification Toast Helpers
 */

function showToast(message, type = "info") {
    console.log(`[TOAST - ${type.toUpperCase()}] ${message}`);
    // In browser, create subtle toast element if not present
    let toast = document.getElementById("procureiq-toast");
    if (!toast) {
        toast = document.createElement("div");
        toast.id = "procureiq-toast";
        toast.style.position = "fixed";
        toast.style.bottom = "20px";
        toast.style.right = "20px";
        toast.style.padding = "12px 20px";
        toast.style.borderRadius = "8px";
        toast.style.color = "#ffffff";
        toast.style.fontSize = "14px";
        toast.style.fontWeight = "500";
        toast.style.zIndex = "9999";
        toast.style.boxShadow = "0 4px 12px rgba(0,0,0,0.15)";
        toast.style.transition = "opacity 0.3s ease";
        document.body.appendChild(toast);
    }

    toast.style.backgroundColor = type === "error" ? "#ef4444" : type === "success" ? "#10b981" : "#0b57d0";
    toast.textContent = message;
    toast.style.opacity = "1";

    setTimeout(() => {
        toast.style.opacity = "0";
    }, 3500);
}
