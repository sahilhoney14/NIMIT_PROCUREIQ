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

// ─── Sidebar Navigation ────────────────────────────────────────────────────────

document.querySelectorAll(".main-menu").forEach(button => {
    button.addEventListener("click", () => {
        const sectionId = button.dataset.section;
        const section   = document.getElementById(sectionId);

        document.querySelectorAll(".main-menu").forEach(b => b.classList.remove("active"));
        document.querySelectorAll(".submenu").forEach(s => s.classList.remove("open"));

        button.classList.add("active");
        if (section) section.classList.add("open");
    });
});

document.querySelectorAll(".submenu-item").forEach(button => {
    button.addEventListener("click", () => {
        if (button.classList.contains("disabled") || button.disabled) return;

        document.querySelectorAll(".submenu-item").forEach(b => b.classList.remove("active"));
        document.querySelectorAll(".page").forEach(p => p.classList.add("hidden"));

        button.classList.add("active");

        const page = button.dataset.page;

        // ── Admin ──
        if (page === "manage-access") {
            showPage("manageAccessPage");
            loadUsers();
        }

        // ── Workspace ──
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

        data.users.forEach(user => {
            const row = document.createElement("tr");

            row.innerHTML = `
                <td>${escapeHtml(user.username)}</td>
                <td>${escapeHtml(user.role)}</td>
                <td class="${user.is_active ? "access-granted" : "access-revoked"}">
                    ${user.is_active ? "Granted" : "Revoked"}
                </td>
                <td>
                    <button class="action-button password-button" onclick="openPasswordModal(${user.user_id})">Change Password</button>
                    <button class="action-button ${user.is_active ? "revoke-button" : "grant-button"}" onclick="changeAccess(${user.user_id}, ${!user.is_active})">
                        ${user.is_active ? "Revoke Access" : "Grant Access"}
                    </button>
                </td>
            `;

            usersTableBody.appendChild(row);
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

function renderPreview() {
    previewBody.innerHTML = "";

    importedRows.forEach((row, index) => {
        const tr = document.createElement("tr");

        tr.innerHTML = `
            <td><input type="date" data-index="${index}" data-field="pr_date" value="${escapeHtml(String(row.pr_date || "").slice(0, 10))}"></td>
            <td><input data-index="${index}" data-field="party_name"       value="${escapeHtml(row.party_name || "")}"></td>
            <td><input data-index="${index}" data-field="location"         value="${escapeHtml(row.location || "")}"></td>
            <td><input data-index="${index}" data-field="territory"        value="${escapeHtml(row.territory || "")}"></td>
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

    [
        { id: "turnover_value_1", text: `${String(startYear).slice(-2)}-${String(startYear + 1).slice(-2)} Turnover` },
        { id: "turnover_value_2", text: `${String(startYear - 1).slice(-2)}-${String(startYear).slice(-2)} Turnover` },
        { id: "turnover_value_3", text: `${String(startYear - 2).slice(-2)}-${String(startYear - 1).slice(-2)} Turnover` }
    ].forEach(({ id, text }) => {
        const input = document.getElementById(id);
        if (!input) return;
        const label = input.closest(".form-group")?.querySelector("label");
        if (label) label.textContent = text;
    });
}

setTurnoverYears();
prefillOfficeUse();

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
    vendorExcelPreview?.classList.add("hidden");
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
    vendor_name: "Vendor name", legal_entity: "Legal entity", commercial_role: "Commercial role",
    year_of_incorporation: "Year of incorporation",
    office_address: "Office address", office_name: "Office contact name", office_phone: "Office contact number",
    director_name: "Director name", director_designation: "Director designation",
    director_mobile: "Director mobile", director_email: "Director email",
    sales_name: "Sales team name", sales_contact: "Sales team contact", sales_email: "Sales team email",
    accounts_name: "Accounts team name", accounts_contact: "Accounts team contact", accounts_email: "Accounts team email",
    gst_number: "GST number", pan_number: "PAN number",
    bank_name: "Bank name", account_no: "Bank account number", bank_branch: "Bank branch",
    account_type: "Account type", ifsc_rtgs: "IFSC code",
    branch1_address: "Branch 1 address", turnover_value_1: "Latest year turnover",
    recommended_by: "Recommended by", approved_by: "Approved by"
};

const VENDOR_REQUIRED_DOCS = {
    gst_document: "GST document",
    pan_document: "PAN document",
    itr_last_year_document: "Last year ITR"
};

function validateVendorForm() {
    for (const [id, label] of Object.entries(VENDOR_REQUIRED_INPUTS)) {
        if (!String(document.getElementById(id)?.value ?? "").trim()) return `${label} is required.`;
    }
    for (const [id, label] of Object.entries(VENDOR_REQUIRED_DOCS)) {
        if (!document.getElementById(id)?.files?.length) return `${label} is required.`;
    }
    return "";
}

// Field names (DB column names) that must be filled in the Excel preview
const VENDOR_REQUIRED_FIELDS = [
    "vendor_name", "legal_entity", "commercial_role", "year_of_incorporation",
    "office_address", "office_contact_name", "office_contact_number",
    "director_or_ceo_or_management_name", "director_or_ceo_or_management_designation",
    "director_or_ceo_or_management_mobile_no", "director_or_ceo_or_management_email",
    "sales_team_name", "sales_team_contact", "sales_team_email",
    "accounts_team_name", "accounts_team_contact", "accounts_team_email",
    "gst_number", "pan_number",
    "bank_name", "bank_account_no", "bank_branch", "bank_account_type", "bank_ifsc",
    "branch_office_1_address", "turnover_year_1", "turnover_value_1",
    "recommended_by", "approved_by"
];

function validateVendorPreviewData(data) {
    for (const f of VENDOR_REQUIRED_FIELDS) {
        if (!String(data[f] ?? "").trim()) return `${formatVendorFieldName(f)} is required.`;
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
        return label ? label.textContent.replace(" Turnover", "").trim() : "";
    };

    const val = id => document.getElementById(id)?.value ?? "";

    const data = {
        registration_date:                         val("registration_date") || todayISO(),
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

        await renderVendorPreview(result.vendor);
        showVendorMessage("Vendor preview ready. Upload documents, then click Save Vendor.");

    } catch {
        showVendorMessage("Failed to connect to procurement manager service");
    } finally {
        vendorImportButton.disabled = false;
    }
});

const VENDOR_SECTIONS = [
    {
        title: "Basic Details",
        fields: [
            ["registration_date", "Registration Date"],
            ["vendor_name", "Vendor Name"],
            ["legal_entity", "Legal Entity"],
            ["commercial_role", "Commercial Role"],
            ["year_of_incorporation", "Year of Incorporation"]
        ]
    },
    {
        title: "Address with Phone Numbers",
        fields: [
            ["office_address", "Office Address"],
            ["office_contact_name", "Office Contact Name"],
            ["office_contact_number", "Office Contact Number"],
            ["factory_address", "Factory Address"],
            ["factory_contact_name", "Factory Contact Name"],
            ["factory_contact_number", "Factory Contact Number"],
            ["warehouse_address", "Warehouse Address"],
            ["warehouse_contact_name", "Warehouse Contact Name"],
            ["warehouse_contact_number", "Warehouse Contact Number"],
            ["workshop_address", "Workshop Address"],
            ["workshop_contact_name", "Workshop Contact Name"],
            ["workshop_contact_number", "Workshop Contact Number"]
        ]
    },
    {
        title: "Director / CEO / Management Team",
        fields: [
            ["director_or_ceo_or_management_name", "Name"],
            ["director_or_ceo_or_management_designation", "Designation"],
            ["director_or_ceo_or_management_mobile_no", "Mobile No."],
            ["director_or_ceo_or_management_email", "Email"],
            ["director_or_ceo_or_management_web_address", "Web Address"]
        ]
    },
    {
        title: "Sales Team",
        fields: [
            ["sales_team_name", "Name"],
            ["sales_team_contact", "Contact"],
            ["sales_team_email", "Email"]
        ]
    },
    {
        title: "Accounts Team",
        fields: [
            ["accounts_team_name", "Name"],
            ["accounts_team_contact", "Contact"],
            ["accounts_team_email", "Email"]
        ]
    },
    {
        title: "Tax & Registration",
        fields: [
            ["gst_number", "GST Number"],
            ["pan_number", "PAN Number"],
            ["msme_number", "MSME Number"]
        ]
    },
    {
        title: "Bank Details",
        fields: [
            ["bank_name", "Bank Name"],
            ["bank_account_no", "Account No."],
            ["bank_branch", "Branch Details"],
            ["bank_account_type", "Type of Account"],
            ["bank_ifsc", "IFSC/RTGS Code"]
        ]
    },
    {
        title: "Branch Offices",
        fields: [
            ["branch_office_1_address", "Branch 1 Address"],
            ["branch_office_1_contact_name", "Branch 1 Contact Name"],
            ["branch_office_1_contact_number", "Branch 1 Contact Number"],
            ["branch_office_2_address", "Branch 2 Address"],
            ["branch_office_2_contact_name", "Branch 2 Contact Name"],
            ["branch_office_2_contact_number", "Branch 2 Contact Number"],
            ["branch_office_3_address", "Branch 3 Address"],
            ["branch_office_3_contact_name", "Branch 3 Contact Name"],
            ["branch_office_3_contact_number", "Branch 3 Contact Number"]
        ]
    },
    {
        title: "Turnover of Last Three Years",
        fields: [
            ["turnover_year_1", "Year 1"],
            ["turnover_value_1", "Value 1"],
            ["turnover_year_2", "Year 2"],
            ["turnover_value_2", "Value 2"],
            ["turnover_year_3", "Year 3"],
            ["turnover_value_3", "Value 3"]
        ]
    },
    {
        title: "For Office Use Only",
        fields: [
            ["recommended_by", "Recommended By"],
            ["approved_by", "Approved By"]
        ]
    }
];

async function renderVendorPreview(vendor) {
    vendorPreviewForm.innerHTML = "";

    const used = new Set();

    const buildSection = (title, fields) => {
        const section = document.createElement("div");
        section.className = "form-section";

        const heading = document.createElement("h3");
        heading.className = "form-section-title";
        heading.textContent = title;
        section.appendChild(heading);

        const grid = document.createElement("div");
        grid.className = "form-grid";

        fields.forEach(([field, label]) => {
            used.add(field);

            const isDate = field === "registration_date";
            const value  = vendor[field];
            const shown  = isDate ? (value || todayISO()) : (value || "");

            const group = document.createElement("div");
            group.className = "form-group";
            group.innerHTML = `
                <label>${escapeHtml(label)}</label>
                <input id="preview_${field}" type="${isDate ? "date" : "text"}" value="${escapeHtml(shown)}">
            `;
            grid.appendChild(group);
        });

        section.appendChild(grid);
        vendorPreviewForm.appendChild(section);
    };

    VENDOR_SECTIONS.forEach(section => buildSection(section.title, section.fields));

    // Safety net: any field the backend returns that is not listed above
    const extraFields = Object.keys(vendor)
        .filter(field => !used.has(field))
        .map(field => [field, formatVendorFieldName(field)]);

    if (extraFields.length) buildSection("Other Details", extraFields);

    const recommendedInput = document.getElementById("preview_recommended_by");
    const approvedInput    = document.getElementById("preview_approved_by");

    if (recommendedInput && !recommendedInput.value) recommendedInput.value = currentUser();
    if (approvedInput    && !approvedInput.value)    approvedInput.value    = currentUser();

    vendorExcelPreview.classList.remove("hidden");

    const gstInput = document.getElementById("preview_gst_number");

    if (gstInput) {
        const gstValid = await checkVendorGST(gstInput.value);
        saveVendorExcelButton.disabled = !gstValid;
        return;
    }

    saveVendorExcelButton.disabled = false;
}

function formatVendorFieldName(field) {
    return field
        .replace(/_/g, " ")
        .replace(/\b\w/g, c => c.toUpperCase());
}

// ─── Vendor Masters: Save Excel-Imported Vendor ────────────────────────────────

saveVendorExcelButton?.addEventListener("click", async () => {
    const gstInput = document.getElementById("preview_gst_number");

    if (gstInput && !(await checkVendorGST(gstInput.value))) return;

    const data = {};
    vendorPreviewForm.querySelectorAll("input").forEach(input => {
        data[input.id.replace("preview_", "")] = input.value;
    });

    if (!data.registration_date) data.registration_date = todayISO();
    if (!data.recommended_by)    data.recommended_by    = currentUser();
    if (!data.approved_by)       data.approved_by       = currentUser();

    const validationError = validateVendorPreviewData(data);
    if (validationError) {
        showVendorMessage(validationError);
        return;
    }

    const vendorName = data.vendor_name || "Vendor";

    const formData = new FormData();
    formData.append("vendor_data", JSON.stringify(data));

    ["gst_document", "pan_document", "msme_document",
     "itr_last_year_document", "itr_second_last_year_document", "itr_third_last_year_document"
    ].forEach(docId => {
        const file = document.getElementById(`excel_${docId}`)?.files[0];
        if (file) formData.append(docId, file);
    });

    try {
        saveVendorExcelButton.disabled = true;
        showVendorMessage("Saving vendor...");

        const response = await apiFetch("/vendors/import", {
            method: "POST",
            body: formData
        });
        if (!response) return;

        const result = await response.json();

        if (!response.ok) {
            if (response.status === 409) {
                alert(result.message);
            } else {
                showVendorMessage(result.message || "Failed to save vendor");
            }
            return;
        }

        alert(`Vendor "${vendorName}" added successfully!\nVendor Code: ${result.vendor_code}`);
        clearVendorExcel();

    } catch {
        showVendorMessage("Failed to connect to procurement service");
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

    formEl.innerHTML = `
        <div class="edit-pr-form-inner">
            <h3>Edit Purchase Request — ${escapeHtml(inquiry.pr_number)}
                <span style="font-size:12px;font-weight:400;color:#888;margin-left:8px;">
                    All fields editable — no vendors have quoted yet
                </span>
            </h3>

            <div class="form-grid">
                ${editable("Location",         "location",         inquiry.location)}
                ${editable("Territory",        "territory",        inquiry.territory)}
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

function initOrderTrackingFilters() {
    if (orderTrackingFiltersInitialized) return;
    const searchInput   = document.getElementById("orderTrackingSearch");
    const clearBtn      = document.getElementById("orderTrackingSearchClear");
    const pillsWrap     = document.getElementById("otStatusPills");
    const datePreset    = document.getElementById("orderTrackingDatePreset");
    const fromDateInput = document.getElementById("orderTrackingFromDate");
    const toDateInput   = document.getElementById("orderTrackingToDate");
    const dateClearBtn  = document.getElementById("orderTrackingDateClear");

    if (!pillsWrap && !searchInput && !datePreset) return;
    orderTrackingFiltersInitialized = true;

    function formatLocalDate(d) {
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, "0");
        const day = String(d.getDate()).padStart(2, "0");
        return `${year}-${month}-${day}`;
    }

    function updateDateFilterUI() {
        const hasDate = Boolean(orderTrackingFromDate || orderTrackingToDate || (orderTrackingDatePreset && orderTrackingDatePreset !== "ALL"));
        if (dateClearBtn) {
            dateClearBtn.style.display = hasDate ? "inline-flex" : "none";
        }
    }

    function applyDatePreset(preset) {
        orderTrackingDatePreset = preset;
        const now = new Date();

        if (preset === "ALL") {
            orderTrackingFromDate = "";
            orderTrackingToDate = "";
            if (fromDateInput) fromDateInput.value = "";
            if (toDateInput) toDateInput.value = "";
        } else if (preset === "TODAY") {
            const todayStr = formatLocalDate(now);
            orderTrackingFromDate = todayStr;
            orderTrackingToDate = todayStr;
            if (fromDateInput) fromDateInput.value = todayStr;
            if (toDateInput) toDateInput.value = todayStr;
        } else if (preset === "YESTERDAY") {
            const y = new Date(now);
            y.setDate(y.getDate() - 1);
            const yStr = formatLocalDate(y);
            orderTrackingFromDate = yStr;
            orderTrackingToDate = yStr;
            if (fromDateInput) fromDateInput.value = yStr;
            if (toDateInput) toDateInput.value = yStr;
        } else if (preset === "THIS_WEEK") {
            const day = now.getDay();
            const diffToMonday = (day === 0 ? -6 : 1) - day;
            const monday = new Date(now);
            monday.setDate(now.getDate() + diffToMonday);
            orderTrackingFromDate = formatLocalDate(monday);
            orderTrackingToDate = formatLocalDate(now);
            if (fromDateInput) fromDateInput.value = orderTrackingFromDate;
            if (toDateInput) toDateInput.value = orderTrackingToDate;
        } else if (preset === "THIS_MONTH") {
            const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
            orderTrackingFromDate = formatLocalDate(firstDay);
            orderTrackingToDate = formatLocalDate(now);
            if (fromDateInput) fromDateInput.value = orderTrackingFromDate;
            if (toDateInput) toDateInput.value = orderTrackingToDate;
        } else if (preset === "LAST_30_DAYS") {
            const past30 = new Date(now);
            past30.setDate(now.getDate() - 29);
            orderTrackingFromDate = formatLocalDate(past30);
            orderTrackingToDate = formatLocalDate(now);
            if (fromDateInput) fromDateInput.value = orderTrackingFromDate;
            if (toDateInput) toDateInput.value = orderTrackingToDate;
        } else if (preset === "CUSTOM") {
            orderTrackingFromDate = fromDateInput ? fromDateInput.value : "";
            orderTrackingToDate = toDateInput ? toDateInput.value : "";
        }

        updateDateFilterUI();
        orderTrackingPage = 1;
        loadOrderTracking();
    }

    // Date preset select
    datePreset?.addEventListener("change", (e) => {
        applyDatePreset(e.target.value);
    });

    // Custom date pickers
    fromDateInput?.addEventListener("change", (e) => {
        orderTrackingFromDate = e.target.value;
        orderTrackingDatePreset = "CUSTOM";
        if (datePreset) datePreset.value = "CUSTOM";
        updateDateFilterUI();
        orderTrackingPage = 1;
        loadOrderTracking();
    });

    toDateInput?.addEventListener("change", (e) => {
        orderTrackingToDate = e.target.value;
        orderTrackingDatePreset = "CUSTOM";
        if (datePreset) datePreset.value = "CUSTOM";
        updateDateFilterUI();
        orderTrackingPage = 1;
        loadOrderTracking();
    });

    // Date clear button
    dateClearBtn?.addEventListener("click", () => {
        orderTrackingDatePreset = "ALL";
        orderTrackingFromDate = "";
        orderTrackingToDate = "";
        if (datePreset) datePreset.value = "ALL";
        if (fromDateInput) fromDateInput.value = "";
        if (toDateInput) toDateInput.value = "";
        updateDateFilterUI();
        orderTrackingPage = 1;
        loadOrderTracking();
    });

    function updatePillsUI(currentStatus) {
        if (!pillsWrap) return;
        const pills = pillsWrap.querySelectorAll(".ot-pill");
        pills.forEach(p => {
            if (p.dataset.status === currentStatus) {
                p.classList.add("active");
            } else {
                p.classList.remove("active");
            }
        });
    }

    // Pill buttons click
    pillsWrap?.addEventListener("click", (e) => {
        const pill = e.target.closest(".ot-pill");
        if (!pill) return;
        const status = pill.dataset.status;
        orderTrackingStatus = status;
        orderTrackingPage = 1;
        updatePillsUI(status);
        loadOrderTracking();
    });

    // Search input with debounce
    searchInput?.addEventListener("input", (e) => {
        const val = e.target.value;
        if (clearBtn) {
            clearBtn.style.display = val ? "inline-flex" : "none";
        }
        clearTimeout(orderTrackingDebounceTimer);
        orderTrackingDebounceTimer = setTimeout(() => {
            orderTrackingSearchQuery = val;
            orderTrackingPage = 1;
            loadOrderTracking();
        }, 300);
    });

    // Search clear button
    clearBtn?.addEventListener("click", () => {
        if (searchInput) searchInput.value = "";
        clearBtn.style.display = "none";
        orderTrackingSearchQuery = "";
        orderTrackingPage = 1;
        loadOrderTracking();
    });

    // Export Summary button (Excel .xlsx)
    const exportBtn = document.getElementById("orderTrackingExportBtn");
    exportBtn?.addEventListener("click", async () => {
        const originalText = exportBtn.innerHTML;
        exportBtn.disabled = true;
        exportBtn.innerHTML = `
            <svg class="ot-export-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <path d="M12 6v6l4 2"></path>
            </svg>
            <span>Exporting Excel...</span>
        `;

        try {
            const params = new URLSearchParams();
            if (orderTrackingStatus && orderTrackingStatus !== "ALL") {
                params.set("status", orderTrackingStatus);
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

            // Extract filename from header or fallback to .xlsx
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

// ─── Purchase Orders: Load List ────────────────────────────────────────────────

let allPurchaseOrders = [];
let poStatusFilter = "ALL";
let poFiltersInitialized = false;

function initPurchaseOrderFilters() {
    if (poFiltersInitialized) return;
    const pillsWrap = document.getElementById("poStatusPills");
    if (!pillsWrap) return;
    poFiltersInitialized = true;

    pillsWrap.addEventListener("click", (e) => {
        const pill = e.target.closest(".ot-pill");
        if (!pill) return;
        const status = pill.dataset.status || "ALL";
        poStatusFilter = status;

        pillsWrap.querySelectorAll(".ot-pill").forEach(p => {
            if (p.dataset.status === status) {
                p.classList.add("active");
            } else {
                p.classList.remove("active");
            }
        });

        applyPurchaseOrderFilter();
    });
}

function applyPurchaseOrderFilter() {
    let filtered = allPurchaseOrders;
    if (poStatusFilter && poStatusFilter !== "ALL") {
        filtered = allPurchaseOrders.filter(po => (po.status || "").toUpperCase() === poStatusFilter.toUpperCase());
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
                    <div class="pi-actions" id="piActions-${po.po_id}"></div>
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

        if (po.status !== "DRAFT") loadProformaInvoiceStatus(po.po_id);
    });
}

// ─── Purchase Orders: Proforma Invoice (Upload / Download) ────────────────────

async function loadProformaInvoiceStatus(poId) {
    const container = document.getElementById(`piActions-${poId}`);
    if (!container) return;

    try {
        const response = await apiFetch(`/purchase-orders/${poId}/proforma-invoice/status`);
        if (!response) return;

        const result = await response.json();
        if (!response.ok || !result.success) return;

        renderProformaInvoiceButton(container, poId, result.exists);

    } catch {
        // Silently ignore - the button just won't render if the check fails.
    }
}

function renderProformaInvoiceButton(container, poId, exists) {
    container.innerHTML = exists
        ? `<button type="button" class="secondary-button download-pi-btn" data-po-id="${poId}">⬇ Download PI</button>`
        : `<label class="secondary-button upload-pi-label">
               Upload PI
               <input type="file" class="upload-pi-input" data-po-id="${poId}" hidden>
           </label>`;
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
                const result = await response.json();
                alert(result.message || "Failed to issue PO.");
                issuePOBtn.disabled = false;
                issuePOBtn.textContent = "Issue PO";
                return;
            }
            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;

            const disposition = response.headers.get("Content-Disposition");
            const match = disposition?.match(/filename="?([^"]+)"?/i);

            a.download = match ? match[1] : `PO_${poId}.pdf`;

            a.click();
            URL.revokeObjectURL(url);
            alert("PO issued successfully.");
            await loadPurchaseOrders();

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
        window.open(`/purchase-orders/${downloadPoBtn.dataset.poId}/download`, "_blank");
        return;
    }

    const downloadPiBtn = event.target.closest(".download-pi-btn");
    if (downloadPiBtn) {
        window.open(`/purchase-orders/${downloadPiBtn.dataset.poId}/proforma-invoice`, "_blank");
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

purchaseOrdersList?.addEventListener("change", async event => {
    const uploadInput = event.target.closest(".upload-pi-input");
    if (!uploadInput) return;

    const file = uploadInput.files[0];
    if (!file) return;

    const poId      = uploadInput.dataset.poId;
    const formData  = new FormData();
    formData.append("proforma_invoice", file);

    try {
        const response = await apiFetch(`/purchase-orders/${poId}/proforma-invoice`, {
            method: "POST",
            body: formData
        });
        if (!response) return;

        const result = await response.json();

        if (!response.ok) {
            alert(result.message || "Failed to upload Proforma Invoice");
            return;
        }

        alert("Proforma Invoice uploaded successfully.");
        await loadProformaInvoiceStatus(poId);

    } catch {
        alert("Failed to connect to procurement service.");
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

async function loadVendorPerformance() {
    const list = document.getElementById("vendorPerformanceList");
    const msg  = document.getElementById("vendorPerformanceMessage");

    list.innerHTML = "";
    msg.textContent = "Loading vendor performance...";

    try {
        const response = await apiFetch("/vendor-performance");
        if (!response) return;
        const result   = await response.json();

        if (!response.ok || !result.success) {
            msg.textContent = result.message || "Failed to load vendor performance";
            return;
        }

        msg.textContent = "";
        renderVendorPerformance(result.vendors || []);

    } catch {
        msg.textContent = "Failed to connect to procurement service";
    }
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
        list.innerHTML = `<div class="message">No vendors found.</div>`;
        return;
    }

    vendors.sort((a, b) => {
        if (!a.vendor_code && !b.vendor_code) return 0;
        if (!a.vendor_code) return 1;
        if (!b.vendor_code) return -1;
        return a.vendor_code.localeCompare(b.vendor_code, undefined, { numeric: true });
    });

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
    const kpiCard = (label, value) => `
        <div class="inquiry-card-item">
            <span class="inquiry-card-label">${label}</span>
            <span class="inquiry-card-value">${value}</span>
        </div>
    `;

    container.innerHTML = `
        <div class="inquiry-card-info" style="margin-bottom:16px;">
            ${kpiCard("Total Orders",      kpis.total_orders)}
            ${kpiCard("Order Value",       `₹${formatCurrency(kpis.order_value)}`)}
            ${kpiCard("Avg Lead Time",     kpis.avg_lead_time_days !== null ? `${kpis.avg_lead_time_days} days` : "-")}
            ${kpiCard("On-Time Delivery",  kpis.on_time_pct !== null ? `${kpis.on_time_pct}% (${kpis.on_time_deliveries}/${kpis.total_deliveries})` : "-")}
            ${kpiCard("Open Orders",       kpis.open_orders)}
        </div>

        <div class="inquiry-card-info" style="margin-bottom:16px;">
            ${kpiCard("GST",           escapeHtml(profile.gst_number  || "-"))}
            ${kpiCard("PAN",           escapeHtml(profile.pan_number  || "-"))}
            ${kpiCard("Office",        escapeHtml(profile.office_address || "-"))}
            ${kpiCard("Sales Contact", escapeHtml(profile.sales_team_email || "-"))}
        </div>

        <div class="table-container">
            <table class="inquiry-vendor-table">
                <thead>
                    <tr>
                        <th>PO Number</th>
                        <th>PO Date</th>
                        <th>Item</th>
                        <th>Qty</th>
                        <th>Total Price</th>
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
        (m.model     || "").toLowerCase().includes(query) ||
        (m.item_name || "").toLowerCase().includes(query) ||
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
            data-model="${escapeHtml(m.model)}"
        >
            <span class="ppr-dropdown-model">${escapeHtml(m.model)}</span>
            <span class="ppr-dropdown-meta">
                ${escapeHtml(m.item_name || "")}
                ${m.make ? `· ${escapeHtml(m.make)}` : ""}
                ${m.product_category ? `· ${escapeHtml(m.product_category)}` : ""}
            </span>
        </div>
    `).join("");

    dropdown.classList.remove("hidden");

    dropdown.querySelectorAll(".ppr-dropdown-item").forEach(item => {
        item.addEventListener("click", () => {
            const model = item.dataset.model;
            document.getElementById("pprSearchInput").value = model;
            dropdown.classList.add("hidden");
            loadPPRDetail(model);
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

async function loadPPRDetail(model) {
    const results = document.getElementById("pprResults");
    const msg     = document.getElementById("pprMessage");
    const label   = document.getElementById("pprSelectedLabel");

    results.innerHTML = "";
    msg.textContent   = "Loading...";
    label.classList.add("hidden");

    try {
        const response = await apiFetch(`/past-price-reference?model=${encodeURIComponent(model)}`);
        if (!response) return;
        const result   = await response.json();

        if (!response.ok || !result.success) {
            msg.textContent = result.message || "Failed to fetch price history";
            return;
        }

        msg.textContent = "";

        if (!result.purchases.length) {
            msg.textContent = "No purchase history found for this model";
            return;
        }

        label.textContent = `Showing results for: ${result.model}${result.item_name ? ` — ${result.item_name}` : ""}${result.make ? ` (${result.make})` : ""}`;
        label.classList.remove("hidden");

        renderPPRResults(result);

    } catch {
        msg.textContent = "Failed to connect to procurement service";
    }
}

function renderPPRResults({ last3, byVendor }) {

    const results = document.getElementById("pprResults");

    const summaryHtml = `
        <div class="ppr-section">
            <h3 class="ppr-section-title">Last 3 Purchases Summary</h3>
            <div class="ppr-summary-strip">
                ${last3.map((p, i) => `
                    <div class="ppr-summary-card">
                        <div class="ppr-summary-rank">#${i + 1}</div>
                        <div class="ppr-summary-field">
                            <span class="ppr-summary-label">Date</span>
                            <span class="ppr-summary-value">${formatDate(p.po_date)}</span>
                        </div>
                        <div class="ppr-summary-field">
                            <span class="ppr-summary-label">Vendor</span>
                            <span class="ppr-summary-value">${escapeHtml(p.vendor_name)}</span>
                        </div>
                        <div class="ppr-summary-field">
                            <span class="ppr-summary-label">Qty</span>
                            <span class="ppr-summary-value">${p.qty} ${escapeHtml(p.unit || "")}</span>
                        </div>
                        <div class="ppr-summary-field">
                            <span class="ppr-summary-label">Unit Rate</span>
                            <span class="ppr-summary-value ppr-rate">₹${formatCurrency(p.price_per_unit)}</span>
                        </div>
                        <div class="ppr-summary-field">
                            <span class="ppr-summary-label">PO Number</span>
                            <span class="ppr-summary-value">${escapeHtml(p.po_number)}</span>
                        </div>
                    </div>
                `).join("")}
            </div>
        </div>
    `;

    const vendorSections = byVendor.map(v => `
        <div class="ppr-vendor-block">
            <div class="ppr-vendor-header">
                <span class="ppr-vendor-name">${escapeHtml(v.vendor_name)}</span>
                ${v.vendor_code
                    ? `<span class="ppr-vendor-code">${escapeHtml(v.vendor_code)}</span>`
                    : ""
                }
                <span class="ppr-vendor-count">${v.purchases.length} order${v.purchases.length !== 1 ? "s" : ""}</span>
            </div>
            <div class="table-container">
                <table class="inquiry-vendor-table">
                    <thead>
                        <tr>
                            <th>PO Number</th>
                            <th>Date</th>
                            <th>Qty</th>
                            <th>Unit</th>
                            <th>Unit Rate</th>
                            <th>Total Price</th>
                            <th>Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${v.purchases.map(p => `
                            <tr>
                                <td>${escapeHtml(p.po_number)}</td>
                                <td>${formatDate(p.po_date)}</td>
                                <td>${p.qty}</td>
                                <td>${escapeHtml(p.unit || "-")}</td>
                                <td class="ppr-rate-cell">₹${formatCurrency(p.price_per_unit)}</td>
                                <td>₹${formatCurrency(p.total_price)}</td>
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
    `).join("");

    results.innerHTML = summaryHtml + `
        <div class="ppr-section">
            <h3 class="ppr-section-title">Full History by Vendor</h3>
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

function renderReportLogs(rows) {
    if (!rows.length) {
        reportLogsBody.innerHTML = `<tr class="logs-empty-row"><td colspan="4">No report logs found</td></tr>`;
        return;
    }

    reportLogsBody.innerHTML = rows.map(row => `
        <tr>
            <td>${formatDateTime(row.log_timestamp)}</td>
            <td>${escapeHtml(row.username)}</td>
            <td>${escapeHtml(row.action)}</td>
            <td class="logs-report-cell">${escapeHtml(row.report)}</td>
        </tr>
    `).join("");
}

function renderAuditLogs(rows) {
    if (!rows.length) {
        auditLogsBody.innerHTML = `<tr class="logs-empty-row"><td colspan="5">No audit logs found</td></tr>`;
        return;
    }

    auditLogsBody.innerHTML = rows.map(row => `
        <tr>
            <td>${formatDateTime(row.log_timestamp)}</td>
            <td>${escapeHtml(row.username)}</td>
            <td>${escapeHtml(row.action)}</td>
            <td class="logs-value-cell audit-old-value">${escapeHtml(row.old_value || "-")}</td>
            <td class="logs-value-cell audit-new-value">${escapeHtml(row.new_value || "-")}</td>
        </tr>
    `).join("");
}

function renderLoginLogs(rows) {
    if (!rows.length) {
        loginLogsBody.innerHTML = `<tr class="logs-empty-row"><td colspan="3">No access logs found</td></tr>`;
        return;
    }

    loginLogsBody.innerHTML = rows.map(row => `
        <tr>
            <td>${formatDateTime(row.login_time)}</td>
            <td>${escapeHtml(row.username)}</td>
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
    "branch_office_3_address", "branch_office_3_contact_name", "branch_office_3_contact_number"
];

const EDIT_BANK_FIELDS = [
    "legal_entity", "bank_name", "bank_account_no",
    "bank_branch", "bank_account_type", "bank_ifsc"
];

const EDIT_READONLY_FIELDS = [
    "vendor_code", "registration_date", "gst_number", "pan_number",
    "msme_number", "year_of_incorporation", "recommended_by", "approved_by",
    "turnover_year_1", "turnover_value_1", "turnover_year_2", "turnover_value_2",
    "turnover_year_3", "turnover_value_3"
];

async function initEditVendor() {
    document.getElementById("editVendorForm").classList.add("hidden");
    document.getElementById("editVendorMessage").textContent = "";
    document.getElementById("editVendorBankMessage").textContent = "";
    editVendorId = null;

    await loadEditVendorDropdown();
}

async function loadEditVendorDropdown() {
    const select = document.getElementById("editVendorSelect");
    select.innerHTML = '<option value="">Loading vendors...</option>';

    try {
        const response = await apiFetch("/vendors/all");
        if (!response) return;
        const result   = await response.json();

        if (!result.success) {
            select.innerHTML = '<option value="">Failed to load vendors</option>';
            return;
        }

        editVendorList = result.vendors || [];

        editVendorList.sort((a, b) =>
            (a.vendor_name || "").localeCompare(b.vendor_name || "", undefined, { sensitivity: "base" })
        );

        select.innerHTML = '<option value="">-- Select a vendor --</option>';

        editVendorList.forEach(v => {
            const option = document.createElement("option");
            option.value = v.vendor_id;
            option.textContent = `${v.vendor_name}${v.vendor_code ? ` (${v.vendor_code})` : ""}`;
            select.appendChild(option);
        });

    } catch {
        select.innerHTML = '<option value="">Failed to load vendors</option>';
    }
}

// Search input
document.getElementById("editVendorSelect")?.addEventListener("change", async function () {
    const vendorId = this.value;

    if (!vendorId) {
        document.getElementById("editVendorForm").classList.add("hidden");
        document.getElementById("editVendorMessage").textContent = "";
        document.getElementById("editVendorBankMessage").textContent = "";
        editVendorId = null;
        return;
    }

    await loadVendorForEdit(vendorId);
});

async function loadVendorForEdit(vendorId) {
    document.getElementById("editVendorForm").classList.add("hidden");
    document.getElementById("editVendorMessage").textContent = "";
    document.getElementById("editVendorBankMessage").textContent = "";

    try {
        const response = await apiFetch(`/vendors/${vendorId}`);
        if (!response) return;
        const result   = await response.json();

        if (!response.ok || !result.success) {
            alert(result.message || "Failed to load vendor");
            return;
        }

        const v = result.vendor;
        editVendorId = v.vendor_id;

        // Fill read-only fields
        EDIT_READONLY_FIELDS.forEach(field => {
            const el = document.getElementById(`ev-${field}`);
            if (el) el.value = v[field] ?? "";
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

        // Clear password field
        document.getElementById("ev-bank_password").value = "";

        document.getElementById("editVendorForm").classList.remove("hidden");

    } catch {
        alert("Failed to connect to procurement service");
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

    // Basic required field check
    if (!body.vendor_name?.trim())           { msgEl.textContent = "Vendor name is required."; return; }
    if (!body.office_address?.trim())        { msgEl.textContent = "Office address is required."; return; }
    if (!body.office_contact_name?.trim())   { msgEl.textContent = "Office contact name is required."; return; }
    if (!body.office_contact_number?.trim()) { msgEl.textContent = "Office contact number is required."; return; }

    btn.disabled    = true;
    msgEl.textContent = "Saving...";

    try {
        const response = await apiFetch(`/vendors/${editVendorId}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body)
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

    } catch {
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

    } catch {
        msgEl.textContent = "Failed to connect to procurement service";
    } finally {
        btn.disabled = false;
    }
});

// Inline onclick handlers need these on window
window.openPasswordModal = openPasswordModal;
window.changeAccess      = changeAccess;
window.completePO        = completePO;
window.openReceiveForm   = openReceiveForm;
window.openReturnForm    = openReturnForm;
window.saveGoodsReceipt  = saveGoodsReceipt;
window.saveGoodsReturn   = saveGoodsReturn;
window.closeGoodsForm    = closeGoodsForm;
window.viewGoodsHistory  = viewGoodsHistory;

// ─── Init ──────────────────────────────────────────────────────────────────────

loadUsers();