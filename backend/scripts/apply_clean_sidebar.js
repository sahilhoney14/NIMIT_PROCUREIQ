const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..', '..');

// 1. Update frontend/admin/index.html
const indexHtmlPath = path.join(rootDir, 'frontend', 'admin', 'index.html');
let indexHtml = fs.readFileSync(indexHtmlPath, 'utf8');

const cleanSidebarHtml = `        <aside class="sidebar" id="mainSidebar">

            <!-- 1. Workspace Dropdown -->
            <div class="nav-dropdown-group open" id="group-workspace">
                <button type="button" class="nav-dropdown-toggle active-parent" data-dropdown="workspace">
                    <svg class="nav-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
                        <polyline points="9 22 9 12 15 12 15 22"></polyline>
                    </svg>
                    <span class="nav-label">Workspace</span>
                    <svg class="nav-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="6 9 12 15 18 9"></polyline>
                    </svg>
                </button>
                <div class="nav-submenu" id="submenu-workspace">
                    <button type="button" class="nav-submenu-item submenu-item active" data-page="workspace-dashboard">
                        <span class="submenu-dot"></span>
                        <span>Workspace Dashboard</span>
                    </button>
                    <button type="button" class="nav-submenu-item submenu-item" data-page="purchase-requests">
                        <span class="submenu-dot"></span>
                        <span>Purchase Requests</span>
                    </button>
                    <button type="button" class="nav-submenu-item submenu-item" data-page="vendor-inquiries">
                        <span class="submenu-dot"></span>
                        <span>Vendor Inquiries</span>
                    </button>
                    <button type="button" class="nav-submenu-item submenu-item" data-page="quotation-comparisons">
                        <span class="submenu-dot"></span>
                        <span>Quotation &amp; Comparisons</span>
                    </button>
                    <button type="button" class="nav-submenu-item submenu-item" data-page="purchase-orders">
                        <span class="submenu-dot"></span>
                        <span>Purchase Orders</span>
                    </button>
                    <button type="button" class="nav-submenu-item submenu-item" data-page="order-tracking">
                        <span class="submenu-dot"></span>
                        <span>Order Tracking</span>
                    </button>
                    <button type="button" class="nav-submenu-item submenu-item" data-page="goods-received">
                        <span class="submenu-dot"></span>
                        <span>Goods Received</span>
                    </button>
                </div>
            </div>

            <!-- 2. Vendors Dropdown -->
            <div class="nav-dropdown-group" id="group-vendors">
                <button type="button" class="nav-dropdown-toggle" data-dropdown="vendors">
                    <svg class="nav-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                        <circle cx="9" cy="7" r="4"></circle>
                        <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                        <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                    </svg>
                    <span class="nav-label">Vendors</span>
                    <svg class="nav-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="6 9 12 15 18 9"></polyline>
                    </svg>
                </button>
                <div class="nav-submenu" id="submenu-vendors">
                    <button type="button" class="nav-submenu-item submenu-item" data-page="edit-vendor">
                        <span class="submenu-dot"></span>
                        <span>Vendor Detail</span>
                    </button>
                    <button type="button" class="nav-submenu-item submenu-item" data-page="vendor-masters">
                        <span class="submenu-dot"></span>
                        <span>Vendor/OEM Masters</span>
                    </button>
                    <button type="button" class="nav-submenu-item submenu-item" data-page="vendor-performance">
                        <span class="submenu-dot"></span>
                        <span>Vendor Performance</span>
                    </button>
                </div>
            </div>

            <!-- 3. Intelligence Dropdown -->
            <div class="nav-dropdown-group" id="group-intelligence">
                <button type="button" class="nav-dropdown-toggle" data-dropdown="intelligence">
                    <svg class="nav-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                        <line x1="18" y1="20" x2="18" y2="10"></line>
                        <line x1="12" y1="20" x2="12" y2="4"></line>
                        <line x1="6" y1="20" x2="6" y2="14"></line>
                    </svg>
                    <span class="nav-label">Intelligence</span>
                    <svg class="nav-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="6 9 12 15 18 9"></polyline>
                    </svg>
                </button>
                <div class="nav-submenu" id="submenu-intelligence">
                    <button type="button" class="nav-submenu-item submenu-item" data-page="past-price-reference">
                        <span class="submenu-dot"></span>
                        <span>Past Price Reference</span>
                    </button>
                </div>
            </div>

            <!-- 4. Management Dropdown -->
            <div class="nav-dropdown-group" id="group-management">
                <button type="button" class="nav-dropdown-toggle" data-dropdown="management">
                    <svg class="nav-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                        <circle cx="12" cy="12" r="3"></circle>
                        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
                    </svg>
                    <span class="nav-label">Management</span>
                    <svg class="nav-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="6 9 12 15 18 9"></polyline>
                    </svg>
                </button>
                <div class="nav-submenu" id="submenu-management">
                    <button type="button" class="nav-submenu-item submenu-item" data-page="management-insights">
                        <span class="submenu-dot"></span>
                        <span>Management Insights</span>
                    </button>
                    <button type="button" class="nav-submenu-item submenu-item" data-page="reports-audits">
                        <span class="submenu-dot"></span>
                        <span>Reports &amp; Audits</span>
                    </button>
                </div>
            </div>

            <!-- 5. Users (Direct Navigation Item - Last in Sidebar) -->
            <button type="button" class="nav-direct-item submenu-item" data-page="manage-access">
                <svg class="nav-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                    <circle cx="12" cy="7" r="4"></circle>
                </svg>
                <span class="nav-label">Users</span>
            </button>

            <!-- Footer Brand -->
            <div class="sidebar-footer-brand">
                <span class="sidebar-developed-by">Developed by</span>
                <img src="/logo" alt="NIMIT" class="sidebar-nimit-logo" onerror="this.onerror=null; this.src='nimit-brand-logo.png';">
            </div>
        </aside>`;

