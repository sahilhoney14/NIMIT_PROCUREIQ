// ─── DOM References ────────────────────────────────────────────────────────────

// Purchase Requests
const manualButton        = document.getElementById("manualButton");
const excelButton         = document.getElementById("excelButton");
const manualSection       = document.getElementById("manualSection");
const excelSection        = document.getElementById("excelSection");
const manualForm          = document.getElementById("manualForm");
const productCategorySelect   = document.getElementById("product_category");
const productCategoryOther    = document.getElementById("product_category_other");
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
const vendorInquiryList = document.getElementById("vendorInquiryList");

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

// Vendor Inquiries page — browser exposes element IDs as globals, but we
// declare it explicitly so the reference is clear and lint-safe.
const vendorInquiriesPage = document.getElementById("vendorInquiriesPage");

// Logout
const logoutButton = document.getElementById("logoutButton");

// ─── State ─────────────────────────────────────────────────────────────────────

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
    message.textContent = text;
}

function showVendorMessage(text) {
    vendorMessage.textContent = text;
}

function formatDate(value) {
    if (!value) return "-";
    // Server returns MySQL DATE columns as plain YYYY-MM-DD strings (dateStrings: true).
    // Parse the date parts directly to avoid UTC-vs-local timezone shifts.
    const parts = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (parts) {
        const [, y, m, d] = parts;
        return `${d}/${m}/${y}`;
    }
    // Fallback for unexpected formats
    const dt = new Date(value);
    return isNaN(dt.getTime()) ? String(value) : dt.toLocaleDateString("en-IN");
}

