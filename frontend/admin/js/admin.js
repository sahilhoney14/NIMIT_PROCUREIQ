// =============================================================================
// ProcureIQ - ADMIN script.js
// Admin user management (Manage Access) + every manager feature.
// All top-level bindings are null-safe, so a page that is missing from
// index.html never breaks the rest of the script.
// =============================================================================

// ─── DOM References ────────────────────────────────────────────────────────────

// Users / Manage Access (admin)
const usersTableBody = document.getElementById("usersTableBody");
const usersMessage   = document.getElementById("usersMessage");
const userModal      = document.getElementById("userModal");
const passwordModal  = document.getElementById("passwordModal");
const addUserForm    = document.getElementById("addUserForm");
const passwordForm   = document.getElementById("passwordForm");

// Purchase Requests
const manualButton        = document.getElementById("manualButton");
const excelButton         = document.getElementById("excelButton");
const manualSection       = document.getElementById("manualSection");
const excelSection        = document.getElementById("excelSection");
const manualForm          = document.getElementById("manualForm");
const qtyInput            = document.getElementById("qty");
const salesRateInput      = document.getElementById("sales_rate");
const taxableValueInput   = document.getElementById("taxable_value");
const excelFile               = document.getElementById("excelFile");
const excelFileName           = document.getElementById("excelFileName");
const clearExcelFileBtn       = document.getElementById("clearExcelFileBtn");
const importButton            = document.getElementById("importButton");
const excelPreview            = document.getElementById("excelPreview");
const closePrPreviewBtn       = document.getElementById("closePrPreviewBtn");
const previewBody             = document.getElementById("previewBody");
const saveImportedButton      = document.getElementById("saveImportedButton");
const cancelImportedButton    = document.getElementById("cancelImportedButton");
const message                 = document.getElementById("message");

// Vendor Masters
const vendorManualButton        = document.getElementById("vendorManualButton");
const vendorExcelButton         = document.getElementById("vendorExcelButton");
const vendorManualSection       = document.getElementById("vendorManualSection");
const vendorExcelSection        = document.getElementById("vendorExcelSection");
const vendorManualForm          = document.getElementById("vendorManualForm");
const vendorExcelFile           = document.getElementById("vendorExcelFile");
const vendorExcelFileName       = document.getElementById("vendorExcelFileName");
const clearVendorExcelFileBtn   = document.getElementById("clearVendorExcelFileBtn");
const vendorImportButton        = document.getElementById("vendorImportButton");
const vendorExcelPreview        = document.getElementById("vendorExcelPreview");
const closeVendorPreviewBtn     = document.getElementById("closeVendorPreviewBtn");
const vendorPreviewForm         = document.getElementById("vendorPreviewForm");
const saveVendorExcelButton     = document.getElementById("saveVendorExcelButton");
const cancelVendorExcelButton   = document.getElementById("cancelVendorExcelButton");
const vendorMessage             = document.getElementById("vendorMessage");

// Vendor Inquiries
const vendorInquiriesPage = document.getElementById("vendorInquiriesPage");
const vendorInquiryList   = document.getElementById("vendorInquiryList");

// Purchase Orders
const purchaseOrdersList = document.getElementById("purchaseOrdersList");

// Order Tracking
const orderTrackingList      = document.getElementById("orderTrackingList");
const orderTrackingPrev      = document.getElementById("orderTrackingPrev");
const orderTrackingNext      = document.getElementById("orderTrackingNext");
const orderTrackingPageLabel = document.getElementById("orderTrackingPageLabel");

// Goods Received
const goodsReceivedList    = document.getElementById("goodsReceivedList");
const goodsReceivedMessage = document.getElementById("goodsReceivedMessage");

// Reports & Audits
const reportLogsTabButton = document.getElementById("reportLogsTabButton");
const auditLogsTabButton  = document.getElementById("auditLogsTabButton");
const loginLogsTabButton  = document.getElementById("loginLogsTabButton");
const reportLogsSection   = document.getElementById("reportLogsSection");
const auditLogsSection    = document.getElementById("auditLogsSection");
const loginLogsSection    = document.getElementById("loginLogsSection");
const reportLogsBody      = document.getElementById("reportLogsBody");
const auditLogsBody       = document.getElementById("auditLogsBody");
const loginLogsBody       = document.getElementById("loginLogsBody");
const logUsernameFilter   = document.getElementById("logUsernameFilter");
const logFromDate         = document.getElementById("logFromDate");
const logToDate           = document.getElementById("logToDate");
const applyLogFilters     = document.getElementById("applyLogFilters");
const logsMessage         = document.getElementById("logsMessage");
const logsPrev            = document.getElementById("logsPrev");
const logsNext            = document.getElementById("logsNext");
const logsPageLabel       = document.getElementById("logsPageLabel");

// Logout
const logoutButton = document.getElementById("logoutButton");

// ─── State ─────────────────────────────────────────────────────────────────────

let selectedUserId = null;
let importedRows = [];
let orderTrackingPage = 1;
let orderTrackingTotalPages = 1;
let orderTrackingStatus = "ALL";
let orderTrackingParty = "ALL";
let orderTrackingSearchQuery = "";
let orderTrackingFromDate = "";
let orderTrackingToDate = "";
let orderTrackingDatePreset = "ALL";
let orderTrackingDebounceTimer = null;
let orderTrackingFiltersInitialized = false;
let goodsReceivedOrders = [];
let showCompletedGoods = false;
let activeLogTab    = "report";   // "report" | "audit"
let logsPage         = 1;
let logsTotalPages   = 1;

// ─── Utilities ─────────────────────────────────────────────────────────────────

function escapeHtml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function showMessage(text) {
    if (message) message.textContent = text;
}

function showVendorMessage(text) {
    if (vendorMessage) vendorMessage.textContent = text;
}

function showUsersMessage(text) {
    if (usersMessage) usersMessage.textContent = text;
}

function showPage(pageId) {
    document.getElementById(pageId)?.classList.remove("hidden");
}

function formatDate(value) {
    if (!value) return "-";
    const d = new Date(value);
    return isNaN(d.getTime()) ? String(value) : d.toLocaleDateString("en-IN");
}

function formatDateTime(value) {
    if (!value) return "-";
    const d = new Date(value);
    if (isNaN(d.getTime())) return String(value);
    return d.toLocaleString("en-IN", {
        day: "2-digit", month: "short", year: "numeric",
        hour: "2-digit", minute: "2-digit"
    });
}

function formatCurrency(value) {
    const n = Number(value);
    return isNaN(n) ? "-" : n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// sign-aware rupee format  (-500 -> "-₹500.00" instead of "₹-500.00")
function formatRupee(value) {
    const n = Number(value);
    if (isNaN(n)) return "-";
    return `${n < 0 ? "-" : ""}₹${formatCurrency(Math.abs(n))}`;
}

function todayISO() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// read username at time of use, not once at script load
function currentUser() {
    return window.currentUsername || "";
}

// apiFetch: used by the Proforma Invoice calls. Only defined here if another
// script has not already provided it. On a 401 it redirects to the login page.
// apiFetch: used by all dashboard calls. Automatically refreshes access tokens silently on 401.
let adminRefreshPromise = null;

async function silentRefreshTokenAdmin() {
    if (!adminRefreshPromise) {
        adminRefreshPromise = (async () => {
            try {
                const storedRefresh = localStorage.getItem("refresh_token");
                const res = await fetch("/refresh", {
                    method: "POST",
                    credentials: "include",
                    headers: {
                        "Accept": "application/json",
                        "Content-Type": "application/json",
                        "X-Requested-With": "XMLHttpRequest"
                    },
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
                adminRefreshPromise = null;
            }
        })();
    }
    return adminRefreshPromise;
}

async function apiFetch(url, options = {}) {
    const token = localStorage.getItem("auth_token");
    const headers = {
        "Accept": "application/json",
        "X-Requested-With": "XMLHttpRequest",
        ...options.headers
    };
    if (token && !headers["Authorization"]) {
        headers["Authorization"] = `Bearer ${token}`;
    }

    try {
        const response = await fetch(url, { credentials: "include", ...options, headers });
        const contentType = response.headers.get("content-type") || "";

        // If server redirected to HTML login page (unauthenticated)
        if (response.redirected || (response.status === 200 && contentType.includes("text/html"))) {
            if (!options._retry) {
                const refreshedToken = await silentRefreshTokenAdmin();
                if (refreshedToken) {
                    headers["Authorization"] = `Bearer ${refreshedToken}`;
                    return apiFetch(url, { ...options, headers, _retry: true });
                }
            }
            localStorage.removeItem("auth_token");
            localStorage.removeItem("refresh_token");
            localStorage.removeItem("auth_user");
            window.location.href = "/?reason=session_expired";
            return null;
        }

        // On 401 Unauthorized, silently refresh and retry
        if (response.status === 401 && !options._retry) {
            const refreshedToken = await silentRefreshTokenAdmin();
            if (refreshedToken) {
                headers["Authorization"] = `Bearer ${refreshedToken}`;
                return apiFetch(url, { ...options, headers, _retry: true });
            }
            localStorage.removeItem("auth_token");
            localStorage.removeItem("refresh_token");
            localStorage.removeItem("auth_user");
            window.location.href = "/?reason=session_expired";
            return null;
        }

        if (response.status === 401 && options._retry) {
            localStorage.removeItem("auth_token");
            localStorage.removeItem("refresh_token");
            localStorage.removeItem("auth_user");
            window.location.href = "/?reason=session_expired";
            return null;
        }

        return response;
    } catch (networkErr) {
        console.error(`[apiFetch] Network error for ${url}:`, networkErr);
        throw networkErr;
    }
}

window.apiFetch = apiFetch;

function prefillOfficeUse() {
    const regDate = document.getElementById("registration_date");
    const rec     = document.getElementById("recommended_by");
    const app     = document.getElementById("approved_by");
    if (regDate && !regDate.value) regDate.value = todayISO();
    if (rec && !rec.value)         rec.value     = currentUser();
    if (app && !app.value)         app.value     = currentUser();
}

// Shared PR info grid used by inquiries / quotations / order tracking / purchase orders
function prInfoItems(x, extraFirst = "") {
    const item = (label, value) => `
        <div class="inquiry-card-item">
            <span class="inquiry-card-label">${label}</span>
            <span class="inquiry-card-value">${value}</span>
        </div>`;

    return `
        ${extraFirst}
        ${x.po_date ? item("PO Date", formatDate(x.po_date)) : ""}
        ${item("PR Number", escapeHtml(x.pr_number || "-"))}
        ${item("PR Date", formatDate(x.pr_date))}
        ${item("Party Name", escapeHtml(x.party_name || "-"))}
        ${item("Location", escapeHtml(x.location || "-"))}
        ${item("Territory", escapeHtml(x.territory || "-"))}
        ${item("Product Category", escapeHtml(x.product_category || "-"))}
        ${item("Item Name", escapeHtml(x.item_name || "-"))}
        ${item("Make / Model", `${escapeHtml(x.make || "-")} / ${escapeHtml(x.model || "-")}`)}
        ${item("Quantity", `${escapeHtml(x.qty ?? 0)} ${escapeHtml(x.unit || "")}`)}
        ${item("Sales Rate", formatCurrency(x.sales_rate))}
        ${item("Taxable Value", formatCurrency(x.taxable_value))}
        ${item("Product Remarks", escapeHtml(x.product_remarks || "-"))}
    `;
}

// Prevent scroll from changing number input values
document.addEventListener("wheel", event => {
    if (document.activeElement?.type === "number") {
        document.activeElement.blur();
    }
}, { passive: true });

// ─── Sidebar Dropdown Navigation ────────────────────────────────────────────────────────

// Dropdown Toggles (Workspace, Vendors, Intelligence, Management)
document.querySelectorAll(".nav-dropdown-toggle").forEach(button => {
    button.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        const group = button.closest(".nav-dropdown-group");
        if (!group) return;

        const wasOpen = group.classList.contains("open");

        // Accordion behavior: close other open dropdowns
        document.querySelectorAll(".nav-dropdown-group").forEach(g => {
            if (g !== group) {
                g.classList.remove("open");
            }
        });

        // Toggle this dropdown
        if (wasOpen) {
            group.classList.remove("open");
        } else {
            group.classList.add("open");
        }
    });
});

// All Actionable Navigation Items (.submenu-item)
document.querySelectorAll(".submenu-item").forEach(button => {
    button.addEventListener("click", () => {
        if (button.classList.contains("disabled") || button.disabled) return;

        // Clear active state across all navigation items
        document.querySelectorAll(".submenu-item").forEach(b => b.classList.remove("active"));
        document.querySelectorAll(".page").forEach(p => p.classList.add("hidden"));

        button.classList.add("active");

        // Maintain dropdown toggle active-parent state
        document.querySelectorAll(".nav-dropdown-toggle").forEach(t => t.classList.remove("active-parent"));
        document.querySelectorAll(".nav-direct-item").forEach(d => d.classList.remove("active"));

        const parentGroup = button.closest(".nav-dropdown-group");
        if (parentGroup) {
            parentGroup.classList.add("open");
            const parentToggle = parentGroup.querySelector(".nav-dropdown-toggle");
            if (parentToggle) parentToggle.classList.add("active-parent");

            // Close other dropdowns for a clean accordion look
            document.querySelectorAll(".nav-dropdown-group").forEach(g => {
                if (g !== parentGroup) g.classList.remove("open");
            });
        } else {
            // Direct item like Users
            button.classList.add("active");
            // Close any open dropdowns when navigating to a direct item
            document.querySelectorAll(".nav-dropdown-group").forEach(g => g.classList.remove("open"));
        }

        const page = button.dataset.page;

        // ── Admin ──
        if (page === "manage-access") {
            showPage("manageAccessPage");
            loadUsers();
        }

        // ── Workspace ──
        if (page === "workspace-dashboard") {
            showPage("workspaceDashboardPage");
            if (window.WorkspaceDashboard) {
                window.WorkspaceDashboard.load();
            }
        }

        if (page === "purchase-requests") {
            showPage("purchaseRequestsPage");
        }

        if (page === "vendor-inquiries") {
            vendorInquiriesPage?.classList.remove("hidden");
            loadVendorInquiries();
        }

        if (page === "quotation-comparisons") {
            showPage("quotationComparisonsPage");
            loadQuotationComparisons();
        }

        if (page === "purchase-orders") {
            showPage("purchaseOrdersPage");
            loadPurchaseOrders();
        }

        if (page === "order-tracking") {
            showPage("orderTrackingPage");
            orderTrackingPage = 1;
            loadOrderTracking();
        }

        if (page === "goods-received") {
            showPage("goodsReceivedPage");
            loadGoodsReceived();
        }

        // ── Vendors ──
        if (page === "vendor-masters") {
            showPage("vendorMastersPage");
            setTurnoverYears();
            prefillOfficeUse();
        }

        if (page === "vendor-performance") {
            showPage("vendorPerformancePage");
            loadVendorPerformance();
        }

        // ── Intelligence ──
        if (page === "past-price-reference") {
            showPage("pastPriceReferencePage");
            initPastPriceReference();
        }

        // ── Management ──
        if (page === "management-insights") {
            showPage("managementInsightsPage");
            loadManagementInsights();
        }

        if (page === "reports-audits") {
            showPage("reportsAuditsPage");
            switchLogTab(activeLogTab || "report");
        }

        if (page === "edit-vendor") {
            showPage("editVendorPage");
            initEditVendor();
        }
    });
});

// =============================================================================
// USERS  (admin only) - Manage Access
// =============================================================================

async function loadUsers() {
    if (!usersTableBody) return;

    try {
        const response = await apiFetch("/users");
        if (!response) return;  

        const data = await response.json();

        if (!data.success) {
            showUsersMessage(data.message || "Failed to load users");
            return;
        }

        usersTableBody.innerHTML = "";

        const loggedInUser = (window.ProcureAuth && window.ProcureAuth.getUser()) ||
                             JSON.parse(localStorage.getItem("auth_user") || "null");
        const currentUserId = loggedInUser?.user_id;
        const currentUsername = loggedInUser?.username;

        data.users.forEach(user => {
            const row = document.createElement("tr");
            const isSelf = Boolean((currentUserId && user.user_id === currentUserId) ||
                                   (currentUsername && user.username.toLowerCase() === currentUsername.toLowerCase()));
            const isPrimaryAdmin = user.username.toLowerCase() === "admin";
            const canDelete = !isSelf && !isPrimaryAdmin;

            row.innerHTML = `
                <td>${escapeHtml(user.username)}</td>
                <td>${escapeHtml(user.role)}</td>
                <td class="${user.is_active ? "access-granted" : "access-revoked"}">
                    ${user.is_active ? "Granted" : "Revoked"}
                </td>
                <td class="user-actions-cell">
                    <div class="user-actions-group">
                        <button class="action-button password-button" onclick="openPasswordModal(${user.user_id})">Change Password</button>
                        <button class="action-button ${user.is_active ? "revoke-button" : "grant-button"}" onclick="changeAccess(${user.user_id}, ${!user.is_active})">
                            ${user.is_active ? "Revoke Access" : "Grant Access"}
                        </button>
                        ${canDelete ? `
                        <button class="action-button delete-button btn-delete-user" data-user-id="${user.user_id}" data-username="${escapeHtml(user.username)}" title="Delete User">
                            <svg class="action-btn-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <polyline points="3 6 5 6 21 6"></polyline>
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                <line x1="10" y1="11" x2="10" y2="17"></line>
                                <line x1="14" y1="11" x2="14" y2="17"></line>
                            </svg>
                            <span>Delete</span>
                        </button>` : `
                        <button class="action-button delete-button" disabled title="${isSelf ? "Cannot delete active logged-in account" : "Primary admin cannot be deleted"}">
                            <svg class="action-btn-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <polyline points="3 6 5 6 21 6"></polyline>
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                <line x1="10" y1="11" x2="10" y2="17"></line>
                                <line x1="14" y1="11" x2="14" y2="17"></line>
                            </svg>
                            <span>Delete</span>
                        </button>`}
                    </div>
                </td>
            `;

            usersTableBody.appendChild(row);
            const delBtn = row.querySelector(".btn-delete-user");
            if (delBtn) {
                delBtn.addEventListener("click", () => {
                    deleteUser(Number(delBtn.dataset.userId), delBtn.dataset.username);
                });
            }
        });
    } catch (error) {
        console.error(error);
        showUsersMessage("Unable to connect to admin service");
    }
}

async function changeAccess(userId, isActive) {
    try {
        const response = await apiFetch(`/users/${userId}/access`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ is_active: isActive })
        });
        if (!response) return;

        const data = await response.json();

        if (!response.ok) {
            showUsersMessage(data.message || "Failed to change access");
            return;
        }

        showUsersMessage(data.message);
        await loadUsers();
    } catch (error) {
        console.error(error);
        showUsersMessage("Unable to change access");
    }
}

async function deleteUser(userId, username) {
    if (!userId) return;
    const ok = confirm(`Are you sure you want to permanently delete user "${username}"?\nThis action cannot be undone.`);
    if (!ok) return;

    try {
        const response = await apiFetch(`/users/${userId}`, {
            method: "DELETE"
        });
        if (!response) return;

        const data = await response.json();

        if (!response.ok || !data.success) {
            showUsersMessage(data.message || "Failed to delete user");
            return;
        }

        showUsersMessage(data.message || `User "${username}" deleted successfully`);
        await loadUsers();
    } catch (error) {
        console.error("Error deleting user:", error);
        showUsersMessage("Unable to delete user");
    }
}

function openPasswordModal(userId) {
    selectedUserId = userId;
    document.getElementById("newPassword").value = "";
    document.getElementById("passwordMessage").textContent = "";
    passwordModal.classList.remove("hidden");
}

document.getElementById("closePasswordModalButton")?.addEventListener("click", () => {
    passwordModal.classList.add("hidden");
});

passwordForm?.addEventListener("submit", async event => {
    event.preventDefault();

    const password        = document.getElementById("newPassword").value;
    const passwordMessage = document.getElementById("passwordMessage");

    try {
        const response = await apiFetch(`/users/${selectedUserId}/password`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ password })
        });
        if (!response) return;

        const data = await response.json();

        if (!response.ok) {
            passwordMessage.textContent = data.message || "Failed to change password";
            return;
        }

        passwordModal.classList.add("hidden");
        showUsersMessage(data.message);
    } catch (error) {
        console.error(error);
        passwordMessage.textContent = "Unable to change password";
    }
});

document.getElementById("addUserButton")?.addEventListener("click", () => {
    document.getElementById("modalMessage").textContent = "";
    addUserForm.reset();
    userModal.classList.remove("hidden");
});

document.getElementById("closeModalButton")?.addEventListener("click", () => {
    userModal.classList.add("hidden");
});

addUserForm?.addEventListener("submit", async event => {
    event.preventDefault();

    const username     = document.getElementById("username").value.trim();
    const password     = document.getElementById("password").value;
    const role         = document.getElementById("role").value;
    const modalMessage = document.getElementById("modalMessage");

    try {
        const response = await apiFetch("/users", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username, password, role })
        });
        if (!response) return;

        const data = await response.json();

        if (!response.ok) {
            modalMessage.textContent = data.message || "Failed to add user";
            return;
        }

        userModal.classList.add("hidden");
        showUsersMessage(data.message);
        await loadUsers();
    } catch (error) {
        console.error(error);
        modalMessage.textContent = "Unable to add user";
    }
});

// ─── Purchase Request: Taxable Value ───────────────────────────────────────────

// allow rates below 1 (e.g. 0.75)
if (salesRateInput) salesRateInput.min = "0.01";

function calculateTaxableValue() {
    if (!qtyInput || !salesRateInput || !taxableValueInput) return;
    const qty  = Number(qtyInput.value)       || 0;
    const rate = Number(salesRateInput.value) || 0;
    taxableValueInput.value = (qty * rate).toFixed(2);
}

qtyInput?.addEventListener("input", calculateTaxableValue);
salesRateInput?.addEventListener("input", calculateTaxableValue);

// ─── PR Toggle: Manual / Excel ─────────────────────────────────────────────────

manualButton?.addEventListener("click", () => {
    manualButton.classList.add("active");
    excelButton.classList.remove("active");
    manualSection.classList.remove("hidden");
    excelSection.classList.add("hidden");
    showMessage("");
});

excelButton?.addEventListener("click", () => {
    excelButton.classList.add("active");
    manualButton.classList.remove("active");
    excelSection.classList.remove("hidden");
    manualSection.classList.add("hidden");
    showMessage("");
});

// ─── PR Manual Form Submit ─────────────────────────────────────────────────────

manualForm?.addEventListener("submit", async event => {
    event.preventDefault();

    const data = {
        pr_date:          document.getElementById("pr_date").value,
        party_name:       document.getElementById("party_name").value,
        location:         document.getElementById("location").value,
        territory:        document.getElementById("territory").value,
        product_category: document.getElementById("product_category").value,
        item_name:        document.getElementById("item_name").value,
        product_remarks:  document.getElementById("product_remarks").value,
        make:             document.getElementById("make").value,
        model:            document.getElementById("model").value,
        qty:              document.getElementById("qty").value,
        unit:             document.getElementById("unit").value,
        sales_rate:       document.getElementById("sales_rate").value
    };

    const submitBtn = manualForm.querySelector("button[type='submit']");

    try {
        submitBtn.disabled = true;
        showMessage("Saving purchase request...");

        const response = await apiFetch("/purchase-requests", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data)
        });
        if (!response) return;

        const result = await response.json();

        if (!response.ok) {
            showMessage(result.message || "Failed to add purchase request");
            return;
        }

        alert(`PR for "${data.item_name}" created successfully!\nPR Number: ${result.pr_number}`);
        showMessage("");
        manualForm.reset();
        calculateTaxableValue();

    } catch {
        showMessage("Failed to connect to procurement service");
    } finally {
        submitBtn.disabled = false;
    }
});

// ─── PR Excel: File Chosen & Clear ─────────────────────────────────────────────

function clearPrExcel() {
    importedRows = [];
    previewBody.innerHTML = "";
    excelPreview?.classList.add("hidden");
    if (excelFile) excelFile.value = "";
    if (excelFileName) excelFileName.textContent = "No file chosen";
    clearExcelFileBtn?.classList.add("hidden");
    showMessage("");
}

excelFile?.addEventListener("change", () => {
    if (excelFile.files.length) {
        excelFileName.textContent = excelFile.files[0].name;
        clearExcelFileBtn?.classList.remove("hidden");
    } else {
        excelFileName.textContent = "No file chosen";
        clearExcelFileBtn?.classList.add("hidden");
    }
});

clearExcelFileBtn?.addEventListener("click", () => {
    clearPrExcel();
    showMessage("File selection cleared.");
});

closePrPreviewBtn?.addEventListener("click", () => {
    clearPrExcel();
    showMessage("Import discarded.");
});

cancelImportedButton?.addEventListener("click", () => {
    clearPrExcel();
    showMessage("Import discarded.");
});

// ─── PR Excel: Import Preview ──────────────────────────────────────────────────

importButton?.addEventListener("click", async () => {
    if (!excelFile.files.length) {
        showMessage("Please select an Excel file");
        return;
    }

    const formData = new FormData();
    formData.append("file", excelFile.files[0]);

    try {
        importButton.disabled = true;
        showMessage("Processing Excel file...");

        const response = await apiFetch("/purchase-requests/import-preview", {
            method: "POST",
            body: formData
        });
        if (!response) return;

        const result = await response.json();

        if (!response.ok) {
            showMessage(result.message || "Failed to process Excel file");
            return;
        }

        importedRows = result.rows || [];

        const today = todayISO();
        importedRows.forEach(row => {
            if (!row.pr_date || String(row.pr_date).trim() === "") {
                row.pr_date = today;
            }
        });

        renderPreview();
        showMessage(`${importedRows.length} rows ready for review. Edit if needed, then click Save.`);

    } catch {
        showMessage("Failed to connect to procurement manager service");
    } finally {
        importButton.disabled = false;
    }
});

// ─── PR Excel: Render Editable Preview Table ───────────────────────────────────

const TERRITORY_OPTIONS = [
    "North",
    "South (Dahej)",
    "South (Bharuch)",
    "West",
    "Central Projects",
    "Central Services",
    "Central Contracts",
    "Ahmedabad",
    "Pan India",
    "Kutch",
    "Surat"
];

function renderPreview() {
    previewBody.innerHTML = "";

    importedRows.forEach((row, index) => {
        const tr = document.createElement("tr");

        const normT = s => String(s || "").toLowerCase().replace(/[\s()]+/g, "");
        const currentTerritoryNorm = normT(row.territory);
        const territoryOptionsHtml = TERRITORY_OPTIONS.map(t => {
            const isSel = normT(t) === currentTerritoryNorm ? "selected" : "";
            return `<option value="${t}" ${isSel}>${t}</option>`;
        }).join("");
        const isKnownTerritory = TERRITORY_OPTIONS.some(t => normT(t) === currentTerritoryNorm);
        const customTerritoryOpt = (!isKnownTerritory && row.territory)
            ? `<option value="${escapeHtml(row.territory)}" selected>${escapeHtml(row.territory)}</option>`
            : "";

        tr.innerHTML = `
            <td><input type="date" data-index="${index}" data-field="pr_date" value="${escapeHtml(String(row.pr_date || "").slice(0, 10))}"></td>
            <td><input data-index="${index}" data-field="party_name"       value="${escapeHtml(row.party_name || "")}"></td>
            <td><input data-index="${index}" data-field="location"         value="${escapeHtml(row.location || "")}"></td>
            <td>
                <select data-index="${index}" data-field="territory">
                    <option value="" ${!row.territory ? "selected" : ""}>Select Territory</option>
                    ${territoryOptionsHtml}
                    ${customTerritoryOpt}
                </select>
            </td>
            <td><input data-index="${index}" data-field="product_category" value="${escapeHtml(row.product_category || "")}"></td>
            <td><input data-index="${index}" data-field="item_name"        value="${escapeHtml(row.item_name || "")}"></td>
            <td><input data-index="${index}" data-field="product_remarks"  value="${escapeHtml(row.product_remarks || "")}"></td>
            <td><input data-index="${index}" data-field="make"             value="${escapeHtml(row.make || "")}"></td>
            <td><input data-index="${index}" data-field="model"            value="${escapeHtml(row.model || "")}"></td>
            <td><input type="number" data-index="${index}" data-field="qty"        value="${row.qty ?? 0}"        min="0.01" step="0.01"></td>
            <td>
                <select data-index="${index}" data-field="unit">
                    <option value="number" ${(row.unit || "number") === "number" ? "selected" : ""}>Number</option>
                    <option value="set"    ${row.unit === "set"    ? "selected" : ""}>Set</option>
                    <option value="meter"  ${row.unit === "meter"  ? "selected" : ""}>Meter</option>
                    <option value="lot"    ${row.unit === "lot"    ? "selected" : ""}>Lot</option>
                </select>
            </td>
            <td><input type="number" data-index="${index}" data-field="sales_rate" value="${row.sales_rate ?? 0}" min="0.01" step="0.01"></td>
            <td><input class="taxable-input" type="number" value="${calculateRowTaxableValue(row)}" readonly></td>
            <td style="text-align: center;"><button type="button" class="row-delete-btn" data-delete-index="${index}" title="Remove this row">✕</button></td>
        `;

        previewBody.appendChild(tr);
    });

    excelPreview.classList.remove("hidden");

    previewBody.querySelectorAll("[data-field]").forEach(input => {
        input.addEventListener("change", updateImportedRow);
        input.addEventListener("input", updateImportedRow);
    });

    previewBody.querySelectorAll("[data-delete-index]").forEach(btn => {
        btn.addEventListener("click", (e) => {
            const idx = Number(e.currentTarget.dataset.deleteIndex);
            importedRows.splice(idx, 1);
            if (importedRows.length === 0) {
                clearPrExcel();
            } else {
                renderPreview();
                showMessage(`${importedRows.length} row(s) remaining.`);
            }
        });
    });
}

function updateImportedRow(event) {
    const input = event.target;
    const index = Number(input.dataset.index);
    const field = input.dataset.field;

    if (!field) return;

    importedRows[index][field] = input.value;

    if (field === "qty" || field === "sales_rate") {
        const qty    = Number(importedRows[index].qty)        || 0;
        const rate   = Number(importedRows[index].sales_rate) || 0;
        const taxVal = qty * rate;

        importedRows[index].taxable_value = taxVal;

        const taxInput = input.closest("tr").querySelector(".taxable-input");
        if (taxInput) taxInput.value = taxVal.toFixed(2);
    }
}

function calculateRowTaxableValue(row) {
    const qty  = Number(row.qty)        || 0;
    const rate = Number(row.sales_rate) || 0;
    return (qty * rate).toFixed(2);
}

// validate imported rows before saving; returns error text or ""
function validateImportedRows(rows) {
    const dateRe = /^\d{4}-\d{2}-\d{2}$/;
    const required = ["party_name", "location", "territory", "product_category", "item_name", "make", "model", "unit"];

    for (let i = 0; i < rows.length; i++) {
        const r = rows[i];
        const n = i + 1;

        if (!dateRe.test(String(r.pr_date || "").trim())) return `Row ${n}: PR date must be YYYY-MM-DD.`;

        for (const f of required) {
            if (!String(r[f] ?? "").trim()) return `Row ${n}: ${f.replace(/_/g, " ")} is required.`;
        }

        if (!(Number(r.qty) > 0))        return `Row ${n}: quantity must be greater than 0.`;
        if (!(Number(r.sales_rate) > 0)) return `Row ${n}: sales rate must be greater than 0.`;
    }
    return "";
}

// ─── PR Excel: Save Imported Rows ─────────────────────────────────────────────

saveImportedButton?.addEventListener("click", async () => {
    if (!importedRows.length) {
        showMessage("No rows available to save");
        return;
    }

    const validationError = validateImportedRows(importedRows);
    if (validationError) {
        showMessage(validationError);
        return;
    }

    // send real numbers, not strings
    const rowsToSend = importedRows.map(r => ({
        ...r,
        qty:           Number(r.qty),
        sales_rate:    Number(r.sales_rate),
        taxable_value: Number(r.qty) * Number(r.sales_rate)
    }));

    try {
        saveImportedButton.disabled = true;
        showMessage("Saving purchase requests...");

        const response = await apiFetch("/purchase-requests/import", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ rows: rowsToSend })
        });
        if (!response) return;

        const result = await response.json();

        if (!response.ok) {
            showMessage(result.message || "Failed to save purchase requests");
            return;
        }

        const savedRows = result.rows || [];
        const count     = savedRows.length || importedRows.length;

        if (savedRows.length >= 2) {
            const first = savedRows[0].pr_number;
            const last  = savedRows[savedRows.length - 1].pr_number;
            alert(`${count} items added successfully!\nPR Numbers: ${first} to ${last}`);
        } else if (savedRows.length === 1) {
            alert(`1 item added successfully!\nPR Number: ${savedRows[0].pr_number}`);
        } else {
            alert(`${count} purchase request(s) saved successfully.`);
        }

        clearPrExcel();

    } catch {
        showMessage("Failed to connect to procurement service");
    } finally {
        saveImportedButton.disabled = false;
    }
});

// ─── Vendor Toggle: Manual / Excel ────────────────────────────────────────────

vendorManualButton?.addEventListener("click", () => {
    vendorManualButton.classList.add("active");
    vendorExcelButton.classList.remove("active");
    vendorManualSection.classList.remove("hidden");
    vendorExcelSection.classList.add("hidden");
    showVendorMessage("");
});

vendorExcelButton?.addEventListener("click", () => {
    vendorExcelButton.classList.add("active");
    vendorManualButton.classList.remove("active");
    vendorExcelSection.classList.remove("hidden");
    vendorManualSection.classList.add("hidden");
    showVendorMessage("");
});

// ─── Vendor Masters: Turnover Year Labels ──────────────────────────────────────

function setTurnoverYears() {
    const now       = new Date();
    const month     = now.getMonth() + 1;
    const year      = now.getFullYear();
    const startYear = month >= 4 ? year : year - 1;

    const t1Label = `${String(startYear).slice(-2)}-${String(startYear + 1).slice(-2)} Turnover`;
    const t2Label = `${String(startYear - 1).slice(-2)}-${String(startYear).slice(-2)} Turnover`;
    const t3Label = `${String(startYear - 2).slice(-2)}-${String(startYear - 1).slice(-2)} Turnover`;

    [
        { id: "turnover_value_1", text: t1Label, required: false },
        { id: "turnover_value_2", text: t2Label, required: false },
        { id: "turnover_value_3", text: t3Label, required: false },
        { id: "ev-turnover_value_1", text: t1Label, required: false },
        { id: "ev-turnover_value_2", text: t2Label, required: false },
        { id: "ev-turnover_value_3", text: t3Label, required: false }
    ].forEach(({ id, text, required }) => {
        const input = document.getElementById(id);
        if (!input) return;
        const label = input.closest(".form-group")?.querySelector("label");
        if (label) {
            label.innerHTML = required ? `${text} <span class="required-star">*</span>` : text;
        }
    });

    const itr1Label = `${String(startYear - 1).slice(-2)}-${String(startYear).slice(-2)} ITR`;
    const itr2Label = `${String(startYear - 2).slice(-2)}-${String(startYear - 1).slice(-2)} ITR`;
    const itr3Label = `${String(startYear - 3).slice(-2)}-${String(startYear - 2).slice(-2)} ITR`;

    [
        { id: "itr_last_year_document", text: itr1Label },
        { id: "itr_second_last_year_document", text: itr2Label },
        { id: "itr_third_last_year_document", text: itr3Label },
        { id: "excel_itr_last_year_document", text: itr1Label },
        { id: "excel_itr_second_last_year_document", text: itr2Label },
        { id: "excel_itr_third_last_year_document", text: itr3Label },
        { id: "ev-doc-itr_last_year_document", text: itr1Label },
        { id: "ev-doc-itr_second_last_year_document", text: itr2Label },
        { id: "ev-doc-itr_third_last_year_document", text: itr3Label }
    ].forEach(({ id, text }) => {
        const input = document.getElementById(id);
        if (!input) return;
        const label = input.closest(".form-group")?.querySelector("label");
        if (label) {
            label.textContent = text;
        }
    });

    const evItr1 = document.getElementById("ev-label-itr_last_year_document");
    if (evItr1) evItr1.textContent = itr1Label;
    const evItr2 = document.getElementById("ev-label-itr_second_last_year_document");
    if (evItr2) evItr2.textContent = itr2Label;
    const evItr3 = document.getElementById("ev-label-itr_third_last_year_document");
    if (evItr3) evItr3.textContent = itr3Label;

    const evT1 = document.getElementById("ev-label-turnover_value_1");
    if (evT1) evT1.textContent = t1Label;
    const evT2 = document.getElementById("ev-label-turnover_value_2");
    if (evT2) evT2.textContent = t2Label;
    const evT3 = document.getElementById("ev-label-turnover_value_3");
    if (evT3) evT3.textContent = t3Label;
}

