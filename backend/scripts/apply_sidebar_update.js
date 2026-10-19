const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..', '..');

// 1. Update frontend/admin/index.html
const indexHtmlPath = path.join(rootDir, 'frontend', 'admin', 'index.html');
let indexHtml = fs.readFileSync(indexHtmlPath, 'utf8');

const sidebarHtml = `        <aside class="sidebar" id="mainSidebar">

            <!-- ── SECTION: WORKSPACE ── -->
            <div class="nav-section-title">WORKSPACE</div>

            <button type="button" class="nav-item submenu-item active" data-page="workspace-dashboard">
                <svg class="nav-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
                    <polyline points="9 22 9 12 15 12 15 22"></polyline>
                </svg>
                <span>Dashboard</span>
            </button>

            <button type="button" class="nav-item submenu-item" data-page="purchase-requests">
                <svg class="nav-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="9 11 12 14 22 4"></polyline>
                    <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>
                </svg>
                <span>Purchase Requests</span>
            </button>

            <button type="button" class="nav-item submenu-item" data-page="vendor-inquiries">
                <svg class="nav-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                    <polyline points="22,6 12,13 2,6"></polyline>
                </svg>
                <span>Vendor Inquiries</span>
            </button>

            <button type="button" class="nav-item submenu-item" data-page="quotation-comparisons">
                <svg class="nav-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                    <line x1="3" y1="9" x2="21" y2="9"></line>
                    <line x1="9" y1="21" x2="9" y2="9"></line>
                </svg>
                <span>Quotation &amp; Comparisons</span>
            </button>

            <button type="button" class="nav-item submenu-item" data-page="purchase-orders">
                <svg class="nav-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                    <polyline points="14 2 14 8 20 8"></polyline>
                    <line x1="16" y1="13" x2="8" y2="13"></line>
                    <line x1="16" y1="17" x2="8" y2="17"></line>
                </svg>
                <span>Purchase Orders</span>
            </button>

            <button type="button" class="nav-item submenu-item" data-page="order-tracking">
                <svg class="nav-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="12" cy="12" r="10"></circle>
                    <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"></polygon>
                </svg>
                <span>Order Tracking</span>
            </button>

            <button type="button" class="nav-item submenu-item" data-page="goods-received">
                <svg class="nav-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                    <rect x="1" y="3" width="15" height="13"></rect>
                    <polygon points="16 8 20 8 23 11 23 16 16 16 8"></polygon>
                    <circle cx="5.5" cy="18.5" r="2.5"></circle>
                    <circle cx="18.5" cy="18.5" r="2.5"></circle>
                </svg>
                <span>Goods Received</span>
            </button>

            <!-- ── SECTION: MASTER DATA ── -->
            <div class="nav-section-title">MASTER DATA</div>

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

            <!-- ── SECTION: ANALYTICS ── -->
            <div class="nav-section-title">ANALYTICS</div>

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

            <!-- ── SECTION: ADMINISTRATION ── -->
            <div class="nav-section-title">ADMINISTRATION</div>

            <button type="button" class="nav-item submenu-item" data-page="manage-access">
                <svg class="nav-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                    <circle cx="12" cy="7" r="4"></circle>
                </svg>
                <span>Users</span>
            </button>

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

            <div class="sidebar-footer-brand">
                <span class="sidebar-developed-by">Developed by</span>
                <img src="/logo" alt="NIMIT" class="sidebar-nimit-logo" onerror="this.onerror=null; this.src='nimit-brand-logo.png';">
            </div>
        </aside>`;

// Replace <aside class="sidebar"> ... </aside>
const asideRegex = /<aside class="sidebar"[\s\S]*?<\/aside>/;
if (asideRegex.test(indexHtml)) {
    indexHtml = indexHtml.replace(asideRegex, sidebarHtml.trim());
    fs.writeFileSync(indexHtmlPath, indexHtml, 'utf8');
    console.log('Successfully updated frontend/admin/index.html');
} else {
    console.error('Could not find <aside class="sidebar"> in frontend/admin/index.html');
}