function formatCurrency(value) {
    const n = Number(value);
    return isNaN(n) ? "-" : n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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


// FIX: always derive today's date in IST, not UTC.
// new Date().toISOString() is UTC and gives yesterday's date in IST between
// midnight and 05:30 IST.
function todayISO() {
    const d = new Date();
    const ist = new Date(d.toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
    return `${ist.getFullYear()}-${String(ist.getMonth() + 1).padStart(2, "0")}-${String(ist.getDate()).padStart(2, "0")}`;
}

// ─── Fetch wrapper: handle 401 / non-JSON (session expiry) ────────────────────
// FIX: instead of silently swallowing "Failed to connect" on every non-JSON
// response, redirect to the auth service when the session has expired.

const AUTH_URL = "http://localhost:5000"; // must match authServiceUrl on the backend

let procRefreshPromise = null;

async function silentRefreshTokenProc() {
    if (!procRefreshPromise) {
        procRefreshPromise = (async () => {
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
                procRefreshPromise = null;
            }
        })();
    }
    return procRefreshPromise;
}

async function apiFetch(url, options = {}) {
    const token = localStorage.getItem("auth_token");
    const headers = { ...options.headers };
    if (token && !headers["Authorization"]) {
        headers["Authorization"] = `Bearer ${token}`;
    }
    const response = await fetch(url, { credentials: "include", ...options, headers });
    if (response.status === 401 && !options._retry) {
        const refreshedToken = await silentRefreshTokenProc();
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
    if (response.status === 403) {
        const errJson = await response.clone().json().catch(() => null);
        alert(errJson?.message || "Forbidden: You do not have permission to perform this action.");
    }
    return response;
}

// Prevent scroll from changing number input values
document.addEventListener("wheel", event => {
    if (document.activeElement?.type === "number") {
        document.activeElement.blur();
    }
}, { passive: true });

// ─── Purchase Request: Taxable Value ───────────────────────────────────────────

function calculateTaxableValue() {
    const qty  = Number(qtyInput.value)       || 0;
    const rate = Number(salesRateInput.value) || 0;
    taxableValueInput.value = (qty * rate).toFixed(2);
}

// Guard: inputs may not exist on every page variant.
if (qtyInput)       qtyInput.addEventListener("input", calculateTaxableValue);
if (salesRateInput) salesRateInput.addEventListener("input", calculateTaxableValue);

// ─── Sidebar Navigation ────────────────────────────────────────────────────────

document.querySelectorAll(".main-menu").forEach(button => {
    button.addEventListener("click", () => {
        const sectionId = button.dataset.section;
        const section   = document.getElementById(sectionId);

        document.querySelectorAll(".main-menu").forEach(b => b.classList.remove("active"));
        document.querySelectorAll(".submenu").forEach(s => s.classList.remove("open"));

        button.classList.add("active");
        if (section) section.classList.add("open");

        if (sectionId === "workspace") {
            const wsBtn = section?.querySelector('[data-page="workspace-dashboard"]');
            if (wsBtn) wsBtn.click();
        }
    });
});

document.querySelectorAll(".submenu-item").forEach(button => {
    button.addEventListener("click", () => {
        if (button.classList.contains("disabled")) return;

        document.querySelectorAll(".submenu-item").forEach(b => b.classList.remove("active"));
        document.querySelectorAll(".page").forEach(p => p.classList.add("hidden"));

        button.classList.add("active");

        const page = button.dataset.page;

        if (page === "workspace-dashboard") {
            document.getElementById("workspaceDashboardPage").classList.remove("hidden");
            if (window.WorkspaceDashboard) {
                window.WorkspaceDashboard.load();
            }
        }

        if (page === "purchase-requests") {
            document.getElementById("purchaseRequestsPage").classList.remove("hidden");
        }

        if (page === "vendor-masters") {
            document.getElementById("vendorMastersPage").classList.remove("hidden");
            setTurnoverYears();
        }

        if (page === "vendor-inquiries") {
            vendorInquiriesPage.classList.remove("hidden");
            loadVendorInquiries();
        }

        if (page === "quotation-comparisons") {
            document.getElementById("quotationComparisonsPage").classList.remove("hidden");
            loadQuotationComparisons();
        }

        if (page === "order-tracking") {
            document.getElementById("orderTrackingPage").classList.remove("hidden");
            orderTrackingPage = 1;
            loadOrderTracking();
        }

        if (page === "purchase-orders") {
            document.getElementById("purchaseOrdersPage").classList.remove("hidden");
            loadPurchaseOrders();
        }

        if (page === "goods-received") {
            document.getElementById("goodsReceivedPage").classList.remove("hidden");
            loadGoodsReceived();
        }

        if (page === "vendor-performance") {
            document.getElementById("vendorPerformancePage").classList.remove("hidden");
            loadVendorPerformance();
        }

        if (page === "past-price-reference") {
            document.getElementById("pastPriceReferencePage").classList.remove("hidden");
            initPastPriceReference();
        }
    });
});

// ─── PR Toggle: Manual / Excel ─────────────────────────────────────────────────

manualButton.addEventListener("click", () => {
    manualButton.classList.add("active");
    excelButton.classList.remove("active");
    manualSection.classList.remove("hidden");
    excelSection.classList.add("hidden");
    showMessage("");
});

excelButton.addEventListener("click", () => {
    excelButton.classList.add("active");
    manualButton.classList.remove("active");
    excelSection.classList.remove("hidden");
    manualSection.classList.add("hidden");
    showMessage("");
});

// ─── Product Category 'Other' Toggle ───────────────────────────────────────────

productCategorySelect?.addEventListener("change", () => {
    if (productCategorySelect.value === "Other") {
        if (productCategoryOther) {
            productCategoryOther.style.display = "block";
            productCategoryOther.required = true;
            productCategoryOther.focus();
        }
    } else {
        if (productCategoryOther) {
            productCategoryOther.style.display = "none";
            productCategoryOther.required = false;
            productCategoryOther.value = "";
        }
    }
});

manualForm?.addEventListener("reset", () => {
    if (productCategoryOther) {
        productCategoryOther.style.display = "none";
        productCategoryOther.required = false;
        productCategoryOther.value = "";
    }
});

// ─── PR Manual Form Submit ─────────────────────────────────────────────────────

manualForm.addEventListener("submit", async event => {
    event.preventDefault();

    const selectedCategory = productCategorySelect?.value === "Other"
        ? (productCategoryOther?.value || "").trim()
        : (productCategorySelect?.value || "").trim();

    if (!selectedCategory) {
        showMessage("Please specify the product category");
        if (productCategorySelect?.value === "Other" && productCategoryOther) {
            productCategoryOther.focus();
        } else if (productCategorySelect) {
            productCategorySelect.focus();
        }
        return;
    }

    const data = {
        pr_date:          document.getElementById("pr_date").value,
        party_name:       document.getElementById("party_name").value,
        location:         document.getElementById("location").value,
        territory:        document.getElementById("territory").value,
        product_category: selectedCategory,
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

excelFile.addEventListener("change", () => {
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

importButton.addEventListener("click", async () => {
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

        const todayStr = todayISO(); // FIX: use IST-safe todayISO()
        importedRows.forEach(row => {
            if (!row.pr_date || String(row.pr_date).trim() === "") {
                row.pr_date = todayStr;
            }
        });

        renderPreview();
        showMessage(`${importedRows.length} rows ready for review. Edit if needed, then click Save.`);

    } catch {
        showMessage("Failed to connect to procurement service");
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

        // FIX: pr_date uses type="date" so the browser validates the format
        // and the user cannot type free-text like "28/09/2026".
        tr.innerHTML = `
            <td><input type="date" data-index="${index}" data-field="pr_date" value="${escapeHtml(row.pr_date || "")}"></td>
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

// ─── PR Excel: Save Imported Rows ─────────────────────────────────────────────

saveImportedButton.addEventListener("click", async () => {
    if (!importedRows.length) {
        showMessage("No rows available to save");
        return;
    }

    // FIX: validate every row before sending to the server.
    const dateRe = /^\d{4}-\d{2}-\d{2}$/;
    for (const [i, r] of importedRows.entries()) {
        const rowNum = i + 1;
        if (!dateRe.test(String(r.pr_date || "").trim())) {
            showMessage(`Row ${rowNum}: date must be YYYY-MM-DD (use the date picker)`);
            return;
        }
        if (!(Number(r.qty) > 0)) {
            showMessage(`Row ${rowNum}: quantity must be greater than 0`);
            return;
        }
        if (!(Number(r.sales_rate) > 0)) {
            showMessage(`Row ${rowNum}: sales rate must be greater than 0`);
            return;
        }
    }

    try {
        saveImportedButton.disabled = true;
        showMessage("Saving purchase requests...");

        const response = await apiFetch("/purchase-requests/import", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ rows: importedRows })
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

        showMessage("");
        clearPrExcel();

    } catch {
        showMessage("Failed to connect to procurement service");
    } finally {
        saveImportedButton.disabled = false;
    }
});

// ─── Vendor Toggle: Manual / Excel ────────────────────────────────────────────

vendorManualButton.addEventListener("click", () => {
    vendorManualButton.classList.add("active");
    vendorExcelButton.classList.remove("active");
    vendorManualSection.classList.remove("hidden");
    vendorExcelSection.classList.add("hidden");
    showVendorMessage("");
});

vendorExcelButton.addEventListener("click", () => {
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
        { id: "turnover_value_3", text: t3Label, required: false }
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
        { id: "excel_itr_third_last_year_document", text: itr3Label }
    ].forEach(({ id, text }) => {
        const input = document.getElementById(id);
        if (!input) return;
        const label = input.closest(".form-group")?.querySelector("label");
        if (label) {
            label.textContent = text;
        }
    });
}

// Restrict user typing in real time: prevent numbers in name fields, prevent non-digits in phone/bank fields
function attachVendorInputRestrictions() {
    const personNameIds = [
        "office_name", "director_name", "sales_name", "accounts_name",
        "factory_name", "warehouse_name", "workshop_name",
        "branch1_name", "branch2_name", "branch3_name",
        "recommended_by", "approved_by"
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
        "branch1_contact", "branch2_contact", "branch3_contact"
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
        { id: "pan_number", fn: v => v.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10) },
        { id: "gst_number", fn: v => v.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 15) },
        { id: "ifsc_rtgs", fn: v => v.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 11) },
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
attachVendorInputRestrictions();

// ─── Vendor Masters: Prefill recommended_by / approved_by ─────────────────────
// FIX: read currentUsername at the time the form initialises, not at script
// load time (it may not be set yet when the script first runs).

function prefillVendorFormMeta() {
    const regDate = document.getElementById("registration_date");
    const recBy   = document.getElementById("recommended_by");
    const appBy   = document.getElementById("approved_by");

    if (regDate && !regDate.value) regDate.value = todayISO();
    if (recBy   && !recBy.value)   recBy.value   = window.currentUsername || "";
    if (appBy   && !appBy.value)   appBy.value   = window.currentUsername || "";
}

prefillVendorFormMeta();

// ─── Vendor Masters: GST Duplicate Check ──────────────────────────────────────

// FIX: track whether a GST alert has already been shown in this blur cycle so
// submit doesn't pop a second popup.
let _lastGSTChecked = "";
let _lastGSTValid   = true;

async function checkVendorGST(gstNumber) {
    const trimmed = (gstNumber || "").trim();
    if (!trimmed) return true;

    // Return cached result for the same value so blur + submit don't double-alert.
    if (trimmed === _lastGSTChecked) return _lastGSTValid;

    try {
        const response = await apiFetch(`/vendors/check-gst?gst_number=${encodeURIComponent(trimmed)}`);
        if (!response) return false;

        const result = await response.json();

        if (!response.ok) {
            showVendorMessage(result.message || "Failed to check GST number");
            _lastGSTChecked = trimmed;
            _lastGSTValid   = false;
            return false;
        }

        if (result.exists) {
            alert(`A company with this GST number already exists: ${result.vendor_name}`);
            _lastGSTChecked = trimmed;
            _lastGSTValid   = false;
            return false;
        }

        _lastGSTChecked = trimmed;
        _lastGSTValid   = true;
        return true;

    } catch {
        showVendorMessage("Failed to connect to procurement service");
        _lastGSTChecked = "";
        _lastGSTValid   = false;
        return false;
    }
}

document.getElementById("gst_number").addEventListener("blur", async event => {
    await checkVendorGST(event.target.value);
});

// ─── Vendor Masters: Manual Form Validation ────────────────────────────────────

// FIX: validate required fields on the frontend before the fetch so users get
// a clear field-level message instead of a generic backend error.
const VENDOR_REQUIRED_FIELDS = [
    ["registration_date",                         "Registration Date"],
    ["vendor_name",                               "Vendor Name"],
    ["office_address",                            "Office Address"],
    ["office_name",                               "Office Contact Name"],
    ["office_phone",                              "Office Contact Number"],
    ["legal_entity",                              "Legal Entity"],
    ["commercial_role",                           "Commercial Role"],
    ["year_of_incorporation",                     "Year of Incorporation"],
    ["director_name",                             "Director / CEO Name"],
    ["director_designation",                      "Director / CEO Designation"],
    ["director_mobile",                           "Director / CEO Mobile"],
    ["director_email",                            "Director / CEO Email"],
    ["gst_number",                                "GST Number"],
    ["pan_number",                                "PAN Number"],
    ["bank_name",                                 "Bank Name"],
    ["account_no",                                "Bank Account Number"],
    ["bank_branch",                               "Bank Branch"],
    ["account_type",                              "Account Type"],
    ["ifsc_rtgs",                                 "IFSC / RTGS Code"]
];

const VENDOR_REQUIRED_DOCUMENTS = []; // Documents are optional

function validateVendorForm() {
    for (const [id, label] of VENDOR_REQUIRED_FIELDS) {
        const el = document.getElementById(id);
        if (!el || !el.value.trim()) {
            showVendorMessage(`${label} is required`);
            el?.focus();
            return false;
        }
    }

    const vendorName = String(document.getElementById("vendor_name")?.value ?? "").trim();
    if (/^\d+$/.test(vendorName)) {
        showVendorMessage("Vendor name cannot be only numbers. Please enter a valid company name.");
        return false;
    }
    if (!/[a-zA-Z]/.test(vendorName)) {
        showVendorMessage("Vendor name must contain valid letters.");
        return false;
    }

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
        if (val && /\d/.test(val)) {
            showVendorMessage(`${label} cannot contain numbers. Only letters are allowed.`);
            return false;
        }
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
        if (req && !val) {
            showVendorMessage(`${label} is required`);
            return false;
        }
        if (val && !/^\d{10}$/.test(val)) {
            showVendorMessage(`${label} must be a valid 10-digit number.`);
            return false;
        }
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    for (const [id, label, req] of [["director_email", "Director email", true], ["sales_email", "Sales team email", false], ["accounts_email", "Accounts team email", false]]) {
        const val = String(document.getElementById(id)?.value ?? "").trim();
        if (req && !val) {
            showVendorMessage(`${label} is required`);
            return false;
        }
        if (val && !emailRegex.test(val)) {
            showVendorMessage(`${label} must be a valid email address.`);
            return false;
        }
    }

    const yearVal = String(document.getElementById("year_of_incorporation")?.value ?? "").trim();
    const curYear = new Date().getFullYear();
    if (!/^\d{4}$/.test(yearVal) || parseInt(yearVal, 10) < 1800 || parseInt(yearVal, 10) > curYear) {
        showVendorMessage(`Year of incorporation must be a valid 4-digit year (between 1800 and ${curYear}).`);
        return false;
    }

    const bankNameVal = String(document.getElementById("bank_name")?.value ?? "").trim();
    if (/^\d+$/.test(bankNameVal)) {
        showVendorMessage("Bank name cannot be only numbers.");
        return false;
    }

    const accVal = String(document.getElementById("account_no")?.value ?? "").trim();
    if (!/^\d{9,18}$/.test(accVal)) {
        showVendorMessage("Bank account number must be between 9 and 18 digits.");
        return false;
    }

    const ifscVal = String(document.getElementById("ifsc_rtgs")?.value ?? "").trim();
    if (!/^[A-Z]{4}0[A-Z0-9]{6}$/i.test(ifscVal)) {
        showVendorMessage("IFSC code must be 11 alphanumeric characters (e.g. SBIN0001234).");
        return false;
    }

    const t1 = String(document.getElementById("turnover_value_1")?.value ?? "").trim().replace(/,/g, "");
    if (t1 && (isNaN(Number(t1)) || Number(t1) < 0)) {
        showVendorMessage("Turnover must be a valid numeric amount.");
        return false;
    }

    for (const [id, label] of VENDOR_REQUIRED_DOCUMENTS) {
        const el = document.getElementById(id);
        if (!el || !el.files?.[0]) {
            showVendorMessage(`${label} document is required`);
            return false;
        }
    }

    return true;
}

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
    _lastGSTChecked = "";
    _lastGSTValid   = true;
    [
        "excel_gst_document", "excel_pan_document", "excel_msme_document",
        "excel_itr_last_year_document", "excel_itr_second_last_year_document", "excel_itr_third_last_year_document"
    ].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = "";
    });
    showVendorMessage("");
}

vendorExcelFile.addEventListener("change", () => {
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

// ─── Vendor Masters: Manual Form Submit ───────────────────────────────────────

vendorManualForm.addEventListener("submit", async event => {
    event.preventDefault();

    // FIX: run frontend validation first.
    if (!validateVendorForm()) return;
    if (!(await checkVendorGST(document.getElementById("gst_number").value))) return;

    const turnoverLabel = (inputId) => {
        const input = document.getElementById(inputId);
        const label = input?.closest(".form-group")?.querySelector("label");
        return label ? label.textContent.replace(/\*/g, "").replace("Turnover", "").trim() : "";
    };

    const field = id => document.getElementById(id)?.value ?? "";

    const data = {
        // FIX: read currentUsername at save time so it's never blank.
        registration_date:                         field("registration_date") || todayISO(),
        vendor_code:                               field("vendor_code").trim(),
        vendor_name:                               field("vendor_name"),

        office_address:                            field("office_address"),
        office_contact_name:                       field("office_name"),
        office_contact_number:                     field("office_phone"),
        factory_address:                           field("factory_address"),
        factory_contact_name:                      field("factory_name"),
        factory_contact_number:                    field("factory_phone"),
        warehouse_address:                         field("warehouse_address"),
        warehouse_contact_name:                    field("warehouse_name"),
        warehouse_contact_number:                  field("warehouse_phone"),
        workshop_address:                          field("workshop_address"),
        workshop_contact_name:                     field("workshop_name"),
        workshop_contact_number:                   field("workshop_phone"),

        legal_entity:                              field("legal_entity"),
        commercial_role:                           field("commercial_role"),
        year_of_incorporation:                     field("year_of_incorporation"),

        director_or_ceo_or_management_name:        field("director_name"),
        director_or_ceo_or_management_designation: field("director_designation"),
        director_or_ceo_or_management_mobile_no:   field("director_mobile"),
        director_or_ceo_or_management_email:       field("director_email"),
        director_or_ceo_or_management_web_address: field("director_web"),

        sales_team_name:                           field("sales_name"),
        sales_team_contact:                        field("sales_contact"),
        sales_team_email:                          field("sales_email"),
        accounts_team_name:                        field("accounts_name"),
        accounts_team_contact:                     field("accounts_contact"),
        accounts_team_email:                       field("accounts_email"),

        gst_number:                                field("gst_number"),
        pan_number:                                field("pan_number"),
        msme_number:                               field("msme_number"),

        bank_name:                                 field("bank_name"),
        bank_account_no:                           field("account_no"),
        bank_branch:                               field("bank_branch"),
        bank_account_type:                         field("account_type"),
        bank_ifsc:                                 field("ifsc_rtgs"),

        branch_office_1_address:                   field("branch1_address"),
        branch_office_1_contact_name:              field("branch1_name"),
        branch_office_1_contact_number:            field("branch1_contact"),
        branch_office_2_address:                   field("branch2_address"),
        branch_office_2_contact_name:              field("branch2_name"),
        branch_office_2_contact_number:            field("branch2_contact"),
        branch_office_3_address:                   field("branch3_address"),
        branch_office_3_contact_name:              field("branch3_name"),
        branch_office_3_contact_number:            field("branch3_contact"),

        turnover_year_1:                           turnoverLabel("turnover_value_1"),
        turnover_value_1:                          field("turnover_value_1"),
        turnover_year_2:                           turnoverLabel("turnover_value_2"),
        turnover_value_2:                          field("turnover_value_2"),
        turnover_year_3:                           turnoverLabel("turnover_value_3"),
        turnover_value_3:                          field("turnover_value_3"),

        recommended_by:                            field("recommended_by") || window.currentUsername || "",
        approved_by:                               field("approved_by")    || window.currentUsername || ""
    };

    const formData = new FormData();
    formData.append("vendor_data", JSON.stringify(data));

    ["gst_document", "pan_document", "msme_document",
     "itr_last_year_document", "itr_second_last_year_document", "itr_third_last_year_document"
    ].forEach(f => {
        const file = document.getElementById(f)?.files[0];
        if (file) formData.append(f, file);
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
        prefillVendorFormMeta();
        _lastGSTChecked = "";
        _lastGSTValid   = true;

    } catch {
        showVendorMessage("Failed to connect to procurement service");
    } finally {
        submitBtn.disabled = false;
    }
});

// ─── Vendor Masters: Excel Template Download & Bulk Import Preview ─────────────

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
        showVendorMessage("Failed to connect to procurement service");
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

        const result = await response.json();

        if (!response.ok || !result.success) {
            vendorInquiryList.textContent = result.message || "Failed to load inquiries";
            return;
        }

        renderVendorInquiries(result.inquiries || []);

    } catch {
        vendorInquiryList.textContent = "Failed to connect to procurement service";
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
        const id   = inquiry.inquiry_id;
        const card = document.createElement("div");
        card.className = "inquiry-card";

        card.dataset.prNumber = inquiry.pr_number  || "";
        card.dataset.itemName = inquiry.item_name  || "";

        card.innerHTML = `
            <div class="inquiry-card-info">
                <div class="inquiry-card-item">
                    <span class="inquiry-card-label">PR Number</span>
                    <span class="inquiry-card-value">${escapeHtml(inquiry.pr_number || "-")}</span>
                </div>
                <div class="inquiry-card-item">
                    <span class="inquiry-card-label">PR Date</span>
                    <span class="inquiry-card-value">${formatDate(inquiry.pr_date)}</span>
                </div>
                <div class="inquiry-card-item">
                    <span class="inquiry-card-label">Party Name</span>
                    <span class="inquiry-card-value">${escapeHtml(inquiry.party_name || "-")}</span>
                </div>
                <div class="inquiry-card-item">
                    <span class="inquiry-card-label">Location</span>
                    <span class="inquiry-card-value">${escapeHtml(inquiry.location || "-")}</span>
                </div>
                <div class="inquiry-card-item">
                    <span class="inquiry-card-label">Territory</span>
                    <span class="inquiry-card-value">${escapeHtml(inquiry.territory || "-")}</span>
                </div>
                <div class="inquiry-card-item">
                    <span class="inquiry-card-label">Product Category</span>
                    <span class="inquiry-card-value">${escapeHtml(inquiry.product_category || "-")}</span>
                </div>
                <div class="inquiry-card-item">
                    <span class="inquiry-card-label">Item Name</span>
                    <span class="inquiry-card-value">${escapeHtml(inquiry.item_name || "-")}</span>
                </div>
                <div class="inquiry-card-item">
                    <span class="inquiry-card-label">Make / Model</span>
                    <span class="inquiry-card-value">
                        ${escapeHtml(inquiry.make || "-")} / ${escapeHtml(inquiry.model || "-")}
                    </span>
                </div>
                <div class="inquiry-card-item">
                    <span class="inquiry-card-label">Quantity</span>
                    <span class="inquiry-card-value">
                        ${escapeHtml(String(inquiry.qty ?? 0))} ${escapeHtml(inquiry.unit || "")}
                    </span>
                </div>
                <div class="inquiry-card-item">
                    <span class="inquiry-card-label">Sales Rate</span>
                    <span class="inquiry-card-value">${formatCurrency(inquiry.sales_rate)}</span>
                </div>
                <div class="inquiry-card-item">
                    <span class="inquiry-card-label">Taxable Value</span>
                    <span class="inquiry-card-value">${formatCurrency(inquiry.taxable_value)}</span>
                </div>
                <div class="inquiry-card-item">
                    <span class="inquiry-card-label">Product Remarks</span>
                    <span class="inquiry-card-value">${escapeHtml(inquiry.product_remarks || "-")}</span>
                </div>
            </div>

            <div class="inquiry-card-footer">
                <button
                    type="button"
                    class="primary-button add-vendor-btn"
                    data-inquiry-id="${id}"
                    data-qty="${inquiry.qty ?? 0}">
                    + Add Vendor
                </button>
                <span class="inquiry-status">OPEN</span>
            </div>

            <!-- Inline add-vendor form (hidden by default) -->
            <div class="add-vendor-form" id="addVendorForm-${id}" style="display:none">
                <h3>Add Vendor Quotation</h3>

                                <div class="form-group vendor-search-form-group">
                    <label>Vendor</label>
                    <div class="vendor-search-wrap" id="vendorSearchWrap-${id}">
                        <div class="vendor-search-input-box">
                            <svg class="vendor-search-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <circle cx="11" cy="11" r="8"></circle>
                                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                            </svg>
                            <input
                                type="text"
                                class="vendor-search-input"
                                placeholder="Type vendor name or code to search..."
                                autocomplete="off"
                            >
                            <button type="button" class="vendor-search-clear-btn" title="Clear selection" style="display:none;">✕</button>
                            <button type="button" class="vendor-search-toggle-btn" title="Show all registered vendors">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                                    <polyline points="6 9 12 15 18 9"></polyline>
                                </svg>
                            </button>
                        </div>
                        <input type="hidden" class="vendor-id-input" value="">
                        <select class="vendor-select" style="display:none;" required>
                            <option value="">Select Vendor</option>
                        </select>
                        <div class="vendor-search-dropdown hidden"></div>
                    </div>
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
                    <input type="date" class="vendor-delivery-date" min="${todayISO()}">
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

            <!-- Vendor quotation table -->
            <div class="inquiry-vendor-section" id="vendorsSection-${id}" hidden></div>
        `;

        vendorInquiryList.appendChild(card);

        // FIX: load existing quotations immediately so returning users see them.
        loadInquiryVendors(id);

        // FIX: wire up the form's live-calculation listeners once, here, so
        // they are never duplicated no matter how many times the form is
        // opened or closed.
        wireVendorForm(id, Number(inquiry.qty ?? 0));
    });
}

// ─── Vendor Inquiries: Wire Form Listeners (once per card) ────────────────────
// FIX: all input listeners are attached once at render time, not inside the
// click handler. This removes stacked listener accumulation and ensures the
// advance preview recalculates correctly when either price OR advance % changes.

function wireVendorForm(inquiryId, qty) {
    const form         = document.getElementById(`addVendorForm-${inquiryId}`);
    if (!form) return;

    const priceEl          = form.querySelector(".vendor-price");
    const totalDisplayEl   = form.querySelector(".vendor-total-display");
    const advancePctEl     = form.querySelector(".vendor-advance-pct");
    const advancePreviewGp = form.querySelector(".vendor-advance-preview-group");
    const advancePreviewEl = form.querySelector(".vendor-advance-preview");
    const balanceDaysGroup = form.querySelector(".balance-days-group");
    const balanceDaysEl    = form.querySelector(".vendor-balance-days");

    function recalcTotals() {
        const price = Number(priceEl.value) || 0;
        const pct   = Number(advancePctEl.value);

        // Total price
        if (price > 0 && qty > 0) {
            const total = price * qty;
            totalDisplayEl.value = `₹${total.toLocaleString("en-IN", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            })}`;

            // Advance amount — recalculate whenever price changes too
            if (pct > 0) {
                const amount = (pct / 100) * total;
                advancePreviewEl.value = `₹${amount.toLocaleString("en-IN", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                })}`;
                advancePreviewGp.style.display = "";
            } else {
                advancePreviewGp.style.display = "none";
                advancePreviewEl.value = "";
            }
        } else {
            totalDisplayEl.value   = "";
            advancePreviewGp.style.display = "none";
            advancePreviewEl.value = "";
        }

        // Balance days visibility
        balanceDaysGroup.style.display = (pct > 0 && pct < 100) ? "" : "none";
        if (pct >= 100 || pct === 0) balanceDaysEl.value = "";
    }

    priceEl.addEventListener("input", recalcTotals);
    advancePctEl.addEventListener("input", recalcTotals);
}

// ─── Vendor Inquiries: Delegated Click Handler ─────────────────────────────────
// FIX: this listener is attached once (not inside renderVendorInquiries).

vendorInquiryList.addEventListener("click", async event => {

    // ── Add Vendor button → open form + load dropdown ──
    const addBtn = event.target.closest(".add-vendor-btn");
    if (addBtn) {
        const inquiryId = addBtn.dataset.inquiryId;
        const form = document.getElementById(`addVendorForm-${inquiryId}`);
        if (!form) return;

        form.style.display = "";

        // FIX: load vendors and filter out already-quoted ones.
        // The /vendor-inquiries/:id response includes vendor_id on each row.
        const select = form.querySelector(".vendor-select");
        await loadVendorsIntoDropdown(select, inquiryId);

        return;
    }

    // ── Cancel → hide form ──
    const cancelBtn = event.target.closest(".cancel-vendor-btn");
    if (cancelBtn) {
        const inquiryId = cancelBtn.dataset.inquiryId;
        const form = document.getElementById(`addVendorForm-${inquiryId}`);
        if (form) {
            form.style.display = "none";
            const dd = form.querySelector(".vendor-search-dropdown");
            const w = form.querySelector(".vendor-search-wrap");
            if (dd) dd.classList.add("hidden");
            if (w) w.classList.remove("open");
        }
        return;
    }

    // ── Save Vendor ──
    const saveBtn = event.target.closest(".save-vendor-btn");
    if (saveBtn) {
        await saveVendorForInquiry(saveBtn.dataset.inquiryId);
        return;
    }
});


// ─── Vendor Inquiries: Searchable Vendor Combobox Helper ───────────────────────

function escapeVendorRegex(str) {
    return String(str || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function highlightVendorMatch(text, query) {
    if (!text) return "";
    const escaped = escapeHtml(String(text));
    const q = (query || "").trim();
    if (!q) return escaped;
    try {
        const qEsc = escapeVendorRegex(q);
        return escaped.replace(new RegExp(`(${qEsc})`, "gi"), '<mark class="vendor-search-mark">$1</mark>');
    } catch {
        return escaped;
    }
}

function setupVendorSearch(form) {
    if (!form || form.dataset.vendorSearchWired === "1") return;
    form.dataset.vendorSearchWired = "1";

    const wrap      = form.querySelector(".vendor-search-wrap");
    const input     = form.querySelector(".vendor-search-input");
    const clearBtn  = form.querySelector(".vendor-search-clear-btn");
    const toggleBtn = form.querySelector(".vendor-search-toggle-btn");
    const dropdown  = form.querySelector(".vendor-search-dropdown");
    const idInput   = form.querySelector(".vendor-id-input");
    const select    = form.querySelector(".vendor-select");
    if (!wrap || !input || !dropdown) return;

    let activeIndex = -1;

    function renderList(query = "") {
        const vendors = form._registeredVendors || [];
        const q = (query || "").trim().toLowerCase();

        const filtered = q
            ? vendors.filter(v => {
                const name = (v.vendor_name || "").toLowerCase();
                const code = (v.vendor_code || "").toLowerCase();
                const gst  = (v.gst_number || "").toLowerCase();
                return name.includes(q) || code.includes(q) || gst.includes(q);
            })
            : vendors;

        if (!filtered.length) {
            dropdown.innerHTML = `<div class="vendor-search-empty">No registered vendors found${q ? ` for "<strong>${escapeHtml(query)}</strong>"` : ""}</div>`;
            dropdown.classList.remove("hidden");
            wrap.classList.add("open");
            activeIndex = -1;
            return;
        }

        const currentId = idInput?.value || select?.value || "";

        dropdown.innerHTML = filtered.map((v, idx) => {
            const isSelected = String(v.vendor_id) === String(currentId);
            const codeStr = v.vendor_code ? ` (${v.vendor_code})` : "";
            const fullLabel = `${v.vendor_name}${codeStr}`;
            return `
                <div class="vendor-search-item ${isSelected ? "selected" : ""}"
                     data-id="${v.vendor_id}"
                     data-name="${escapeHtml(v.vendor_name)}"
                     data-code="${escapeHtml(v.vendor_code || "")}"
                     data-index="${idx}">
                    <span class="vendor-search-item-name">${highlightVendorMatch(fullLabel, q)}</span>
                    ${isSelected ? `<span class="vendor-search-check">✓</span>` : ""}
                </div>
            `;
        }).join("");

        dropdown.classList.remove("hidden");
        wrap.classList.add("open");
        activeIndex = -1;
    }

    function selectVendorObj(vendor) {
        if (!vendor) {
            input.value = "";
            if (idInput) idInput.value = "";
            if (select) select.value = "";
            clearBtn.style.display = "none";
            dropdown.classList.add("hidden");
            wrap.classList.remove("open");
            return;
        }

        const codeStr = vendor.vendor_code ? ` (${vendor.vendor_code})` : "";
        input.value = `${vendor.vendor_name}${codeStr}`;
        if (idInput) idInput.value = String(vendor.vendor_id);
        if (select) {
            select.value = String(vendor.vendor_id);
            select.dispatchEvent(new Event("change", { bubbles: true }));
        }
        clearBtn.style.display = "";
        dropdown.classList.add("hidden");
        wrap.classList.remove("open");

        const msgEl = form.querySelector(".vendor-form-message");
        if (msgEl && msgEl.textContent.includes("select a vendor")) {
            msgEl.textContent = "";
        }
    }

    // Input typing
    input.addEventListener("input", () => {
        clearBtn.style.display = input.value ? "" : "none";
        if (idInput) idInput.value = "";
        if (select) select.value = "";
        renderList(input.value);
    });

    // Input focus - show dropdown
    input.addEventListener("focus", () => {
        renderList(input.value);
    });

    // Input click - if closed, open it
    input.addEventListener("click", () => {
        if (dropdown.classList.contains("hidden")) {
            renderList(input.value);
        }
    });

    // Toggle button (chevron)
    toggleBtn?.addEventListener("click", e => {
        e.preventDefault();
        e.stopPropagation();
        if (dropdown.classList.contains("hidden")) {
            input.focus();
            renderList("");
        } else {
            dropdown.classList.add("hidden");
            wrap.classList.remove("open");
        }
    });

    // Clear button
    clearBtn?.addEventListener("click", e => {
        e.preventDefault();
        e.stopPropagation();
        selectVendorObj(null);
        input.focus();
        renderList("");
    });

    // Keyboard navigation
    input.addEventListener("keydown", e => {
        const items = dropdown.querySelectorAll(".vendor-search-item");
        if (e.key === "ArrowDown") {
            e.preventDefault();
            if (dropdown.classList.contains("hidden")) {
                renderList(input.value);
                return;
            }
            if (items.length > 0) {
                activeIndex = (activeIndex + 1) % items.length;
                updateActiveItem(items);
            }
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            if (items.length > 0) {
                activeIndex = (activeIndex - 1 + items.length) % items.length;
                updateActiveItem(items);
            }
        } else if (e.key === "Enter") {
            if (!dropdown.classList.contains("hidden") && items.length > 0) {
                e.preventDefault();
                const target = activeIndex >= 0 ? items[activeIndex] : items[0];
                if (target) {
                    const id = target.dataset.id;
                    const vendor = (form._registeredVendors || []).find(v => String(v.vendor_id) === String(id));
                    if (vendor) selectVendorObj(vendor);
                }
            }
        } else if (e.key === "Escape") {
            dropdown.classList.add("hidden");
            wrap.classList.remove("open");
        }
    });

    function updateActiveItem(items) {
        items.forEach((it, idx) => {
            if (idx === activeIndex) {
                it.classList.add("highlighted");
                it.scrollIntoView({ block: "nearest" });
            } else {
                it.classList.remove("highlighted");
            }
        });
    }

    // Item click
    dropdown.addEventListener("click", e => {
        const item = e.target.closest(".vendor-search-item");
        if (!item) return;
        const id = item.dataset.id;
        const vendor = (form._registeredVendors || []).find(v => String(v.vendor_id) === String(id));
        if (vendor) {
            selectVendorObj(vendor);
        }
    });

    // Close on outside click
    document.addEventListener("click", e => {
        if (!wrap.contains(e.target)) {
            dropdown.classList.add("hidden");
            wrap.classList.remove("open");

            if (input.value.trim() && (!idInput?.value || !select?.value)) {
                const q = input.value.trim().toLowerCase();
                const exact = (form._registeredVendors || []).find(v => 
                    (v.vendor_name || "").toLowerCase() === q ||
                    `${v.vendor_name} (${v.vendor_code})`.toLowerCase() === q ||
                    (v.vendor_code && v.vendor_code.toLowerCase() === q)
                );
                if (exact) {
                    selectVendorObj(exact);
                }
            }
        }
    });
}

// ─── Vendor Inquiries: Populate Vendor Dropdown ────────────────────────────────

async function loadVendorsIntoDropdown(selectElement, inquiryId) {
    const form = selectElement.closest(".add-vendor-form");
    const previous = form?.querySelector(".vendor-id-input")?.value || selectElement.value;
    selectElement.innerHTML = '<option value="">Loading vendors...</option>';

    if (form) {
        setupVendorSearch(form);
        const searchInput = form.querySelector(".vendor-search-input");
        if (searchInput && !previous) {
            searchInput.placeholder = "Loading registered vendors...";
        }
    }

    try {
        const [vendorsRes, inquiryRes] = await Promise.all([
            apiFetch("/vendors"),
            apiFetch(`/vendor-inquiries/${inquiryId}`)
        ]);

        if (!vendorsRes || !inquiryRes) return;

        const [vendorsResult, inquiryResult] = await Promise.all([
            vendorsRes.json(),
            inquiryRes.json()
        ]);

        if (!vendorsRes.ok || !vendorsResult.success) {
            throw new Error(vendorsResult.message || "Failed to load vendors");
        }

        const quotedIds = new Set(
            (inquiryResult.vendors || []).map(v => v.vendor_id)
        );

        const vendors = (vendorsResult.vendors || [])
            .filter(v => !quotedIds.has(v.vendor_id))
            .sort((a, b) => (a.vendor_name || "").localeCompare(b.vendor_name || ""));

        if (form) {
            form._registeredVendors = vendors;
            const searchInput = form.querySelector(".vendor-search-input");
            if (searchInput) {
                searchInput.placeholder = "Type vendor name or code to search...";
            }
        }

        if (!vendors.length) {
            selectElement.innerHTML = '<option value="">No eligible vendors available</option>';
            if (form) {
                const searchInput = form.querySelector(".vendor-search-input");
                if (searchInput) searchInput.placeholder = "No eligible vendors available";
            }
            return;
        }

        selectElement.innerHTML = '<option value="">Select Vendor</option>';
        vendors.forEach(vendor => {
            const option       = document.createElement("option");
            option.value       = vendor.vendor_id;
            option.textContent = `${vendor.vendor_name} (${vendor.vendor_code || vendor.vendor_id})`;
            selectElement.appendChild(option);
        });

        if (previous) {
            const matched = vendors.find(v => String(v.vendor_id) === String(previous));
            if (matched) {
                selectElement.value = previous;
                if (form) {
                    const searchInput = form.querySelector(".vendor-search-input");
                    const idInput = form.querySelector(".vendor-id-input");
                    const clearBtn = form.querySelector(".vendor-search-clear-btn");
                    if (idInput) idInput.value = String(matched.vendor_id);
                    if (searchInput) searchInput.value = `${matched.vendor_name}${matched.vendor_code ? ` (${matched.vendor_code})` : ""}`;
                    if (clearBtn) clearBtn.style.display = "";
                }
            }
        }

    } catch {
        selectElement.innerHTML = '<option value="">Failed to load vendors</option>';
        if (form) {
            const searchInput = form.querySelector(".vendor-search-input");
            if (searchInput) searchInput.placeholder = "Failed to load vendors";
        }
    }
}

// ─── Vendor Inquiries: Save Quotation ─────────────────────────────────────────

async function saveVendorForInquiry(inquiryId) {
    const form             = document.getElementById(`addVendorForm-${inquiryId}`);
    const select           = form.querySelector(".vendor-select");
    const vendorIdInput    = form.querySelector(".vendor-id-input");
    const searchInput      = form.querySelector(".vendor-search-input");
    const priceEl          = form.querySelector(".vendor-price");
    const deliveryDateEl   = form.querySelector(".vendor-delivery-date");
    const advancePctEl     = form.querySelector(".vendor-advance-pct");
    const balanceDaysEl    = form.querySelector(".vendor-balance-days");
    const paymentRemarksEl = form.querySelector(".vendor-payment-remarks");
    const msgEl            = form.querySelector(".vendor-form-message");
    const saveBtn          = form.querySelector(".save-vendor-btn");

    const vendorId   = vendorIdInput?.value || select?.value;
    const vendorName = searchInput?.value || select?.options[select?.selectedIndex]?.text || "";
    const price      = Number(priceEl.value);
    const advancePct = advancePctEl.value !== "" ? Number(advancePctEl.value) : null;

    if (!vendorId)                  { msgEl.textContent = "Please select a vendor."; return; }
    if (!price || price <= 0)       { msgEl.textContent = "Please enter a valid price per unit."; return; }
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
        // FIX: disable button immediately to prevent double-submit.
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
                payment_terms_remarks:  paymentRemarksEl.value.trim() || null
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

        // Reset form fields.
        select.value           = "";
        priceEl.value          = "";
        deliveryDateEl.value   = "";
        advancePctEl.value     = "";
        balanceDaysEl.value    = "";
        paymentRemarksEl.value = "";
        form.querySelector(".balance-days-group").style.display           = "none";
        form.querySelector(".vendor-advance-preview-group").style.display = "none";
        form.querySelector(".vendor-advance-preview").value               = "";
        form.querySelector(".vendor-total-display").value                 = "";

        form.style.display = "none";

        // Reload the quotations table for this card.
        await loadInquiryVendors(inquiryId);

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
    section.hidden = false;

    try {
        const response = await apiFetch(`/vendor-inquiries/${inquiryId}`);
        if (!response) return;

        const result = await response.json();

        if (!response.ok || !result.success) {
            section.innerHTML = `<em style='font-size:13px;color:#c00;'>${escapeHtml(result.message || "Failed to load vendors")}</em>`;
            return;
        }

        renderInquiryVendorTable(section, result.vendors || []);

    } catch {
        section.innerHTML = "<em style='font-size:13px;color:#c00;'>Failed to connect to procurement service</em>";
    }
}

function renderInquiryVendorTable(container, vendors) {
    if (!vendors.length) { container.innerHTML = ""; container.hidden = true; return; }

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

// ─── Logout ────────────────────────────────────────────────────────────────────

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

        showMessage(result.message || "Failed to logout");

    } catch {
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

        const result = await response.json();

        if (!response.ok || !result.success) {
            list.textContent = result.message || "Failed to load quotations";
            return;
        }

        renderQuotationComparisons(result.inquiries || []);

    } catch {
        list.textContent = "Failed to connect to procurement service";
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
                <div class="inquiry-card-item">
                    <span class="inquiry-card-label">PR Number</span>
                    <span class="inquiry-card-value">${escapeHtml(inquiry.pr_number || "-")}</span>
                </div>
                <div class="inquiry-card-item">
                    <span class="inquiry-card-label">PR Date</span>
                    <span class="inquiry-card-value">${formatDate(inquiry.pr_date)}</span>
                </div>
                <div class="inquiry-card-item">
                    <span class="inquiry-card-label">Party Name</span>
                    <span class="inquiry-card-value">${escapeHtml(inquiry.party_name || "-")}</span>
                </div>
                <div class="inquiry-card-item">
                    <span class="inquiry-card-label">Location</span>
                    <span class="inquiry-card-value">${escapeHtml(inquiry.location || "-")}</span>
                </div>
                <div class="inquiry-card-item">
                    <span class="inquiry-card-label">Territory</span>
                    <span class="inquiry-card-value">${escapeHtml(inquiry.territory || "-")}</span>
                </div>
                <div class="inquiry-card-item">
                    <span class="inquiry-card-label">Product Category</span>
                    <span class="inquiry-card-value">${escapeHtml(inquiry.product_category || "-")}</span>
                </div>
                <div class="inquiry-card-item">
                    <span class="inquiry-card-label">Item Name</span>
                    <span class="inquiry-card-value">${escapeHtml(inquiry.item_name || "-")}</span>
                </div>
                <div class="inquiry-card-item">
                    <span class="inquiry-card-label">Make / Model</span>
                    <span class="inquiry-card-value">
                        ${escapeHtml(inquiry.make || "-")} / ${escapeHtml(inquiry.model || "-")}
                    </span>
                </div>
                <div class="inquiry-card-item">
                    <span class="inquiry-card-label">Quantity</span>
                    <span class="inquiry-card-value">
                        ${escapeHtml(String(inquiry.qty ?? 0))} ${escapeHtml(inquiry.unit || "")}
                    </span>
                </div>
                <div class="inquiry-card-item">
                    <span class="inquiry-card-label">Sales Rate</span>
                    <span class="inquiry-card-value">${formatCurrency(inquiry.sales_rate)}</span>
                </div>
                <div class="inquiry-card-item">
                    <span class="inquiry-card-label">Taxable Value</span>
                    <span class="inquiry-card-value">${formatCurrency(inquiry.taxable_value)}</span>
                </div>
                <div class="inquiry-card-item">
                    <span class="inquiry-card-label">Product Remarks</span>
                    <span class="inquiry-card-value">${escapeHtml(inquiry.product_remarks || "-")}</span>
                </div>
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
                                </tr>
                            </thead>
                            <tbody>
                                ${inquiry.vendors.map(v => {
                                    const isLowest = lowestPrice !== null && Number(v.price_per_unit) === lowestPrice;
                                    return `
                                        <tr>
                                            <td>${escapeHtml(v.vendor_code || "-")}</td>
                                            <td>${escapeHtml(v.vendor_name || "-")}</td>
                                            <td class="${isLowest ? "lowest-price" : ""}">
                                                ${formatCurrency(v.price_per_unit)}
                                            </td>
                                            <td>${formatCurrency(v.total_price)}</td>
                                            <td>${v.advance_value != null ? `${escapeHtml(String(v.advance_value))}%` : "-"}</td>
                                            <td>${formatAdvanceAmount(v)}</td>
                                            <td>${formatDate(v.expected_delivery_date)}</td>
                                            <td>${v.balance_due_days != null ? escapeHtml(String(v.balance_due_days)) : "-"}</td>
                                            <td>${formatRemarks(v)}</td>
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
                    <div class="inquiry-card-item">
                        <span class="inquiry-card-label">PR Number</span>
                        <span class="inquiry-card-value">${escapeHtml(row.pr_number || "-")}</span>
                    </div>
                    ${row.po_number ? `
                    <div class="inquiry-card-item">
                        <span class="inquiry-card-label">PO Number</span>
                        <span class="inquiry-card-value">${escapeHtml(row.po_number)}</span>
                    </div>` : ""}
                    <div class="inquiry-card-item">
                        <span class="inquiry-card-label">PR Date</span>
                        <span class="inquiry-card-value">${formatDate(row.pr_date)}</span>
                    </div>
                    <div class="inquiry-card-item">
                        <span class="inquiry-card-label">Party Name</span>
                        <span class="inquiry-card-value">${escapeHtml(row.party_name || "-")}</span>
                    </div>
                    <div class="inquiry-card-item">
                        <span class="inquiry-card-label">Location</span>
                        <span class="inquiry-card-value">${escapeHtml(row.location || "-")}</span>
                    </div>
                    <div class="inquiry-card-item">
                        <span class="inquiry-card-label">Territory</span>
                        <span class="inquiry-card-value">${escapeHtml(row.territory || "-")}</span>
                    </div>
                    <div class="inquiry-card-item">
                        <span class="inquiry-card-label">Product Category</span>
                        <span class="inquiry-card-value">${escapeHtml(row.product_category || "-")}</span>
                    </div>
                    <div class="inquiry-card-item">
                        <span class="inquiry-card-label">Item Name</span>
                        <span class="inquiry-card-value">${escapeHtml(row.item_name || "-")}</span>
                    </div>
                    <div class="inquiry-card-item">
                        <span class="inquiry-card-label">Make / Model</span>
                        <span class="inquiry-card-value">${escapeHtml(row.make || "-")} / ${escapeHtml(row.model || "-")}</span>
                    </div>
                    <div class="inquiry-card-item">
                        <span class="inquiry-card-label">Quantity</span>
                        <span class="inquiry-card-value">${escapeHtml(String(row.qty ?? 0))} ${escapeHtml(row.unit || "")}</span>
                    </div>
                    <div class="inquiry-card-item">
                        <span class="inquiry-card-label">Sales Rate</span>
                        <span class="inquiry-card-value">${formatCurrency(row.sales_rate)}</span>
                    </div>
                    <div class="inquiry-card-item">
                        <span class="inquiry-card-label">Taxable Value</span>
                        <span class="inquiry-card-value">${formatCurrency(row.taxable_value)}</span>
                    </div>
                    <div class="inquiry-card-item">
                        <span class="inquiry-card-label">Product Remarks</span>
                        <span class="inquiry-card-value">${escapeHtml(row.product_remarks || "-")}</span>
                    </div>
                </div>
                ${renderOrderTrackingStepper(row)}
            </div>
        `;

        orderTrackingList.appendChild(card);
    });
}

// ─── Order Tracking: Pagination Buttons ────────────────────────────────────────

orderTrackingPrev.addEventListener("click", () => {
    if (orderTrackingPage > 1) {
        orderTrackingPage -= 1;
        loadOrderTracking();
    }
});

orderTrackingNext.addEventListener("click", () => {
    if (orderTrackingPage < orderTrackingTotalPages) {
        orderTrackingPage += 1;
        loadOrderTracking();
    }
});

// ─── Order Tracking: Expand Row ────────────────────────────────────────────────

orderTrackingList.addEventListener("click", event => {
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

        const result = await response.json();

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

// FIX: escape the label parameter — turnover_year_1/2/3 are free-text vendor
// fields and were previously rendered unescaped, creating a stored XSS vector.
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
                    ${po.po_date ? `
                    <div class="inquiry-card-item">
                        <span class="inquiry-card-label">PO Date</span>
                        <span class="inquiry-card-value">${formatDate(po.po_date)}</span>
                    </div>` : ""}
                    <div class="inquiry-card-item">
                        <span class="inquiry-card-label">PR Number</span>
                        <span class="inquiry-card-value">${escapeHtml(po.pr_number || "-")}</span>
                    </div>
                    <div class="inquiry-card-item">
                        <span class="inquiry-card-label">PR Date</span>
                        <span class="inquiry-card-value">${formatDate(po.pr_date)}</span>
                    </div>
                    <div class="inquiry-card-item">
                        <span class="inquiry-card-label">Party Name</span>
                        <span class="inquiry-card-value">${escapeHtml(po.party_name || "-")}</span>
                    </div>
                    <div class="inquiry-card-item">
                        <span class="inquiry-card-label">Location</span>
                        <span class="inquiry-card-value">${escapeHtml(po.location || "-")}</span>
                    </div>
                    <div class="inquiry-card-item">
                        <span class="inquiry-card-label">Territory</span>
                        <span class="inquiry-card-value">${escapeHtml(po.territory || "-")}</span>
                    </div>
                    <div class="inquiry-card-item">
                        <span class="inquiry-card-label">Product Category</span>
                        <span class="inquiry-card-value">${escapeHtml(po.product_category || "-")}</span>
                    </div>
                    <div class="inquiry-card-item">
                        <span class="inquiry-card-label">Item Name</span>
                        <span class="inquiry-card-value">${escapeHtml(po.item_name || "-")}</span>
                    </div>
                    <div class="inquiry-card-item">
                        <span class="inquiry-card-label">Make / Model</span>
                        <span class="inquiry-card-value">${escapeHtml(po.make || "-")} / ${escapeHtml(po.model || "-")}</span>
                    </div>
                    <div class="inquiry-card-item">
                        <span class="inquiry-card-label">Quantity</span>
                        <span class="inquiry-card-value">${escapeHtml(String(po.qty ?? 0))} ${escapeHtml(po.unit || "")}</span>
                    </div>
                    <div class="inquiry-card-item">
                        <span class="inquiry-card-label">Sales Rate</span>
                        <span class="inquiry-card-value">${formatCurrency(po.sales_rate)}</span>
                    </div>
                    <div class="inquiry-card-item">
                        <span class="inquiry-card-label">Taxable Value</span>
                        <span class="inquiry-card-value">${formatCurrency(po.taxable_value)}</span>
                    </div>
                    <div class="inquiry-card-item">
                        <span class="inquiry-card-label">Product Remarks</span>
                        <span class="inquiry-card-value">${escapeHtml(po.product_remarks || "-")}</span>
                    </div>
                </div>

                <div class="inquiry-card-footer">
                    <button type="button" class="primary-button vendor-details-toggle" data-po-id="${po.po_id}">
                        Show Vendor Details
                    </button>

                    ${po.status === "DRAFT" ? `
                        <button type="button" class="primary-button issue-po-btn" data-po-id="${po.po_id}">
                            Issue PO
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

purchaseOrdersList.addEventListener("click", async event => {

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
        const poId  = vendorBtn.dataset.poId;
        const panel = document.getElementById(`vendorDetailsPanel-${poId}`);
        const isOpen = panel.classList.toggle("open");
        vendorBtn.textContent = isOpen ? "Hide Vendor Details" : "Show Vendor Details";
        return;
    }

    // ── Issue PO ──────────────────────────────────────────────────────────────

    const issuePOBtn = event.target.closest(".issue-po-btn");
    if (issuePOBtn) {
        const poId = issuePOBtn.dataset.poId;
        if (!confirm("Issue this Purchase Order?")) return;

        issuePOBtn.disabled    = true;
        issuePOBtn.textContent = "Issuing...";

        try {
            const response = await apiFetch(`/purchase-orders/${poId}/issue`, { method: "POST" });
            if (!response) return;

            if (!response.ok) {
                const result = await response.json().catch(() => ({}));
                alert(result.message || "Failed to issue PO.");
                issuePOBtn.disabled    = false;
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
            issuePOBtn.disabled    = false;
            issuePOBtn.textContent = "Issue PO";
        } finally {
            // Cleanup if needed
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
});

// ─── Goods Received ───────────────────────────────────────────────────────────

async function loadGoodsReceived() {
    try {
        goodsReceivedMessage.textContent = "Loading goods received...";

        const response = await apiFetch("/goods-received");
        if (!response) return;

        const result = await response.json();

        if (!response.ok) {
            goodsReceivedMessage.textContent = result.message || "Failed to load goods received";
            return;
        }

        const activeOrders = (result.orders || []).filter(o => o.po_status !== "COMPLETED");

        renderGoodsReceived(activeOrders);
        goodsReceivedMessage.textContent = "";

    } catch (error) {
        console.error(error);
        goodsReceivedMessage.textContent = "Failed to connect to procurement service";
    }
}

function renderGoodsReceived(rows) {
    if (!rows.length) {
        goodsReceivedList.innerHTML = `
            <div class="message">No purchase orders available for goods receipt.</div>
        `;
        return;
    }

    goodsReceivedList.innerHTML = rows.map(po => {
        const ordered   = Number(po.ordered_quantity)   || 0;
        const received  = Number(po.received_quantity)  || 0;
        const remaining = Number(po.remaining_quantity) || 0;
        const progress  = Number(po.progress)           || 0;

        // FIX: "Mark Complete" should compare net received (after returns)
        // against ordered quantity. The backend already does this calculation
        // and returns received_quantity as the net figure.
        const canComplete = ordered > 0 && (received >= ordered || remaining <= 0 || progress >= 100);

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
                    <button class="primary-button" onclick="openReceiveForm(${po.po_id}, this)">
                        Add Received
                    </button>
                    <button class="secondary-button" onclick="openReturnForm(${po.po_id}, this)">
                        Return
                    </button>
                    ${canComplete ? `
                        <button class="secondary-button" onclick="completePO(${po.po_id}, this)">
                            Mark Complete
                        </button>
                    ` : ""}
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
                <input type="date" id="receipt-date-${poId}" value="${todayISO()}" max="${todayISO()}" required>
            </div>
            <div class="form-group full-width">
                <label>Remarks <span style="font-weight:400;color:#888;">(optional)</span></label>
                <textarea id="receipt-remarks-${poId}" placeholder="Optional remarks"></textarea>
            </div>
        </div>
        <div class="goods-form-actions">
            <button class="primary-button" id="save-receipt-btn-${poId}" onclick="saveGoodsReceipt(${poId})">Save Receipt</button>
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
                <input type="date" id="return-date-${poId}" value="${todayISO()}" max="${todayISO()}" required>
            </div>
            <div class="form-group full-width">
                <label>Reason <span style="color:#c00;">*</span></label>
                <textarea id="return-reason-${poId}" required placeholder="Enter reason for return"></textarea>
            </div>
        </div>
        <div class="goods-form-actions">
            <button class="primary-button" id="save-return-btn-${poId}" onclick="saveGoodsReturn(${poId})">Save Return</button>
            <button class="cancel-vendor-btn" onclick="closeGoodsForm(${poId}, 'return')">Cancel</button>
        </div>
    `;

    form.classList.remove("hidden");
}

// FIX: saveGoodsReceipt and saveGoodsReturn disable their submit button
// immediately to prevent double-posting of stock data.
async function saveGoodsReceipt(poId) {
    const receivedQuantity = Number(document.getElementById(`received-quantity-${poId}`).value);
    const receiptDate      = document.getElementById(`receipt-date-${poId}`).value;
    const remarks          = document.getElementById(`receipt-remarks-${poId}`).value.trim();
    const btn              = document.getElementById(`save-receipt-btn-${poId}`);

    if (!receivedQuantity || receivedQuantity <= 0) { alert("Received quantity must be greater than 0."); return; }
    if (!receiptDate)                               { alert("Receipt date is required."); return; }

    try {
        if (btn) btn.disabled = true;

        const response = await apiFetch("/goods-received", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                po_id:             poId,
                receipt_date:      receiptDate,
                received_quantity: receivedQuantity,
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

async function saveGoodsReturn(poId) {
    const returnQuantity = Number(document.getElementById(`return-quantity-${poId}`).value);
    const returnDate     = document.getElementById(`return-date-${poId}`).value;
    const returnReason   = document.getElementById(`return-reason-${poId}`).value.trim();
    const btn            = document.getElementById(`save-return-btn-${poId}`);

    if (!returnQuantity || returnQuantity <= 0) { alert("Return quantity must be greater than 0."); return; }
    if (!returnDate)                            { alert("Return date is required."); return; }
    if (!returnReason)                          { alert("Return reason is required."); return; }

    try {
        if (btn) btn.disabled = true;

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

        const result = await response.json();

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

// FIX: completePO disables the button immediately to prevent double-submit.
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
// FIX: the click listener for drill-down is attached once here at module level,
// NOT inside loadVendorPerformance/renderVendorPerformance. The original code
// stacked a new listener on every visit to the page, causing the row to
// open-and-immediately-close on the second visit.

const vendorPerformanceList = document.getElementById("vendorPerformanceList");

vendorPerformanceList.addEventListener("click", async event => {
    const btn = event.target.closest(".vp-drill-btn");
    if (!btn) return;

    const vendorId  = btn.dataset.vendorId;
    const detailRow = document.getElementById(`vpDetail-${vendorId}`);
    const content   = document.getElementById(`vpDetailContent-${vendorId}`);
    const isOpen    = detailRow.style.display !== "none";

    // Collapse all others.
    vendorPerformanceList.querySelectorAll(".vp-detail-row").forEach(r => r.style.display = "none");
    vendorPerformanceList.querySelectorAll(".vp-drill-btn").forEach(b => b.textContent = "Details ▾");

    if (isOpen) return;

    btn.textContent        = "Details ▴";
    detailRow.style.display = "";
    content.innerHTML      = "Loading...";

    try {
        const response = await apiFetch(`/vendor-performance/${vendorId}`);
        if (!response) return;

        const result = await response.json();

        if (!response.ok || !result.success) {
            content.innerHTML = escapeHtml(result.message || "Failed to load details");
            return;
        }

        renderVendorPerformanceDetail(content, result);

    } catch {
        content.innerHTML = "Failed to connect to procurement service";
    }
});

let allVendorPerformance = [];
let vpFiltersInitialized = false;

async function loadVendorPerformance() {
    const msg = document.getElementById("vendorPerformanceMessage");

    vendorPerformanceList.innerHTML = "";
    msg.textContent = "Loading vendor performance...";

    initVendorPerformanceFilters();

    try {
        const response = await apiFetch("/vendor-performance");
        if (!response) return;

        const result = await response.json();

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

function renderVendorPerformance(vendors) {
    if (!vendors.length) {
        vendorPerformanceList.innerHTML = `
            <div class="ev-no-results" style="padding: 40px 20px; text-align: center; background: #fff; border: 1px solid #e2e8f0; border-radius: 12px;">
                <div style="font-size: 32px; margin-bottom: 8px;">🔍</div>
                <div style="font-size: 16px; font-weight: 700; color: #0f172a; margin-bottom: 4px;">No matching vendors found</div>
                <div style="font-size: 13px; color: #64748b;">Try adjusting your search terms or filter criteria.</div>
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
                    <tr>
                        <td>${escapeHtml(v.vendor_code || "-")}</td>
                        <td>${escapeHtml(v.vendor_name)}</td>
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
                            <button
                                type="button"
                                class="option-button vp-drill-btn"
                                data-vendor-id="${v.vendor_id}"
                                data-vendor-name="${escapeHtml(v.vendor_name)}">
                                Details ▾
                            </button>
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

    vendorPerformanceList.appendChild(table);
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
// FIX: listeners are attached once (pprListenersAttached guard) instead of on
// every call to initPastPriceReference, preventing accumulation across visits.
// FIX: the model list is refreshed on every page open so newly added products appear.
// FIX: loadPPRDetail guards against a blank model string before calling the API.

let pprModelList = [];
let pprListenersAttached = false;

async function loadPPRModels() {
    try {
        const response = await apiFetch("/past-price-reference/models");
        if (!response) return;

        const result = await response.json();
        if (result.success) pprModelList = result.models || [];

    } catch {
        // Silently fail — the search box will simply yield no suggestions.
    }
}

function initPastPriceReference() {
    const input    = document.getElementById("pprSearchInput");
    const dropdown = document.getElementById("pprDropdown");

    // Refresh the model list on every page open so new products appear.
    loadPPRModels();

    // Reset UI state.
    input.value = "";
    document.getElementById("pprResults").innerHTML   = "";
    document.getElementById("pprMessage").textContent = "";
    document.getElementById("pprSelectedLabel").classList.add("hidden");
    dropdown.classList.add("hidden");

    // FIX: only attach listeners once.
    if (!pprListenersAttached) {
        input.addEventListener("input", onPPRInput);
        input.addEventListener("keydown", (e) => {
            if (e.key === "Enter") {
                e.preventDefault();
                const first = dropdown.querySelector(".ppr-dropdown-item");
                if (first) first.click();
            }
        });
        document.addEventListener("click", onPPROutsideClick);
        pprListenersAttached = true;
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

    results.innerHTML   = "";
    msg.textContent     = "Loading past price reference...";
    label.classList.add("hidden");

    try {
        const params = new URLSearchParams();
        if (model) params.set("model", model);
        if (make) params.set("make", make);
        if (itemName) params.set("item_name", itemName);

        const response = await apiFetch(`/past-price-reference?${params.toString()}`);
        if (!response) return;

        const result = await response.json();

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

// ─── Window exports (called from inline onclick attributes in goods-received) ──

window.completePO       = completePO;
window.openReceiveForm  = openReceiveForm;
window.openReturnForm   = openReturnForm;
window.saveGoodsReceipt = saveGoodsReceipt;
window.saveGoodsReturn  = saveGoodsReturn;
window.closeGoodsForm   = closeGoodsForm;
window.viewGoodsHistory = viewGoodsHistory;

// ─── Workspace Dashboard Init ──────────────────────────────────────────────────
if (window.WorkspaceDashboard) {
    window.WorkspaceDashboard.init({
        isAdmin: false,
        onNewPr: () => {
            const prBtn = document.querySelector('[data-page="purchase-requests"]');
            if (prBtn) prBtn.click();
        }
    });
    window.WorkspaceDashboard.load();
}