// Restrict user typing in real time: prevent numbers in name fields, prevent non-digits in phone/bank fields
function attachVendorInputRestrictions() {
    const personNameIds = [
        "office_name", "director_name", "sales_name", "accounts_name",
        "factory_name", "warehouse_name", "workshop_name",
        "branch1_name", "branch2_name", "branch3_name",
        "recommended_by", "approved_by",
        "ev-office_contact_name", "ev-director_or_ceo_or_management_name",
        "ev-sales_team_name", "ev-accounts_team_name",
        "ev-factory_contact_name", "ev-warehouse_contact_name", "ev-workshop_contact_name",
        "ev-branch_office_1_contact_name", "ev-branch_office_2_contact_name", "ev-branch_office_3_contact_name"
    ];
    personNameIds.forEach(id => {
        const el = document.getElementById(id);
        if (el && !el._restrictAttached) {
            el._restrictAttached = true;
            el.addEventListener("input", e => {
                e.target.value = e.target.value.replace(/[0-9]/g, "");
            });
        }
    });

    const phoneIds = [
        "office_phone", "director_mobile", "sales_contact", "accounts_contact",
        "factory_phone", "warehouse_phone", "workshop_phone",
        "branch1_contact", "branch2_contact", "branch3_contact",
        "ev-office_contact_number", "ev-director_or_ceo_or_management_mobile_no",
        "ev-sales_team_contact", "ev-accounts_team_contact",
        "ev-factory_contact_number", "ev-warehouse_contact_number", "ev-workshop_contact_number",
        "ev-branch_office_1_contact_number", "ev-branch_office_2_contact_number", "ev-branch_office_3_contact_number"
    ];
    phoneIds.forEach(id => {
        const el = document.getElementById(id);
        if (el && !el._restrictAttached) {
            el._restrictAttached = true;
            el.addEventListener("input", e => {
                e.target.value = e.target.value.replace(/[^0-9]/g, "").slice(0, 10);
            });
        }
    });

    [
        { id: "year_of_incorporation", fn: v => v.replace(/[^0-9]/g, "").slice(0, 4) },
        { id: "account_no", fn: v => v.replace(/[^0-9]/g, "").slice(0, 18) },
        { id: "ev-bank_account_no", fn: v => v.replace(/[^0-9]/g, "").slice(0, 18) },
        { id: "pan_number", fn: v => v.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10) },
        { id: "gst_number", fn: v => v.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 15) },
        { id: "ifsc_rtgs", fn: v => v.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 11) },
        { id: "ev-bank_ifsc", fn: v => v.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 11) },
        { id: "vendor_code", fn: v => v.toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 30) }
    ].forEach(({ id, fn }) => {
        const el = document.getElementById(id);
        if (el && !el._restrictAttached) {
            el._restrictAttached = true;
            el.addEventListener("input", e => { e.target.value = fn(e.target.value); });
        }
    });
}

setTurnoverYears();
prefillOfficeUse();
attachVendorInputRestrictions();

// ─── Vendor Masters: GST Duplicate Check ──────────────────────────────────────

async function checkVendorGST(gstNumber) {
    if (!gstNumber?.trim()) return true;

    try {
        const response = await apiFetch(`/vendors/check-gst?gst_number=${encodeURIComponent(gstNumber.trim())}`);
        if (!response) return false;
        const result   = await response.json();

        if (!response.ok) {
            showVendorMessage(result.message || "Failed to check GST number");
            return false;
        }

        if (result.exists) {
            alert(`A company with this GST number already exists: ${result.vendor_name}`);
            return false;
        }

        return true;

    } catch {
        showVendorMessage("Failed to connect to procurement manager service");
        return false;
    }
}

document.getElementById("gst_number")?.addEventListener("blur", async event => {
    await checkVendorGST(event.target.value);
});

// ─── Vendor Masters: Excel File Chosen & Clear ────────────────────────────────

function clearVendorExcel() {
    importedVendorRows = [];
    vendorExcelPreview?.classList.add("hidden");
    const tbody = document.getElementById("vendorBulkPreviewTbody");
    if (tbody) tbody.innerHTML = "";
    const badge = document.getElementById("vendorPreviewCountBadge");
    if (badge) badge.textContent = "";
    if (vendorPreviewForm) vendorPreviewForm.innerHTML = "";
    if (vendorExcelFile) vendorExcelFile.value = "";
    if (vendorExcelFileName) vendorExcelFileName.textContent = "No file chosen";
    clearVendorExcelFileBtn?.classList.add("hidden");
    [
        "excel_gst_document", "excel_pan_document", "excel_msme_document",
        "excel_itr_last_year_document", "excel_itr_second_last_year_document", "excel_itr_third_last_year_document"
    ].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = "";
    });
    showVendorMessage("");
}

vendorExcelFile?.addEventListener("change", () => {
    if (vendorExcelFile.files.length) {
        vendorExcelFileName.textContent = vendorExcelFile.files[0].name;
        clearVendorExcelFileBtn?.classList.remove("hidden");
    } else {
        vendorExcelFileName.textContent = "No file chosen";
        clearVendorExcelFileBtn?.classList.add("hidden");
    }
});

clearVendorExcelFileBtn?.addEventListener("click", () => {
    clearVendorExcel();
    showVendorMessage("Vendor file selection cleared.");
});

closeVendorPreviewBtn?.addEventListener("click", () => {
    clearVendorExcel();
    showVendorMessage("Vendor import discarded.");
});

cancelVendorExcelButton?.addEventListener("click", () => {
    clearVendorExcel();
    showVendorMessage("Vendor import discarded.");
});

// ─── Vendor Masters: required-field validation (matches NOT NULL columns) ─────

const VENDOR_REQUIRED_INPUTS = {
    registration_date: "Registration date",
    vendor_name: "Vendor name", legal_entity: "Legal entity", commercial_role: "Commercial role",
    year_of_incorporation: "Year of incorporation",
    office_address: "Office address", office_name: "Office contact name", office_phone: "Office contact number",
    director_name: "Director name", director_designation: "Director designation",
    director_mobile: "Director mobile", director_email: "Director email",
    gst_number: "GST number", pan_number: "PAN number",
    bank_name: "Bank name", account_no: "Bank account number", bank_branch: "Bank branch",
    account_type: "Account type", ifsc_rtgs: "IFSC code"
};

const VENDOR_REQUIRED_DOCS = {}; // Documents are optional

function validateVendorForm() {
    for (const [id, label] of Object.entries(VENDOR_REQUIRED_INPUTS)) {
        if (!String(document.getElementById(id)?.value ?? "").trim()) return `${label} is required.`;
    }

    const vendorName = String(document.getElementById("vendor_name")?.value ?? "").trim();
    if (/^\d+$/.test(vendorName)) return "Vendor name cannot be only numbers. Please enter a valid company name.";
    if (!/[a-zA-Z]/.test(vendorName)) return "Vendor name must contain valid letters.";

    const personNames = [
        { id: "office_name", label: "Office contact name" },
        { id: "director_name", label: "Director name" },
        { id: "sales_name", label: "Sales team name" },
        { id: "accounts_name", label: "Accounts team name" },
        { id: "factory_name", label: "Factory contact name" },
        { id: "warehouse_name", label: "Warehouse contact name" },
        { id: "workshop_name", label: "Workshop contact name" },
        { id: "branch1_name", label: "Branch 1 contact name" },
        { id: "branch2_name", label: "Branch 2 contact name" },
        { id: "branch3_name", label: "Branch 3 contact name" },
        { id: "recommended_by", label: "Recommended by" },
        { id: "approved_by", label: "Approved by" }
    ];
    for (const { id, label } of personNames) {
        const val = String(document.getElementById(id)?.value ?? "").trim();
        if (val && /\d/.test(val)) return `${label} cannot contain numbers. Only letters are allowed.`;
    }

    const phones = [
        { id: "office_phone", label: "Office contact number", req: true },
        { id: "director_mobile", label: "Director mobile number", req: true },
        { id: "sales_contact", label: "Sales team contact", req: false },
        { id: "accounts_contact", label: "Accounts team contact", req: false },
        { id: "factory_phone", label: "Factory contact number", req: false },
        { id: "warehouse_phone", label: "Warehouse contact number", req: false },
        { id: "workshop_phone", label: "Workshop contact number", req: false },
        { id: "branch1_contact", label: "Branch 1 contact number", req: false },
        { id: "branch2_contact", label: "Branch 2 contact number", req: false },
        { id: "branch3_contact", label: "Branch 3 contact number", req: false }
    ];
    for (const { id, label, req } of phones) {
        const val = String(document.getElementById(id)?.value ?? "").trim().replace(/\s+/g, "");
        if (req && !val) return `${label} is required.`;
        if (val && !/^\d{10}$/.test(val)) return `${label} must be a valid 10-digit number.`;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    for (const [id, label, req] of [["director_email", "Director email", true], ["sales_email", "Sales team email", false], ["accounts_email", "Accounts team email", false]]) {
        const val = String(document.getElementById(id)?.value ?? "").trim();
        if (req && !val) return `${label} is required.`;
        if (val && !emailRegex.test(val)) return `${label} must be a valid email address.`;
    }

    const yearVal = String(document.getElementById("year_of_incorporation")?.value ?? "").trim();
    const curYear = new Date().getFullYear();
    if (!/^\d{4}$/.test(yearVal) || parseInt(yearVal, 10) < 1800 || parseInt(yearVal, 10) > curYear) {
        return `Year of incorporation must be a valid 4-digit year (between 1800 and ${curYear}).`;
    }

    const bankNameVal = String(document.getElementById("bank_name")?.value ?? "").trim();
    if (/^\d+$/.test(bankNameVal)) return "Bank name cannot be only numbers.";

    const accVal = String(document.getElementById("account_no")?.value ?? "").trim();
    if (!/^\d{9,18}$/.test(accVal)) return "Bank account number must be between 9 and 18 digits.";

    const ifscVal = String(document.getElementById("ifsc_rtgs")?.value ?? "").trim();
    if (!/^[A-Z]{4}0[A-Z0-9]{6}$/i.test(ifscVal)) {
        return "IFSC code must be 11 alphanumeric characters (e.g. SBIN0001234).";
    }

    const t1 = String(document.getElementById("turnover_value_1")?.value ?? "").trim().replace(/,/g, "");
    if (t1 && (isNaN(Number(t1)) || Number(t1) < 0)) return "Turnover must be a valid numeric amount.";

    for (const [id, label] of Object.entries(VENDOR_REQUIRED_DOCS)) {
        if (!document.getElementById(id)?.files?.length) return `${label} is required.`;
    }
    return "";
}

// Field names (DB column names) that must be filled in the Excel preview
const VENDOR_REQUIRED_FIELDS = [
    "registration_date", "vendor_name", "legal_entity", "commercial_role", "year_of_incorporation",
    "office_address", "office_contact_name", "office_contact_number",
    "director_or_ceo_or_management_name", "director_or_ceo_or_management_designation",
    "director_or_ceo_or_management_mobile_no", "director_or_ceo_or_management_email",
    "gst_number", "pan_number",
    "bank_name", "bank_account_no", "bank_branch", "bank_account_type", "bank_ifsc"
];

function validateVendorPreviewData(data) {
    for (const f of VENDOR_REQUIRED_FIELDS) {
        if (!String(data[f] ?? "").trim()) return `${formatVendorFieldName(f)} is required.`;
    }
    const vn = String(data.vendor_name ?? "").trim();
    if (/^\d+$/.test(vn)) return "Vendor name cannot be only numbers.";
    if (!/[a-zA-Z]/.test(vn)) return "Vendor name must contain valid letters.";

    const pNames = [
        "office_contact_name", "director_or_ceo_or_management_name",
        "sales_team_name", "accounts_team_name", "recommended_by", "approved_by"
    ];
    for (const f of pNames) {
        const val = String(data[f] ?? "").trim();
        if (val && /\d/.test(val)) return `${formatVendorFieldName(f)} cannot contain numbers. Only letters are allowed.`;
    }

    const pPhones = [
        "office_contact_number", "director_or_ceo_or_management_mobile_no",
        "sales_team_contact", "accounts_team_contact"
    ];
    for (const f of pPhones) {
        const val = String(data[f] ?? "").trim().replace(/\s+/g, "");
        if (val && !/^\d{10}$/.test(val)) return `${formatVendorFieldName(f)} must be a valid 10-digit number.`;
    }

    for (const [id, label] of Object.entries(VENDOR_REQUIRED_DOCS)) {
        if (!document.getElementById(`excel_${id}`)?.files?.length) return `${label} is required.`;
    }
    return "";
}

// ─── Vendor Masters: Manual Form Submit ───────────────────────────────────────

vendorManualForm?.addEventListener("submit", async event => {
    event.preventDefault();

    const validationError = validateVendorForm();
    if (validationError) {
        showVendorMessage(validationError);
        return;
    }

    if (!(await checkVendorGST(document.getElementById("gst_number").value))) return;

    const turnoverLabel = (inputId) => {
        const input = document.getElementById(inputId);
        const label = input?.closest(".form-group")?.querySelector("label");
        return label ? label.textContent.replace(/\*/g, "").replace("Turnover", "").trim() : "";
    };

    const val = id => document.getElementById(id)?.value ?? "";

    const data = {
        registration_date:                         val("registration_date") || todayISO(),
        vendor_code:                               val("vendor_code").trim(),
        vendor_name:                               val("vendor_name"),

        office_address:                            val("office_address"),
        office_contact_name:                       val("office_name"),
        office_contact_number:                     val("office_phone"),
        factory_address:                           val("factory_address"),
        factory_contact_name:                      val("factory_name"),
        factory_contact_number:                    val("factory_phone"),
        warehouse_address:                         val("warehouse_address"),
        warehouse_contact_name:                    val("warehouse_name"),
        warehouse_contact_number:                  val("warehouse_phone"),
        workshop_address:                          val("workshop_address"),
        workshop_contact_name:                     val("workshop_name"),
        workshop_contact_number:                   val("workshop_phone"),

        legal_entity:                              val("legal_entity"),
        commercial_role:                           val("commercial_role"),
        year_of_incorporation:                     val("year_of_incorporation"),

        director_or_ceo_or_management_name:        val("director_name"),
        director_or_ceo_or_management_designation: val("director_designation"),
        director_or_ceo_or_management_mobile_no:   val("director_mobile"),
        director_or_ceo_or_management_email:       val("director_email"),
        director_or_ceo_or_management_web_address: val("director_web"),

        sales_team_name:                           val("sales_name"),
        sales_team_contact:                        val("sales_contact"),
        sales_team_email:                          val("sales_email"),
        accounts_team_name:                        val("accounts_name"),
        accounts_team_contact:                     val("accounts_contact"),
        accounts_team_email:                       val("accounts_email"),

        gst_number:                                val("gst_number"),
        pan_number:                                val("pan_number"),
        msme_number:                               val("msme_number"),

        bank_name:                                 val("bank_name"),
        bank_account_no:                           val("account_no"),
        bank_branch:                               val("bank_branch"),
        bank_account_type:                         val("account_type"),
        bank_ifsc:                                 val("ifsc_rtgs"),

        branch_office_1_address:                   val("branch1_address"),
        branch_office_1_contact_name:              val("branch1_name"),
        branch_office_1_contact_number:            val("branch1_contact"),
        branch_office_2_address:                   val("branch2_address"),
        branch_office_2_contact_name:              val("branch2_name"),
        branch_office_2_contact_number:            val("branch2_contact"),
        branch_office_3_address:                   val("branch3_address"),
        branch_office_3_contact_name:              val("branch3_name"),
        branch_office_3_contact_number:            val("branch3_contact"),

        turnover_year_1:                           turnoverLabel("turnover_value_1"),
        turnover_value_1:                          val("turnover_value_1"),
        turnover_year_2:                           turnoverLabel("turnover_value_2"),
        turnover_value_2:                          val("turnover_value_2"),
        turnover_year_3:                           turnoverLabel("turnover_value_3"),
        turnover_value_3:                          val("turnover_value_3"),

        recommended_by:                            val("recommended_by"),
        approved_by:                               val("approved_by")
    };

    const formData = new FormData();
    formData.append("vendor_data", JSON.stringify(data));

    ["gst_document", "pan_document", "msme_document",
     "itr_last_year_document", "itr_second_last_year_document", "itr_third_last_year_document"
    ].forEach(docId => {
        const file = document.getElementById(docId)?.files[0];
        if (file) formData.append(docId, file);
    });

    const submitBtn = vendorManualForm.querySelector("button[type='submit']");

    try {
        submitBtn.disabled = true;
        showVendorMessage("Saving vendor...");

        const response = await apiFetch("/vendors", {
            method: "POST",
            body: formData
        });
        if (!response) return;

        const result = await response.json();

        if (!response.ok) {
            if (response.status === 409) {
                alert(result.message);
            } else {
                showVendorMessage(result.message || "Failed to add vendor");
            }
            return;
        }

        alert(`Vendor "${data.vendor_name}" added successfully!\nVendor Code: ${result.vendor_code}`);
        showVendorMessage("");
        vendorManualForm.reset();
        setTurnoverYears();
        prefillOfficeUse();

    } catch {
        showVendorMessage("Failed to connect to procurement service");
    } finally {
        submitBtn.disabled = false;
    }
});

// ─── Vendor Masters: Excel Import Preview ─────────────────────────────────────

// ─── Vendor Masters: Excel Template Download & Bulk Import Preview ─────────────

let importedVendorRows = [];

const downloadVendorTemplateBtn = document.getElementById("downloadVendorTemplateBtn");
downloadVendorTemplateBtn?.addEventListener("click", async () => {
    try {
        downloadVendorTemplateBtn.disabled = true;
        showVendorMessage("Downloading vendor import template...");
        const response = await apiFetch("/vendors/template");
        if (!response || !response.ok) {
            window.location.href = "/vendors/template";
            return;
        }
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "Vendor_Import_Template.xlsx";
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
        showVendorMessage("Vendor import template downloaded.");
    } catch {
        window.location.href = "/vendors/template";
    } finally {
        downloadVendorTemplateBtn.disabled = false;
    }
});

vendorImportButton?.addEventListener("click", async () => {
    if (!vendorExcelFile.files.length) {
        showVendorMessage("Please select an Excel file");
        return;
    }

    const formData = new FormData();
    formData.append("file", vendorExcelFile.files[0]);

    try {
        vendorImportButton.disabled = true;
        showVendorMessage("Processing Excel file...");

        const response = await apiFetch("/vendors/import-preview", {
            method: "POST",
            body: formData
        });
        if (!response) return;

        const result = await response.json();

        if (!response.ok) {
            showVendorMessage(result.message || "Failed to process Excel file");
            return;
        }

        importedVendorRows = result.vendors || (result.vendor ? [result.vendor] : []);
        if (!importedVendorRows.length) {
            showVendorMessage("No vendor data found in the uploaded file");
            return;
        }

        renderVendorBulkPreview(importedVendorRows);
        showVendorMessage(`${importedVendorRows.length} vendor(s) ready for review. Review and edit fields if needed, then click Save All Vendors.`);

    } catch {
        showVendorMessage("Failed to connect to procurement manager service");
    } finally {
        vendorImportButton.disabled = false;
    }
});

function renderVendorBulkPreview(rows) {
    const tbody = document.getElementById("vendorBulkPreviewTbody");
    const countBadge = document.getElementById("vendorPreviewCountBadge");
    if (!tbody) return;

    if (countBadge) countBadge.textContent = `(${rows.length} vendor${rows.length === 1 ? '' : 's'})`;
    tbody.innerHTML = "";

    rows.forEach((row, index) => {
        const tr = document.createElement("tr");

        const baseEntities = ["Private Limited", "Public Limited", "Partnership", "Proprietorship", "Sole Proprietorship", "LLP", "Joint Venture", "Government", "Other"];
        const curEntity = (row.legal_entity || "").trim();
        const entityList = (curEntity && !baseEntities.some(o => o.toLowerCase() === curEntity.toLowerCase()))
            ? [curEntity, ...baseEntities]
            : baseEntities;

        const legalEntitySelect = `
            <select data-index="${index}" data-field="legal_entity" style="width: 100%; min-width: 130px; padding: 6px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 13px;">
                ${entityList.map(opt => `<option value="${escapeHtml(opt)}" ${curEntity.toLowerCase() === opt.toLowerCase() ? "selected" : ""}>${escapeHtml(opt)}</option>`).join("")}
            </select>
        `;

        const baseRoles = ["Manufacturer", "Authorized Dealer", "Stockist / Distributor", "Distributor", "Trader", "Service Provider", "OEM", "Other"];
        const curRole = (row.commercial_role || "").trim();
        const roleList = (curRole && !baseRoles.some(o => o.toLowerCase() === curRole.toLowerCase()))
            ? [curRole, ...baseRoles]
            : baseRoles;

        const commercialRoleSelect = `
            <select data-index="${index}" data-field="commercial_role" style="width: 100%; min-width: 130px; padding: 6px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 13px;">
                ${roleList.map(opt => `<option value="${escapeHtml(opt)}" ${curRole.toLowerCase() === opt.toLowerCase() ? "selected" : ""}>${escapeHtml(opt)}</option>`).join("")}
            </select>
        `;

        tr.innerHTML = `
            <td style="text-align: center; font-weight: 600; color: #64748b;">${index + 1}</td>
            <td><input type="text" data-index="${index}" data-field="vendor_name" value="${escapeHtml(row.vendor_name || "")}" style="width: 100%; min-width: 170px; padding: 6px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 13px;"></td>
            <td><input type="date" data-index="${index}" data-field="registration_date" value="${escapeHtml(String(row.registration_date || todayISO()).slice(0, 10))}" style="width: 100%; min-width: 130px; padding: 6px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 13px;"></td>
            <td><input type="text" data-index="${index}" data-field="gst_number" value="${escapeHtml(row.gst_number || "")}" maxlength="15" style="width: 100%; min-width: 150px; padding: 6px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 13px; text-transform: uppercase;"></td>
            <td><input type="text" data-index="${index}" data-field="pan_number" value="${escapeHtml(row.pan_number || "")}" maxlength="10" style="width: 100%; min-width: 120px; padding: 6px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 13px; text-transform: uppercase;"></td>
            <td>${legalEntitySelect}</td>
            <td>${commercialRoleSelect}</td>
            <td><input type="text" data-index="${index}" data-field="office_address" value="${escapeHtml(row.office_address || "")}" style="width: 100%; min-width: 190px; padding: 6px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 13px;"></td>
            <td><input type="text" data-index="${index}" data-field="office_contact_name" value="${escapeHtml(row.office_contact_name || "")}" style="width: 100%; min-width: 140px; padding: 6px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 13px;"></td>
            <td><input type="text" data-index="${index}" data-field="office_contact_number" value="${escapeHtml(row.office_contact_number || "")}" maxlength="10" style="width: 100%; min-width: 120px; padding: 6px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 13px;"></td>
            <td><input type="text" data-index="${index}" data-field="director_or_ceo_or_management_name" value="${escapeHtml(row.director_or_ceo_or_management_name || "")}" style="width: 100%; min-width: 140px; padding: 6px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 13px;"></td>
            <td><input type="text" data-index="${index}" data-field="director_or_ceo_or_management_mobile_no" value="${escapeHtml(row.director_or_ceo_or_management_mobile_no || "")}" maxlength="10" style="width: 100%; min-width: 120px; padding: 6px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 13px;"></td>
            <td><input type="email" data-index="${index}" data-field="director_or_ceo_or_management_email" value="${escapeHtml(row.director_or_ceo_or_management_email || "")}" style="width: 100%; min-width: 170px; padding: 6px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 13px;"></td>
            <td><input type="text" data-index="${index}" data-field="bank_name" value="${escapeHtml(row.bank_name || "")}" style="width: 100%; min-width: 130px; padding: 6px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 13px;"></td>
            <td><input type="text" data-index="${index}" data-field="bank_account_no" value="${escapeHtml(row.bank_account_no || "")}" style="width: 100%; min-width: 150px; padding: 6px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 13px;"></td>
            <td><input type="text" data-index="${index}" data-field="bank_ifsc" value="${escapeHtml(row.bank_ifsc || "")}" maxlength="11" style="width: 100%; min-width: 120px; padding: 6px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 13px; text-transform: uppercase;"></td>
            <td style="text-align: center;">
                <button type="button" class="row-delete-btn" data-delete-vendor-index="${index}" title="Remove vendor" style="background: none; border: 1px solid #ef4444; color: #ef4444; border-radius: 6px; width: 28px; height: 28px; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; font-weight: bold;">✕</button>
            </td>
        `;

        tbody.appendChild(tr);
    });

    vendorExcelPreview.classList.remove("hidden");

    // Live update importedVendorRows on changes
    tbody.querySelectorAll("[data-field]").forEach(input => {
        const handler = e => {
            const idx = Number(e.target.dataset.index);
            const field = e.target.dataset.field;
            if (importedVendorRows[idx]) {
                importedVendorRows[idx][field] = e.target.value.trim();
            }
        };
        input.addEventListener("input", handler);
        input.addEventListener("change", handler);
    });

    // Row deletion
    tbody.querySelectorAll("[data-delete-vendor-index]").forEach(btn => {
        btn.addEventListener("click", e => {
            const idx = Number(e.currentTarget.dataset.deleteVendorIndex);
            importedVendorRows.splice(idx, 1);
            if (importedVendorRows.length === 0) {
                clearVendorExcel();
                showVendorMessage("All imported vendors were discarded.");
            } else {
                renderVendorBulkPreview(importedVendorRows);
                showVendorMessage(`${importedVendorRows.length} vendor(s) remaining.`);
            }
        });
    });
}

// ─── Vendor Masters: Save Excel-Imported Vendors ──────────────────────────────

saveVendorExcelButton?.addEventListener("click", async () => {
    if (!importedVendorRows.length) {
        showVendorMessage("No vendor rows available to import");
        return;
    }

    // Sync current values from DOM inputs in case user edited them in the table
    const tbody = document.getElementById("vendorBulkPreviewTbody");
    if (tbody) {
        tbody.querySelectorAll("tr").forEach((tr, idx) => {
            if (!importedVendorRows[idx]) return;
            tr.querySelectorAll("[data-field]").forEach(input => {
                const field = input.dataset.field;
                if (field) {
                    importedVendorRows[idx][field] = input.value.trim();
                }
            });
        });
    }

    const REQUIRED_COLUMNS = [
        { field: "vendor_name", label: "Vendor Name" },
        { field: "gst_number", label: "GST Number" },
        { field: "pan_number", label: "PAN Number" },
        { field: "legal_entity", label: "Legal Entity" },
        { field: "commercial_role", label: "Commercial Role" },
        { field: "office_address", label: "Office Address" },
        { field: "office_contact_name", label: "Contact Person" },
        { field: "office_contact_number", label: "Contact Phone" },
        { field: "director_or_ceo_or_management_name", label: "Director Name" },
        { field: "director_or_ceo_or_management_mobile_no", label: "Director Mobile" },
        { field: "director_or_ceo_or_management_email", label: "Director Email" },
        { field: "bank_name", label: "Bank Name" },
        { field: "bank_account_no", label: "Bank Account No" },
        { field: "bank_ifsc", label: "IFSC Code" }
    ];

    // Client-side validation for required fields on each row
    const errors = [];

    importedVendorRows.forEach((v, i) => {
        const rowNum = i + 1;

        for (const col of REQUIRED_COLUMNS) {
            const val = String(v[col.field] ?? "").trim();
            if (!val) {
                errors.push(`Row ${rowNum}: ${col.label} is required.`);
            }
        }
    });

    if (errors.length > 0) {
        alert("Please fix the following validation errors before importing:\n\n" + errors.slice(0, 15).join("\n") + (errors.length > 15 ? `\n...and ${errors.length - 15} more` : ""));
        showVendorMessage(`Validation failed: ${errors.length} required field(s) missing.`);
        return;
    }

    try {
        saveVendorExcelButton.disabled = true;
        showVendorMessage(`Importing ${importedVendorRows.length} vendor(s)... Please wait.`);

        const response = await apiFetch("/vendors/import", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ vendors: importedVendorRows })
        });

        if (!response) return;
        const result = await response.json();

        if (!response.ok) {
            alert(result.message || "Failed to import vendors");
            showVendorMessage(result.message || "Failed to import vendors");
            return;
        }

        const msg = result.vendors && result.vendors.length > 1
            ? `Successfully imported ${result.vendors.length} vendors!\n\nVendor Codes:\n` + result.vendors.map(v => `${v.vendor_name}: ${v.vendor_code}`).join("\n")
            : (result.message || "Vendor imported successfully!");

        alert(msg);
        clearVendorExcel();
        if (typeof loadVendorDirectory === "function") loadVendorDirectory();
        if (typeof loadVendorsForDropdown === "function") loadVendorsForDropdown();
        if (typeof loadVendorPerformance === "function") loadVendorPerformance();

    } catch (err) {
        showVendorMessage("Failed to save imported vendors");
    } finally {
        saveVendorExcelButton.disabled = false;
    }
});

// ─── Vendor Inquiries: Load List ───────────────────────────────────────────────

async function loadVendorInquiries() {
    vendorInquiryList.innerHTML = "Loading inquiries...";

    try {
        const response = await apiFetch("/vendor-inquiries");
        if (!response) return;
        const result   = await response.json();

        if (!response.ok || !result.success) {
            vendorInquiryList.textContent = result.message || "Failed to load inquiries";
            return;
        }

        renderVendorInquiries(result.inquiries || []);

    } catch {
        vendorInquiryList.textContent = "Failed to connect to procurement manager service";
    }
}

// ─── Vendor Inquiries: Render Cards ───────────────────────────────────────────

function renderVendorInquiries(inquiries) {
    vendorInquiryList.innerHTML = "";

    if (!inquiries.length) {
        vendorInquiryList.textContent = "No open vendor inquiries available";
        return;
    }

    inquiries.forEach(inquiry => {
        const id          = inquiry.inquiry_id;
        const isOpen      = inquiry.inquiry_status === "OPEN";
        const statusLabel = isOpen ? "OPEN" : "VENDOR SELECTED";
        const statusCls   = isOpen ? "" : "status-vendor_selected";

        const hasQuotations = inquiry.vendor_count > 0;
        const hasDraftPO    = inquiry.po_id && inquiry.po_status === "DRAFT";

        // Edit PR: only when OPEN and zero vendors have quoted
        const editButton = (!hasQuotations && !hasDraftPO) ? `
            <button
                type="button"
                class="secondary-button edit-pr-btn"
                data-inquiry-id="${id}"
                data-inquiry-status="${inquiry.inquiry_status}"
                data-pr-id="${inquiry.pr_id}">
                ✏ Edit PR
            </button>` : "";

        // Cancel Inquiry: only when no PO exists yet
        const cancelInquiryButton = !hasDraftPO ? `
            <button
                type="button"
                class="danger-button cancel-inquiry-btn"
                data-inquiry-id="${id}"
                data-pr-number="${escapeHtml(inquiry.pr_number || "")}">
                ✕ Cancel Inquiry
            </button>` : `
            <span style="font-size:12px;color:#888;">
                Cancel the PO from Purchase Orders page to re-open this inquiry
            </span>`;

        // Add Vendor is available for both OPEN and VENDOR_SELECTED inquiries
        const addVendorButton = `
            <button
                type="button"
                class="primary-button add-vendor-btn"
                data-inquiry-id="${id}"
                data-qty="${inquiry.qty ?? 0}">
                + Add Vendor
            </button>`;

        const card = document.createElement("div");
        card.className = "inquiry-card";

        card.dataset.prNumber      = inquiry.pr_number || "";
        card.dataset.itemName      = inquiry.item_name || "";
        card.dataset.quotedVendors = "[]";

        card.innerHTML = `
            <div class="inquiry-card-info">
                ${prInfoItems(inquiry)}
            </div>

            <div class="inquiry-card-footer">
                ${addVendorButton}
                ${editButton}
                ${cancelInquiryButton}
                <span class="inquiry-status ${statusCls}">${statusLabel}</span>
            </div>

            <div class="add-vendor-form" id="addVendorForm-${id}" style="display:none">
                <h3>Add Vendor Quotation</h3>

                <div class="form-group">
                    <label>Vendor</label>
                    <select class="vendor-select" required>
                        <option value="">Select</option>
                    </select>
                </div>

                <div style="display:flex;gap:16px;align-items:flex-end;">
                    <div class="form-group" style="flex:1;">
                        <label>Price Per Unit</label>
                        <input type="number" class="vendor-price" min="0.01" step="0.01" placeholder="Enter price per unit" required>
                    </div>
                    <div class="form-group" style="flex:1;">
                        <label>Total Price</label>
                        <input type="text" class="vendor-total-display" readonly style="background:#f5f5f5;">
                    </div>
                </div>

                <div class="form-group">
                    <label>Expected Delivery Date</label>
                    <input type="date" class="vendor-delivery-date">
                </div>

                <div class="form-group">
                    <label>Advance (%)</label>
                    <input type="number" class="vendor-advance-pct" min="0" max="100" step="0.01" placeholder="e.g. 30">
                </div>

                <div class="form-group vendor-advance-preview-group" style="display:none">
                    <label>Advance Amount</label>
                    <input type="text" class="vendor-advance-preview" readonly>
                </div>

                <div class="form-group balance-days-group" style="display:none">
                    <label>Remaining Payment Due (days)</label>
                    <input type="number" class="vendor-balance-days" min="1" step="1" placeholder="e.g. 30, 45, 60">
                </div>

                <div class="form-group">
                    <label>Payment Terms Remarks <span style="font-weight:400;color:#888;">(optional)</span></label>
                    <textarea class="vendor-payment-remarks" placeholder="Any additional payment notes"></textarea>
                </div>

                <div class="add-vendor-form-actions">
                    <button type="button" class="primary-button save-vendor-btn" data-inquiry-id="${id}">
                        Save Vendor
                    </button>
                    <button type="button" class="cancel-vendor-btn" data-inquiry-id="${id}">
                        Cancel
                    </button>
                </div>

                <p class="vendor-form-message"></p>
            </div>

            <div class="edit-pr-form" id="editPrForm-${id}" style="display:none"></div>

            <div class="inquiry-vendor-section" id="vendorsSection-${id}" hidden></div>
        `;

        vendorInquiryList.appendChild(card);
        loadInquiryVendors(id);
    });
}

function openEditPrForm(inquiryId, inquiryStatus, hasQuotations, inquiry) {
    const formEl = document.getElementById(`editPrForm-${inquiryId}`);

    // Toggle closed if already open
    if (formEl.style.display !== "none") {
        formEl.style.display = "none";
        formEl.innerHTML = "";
        return;
    }

    const editable = (label, id, value, type = "text") => `
        <div class="form-group">
            <label>${label}</label>
            <input type="${type}" id="epr-${id}-${inquiryId}" value="${escapeHtml(String(value ?? ""))}">
        </div>`;

    const editableArea = (label, id, value) => `
        <div class="form-group full-width">
            <label>${label}</label>
            <textarea id="epr-${id}-${inquiryId}">${escapeHtml(value || "")}</textarea>
        </div>`;

    const normT = s => String(s || "").toLowerCase().replace(/[\s()]+/g, "");
    const editTerritoryNorm = normT(inquiry.territory);
    const editTerritoryOptionsHtml = TERRITORY_OPTIONS.map(t => {
        const isSel = normT(t) === editTerritoryNorm ? "selected" : "";
        return `<option value="${t}" ${isSel}>${t}</option>`;
    }).join("");
    const isKnownEditTerritory = TERRITORY_OPTIONS.some(t => normT(t) === editTerritoryNorm);
    const customEditTerritoryOpt = (!isKnownEditTerritory && inquiry.territory)
        ? `<option value="${escapeHtml(inquiry.territory)}" selected>${escapeHtml(inquiry.territory)}</option>`
        : "";

    formEl.innerHTML = `
        <div class="edit-pr-form-inner">
            <h3>Edit Purchase Request — ${escapeHtml(inquiry.pr_number)}
                <span style="font-size:12px;font-weight:400;color:#888;margin-left:8px;">
                    All fields editable — no vendors have quoted yet
                </span>
            </h3>

            <div class="form-grid">
                ${editable("Location",         "location",         inquiry.location)}
                <div class="form-group">
                    <label>Territory <span class="required-star">*</span></label>
                    <select id="epr-territory-${inquiryId}">
                        <option value="" disabled ${!inquiry.territory ? "selected" : ""}>Select Territory</option>
                        ${editTerritoryOptionsHtml}
                        ${customEditTerritoryOpt}
                    </select>
                </div>
                ${editable("Product Category", "product_category", inquiry.product_category)}
                ${editable("Item Name",        "item_name",        inquiry.item_name)}
                ${editable("Make",             "make",             inquiry.make)}
                ${editable("Model",            "model",            inquiry.model)}
                ${editable("Quantity",         "qty",              inquiry.qty,        "number")}
                ${editable("Unit",             "unit",             inquiry.unit)}
                ${editable("Sales Rate",       "sales_rate",       inquiry.sales_rate, "number")}
                ${editableArea("Product Remarks", "product_remarks", inquiry.product_remarks)}
            </div>

            <div class="goods-form-actions" style="margin-top:16px;">
                <button
                    type="button"
                    class="primary-button save-edit-pr-btn"
                    data-inquiry-id="${inquiryId}"
                    data-inquiry-status="${inquiryStatus}"
                    data-is-open="1">
                    Save Changes
                </button>
                <button
                    type="button"
                    class="cancel-vendor-btn cancel-edit-pr-btn"
                    data-inquiry-id="${inquiryId}">
                    Cancel
                </button>
            </div>
            <p class="edit-pr-message" id="editPrMsg-${inquiryId}" style="margin-top:8px;color:#c00;"></p>
        </div>
    `;

    formEl.style.display = "";
}