const asideRegex = /<aside class="sidebar"[\s\S]*?<\/aside>/;
if (asideRegex.test(indexHtml)) {
    indexHtml = indexHtml.replace(asideRegex, cleanSidebarHtml.trim());
    // Also bump version query
    indexHtml = indexHtml.replace(/style\.css\?v=[\d.]+/g, 'style.css?v=2.4');
    indexHtml = indexHtml.replace(/script\.js\?v=[\d.]+/g, 'script.js?v=2.4');
    fs.writeFileSync(indexHtmlPath, indexHtml, 'utf8');
    console.log('Successfully updated frontend/admin/index.html to clean sidebar');
} else {
    console.error('Could not find <aside class="sidebar"> in frontend/admin/index.html');
}

// 2. CSS Updates
const cleanSidebarCss = `/* ─── Sidebar Container ─── */
.sidebar {
    width: 250px;
    height: 100%;
    flex-shrink: 0;
    background: #ffffff;
    border-right: 1px solid #eef2f6;
    padding: 14px 10px 16px 10px;
    display: flex;
    flex-direction: column;
    overflow-y: auto;
    overflow-x: hidden;
    scrollbar-width: thin;
    scrollbar-color: #cbd5e1 transparent;
    user-select: none;
    box-sizing: border-box;
}

.sidebar::-webkit-scrollbar {
    width: 5px;
}

.sidebar::-webkit-scrollbar-track {
    background: transparent;
}

.sidebar::-webkit-scrollbar-thumb {
    background: #e2e8f0;
    border-radius: 4px;
}

.sidebar::-webkit-scrollbar-thumb:hover {
    background: #cbd5e1;
}

/* ─── Dropdown Group ─── */
.nav-dropdown-group {
    margin-bottom: 3px;
    display: flex;
    flex-direction: column;
}

/* ─── Top-Level Dropdown Toggle ─── */
.nav-dropdown-toggle {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 11px;
    padding: 9.5px 12px;
    font-size: 13.5px;
    font-weight: 600;
    color: #1e293b;
    background: transparent;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    text-align: left;
    transition: background 0.15s ease, color 0.15s ease;
    box-sizing: border-box;
}

.nav-dropdown-toggle .nav-icon {
    width: 18px;
    height: 18px;
    flex-shrink: 0;
    color: #64748b;
    transition: color 0.15s ease;
}

.nav-dropdown-toggle .nav-label {
    flex: 1;
    line-height: 1.2;
}

.nav-dropdown-toggle .nav-chevron {
    margin-left: auto;
    width: 14px;
    height: 14px;
    color: #94a3b8;
    flex-shrink: 0;
    transition: transform 0.22s cubic-bezier(0.4, 0, 0.2, 1), color 0.15s ease;
}

.nav-dropdown-toggle:hover {
    background: #f8fafc;
    color: #0f172a;
}

.nav-dropdown-toggle:hover .nav-icon {
    color: #0f172a;
}

.nav-dropdown-toggle:hover .nav-chevron {
    color: #475569;
}

/* When dropdown is open: chevron rotates 180deg */
.nav-dropdown-group.open > .nav-dropdown-toggle .nav-chevron {
    transform: rotate(180deg);
    color: #0b57a4;
}

/* When parent has an active item inside */
.nav-dropdown-toggle.active-parent {
    color: #0b57a4;
    background: #f0f7ff;
}

.nav-dropdown-toggle.active-parent .nav-icon {
    color: #0b57a4;
}

/* ─── Direct Top-Level Item (e.g. Users) ─── */
.nav-direct-item {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 11px;
    padding: 9.5px 12px;
    margin-bottom: 3px;
    font-size: 13.5px;
    font-weight: 600;
    color: #1e293b;
    background: transparent;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    text-align: left;
    transition: background 0.15s ease, color 0.15s ease;
    box-sizing: border-box;
}

.nav-direct-item .nav-icon {
    width: 18px;
    height: 18px;
    flex-shrink: 0;
    color: #64748b;
    transition: color 0.15s ease;
}

.nav-direct-item .nav-label {
    flex: 1;
    line-height: 1.2;
}

.nav-direct-item:hover:not(.disabled) {
    background: #f8fafc;
    color: #0f172a;
}

.nav-direct-item:hover:not(.disabled) .nav-icon {
    color: #0f172a;
}

.nav-direct-item.active {
    background: #eff6ff;
    color: #0b57a4;
    box-shadow: inset 3.5px 0 0 #0b57a4;
}

.nav-direct-item.active .nav-icon {
    color: #0b57a4;
}

/* ─── Submenu Container ─── */
.nav-submenu {
    display: none;
    flex-direction: column;
    gap: 1px;
    margin: 2px 0 6px 18px;
    padding-left: 10px;
    border-left: 1.5px solid #e2e8f0;
}

.nav-dropdown-group.open > .nav-submenu {
    display: flex;
}

/* ─── Submenu Item ─── */
.nav-submenu-item {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 9px;
    padding: 7.5px 10px;
    margin-bottom: 2px;
    font-size: 13px;
    font-weight: 500;
    color: #475569;
    background: transparent;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    text-align: left;
    transition: background 0.15s ease, color 0.15s ease;
    box-sizing: border-box;
}

.nav-submenu-item .submenu-dot {
    width: 5px;
    height: 5px;
    border-radius: 50%;
    background: #94a3b8;
    flex-shrink: 0;
    transition: transform 0.15s ease, background 0.15s ease, box-shadow 0.15s ease;
}

.nav-submenu-item:hover:not(.disabled) {
    background: #f8fafc;
    color: #0f172a;
}

.nav-submenu-item:hover:not(.disabled) .submenu-dot {
    background: #475569;
    transform: scale(1.3);
}

.nav-submenu-item.active {
    background: #eff6ff;
    color: #0b57a4;
    font-weight: 600;
}

.nav-submenu-item.active .submenu-dot {
    background: #0b57a4;
    box-shadow: 0 0 0 2.5px rgba(11, 87, 164, 0.2);
    transform: scale(1.3);
}

.nav-submenu-item.disabled,
.nav-submenu-item:disabled {
    color: #cbd5e1;
    cursor: not-allowed;
}

/* Backward compatibility rules */
.main-menu {
    display: none;
}
.submenu {
    display: flex;
}`;