// single shared calculator for total + advance preview + balance-days visibility
function wireQuotationForm(form, qty) {
    if (form.dataset.wired === "1") return;
    form.dataset.wired = "1";

    const priceEl          = form.querySelector(".vendor-price");
    const totalDisplayEl   = form.querySelector(".vendor-total-display");
    const advancePctEl     = form.querySelector(".vendor-advance-pct");
    const balanceDaysGroup = form.querySelector(".balance-days-group");
    const previewGroup     = form.querySelector(".vendor-advance-preview-group");
    const previewInput     = form.querySelector(".vendor-advance-preview");

    const fmt = n => `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    const update = () => {
        const price = Number(priceEl.value) || 0;
        const pct   = Number(advancePctEl.value) || 0;

        totalDisplayEl.value = (price > 0 && qty > 0) ? fmt(price * qty) : "";

        balanceDaysGroup.style.display = (pct > 0 && pct < 100) ? "" : "none";
        if (pct >= 100 || pct === 0) {
            balanceDaysGroup.querySelector(".vendor-balance-days").value = "";
        }

        if (pct > 0 && price > 0) {
            previewInput.value         = fmt((pct / 100) * price * qty);
            previewGroup.style.display = "";
        } else {
            previewGroup.style.display = "none";
            previewInput.value         = "";
        }
    };

    priceEl.addEventListener("input", update);
    advancePctEl.addEventListener("input", update);
}

// ─── Vendor Inquiries: Delegated Click Handler ─────────────────────────────────

vendorInquiryList?.addEventListener("click", async event => {

    // ── Add Vendor ──
    const addBtn = event.target.closest(".add-vendor-btn");
    if (addBtn) {
        const inquiryId = addBtn.dataset.inquiryId;
        const form      = document.getElementById(`addVendorForm-${inquiryId}`);
        const editForm  = document.getElementById(`editPrForm-${inquiryId}`);

        if (editForm) { editForm.style.display = "none"; editForm.innerHTML = ""; }

        if (form.style.display !== "none") {
            form.style.display = "none";
            return;
        }

        form.style.display = "";
        wireQuotationForm(form, Number(addBtn.dataset.qty) || 0);

        const card   = form.closest(".inquiry-card");
        const quoted = JSON.parse(card.dataset.quotedVendors || "[]").map(String);
        await loadVendorsIntoDropdown(form.querySelector(".vendor-select"), quoted);
        return;
    }

    // ── Cancel add vendor ──
    const cancelBtn = event.target.closest(".cancel-vendor-btn:not(.cancel-edit-pr-btn)");
    if (cancelBtn) {
        const inquiryId = cancelBtn.dataset.inquiryId;
        document.getElementById(`addVendorForm-${inquiryId}`).style.display = "none";
        return;
    }

    // ── Save Vendor ──
    const saveBtn = event.target.closest(".save-vendor-btn");
    if (saveBtn) { await saveVendorForInquiry(saveBtn.dataset.inquiryId); return; }

    // ── Cancel Inquiry ──
    const cancelInquiryBtn = event.target.closest(".cancel-inquiry-btn");
    if (cancelInquiryBtn) {
        const inquiryId = cancelInquiryBtn.dataset.inquiryId;
        const prNumber  = cancelInquiryBtn.dataset.prNumber;

        const reason = prompt(
            `Cancel inquiry for ${prNumber}?\n\n` +
            `All vendor quotations will be discarded and this inquiry will be closed.\n` +
            `You will need to raise a new Purchase Request with the updated details.\n\n` +
            `Enter reason for cancellation:`
        );
        if (reason === null) return;
        if (!reason.trim()) { alert("A cancellation reason is required."); return; }

        cancelInquiryBtn.disabled = true;

        try {
            const response = await apiFetch(`/vendor-inquiries/${inquiryId}/cancel`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ reason: reason.trim() })
            });
            if (!response) return;

            const result = await response.json();

            if (!response.ok || !result.success) {
                alert(result.message || "Failed to cancel inquiry");
                cancelInquiryBtn.disabled = false;
                return;
            }

            alert(`Inquiry for ${prNumber} has been cancelled.`);
            await loadVendorInquiries();

        } catch {
            alert("Failed to connect to procurement service");
            cancelInquiryBtn.disabled = false;
        }
        return;
    }

    // ── Open Edit PR form ──
    const editBtn = event.target.closest(".edit-pr-btn");
    if (editBtn) {
        const inquiryId     = editBtn.dataset.inquiryId;
        const inquiryStatus = editBtn.dataset.inquiryStatus;
        const card          = editBtn.closest(".inquiry-card");
        const getValue      = label => {
            const items = card.querySelectorAll(".inquiry-card-item");
            for (const item of items) {
                if (item.querySelector(".inquiry-card-label")?.textContent?.trim() === label) {
                    return item.querySelector(".inquiry-card-value")?.textContent?.trim() || "";
                }
            }
            return "";
        };
        const inquiry = {
            pr_number:        getValue("PR Number"),
            pr_date:          getValue("PR Date"),
            party_name:       getValue("Party Name"),
            location:         getValue("Location"),
            territory:        getValue("Territory"),
            product_category: getValue("Product Category"),
            item_name:        getValue("Item Name"),
            make:             getValue("Make / Model").split(" / ")[0] || "",
            model:            getValue("Make / Model").split(" / ")[1] || "",
            qty:              getValue("Quantity").split(" ")[0] || "",
            unit:             getValue("Quantity").split(" ").slice(1).join(" ") || "",
            sales_rate:       getValue("Sales Rate").replace(/,/g, ""),
            product_remarks:  getValue("Product Remarks")
        };

        const addForm = document.getElementById(`addVendorForm-${inquiryId}`);
        if (addForm) addForm.style.display = "none";

        openEditPrForm(inquiryId, inquiryStatus, false, inquiry);
        return;
    }

    // ── Cancel edit PR ──
    const cancelEditBtn = event.target.closest(".cancel-edit-pr-btn");
    if (cancelEditBtn) {
        const formEl = document.getElementById(`editPrForm-${cancelEditBtn.dataset.inquiryId}`);
        if (formEl) { formEl.style.display = "none"; formEl.innerHTML = ""; }
        return;
    }

    // ── Save edited PR ──
    const saveEditBtn = event.target.closest(".save-edit-pr-btn");
    if (saveEditBtn) {
        await saveEditedPr(
            saveEditBtn.dataset.inquiryId,
            saveEditBtn.dataset.inquiryStatus,
            saveEditBtn.dataset.isOpen === "1",
            saveEditBtn
        );
        return;
    }
});

async function saveEditedPr(inquiryId, inquiryStatus, isOpen, btn) {
    const msgEl = document.getElementById(`editPrMsg-${inquiryId}`);
    const g = id => document.getElementById(`epr-${id}-${inquiryId}`)?.value ?? "";

    const body = {
        location:        g("location"),
        territory:       g("territory"),
        product_remarks: g("product_remarks")
    };

    if (!body.location.trim())   { msgEl.textContent = "Location is required.";   return; }
    if (!body.territory.trim())  { msgEl.textContent = "Territory is required.";  return; }

    if (isOpen) {
        body.product_category = g("product_category");
        body.item_name        = g("item_name");
        body.make             = g("make");
        body.model            = g("model");
        body.qty              = Number(g("qty"));
        body.unit             = g("unit");
        body.sales_rate       = Number(g("sales_rate"));

        if (!body.item_name.trim())         { msgEl.textContent = "Item name is required.";    return; }
        if (!body.make.trim())              { msgEl.textContent = "Make is required.";          return; }
        if (!body.model.trim())             { msgEl.textContent = "Model is required.";         return; }
        if (!(body.qty > 0))                { msgEl.textContent = "Quantity must be > 0.";     return; }
        if (!(body.sales_rate > 0))         { msgEl.textContent = "Sales rate must be > 0.";   return; }
    }

    if (btn) btn.disabled = true;
    msgEl.textContent = "Saving...";

    try {
        const response = await apiFetch(`/vendor-inquiries/${inquiryId}/purchase-request`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body)
        });
        if (!response) { if (btn) btn.disabled = false; return; }

        const result = await response.json();

        if (!response.ok || !result.success) {
            msgEl.textContent = result.message || "Failed to update purchase request.";
            if (btn) btn.disabled = false;
            return;
        }

        msgEl.textContent = "";
        alert(`Purchase request ${result.pr_number} updated successfully.`);

        // Reload the full list to reflect the changes in the card's info grid
        await loadVendorInquiries();

    } catch {
        msgEl.textContent = "Failed to connect to procurement service.";
        if (btn) btn.disabled = false;
    }
}

// ─── Vendor Inquiries: Populate Vendor Dropdown ────────────────────────────────

async function loadVendorsIntoDropdown(selectElement, excludeIds = []) {
    const previous = selectElement.value;
    selectElement.innerHTML = '<option value="">Loading vendors...</option>';

    try {
        const response = await apiFetch("/vendors");
        if (!response) throw new Error("Session expired");
        const result   = await response.json();

        if (!response.ok || !result.success) {
            throw new Error(result.message || "Failed to load vendors");
        }

        const vendors = (result.vendors || [])
            .filter(v => !excludeIds.includes(String(v.vendor_id)))
            .sort((a, b) => a.vendor_id - b.vendor_id);

        if (!vendors.length) {
            selectElement.innerHTML = '<option value="">No eligible vendors available</option>';
            return;
        }

        selectElement.innerHTML = '<option value="">Select Vendor</option>';

        vendors.forEach(vendor => {
            const option       = document.createElement("option");
            option.value       = vendor.vendor_id;
            option.textContent = `${vendor.vendor_name} (${vendor.vendor_code || vendor.vendor_id})`;
            selectElement.appendChild(option);
        });

        if (previous && vendors.some(v => String(v.vendor_id) === previous)) {
            selectElement.value = previous;
        }

    } catch {
        selectElement.innerHTML = '<option value="">Failed to load vendors</option>';
    }
}

// ─── Vendor Inquiries: Save Quotation ─────────────────────────────────────────

async function saveVendorForInquiry(inquiryId) {
    const form             = document.getElementById(`addVendorForm-${inquiryId}`);
    const select           = form.querySelector(".vendor-select");
    const priceEl          = form.querySelector(".vendor-price");
    const deliveryDateEl   = form.querySelector(".vendor-delivery-date");
    const advancePctEl     = form.querySelector(".vendor-advance-pct");
    const balanceDaysEl    = form.querySelector(".vendor-balance-days");
    const paymentRemarksEl = form.querySelector(".vendor-payment-remarks");
    const remarksEl        = form.querySelector(".vendor-remarks");
    const msgEl            = form.querySelector(".vendor-form-message");
    const saveBtn          = form.querySelector(".save-vendor-btn");

    const vendorId   = select.value;
    const vendorName = select.options[select.selectedIndex]?.text || "";
    const price      = Number(priceEl.value);
    const advancePct = advancePctEl.value !== "" ? Number(advancePctEl.value) : null;

    if (!vendorId) { msgEl.textContent = "Please select a vendor."; return; }
    if (!price || price <= 0) { msgEl.textContent = "Please enter a valid price per unit."; return; }
    if (advancePct !== null && (advancePct < 0 || advancePct > 100)) {
        msgEl.textContent = "Advance % must be between 0 and 100."; return;
    }

    const needsBalanceDays = advancePct !== null && advancePct > 0 && advancePct < 100;
    const balanceDays      = balanceDaysEl.value ? Number(balanceDaysEl.value) : null;

    if (needsBalanceDays && (!balanceDays || balanceDays < 1)) {
        msgEl.textContent = "Please enter how many days for the remaining payment."; return;
    }

    let payment_type, advance_type, advance_value;

    if (advancePct === null || advancePct === 0) {
        payment_type  = "CREDIT";
        advance_type  = null;
        advance_value = null;
    } else if (advancePct >= 100) {
        payment_type  = "ADVANCE";
        advance_type  = "PERCENTAGE";
        advance_value = 100;
    } else {
        payment_type  = "ADVANCE_PLUS_BALANCE";
        advance_type  = "PERCENTAGE";
        advance_value = advancePct;
    }

    const card     = form.closest(".inquiry-card");
    const prNumber = card?.dataset.prNumber || "";
    const itemName = card?.dataset.itemName || "";

    try {
        saveBtn.disabled  = true;
        msgEl.textContent = "Saving...";

        const response = await apiFetch(`/vendor-inquiries/${inquiryId}/vendors`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                vendor_id:              Number(vendorId),
                price_per_unit:         price,
                expected_delivery_date: deliveryDateEl.value || null,
                payment_type,
                advance_type,
                advance_value,
                balance_due_days:       balanceDays,
                payment_terms_remarks:  paymentRemarksEl.value.trim() || null,
                remarks:                remarksEl?.value.trim() || null
            })
        });
        if (!response) return;

        const result = await response.json();
        if (!response.ok || !result.success) throw new Error(result.message || "Failed to add vendor");

        alert(
            `Vendor added successfully!\n\n` +
            `PR Number: ${prNumber}\n` +
            `Item: ${itemName}\n` +
            `Vendor: ${vendorName}\n` +
            `Total Price: ₹${formatCurrency(result.total_price)}`
        );

        msgEl.textContent = "";

        select.value           = "";
        priceEl.value          = "";
        deliveryDateEl.value   = "";
        advancePctEl.value     = "";
        balanceDaysEl.value    = "";
        paymentRemarksEl.value = "";
        if (remarksEl) remarksEl.value = "";
        form.querySelector(".balance-days-group").style.display           = "none";
        form.querySelector(".vendor-advance-preview-group").style.display = "none";
        form.querySelector(".vendor-advance-preview").value               = "";
        form.querySelector(".vendor-total-display").value                 = "";

        await loadInquiryVendors(inquiryId);

        // refresh dropdown so the vendor just quoted disappears
        const quoted = JSON.parse(card.dataset.quotedVendors || "[]").map(String);
        await loadVendorsIntoDropdown(select, quoted);

    } catch (error) {
        msgEl.textContent = error.message || "Failed to connect to procurement service";
    } finally {
        saveBtn.disabled = false;
    }
}

// ─── Vendor Inquiries: Load Vendor Table for One Card ─────────────────────────

async function loadInquiryVendors(inquiryId) {
    const section = document.getElementById(`vendorsSection-${inquiryId}`);
    if (!section) return;

    section.innerHTML = "<em style='font-size:13px;color:#777;'>Loading vendors...</em>";

    try {
        const response = await apiFetch(`/vendor-inquiries/${inquiryId}`);
        if (!response) return;
        const result   = await response.json();

        if (!response.ok || !result.success) {
            section.innerHTML = `<em style='font-size:13px;color:#c00;'>${escapeHtml(result.message || "Failed to load vendors")}</em>`;
            return;
        }

        const vendors = result.vendors || [];

        // remember who is already quoted (assumes each row carries vendor_id)
        const card = section.closest(".inquiry-card");
        if (card) card.dataset.quotedVendors = JSON.stringify(vendors.map(v => v.vendor_id).filter(v => v != null));

        renderInquiryVendorTable(section, vendors);

    } catch {
        section.innerHTML = "<em style='font-size:13px;color:#c00;'>Failed to connect to procurement manager service</em>";
    }
}

function formatAdvanceAmount(v) {
    let amt = v.advance_amount;
    if ((amt == null || amt === "" || Number(amt) === 0) && v.advance_value != null && v.total_price != null) {
        if (v.advance_type === "FIXED_AMOUNT") {
            amt = Number(v.advance_value);
        } else {
            amt = (Number(v.advance_value) / 100) * Number(v.total_price);
        }
    }
    return (amt != null && !isNaN(Number(amt)) && Number(amt) > 0)
        ? `₹${formatCurrency(amt)}`
        : "-";
}

function formatRemarks(v) {
    const list = [v.remarks, v.payment_terms_remarks].filter(r => r && String(r).trim() !== "" && String(r).trim() !== "-");
    const unique = [...new Set(list.map(s => String(s).trim()))];
    return unique.length ? escapeHtml(unique.join(" / ")) : "-";
}

function renderInquiryVendorTable(container, vendors) {
    if (!vendors.length) {
        container.innerHTML = "";
        container.hidden = true;
        return;
    }

    container.hidden = false;

    container.innerHTML = `
        <div class="table-container">
            <table class="inquiry-vendor-table">
                <thead>
                    <tr>
                        <th>Vendor Code</th>
                        <th>Vendor Name</th>
                        <th>Price / Unit</th>
                        <th>Total Price</th>
                        <th>Advance</th>
                        <th>Advance Amount</th>
                        <th>Delivery Date</th>
                        <th>Balance Due (days)</th>
                        <th>Remarks</th>
                    </tr>
                </thead>
                <tbody>
                    ${vendors.map(v => `
                        <tr>
                            <td>${escapeHtml(v.vendor_code || "-")}</td>
                            <td>${escapeHtml(v.vendor_name || "-")}</td>
                            <td>${formatCurrency(v.price_per_unit)}</td>
                            <td>${formatCurrency(v.total_price)}</td>
                            <td>${v.advance_value != null ? `${escapeHtml(String(v.advance_value))}%` : "-"}</td>
                            <td>${formatAdvanceAmount(v)}</td>
                            <td>${formatDate(v.expected_delivery_date)}</td>
                            <td>${v.balance_due_days != null ? escapeHtml(String(v.balance_due_days)) : "-"}</td>
                            <td>${formatRemarks(v)}</td>
                        </tr>
                    `).join("")}
                </tbody>
            </table>
        </div>
    `;
}

// ─── Logout (shared: admin + manager) ─────────────────────────────────────────

async function performLogout() {
    try {
        if (logoutButton) logoutButton.disabled = true;
        if (dropdownLogoutBtn) dropdownLogoutBtn.disabled = true;
        localStorage.removeItem("auth_token");
        localStorage.removeItem("refresh_token");
        localStorage.removeItem("auth_user");

        const response = await apiFetch("/logout", { method: "POST" });
        if (!response) return;
        const result = await response.json();

        if (result.success) {
            window.location.href = result.redirect_url || "/";
            return;
        }

        const text = result.message || "Failed to logout";
        showUsersMessage(text);
        showMessage(text);

    } catch (error) {
        console.error(error);
        showUsersMessage("Failed to logout");
        showMessage("Failed to logout");
    } finally {
        if (logoutButton) logoutButton.disabled = false;
        if (dropdownLogoutBtn) dropdownLogoutBtn.disabled = false;
    }
}

logoutButton?.addEventListener("click", performLogout);

// ─── Profile dropdown menu ───────────────────────────────────────────────────
const userProfileMenu = document.getElementById("userProfileMenu");
const userDropdown    = document.getElementById("userDropdown");
const dropdownLogoutBtn = document.getElementById("dropdownLogoutBtn");

userProfileMenu?.addEventListener("click", (e) => {
    e.stopPropagation();
    userDropdown?.classList.toggle("hidden");
});

document.addEventListener("click", () => {
    userDropdown?.classList.add("hidden");
});

dropdownLogoutBtn?.addEventListener("click", performLogout);

// ─── Quotation & Comparisons ───────────────────────────────────────────────────

async function loadQuotationComparisons() {
    const list = document.getElementById("quotationList");
    list.innerHTML = "Loading...";

    try {
        const response = await apiFetch("/quotation-comparisons");
        if (!response) return;
        const result   = await response.json();

        if (!response.ok || !result.success) {
            list.textContent = result.message || "Failed to load quotations";
            return;
        }

        renderQuotationComparisons(result.inquiries || []);

    } catch {
        list.textContent = "Failed to connect to procurement manager service";
    }
}

function renderQuotationComparisons(inquiries) {
    const list = document.getElementById("quotationList");
    list.innerHTML = "";

    if (!inquiries.length) {
        list.textContent = "No open inquiries found";
        return;
    }

    inquiries.forEach(inquiry => {
        const card = document.createElement("div");
        card.className = "inquiry-card";

        const prices      = inquiry.vendors.map(v => Number(v.price_per_unit)).filter(p => p > 0);
        const lowestPrice = prices.length ? Math.min(...prices) : null;

        card.innerHTML = `
            <div class="inquiry-card-info">
                ${prInfoItems(inquiry)}
            </div>

            <div class="inquiry-card-footer">
                <span class="inquiry-status">OPEN</span>
                <span style="font-size:13px;color:#777;">
                    ${inquiry.vendors.length} vendor${inquiry.vendors.length !== 1 ? "s" : ""} quoted
                </span>
            </div>

            ${inquiry.vendors.length ? `
                <div class="inquiry-vendor-section">
                    <div class="table-container">
                        <table class="inquiry-vendor-table">
                            <thead>
                                <tr>
                                    <th>Vendor Code</th>
                                    <th>Vendor Name</th>
                                    <th>Price / Unit</th>
                                    <th>Total Price</th>
                                    <th>Advance</th>
                                    <th>Advance Amount</th>
                                    <th>Delivery Date</th>
                                    <th>Balance Due (days)</th>
                                    <th>Remarks</th>
                                    <th>Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${inquiry.vendors.map(v => {
                                    const isLowest =
                                        lowestPrice !== null &&
                                        Number(v.price_per_unit) === lowestPrice;

                                    return `
                                        <tr>
                                            <td>${escapeHtml(v.vendor_code || "-")}</td>
                                            <td>${escapeHtml(v.vendor_name || "-")}</td>
                                            <td class="${isLowest ? "lowest-price" : ""}">${formatCurrency(v.price_per_unit)}</td>
                                            <td>${formatCurrency(v.total_price)}</td>
                                            <td>${v.advance_value != null ? `${escapeHtml(String(v.advance_value))}%` : "-"}</td>
                                            <td>${formatAdvanceAmount(v)}</td>
                                            <td>${formatDate(v.expected_delivery_date)}</td>
                                            <td>${v.balance_due_days != null ? escapeHtml(String(v.balance_due_days)) : "-"}</td>
                                            <td>${formatRemarks(v)}</td>
                                            <td>
                                                ${v.is_selected
                                                    ? `<span style="color:#16803c;font-weight:600;">✓ Selected</span>`
                                                    : `<button
                                                            type="button"
                                                            class="primary-button select-vendor-btn"
                                                            data-inquiry-id="${inquiry.inquiry_id}"
                                                            data-inquiry-vendor-id="${v.inquiry_vendor_id}">
                                                            Select
                                                       </button>`
                                                }
                                            </td>
                                        </tr>
                                    `;
                                }).join("")}
                            </tbody>
                        </table>
                    </div>
                </div>
            ` : `
                <p class="no-vendors-note" style="margin-top:14px;">
                    No vendor quotations added yet for this inquiry
                </p>
            `}
        `;

        list.appendChild(card);
    });
}

// ─── Quotation & Comparisons: Select Vendor ────────────────────────────────────

function confirmVendorSelection({ prNumber, vendorName, vendorCode, pricePerUnit, totalPrice }) {
    return new Promise(resolve => {
        const modal = document.getElementById("selectVendorModal");
        if (!modal) {
            const ok = confirm(
                `Confirm Vendor Selection:\n\n` +
                `PR Number: ${prNumber}\n` +
                `Vendor: ${vendorName} (${vendorCode})\n` +
                `Price / Unit: ${pricePerUnit}\n` +
                `Total Price: ${totalPrice}\n\n` +
                `Are you sure you want to select this vendor? A draft Purchase Order will be created.`
            );
            return resolve(ok);
        }

        const prEl = document.getElementById("confirmPrNumber");
        const vendorEl = document.getElementById("confirmVendorName");
        const unitEl = document.getElementById("confirmUnitPrice");
        const totalEl = document.getElementById("confirmTotalPrice");
        const confirmBtn = document.getElementById("confirmSelectVendorBtn");
        const cancelBtn = document.getElementById("cancelSelectVendorBtn");
        const closeBtn = document.getElementById("closeSelectVendorModal");

        if (prEl) prEl.textContent = prNumber;
        if (vendorEl) vendorEl.textContent = vendorCode && vendorCode !== "-" ? `${vendorName} (${vendorCode})` : vendorName;
        if (unitEl) unitEl.textContent = pricePerUnit;
        if (totalEl) totalEl.textContent = totalPrice;

        modal.classList.remove("hidden");

        const cleanup = (result) => {
            modal.classList.add("hidden");
            confirmBtn?.removeEventListener("click", onConfirm);
            cancelBtn?.removeEventListener("click", onCancel);
            closeBtn?.removeEventListener("click", onCancel);
            modal.removeEventListener("click", onBackdrop);
            document.removeEventListener("keydown", onKeydown);
            resolve(result);
        };

        const onConfirm = () => cleanup(true);
        const onCancel = () => cleanup(false);
        const onBackdrop = (e) => { if (e.target === modal) cleanup(false); };
        const onKeydown = (e) => { if (e.key === "Escape") cleanup(false); };

        confirmBtn?.addEventListener("click", onConfirm);
        cancelBtn?.addEventListener("click", onCancel);
        closeBtn?.addEventListener("click", onCancel);
        modal.addEventListener("click", onBackdrop);
        document.addEventListener("keydown", onKeydown);
    });
}

document.getElementById("quotationList")?.addEventListener("click", async event => {
    const btn = event.target.closest(".select-vendor-btn");
    if (!btn) return;

    const inquiryId       = btn.dataset.inquiryId;
    const inquiryVendorId = btn.dataset.inquiryVendorId;

    // Read PR and vendor details from card and row before opening confirmation
    const card       = btn.closest(".inquiry-card");
    const prNumber   = card?.querySelector(".inquiry-card-item .inquiry-card-label")
        ? (() => {
            for (const item of card.querySelectorAll(".inquiry-card-item")) {
                if (item.querySelector(".inquiry-card-label")?.textContent?.trim() === "PR Number") {
                    return item.querySelector(".inquiry-card-value")?.textContent?.trim() || "-";
                }
            }
            return "-";
        })()
        : "-";
    const row = btn.closest("tr");
    const vendorCode = row?.querySelector("td:nth-child(1)")?.textContent?.trim() || "-";
    const vendorName = row?.querySelector("td:nth-child(2)")?.textContent?.trim() || "-";
    const pricePerUnit = row?.querySelector("td:nth-child(3)")?.textContent?.trim() || "-";
    const totalPrice = row?.querySelector("td:nth-child(4)")?.textContent?.trim() || "-";

    // 2nd-time confirmation step
    const confirmed = await confirmVendorSelection({
        prNumber,
        vendorName,
        vendorCode,
        pricePerUnit,
        totalPrice
    });

    if (!confirmed) return;

    btn.disabled = true;
    btn.textContent = "Selecting...";

    try {
        const response = await apiFetch(`/vendor-inquiries/${inquiryId}/select-vendor`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ inquiry_vendor_id: Number(inquiryVendorId) })
        });
        if (!response) return;

        const result = await response.json();

        if (!response.ok || !result.success) {
            alert(result.message || "Failed to select vendor");
            btn.disabled = false;
            btn.textContent = "Select";
            return;
        }

        await loadQuotationComparisons();
    } catch {
        alert("Failed to connect to procurement manager service");
        btn.disabled = false;
        btn.textContent = "Select";
    }
});

// ─── Order Tracking: Load a Page ───────────────────────────────────────────────

function ensureOtFilterToolbarInDom() {
    if (document.getElementById("orderTrackingStatusSelect")) return;
    const oldFilterBar = document.querySelector("#orderTrackingPage .ot-filter-bar");
    if (!oldFilterBar && !orderTrackingList) return;

    const container = document.createElement("div");
    container.className = "po-filter-container ot-filter-container";
    container.innerHTML = `
        <div class="po-filter-top-row">
            <!-- Search -->
            <div class="po-search-box">
                <svg class="po-input-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="11" cy="11" r="8"></circle>
                    <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                </svg>
                <input type="text" id="orderTrackingSearch" class="po-search-input" placeholder="Search by PR number, PO number, party, item..." autocomplete="off">
            </div>

            <!-- Status Dropdown -->
            <div class="po-select-card">
                <label class="po-field-label" for="orderTrackingStatusSelect">Status</label>
                <div class="po-select-wrap">
                    <select id="orderTrackingStatusSelect" class="po-field-select">
                        <option value="ALL">All</option>
                        <option value="OPEN">Open</option>
                        <option value="VENDOR_SELECTED">Vendor Selected</option>
                        <option value="CLOSED">Closed</option>
                        <option value="CANCELLED">Cancelled</option>
                    </select>
                    <svg class="po-chevron-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="6 9 12 15 18 9"></polyline>
                    </svg>
                </div>
            </div>

            <!-- Vendor / Party Dropdown -->
            <div class="po-select-card">
                <label class="po-field-label" for="orderTrackingPartySelect">Vendor / Party</label>
                <div class="po-select-wrap">
                    <select id="orderTrackingPartySelect" class="po-field-select">
                        <option value="ALL">All</option>
                    </select>
                    <svg class="po-chevron-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="6 9 12 15 18 9"></polyline>
                    </svg>
                </div>
            </div>

            <!-- Date Range -->
            <div class="po-date-range-card">
                <svg class="po-calendar-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                    <line x1="16" y1="2" x2="16" y2="6"></line>
                    <line x1="8" y1="2" x2="8" y2="6"></line>
                    <line x1="3" y1="10" x2="21" y2="10"></line>
                </svg>
                <div class="po-date-item">
                    <label class="po-date-sublabel" for="orderTrackingFromDate">From Date</label>
                    <input type="date" id="orderTrackingFromDate" class="po-date-field" title="From Date">
                </div>
                <span class="po-date-arrow">&rarr;</span>
                <div class="po-date-item">
                    <label class="po-date-sublabel" for="orderTrackingToDate">To Date</label>
                    <input type="date" id="orderTrackingToDate" class="po-date-field" title="To Date">
                </div>
            </div>

            <!-- Clear & Apply -->
            <button type="button" id="orderTrackingClearBtn" class="po-btn-clear">Clear</button>
            <button type="button" id="orderTrackingApplyBtn" class="po-btn-apply">Apply</button>
            <button type="button" id="orderTrackingExportBtn" class="ot-export-btn" style="display:none;"></button>
        </div>

        <!-- Status Pills Row -->
        <div class="po-filter-pills-row">
            <div class="po-filter-pills" id="otStatusPills">
                <button type="button" class="po-filter-pill active" data-status="ALL" data-label="All">All (0)</button>
                <button type="button" class="po-filter-pill" data-status="OPEN" data-label="Open">Open (0)</button>
                <button type="button" class="po-filter-pill" data-status="VENDOR_SELECTED" data-label="Vendor Selected">Vendor Selected (0)</button>
                <button type="button" class="po-filter-pill" data-status="CLOSED" data-label="Closed">Closed (0)</button>
                <button type="button" class="po-filter-pill" data-status="CANCELLED" data-label="Cancelled">Cancelled (0)</button>
            </div>
        </div>
    `;

    if (oldFilterBar) {
        oldFilterBar.replaceWith(container);
    } else if (orderTrackingList && orderTrackingList.parentNode) {
        orderTrackingList.parentNode.insertBefore(container, orderTrackingList);
    }
}

function updateOrderTrackingPillsUI(currentStatus) {
    const pillsWrap = document.getElementById("otStatusPills");
    if (!pillsWrap) return;
    pillsWrap.querySelectorAll(".po-filter-pill, .ot-pill").forEach(p => {
        if ((p.dataset.status || "ALL").toUpperCase() === (currentStatus || "ALL").toUpperCase()) {
            p.classList.add("active");
        } else {
            p.classList.remove("active");
        }
    });
}

function updateOrderTrackingPillCounts(counts) {
    if (!counts) return;
    const pillsWrap = document.getElementById("otStatusPills");
    if (!pillsWrap) return;
    pillsWrap.querySelectorAll(".po-filter-pill, .ot-pill").forEach(p => {
        const status = (p.dataset.status || "ALL").toUpperCase();
        const label = p.dataset.label || p.textContent.replace(/\s*\(\d+\)/, "").trim() || "All";
        const count = counts[status] !== undefined ? counts[status] : 0;
        p.textContent = `${label} (${count})`;
    });
}

function populateOrderTrackingPartyDropdown(partyList) {
    const partySelect = document.getElementById("orderTrackingPartySelect");
    if (!partySelect || !Array.isArray(partyList) || !partyList.length) return;
    const currentVal = partySelect.value || orderTrackingParty || "ALL";
    const parties = Array.from(new Set(partyList.map(p => String(p).trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b));
    if (!parties.length) return;
    partySelect.innerHTML = `<option value="ALL">All</option>` +
        parties.map(p => `<option value="${escapeHtml(p)}">${escapeHtml(p)}</option>`).join("");
    if (parties.includes(currentVal)) {
        partySelect.value = currentVal;
    } else {
        partySelect.value = "ALL";
    }
}

function initOrderTrackingFilters() {
    ensureOtFilterToolbarInDom();
    if (orderTrackingFiltersInitialized) return;

    const searchInput   = document.getElementById("orderTrackingSearch");
    const statusSelect  = document.getElementById("orderTrackingStatusSelect");
    const partySelect   = document.getElementById("orderTrackingPartySelect");
    const fromDateInput = document.getElementById("orderTrackingFromDate");
    const toDateInput   = document.getElementById("orderTrackingToDate");
    const clearBtn      = document.getElementById("orderTrackingClearBtn");
    const applyBtn      = document.getElementById("orderTrackingApplyBtn");
    const pillsWrap     = document.getElementById("otStatusPills");

    if (!pillsWrap && !searchInput && !statusSelect) return;
    orderTrackingFiltersInitialized = true;

    // Status select change
    statusSelect?.addEventListener("change", (e) => {
        orderTrackingStatus = e.target.value || "ALL";
        orderTrackingPage = 1;
        updateOrderTrackingPillsUI(orderTrackingStatus);
        loadOrderTracking();
    });

    // Party select change
    partySelect?.addEventListener("change", (e) => {
        orderTrackingParty = e.target.value || "ALL";
        orderTrackingPage = 1;
        loadOrderTracking();
    });

    // Pill buttons click
    pillsWrap?.addEventListener("click", (e) => {
        const pill = e.target.closest(".po-filter-pill, .ot-pill");
        if (!pill) return;
        const status = (pill.dataset.status || "ALL").toUpperCase();
        orderTrackingStatus = status;
        if (statusSelect) statusSelect.value = status;
        updateOrderTrackingPillsUI(status);
        orderTrackingPage = 1;
        loadOrderTracking();
    });

    // Search input with debounce and Enter
    searchInput?.addEventListener("input", (e) => {
        const val = e.target.value;
        clearTimeout(orderTrackingDebounceTimer);
        orderTrackingDebounceTimer = setTimeout(() => {
            orderTrackingSearchQuery = val;
            orderTrackingPage = 1;
            loadOrderTracking();
        }, 300);
    });

    searchInput?.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
            clearTimeout(orderTrackingDebounceTimer);
            orderTrackingSearchQuery = searchInput.value;
            orderTrackingPage = 1;
            loadOrderTracking();
        }
    });

    // Custom date pickers
    fromDateInput?.addEventListener("change", (e) => {
        orderTrackingFromDate = e.target.value;
    });

    toDateInput?.addEventListener("change", (e) => {
        orderTrackingToDate = e.target.value;
    });

    // Apply button
    applyBtn?.addEventListener("click", () => {
        if (searchInput) orderTrackingSearchQuery = searchInput.value;
        if (statusSelect) orderTrackingStatus = statusSelect.value || "ALL";
        if (partySelect) orderTrackingParty = partySelect.value || "ALL";
        if (fromDateInput) orderTrackingFromDate = fromDateInput.value;
        if (toDateInput) orderTrackingToDate = toDateInput.value;
        orderTrackingPage = 1;
        updateOrderTrackingPillsUI(orderTrackingStatus);
        loadOrderTracking();
    });

    // Clear button
    clearBtn?.addEventListener("click", () => {
        orderTrackingStatus = "ALL";
        orderTrackingParty = "ALL";
        orderTrackingSearchQuery = "";
        orderTrackingFromDate = "";
        orderTrackingToDate = "";
        orderTrackingPage = 1;

        if (searchInput) searchInput.value = "";
        if (statusSelect) statusSelect.value = "ALL";
        if (partySelect) partySelect.value = "ALL";
        if (fromDateInput) fromDateInput.value = "";
        if (toDateInput) toDateInput.value = "";

        updateOrderTrackingPillsUI("ALL");
        loadOrderTracking();
    });

    // Export button (if present)
    const exportBtn = document.getElementById("orderTrackingExportBtn");
    exportBtn?.addEventListener("click", async () => {
        const originalText = exportBtn.innerHTML;
        exportBtn.disabled = true;

        try {
            const params = new URLSearchParams();
            if (orderTrackingStatus && orderTrackingStatus !== "ALL") {
                params.set("status", orderTrackingStatus);
            }
            if (orderTrackingParty && orderTrackingParty !== "ALL") {
                params.set("party", orderTrackingParty);
            }
            if (orderTrackingSearchQuery && orderTrackingSearchQuery.trim()) {
                params.set("search", orderTrackingSearchQuery.trim());
            }
            if (orderTrackingFromDate) {
                params.set("from_date", orderTrackingFromDate);
            }
            if (orderTrackingToDate) {
                params.set("to_date", orderTrackingToDate);
            }

            const response = await apiFetch(`/order-tracking/export?${params.toString()}`);
            if (!response || !response.ok) {
                throw new Error("Export request failed");
            }

            const blob = await response.blob();
            const excelBlob = new Blob([blob], {
                type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            });
            const downloadUrl = window.URL.createObjectURL(excelBlob);
            const a = document.createElement("a");
            a.style.display = "none";
            a.href = downloadUrl;

            let downloadFilename = "";
            const disposition = response.headers.get("Content-Disposition");
            if (disposition && disposition.includes("filename=")) {
                const match = disposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
                if (match && match[1]) {
                    downloadFilename = match[1].replace(/['"]/g, "").trim();
                }
            }
            if (!downloadFilename) {
                const dateStr = new Date().toISOString().slice(0, 10);
                const statusSuffix = (orderTrackingStatus && orderTrackingStatus !== "ALL") ? `_${orderTrackingStatus}` : "";
                downloadFilename = `Order_Summary${statusSuffix}_${dateStr}.xlsx`;
            }

            a.download = downloadFilename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(downloadUrl);
        } catch (err) {
            console.error("Order tracking Excel export failed:", err);
            alert("Failed to export order summary to Excel. Please try again.");
        } finally {
            exportBtn.disabled = false;
            exportBtn.innerHTML = originalText;
        }
    });
}

async function loadOrderTracking() {
    initOrderTrackingFilters();

    orderTrackingList.innerHTML = `<div class="message">Loading orders...</div>`;
    if (orderTrackingPrev) orderTrackingPrev.disabled = true;
    if (orderTrackingNext) orderTrackingNext.disabled = true;

    try {
        const params = new URLSearchParams();
        params.set("page", orderTrackingPage);
        if (orderTrackingStatus && orderTrackingStatus !== "ALL") {
            params.set("status", orderTrackingStatus);
        }
        if (orderTrackingParty && orderTrackingParty !== "ALL") {
            params.set("party", orderTrackingParty);
        }
        if (orderTrackingSearchQuery && orderTrackingSearchQuery.trim()) {
            params.set("search", orderTrackingSearchQuery.trim());
        }
        if (orderTrackingFromDate) {
            params.set("from_date", orderTrackingFromDate);
        }
        if (orderTrackingToDate) {
            params.set("to_date", orderTrackingToDate);
        }

        const response = await apiFetch(`/order-tracking?${params.toString()}`);
        if (!response) return;
        const result   = await response.json();

        if (!response.ok || !result.success) {
            orderTrackingList.innerHTML = `<div class="message">${escapeHtml(result.message || "Failed to load order tracking data")}</div>`;
            return;
        }

        if (result.counts) {
            updateOrderTrackingPillCounts(result.counts);
        } else if (result.rows) {
            const fallbackCounts = {
                ALL: (result.pagination && result.pagination.total) ? result.pagination.total : result.rows.length,
                OPEN: 0,
                VENDOR_SELECTED: 0,
                CLOSED: 0,
                CANCELLED: 0
            };
            result.rows.forEach(r => {
                const s = (r.status || "").toUpperCase();
                if (fallbackCounts[s] !== undefined) fallbackCounts[s]++;
            });
            updateOrderTrackingPillCounts(fallbackCounts);
        }

        if (result.parties && result.parties.length) {
            populateOrderTrackingPartyDropdown(result.parties);
        } else if (result.rows && result.rows.length) {
            const pSet = new Set();
            result.rows.forEach(r => {
                if (r.party_name && r.party_name.trim()) pSet.add(r.party_name.trim());
                if (r.vendor_name && r.vendor_name.trim()) pSet.add(r.vendor_name.trim());
            });
            if (typeof allPurchaseOrders !== "undefined" && Array.isArray(allPurchaseOrders)) {
                allPurchaseOrders.forEach(po => {
                    if (po.vendor_name && po.vendor_name.trim()) pSet.add(po.vendor_name.trim());
                    if (po.party_name && po.party_name.trim()) pSet.add(po.party_name.trim());
                });
            }
            populateOrderTrackingPartyDropdown(Array.from(pSet));
        }

        renderOrderTracking(result.rows || []);

        const { page, total, total_pages, has_prev, has_next } = result.pagination;
        orderTrackingPage       = page;
        orderTrackingTotalPages = total_pages;

        if (orderTrackingPageLabel) {
            orderTrackingPageLabel.textContent = `Page ${page} of ${total_pages}`;
        }
        if (orderTrackingPrev) orderTrackingPrev.disabled = !has_prev;
        if (orderTrackingNext) orderTrackingNext.disabled = !has_next;

    } catch {
        orderTrackingList.innerHTML = `<div class="message">Failed to connect to procurement manager service</div>`;
    }
}

function statusLabel(status) {
    if (!status) return "NO INQUIRY";
    return status.replace(/_/g, " ");
}

function statusClass(status) {
    return `status-${(status || "none").toLowerCase()}`;
}

function renderOrderTrackingStepper(row) {
    const isPrCancelled = (row.vi_status === "CANCELLED" || row.status === "CANCELLED") && (!row.po_number && row.po_status !== "CANCELLED");
    const isOrderCancelled = row.po_status === "CANCELLED" || (row.status === "CANCELLED" && Boolean(row.po_number));

    const poNumber = row.po_number || null;
    const poStatus = (row.po_status || "").toUpperCase();
    const viStatus = (row.vi_status || "").toUpperCase();
    const totalReceived = Number(row.total_received) || 0;
    const qty = Number(row.qty) || 0;
    const isCompleted = poStatus === "COMPLETED";
    const isReceived = totalReceived > 0 || isCompleted;
    const isIssued = poStatus === "ISSUED" || poStatus === "COMPLETED" || totalReceived > 0;
    const isDraft = Boolean(poNumber) || isIssued;
    const isVendorSelected = viStatus === "VENDOR_SELECTED" || viStatus === "CLOSED" || isDraft;

    let steps = [];
    let badgeText = "";
    let badgeClass = "";
    let alertBannerHtml = "";
    let isCancelled = false;

    const prDateDisplay = formatDate(row.pr_date || row.created_at);

    if (isPrCancelled) {
        isCancelled = true;
        badgeText = "PR Cancelled";
        badgeClass = "badge-cancelled";
        const cancelDate = row.vi_updated_at ? formatDate(row.vi_updated_at) : prDateDisplay;
        alertBannerHtml = `
            <div class="tracker-alert-banner cancelled">
                <svg viewBox="0 0 20 20" fill="currentColor">
                    <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"/>
                </svg>
                <span>Purchase Request was cancelled${cancelDate && cancelDate !== "-" ? ` on ${cancelDate}` : ""}.</span>
            </div>
        `;
        steps = [
            {
                title: "Open",
                state: "completed",
                date: prDateDisplay,
                subtext: "PR Raised"
            },
            {
                title: "PR Cancelled",
                state: "cancelled",
                date: row.vi_updated_at ? formatDate(row.vi_updated_at) : "",
                subtext: "Request Cancelled"
            }
        ];
    } else if (isOrderCancelled) {
        isCancelled = true;
        badgeText = "Order Cancelled";
        badgeClass = "badge-cancelled";
        const cancelDate = row.po_updated_at ? formatDate(row.po_updated_at) : "";
        alertBannerHtml = `
            <div class="tracker-alert-banner cancelled">
                <svg viewBox="0 0 20 20" fill="currentColor">
                    <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"/>
                </svg>
                <span>Purchase Order ${escapeHtml(row.po_number || "")} was cancelled${cancelDate && cancelDate !== "-" ? ` on ${cancelDate}` : ""}.</span>
            </div>
        `;
        steps = [
            {
                title: "Open",
                state: "completed",
                date: prDateDisplay,
                subtext: "PR Raised"
            },
            {
                title: "Vendor Selected",
                state: "completed",
                date: formatDate(row.vi_updated_at || row.po_created_at),
                subtext: row.vendor_name ? escapeHtml(row.vendor_name) : "Vendor Selected"
            },
            {
                title: "Draft",
                state: "completed",
                date: formatDate(row.po_created_at || row.po_date),
                subtext: row.po_number ? escapeHtml(row.po_number) : "PO Draft Created"
            },
            {
                title: "Order Cancelled",
                state: "cancelled",
                date: cancelDate,
                subtext: "PO Cancelled"
            }
        ];
    } else {
        // Normal 6-stage flow: Open -> Vendor Selected -> Draft -> Issued -> Received -> Completed
        let currentStageIndex = 0;
        if (isCompleted) {
            currentStageIndex = 5;
            badgeText = "Order Completed";
            badgeClass = "badge-completed";
        } else if (isReceived) {
            currentStageIndex = 4;
            badgeText = `Received (${totalReceived} / ${qty} ${row.unit || "units"})`;
            badgeClass = "badge-received";
        } else if (isIssued) {
            currentStageIndex = 3;
            badgeText = "PO Issued";
            badgeClass = "badge-issued";
        } else if (isDraft) {
            currentStageIndex = 2;
            badgeText = "PO Draft";
            badgeClass = "badge-draft";
        } else if (isVendorSelected) {
            currentStageIndex = 1;
            badgeText = "Vendor Selected";
            badgeClass = "badge-vendor-selected";
        } else {
            currentStageIndex = 0;
            badgeText = "Open";
            badgeClass = "badge-open";
        }

        steps = [
            {
                title: "Open",
                state: "completed",
                date: prDateDisplay,
                subtext: "PR Raised"
            },
            {
                title: "Vendor Selected",
                state: currentStageIndex >= 1 ? "completed" : "pending",
                date: currentStageIndex >= 1 ? formatDate(row.vi_updated_at || row.po_created_at) : "",
                subtext: row.vendor_name ? escapeHtml(row.vendor_name) : (currentStageIndex >= 1 ? "Vendor Selected" : "Awaiting Vendor")
            },
            {
                title: "Draft",
                state: currentStageIndex >= 2 ? "completed" : "pending",
                date: currentStageIndex >= 2 ? formatDate(row.po_created_at || row.po_date) : "",
                subtext: row.po_number ? escapeHtml(row.po_number) : (currentStageIndex >= 2 ? "PO Drafted" : "Pending Draft")
            },
            {
                title: "Issued",
                state: currentStageIndex >= 3 ? "completed" : "pending",
                date: currentStageIndex >= 3 ? formatDate(row.po_updated_at || row.po_date) : "",
                subtext: currentStageIndex >= 3 ? "PO Issued" : "Awaiting Issue"
            },
            {
                title: "Received",
                state: currentStageIndex >= 4 ? "completed" : "pending",
                date: row.last_received_date ? formatDate(row.last_received_date) : "",
                subtext: totalReceived > 0 ? `${totalReceived} / ${qty} ${row.unit || "units"}` : "Goods Inward"
            },
            {
                title: "Completed",
                state: currentStageIndex >= 5 ? "completed" : "pending",
                date: isCompleted ? formatDate(row.po_updated_at || row.last_received_date) : "",
                subtext: isCompleted ? "Fulfilled & Closed" : (totalReceived >= qty && qty > 0 ? "Ready to Complete" : "Awaiting Completion")
            }
        ];
    }

    const checkSvg = `<svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/></svg>`;
    const crossSvg = `<svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"/></svg>`;

    let activeIndex = 0;
    for (let i = 0; i < steps.length; i++) {
        if (steps[i].state === "completed" || steps[i].state === "cancelled") {
            activeIndex = i;
        }
    }

    const stepsHtml = steps.map((step, idx) => {
        const isLast = idx === steps.length - 1;
        const isActive = idx === activeIndex && !isCancelled;

        let lineBeforeClass = "line-pending";
        if (step.state === "cancelled") {
            lineBeforeClass = "line-cancelled";
        } else if (step.state === "completed") {
            lineBeforeClass = "line-completed";
        }

        let lineAfterClass = "line-pending";
        if (!isLast) {
            const nextStep = steps[idx + 1];
            if (nextStep.state === "cancelled") {
                lineAfterClass = "line-cancelled";
            } else if (nextStep.state === "completed") {
                lineAfterClass = "line-completed";
            }
        }

        let circleContent = "";
        let circleClass = "circle-pending";
        if (step.state === "completed") {
            circleClass = "circle-completed";
            circleContent = checkSvg;
        } else if (step.state === "cancelled") {
            circleClass = "circle-cancelled";
            circleContent = crossSvg;
        }

        const dateHtml = (step.date && step.date !== "-") ? `<span class="step-date">${step.date}</span>` : "";
        const subtextHtml = step.subtext ? `<span class="step-subtext">${step.subtext}</span>` : "";

        let stepClasses = `stepper-step ${step.state}`;
        if (isActive) stepClasses += " active";

        return `
            <div class="${stepClasses}">
                <div class="stepper-node-row">
                    <div class="stepper-line line-before ${lineBeforeClass}"></div>
                    <div class="step-circle ${circleClass}">
                        ${circleContent}
                    </div>
                    <div class="stepper-line line-after ${lineAfterClass}"></div>
                </div>
                <div class="step-text-wrap">
                    <span class="step-title">${escapeHtml(step.title)}</span>
                    ${dateHtml}
                    ${subtextHtml}
                </div>
            </div>
        `;
    }).join("");

    return `
        <div class="order-tracker-card">
            <div class="order-tracker-header">
                <div class="order-tracker-title-wrap">
                    <span class="order-tracker-icon ${isCancelled ? 'cancelled' : ''}">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
                        </svg>
                    </span>
                    <h4 class="order-tracker-heading">Order Progress Tracker</h4>
                </div>
                <span class="order-tracker-badge ${badgeClass}">${escapeHtml(badgeText)}</span>
            </div>
            ${alertBannerHtml}
            <div class="order-stepper-wrapper">
                <div class="order-stepper-track">
                    ${stepsHtml}
                </div>
            </div>
        </div>
    `;
}