function updateCssFile(filePath) {
    if (!fs.existsSync(filePath)) return;
    let content = fs.readFileSync(filePath, 'utf8');
    const regex = /\.sidebar\s*\{[\s\S]*?(?=\.logout-button)/;
    if (regex.test(content)) {
        content = content.replace(regex, cleanSidebarCss + '\n\n');
        fs.writeFileSync(filePath, content, 'utf8');
        console.log('Updated CSS in', filePath);
    } else {
        console.error('Could not match sidebar CSS in', filePath);
    }
}

updateCssFile(path.join(rootDir, 'frontend', 'admin', 'style.css'));
updateCssFile(path.join(rootDir, 'frontend', 'admin', 'css', 'admin.css'));

// 3. JS Updates
const cleanNavJs = `// ─── Sidebar Dropdown Navigation ────────────────────────────────────────────────────────

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

        const page = button.dataset.page;`;

function updateJsFile(filePath) {
    if (!fs.existsSync(filePath)) return;
    let content = fs.readFileSync(filePath, 'utf8');
    const regex = /\/\/\s*───\s*Sidebar.*Navigation[\s\S]*?const page = button\.dataset\.page;/;
    if (regex.test(content)) {
        content = content.replace(regex, cleanNavJs);
        fs.writeFileSync(filePath, content, 'utf8');
        console.log('Updated JS in', filePath);
    } else {
        console.error('Could not match sidebar JS in', filePath);
    }
}

updateJsFile(path.join(rootDir, 'frontend', 'admin', 'script.js'));
updateJsFile(path.join(rootDir, 'frontend', 'admin', 'js', 'admin.js'));