function renderOrderTracking(rows) {
    orderTrackingList.innerHTML = "";

    if (!rows.length) {
        orderTrackingList.textContent = "No purchase requests found";
        return;
    }

    rows.forEach(row => {
        const card = document.createElement("div");
        card.className = "po-row";

        const poDateBadge = (row.po_number && row.po_date)
            ? `<span class="ot-row-date">${formatDate(row.po_date)}</span>`
            : "";

        const poNumberDisplay = `<div class="po-row-field">
                   <span class="inquiry-card-label">PO Number</span>
                   <span class="inquiry-card-value">${escapeHtml(row.po_number || "—")}</span>
                   ${poDateBadge}
               </div>`;

        const poNumberItem = row.po_number
            ? `<div class="inquiry-card-item">
                   <span class="inquiry-card-label">PO Number</span>
                   <span class="inquiry-card-value">${escapeHtml(row.po_number)}</span>
               </div>`
            : "";

        const dateBadge = (row.pr_date || row.created_at)
            ? `<span class="ot-row-date">${formatDate(row.pr_date || row.created_at)}</span>`
            : "";

        card.innerHTML = `
            <div class="po-row-summary">
                <div class="po-row-field">
                    <span class="inquiry-card-label">PR Number</span>
                    <span class="inquiry-card-value">${escapeHtml(row.pr_number || "-")}</span>
                    ${dateBadge}
                </div>
                ${poNumberDisplay}
                <div class="po-row-field">
                    <span class="inquiry-card-label">Party Name</span>
                    <span class="inquiry-card-value">${escapeHtml(row.party_name || "-")}</span>
                </div>
                <div class="po-row-field">
                    <span class="inquiry-card-label">Item Name</span>
                    <span class="inquiry-card-value">${escapeHtml(row.item_name || "-")}</span>
                </div>
                <div class="po-row-field">
                    <span class="inquiry-card-label">Sales Rate</span>
                    <span class="inquiry-card-value">${formatCurrency(row.sales_rate)}</span>
                </div>
                <span class="inquiry-status ${statusClass(row.status)}">${statusLabel(row.status)}</span>
                <button type="button" class="expand-po-btn" data-ot-id="${row.pr_id}">
                    Expand ▾
                </button>
            </div>

            <div class="po-row-detail" id="otDetail-${row.pr_id}" style="display:none">
                <div class="inquiry-card-info">
                    ${prInfoItems(row, poNumberItem)}
                </div>
                ${renderOrderTrackingStepper(row)}
            </div>
        `;

        orderTrackingList.appendChild(card);
    });
}

// ─── Order Tracking: Pagination Buttons ────────────────────────────────────────

orderTrackingPrev?.addEventListener("click", () => {
    if (orderTrackingPage > 1) {
        orderTrackingPage -= 1;
        loadOrderTracking();
    }
});

orderTrackingNext?.addEventListener("click", () => {
    if (orderTrackingPage < orderTrackingTotalPages) {
        orderTrackingPage += 1;
        loadOrderTracking();
    }
});

// ─── Order Tracking: Expand Row ────────────────────────────────────────────────

orderTrackingList?.addEventListener("click", event => {
    const expandBtn = event.target.closest(".expand-po-btn");
    if (!expandBtn) return;

    const otId   = expandBtn.dataset.otId;
    const detail = document.getElementById(`otDetail-${otId}`);
    const isOpen = detail.style.display !== "none";
    detail.style.display = isOpen ? "none" : "block";
    expandBtn.textContent = isOpen ? "Expand ▾" : "Collapse ▴";
});

// ─── Purchase Orders: Load List & Filters ─────────────────────────────────────

let allPurchaseOrders = [];
let poStatusFilter = "ALL";
let poVendorFilter = "ALL";
let poSearchQuery = "";
let poDateFromFilter = "";
let poDateToFilter = "";
let poFiltersInitialized = false;

function ensurePoFilterToolbarInDom() {
    if (document.getElementById("poSearchInput")) return;
    const oldFilterBar = document.querySelector("#purchaseOrdersPage .ot-filter-bar");
    if (!oldFilterBar && !purchaseOrdersList) return;

    const container = document.createElement("div");
    container.className = "po-filter-container";
    container.innerHTML = `
        <div class="po-filter-top-row">
            <div class="po-search-box">
                <svg class="po-input-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="11" cy="11" r="8"></circle>
                    <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                </svg>
                <input type="text" id="poSearchInput" class="po-search-input" placeholder="Search by PO number, vendor, item..." autocomplete="off">
            </div>
            <div class="po-select-card">
                <label class="po-field-label" for="poStatusSelect">Status</label>
                <div class="po-select-wrap">
                    <select id="poStatusSelect" class="po-field-select">
                        <option value="ALL">All</option>
                        <option value="DRAFT">Draft</option>
                        <option value="ISSUED">Issued</option>
                        <option value="COMPLETED">Completed</option>
                        <option value="CANCELLED">Cancelled</option>
                    </select>
                    <svg class="po-chevron-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="6 9 12 15 18 9"></polyline>
                    </svg>
                </div>
            </div>
            <div class="po-select-card">
                <label class="po-field-label" for="poVendorSelect">Vendor / Party</label>
                <div class="po-select-wrap">
                    <select id="poVendorSelect" class="po-field-select">
                        <option value="ALL">All</option>
                    </select>
                    <svg class="po-chevron-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="6 9 12 15 18 9"></polyline>
                    </svg>
                </div>
            </div>
            <div class="po-date-range-card">
                <svg class="po-calendar-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                    <line x1="16" y1="2" x2="16" y2="6"></line>
                    <line x1="8" y1="2" x2="8" y2="6"></line>
                    <line x1="3" y1="10" x2="21" y2="10"></line>
                </svg>
                <div class="po-date-item">
                    <label class="po-date-sublabel" for="poDateFrom">From Date</label>
                    <input type="date" id="poDateFrom" class="po-date-field" title="From Date">
                </div>
                <span class="po-date-arrow">&rarr;</span>
                <div class="po-date-item">
                    <label class="po-date-sublabel" for="poDateTo">To Date</label>
                    <input type="date" id="poDateTo" class="po-date-field" title="To Date">
                </div>
            </div>
            <button type="button" id="poFilterClearBtn" class="po-btn-clear">Clear</button>
            <button type="button" id="poFilterApplyBtn" class="po-btn-apply">Apply</button>
            <button type="button" id="poExportBtn" class="po-btn-export" title="Export Purchase Orders to Excel (.xlsx)">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                <span>Export</span>
            </button>
        </div>
        <div class="po-filter-pills-row">
            <div class="po-filter-pills" id="poStatusPills">
                <button type="button" class="po-filter-pill active" data-status="ALL" data-label="All">All (0)</button>
                <button type="button" class="po-filter-pill" data-status="DRAFT" data-label="Draft">Draft (0)</button>
                <button type="button" class="po-filter-pill" data-status="ISSUED" data-label="Issued">Issued (0)</button>
                <button type="button" class="po-filter-pill" data-status="COMPLETED" data-label="Completed">Completed (0)</button>
                <button type="button" class="po-filter-pill" data-status="CANCELLED" data-label="Cancelled">Cancelled (0)</button>
            </div>
        </div>
    `;

    if (oldFilterBar) {
        oldFilterBar.replaceWith(container);
    } else if (purchaseOrdersList) {
        purchaseOrdersList.parentElement.insertBefore(container, purchaseOrdersList);
    }
}

function initPurchaseOrderFilters() {
    ensurePoFilterToolbarInDom();
    if (poFiltersInitialized) return;

    const pillsWrap = document.getElementById("poStatusPills");
    const searchInput = document.getElementById("poSearchInput");
    const statusSelect = document.getElementById("poStatusSelect");
    const vendorSelect = document.getElementById("poVendorSelect");
    const dateFromInput = document.getElementById("poDateFrom");
    const dateToInput = document.getElementById("poDateTo");
    const clearBtn = document.getElementById("poFilterClearBtn");
    const applyBtn = document.getElementById("poFilterApplyBtn");

    if (!pillsWrap && !searchInput) return;
    poFiltersInitialized = true;

    // Status Pills Click
    pillsWrap?.addEventListener("click", (e) => {
        const pill = e.target.closest(".po-filter-pill, .ot-pill");
        if (!pill) return;
        const status = (pill.dataset.status || "ALL").toUpperCase();
        poStatusFilter = status;
        if (statusSelect) statusSelect.value = status;
        updateActivePoPill(status);
        applyPurchaseOrderFilter();
    });
// Export Button
    const exportBtn = document.getElementById("poExportBtn");
    exportBtn?.addEventListener("click", async () => {
        const originalContent = exportBtn.innerHTML;
        exportBtn.disabled = true;
        exportBtn.innerHTML = `
            <svg class="spin-animation" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10" stroke-opacity="0.25"></circle>
                <path d="M12 2a10 10 0 0 1 10 10" stroke-opacity="0.85"></path>
            </svg>
            <span>Exporting...</span>
        `;

        try {
            const params = new URLSearchParams();
            if (poSearchQuery) params.set("search", poSearchQuery);
            if (poStatusFilter && poStatusFilter !== "ALL") params.set("status", poStatusFilter);
            if (poVendorFilter && poVendorFilter !== "ALL") params.set("vendor", poVendorFilter);
            if (poDateFromFilter) params.set("from_date", poDateFromFilter);
            if (poDateToFilter) params.set("to_date", poDateToFilter);

            const response = await apiFetch(`/purchase-orders/export?${params.toString()}`);
            if (!response || !response.ok) {
                throw new Error("Export request failed");
            }

            const blob = await response.blob();
            const excelBlob = new Blob([blob], {
                type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            });
            const downloadUrl = window.URL.createObjectURL(excelBlob);
            const a = document.createElement("a");
            a.style.display = "none";
            a.href = downloadUrl;

            let downloadFilename = "";
            const disposition = response.headers.get("Content-Disposition");
            if (disposition && disposition.includes("filename=")) {
                const match = disposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
                if (match && match[1]) {
                    downloadFilename = match[1].replace(/['"]/g, "").trim();
                }
            }
            if (!downloadFilename) {
                const dateStr = new Date().toISOString().slice(0, 10);
                const statusSuffix = (poStatusFilter && poStatusFilter !== "ALL") ? `_${poStatusFilter}` : "";
                downloadFilename = `Purchase_Orders_Summary${statusSuffix}_${dateStr}.xlsx`;
            }

            a.download = downloadFilename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(downloadUrl);
        } catch (err) {
            console.error("Purchase order export failed:", err);
            alert("Failed to export purchase orders to Excel. Please try again.");
        } finally {
            exportBtn.disabled = false;
            exportBtn.innerHTML = originalContent;
        }
    });

    // Status Select Change
    statusSelect?.addEventListener("change", () => {
        poStatusFilter = (statusSelect.value || "ALL").toUpperCase();
        updateActivePoPill(poStatusFilter);
        applyPurchaseOrderFilter();
    });

    // Vendor Select Change
    vendorSelect?.addEventListener("change", () => {
        poVendorFilter = vendorSelect.value || "ALL";
        applyPurchaseOrderFilter();
    });

    // Search Input (live search with trim)
    searchInput?.addEventListener("input", () => {
        poSearchQuery = searchInput.value || "";
        applyPurchaseOrderFilter();
    });

    // Date From & To Change
    dateFromInput?.addEventListener("change", () => {
        poDateFromFilter = dateFromInput.value || "";
    });
    dateToInput?.addEventListener("change", () => {
        poDateToFilter = dateToInput.value || "";
    });

    // Apply Button
    applyBtn?.addEventListener("click", () => {
        if (searchInput) poSearchQuery = searchInput.value || "";
        if (statusSelect) poStatusFilter = (statusSelect.value || "ALL").toUpperCase();
        if (vendorSelect) poVendorFilter = vendorSelect.value || "ALL";
        if (dateFromInput) poDateFromFilter = dateFromInput.value || "";
        if (dateToInput) poDateToFilter = dateToInput.value || "";
        updateActivePoPill(poStatusFilter);
        applyPurchaseOrderFilter();
    });

    // Clear Button
    clearBtn?.addEventListener("click", () => {
        if (searchInput) searchInput.value = "";
        if (statusSelect) statusSelect.value = "ALL";
        if (vendorSelect) vendorSelect.value = "ALL";
        if (dateFromInput) dateFromInput.value = "";
        if (dateToInput) dateToInput.value = "";

        poSearchQuery = "";
        poStatusFilter = "ALL";
        poVendorFilter = "ALL";
        poDateFromFilter = "";
        poDateToFilter = "";

        updateActivePoPill("ALL");
        applyPurchaseOrderFilter();
    });
}

function updateActivePoPill(status) {
    const pillsWrap = document.getElementById("poStatusPills");
    if (!pillsWrap) return;
    pillsWrap.querySelectorAll(".po-filter-pill, .ot-pill").forEach(p => {
        if ((p.dataset.status || "ALL").toUpperCase() === status.toUpperCase()) {
            p.classList.add("active");
        } else {
            p.classList.remove("active");
        }
    });
}

function updatePoStatusPillCounts() {
    const counts = {
        ALL: allPurchaseOrders.length,
        DRAFT: 0,
        ISSUED: 0,
        COMPLETED: 0,
        CANCELLED: 0
    };
    allPurchaseOrders.forEach(po => {
        const s = (po.status || "").toUpperCase();
        if (counts[s] !== undefined) counts[s]++;
    });

    const pillsWrap = document.getElementById("poStatusPills");
    if (!pillsWrap) return;
    pillsWrap.querySelectorAll(".po-filter-pill, .ot-pill").forEach(pill => {
        const status = (pill.dataset.status || "ALL").toUpperCase();
        const label = pill.dataset.label || "All";
        const count = counts[status] ?? 0;
        pill.textContent = `${label} (${count})`;
    });
}

function populatePoVendorDropdown() {
    const vendorSelect = document.getElementById("poVendorSelect");
    if (!vendorSelect) return;
    const currentVal = vendorSelect.value || "ALL";
    const names = new Set();
    allPurchaseOrders.forEach(po => {
        const vName = (po.vendor_name || "").trim();
        const pName = (po.party_name || "").trim();
        if (vName) names.add(vName);
        if (pName) names.add(pName);
    });
    const sortedNames = Array.from(names).sort((a, b) => a.localeCompare(b));
    vendorSelect.innerHTML = `<option value="ALL">All</option>` +
        sortedNames.map(v => `<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join("");
    if (sortedNames.includes(currentVal)) {
        vendorSelect.value = currentVal;
    } else {
        vendorSelect.value = "ALL";
        poVendorFilter = "ALL";
    }
}

function applyPurchaseOrderFilter() {
    let filtered = allPurchaseOrders;

    // 1. Status Filter
    if (poStatusFilter && poStatusFilter !== "ALL") {
        filtered = filtered.filter(po => (po.status || "").toUpperCase() === poStatusFilter.toUpperCase());
    }

    // 2. Vendor / Party Filter
    if (poVendorFilter && poVendorFilter !== "ALL") {
        const target = poVendorFilter.trim().toLowerCase();
        filtered = filtered.filter(po =>
            (po.vendor_name || "").trim().toLowerCase() === target ||
            (po.party_name || "").trim().toLowerCase() === target
        );
    }

    // 3. Date Range Filter
    if (poDateFromFilter || poDateToFilter) {
        filtered = filtered.filter(po => {
            const rawDate = po.po_date || po.pr_date;
            if (!rawDate) return false;
            const d = new Date(rawDate);
            if (isNaN(d.getTime())) return false;
            const yyyy = d.getFullYear();
            const mm = String(d.getMonth() + 1).padStart(2, "0");
            const dd = String(d.getDate()).padStart(2, "0");
            const poYMD = `${yyyy}-${mm}-${dd}`;

            if (poDateFromFilter && poYMD < poDateFromFilter) return false;
            if (poDateToFilter && poYMD > poDateToFilter) return false;
            return true;
        });
    }

    // 4. Search Query Filter
    if (poSearchQuery && poSearchQuery.trim()) {
        const terms = poSearchQuery.trim().toLowerCase().split(/\s+/);
        filtered = filtered.filter(po => {
            const searchable = [
                po.po_number,
                po.vendor_name,
                po.vendor_code,
                po.party_name,
                po.item_name,
                po.pr_number,
                po.make,
                po.model,
                po.location,
                po.territory
            ].filter(Boolean).join(" ").toLowerCase();

            return terms.every(t => searchable.includes(t));
        });
    }

    renderPurchaseOrders(filtered);
}

async function loadPurchaseOrders() {
    initPurchaseOrderFilters();
    purchaseOrdersList.innerHTML = "Loading...";

    try {
        const response = await apiFetch("/purchase-orders");
        if (!response) return;
        const result   = await response.json();

        if (!response.ok || !result.success) {
            purchaseOrdersList.textContent = result.message || "Failed to load purchase orders";
            return;
        }

        allPurchaseOrders = result.purchase_orders || [];
        updatePoStatusPillCounts();
        populatePoVendorDropdown();
        applyPurchaseOrderFilter();

    } catch {
        purchaseOrdersList.textContent = "Failed to connect to procurement service";
    }
}

function vendorDetailField(label, value) {
    return `
        <div class="vendor-details-item">
            <span class="vendor-details-label">${escapeHtml(label)}</span>
            <span class="vendor-details-value">${escapeHtml(value || "-")}</span>
        </div>
    `;
}

function renderPurchaseOrders(orders) {
    purchaseOrdersList.innerHTML = "";

    if (!orders.length) {
        purchaseOrdersList.innerHTML = `
            <div style="padding: 32px 16px; text-align: center; color: #64748b; font-size: 14px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px;">
                No purchase orders found${poStatusFilter !== "ALL" ? ` with status "<strong>${escapeHtml(poStatusFilter)}</strong>"` : ""}.
            </div>
        `;
        return;
    }

    orders.forEach(po => {
        const card = document.createElement("div");
        card.className = "po-row";

        card.innerHTML = `
            <div class="po-row-summary">
                <div class="po-row-field">
                    <span class="inquiry-card-label">PO Number</span>
                    <span class="inquiry-card-value">${escapeHtml(po.po_number || "-")}</span>
                    ${po.po_date ? `<span class="ot-row-date">${formatDate(po.po_date)}</span>` : ""}
                </div>
                <div class="po-row-field">
                    <span class="inquiry-card-label">Party Name</span>
                    <span class="inquiry-card-value">${escapeHtml(po.party_name || "-")}</span>
                    ${po.vendor_name ? `<span style="font-size:11px;color:#64748b;display:block;margin-top:2px;">Vendor: ${escapeHtml(po.vendor_name)}</span>` : ""}
                </div>
                <div class="po-row-field">
                    <span class="inquiry-card-label">Item Name</span>
                    <span class="inquiry-card-value">${escapeHtml(po.item_name || "-")}</span>
                </div>
                <div class="po-row-field">
                    <span class="inquiry-card-label">Total Price</span>
                    <span class="inquiry-card-value">${formatCurrency(po.total_price)}</span>
                </div>
                <span class="inquiry-status status-${(po.status || "").toLowerCase()}">
                    ${escapeHtml(po.status || "-")}
                </span>
                <button type="button" class="expand-po-btn" data-po-id="${po.po_id}">
                    Expand ▾
                </button>
            </div>

            <div class="po-row-detail" id="poDetail-${po.po_id}" style="display:none">
                <div class="inquiry-card-info">
                    ${prInfoItems(po)}
                </div>

                <div class="inquiry-card-footer">
                    <button type="button" class="primary-button vendor-details-toggle" data-po-id="${po.po_id}">
                        Show Vendor Details
                    </button>
                    ${po.status === "DRAFT" ? `
                        <button type="button" class="primary-button issue-po-btn"
                            data-po-id="${po.po_id}">
                            Issue PO
                        </button>
                        <button type="button" class="secondary-button reselect-po-btn"
                            data-po-id="${po.po_id}"
                            data-po-number="${escapeHtml(po.po_number || "")}">
                            ↩ Change Vendor
                        </button>
                        <button type="button" class="danger-button cancel-po-btn"
                            data-po-id="${po.po_id}"
                            data-po-number="${escapeHtml(po.po_number || "")}">
                            ✕ Cancel Requirement
                        </button>
                    ` : ""}
                    ${(po.status === "ISSUED" || po.status === "COMPLETED") ? `
                        <button type="button" class="secondary-button download-po-btn" data-po-id="${po.po_id}">
                            ⬇ Download PO
                        </button>
                    ` : ""}
                </div>

                <div class="vendor-details-panel" id="vendorDetailsPanel-${po.po_id}">
                    <div class="vendor-details-grid">
                        ${vendorDetailField("Vendor Code", po.vendor_code)}
                        ${vendorDetailField("Vendor Name", po.vendor_name)}
                        ${vendorDetailField("Legal Entity", po.legal_entity)}
                        ${vendorDetailField("Commercial Role", po.commercial_role)}
                        ${vendorDetailField("Year of Incorporation", po.year_of_incorporation)}
                        ${vendorDetailField("Registration Date", formatDate(po.registration_date))}
                        ${vendorDetailField("Office Address & Phone", po.office_address_and_phone)}
                        ${vendorDetailField("Factory Address & Phone", po.factory_address_and_phone)}
                        ${vendorDetailField("Warehouse Address & Phone", po.warehouse_address_and_phone)}
                        ${vendorDetailField("Workshop Address & Phone", po.workshop_address_and_phone)}
                        ${vendorDetailField("Director/CEO Name", po.director_or_ceo_or_management_name)}
                        ${vendorDetailField("Designation", po.director_or_ceo_or_management_designation)}
                        ${vendorDetailField("Mobile No.", po.director_or_ceo_or_management_mobile_no)}
                        ${vendorDetailField("Email", po.director_or_ceo_or_management_email)}
                        ${vendorDetailField("Web Address", po.director_or_ceo_or_management_web_address)}
                        ${vendorDetailField("Sales Team Name", po.sales_team_name)}
                        ${vendorDetailField("Sales Team Contact", po.sales_team_contact)}
                        ${vendorDetailField("Sales Team Email", po.sales_team_email)}
                        ${vendorDetailField("Accounts Team Name", po.accounts_team_name)}
                        ${vendorDetailField("Accounts Team Contact", po.accounts_team_contact)}
                        ${vendorDetailField("Accounts Team Email", po.accounts_team_email)}
                        ${vendorDetailField("GST Number", po.gst_number || po.vendor_gst)}
                        ${vendorDetailField("PAN Number", po.pan_number)}
                        ${vendorDetailField("MSME Number", po.msme_number)}
                        ${vendorDetailField("Bank Details", po.bank_details)}
                        ${vendorDetailField("Branch Office 1", po.branch_office_1)}
                        ${vendorDetailField("Branch Office 2", po.branch_office_2)}
                        ${vendorDetailField("Branch Office 3", po.branch_office_3)}
                        ${vendorDetailField(po.turnover_year_1 || "Turnover 1", po.turnover_value_1)}
                        ${vendorDetailField(po.turnover_year_2 || "Turnover 2", po.turnover_value_2)}
                        ${vendorDetailField(po.turnover_year_3 || "Turnover 3", po.turnover_value_3)}
                        ${vendorDetailField("Quoted Price / Unit", formatCurrency(po.price_per_unit))}
                        ${vendorDetailField("Quoted Total Price", formatCurrency(po.total_price))}
                        ${vendorDetailField("Quotation Remarks", po.quotation_remarks)}
                    </div>
                </div>
            </div>
        `;

        purchaseOrdersList.appendChild(card);

    });
}

// ─── Purchase Orders: Expand Row + Toggle Vendor Details ──────────────────────

purchaseOrdersList?.addEventListener("click", async event => {

    const expandBtn = event.target.closest(".expand-po-btn");
    if (expandBtn) {
        const poId   = expandBtn.dataset.poId;
        const detail = document.getElementById(`poDetail-${poId}`);
        const isOpen = detail.style.display !== "none";
        detail.style.display = isOpen ? "none" : "block";
        expandBtn.textContent = isOpen ? "Expand ▾" : "Collapse ▴";
        return;
    }

    const vendorBtn = event.target.closest(".vendor-details-toggle");
    if (vendorBtn) {
        const poId   = vendorBtn.dataset.poId;
        const panel  = document.getElementById(`vendorDetailsPanel-${poId}`);
        const isOpen = panel.classList.toggle("open");
        vendorBtn.textContent = isOpen ? "Hide Vendor Details" : "Show Vendor Details";
        return;
    }

    const issuePOBtn = event.target.closest(".issue-po-btn");
    if (issuePOBtn) {
        const poId = issuePOBtn.dataset.poId;

        if (!confirm("Issue this Purchase Order? It will become active for goods receipt.")) return;

        issuePOBtn.disabled = true;
        issuePOBtn.textContent = "Issuing...";

        try {
            const response = await apiFetch(`/purchase-orders/${poId}/issue`, { method: "POST" });
            if (!response) return;
            if (!response.ok) {
                const result = await response.json().catch(() => ({}));
                alert(result.message || "Failed to issue PO.");
                issuePOBtn.disabled = false;
                issuePOBtn.textContent = "Issue PO";
                return;
            }

            alert("PO generated and issued successfully. You can download the PO using the Download button.");
            await loadPurchaseOrders();

            const detail = document.getElementById(`poDetail-${poId}`);
            if (detail) {
                detail.style.display = "block";
                const expandBtn = detail.parentElement?.querySelector(".expand-po-btn");
                if (expandBtn) expandBtn.textContent = "Collapse ▴";
            }

        } catch (error) {
            console.error(error);
            alert("Failed to connect to procurement service.");
            issuePOBtn.disabled = false;
            issuePOBtn.textContent = "Issue PO";
        }
        return;
    }

    const downloadPoBtn = event.target.closest(".download-po-btn");
    if (downloadPoBtn) {
        const poId = downloadPoBtn.dataset.poId;
        const link = document.createElement("a");
        link.href = `/purchase-orders/${poId}/download`;
        link.setAttribute("download", "");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        return;
    }

    // ── Change Vendor (delete DRAFT PO, re-open inquiry) ──
    const reselectBtn = event.target.closest(".reselect-po-btn");
    if (reselectBtn) {
        const poId     = reselectBtn.dataset.poId;
        const poNumber = reselectBtn.dataset.poNumber;

        const reason = prompt(
            `Change vendor for ${poNumber}?\n\n` +
            `The draft PO will be removed and the inquiry re-opened.\n` +
            `All existing vendor quotations are kept — go to Quotation Comparisons to pick a different vendor.\n\n` +
            `Enter reason:`
        );
        if (reason === null) return;
        if (!reason.trim()) { alert("A reason is required."); return; }

        reselectBtn.disabled = true;

        try {
            const response = await apiFetch(`/purchase-orders/${poId}/reselect`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ reason: reason.trim() })
            });
            if (!response) return;

            const result = await response.json();

            if (!response.ok || !result.success) {
                alert(result.message || "Failed to process re-selection");
                reselectBtn.disabled = false;
                return;
            }

            alert(
                `Done. The draft PO has been removed.\n\n` +
                `Go to Quotation Comparisons to select a different vendor for ${result.pr_number}.`
            );
            await loadPurchaseOrders();

        } catch {
            alert("Failed to connect to procurement service");
            reselectBtn.disabled = false;
        }
        return;
    }

    // ── Cancel Requirement (permanent, full chain) ──
    const cancelPoBtn = event.target.closest(".cancel-po-btn");
    if (cancelPoBtn) {
        const poId     = cancelPoBtn.dataset.poId;
        const poNumber = cancelPoBtn.dataset.poNumber;

        const reason = prompt(
            `Cancel the entire requirement for ${poNumber}?\n\n` +
            `This will permanently close the PR, inquiry and this draft PO.\n` +
            `The PO number will not be reused. This cannot be undone.\n\n` +
            `Enter reason for cancellation:`
        );
        if (reason === null) return;
        if (!reason.trim()) { alert("A cancellation reason is required."); return; }

        if (!confirm(
            `Are you sure?\n\n` +
            `The entire requirement chain for ${poNumber} will be permanently cancelled.`
        )) return;

        cancelPoBtn.disabled = true;

        try {
            const response = await apiFetch(`/purchase-orders/${poId}/cancel`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ reason: reason.trim() })
            });
            if (!response) return;

            const result = await response.json();

            if (!response.ok || !result.success) {
                alert(result.message || "Failed to cancel requirement");
                cancelPoBtn.disabled = false;
                return;
            }

            alert(`Requirement for ${result.pr_number} permanently cancelled.`);
            await loadPurchaseOrders();

        } catch {
            alert("Failed to connect to procurement service");
            cancelPoBtn.disabled = false;
        }
        return;
    }
});

// ─── Goods Received ─────────────────────────────────────────────────────────

// "Show completed" toggle, created here so index.html needs no change
function ensureCompletedToggle() {
    if (document.getElementById("goodsShowCompletedWrap")) return;

    const wrap = document.createElement("label");
    wrap.id = "goodsShowCompletedWrap";
    wrap.style.cssText = "display:inline-flex;align-items:center;gap:8px;margin-bottom:12px;font-size:14px;cursor:pointer;";
    wrap.innerHTML = `<input type="checkbox" id="goodsShowCompleted"> Show completed orders`;

    goodsReceivedList.parentNode.insertBefore(wrap, goodsReceivedList);

    wrap.querySelector("input").addEventListener("change", event => {
        showCompletedGoods = event.target.checked;
        renderGoodsReceived(goodsReceivedOrders);
    });
}

async function loadGoodsReceived() {
    ensureCompletedToggle();

    try {
        goodsReceivedMessage.textContent = "Loading goods received...";

        const response = await apiFetch("/goods-received");
        if (!response) return;
        const result = await response.json();

        if (!response.ok) {
            goodsReceivedMessage.textContent =
                result.message || "Failed to load goods received";
            return;
        }

        goodsReceivedOrders = result.orders || [];
        renderGoodsReceived(goodsReceivedOrders);
        goodsReceivedMessage.textContent = "";

    } catch (error) {
        console.error(error);
        goodsReceivedMessage.textContent =
            "Failed to connect to procurement service";
    }
}

function renderGoodsReceived(allOrders) {
    const rows = showCompletedGoods
        ? allOrders
        : allOrders.filter(o => o.po_status !== "COMPLETED");

    if (!rows.length) {
        goodsReceivedList.innerHTML = `
            <div class="message">
                No purchase orders available for goods receipt.
            </div>
        `;
        return;
    }

    goodsReceivedList.innerHTML = rows.map(po => {

        const ordered   = Number(po.ordered_quantity)   || 0;
        const received  = Number(po.received_quantity)  || 0;
        const returned  = Number(po.returned_quantity)  || 0;   // used if backend sends it
        const remaining = Number(po.remaining_quantity) || 0;
        const progress  = Number(po.progress)           || 0;
        const isDone    = po.po_status === "COMPLETED";

        // FIX: received_quantity from backend is already net received (total received - returned).
        // Show Mark Complete when the order is fully received (remaining is 0 or received >= ordered).
        const canComplete = !isDone && ordered > 0 && (received >= ordered || remaining <= 0 || progress >= 100);

        return `
            <div class="goods-received-card">

                <div class="goods-received-stats">
                    <div>
                        <span class="goods-received-label">PO Number</span>
                        <strong>${escapeHtml(po.po_number)}</strong>
                    </div>
                    <div>
                        <span class="goods-received-label">Vendor</span>
                        <strong>${escapeHtml(po.vendor_name)}</strong>
                    </div>
                    <div>
                        <span class="goods-received-label">Item</span>
                        <strong>${escapeHtml(po.item_name)}</strong>
                    </div>
                    <div>
                        <span class="goods-received-label">Ordered Qty</span>
                        <strong>${ordered} ${escapeHtml(po.unit || "")}</strong>
                    </div>
                    <div>
                        <span class="goods-received-label">Received Qty</span>
                        <strong>${received}</strong>
                    </div>
                    <div>
                        <span class="goods-received-label">Remaining Qty</span>
                        <strong>${remaining}</strong>
                    </div>
                </div>
                <div class="goods-progress-section">
                    <div class="goods-progress-header">
                        <span>Receipt Progress</span>
                        <strong>${progress.toFixed(0)}%</strong>
                    </div>
                    <div class="goods-progress-bar">
                        <div class="goods-progress-fill" style="width: ${Math.min(progress, 100)}%"></div>
                    </div>
                </div>

                <div class="goods-received-actions">
                    ${isDone ? `<span class="inquiry-status status-completed">COMPLETED</span>` : `
                        <button class="primary-button" onclick="openReceiveForm(${po.po_id})">
                            Add Received
                        </button>
                        <button class="secondary-button" onclick="openReturnForm(${po.po_id})">
                            Return
                        </button>
                        ${canComplete ? `
                            <button class="secondary-button" onclick="completePO(${po.po_id}, this)">
                                Mark Complete
                            </button>
                        ` : ""}
                    `}
                    <button class="secondary-button" onclick="viewGoodsHistory(${po.po_id})">
                        History
                    </button>
                </div>

                <div id="receive-form-${po.po_id}" class="goods-inline-form hidden"></div>
                <div id="return-form-${po.po_id}" class="goods-inline-form hidden"></div>
                <div id="history-${po.po_id}" class="goods-history hidden"></div>

            </div>
        `;

    }).join("");
}

function openReceiveForm(poId) {
    const form       = document.getElementById(`receive-form-${poId}`);
    const returnForm = document.getElementById(`return-form-${poId}`);

    returnForm.classList.add("hidden");

    form.innerHTML = `
        <h3>Add Received Quantity</h3>
        <div class="form-grid">
            <div class="form-group">
                <label>Received Quantity</label>
                <input type="number" id="received-quantity-${poId}" min="0.01" step="0.01" required>
            </div>
            <div class="form-group">
                <label>Receipt Date</label>
                <input type="date" id="receipt-date-${poId}" value="${todayISO()}" required>
            </div>
            <div class="form-group full-width">
                <label>Remarks <span style="font-weight:400;color:#888;">(optional)</span></label>
                <textarea id="receipt-remarks-${poId}" placeholder="Optional remarks"></textarea>
            </div>
        </div>
        <div class="goods-form-actions">
            <button class="primary-button" onclick="saveGoodsReceipt(${poId}, this)">Save Receipt</button>
            <button class="cancel-vendor-btn" onclick="closeGoodsForm(${poId}, 'receive')">Cancel</button>
        </div>
    `;

    form.classList.remove("hidden");
}

function openReturnForm(poId) {
    const form        = document.getElementById(`return-form-${poId}`);
    const receiveForm = document.getElementById(`receive-form-${poId}`);

    receiveForm.classList.add("hidden");

    form.innerHTML = `
        <h3>Return Goods</h3>
        <div class="form-grid">
            <div class="form-group">
                <label>Return Quantity</label>
                <input type="number" id="return-quantity-${poId}" min="0.01" step="0.01" required>
            </div>
            <div class="form-group">
                <label>Return Date</label>
                <input type="date" id="return-date-${poId}" value="${todayISO()}" required>
            </div>
            <div class="form-group full-width">
                <label>Reason <span style="color:#c00;">*</span></label>
                <textarea id="return-reason-${poId}" required placeholder="Enter reason for return"></textarea>
            </div>
        </div>
        <div class="goods-form-actions">
            <button class="primary-button" onclick="saveGoodsReturn(${poId}, this)">Save Return</button>
            <button class="cancel-vendor-btn" onclick="closeGoodsForm(${poId}, 'return')">Cancel</button>
        </div>
    `;

    form.classList.remove("hidden");
}

// buttons disabled while the request is in flight (no double posting)
async function saveGoodsReceipt(poId, btn) {
    const receivedQuantity  = Number(document.getElementById(`received-quantity-${poId}`).value);
    const receiptDate       = document.getElementById(`receipt-date-${poId}`).value;
    const remarks           = document.getElementById(`receipt-remarks-${poId}`).value.trim();

    if (!receivedQuantity || receivedQuantity <= 0) {
        alert("Received quantity must be greater than 0."); return;
    }
    if (!receiptDate) {
        alert("Receipt date is required."); return;
    }

    if (btn) btn.disabled = true;

    try {
        const response = await apiFetch("/goods-received", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                po_id:              poId,
                receipt_date:       receiptDate,
                received_quantity:  receivedQuantity,
                remarks
            })
        });
        if (!response) return;

        const result = await response.json();

        if (!response.ok) {
            alert(result.message || "Failed to record receipt.");
            if (btn) btn.disabled = false;
            return;
        }

        alert("Goods received successfully.");
        await loadGoodsReceived();

    } catch (error) {
        console.error(error);
        alert("Failed to connect to procurement service.");
        if (btn) btn.disabled = false;
    }
}

async function saveGoodsReturn(poId, btn) {
    const returnQuantity = Number(document.getElementById(`return-quantity-${poId}`).value);
    const returnDate     = document.getElementById(`return-date-${poId}`).value;
    const returnReason   = document.getElementById(`return-reason-${poId}`).value.trim();

    if (!returnQuantity || returnQuantity <= 0) {
        alert("Return quantity must be greater than 0."); return;
    }
    if (!returnDate) {
        alert("Return date is required."); return;
    }
    if (!returnReason) {
        alert("Return reason is required."); return;
    }

    if (btn) btn.disabled = true;

    try {
        const response = await apiFetch("/goods-returns", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                po_id:           poId,
                return_quantity: returnQuantity,
                return_date:     returnDate,
                return_reason:   returnReason
            })
        });
        if (!response) return;

        const result = await response.json();

        if (!response.ok) {
            alert(result.message || "Failed to record return.");
            if (btn) btn.disabled = false;
            return;
        }

        alert("Return recorded successfully.");
        await loadGoodsReceived();

    } catch (error) {
        console.error(error);
        alert("Failed to connect to procurement service.");
        if (btn) btn.disabled = false;
    }
}

function closeGoodsForm(poId, type) {
    const form = document.getElementById(
        `${type === "receive" ? "receive" : "return"}-form-${poId}`
    );
    if (form) {
        form.classList.add("hidden");
        form.innerHTML = "";
    }
}

async function viewGoodsHistory(poId) {
    const history = document.getElementById(`history-${poId}`);

    if (!history.classList.contains("hidden")) {
        history.classList.add("hidden");
        return;
    }

    try {
        history.innerHTML = "Loading history...";
        history.classList.remove("hidden");

        const response = await apiFetch(`/goods-received/${poId}`);
        if (!response) return;
        const result   = await response.json();

        if (!response.ok) {
            history.innerHTML = escapeHtml(result.message || "Failed to load history");
            return;
        }

        const receipts = result.receipts || [];
        const returns  = result.returns  || [];

        history.innerHTML = `
            <h3>Receipt History</h3>
            ${receipts.length ? `
                <div class="table-container">
                    <table class="goods-history-table">
                        <thead>
                            <tr>
                                <th>Receipt ID</th>
                                <th>Receipt Date</th>
                                <th>Received Qty</th>
                                <th>Remarks</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${receipts.map(r => `
                                <tr>
                                    <td>${escapeHtml(String(r.receipt_id))}</td>
                                    <td>${formatDate(r.received_date)}</td>
                                    <td>${r.received_quantity}</td>
                                    <td>${escapeHtml(r.remarks || "-")}</td>
                                </tr>
                            `).join("")}
                        </tbody>
                    </table>
                </div>
            ` : `<p>No receipts recorded.</p>`}

            <h3 class="return-history-title">Return History</h3>
            ${returns.length ? `
                <div class="table-container">
                    <table class="goods-history-table">
                        <thead>
                            <tr>
                                <th>Return ID</th>
                                <th>Return Date</th>
                                <th>Quantity</th>
                                <th>Reason</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${returns.map(r => `
                                <tr>
                                    <td>${escapeHtml(String(r.return_id))}</td>
                                    <td>${formatDate(r.return_date)}</td>
                                    <td>${r.return_quantity}</td>
                                    <td>${escapeHtml(r.return_reason)}</td>
                                </tr>
                            `).join("")}
                        </tbody>
                    </table>
                </div>
            ` : `<p>No returns recorded.</p>`}
        `;

    } catch (error) {
        console.error(error);
        history.innerHTML = "Failed to connect to procurement service.";
    }
}

async function completePO(poId, btn) {
    if (!confirm("Mark this Purchase Order as completed? This cannot be undone.")) return;

    if (btn) btn.disabled = true;

    try {
        const response = await apiFetch(`/purchase-orders/${poId}/complete`, {
            method: "POST",
            headers: { "Content-Type": "application/json" }
        });
        if (!response) return;

        const result = await response.json();

        if (!response.ok) {
            alert(result.message || "Failed to complete Purchase Order.");
            if (btn) btn.disabled = false;
            return;
        }

        alert("Purchase Order marked as completed.");
        await loadGoodsReceived();

    } catch (error) {
        console.error(error);
        alert("Failed to connect to procurement service.");
        if (btn) btn.disabled = false;
    }
}

// ─── Vendor Performance ────────────────────────────────────────────────────────

let allVendorPerformance = [];
let vpFiltersInitialized = false;

async function loadVendorPerformance() {
    const list = document.getElementById("vendorPerformanceList");
    const msg  = document.getElementById("vendorPerformanceMessage");

    list.innerHTML = "";
    msg.textContent = "Loading vendor performance...";

    initVendorPerformanceFilters();

    try {
        const response = await apiFetch("/vendor-performance");
        if (!response) return;
        const result   = await response.json();

        if (!response.ok || !result.success) {
            msg.textContent = result.message || "Failed to load vendor performance";
            return;
        }

        msg.textContent = "";
        allVendorPerformance = result.vendors || [];
        filterAndRenderVendorPerformance();

    } catch {
        msg.textContent = "Failed to connect to procurement service";
    }
}

function filterAndRenderVendorPerformance() {
    const query    = document.getElementById("vpSearchInput")?.value.trim().toLowerCase() || "";
    const delivery = document.getElementById("vpDeliveryFilter")?.value || "";
    const orders   = document.getElementById("vpOrdersFilter")?.value || "";
    const status   = document.getElementById("vpStatusFilter")?.value || "";
    const sort     = document.getElementById("vpSortFilter")?.value || "code_asc";

    const clearBtn = document.getElementById("vpSearchClearBtn");
    if (clearBtn) {
        clearBtn.classList.toggle("hidden", !query);
    }

    let filtered = allVendorPerformance.filter(v => {
        if (query) {
            const code = (v.vendor_code || "").toLowerCase();
            const name = (v.vendor_name || "").toLowerCase();
            if (!code.includes(query) && !name.includes(query)) {
                return false;
            }
        }

        if (delivery === "high") {
            if (v.on_time_pct === null || v.on_time_pct < 80) return false;
        } else if (delivery === "medium") {
            if (v.on_time_pct === null || v.on_time_pct < 50 || v.on_time_pct >= 80) return false;
        } else if (delivery === "low") {
            if (v.on_time_pct === null || v.on_time_pct >= 50) return false;
        } else if (delivery === "none") {
            if (v.total_deliveries > 0) return false;
        }

        if (orders === "open") {
            if ((v.open_orders || 0) <= 0) return false;
        } else if (orders === "has_orders") {
            if ((v.total_orders || 0) <= 0) return false;
        } else if (orders === "no_orders") {
            if ((v.total_orders || 0) > 0) return false;
        }

        if (status === "active") {
            if (v.is_blacklisted) return false;
        } else if (status === "blacklisted") {
            if (!v.is_blacklisted) return false;
        }

        return true;
    });

    filtered.sort((a, b) => {
        if (sort === "name_asc") {
            return (a.vendor_name || "").localeCompare(b.vendor_name || "");
        } else if (sort === "orders_desc") {
            return (b.total_orders || 0) - (a.total_orders || 0);
        } else if (sort === "value_desc") {
            return (b.order_value || 0) - (a.order_value || 0);
        } else if (sort === "ontime_desc") {
            const pctA = a.on_time_pct !== null ? a.on_time_pct : -1;
            const pctB = b.on_time_pct !== null ? b.on_time_pct : -1;
            return pctB - pctA;
        } else if (sort === "lead_asc") {
            const leadA = a.avg_lead_time_days !== null ? a.avg_lead_time_days : 999999;
            const leadB = b.avg_lead_time_days !== null ? b.avg_lead_time_days : 999999;
            return leadA - leadB;
        } else {
            if (!a.vendor_code && !b.vendor_code) return 0;
            if (!a.vendor_code) return 1;
            if (!b.vendor_code) return -1;
            return a.vendor_code.localeCompare(b.vendor_code, undefined, { numeric: true });
        }
    });

    const countEl = document.getElementById("vpResultsCount");
    if (countEl) {
        if (filtered.length === allVendorPerformance.length) {
            countEl.textContent = `Showing all ${filtered.length} vendor${filtered.length === 1 ? "" : "s"}`;
        } else {
            countEl.textContent = `Showing ${filtered.length} of ${allVendorPerformance.length} vendor${allVendorPerformance.length === 1 ? "" : "s"}`;
        }
    }

    renderVendorPerformance(filtered);
}

function initVendorPerformanceFilters() {
    if (vpFiltersInitialized) return;
    const searchInput = document.getElementById("vpSearchInput");
    const clearBtn    = document.getElementById("vpSearchClearBtn");
    const deliverySel = document.getElementById("vpDeliveryFilter");
    const ordersSel   = document.getElementById("vpOrdersFilter");
    const statusSel   = document.getElementById("vpStatusFilter");
    const sortSel     = document.getElementById("vpSortFilter");
    const resetBtn    = document.getElementById("vpResetFiltersBtn");

    if (!searchInput) return;

    vpFiltersInitialized = true;

    searchInput.addEventListener("input", filterAndRenderVendorPerformance);

    clearBtn?.addEventListener("click", () => {
        searchInput.value = "";
        searchInput.focus();
        filterAndRenderVendorPerformance();
    });

    deliverySel?.addEventListener("change", filterAndRenderVendorPerformance);
    ordersSel?.addEventListener("change", filterAndRenderVendorPerformance);
    statusSel?.addEventListener("change", filterAndRenderVendorPerformance);
    sortSel?.addEventListener("change", filterAndRenderVendorPerformance);

    resetBtn?.addEventListener("click", () => {
        searchInput.value = "";
        if (deliverySel) deliverySel.value = "";
        if (ordersSel) ordersSel.value = "";
        if (statusSel) statusSel.value = "";
        if (sortSel) sortSel.value = "code_asc";
        filterAndRenderVendorPerformance();
    });
}

// single handler for both blacklisting and un-blacklisting a vendor
async function toggleVendorBlacklist(vendorId, vendorName, isBlacklisted, btn) {
    const action = isBlacklisted ? "unblacklist" : "blacklist";
    const verb   = isBlacklisted ? "remove this vendor from the blacklist" : "blacklist this vendor";

    const reason = prompt(`Enter a reason to ${verb} (optional):`, "");
    if (reason === null) return;   // user cancelled the prompt

    if (!confirm(`Are you sure you want to ${verb}?\n\nVendor: ${vendorName}`)) return;

    if (btn) btn.disabled = true;

    try {
        const response = await apiFetch(`/vendor-performance/${vendorId}/${action}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ reason: reason.trim() || null })
        });
        if (!response) return;

        const result = await response.json();

        if (!response.ok || !result.success) {
            alert(result.message || `Failed to ${action} vendor.`);
            if (btn) btn.disabled = false;
            return;
        }

        alert(isBlacklisted ? "Vendor removed from blacklist successfully." : "Vendor blacklisted successfully.");
        await loadVendorPerformance();

    } catch {
        alert("Failed to connect to procurement service.");
        if (btn) btn.disabled = false;
    }
}

// the click listener is attached ONCE here, not on every render
document.getElementById("vendorPerformanceList")?.addEventListener("click", async event => {
    const list = event.currentTarget;

    // Blacklist / Unblacklist button
    const blacklistBtn = event.target.closest(".vp-blacklist-btn");
    if (blacklistBtn) {
        const vendorId      = blacklistBtn.dataset.vendorId;
        const vendorName    = blacklistBtn.dataset.vendorName;
        const isBlacklisted = blacklistBtn.dataset.blacklisted === "1";
        await toggleVendorBlacklist(vendorId, vendorName, isBlacklisted, blacklistBtn);
        return;
    }

    const btn  = event.target.closest(".vp-drill-btn");
    if (!btn) return;

    const vendorId  = btn.dataset.vendorId;
    const detailRow = document.getElementById(`vpDetail-${vendorId}`);
    const content   = document.getElementById(`vpDetailContent-${vendorId}`);
    const isOpen    = detailRow.style.display !== "none";

    list.querySelectorAll(".vp-detail-row").forEach(r => r.style.display = "none");
    list.querySelectorAll(".vp-drill-btn").forEach(b => b.textContent = "Details ▾");

    if (isOpen) return;

    btn.textContent = "Details ▴";
    detailRow.style.display = "";
    content.innerHTML = "Loading...";

    try {
        const response = await apiFetch(`/vendor-performance/${vendorId}`);
        if (!response) return;
        const result   = await response.json();

        if (!response.ok || !result.success) {
            content.innerHTML = escapeHtml(result.message || "Failed to load details");
            return;
        }

        renderVendorPerformanceDetail(content, result);

    } catch {
        content.innerHTML = "Failed to connect to procurement service";
    }
});

function renderVendorPerformance(vendors) {
    const list = document.getElementById("vendorPerformanceList");
    list.innerHTML = "";

    if (!vendors.length) {
        list.innerHTML = `
            <div class="ev-no-results">
                <div class="ev-no-results-icon">🔍</div>
                <div class="ev-no-results-title">No matching vendors found</div>
                <div class="ev-no-results-desc">Try adjusting your search terms or filter criteria.</div>
            </div>
        `;
        return;
    }

    const table = document.createElement("div");
    table.className = "table-container";
    table.innerHTML = `
        <table>
            <thead>
                <tr>
                    <th>Vendor Code</th>
                    <th>Vendor Name</th>
                    <th>Total Orders</th>
                    <th>Order Value (₹)</th>
                    <th>Avg Lead Time</th>
                    <th>On-Time Delivery</th>
                    <th>Open Orders</th>
                    <th></th>
                </tr>
            </thead>
            <tbody>
                ${vendors.map(v => `
                    <tr${v.is_blacklisted ? ' class="vp-row-blacklisted"' : ""}>
                        <td>${escapeHtml(v.vendor_code || "-")}</td>
                        <td>
                            ${escapeHtml(v.vendor_name)}
                            ${v.is_blacklisted ? '<span class="vp-blacklisted-badge">Blacklisted</span>' : ""}
                        </td>
                        <td>${v.total_orders}</td>
                        <td>${formatCurrency(v.order_value)}</td>
                        <td>${v.avg_lead_time_days !== null ? `${v.avg_lead_time_days} days` : "-"}</td>
                        <td>
                            ${v.on_time_pct !== null
                                ? `<span class="${v.on_time_pct >= 80 ? "status-open" : v.on_time_pct >= 50 ? "status-vendor_selected" : "status-cancelled"}">
                                       ${v.on_time_pct}%
                                   </span>
                                   <span style="font-size:12px;color:#888;margin-left:6px;">
                                       (${v.on_time_deliveries}/${v.total_deliveries})
                                   </span>`
                                : "-"
                            }
                        </td>
                        <td>${v.open_orders > 0
                            ? `<span class="inquiry-status status-open">${v.open_orders}</span>`
                            : `<span style="color:#888;">0</span>`
                        }</td>
                        <td>
                            <div class="vp-actions">
                                <button
                                    type="button"
                                    class="option-button vp-drill-btn"
                                    data-vendor-id="${v.vendor_id}"
                                    data-vendor-name="${escapeHtml(v.vendor_name)}">
                                    Details ▾
                                </button>
                                <button
                                    type="button"
                                    class="option-button vp-blacklist-btn${v.is_blacklisted ? " vp-blacklist-btn--active" : ""}"
                                    data-vendor-id="${v.vendor_id}"
                                    data-vendor-name="${escapeHtml(v.vendor_name)}"
                                    data-blacklisted="${v.is_blacklisted ? "1" : "0"}">
                                    ${v.is_blacklisted ? "Unblacklist" : "Blacklist"}
                                </button>
                            </div>
                        </td>
                    </tr>
                    <tr class="vp-detail-row" id="vpDetail-${v.vendor_id}" style="display:none">
                        <td colspan="8">
                            <div class="vp-detail-container" id="vpDetailContent-${v.vendor_id}">
                                Loading...
                            </div>
                        </td>
                    </tr>
                `).join("")}
            </tbody>
        </table>
    `;

    list.appendChild(table);
}

function renderVendorPerformanceDetail(container, { profile, kpis, orders }) {
    const kpiCard = (label, value, extraClass = "") => `
        <div class="inquiry-card-item${extraClass ? " " + extraClass : ""}">
            <span class="inquiry-card-label">${label}</span>
            <span class="inquiry-card-value">${value}</span>
        </div>
    `;

    const onTimeHtml = kpis.on_time_pct !== null
        ? `<span class="${kpis.on_time_pct >= 80 ? "status-open" : kpis.on_time_pct >= 50 ? "status-vendor_selected" : "status-cancelled"}">${kpis.on_time_pct}%</span> <span style="font-size:12px;color:#888;margin-left:6px;">(${kpis.on_time_deliveries}/${kpis.total_deliveries})</span>`
        : "-";

    container.innerHTML = `
        <div class="vp-detail-card vp-kpi-grid">
            ${kpiCard("Total Orders",      kpis.total_orders)}
            ${kpiCard("Order Value",       `₹${formatCurrency(kpis.order_value)}`)}
            ${kpiCard("Avg Lead Time",     kpis.avg_lead_time_days !== null ? `${kpis.avg_lead_time_days} days` : "-")}
            ${kpiCard("On-Time Delivery",  onTimeHtml)}
            ${kpiCard("Open Orders",       kpis.open_orders)}
        </div>

        <div class="vp-detail-card vp-meta-grid">
            ${kpiCard("GST",           escapeHtml(profile.gst_number  || "-"))}
            ${kpiCard("PAN",           escapeHtml(profile.pan_number  || "-"))}
            ${kpiCard("Office",        escapeHtml(profile.office_address || "-"), "vp-meta-item--office")}
            ${kpiCard("Sales Contact", escapeHtml(profile.sales_team_email || "-"), "vp-meta-item--contact")}
        </div>

        <div class="table-container">
            <table class="inquiry-vendor-table">
                <thead>
                    <tr>
                        <th>PO Number</th>
                        <th>PO Date</th>
                        <th>Item</th>
                        <th>Qty</th>
                        <th>Total Price (₹)</th>
                        <th>Expected Delivery</th>
                        <th>First Receipt</th>
                        <th>Lead Time</th>
                        <th>On Time?</th>
                        <th>Status</th>
                    </tr>
                </thead>
                <tbody>
                    ${orders.length ? orders.map(o => `
                        <tr>
                            <td>${escapeHtml(o.po_number  || "-")}</td>
                            <td>${formatDate(o.po_date)}</td>
                            <td>${escapeHtml(o.item_name  || "-")}</td>
                            <td>${o.qty} ${escapeHtml(o.unit || "")}</td>
                            <td>${formatCurrency(o.total_price)}</td>
                            <td>${formatDate(o.expected_delivery_date)}</td>
                            <td>${formatDate(o.first_received_date)}</td>
                            <td>${o.lead_time_days !== null ? `${o.lead_time_days} days` : "-"}</td>
                            <td>
                                ${o.first_received_date === null
                                    ? `<span style="color:#888;">Pending</span>`
                                    : o.delivered_on_time
                                        ? `<span class="status-open">✓ Yes</span>`
                                        : `<span class="status-cancelled">✗ No</span>`
                                }
                            </td>
                            <td>
                                <span class="inquiry-status status-${(o.status || "").toLowerCase()}">
                                    ${escapeHtml(o.status || "-")}
                                </span>
                            </td>
                        </tr>
                    `).join("") : `<tr><td colspan="10" style="text-align:center;color:#888;">No orders yet</td></tr>`}
                </tbody>
            </table>
        </div>
    `;
}

// ─── Past Price Reference ──────────────────────────────────────────────────────

let pprModelList      = [];
let pprSelected       = null;
let pprListenersBound = false;   // bind input/outside-click listeners only once

async function loadPPRModels() {
    try {
        const response = await apiFetch("/past-price-reference/models");
        if (!response) return;
        const result   = await response.json();

        if (!response.ok || !result.success) return;

        pprModelList = result.models || [];

    } catch {
        // silently fail - search will just show no results
    }
}

function initPastPriceReference() {
    const input    = document.getElementById("pprSearchInput");
    const dropdown = document.getElementById("pprDropdown");

    if (!pprModelList.length) loadPPRModels();

    input.value = "";
    document.getElementById("pprResults").innerHTML   = "";
    document.getElementById("pprMessage").textContent = "";
    document.getElementById("pprSelectedLabel").classList.add("hidden");
    dropdown.classList.add("hidden");
    pprSelected = null;

    if (!pprListenersBound) {
        input.addEventListener("input", onPPRInput);
        document.addEventListener("click", onPPROutsideClick);
        pprListenersBound = true;
    }
}

function onPPRInput() {
    const input    = document.getElementById("pprSearchInput");
    const dropdown = document.getElementById("pprDropdown");
    const query    = input.value.trim().toLowerCase();

    if (!query) {
        dropdown.classList.add("hidden");
        dropdown.innerHTML = "";
        return;
    }

    const matches = pprModelList.filter(m =>
        (m.item_name || "").toLowerCase().includes(query) ||
        (m.model     || "").toLowerCase().includes(query) ||
        (m.make      || "").toLowerCase().includes(query)
    );

    if (!matches.length) {
        dropdown.innerHTML = `<div class="ppr-dropdown-empty">No product found</div>`;
        dropdown.classList.remove("hidden");
        return;
    }

    dropdown.innerHTML = matches.slice(0, 30).map(m => `
        <div
            class="ppr-dropdown-item"
            data-model="${escapeHtml(m.model || "")}"
            data-make="${escapeHtml(m.make || "")}"
            data-item-name="${escapeHtml(m.item_name || "")}">
            <div class="ppr-dropdown-item-header">
                <span class="ppr-dropdown-model">${escapeHtml(m.item_name || "-")}</span>
                ${m.make ? `<span class="ppr-dropdown-pill-make">${escapeHtml(m.make)}</span>` : ""}
            </div>
            <div class="ppr-dropdown-meta">
                ${m.model ? `<span><strong>Model:</strong> ${escapeHtml(m.model)}</span>` : ""}
                ${m.product_category ? `<span>· ${escapeHtml(m.product_category)}</span>` : ""}
            </div>
        </div>
    `).join("");

    dropdown.classList.remove("hidden");

    dropdown.querySelectorAll(".ppr-dropdown-item").forEach(item => {
        item.addEventListener("click", () => {
            const model    = item.dataset.model || "";
            const make     = item.dataset.make || "";
            const itemName = item.dataset.itemName || "";

            let label = itemName;
            if (make && model) {
                label += ` — ${make} (Model: ${model})`;
            } else if (model) {
                label += ` (Model: ${model})`;
            } else if (make) {
                label += ` (${make})`;
            }
            document.getElementById("pprSearchInput").value = label;
            dropdown.classList.add("hidden");

            if (model || itemName) {
                loadPPRDetail(model, make, itemName);
            } else {
                document.getElementById("pprMessage").textContent = "This item has no model or item name on record.";
            }
        });
    });
}

function onPPROutsideClick(e) {
    const dropdown = document.getElementById("pprDropdown");
    const input    = document.getElementById("pprSearchInput");
    if (dropdown && !dropdown.contains(e.target) && e.target !== input) {
        dropdown.classList.add("hidden");
    }
}

async function loadPPRDetail(model, make, itemName) {
    const results = document.getElementById("pprResults");
    const msg     = document.getElementById("pprMessage");
    const label   = document.getElementById("pprSelectedLabel");

    results.innerHTML = "";
    msg.textContent   = "Loading past price reference...";
    label.classList.add("hidden");

    try {
        const params = new URLSearchParams();
        if (model) params.set("model", model);
        if (make) params.set("make", make);
        if (itemName) params.set("item_name", itemName);

        const response = await apiFetch(`/past-price-reference?${params.toString()}`);
        if (!response) return;
        const result   = await response.json();

        if (!response.ok || !result.success) {
            msg.textContent = result.message || "Failed to fetch price history";
            return;
        }

        msg.textContent = "";

        if (!result.purchases?.length) {
            msg.innerHTML = `
                <div class="ppr-empty-state">
                    <div class="ppr-empty-icon">
                        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                    </div>
                    <div class="ppr-empty-title">No Purchase History Found</div>
                    <div class="ppr-empty-desc">No issued or completed purchase orders exist for this specification yet.</div>
                </div>
            `;
            return;
        }

        label.innerHTML = `
            <div class="ppr-header-box">
                <div class="ppr-header-info">
                    <div class="ppr-header-title-row">
                        <span class="ppr-header-item-name">${escapeHtml(result.item_name || result.model || "Product")}</span>
                        ${result.make ? `<span class="ppr-badge ppr-badge-make">Make: ${escapeHtml(result.make)}</span>` : ""}
                        ${result.model ? `<span class="ppr-badge ppr-badge-model">Model: ${escapeHtml(result.model)}</span>` : ""}
                    </div>
                    <div class="ppr-header-sub">
                        <span>Verified purchase orders (Issued / Completed) for this specification</span>
                    </div>
                </div>
                <div class="ppr-header-stats">
                    <div class="ppr-stat-chip">
                        <span class="ppr-stat-count">${result.purchases.length}</span>
                        <span class="ppr-stat-label">Total Order${result.purchases.length !== 1 ? "s" : ""}</span>
                    </div>
                    <div class="ppr-stat-chip">
                        <span class="ppr-stat-count">${result.byVendor.length}</span>
                        <span class="ppr-stat-label">Vendor${result.byVendor.length !== 1 ? "s" : ""}</span>
                    </div>
                </div>
            </div>
        `;
        label.classList.remove("hidden");

        renderPPRResults(result);

    } catch {
        msg.textContent = "Failed to connect to procurement service";
    }
}

function renderPPRResults({ last3, byVendor }) {
    const results = document.getElementById("pprResults");

    const cardsHtml = last3.map((p, i) => {
        const rankLabels = [
            { text: "#1 · Most Recent Purchase", cls: "ppr-rank-recent" },
            { text: "#2 · Previous Purchase", cls: "ppr-rank-prev" },
            { text: "#3 · Earlier Purchase", cls: "ppr-rank-earlier" }
        ];
        const rankInfo = rankLabels[i] || { text: `#${i + 1} · Purchase`, cls: "ppr-rank-earlier" };
        const statusLower = (p.status || "").toLowerCase();
        const initial = (p.vendor_name || "V").charAt(0).toUpperCase();

        return `
            <div class="ppr-summary-card ${i === 0 ? "ppr-card-highlighted" : ""}">
                <div class="ppr-card-top">
                    <span class="ppr-rank-badge ${rankInfo.cls}">
                        ${i === 0 ? `<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>` : ""}
                        ${rankInfo.text}
                    </span>
                    <span class="ppr-status-badge status-${statusLower}">
                        <span class="ppr-status-dot"></span>${escapeHtml(p.status || "-")}
                    </span>
                </div>

                <div class="ppr-price-hero">
                    <span class="ppr-price-label">PURCHASE UNIT RATE</span>
                    <div class="ppr-price-val-wrap">
                        <span class="ppr-price-val">₹${formatCurrency(p.price_per_unit)}</span>
                        <span class="ppr-price-per">/ ${escapeHtml(p.unit || "unit")}</span>
                    </div>
                </div>

                <div class="ppr-card-details-grid">
                    <div class="ppr-detail-item">
                        <span class="ppr-detail-k">PO NUMBER</span>
                        <span class="ppr-detail-v ppr-po-mono">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                            ${escapeHtml(p.po_number)}
                        </span>
                    </div>
                    <div class="ppr-detail-item">
                        <span class="ppr-detail-k">PO DATE</span>
                        <span class="ppr-detail-v">${formatDate(p.po_date)}</span>
                    </div>
                    <div class="ppr-detail-item">
                        <span class="ppr-detail-k">ORDER QTY</span>
                        <span class="ppr-detail-v">${p.qty} ${escapeHtml(p.unit || "")}</span>
                    </div>
                    <div class="ppr-detail-item">
                        <span class="ppr-detail-k">TOTAL VALUE</span>
                        <span class="ppr-detail-v ppr-val-bold">₹${formatCurrency(p.total_price)}</span>
                    </div>
                </div>

                <div class="ppr-card-vendor-footer">
                    <div class="ppr-vendor-avatar">${escapeHtml(initial)}</div>
                    <div class="ppr-vendor-info">
                        <span class="ppr-vendor-name-line" title="${escapeHtml(p.vendor_name)}">${escapeHtml(p.vendor_name)}</span>
                        ${p.vendor_code ? `<span class="ppr-vendor-code-pill">${escapeHtml(p.vendor_code)}</span>` : ""}
                    </div>
                </div>
            </div>
        `;
    }).join("");

    let placeholdersHtml = "";
    if (last3.length === 1) {
        placeholdersHtml = `
            <div class="ppr-summary-card ppr-placeholder-card">
                <div class="ppr-placeholder-inner">
                    <div class="ppr-placeholder-icon">
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 14 14"/></svg>
                    </div>
                    <span class="ppr-placeholder-title">No Previous Purchase (#2)</span>
                    <span class="ppr-placeholder-desc">Only 1 purchase recorded for this exact specification. Future completed orders will appear here.</span>
                </div>
            </div>
            <div class="ppr-summary-card ppr-placeholder-card">
                <div class="ppr-placeholder-inner">
                    <div class="ppr-placeholder-icon">
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 14 14"/></svg>
                    </div>
                    <span class="ppr-placeholder-title">No Earlier Purchase (#3)</span>
                    <span class="ppr-placeholder-desc">Earlier purchase price reference slot will be populated when 3 or more orders exist.</span>
                </div>
            </div>
        `;
    } else if (last3.length === 2) {
        placeholdersHtml = `
            <div class="ppr-summary-card ppr-placeholder-card">
                <div class="ppr-placeholder-inner">
                    <div class="ppr-placeholder-icon">
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 14 14"/></svg>
                    </div>
                    <span class="ppr-placeholder-title">No Earlier Purchase (#3)</span>
                    <span class="ppr-placeholder-desc">2 purchases recorded. Earlier purchase price reference slot will be populated on the next PO.</span>
                </div>
            </div>
        `;
    }

    const summaryHtml = `
        <div class="ppr-section">
            <div class="ppr-section-header">
                <h3 class="ppr-section-title">Last 3 Purchases Summary</h3>
                <p class="ppr-section-sub">Chronological price comparison of the most recent purchase orders</p>
            </div>
            <div class="ppr-summary-strip">
                ${cardsHtml}
                ${placeholdersHtml}
            </div>
        </div>
    `;

    const vendorSections = byVendor.map(v => {
        const initial = (v.vendor_name || "V").charAt(0).toUpperCase();
        return `
            <div class="ppr-vendor-block">
                <div class="ppr-vendor-header">
                    <div class="ppr-vendor-title-wrap">
                        <div class="ppr-vendor-avatar">${escapeHtml(initial)}</div>
                        <span class="ppr-vendor-name">${escapeHtml(v.vendor_name)}</span>
                        ${v.vendor_code ? `<span class="ppr-vendor-code">${escapeHtml(v.vendor_code)}</span>` : ""}
                    </div>
                    <span class="ppr-vendor-count">${v.purchases.length} order${v.purchases.length !== 1 ? "s" : ""}</span>
                </div>
                <div class="table-container">
                    <table class="inquiry-vendor-table">
                        <thead>
                            <tr>
                                <th>PO NUMBER</th>
                                <th>DATE</th>
                                <th>QTY</th>
                                <th>UNIT</th>
                                <th>UNIT RATE</th>
                                <th>TOTAL PRICE</th>
                                <th>STATUS</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${v.purchases.map(p => `
                                <tr>
                                    <td>
                                        <span class="ppr-po-mono">
                                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                                            ${escapeHtml(p.po_number)}
                                        </span>
                                    </td>
                                    <td>${formatDate(p.po_date)}</td>
                                    <td>${p.qty}</td>
                                    <td>${escapeHtml(p.unit || "-")}</td>
                                    <td class="ppr-rate-cell">₹${formatCurrency(p.price_per_unit)}</td>
                                    <td><strong>₹${formatCurrency(p.total_price)}</strong></td>
                                    <td>
                                        <span class="inquiry-status status-${(p.status || "").toLowerCase()}">
                                            ${escapeHtml(p.status || "-")}
                                        </span>
                                    </td>
                                </tr>
                            `).join("")}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    }).join("");

    results.innerHTML = summaryHtml + `
        <div class="ppr-section">
            <div class="ppr-section-header">
                <h3 class="ppr-section-title">Full History by Vendor</h3>
                <p class="ppr-section-sub">All historical purchase orders grouped by vendor</p>
            </div>
            ${vendorSections}
        </div>
    `;
}

// =========================================================
// MANAGEMENT INSIGHTS
// =========================================================

let procurementTrendChart = null;
let prPoTrendChart = null;
let poStatusChart = null;
let insightsRequestId = 0;   // ignore out-of-order responses

const insightsPeriod            = document.getElementById("insightsPeriod");
const insightsCustomRange       = document.getElementById("insightsCustomRange");
const insightsFromDate          = document.getElementById("insightsFromDate");
const insightsToDate            = document.getElementById("insightsToDate");
const applyInsightsDate         = document.getElementById("applyInsightsDate");
const managementInsightsMessage = document.getElementById("managementInsightsMessage");

// ---------------------------------------------------------
// PERIOD SELECT
// ---------------------------------------------------------

if (insightsPeriod) {
    insightsPeriod.addEventListener("change", () => {
        if (insightsPeriod.value === "custom") {
            insightsCustomRange.classList.remove("hidden");
            return;
        }
        insightsCustomRange.classList.add("hidden");
        loadManagementInsights();
    });
}

if (applyInsightsDate) {
    applyInsightsDate.addEventListener("click", () => {
        const from = insightsFromDate.value;
        const to   = insightsToDate.value;

        if (!from || !to) {
            managementInsightsMessage.textContent = "Please select both From and To dates.";
            return;
        }
        if (from > to) {
            managementInsightsMessage.textContent = "From date cannot be greater than To date.";
            return;
        }

        managementInsightsMessage.textContent = "";
        loadManagementInsights();
    });
}

// ---------------------------------------------------------
// LOAD  (fetch and render are separate so errors are labelled correctly)
// ---------------------------------------------------------

async function loadManagementInsights() {
    if (!managementInsightsMessage) return;

    const period = insightsPeriod.value;
    let url = `/management-insights?period=${encodeURIComponent(period)}`;

    if (period === "custom") {
        const from = insightsFromDate.value;
        const to   = insightsToDate.value;

        if (!from || !to) {
            managementInsightsMessage.textContent = "Please select a custom date range.";
            return;
        }

        url += `&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
    }

    const requestId = ++insightsRequestId;
    managementInsightsMessage.textContent = "Loading management insights...";

    let result;

    try {
        const response = await apiFetch(url);
        if (!response) return;
        result = await response.json();

        if (requestId !== insightsRequestId) return;   // a newer request superseded this one

        if (!response.ok || !result.success) {
            resetManagementInsights();
            managementInsightsMessage.textContent = result.message || "Failed to load management insights.";
            return;
        }
    } catch (error) {
        if (requestId !== insightsRequestId) return;
        console.error("Management Insights fetch error:", error);
        resetManagementInsights();
        managementInsightsMessage.textContent = "Failed to connect to procurement service.";
        return;
    }

    try {
        renderManagementInsights(result);
        managementInsightsMessage.textContent = "";
    } catch (error) {
        console.error("Management Insights render error:", error);
        managementInsightsMessage.textContent = "Loaded data but failed to display it. Check the console.";
    }
}

// clear stale numbers / charts when a load fails
function resetManagementInsights() {
    renderManagementInsights({});
}

function formatRupeeLakh(value) {
    const n = Number(value);
    if (isNaN(n) || n === 0) return "₹0";
    const sign = n < 0 ? "-" : "";
    const abs = Math.abs(n);
    return `${sign}₹${abs.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

function renderManagementInsights(data) {
    renderInsightOverview(data);
    renderInsightFinancials(data);
    renderInsightOperational(data);
    renderTopPerformers(data.top_performers || {});
    renderProcurementTrend(data.trends?.daily_procurement || []);
    renderPRPOTrend(data.trends?.monthly_procurement || [], data);
    renderPOStatus(data.po_status || [], data.overview?.total_pos || 0);
}

const setText = (id, text) => {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
};

const formatCount = (n) => Number(n || 0).toLocaleString("en-IN");

// Shows "No data" instead of a blank chart
function setChartEmpty(canvas, isEmpty) {
    const holder = canvas.parentElement;
    let note = holder.querySelector(".chart-empty-note");

    if (isEmpty) {
        if (!note) {
            note = document.createElement("div");
            note.className = "chart-empty-note";
            note.style.cssText = "position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#64748b;font-size:13.5px;font-weight:600;pointer-events:none;background:rgba(255,255,255,0.75);backdrop-filter:blur(3px);border-radius:12px;";
            note.textContent = "No data for this period";
            if (getComputedStyle(holder).position === "static") holder.style.position = "relative";
            holder.appendChild(note);
        }
    } else if (note) {
        note.remove();
    }
}

// "120 nos, 30 kg" from [{unit, <key>}]
function unitBreakdown(rows, key) {
    const parts = (rows || [])
        .filter(r => Number(r[key]) > 0)
        .map(r => `${Number(r[key]).toLocaleString("en-IN")} ${r.unit || ""}`.trim());
    return parts.length ? parts.join(", ") : "0";
}

// ---------------------------------------------------------
// OVERVIEW
// ---------------------------------------------------------

function renderInsightOverview(data) {
    const overview = data.overview || {};
    const totalPRs = Number(data.purchase_requests?.total || 0);
    const totalPOs = Number(overview.total_pos || 0);
    const draftPOs = Number(overview.draft_pos || 0);
    const issuedPOs = Number(overview.issued_pos || 0);
    const completedPOs = Number(overview.completed_pos || 0);
    const cancelledPOs = Number(overview.cancelled_pos || 0);

    // PR and PO pipeline cards
    setText("insightTotalPRs",      formatCount(totalPRs));
    setText("insightTotalPOs",      formatCount(totalPOs));
    setText("insightDraftPOs",      formatCount(draftPOs));
    setText("insightIssuedPOs",     formatCount(issuedPOs));
    setText("insightCompletedPOs",  formatCount(completedPOs));
    setText("insightCancelledPOs",  formatCount(cancelledPOs));
}

// ---------------------------------------------------------
// FINANCIAL
// ---------------------------------------------------------

function renderInsightFinancials(data) {
    const financial = data.financial || {};
    const overview  = data.overview  || {};

    setText("insightSalesValue",       formatRupeeLakh(financial.total_sales_value || 0));
    setText("insightProcurementValue", formatRupeeLakh(financial.total_procurement_value || 0));
    setText("insightGrossProfit",      formatRupeeLakh(financial.gross_profit || 0));
    setText("insightGrossMargin",      `${Number(financial.gross_margin_percentage || 0).toFixed(2)}%`);
    setText("insightAveragePO",        formatRupee(overview.average_po_value || 0));
    setText("insightHighestPO",        formatRupee(overview.highest_po_value || 0));

    // Red for a loss, default otherwise
    const isLoss = Number(financial.gross_profit || 0) < 0;
    ["insightGrossProfit", "insightGrossMargin"].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.color = isLoss ? "#e11d48" : "";
    });
}

// ---------------------------------------------------------
// OPERATIONAL
// ---------------------------------------------------------

function renderInsightOperational(data) {
    const eff = data.efficiency || {};

    const days = (v, digits = 0) => (v === null || v === undefined ? "-" : `${Number(v).toFixed(digits)} days`);

    setText("insightAveragePRPO", days(eff.average_pr_to_po_days, 1));
    setText("insightFastestPRPO", days(eff.fastest_pr_to_po_days));
    setText("insightSlowestPRPO", days(eff.slowest_pr_to_po_days));

    setText("insightGoodsReceived", unitBreakdown(data.goods_received?.by_unit, "received"));
}

// ---------------------------------------------------------
// PROCUREMENT TREND CHART
// ---------------------------------------------------------

function renderProcurementTrend(rows) {
    const canvas = document.getElementById("procurementTrendChart");
    if (!canvas || typeof Chart === "undefined") return;

    if (procurementTrendChart) procurementTrendChart.destroy();

    setChartEmpty(canvas, !rows.length || rows.every(r => !r.sales_value && !r.procurement_value));

    const trendSub = document.getElementById("trendChartSubtitle");
    if (trendSub && insightsPeriod) {
        const selText = insightsPeriod.options[insightsPeriod.selectedIndex]?.text || "current period";
        trendSub.textContent = `Daily performance for ${selText.replace(/\s*\(.*?\)/, "")}`;
    }

    const labels  = rows.map(r => r.day);
    const compact = new Intl.NumberFormat("en-IN", { notation: "compact", maximumFractionDigits: 1 });
    const spansYears = labels.length > 1 && labels[0].slice(0, 4) !== labels[labels.length - 1].slice(0, 4);

    const dayLabel = (iso, full) => {
        const d = new Date(`${iso}T00:00:00`);
        return d.toLocaleDateString("en-IN", {
            day: "2-digit",
            month: "short",
            ...(full || spansYears ? { year: "numeric" } : {})
        });
    };

    const ctx = canvas.getContext("2d");
    const salesGradient = ctx.createLinearGradient(0, 0, 0, 240);
    salesGradient.addColorStop(0, "rgba(37, 99, 235, 0.16)");
    salesGradient.addColorStop(1, "rgba(37, 99, 235, 0.00)");

    procurementTrendChart = new Chart(canvas, {
        type: "line",
        data: {
            labels,
            datasets: [
                {
                    label: "Sales Value",
                    data: rows.map(r => Number(r.sales_value || 0)),
                    borderColor: "#2563eb",
                    backgroundColor: salesGradient,
                    borderWidth: 2.2,
                    pointRadius: 0,
                    pointHoverRadius: 6,
                    pointHoverBackgroundColor: "#2563eb",
                    pointHoverBorderColor: "#ffffff",
                    pointHoverBorderWidth: 2,
                    tension: 0.35,
                    fill: true
                },
                {
                    label: "Procurement Value",
                    data: rows.map(r => Number(r.procurement_value || 0)),
                    borderColor: "#8b5cf6",
                    backgroundColor: "transparent",
                    borderWidth: 2,
                    pointRadius: 0,
                    pointHoverRadius: 5,
                    pointHoverBackgroundColor: "#8b5cf6",
                    pointHoverBorderColor: "#ffffff",
                    pointHoverBorderWidth: 2,
                    tension: 0.35,
                    fill: false
                },
                {
                    label: "Gross Profit",
                    data: rows.map(r => Number(r.gross_profit || 0)),
                    borderColor: "#10b981",
                    backgroundColor: "transparent",
                    borderWidth: 2,
                    pointRadius: 0,
                    pointHoverRadius: 5,
                    pointHoverBackgroundColor: "#10b981",
                    pointHoverBorderColor: "#ffffff",
                    pointHoverBorderWidth: 2,
                    tension: 0.35,
                    fill: false
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: "index", intersect: false },
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: "#0f172a",
                    titleFont: { size: 12, weight: "700" },
                    bodyFont: { size: 12, weight: "500" },
                    padding: 10,
                    cornerRadius: 8,
                    usePointStyle: true,
                    callbacks: {
                        title: items => dayLabel(labels[items[0].dataIndex], true),
                        label: ctx => `  ${ctx.dataset.label}: ${formatRupee(ctx.raw)}`
                    }
                }
            },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: {
                        autoSkip: true,
                        maxTicksLimit: 8,
                        maxRotation: 0,
                        font: { size: 11, weight: "600" },
                        color: "#64748b",
                        callback: function (value) { return dayLabel(this.getLabelForValue(value)); }
                    }
                },
                y: {
                    position: "left",
                    grid: { color: "rgba(226, 232, 240, 0.6)" },
                    ticks: {
                        maxTicksLimit: 5,
                        font: { size: 11, weight: "500" },
                        color: "#64748b",
                        callback: value => (Number(value) < 0 ? "-" : "") + "₹" + compact.format(Math.abs(Number(value)))
                    }
                }
            }
        }
    });

    const legendHolder = document.getElementById("trendChartLegend");
    if (legendHolder) {
        legendHolder.querySelectorAll(".legend-pill").forEach(pill => {
            pill.onclick = () => {
                const idx = Number(pill.getAttribute("data-dataset-index"));
                if (procurementTrendChart && procurementTrendChart.data.datasets[idx]) {
                    const isVisible = procurementTrendChart.isDatasetVisible(idx);
                    procurementTrendChart.setDatasetVisibility(idx, !isVisible);
                    procurementTrendChart.update();
                    pill.classList.toggle("legend-pill-dimmed", isVisible);
                }
            };
        });
    }
}

// ---------------------------------------------------------
// PR VS PO CHART
// ---------------------------------------------------------

function renderPRPOTrend(rows, data) {
    const canvas = document.getElementById("prPoTrendChart");
    if (!canvas || typeof Chart === "undefined") return;

    if (prPoTrendChart) prPoTrendChart.destroy();

    setChartEmpty(canvas, !rows.length);

    // Update bottom conversion rate box
    const totalPRs = Number(data?.purchase_requests?.total || 0);
    const totalPOs = Number(data?.overview?.total_pos || 0);
    const convRate = totalPRs > 0 ? (totalPOs / totalPRs) * 100 : 0;
    setText("conversionRatePercentage", `${convRate.toFixed(1)}%`);
    const pBar = document.getElementById("conversionProgressBar");
    if (pBar) {
        pBar.style.width = `${Math.min(100, Math.max(0, convRate))}%`;
    }

    prPoTrendChart = new Chart(canvas, {
        type: "bar",
        data: {
            labels: rows.map(r => r.month),
            datasets: [
                {
                    label: "Purchase Requests",
                    data: rows.map(r => Number(r.pr_count || 0)),
                    backgroundColor: "#2563eb",
                    borderRadius: 6,
                    borderSkipped: false
                },
                {
                    label: "Purchase Orders",
                    data: rows.map(r => Number(r.po_count || 0)),
                    backgroundColor: "#7c3aed",
                    borderRadius: 6,
                    borderSkipped: false
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: "top",
                    align: "end",
                    labels: {
                        boxWidth: 7,
                        boxHeight: 7,
                        usePointStyle: true,
                        font: { size: 11, weight: "600" },
                        color: "#475569"
                    }
                },
                tooltip: {
                    backgroundColor: "#0f172a",
                    titleFont: { size: 12, weight: "700" },
                    bodyFont: { size: 12, weight: "500" },
                    padding: 10,
                    cornerRadius: 8
                }
            },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: { font: { size: 10.5, weight: "600" }, color: "#64748b" }
                },
                y: {
                    beginAtZero: true,
                    ticks: { precision: 0, font: { size: 10.5 }, color: "#64748b" },
                    grid: { color: "rgba(226, 232, 240, 0.6)" }
                }
            }
        }
    });
}

// ---------------------------------------------------------
// PO STATUS CHART
// ---------------------------------------------------------

function renderPOStatus(rows, totalPOs) {
    const canvas = document.getElementById("poStatusChart");
    if (!canvas || typeof Chart === "undefined") return;

    if (poStatusChart) poStatusChart.destroy();

    setChartEmpty(canvas, !rows.length);

    const totPOs = Number(totalPOs) || rows.reduce((s, r) => s + Number(r.po_count || 0), 0);
    setText("doughnutCenterNumber", formatCount(totPOs));

    const statusColors = {
        "COMPLETED": "#10b981",
        "ISSUED": "#0284c7",
        "DRAFT": "#f59e0b",
        "CANCELLED": "#f43f5e"
    };

    const statusCounts = {};
    rows.forEach(r => {
        const st = String(r.status || "").toUpperCase();
        statusCounts[st] = Number(r.po_count || 0);
    });

    const getStatusStat = (st) => {
        const count = statusCounts[st] || 0;
        const pct = totPOs > 0 ? ((count / totPOs) * 100).toFixed(1) : "0.0";
        return `${formatCount(count)} (${pct}%)`;
    };

    setText("legendCountCompleted", getStatusStat("COMPLETED"));
    setText("legendCountIssued",    getStatusStat("ISSUED"));
    setText("legendCountDraft",     getStatusStat("DRAFT"));
    setText("legendCountCancelled", getStatusStat("CANCELLED"));

    const labels = rows.map(r => String(r.status || "").replace(/_/g, " ").toUpperCase());
    const colors = rows.map(r => statusColors[String(r.status || "").toUpperCase()] || "#64748b");

    poStatusChart = new Chart(canvas, {
        type: "doughnut",
        data: {
            labels: labels,
            datasets: [{
                data: rows.map(r => Number(r.po_count || 0)),
                backgroundColor: colors,
                borderWidth: 2,
                borderColor: "#ffffff"
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: "74%",
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    backgroundColor: "#0f172a",
                    titleFont: { size: 12, weight: "700" },
                    bodyFont: { size: 12, weight: "500" },
                    padding: 10,
                    cornerRadius: 8
                }
            }
        }
    });
}

// ---------------------------------------------------------
// TABLES
// ---------------------------------------------------------

function renderInsightRows(bodyId, rows, colspan, emptyText, rowHtml) {
    const body = document.getElementById(bodyId);
    if (!body) return;

    if (!rows.length) {
        body.innerHTML = `<tr><td colspan="${colspan}" class="table-empty-row">${emptyText}</td></tr>`;
        return;
    }

    body.innerHTML = rows.map(rowHtml).join("");
}

function renderTopPerformers(top) {
    const fill = (nameId, metaId, item, nameText, metaText) => {
        setText(nameId, item ? nameText : "-");
        setText(metaId, item ? metaText : "No orders in this period");
    };

    const meta = item => `${formatCount(item.po_count)} PO${item.po_count === 1 ? "" : "s"} · ${formatRupeeLakh(item.procurement_value)}`;

    fill("insightTopMake", "insightTopMakeMeta", top.make,
        top.make?.name, top.make && meta(top.make));

    fill("insightTopModel", "insightTopModelMeta", top.model,
        top.model?.name,
        top.model && `${top.model.make ? top.model.make + " · " : ""}${meta(top.model)}`);

    fill("insightTopVendor", "insightTopVendorMeta", top.vendor,
        top.vendor && (top.vendor.code ? `${top.vendor.name} (${top.vendor.code})` : top.vendor.name),
        top.vendor && meta(top.vendor));
}


// ─── Reports & Audits ──────────────────────────────────────────────────────

function switchLogTab(tab) {
    activeLogTab = tab;

    reportLogsTabButton?.classList.toggle("active", tab === "report");
    auditLogsTabButton?.classList.toggle("active", tab === "audit");
    loginLogsTabButton?.classList.toggle("active", tab === "login");

    reportLogsSection?.classList.toggle("hidden", tab !== "report");
    auditLogsSection?.classList.toggle("hidden", tab !== "audit");
    loginLogsSection?.classList.toggle("hidden", tab !== "login");

    logsPage = 1;
    loadLogs();
}

reportLogsTabButton?.addEventListener("click", () => {
    if (activeLogTab === "report") return;
    switchLogTab("report");
});

auditLogsTabButton?.addEventListener("click", () => {
    if (activeLogTab === "audit") return;
    switchLogTab("audit");
});

loginLogsTabButton?.addEventListener("click", () => {
    if (activeLogTab === "login") return;
    switchLogTab("login");
});

applyLogFilters?.addEventListener("click", () => {
    logsPage = 1;
    loadLogs();
});

logsPrev?.addEventListener("click", () => {
    if (logsPage > 1) {
        logsPage -= 1;
        loadLogs();
    }
});

logsNext?.addEventListener("click", () => {
    if (logsPage < logsTotalPages) {
        logsPage += 1;
        loadLogs();
    }
});

async function loadLogs() {
    logsMessage.textContent = "Loading...";
    logsPrev.disabled = true;
    logsNext.disabled = true;

    const endpoint = activeLogTab === "report" ? "/report-logs" : activeLogTab === "audit" ? "/audit-logs" : "/login-logs";

    const params = new URLSearchParams({ page: logsPage, limit: 25 });
    if (logUsernameFilter.value.trim()) params.set("username", logUsernameFilter.value.trim());
    if (logFromDate.value)              params.set("from", logFromDate.value);
    if (logToDate.value)                params.set("to", logToDate.value);

    try {
        const response = await apiFetch(`${endpoint}?${params.toString()}`);
        if (!response) return;
        const result   = await response.json();

        if (!response.ok || !result.success) {
            logsMessage.textContent = result.message || "Failed to load logs";
            return;
        }

        logsMessage.textContent = "";

        if (activeLogTab === "report") {
            renderReportLogs(result.rows || []);
        } else if (activeLogTab === "audit") {
            renderAuditLogs(result.rows || []);
        } else {
            renderLoginLogs(result.rows || []);
        }

        const { page, total_pages, has_prev, has_next } = result.pagination;
        logsPage       = page;
        logsTotalPages = total_pages;

        logsPageLabel.textContent = `Page ${page} of ${total_pages}`;
        logsPrev.disabled = !has_prev;
        logsNext.disabled = !has_next;

    } catch {
        logsMessage.textContent = "Failed to connect to procurement service";
    }
}

/* ─── Reports & Audits Formatters ────────────────────────── */

const LOG_ACTION_META = {
    // Vendor actions
    "VENDOR_DELETED": {
        label: "Vendor Deleted",
        badgeClass: "log-badge-danger",
        narrative: (user, oldObj) => {
            const vName = oldObj?.vendor_name || "";
            const vCode = oldObj?.vendor_code || (oldObj?.vendor_id ? "ID #" + oldObj.vendor_id : "");
            const details = [vCode, vName].filter(Boolean).join(" - ");
            return (user || "Admin") + " deleted this vendor" + (details ? " (" + details + ")" : "");
        }
    },
    "VENDOR_CREATED": {
        label: "Vendor Added",
        badgeClass: "log-badge-success",
        narrative: (user) => (user || "Admin") + " registered a new vendor"
    },
    "VENDOR_IMPORTED": {
        label: "Vendor Imported",
        badgeClass: "log-badge-info",
        narrative: (user) => (user || "Admin") + " imported vendor from Excel"
    },
    "VENDOR_UPDATED": {
        label: "Vendor Updated",
        badgeClass: "log-badge-info",
        narrative: (user) => (user || "Admin") + " updated vendor details"
    },
    "VENDOR_BANK_UPDATED": {
        label: "Bank Details Updated",
        badgeClass: "log-badge-warning",
        narrative: (user) => (user || "Admin") + " updated vendor bank & legal details"
    },
    "VENDOR_BLACKLISTED": {
        label: "Vendor Blacklisted",
        badgeClass: "log-badge-danger",
        narrative: (user) => (user || "Admin") + " blacklisted vendor"
    },
    "VENDOR_UNBLACKLISTED": {
        label: "Vendor Whitelisted",
        badgeClass: "log-badge-success",
        narrative: (user) => (user || "Admin") + " restored vendor from blacklist"
    },
    "VENDOR_SELECTED": {
        label: "Vendor Finalized",
        badgeClass: "log-badge-purple",
        narrative: (user) => (user || "Admin") + " selected winning vendor quotation"
    },
    "VENDOR_QUOTATION_ADDED": {
        label: "Quotation Added",
        badgeClass: "log-badge-primary",
        narrative: (user) => (user || "Admin") + " added vendor quotation"
    },
    "VENDOR_INQUIRY_CREATED": {
        label: "Inquiry Created",
        badgeClass: "log-badge-primary",
        narrative: (user) => (user || "Admin") + " created vendor inquiry"
    },

    // Purchase Order & Goods actions
    "PO_COMPLETED": {
        label: "PO Completed",
        badgeClass: "log-badge-success",
        narrative: (user) => (user || "Admin") + " marked purchase order as completed"
    },
    "GOODS_RECEIVED": {
        label: "Goods Received",
        badgeClass: "log-badge-info",
        narrative: (user) => (user || "Admin") + " recorded goods receipt"
    },
    "GOODS_RETURNED": {
        label: "Goods Returned",
        badgeClass: "log-badge-warning",
        narrative: (user) => (user || "Admin") + " recorded goods return"
    },
    "PO_ISSUED": {
        label: "PO Issued",
        badgeClass: "log-badge-primary",
        narrative: (user) => (user || "Admin") + " issued purchase order to vendor"
    },
    "PO_CREATED": {
        label: "Draft PO Created",
        badgeClass: "log-badge-neutral",
        narrative: (user) => (user || "Admin") + " generated draft purchase order"
    },
    "PO_RESELECT": {
        label: "PO Reselection",
        badgeClass: "log-badge-warning",
        narrative: (user) => (user || "Admin") + " initiated vendor re-selection"
    },
    "INQUIRY_CANCELLED": {
        label: "Inquiry Cancelled",
        badgeClass: "log-badge-danger",
        narrative: (user) => (user || "Admin") + " cancelled inquiry"
    },
    "REQUIREMENT_CANCELLED": {
        label: "Requirement Cancelled",
        badgeClass: "log-badge-danger",
        narrative: (user) => (user || "Admin") + " cancelled requirement"
    },

    // PR actions
    "PR_CREATED": {
        label: "PR Created",
        badgeClass: "log-badge-primary",
        narrative: (user) => (user || "Admin") + " created purchase requisition"
    },
    "PR_UPDATED": {
        label: "PR Updated",
        badgeClass: "log-badge-info",
        narrative: (user) => (user || "Admin") + " updated purchase requisition"
    },
    "PR_EXCEL_IMPORTED": {
        label: "Excel PRs Imported",
        badgeClass: "log-badge-info",
        narrative: (user) => (user || "Admin") + " bulk-imported PRs via Excel"
    },

    // User management actions
    "USER_CREATED": {
        label: "User Created",
        badgeClass: "log-badge-success",
        narrative: (user, oldObj, newObj) => {
            const u = newObj?.username || "";
            return (user || "Admin") + " created new user account" + (u ? ' "' + u + '"' : "");
        }
    },
    "USER_PASSWORD_CHANGED": {
        label: "Password Reset",
        badgeClass: "log-badge-warning",
        narrative: (user, oldObj, newObj) => {
            const u = newObj?.username || oldObj?.username || "";
            return (user || "Admin") + " changed password for user" + (u ? ' "' + u + '"' : "");
        }
    },
    "USER_ACCESS_REVOKED": {
        label: "Access Revoked",
        badgeClass: "log-badge-danger",
        narrative: (user, oldObj, newObj) => {
            const u = newObj?.username || oldObj?.username || "";
            return (user || "Admin") + " deactivated account" + (u ? ' for "' + u + '"' : "");
        }
    },
    "USER_ACCESS_GRANTED": {
        label: "Access Granted",
        badgeClass: "log-badge-success",
        narrative: (user, oldObj, newObj) => {
            const u = newObj?.username || oldObj?.username || "";
            return (user || "Admin") + " activated account" + (u ? ' for "' + u + '"' : "");
        }
    },
    "USER_DELETED": {
        label: "User Deleted",
        badgeClass: "log-badge-danger",
        narrative: (user, oldObj) => {
            const u = oldObj?.username || "";
            return (user || "Admin") + " deleted user account" + (u ? ' "' + u + '"' : "");
        }
    }
};

const AUDIT_FIELD_LABELS = {
    vendor_name: "Vendor Name",
    vendor_code: "Vendor Code / Number",
    vendor_id: "Vendor ID",
    legal_entity: "Legal Entity",
    commercial_role: "Commercial Role",
    year_of_incorporation: "Year of Incorporation",
    director_or_ceo_or_management_name: "Director / CEO Name",
    director_or_ceo_or_management_designation: "Director Designation",
    director_or_ceo_or_management_mobile_no: "Director Mobile",
    director_or_ceo_or_management_email: "Director Email",
    director_or_ceo_or_management_web_address: "Website",
    sales_team_name: "Sales Contact Name",
    sales_team_contact: "Sales Contact Phone",
    sales_team_email: "Sales Email",
    accounts_team_name: "Accounts Contact Name",
    accounts_team_contact: "Accounts Contact Phone",
    accounts_team_email: "Accounts Email",
    office_address: "Office Address",
    office_contact_name: "Office Contact Person",
    office_contact_number: "Office Phone",
    factory_address: "Factory Address",
    factory_contact_name: "Factory Contact Person",
    factory_contact_number: "Factory Phone",
    warehouse_address: "Warehouse Address",
    warehouse_contact_name: "Warehouse Contact Person",
    warehouse_contact_number: "Warehouse Phone",
    workshop_address: "Workshop Address",
    workshop_contact_name: "Workshop Contact Person",
    workshop_contact_number: "Workshop Phone",
    gst_number: "GST Number",
    pan_number: "PAN Number",
    msme_number: "MSME / Udyam Number",
    turnover_year_1: "Turnover Year 1",
    turnover_value_1: "Turnover Value 1",
    turnover_year_2: "Turnover Year 2",
    turnover_value_2: "Turnover Value 2",
    turnover_year_3: "Turnover Year 3",
    turnover_value_3: "Turnover Value 3",
    bank_name: "Bank Name",
    bank_account_no: "Bank Account Number",
    bank_branch: "Bank Branch",
    bank_account_type: "Account Type",
    bank_ifsc: "Bank IFSC Code",
    recommended_by: "Recommended By",
    approved_by: "Approved By",
    is_blacklisted: "Blacklisted",
    registration_date: "Registration Date",
    username: "Username",
    role: "User Role",
    is_active: "Account Status",
    password_hash: "Password",
    pr_number: "PR Number",
    pr_date: "PR Date",
    item_name: "Item Name",
    product_category: "Product Category",
    make: "Make / Brand",
    model: "Model",
    qty: "Quantity",
    unit: "Unit",
    sales_rate: "Sales Rate",
    taxable_value: "Taxable Value",
    party_name: "Party Name",
    location: "Location",
    territory: "Territory",
    product_remarks: "Remarks"
};

function tryParseJson(str) {
    if (!str || typeof str !== "string") return null;
    const trimmed = str.trim();
    if (!((trimmed.startsWith("{") && trimmed.endsWith("}")) || (trimmed.startsWith("[") && trimmed.endsWith("]")))) {
        return null;
    }
    try {
        return JSON.parse(str);
    } catch {
        return null;
    }
}

function formatAuditFieldValue(key, val) {
    if (val === null || val === undefined || val === "") return `<span class="audit-empty-val">— None</span>`;
    if (typeof val === "boolean") {
        return val ? `<span class="audit-pill-success">Active / Yes</span>` : `<span class="audit-pill-danger">Inactive / No</span>`;
    }
    if (key === "is_active") {
        return val ? `<span class="audit-pill-success">Active</span>` : `<span class="audit-pill-danger">Disabled</span>`;
    }
    if (key === "is_blacklisted") {
        return Number(val) === 1 ? `<span class="audit-pill-danger">Blacklisted</span>` : `<span class="audit-pill-success">Not Blacklisted</span>`;
    }
    if (key === "password_hash") {
        return `<span class="audit-pill-warning">Encrypted</span>`;
    }
    if (key.includes("date") && typeof val === "string" && val.includes("T")) {
        return escapeHtml(val.split("T")[0]);
    }
    if ((key.includes("rate") || key.includes("taxable_value") || key.includes("turnover_value")) && !isNaN(Number(val))) {
        return "₹" + Number(val).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    return escapeHtml(String(val));
}

function formatAuditAction(action, username, oldObj, newObj) {
    const meta = LOG_ACTION_META[action] || {
        label: (action || "").replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()),
        badgeClass: "log-badge-neutral",
        narrative: (u) => (u || "Admin") + " performed " + action
    };

    const narrativeText = meta.narrative ? meta.narrative(username, oldObj, newObj) : "";

    return `
        <div class="log-action-wrap">
            <span class="log-badge ${meta.badgeClass}">${escapeHtml(meta.label)}</span>
            ${narrativeText ? `<div class="log-action-subtext">${escapeHtml(narrativeText)}</div>` : ""}
        </div>
    `;
}

function formatAuditCell(rawVal, side, action, username, oldObj, newObj) {
    if (!rawVal || rawVal === "-" || rawVal === "null") {
        if (side === "old") {
            return `<div class="audit-muted-box">— None (New Entry)</div>`;
        } else {
            if (action === "VENDOR_DELETED") {
                return `
                    <div class="audit-deleted-state">
                        <span class="audit-pill-danger">Removed</span>
                        <span>Vendor permanently deleted from system</span>
                    </div>
                `;
            }
            if (action === "USER_DELETED") {
                return `
                    <div class="audit-deleted-state">
                        <span class="audit-pill-danger">Deleted</span>
                        <span>User account deleted & purged</span>
                    </div>
                `;
            }
            return `<div class="audit-muted-box">— None (Record Removed)</div>`;
        }
    }

    const obj = tryParseJson(rawVal);
    if (!obj || typeof obj !== "object") {
        return `<div class="audit-plain-text">${escapeHtml(String(rawVal))}</div>`;
    }

    // Special handling for VENDOR_DELETED
    if (action === "VENDOR_DELETED" && side === "old") {
        const vCode = obj.vendor_code || (obj.vendor_id ? "ID #" + obj.vendor_id : "");
        return `
            <div class="audit-card audit-card-danger">
                <div class="audit-card-header">
                    <span class="audit-card-title">${escapeHtml(obj.vendor_name || "Deleted Vendor")}</span>
                    ${vCode ? `<span class="audit-card-code">${escapeHtml(vCode)}</span>` : ""}
                </div>
                <div class="audit-card-body">
                    ${obj.legal_entity ? `<div class="audit-field"><span class="audit-label">Entity:</span><span class="audit-val">${escapeHtml(obj.legal_entity)}</span></div>` : ""}
                    ${obj.commercial_role ? `<div class="audit-field"><span class="audit-label">Role:</span><span class="audit-val">${escapeHtml(obj.commercial_role)}</span></div>` : ""}
                    ${obj.director_or_ceo_or_management_name ? `<div class="audit-field"><span class="audit-label">Director:</span><span class="audit-val">${escapeHtml(obj.director_or_ceo_or_management_name)}${obj.director_or_ceo_or_management_mobile_no ? " (" + escapeHtml(obj.director_or_ceo_or_management_mobile_no) + ")" : ""}</span></div>` : ""}
                    ${obj.office_address ? `<div class="audit-field"><span class="audit-label">Address:</span><span class="audit-val">${escapeHtml(obj.office_address)}</span></div>` : ""}
                    ${obj.gst_number ? `<div class="audit-field"><span class="audit-label">GST / PAN:</span><span class="audit-val">${escapeHtml(obj.gst_number)}${obj.pan_number ? " / " + escapeHtml(obj.pan_number) : ""}</span></div>` : ""}
                    ${obj.bank_name ? `<div class="audit-field"><span class="audit-label">Bank:</span><span class="audit-val">${escapeHtml(obj.bank_name)} (A/C: ${escapeHtml(obj.bank_account_no || "")}, IFSC: ${escapeHtml(obj.bank_ifsc || "")})</span></div>` : ""}
                </div>
                <details class="audit-raw-details">
                    <summary>View raw JSON</summary>
                    <pre>${escapeHtml(JSON.stringify(obj, null, 2))}</pre>
                </details>
            </div>
        `;
    }

    // Special handling for USER_CREATED
    if (action === "USER_CREATED" && side === "new") {
        return `
            <div class="audit-card audit-card-success">
                <div class="audit-card-header">
                    <span class="audit-card-title">User: ${escapeHtml(obj.username || "")}</span>
                    <span class="audit-pill-success">Active</span>
                </div>
                <div class="audit-card-body">
                    <div class="audit-field"><span class="audit-label">Role:</span><span class="audit-val"><strong>${escapeHtml(obj.role || "")}</strong></span></div>
                    <div class="audit-field"><span class="audit-label">User ID:</span><span class="audit-val">#${escapeHtml(String(obj.user_id || ""))}</span></div>
                </div>
            </div>
        `;
    }

    // Special handling for USER_DELETED
    if (action === "USER_DELETED" && side === "old") {
        return `
            <div class="audit-card audit-card-danger">
                <div class="audit-card-header">
                    <span class="audit-card-title">User: ${escapeHtml(obj.username || "")}</span>
                    <span class="audit-pill-danger">Deleted</span>
                </div>
                <div class="audit-card-body">
                    <div class="audit-field"><span class="audit-label">Role:</span><span class="audit-val">${escapeHtml(obj.role || "")}</span></div>
                    <div class="audit-field"><span class="audit-label">User ID:</span><span class="audit-val">#${escapeHtml(String(obj.user_id || ""))}</span></div>
                    <div class="audit-field"><span class="audit-label">Status Before:</span><span class="audit-val">${obj.is_active ? "Active" : "Inactive"}</span></div>
                </div>
            </div>
        `;
    }

    // Special handling for USER_PASSWORD_CHANGED
    if (action === "USER_PASSWORD_CHANGED") {
        if (side === "old") {
            return `
                <div class="audit-state-info">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                    <span>Previous encrypted password</span>
                </div>
            `;
        } else {
            return `
                <div class="audit-state-info">
                    <span class="audit-pill-warning">Password Reset</span>
                    <span>New password saved & encrypted</span>
                </div>
            `;
        }
    }

    // Special handling for USER_ACCESS_REVOKED
    if (action === "USER_ACCESS_REVOKED") {
        if (side === "old") {
            return `<div class="audit-field"><span class="audit-label">Status Before:</span> <span class="audit-pill-success">Active</span></div>`;
        } else {
            return `
                <div class="audit-state-revoked">
                    <span class="audit-pill-danger">Access Revoked</span>
                    <span>Account deactivated (cannot log in)</span>
                </div>
            `;
        }
    }

    // Special handling for USER_ACCESS_GRANTED
    if (action === "USER_ACCESS_GRANTED") {
        if (side === "old") {
            return `<div class="audit-field"><span class="audit-label">Status Before:</span> <span class="audit-pill-danger">Inactive</span></div>`;
        } else {
            return `
                <div class="audit-state-granted">
                    <span class="audit-pill-success">Access Granted</span>
                    <span>Account activated (login enabled)</span>
                </div>
            `;
        }
    }

    // General object or diff
    const entries = Object.entries(obj).filter(([k]) => !["created_at", "updated_at"].includes(k));
    if (!entries.length) {
        return `<div class="audit-muted-box">— No modified fields</div>`;
    }

    const fieldRows = entries.map(([key, val]) => {
        const label = AUDIT_FIELD_LABELS[key] || key.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
        const formattedVal = formatAuditFieldValue(key, val);
        const diffClass = side === "old" ? "audit-diff-old-val" : "audit-diff-new-val";
        return `
            <div class="audit-diff-item">
                <span class="audit-diff-label">${escapeHtml(label)}:</span>
                <span class="${diffClass}">${formattedVal}</span>
            </div>
        `;
    }).join("");

    return `
        <div class="audit-card ${side === 'old' ? 'audit-card-old' : 'audit-card-new'}">
            <div class="audit-card-body">
                ${fieldRows}
            </div>
            <details class="audit-raw-details">
                <summary>View raw JSON</summary>
                <pre>${escapeHtml(JSON.stringify(obj, null, 2))}</pre>
            </details>
        </div>
    `;
}

function formatReportText(row) {
    const raw = row.report || "";
    const user = row.username || "Admin";

    // Specialize VENDOR_DELETED
    if (row.action === "VENDOR_DELETED") {
        const match = raw.match(/Vendor "([^"]+)" \(([^,]+),\s*vendor ID (\d+)\) was deleted/i) ||
                      raw.match(/(?:Admin|admin|[A-Za-z0-9_]+) deleted vendor "([^"]+)" \(Vendor (?:Code|Number): ([^,]+),\s*ID: (\d+)\)/i);
        if (match) {
            const vName = match[1];
            const vCode = match[2];
            return `
                <div class="activity-report-lead">
                    <span class="activity-actor">${escapeHtml(user)}</span> deleted vendor
                    <strong class="report-entity">"${escapeHtml(vName)}"</strong>
                    <span class="report-meta">(Vendor Number: <span class="report-code-badge">${escapeHtml(vCode)}</span>)</span>
                </div>
            `;
        }
        return `
            <div class="activity-report-lead">
                <span class="activity-actor">${escapeHtml(user)}</span> deleted vendor: ${escapeHtml(raw)}
            </div>
        `;
    }

    // Specialize USER_DELETED
    if (row.action === "USER_DELETED") {
        const match = raw.match(/User deleted\. Username: "([^"]+)", Role: ([^,]+), User ID: (\d+)\./i) ||
                      raw.match(/(?:Admin|admin|[A-Za-z0-9_]+) deleted user account "([^"]+)" \(Role: ([^,]+),\s*ID: (\d+)\)/i);
        if (match) {
            return `
                <div class="activity-report-lead">
                    <span class="activity-actor">${escapeHtml(user)}</span> deleted user account
                    <strong class="report-entity">"${escapeHtml(match[1])}"</strong>
                    <span class="report-meta">(Role: <strong>${escapeHtml(match[2])}</strong>, ID: #${escapeHtml(match[3])})</span>
                </div>
            `;
        }
    }

    // Specialize USER_CREATED
    if (row.action === "USER_CREATED") {
        const match = raw.match(/New user created\. Username: "([^"]+)", Role: ([^,]+), User ID: (\d+)\./i);
        if (match) {
            return `
                <div class="activity-report-lead">
                    <span class="activity-actor">${escapeHtml(user)}</span> created user account
                    <strong class="report-entity">"${escapeHtml(match[1])}"</strong>
                    <span class="report-meta">(Role: <strong>${escapeHtml(match[2])}</strong>, ID: #${escapeHtml(match[3])})</span>
                </div>
            `;
        }
    }

    // Specialize USER_PASSWORD_CHANGED
    if (row.action === "USER_PASSWORD_CHANGED") {
        const match = raw.match(/Password changed for user ID (\d+)\. Username: "([^"]+)", Role: ([^.]+)\./i);
        if (match) {
            return `
                <div class="activity-report-lead">
                    <span class="activity-actor">${escapeHtml(user)}</span> reset password for user
                    <strong class="report-entity">"${escapeHtml(match[2])}"</strong>
                    <span class="report-meta">(Role: <strong>${escapeHtml(match[3])}</strong>)</span>
                </div>
            `;
        }
    }

    // Specialize USER_ACCESS_REVOKED / USER_ACCESS_GRANTED
    if (row.action === "USER_ACCESS_REVOKED" || row.action === "USER_ACCESS_GRANTED") {
        const match = raw.match(/User access changed\. User ID: (\d+), Username: "([^"]+)", Role: ([^,]+)/i);
        const isRevoked = row.action === "USER_ACCESS_REVOKED";
        if (match) {
            return `
                <div class="activity-report-lead">
                    <span class="activity-actor">${escapeHtml(user)}</span> ${isRevoked ? "revoked access for" : "granted access to"} user
                    <strong class="report-entity">"${escapeHtml(match[2])}"</strong>
                    <span class="report-meta">(${isRevoked ? '<span class="status-text-danger">Deactivated</span>' : '<span class="status-text-success">Activated</span>'})</span>
                </div>
            `;
        }
    }

    // General procurement report formatting
    let formatted = escapeHtml(raw);

    // Highlight quoted vendor or entity names
    formatted = formatted.replace(/"([^"]+)"/g, '<strong class="report-entity">"$1"</strong>');

    // Highlight PO and PR numbers
    formatted = formatted.replace(/\b(NEE\/[\w\-\/]+)\b/g, '<span class="report-ref-badge">$1</span>');

    // Highlight vendor codes
    formatted = formatted.replace(/\b((?:NEE2627V|DEL_)\w+)\b/g, '<span class="report-code-badge">$1</span>');

    // Highlight money amounts
    formatted = formatted.replace(/(PO value:\s*)([\d,]+\.\d{2})/g, '$1<strong class="report-amount">₹$2</strong>');
    formatted = formatted.replace(/(sales rate\s*)([\d,]+\.\d{2})/g, '$1<strong class="report-amount">₹$2</strong>');
    formatted = formatted.replace(/(taxable value\s*)([\d,]+\.\d{2})/g, '$1<strong class="report-amount">₹$2</strong>');

    // Highlight status transitions
    formatted = formatted.replace(/\b(COMPLETED|ISSUED|DRAFT|VENDOR_SELECTED|OPEN|CANCELLED)\b/g, '<span class="report-status-pill">$1</span>');

    return `<div class="activity-report-text">${formatted}</div>`;
}

function renderReportLogs(rows) {
    if (!rows.length) {
        reportLogsBody.innerHTML = `<tr class="logs-empty-row"><td colspan="4">No report logs found</td></tr>`;
        return;
    }

    reportLogsBody.innerHTML = rows.map(row => {
        const meta = LOG_ACTION_META[row.action] || {
            label: (row.action || "").replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()),
            badgeClass: "log-badge-neutral"
        };

        return `
            <tr>
                <td style="white-space: nowrap; font-size: 12.5px; color: #64748b;">${formatDateTime(row.log_timestamp)}</td>
                <td>
                    <div class="user-pill">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                        <span>${escapeHtml(row.username || "System")}</span>
                    </div>
                </td>
                <td>
                    <span class="log-badge ${meta.badgeClass}">${escapeHtml(meta.label)}</span>
                </td>
                <td class="logs-report-cell">${formatReportText(row)}</td>
            </tr>
        `;
    }).join("");
}

function renderAuditLogs(rows) {
    if (!rows.length) {
        auditLogsBody.innerHTML = `<tr class="logs-empty-row"><td colspan="5">No audit logs found</td></tr>`;
        return;
    }

    auditLogsBody.innerHTML = rows.map(row => {
        const oldObj = tryParseJson(row.old_value);
        const newObj = tryParseJson(row.new_value);

        return `
            <tr>
                <td style="white-space: nowrap; font-size: 12.5px; color: #64748b; vertical-align: top; padding-top: 14px;">${formatDateTime(row.log_timestamp)}</td>
                <td style="vertical-align: top; padding-top: 14px;">
                    <div class="user-pill">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                        <span>${escapeHtml(row.username || "System")}</span>
                    </div>
                </td>
                <td style="vertical-align: top; padding-top: 14px;">
                    ${formatAuditAction(row.action, row.username, oldObj, newObj)}
                </td>
                <td class="logs-value-cell audit-old-cell">${formatAuditCell(row.old_value, "old", row.action, row.username, oldObj, newObj)}</td>
                <td class="logs-value-cell audit-new-cell">${formatAuditCell(row.new_value, "new", row.action, row.username, oldObj, newObj)}</td>
            </tr>
        `;
    }).join("");
}

function renderLoginLogs(rows) {
    if (!rows.length) {
        loginLogsBody.innerHTML = `<tr class="logs-empty-row"><td colspan="3">No access logs found</td></tr>`;
        return;
    }

    loginLogsBody.innerHTML = rows.map(row => `
        <tr>
            <td style="white-space: nowrap; font-size: 12.5px; color: #64748b;">${formatDateTime(row.login_time)}</td>
            <td>
                <div class="user-pill">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                    <span>${escapeHtml(row.username || "System")}</span>
                </div>
            </td>
            <td>
                <span class="${row.login_status === "SUCCESS" ? "access-granted" : "access-revoked"}">
                    ${escapeHtml(row.login_status)}
                </span>
            </td>
        </tr>
    `).join("");
}

// ─── Edit Vendor ───────────────────────────────────────────────────────────────

let editVendorList   = [];   // full vendor list for search
let editVendorId     = null; // currently loaded vendor

const EDIT_VENDOR_FIELDS = [
    "vendor_name", "commercial_role",
    "gst_number", "pan_number", "msme_number", "year_of_incorporation",
    "director_or_ceo_or_management_name", "director_or_ceo_or_management_designation",
    "director_or_ceo_or_management_mobile_no", "director_or_ceo_or_management_email",
    "director_or_ceo_or_management_web_address",
    "sales_team_name", "sales_team_contact", "sales_team_email",
    "accounts_team_name", "accounts_team_contact", "accounts_team_email",
    "office_address", "office_contact_name", "office_contact_number",
    "factory_address", "factory_contact_name", "factory_contact_number",
    "warehouse_address", "warehouse_contact_name", "warehouse_contact_number",
    "workshop_address", "workshop_contact_name", "workshop_contact_number",
    "branch_office_1_address", "branch_office_1_contact_name", "branch_office_1_contact_number",
    "branch_office_2_address", "branch_office_2_contact_name", "branch_office_2_contact_number",
    "branch_office_3_address", "branch_office_3_contact_name", "branch_office_3_contact_number",
    "turnover_year_1", "turnover_value_1", "turnover_year_2", "turnover_value_2",
    "turnover_year_3", "turnover_value_3",
    "recommended_by", "approved_by"
];

const EDIT_BANK_FIELDS = [
    "legal_entity", "bank_name", "bank_account_no",
    "bank_branch", "bank_account_type", "bank_ifsc"
];

const EDIT_READONLY_FIELDS = [
    "vendor_code", "registration_date"
];

async function initEditVendor() {
    const listView = document.getElementById("editVendorListView");
    const formContainer = document.getElementById("editVendorFormContainer");
    const formEl = document.getElementById("editVendorForm");
    
    if (listView) listView.classList.remove("hidden");
    if (formContainer) formContainer.classList.add("hidden");
    if (formEl) formEl.classList.add("hidden");

    document.getElementById("editVendorMessage").textContent = "";
    document.getElementById("editVendorBankMessage").textContent = "";
    editVendorId = null;

    const searchInput = document.getElementById("evSearchInput");
    const roleFilter = document.getElementById("evRoleFilter");
    const entityFilter = document.getElementById("evEntityFilter");
    if (searchInput) searchInput.value = "";
    if (roleFilter) roleFilter.value = "";
    if (entityFilter) entityFilter.value = "";

    await loadVendorsForDirectory();
}

function sortVendorsSerialWise(list) {
    if (!Array.isArray(list)) return [];
    return list.slice().sort((a, b) => {
        const codeA = String(a.vendor_code || "").trim().toUpperCase();
        const codeB = String(b.vendor_code || "").trim().toUpperCase();
        const matchA = codeA.match(/V(\d+)$/i);
        const matchB = codeB.match(/V(\d+)$/i);
        if (matchA && matchB) {
            const numA = parseInt(matchA[1], 10);
            const numB = parseInt(matchB[1], 10);
            if (numA !== numB) return numA - numB;
        }
        const idA = Number(a.vendor_id) || 0;
        const idB = Number(b.vendor_id) || 0;
        if (idA !== idB) return idA - idB;
        return codeA.localeCompare(codeB, undefined, { numeric: true, sensitivity: 'base' });
    });
}

async function loadVendorsForDirectory() {
    const tableBody = document.getElementById("evVendorTableBody");
    if (tableBody) {
        tableBody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding:32px; color:#64748b;">Loading vendors...</td></tr>';
    }

    try {
        const response = await apiFetch("/vendors/all");
        if (!response) return;
        const result = await response.json();

        if (!result.success) {
            if (tableBody) {
                tableBody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding:32px; color:#dc2626;">Failed to load vendors</td></tr>';
            }
            return;
        }

        editVendorList = sortVendorsSerialWise(result.vendors || []);

        // Populate quick switch dropdown
        const select = document.getElementById("editVendorSelect");
        if (select) {
            select.innerHTML = '<option value="">-- Select a vendor --</option>';
            editVendorList.forEach(v => {
                const option = document.createElement("option");
                option.value = v.vendor_id;
                option.textContent = `${v.vendor_code ? `${v.vendor_code} - ` : ""}${v.vendor_name}`;
                select.appendChild(option);
            });
        }

        // Populate dynamic filter options
        populateVendorFilterOptions();

        // Render table with filters applied
        applyVendorFilters();

    } catch (err) {
        if (tableBody) {
            tableBody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding:32px; color:#dc2626;">Failed to connect to server</td></tr>';
        }
    }
}

function populateVendorFilterOptions() {
    const roleSelect = document.getElementById("evRoleFilter");
    const entitySelect = document.getElementById("evEntityFilter");

    const currentRole = roleSelect ? roleSelect.value : "";
    const currentEntity = entitySelect ? entitySelect.value : "";

    if (roleSelect) {
        const roles = Array.from(new Set(editVendorList.map(v => (v.commercial_role || "").trim()).filter(Boolean))).sort();
        roleSelect.innerHTML = '<option value="">All Commercial Roles</option>';
        roles.forEach(r => {
            const opt = document.createElement("option");
            opt.value = r;
            opt.textContent = r;
            if (r === currentRole) opt.selected = true;
            roleSelect.appendChild(opt);
        });
    }

    if (entitySelect) {
        const entities = Array.from(new Set(editVendorList.map(v => (v.legal_entity || "").trim()).filter(Boolean))).sort();
        entitySelect.innerHTML = '<option value="">All Legal Entities</option>';
        entities.forEach(e => {
            const opt = document.createElement("option");
            opt.value = e;
            opt.textContent = e;
            if (e === currentEntity) opt.selected = true;
            entitySelect.appendChild(opt);
        });
    }
}

function applyVendorFilters(resetPage = true) {
    const searchInput = document.getElementById("evSearchInput");
    const roleSelect = document.getElementById("evRoleFilter");
    const entitySelect = document.getElementById("evEntityFilter");
    const clearBtn = document.getElementById("evSearchClearBtn");
    const resultsCountEl = document.getElementById("evResultsCount");
    const totalBadgeEl = document.getElementById("evTotalVendorsBadge");

    const query = (searchInput?.value || "").trim().toLowerCase();
    const role = (roleSelect?.value || "").trim();
    const entity = (entitySelect?.value || "").trim();

    if (clearBtn) {
        clearBtn.classList.toggle("hidden", query.length === 0);
    }

    const filtered = editVendorList.filter(v => {
        if (role && (v.commercial_role || "").trim() !== role) return false;
        if (entity && (v.legal_entity || "").trim() !== entity) return false;
        if (query) {
            const searchFields = [
                v.vendor_name,
                v.vendor_code,
                v.office_contact_name,
                v.office_contact_number,
                v.director_or_ceo_or_management_name,
                v.director_or_ceo_or_management_mobile_no,
                v.director_or_ceo_or_management_email,
                v.sales_team_name,
                v.sales_team_contact,
                v.sales_team_email,
                v.accounts_team_name,
                v.accounts_team_contact,
                v.accounts_team_email,
                v.gst_number,
                v.pan_number,
                v.bank_name,
                v.office_address,
                v.commercial_role,
                v.legal_entity
            ].filter(Boolean).join(" ").toLowerCase();

            if (!searchFields.includes(query)) return false;
        }
        return true;
    });

    if (totalBadgeEl) {
        totalBadgeEl.textContent = `${editVendorList.length} ${editVendorList.length === 1 ? "Vendor" : "Vendors"}`;
    }

    filteredVendorList = sortVendorsSerialWise(filtered);
    if (resetPage) {
        currentVendorPage = 1;
    }
    renderVendorDirectoryPage();
}

let currentVendorPage = 1;
const VENDORS_PER_PAGE = 10;
let filteredVendorList = [];

function renderVendorDirectoryPage() {
    const totalVendors = filteredVendorList.length;
    const totalPages = Math.ceil(totalVendors / VENDORS_PER_PAGE) || 1;

    if (currentVendorPage > totalPages) currentVendorPage = totalPages;
    if (currentVendorPage < 1) currentVendorPage = 1;

    const startIndex = (currentVendorPage - 1) * VENDORS_PER_PAGE;
    const endIndex = Math.min(startIndex + VENDORS_PER_PAGE, totalVendors);
    const pageVendors = filteredVendorList.slice(startIndex, endIndex);

    const resultsCountEl = document.getElementById("evResultsCount");
    if (resultsCountEl) {
        if (totalVendors === 0) {
            resultsCountEl.textContent = "Showing 0 vendors";
        } else {
            resultsCountEl.textContent = `Showing ${startIndex + 1}–${endIndex} of ${totalVendors} vendors`;
        }
    }

    const prevBtn = document.getElementById("evPrevBtn");
    const nextBtn = document.getElementById("evNextBtn");
    const pageLabel = document.getElementById("evPageLabel");
    const paginationControls = document.getElementById("evPaginationControls");

    if (prevBtn) prevBtn.disabled = currentVendorPage <= 1;
    if (nextBtn) nextBtn.disabled = currentVendorPage >= totalPages;
    if (pageLabel) pageLabel.textContent = `Page ${currentVendorPage} of ${totalPages}`;

    if (paginationControls) {
        paginationControls.style.display = totalVendors > 0 ? "flex" : "none";
    }

    renderVendorDirectoryTable(pageVendors, startIndex);
}

function renderVendorDirectoryTable(vendors, startIndex = 0) {
    const tableBody = document.getElementById("evVendorTableBody");
    const tableEl = document.getElementById("evVendorTable");
    const noResultsEl = document.getElementById("evNoResults");

    if (!tableBody) return;

    if (!vendors || vendors.length === 0) {
        tableBody.innerHTML = "";
        if (tableEl) tableEl.classList.add("hidden");
        if (noResultsEl) noResultsEl.classList.remove("hidden");
        return;
    }

    if (tableEl) tableEl.classList.remove("hidden");
    if (noResultsEl) noResultsEl.classList.add("hidden");

    tableBody.innerHTML = vendors.map((v, index) => {
        const vendorId = v.vendor_id;
        const code = v.vendor_code ? escapeHtml(v.vendor_code) : "-";
        const name = escapeHtml(v.vendor_name || "-");
        const entity = v.legal_entity ? `<span class="ev-tag-pill">${escapeHtml(v.legal_entity)}</span>` : "";
        const estYear = v.year_of_incorporation ? `<span class="ev-tag-pill">Est. ${escapeHtml(v.year_of_incorporation)}</span>` : "";
        const role = v.commercial_role ? `<span class="ev-role-normal">${escapeHtml(v.commercial_role)}</span>` : '<span style="color:#94a3b8;">-</span>';
        const contactName = escapeHtml(v.office_contact_name || v.director_or_ceo_or_management_name || "-");
        const contactPhone = escapeHtml(v.office_contact_number || v.director_or_ceo_or_management_mobile_no || "-");
        const gst = v.gst_number ? `<span>GST: ${escapeHtml(v.gst_number)}</span>` : "";
        const pan = v.pan_number ? `<span>PAN: ${escapeHtml(v.pan_number)}</span>` : "";
        const taxHtml = (gst || pan) ? `${gst}${pan}` : '<span style="color:#94a3b8;">-</span>';
        const address = v.office_address ? escapeHtml(v.office_address) : "-";

        return `
            <tr>
                <td style="text-align: center; color: #64748b; font-weight: 600;">${startIndex + index + 1}</td>
                <td><strong class="ev-code-normal">${code}</strong></td>
                <td>
                    <div class="ev-name-cell">
                        <strong class="ev-vendor-name-text">${name}</strong>
                        <div class="ev-meta-tags">${entity}${estYear}</div>
                    </div>
                </td>
                <td>${role}</td>
                <td>
                    <div class="ev-contact-cell">
                        <strong style="color: #0f172a;">${contactName}</strong>
                        <span class="ev-contact-phone">${contactPhone}</span>
                    </div>
                </td>
                <td>
                    <div class="ev-tax-cell">${taxHtml}</div>
                </td>
                <td>
                    <span class="ev-location-text" title="${address}">${address}</span>
                </td>
                <td style="text-align: center;">
                    <div class="ev-actions-cell">
                        <button type="button" class="ev-btn-action ev-btn-view" onclick="openVendorDetailsModal(${vendorId})" title="View complete vendor profile">
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                                <circle cx="12" cy="12" r="3"></circle>
                            </svg>
                            Show Detail
                        </button>
                        <button type="button" class="ev-btn-action ev-btn-edit" onclick="selectVendorForEdit(${vendorId})" title="Edit vendor information">
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                            </svg>
                            Edit Vendor
                        </button>
                        <button type="button" class="ev-btn-action ev-btn-delete" onclick="confirmDeleteVendor(${vendorId})" title="Delete vendor">
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                                <polyline points="3 6 5 6 21 6"></polyline>
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                <line x1="10" y1="11" x2="10" y2="17"></line>
                                <line x1="14" y1="11" x2="14" y2="17"></line>
                            </svg>
                            Delete
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join("");
}

let activeVendorDetailsId = null;

function openVendorDetailsModal(vendorId) {
    activeVendorDetailsId = vendorId;
    const v = editVendorList.find(x => String(x.vendor_id) === String(vendorId));
    if (!v) {
        alert("Vendor not found");
        return;
    }

    const modal = document.getElementById("vendorDetailsModal");
    if (!modal) return;

    const nameEl = document.getElementById("vdModalVendorName");
    const codeBadge = document.getElementById("vdModalCodeBadge");
    const roleBadge = document.getElementById("vdModalRoleBadge");
    const entityBadge = document.getElementById("vdModalEntityBadge");

    if (nameEl) nameEl.textContent = v.vendor_name || "Vendor Profile";
    if (codeBadge) codeBadge.textContent = v.vendor_code || "N/A";
    if (roleBadge) {
        roleBadge.textContent = v.commercial_role || "Role: -";
        roleBadge.style.display = v.commercial_role ? "inline-block" : "none";
    }
    if (entityBadge) {
        entityBadge.textContent = v.legal_entity || "Entity: -";
        entityBadge.style.display = v.legal_entity ? "inline-block" : "none";
    }

    const fmt = val => (val && String(val).trim()) ? escapeHtml(String(val).trim()) : '<span class="ev-detail-val empty">-</span>';

    const fmtDoc = (docPath, docTitle) => {
        if (!docPath) return '<span class="ev-doc-missing">Not uploaded</span>';
        let cleanPath = String(docPath).replace(/^\.\.\//, "/backend/").replace(/^\/?backend\//, "/backend/");
        if (!cleanPath.startsWith("/backend/")) cleanPath = "/backend/" + cleanPath;
        return `<a href="${cleanPath}" target="_blank" class="ev-doc-badge">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
            View ${escapeHtml(docTitle)}
        </a>`;
    };

    const regDate = v.registration_date ? (v.registration_date.includes("T") ? v.registration_date.split("T")[0] : v.registration_date) : "-";

    const modalBody = document.getElementById("vendorDetailsModalBody");
    if (modalBody) {
        modalBody.innerHTML = `
            <!-- 1. Identity & Registration -->
            <div class="ev-detail-section">
                <div class="ev-section-title">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#0B57A4" stroke-width="2.2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                    Basic &amp; Registration Identity
                </div>
                <div class="ev-detail-grid">
                    <div class="ev-detail-item"><span class="ev-detail-label">Vendor Code</span><span class="ev-detail-val"><strong style="color:#0B57A4;">${fmt(v.vendor_code)}</strong></span></div>
                    <div class="ev-detail-item"><span class="ev-detail-label">Vendor Name</span><span class="ev-detail-val">${fmt(v.vendor_name)}</span></div>
                    <div class="ev-detail-item"><span class="ev-detail-label">Registration Date</span><span class="ev-detail-val">${fmt(regDate)}</span></div>
                    <div class="ev-detail-item"><span class="ev-detail-label">Legal Entity</span><span class="ev-detail-val">${fmt(v.legal_entity)}</span></div>
                    <div class="ev-detail-item"><span class="ev-detail-label">Commercial Role</span><span class="ev-detail-val">${fmt(v.commercial_role)}</span></div>
                    <div class="ev-detail-item"><span class="ev-detail-label">Year of Incorporation</span><span class="ev-detail-val">${fmt(v.year_of_incorporation)}</span></div>
                    <div class="ev-detail-item"><span class="ev-detail-label">MSME Number</span><span class="ev-detail-val">${fmt(v.msme_number)}</span></div>
                </div>
            </div>

            <!-- 2. Address & Contacts -->
            <div class="ev-detail-section">
                <div class="ev-section-title">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#0B57A4" stroke-width="2.2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
                    Address &amp; Phone Numbers
                </div>
                <div class="ev-detail-grid">
                    <div class="ev-detail-item span-full"><span class="ev-detail-label">Office Address</span><span class="ev-detail-val">${fmt(v.office_address)}</span></div>
                    <div class="ev-detail-item"><span class="ev-detail-label">Office Contact Name</span><span class="ev-detail-val">${fmt(v.office_contact_name)}</span></div>
                    <div class="ev-detail-item"><span class="ev-detail-label">Office Contact Number</span><span class="ev-detail-val">${fmt(v.office_contact_number)}</span></div>
                    
                    ${(v.factory_address || v.factory_contact_name || v.factory_contact_number) ? `
                        <div class="ev-detail-item span-full" style="margin-top:6px;"><span class="ev-detail-label">Factory Address</span><span class="ev-detail-val">${fmt(v.factory_address)}</span></div>
                        <div class="ev-detail-item"><span class="ev-detail-label">Factory Contact Name</span><span class="ev-detail-val">${fmt(v.factory_contact_name)}</span></div>
                        <div class="ev-detail-item"><span class="ev-detail-label">Factory Contact Number</span><span class="ev-detail-val">${fmt(v.factory_contact_number)}</span></div>
                    ` : ""}

                    ${(v.warehouse_address || v.warehouse_contact_name || v.warehouse_contact_number) ? `
                        <div class="ev-detail-item span-full" style="margin-top:6px;"><span class="ev-detail-label">Warehouse Address</span><span class="ev-detail-val">${fmt(v.warehouse_address)}</span></div>
                        <div class="ev-detail-item"><span class="ev-detail-label">Warehouse Contact Name</span><span class="ev-detail-val">${fmt(v.warehouse_contact_name)}</span></div>
                        <div class="ev-detail-item"><span class="ev-detail-label">Warehouse Contact Number</span><span class="ev-detail-val">${fmt(v.warehouse_contact_number)}</span></div>
                    ` : ""}

                    ${(v.workshop_address || v.workshop_contact_name || v.workshop_contact_number) ? `
                        <div class="ev-detail-item span-full" style="margin-top:6px;"><span class="ev-detail-label">Workshop Address</span><span class="ev-detail-val">${fmt(v.workshop_address)}</span></div>
                        <div class="ev-detail-item"><span class="ev-detail-label">Workshop Contact Name</span><span class="ev-detail-val">${fmt(v.workshop_contact_name)}</span></div>
                        <div class="ev-detail-item"><span class="ev-detail-label">Workshop Contact Number</span><span class="ev-detail-val">${fmt(v.workshop_contact_number)}</span></div>
                    ` : ""}
                </div>
            </div>

            <!-- 3. Management, Sales & Accounts Teams -->
            <div class="ev-detail-section">
                <div class="ev-section-title">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#0B57A4" stroke-width="2.2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
                    Management &amp; Team Contacts
                </div>
                <div class="ev-detail-grid">
                    <div class="ev-detail-item"><span class="ev-detail-label">Director / CEO Name</span><span class="ev-detail-val">${fmt(v.director_or_ceo_or_management_name)}</span></div>
                    <div class="ev-detail-item"><span class="ev-detail-label">Designation</span><span class="ev-detail-val">${fmt(v.director_or_ceo_or_management_designation)}</span></div>
                    <div class="ev-detail-item"><span class="ev-detail-label">Mobile Number</span><span class="ev-detail-val">${fmt(v.director_or_ceo_or_management_mobile_no)}</span></div>
                    <div class="ev-detail-item"><span class="ev-detail-label">Email</span><span class="ev-detail-val">${fmt(v.director_or_ceo_or_management_email)}</span></div>
                    <div class="ev-detail-item"><span class="ev-detail-label">Web Address</span><span class="ev-detail-val">${fmt(v.director_or_ceo_or_management_web_address)}</span></div>

                    <div class="ev-detail-item" style="border-top:1px dashed #e2e8f0; padding-top:8px; margin-top:4px;"><span class="ev-detail-label">Sales Team Name</span><span class="ev-detail-val">${fmt(v.sales_team_name)}</span></div>
                    <div class="ev-detail-item" style="border-top:1px dashed #e2e8f0; padding-top:8px; margin-top:4px;"><span class="ev-detail-label">Sales Contact</span><span class="ev-detail-val">${fmt(v.sales_team_contact)}</span></div>
                    <div class="ev-detail-item" style="border-top:1px dashed #e2e8f0; padding-top:8px; margin-top:4px;"><span class="ev-detail-label">Sales Email</span><span class="ev-detail-val">${fmt(v.sales_team_email)}</span></div>

                    <div class="ev-detail-item" style="border-top:1px dashed #e2e8f0; padding-top:8px; margin-top:4px;"><span class="ev-detail-label">Accounts Team Name</span><span class="ev-detail-val">${fmt(v.accounts_team_name)}</span></div>
                    <div class="ev-detail-item" style="border-top:1px dashed #e2e8f0; padding-top:8px; margin-top:4px;"><span class="ev-detail-label">Accounts Contact</span><span class="ev-detail-val">${fmt(v.accounts_team_contact)}</span></div>
                    <div class="ev-detail-item" style="border-top:1px dashed #e2e8f0; padding-top:8px; margin-top:4px;"><span class="ev-detail-label">Accounts Email</span><span class="ev-detail-val">${fmt(v.accounts_team_email)}</span></div>
                </div>
            </div>

            <!-- 4. Tax, Bank & Branches -->
            <div class="ev-detail-section">
                <div class="ev-section-title">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#0B57A4" stroke-width="2.2"><rect x="2" y="5" width="20" height="14" rx="2"></rect><line x1="2" y1="10" x2="22" y2="10"></line></svg>
                    Tax Identifiers &amp; Banking Details
                </div>
                <div class="ev-detail-grid">
                    <div class="ev-detail-item"><span class="ev-detail-label">GST Number</span><span class="ev-detail-val"><code style="font-size:13px; font-weight:700;">${fmt(v.gst_number)}</code></span></div>
                    <div class="ev-detail-item"><span class="ev-detail-label">PAN Number</span><span class="ev-detail-val"><code style="font-size:13px; font-weight:700;">${fmt(v.pan_number)}</code></span></div>
                    <div class="ev-detail-item"><span class="ev-detail-label">Bank Name</span><span class="ev-detail-val">${fmt(v.bank_name)}</span></div>
                    <div class="ev-detail-item"><span class="ev-detail-label">Account Number</span><span class="ev-detail-val">${fmt(v.bank_account_no)}</span></div>
                    <div class="ev-detail-item"><span class="ev-detail-label">Branch Details</span><span class="ev-detail-val">${fmt(v.bank_branch)}</span></div>
                    <div class="ev-detail-item"><span class="ev-detail-label">Account Type</span><span class="ev-detail-val">${fmt(v.bank_account_type)}</span></div>
                    <div class="ev-detail-item"><span class="ev-detail-label">IFSC / RTGS Code</span><span class="ev-detail-val"><code style="font-size:13px;">${fmt(v.bank_ifsc)}</code></span></div>
                </div>
            </div>

            <!-- 5. Branch Offices -->
            ${(v.branch_office_1_address || v.branch_office_2_address || v.branch_office_3_address) ? `
                <div class="ev-detail-section">
                    <div class="ev-section-title">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#0B57A4" stroke-width="2.2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>
                        Branch Offices
                    </div>
                    <div class="ev-detail-grid">
                        ${v.branch_office_1_address ? `
                            <div class="ev-detail-item span-full"><span class="ev-detail-label">Branch 1 Address</span><span class="ev-detail-val">${fmt(v.branch_office_1_address)}</span></div>
                            <div class="ev-detail-item"><span class="ev-detail-label">Branch 1 Contact Name</span><span class="ev-detail-val">${fmt(v.branch_office_1_contact_name)}</span></div>
                            <div class="ev-detail-item"><span class="ev-detail-label">Branch 1 Contact Number</span><span class="ev-detail-val">${fmt(v.branch_office_1_contact_number)}</span></div>
                        ` : ""}
                        ${v.branch_office_2_address ? `
                            <div class="ev-detail-item span-full" style="margin-top:6px;"><span class="ev-detail-label">Branch 2 Address</span><span class="ev-detail-val">${fmt(v.branch_office_2_address)}</span></div>
                            <div class="ev-detail-item"><span class="ev-detail-label">Branch 2 Contact Name</span><span class="ev-detail-val">${fmt(v.branch_office_2_contact_name)}</span></div>
                            <div class="ev-detail-item"><span class="ev-detail-label">Branch 2 Contact Number</span><span class="ev-detail-val">${fmt(v.branch_office_2_contact_number)}</span></div>
                        ` : ""}
                        ${v.branch_office_3_address ? `
                            <div class="ev-detail-item span-full" style="margin-top:6px;"><span class="ev-detail-label">Branch 3 Address</span><span class="ev-detail-val">${fmt(v.branch_office_3_address)}</span></div>
                            <div class="ev-detail-item"><span class="ev-detail-label">Branch 3 Contact Name</span><span class="ev-detail-val">${fmt(v.branch_office_3_contact_name)}</span></div>
                            <div class="ev-detail-item"><span class="ev-detail-label">Branch 3 Contact Number</span><span class="ev-detail-val">${fmt(v.branch_office_3_contact_number)}</span></div>
                        ` : ""}
                    </div>
                </div>
            ` : ""}

            <!-- 6. Financial Turnover -->
            <div class="ev-detail-section">
                <div class="ev-section-title">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#0B57A4" stroke-width="2.2"><line x1="12" y1="1" x2="12" y2="23"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>
                    Turnover of Last Three Years
                </div>
                <div class="ev-detail-grid">
                    <div class="ev-detail-item"><span class="ev-detail-label">${v.turnover_year_1 ? escapeHtml(v.turnover_year_1) : "Turnover Year 1"}</span><span class="ev-detail-val">${fmt(v.turnover_value_1)}</span></div>
                    <div class="ev-detail-item"><span class="ev-detail-label">${v.turnover_year_2 ? escapeHtml(v.turnover_year_2) : "Turnover Year 2"}</span><span class="ev-detail-val">${fmt(v.turnover_value_2)}</span></div>
                    <div class="ev-detail-item"><span class="ev-detail-label">${v.turnover_year_3 ? escapeHtml(v.turnover_year_3) : "Turnover Year 3"}</span><span class="ev-detail-val">${fmt(v.turnover_value_3)}</span></div>
                </div>
            </div>

            <!-- 7. Documents & Approval -->
            <div class="ev-detail-section">
                <div class="ev-section-title">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#0B57A4" stroke-width="2.2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
                    Uploaded Documents &amp; Approvals
                </div>
                <div class="ev-detail-grid">
                    <div class="ev-detail-item"><span class="ev-detail-label">GST Certificate</span><span class="ev-detail-val">${fmtDoc(v.gst_document, "GST Document")}</span></div>
                    <div class="ev-detail-item"><span class="ev-detail-label">PAN Card</span><span class="ev-detail-val">${fmtDoc(v.pan_document, "PAN Document")}</span></div>
                    <div class="ev-detail-item"><span class="ev-detail-label">MSME Certificate</span><span class="ev-detail-val">${fmtDoc(v.msme_document, "MSME Document")}</span></div>
                    <div class="ev-detail-item"><span class="ev-detail-label">${(() => { const now = new Date(); const sY = (now.getMonth() + 1 >= 4 ? now.getFullYear() : now.getFullYear() - 1); return `${String(sY - 1).slice(-2)}-${String(sY).slice(-2)} ITR`; })()}</span><span class="ev-detail-val">${fmtDoc(v.itr_last_year_document, "ITR Document")}</span></div>
                    <div class="ev-detail-item"><span class="ev-detail-label">${(() => { const now = new Date(); const sY = (now.getMonth() + 1 >= 4 ? now.getFullYear() : now.getFullYear() - 1); return `${String(sY - 2).slice(-2)}-${String(sY - 1).slice(-2)} ITR`; })()}</span><span class="ev-detail-val">${fmtDoc(v.itr_second_last_year_document, "ITR Document")}</span></div>
                    <div class="ev-detail-item"><span class="ev-detail-label">${(() => { const now = new Date(); const sY = (now.getMonth() + 1 >= 4 ? now.getFullYear() : now.getFullYear() - 1); return `${String(sY - 3).slice(-2)}-${String(sY - 2).slice(-2)} ITR`; })()}</span><span class="ev-detail-val">${fmtDoc(v.itr_third_last_year_document, "ITR Document")}</span></div>
                    <div class="ev-detail-item"><span class="ev-detail-label">Recommended By</span><span class="ev-detail-val">${fmt(v.recommended_by)}</span></div>
                    <div class="ev-detail-item"><span class="ev-detail-label">Approved By</span><span class="ev-detail-val">${fmt(v.approved_by)}</span></div>
                </div>
            </div>
        `;
    }

    const editHeaderBtn = document.getElementById("vdModalEditVendorBtn");
    const editFooterBtn = document.getElementById("vdModalEditVendorFooterBtn");
    const onEdit = () => {
        closeVendorDetailsModal();
        selectVendorForEdit(vendorId);
    };
    if (editHeaderBtn) editHeaderBtn.onclick = onEdit;
    if (editFooterBtn) editFooterBtn.onclick = onEdit;

    modal.classList.remove("hidden");
}

function closeVendorDetailsModal() {
    const modal = document.getElementById("vendorDetailsModal");
    if (modal) modal.classList.add("hidden");
}

function populateVendorEditForm(v) {
    if (!v) return;
    editVendorId = v.vendor_id;

    // Fill read-only fields
    EDIT_READONLY_FIELDS.forEach(field => {
        const el = document.getElementById(`ev-${field}`);
        if (el) {
            let val = v[field] ?? "";
            if (field === "registration_date" && val && String(val).includes("T")) {
                val = String(val).split("T")[0];
            }
            el.value = val;
        }
    });

    // Fill editable fields
    EDIT_VENDOR_FIELDS.forEach(field => {
        const el = document.getElementById(`ev-${field}`);
        if (el) el.value = v[field] ?? "";
    });

    // Fill bank fields
    EDIT_BANK_FIELDS.forEach(field => {
        const el = document.getElementById(`ev-${field}`);
        if (el) el.value = v[field] ?? "";
    });

    // Update dynamic turnover and ITR labels in edit form
    setTurnoverYears();

    // Fill Document Previews & reset file inputs
    const docKeys = [
        { key: "gst_document", title: "GST Certificate" },
        { key: "pan_document", title: "PAN Card" },
        { key: "msme_document", title: "MSME Certificate" },
        { key: "itr_last_year_document", title: "ITR Document (Last Year)" },
        { key: "itr_second_last_year_document", title: "ITR Document (Second Last Year)" },
        { key: "itr_third_last_year_document", title: "ITR Document (Third Last Year)" }
    ];

    docKeys.forEach(({ key, title }) => {
        const fileInput = document.getElementById(`ev-doc-${key}`);
        if (fileInput) fileInput.value = "";
        const prevEl = document.getElementById(`ev-prev-${key}`);
        if (prevEl) {
            const docPath = v[key];
            if (docPath) {
                let cleanPath = String(docPath).replace(/^\.\.\//, "/backend/").replace(/^\/?backend\//, "/backend/");
                if (!cleanPath.startsWith("/backend/")) cleanPath = "/backend/" + cleanPath;
                prevEl.innerHTML = `<a href="${cleanPath}" target="_blank" class="ev-doc-badge" style="display:inline-flex;align-items:center;gap:6px;padding:4px 10px;background:#eff6ff;color:#0b57a4;border:1px solid #bfdbfe;border-radius:6px;font-size:12px;font-weight:600;text-decoration:none;">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
                    View Current ${escapeHtml(title)}
                </a>`;
            } else {
                prevEl.innerHTML = `<span style="font-size:12px;color:#94a3b8;font-style:italic;">No file uploaded</span>`;
            }
        }
    });

    // Clear password field safely
    const pwEl = document.getElementById("ev-bank_password");
    if (pwEl) pwEl.value = "";

    // Clear message alerts
    const msgEl = document.getElementById("editVendorMessage");
    if (msgEl) msgEl.textContent = "";
    const bmsgEl = document.getElementById("editVendorBankMessage");
    if (bmsgEl) bmsgEl.textContent = "";

    // Banner metadata
    const titleEl = document.getElementById("evCurrentVendorTitle");
    const codeEl = document.getElementById("evCurrentVendorCodeBadge");
    const select = document.getElementById("editVendorSelect");
    if (titleEl) titleEl.textContent = v.vendor_name || "-";
    if (codeEl) codeEl.textContent = v.vendor_code || "N/A";
    if (select) select.value = v.vendor_id;

    // Enforce input sanitization
    if (typeof attachVendorInputRestrictions === "function") {
        attachVendorInputRestrictions("editVendorForm");
    }
}

function selectVendorForEdit(vendorId) {
    closeVendorDetailsModal();

    let v = editVendorList.find(x => String(x.vendor_id) === String(vendorId));

    const listView = document.getElementById("editVendorListView");
    const formContainer = document.getElementById("editVendorFormContainer");
    const formEl = document.getElementById("editVendorForm");

    if (v) {
        populateVendorEditForm(v);
    }

    if (listView) listView.classList.add("hidden");
    if (formContainer) formContainer.classList.remove("hidden");
    if (formEl) formEl.classList.remove("hidden");

    window.scrollTo({ top: 0, behavior: "smooth" });

    // Refresh vendor details in background to ensure latest state without flickering
    loadVendorForEdit(vendorId, !v);
}

function backToVendorList() {
    const listView = document.getElementById("editVendorListView");
    const formContainer = document.getElementById("editVendorFormContainer");
    const formEl = document.getElementById("editVendorForm");

    if (formContainer) formContainer.classList.add("hidden");
    if (formEl) formEl.classList.add("hidden");
    if (listView) listView.classList.remove("hidden");

    document.getElementById("editVendorMessage").textContent = "";
    document.getElementById("editVendorBankMessage").textContent = "";
    editVendorId = null;

    const select = document.getElementById("editVendorSelect");
    if (select) select.value = "";

    window.scrollTo({ top: 0, behavior: "smooth" });
}

// Event listeners for filters and navigation
document.getElementById("evSearchInput")?.addEventListener("input", applyVendorFilters);
document.getElementById("evSearchClearBtn")?.addEventListener("click", () => {
    const input = document.getElementById("evSearchInput");
    if (input) input.value = "";
    applyVendorFilters();
});
document.getElementById("evRoleFilter")?.addEventListener("change", applyVendorFilters);
document.getElementById("evEntityFilter")?.addEventListener("change", applyVendorFilters);
document.getElementById("evResetFiltersBtn")?.addEventListener("click", () => {
    const searchInput = document.getElementById("evSearchInput");
    const roleFilter = document.getElementById("evRoleFilter");
    const entityFilter = document.getElementById("evEntityFilter");
    if (searchInput) searchInput.value = "";
    if (roleFilter) roleFilter.value = "";
    if (entityFilter) entityFilter.value = "";
    applyVendorFilters();
});

// Export dropdown toggle & actions
const evExportDropdown = document.getElementById("evExportDropdown");
const evExportDropdownBtn = document.getElementById("evExportDropdownBtn");
const evExportMenu = document.getElementById("evExportMenu");

evExportDropdownBtn?.addEventListener("click", (e) => {
    e.stopPropagation();
    const isOpen = evExportDropdown?.classList.toggle("open");
    evExportMenu?.classList.toggle("hidden", !isOpen);
});

// Close menu when clicking anywhere outside
document.addEventListener("click", (e) => {
    if (evExportDropdown && !evExportDropdown.contains(e.target)) {
        evExportDropdown.classList.remove("open");
        evExportMenu?.classList.add("hidden");
    }
});

async function exportVendorDirectory(format) {
    evExportDropdown?.classList.remove("open");
    evExportMenu?.classList.add("hidden");

    const searchInput = document.getElementById("evSearchInput");
    const roleFilter = document.getElementById("evRoleFilter");
    const entityFilter = document.getElementById("evEntityFilter");

    const query = (searchInput?.value || "").trim();
    const role = (roleFilter?.value || "").trim();
    const entity = (entityFilter?.value || "").trim();

    const params = new URLSearchParams();
    if (query) params.append("search", query);
    if (role) params.append("role", role);
    if (entity) params.append("entity", entity);

    const exportBtn = document.getElementById("evExportDropdownBtn");
    const originalContent = exportBtn ? exportBtn.innerHTML : "";
    if (exportBtn) {
        exportBtn.disabled = true;
        exportBtn.innerHTML = `<span>Exporting...</span>`;
    }

    try {
        const url = `/vendors/export/${format}?${params.toString()}`;
        const response = await apiFetch(url);
        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            alert(err.message || `Failed to export ${format.toUpperCase()} file`);
            return;
        }

        const blob = await response.blob();
        const downloadUrl = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = downloadUrl;
        const now = new Date().toISOString().slice(0, 10);
        a.download = `Vendor_Directory_${now}.${format === "excel" ? "xlsx" : "pdf"}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(downloadUrl);
    } catch (err) {
        alert(`Failed to download ${format.toUpperCase()} file: ${err.message}`);
    } finally {
        if (exportBtn) {
            exportBtn.disabled = false;
            exportBtn.innerHTML = originalContent;
        }
    }
}

document.getElementById("evExportExcelBtn")?.addEventListener("click", () => exportVendorDirectory("excel"));
document.getElementById("evExportPdfBtn")?.addEventListener("click", () => exportVendorDirectory("pdf"));

document.getElementById("evBackToListBtn")?.addEventListener("click", backToVendorList);
document.getElementById("closeVendorDetailsModalBtn")?.addEventListener("click", closeVendorDetailsModal);
document.getElementById("closeVendorDetailsModalFooterBtn")?.addEventListener("click", closeVendorDetailsModal);
document.getElementById("vendorDetailsModal")?.addEventListener("click", (e) => {
    if (e.target === document.getElementById("vendorDetailsModal")) {
        closeVendorDetailsModal();
    }
});
document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
        closeVendorDetailsModal();
    }
});

// Quick switch dropdown
document.getElementById("editVendorSelect")?.addEventListener("change", async function () {
    const vendorId = this.value;
    if (!vendorId) {
        backToVendorList();
        return;
    }
    selectVendorForEdit(vendorId);
});

async function loadVendorForEdit(vendorId, isBlocking = false) {
    const formContainer = document.getElementById("editVendorFormContainer");
    const formEl = document.getElementById("editVendorForm");
    const listView = document.getElementById("editVendorListView");

    try {
        const response = await apiFetch(`/vendors/${vendorId}`);
        if (!response) return;
        const result = await response.json();

        if (!response.ok || !result.success) {
            if (isBlocking) {
                alert(result.message || "Failed to load vendor");
            }
            return;
        }

        const v = result.vendor;
        if (v) {
            const idx = editVendorList.findIndex(x => String(x.vendor_id) === String(v.vendor_id));
            if (idx !== -1) {
                editVendorList[idx] = { ...editVendorList[idx], ...v };
            }
            populateVendorEditForm(v);
            if (listView) listView.classList.add("hidden");
            if (formContainer) formContainer.classList.remove("hidden");
            if (formEl) formEl.classList.remove("hidden");
        }
    } catch (err) {
        if (isBlocking) {
            alert("Failed to connect to procurement service");
        }
    }
}

// Save vendor details
document.getElementById("saveVendorDetailsBtn")?.addEventListener("click", async () => {
    if (!editVendorId) return;

    const msgEl = document.getElementById("editVendorMessage");
    const btn   = document.getElementById("saveVendorDetailsBtn");

    const body = {};
    EDIT_VENDOR_FIELDS.forEach(field => {
        const el = document.getElementById(`ev-${field}`);
        if (el) body[field] = el.value;
    });

    // Required fields check: only core identity/contact fields are required
    if (!body.vendor_name?.trim())           { msgEl.textContent = "Vendor name is required."; return; }
    if (/^\d+$/.test(body.vendor_name.trim())) { msgEl.textContent = "Vendor name cannot be only numbers."; return; }
    if (!/[a-zA-Z]/.test(body.vendor_name.trim())) { msgEl.textContent = "Vendor name must contain valid letters."; return; }
    if (!body.commercial_role?.trim())       { msgEl.textContent = "Commercial role is required."; return; }
    if (!body.office_address?.trim())        { msgEl.textContent = "Office address is required."; return; }
    if (!body.office_contact_name?.trim())   { msgEl.textContent = "Office contact name is required."; return; }
    if (/\d/.test(body.office_contact_name)) { msgEl.textContent = "Office contact name cannot contain numbers."; return; }
    if (!body.office_contact_number?.trim()) { msgEl.textContent = "Office contact number is required."; return; }
    if (!/^\d{10}$/.test(body.office_contact_number.trim().replace(/\s+/g, ""))) { msgEl.textContent = "Office contact number must be a valid 10-digit number."; return; }
    if (!body.director_or_ceo_or_management_name?.trim()) { msgEl.textContent = "Director name is required."; return; }
    if (/\d/.test(body.director_or_ceo_or_management_name)) { msgEl.textContent = "Director name cannot contain numbers."; return; }
    if (!body.director_or_ceo_or_management_designation?.trim()) { msgEl.textContent = "Director designation is required."; return; }
    if (!body.director_or_ceo_or_management_mobile_no?.trim()) { msgEl.textContent = "Director mobile is required."; return; }
    if (!/^\d{10}$/.test(body.director_or_ceo_or_management_mobile_no.trim().replace(/\s+/g, ""))) { msgEl.textContent = "Director mobile must be a valid 10-digit number."; return; }
    if (!body.director_or_ceo_or_management_email?.trim()) { msgEl.textContent = "Director email is required."; return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.director_or_ceo_or_management_email.trim())) { msgEl.textContent = "Director email must be a valid email address."; return; }

    // Optional fields format checks (only if value provided)
    if (body.sales_team_name?.trim() && /\d/.test(body.sales_team_name)) { msgEl.textContent = "Sales team name cannot contain numbers."; return; }
    if (body.sales_team_contact?.trim() && !/^\d{10}$/.test(body.sales_team_contact.trim().replace(/\s+/g, ""))) { msgEl.textContent = "Sales team contact must be a valid 10-digit number."; return; }
    if (body.sales_team_email?.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.sales_team_email.trim())) { msgEl.textContent = "Sales team email must be a valid email address."; return; }

    if (body.accounts_team_name?.trim() && /\d/.test(body.accounts_team_name)) { msgEl.textContent = "Accounts team name cannot contain numbers."; return; }
    if (body.accounts_team_contact?.trim() && !/^\d{10}$/.test(body.accounts_team_contact.trim().replace(/\s+/g, ""))) { msgEl.textContent = "Accounts team contact must be a valid 10-digit number."; return; }
    if (body.accounts_team_email?.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.accounts_team_email.trim())) { msgEl.textContent = "Accounts team email must be a valid email address."; return; }

    if (!body.gst_number?.trim()) { msgEl.textContent = "GST number is required."; return; }
    if (!body.pan_number?.trim()) { msgEl.textContent = "PAN number is required."; return; }

    // Build FormData to support text fields and document file uploads
    const formData = new FormData();
    Object.entries(body).forEach(([k, v]) => {
        formData.append(k, v ?? "");
    });

    const docKeys = [
        "gst_document", "pan_document", "msme_document",
        "itr_last_year_document", "itr_second_last_year_document", "itr_third_last_year_document"
    ];
    docKeys.forEach(docKey => {
        const fileInput = document.getElementById(`ev-doc-${docKey}`);
        if (fileInput && fileInput.files && fileInput.files[0]) {
            formData.append(docKey, fileInput.files[0]);
        }
    });

    btn.disabled    = true;
    msgEl.textContent = "Saving...";

    try {
        const response = await apiFetch(`/vendors/${editVendorId}`, {
            method: "PUT",
            body: formData
        });
        if (!response) return;

        const result = await response.json();

        if (!response.ok || !result.success) {
            msgEl.textContent = result.message || "Failed to save vendor details";
            btn.disabled = false;
            return;
        }

        msgEl.textContent = "";
        alert(`Vendor details updated successfully for ${body.vendor_name}.`);

        // Reset file inputs
        docKeys.forEach(docKey => {
            const fileInput = document.getElementById(`ev-doc-${docKey}`);
            if (fileInput) fileInput.value = "";
        });

        await loadVendorsForDirectory();
        const updated = result.vendor || editVendorList.find(x => String(x.vendor_id) === String(editVendorId));
        if (updated) {
            populateVendorEditForm(updated);
        }

    } catch (err) {
        msgEl.textContent = "Failed to connect to procurement service";
    } finally {
        btn.disabled = false;
    }
});

// Save bank details
document.getElementById("saveVendorBankBtn")?.addEventListener("click", async () => {
    if (!editVendorId) return;

    const msgEl = document.getElementById("editVendorBankMessage");
    const btn   = document.getElementById("saveVendorBankBtn");

    const password = document.getElementById("ev-bank_password").value;
    if (!password) { msgEl.textContent = "Please enter your password to save bank details."; return; }

    const body = { password };
    EDIT_BANK_FIELDS.forEach(field => {
        const el = document.getElementById(`ev-${field}`);
        if (el) body[field] = el.value;
    });

    if (!body.bank_name?.trim())         { msgEl.textContent = "Bank name is required."; return; }
    if (!body.bank_account_no?.trim())   { msgEl.textContent = "Account number is required."; return; }
    if (!body.bank_branch?.trim())       { msgEl.textContent = "Branch is required."; return; }
    if (!body.bank_account_type?.trim()) { msgEl.textContent = "Account type is required."; return; }
    if (!body.bank_ifsc?.trim())         { msgEl.textContent = "IFSC code is required."; return; }
    if (!body.legal_entity?.trim())      { msgEl.textContent = "Legal entity is required."; return; }

    btn.disabled      = true;
    msgEl.textContent = "Verifying password and saving...";

    try {
        const response = await apiFetch(`/vendors/${editVendorId}/bank`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body)
        });
        if (!response) return;

        const result = await response.json();

        if (!response.ok || !result.success) {
            msgEl.textContent = result.message || "Failed to save bank details";
            btn.disabled = false;
            return;
        }

        msgEl.textContent = "";
        document.getElementById("ev-bank_password").value = "";
        alert("Bank details updated successfully.");
        await loadVendorsForDirectory();
        const updatedBank = editVendorList.find(x => String(x.vendor_id) === String(editVendorId));
        if (updatedBank) {
            populateVendorEditForm(updatedBank);
        }

    } catch {
        msgEl.textContent = "Failed to connect to procurement service";
    } finally {
        btn.disabled = false;
    }
});

// Inline onclick handlers need these on window
window.openVendorDetailsModal  = openVendorDetailsModal;
window.closeVendorDetailsModal = closeVendorDetailsModal;
window.selectVendorForEdit     = selectVendorForEdit;
window.backToVendorList        = backToVendorList;
window.openPasswordModal = openPasswordModal;
window.changeAccess      = changeAccess;
window.deleteUser        = deleteUser;
window.completePO        = completePO;
window.openReceiveForm   = openReceiveForm;
window.openReturnForm    = openReturnForm;
window.saveGoodsReceipt  = saveGoodsReceipt;
window.saveGoodsReturn   = saveGoodsReturn;
window.closeGoodsForm    = closeGoodsForm;
window.viewGoodsHistory  = viewGoodsHistory;

// ─── Init ──────────────────────────────────────────────────────────────────────

if (window.WorkspaceDashboard) {
    window.WorkspaceDashboard.init({
        isAdmin: true,
        onNewPr: () => {
            const prBtn = document.querySelector('[data-page="purchase-requests"]');
            if (prBtn) prBtn.click();
        }
    });
    window.WorkspaceDashboard.load();
}

// ─── Delete Vendor Function ─────────────────────────────────────────────────────

async function confirmDeleteVendor(vendorId) {
    const v = editVendorList.find(x => String(x.vendor_id) === String(vendorId));
    const vendorName = v ? v.vendor_name : "this vendor";
    const vendorCode = v && v.vendor_code ? ` (${v.vendor_code})` : "";

    const confirmed = confirm(
        `Are you sure you want to delete vendor "${vendorName}"${vendorCode}?\n\n` +
        `This action cannot be undone. Any historical inquiry invitations with no purchase orders will be cleaned up.`
    );
    if (!confirmed) return;

    try {
        const response = await apiFetch(`/vendors/${vendorId}`, {
            method: "DELETE"
        });
        if (!response) return;

        let result = {};
        try {
            result = await response.json();
        } catch {
            const errText = await response.text().catch(() => "");
            result = { message: errText || `Server responded with HTTP ${response.status}` };
        }

        if (!response.ok || !result.success) {
            alert(result.message || "Failed to delete vendor");
            return;
        }

        // Close modal if open with this vendor
        const modal = document.getElementById("vendorDetailsModal");
        if (modal && !modal.classList.contains("hidden")) {
            closeVendorDetailsModal();
        }

        // If currently editing this vendor, hide edit form
        const editSelect = document.getElementById("editVendorSelect");
        if (editSelect && String(editSelect.value) === String(vendorId)) {
            editSelect.value = "";
            const container = document.getElementById("editVendorFormContainer");
            if (container) container.classList.add("hidden");
        }

        alert(`Vendor "${vendorName}" has been successfully deleted.`);

        // Refresh vendor directory table & dropdown
        await loadVendorsForDirectory();

    } catch (err) {
        console.error("Error deleting vendor:", err);
        alert("An error occurred while deleting the vendor.");
    }
}

// Hook up modal delete buttons
document.getElementById("vdModalDeleteVendorBtn")?.addEventListener("click", () => {
    if (activeVendorDetailsId) {
        confirmDeleteVendor(activeVendorDetailsId);
    }
});

document.getElementById("vdModalDeleteVendorFooterBtn")?.addEventListener("click", () => {
    if (activeVendorDetailsId) {
        confirmDeleteVendor(activeVendorDetailsId);
    }
});


// ─── Vendor Directory: Pagination Buttons ───────────────────────────────────────

document.getElementById("evPrevBtn")?.addEventListener("click", () => {
    if (currentVendorPage > 1) {
        currentVendorPage--;
        renderVendorDirectoryPage();
        document.getElementById("evVendorTable")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
});

document.getElementById("evNextBtn")?.addEventListener("click", () => {
    const totalPages = Math.ceil(filteredVendorList.length / VENDORS_PER_PAGE) || 1;
    if (currentVendorPage < totalPages) {
        currentVendorPage++;
        renderVendorDirectoryPage();
        document.getElementById("evVendorTable")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
});
