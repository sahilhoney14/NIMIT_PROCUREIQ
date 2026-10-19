const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..', '..');

const cssSidebarCode = `/* ─── Sidebar Container ─── */
.sidebar {
    width: 255px;
    height: 100%;
    flex-shrink: 0;
    background: #ffffff;
    border-right: 1px solid #e2e8f0;
    padding: 10px 10px 16px 10px;
    display: flex;
    flex-direction: column;
    overflow-y: auto;
    overflow-x: hidden;
    scrollbar-width: thin;
    scrollbar-color: #cbd5e1 transparent;
    user-select: none;
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

/* ─── Sidebar Category Section Title ─── */
.nav-section-title {
    font-size: 10.5px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: #64748b;
    padding: 16px 12px 6px 12px;
    user-select: none;
    display: flex;
    align-items: center;
}

.nav-section-title:first-child {
    padding-top: 6px;
}

/* ─── Direct Navigation Item ─── */
.nav-item {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8.5px 12px;
    margin-bottom: 2px;
    font-size: 13.5px;
    font-weight: 500;
    color: #334155;
    background: transparent;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    text-align: left;
    transition: background 0.15s ease, color 0.15s ease;
    box-sizing: border-box;
}

.nav-item .nav-icon {
    flex-shrink: 0;
    color: #64748b;
    transition: color 0.15s ease;
}

.nav-item:hover:not(.disabled) {
    background: #f1f5f9;
    color: #0f172a;
}

.nav-item:hover:not(.disabled) .nav-icon {
    color: #0f172a;
}

.nav-item.active {
    background: #eff6ff;
    color: #0b57a4;
    font-weight: 600;
    box-shadow: inset 3.5px 0 0 #0b57a4;
}

.nav-item.active .nav-icon {
    color: #0b57a4;
}

/* ─── Dropdown Group ─── */
.nav-dropdown-group {
    margin-bottom: 2px;
    display: flex;
    flex-direction: column;
}

/* ─── Dropdown Toggle Header ─── */
.nav-dropdown-toggle {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8.5px 12px;
    font-size: 13.5px;
    font-weight: 500;
    color: #334155;
    background: transparent;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    text-align: left;
    transition: background 0.15s ease, color 0.15s ease;
    box-sizing: border-box;
}

.nav-dropdown-toggle .nav-icon {
    flex-shrink: 0;
    color: #64748b;
    transition: color 0.15s ease;
}

.nav-dropdown-toggle .nav-label {
    flex: 1;
}

.nav-dropdown-toggle .nav-chevron {
    margin-left: auto;
    color: #94a3b8;
    flex-shrink: 0;
    transition: transform 0.22s cubic-bezier(0.4, 0, 0.2, 1), color 0.15s ease;
}

.nav-dropdown-toggle:hover {
    background: #f1f5f9;
    color: #0f172a;
}

.nav-dropdown-toggle:hover .nav-icon {
    color: #0f172a;
}

.nav-dropdown-toggle:hover .nav-chevron {
    color: #475569;
}

.nav-dropdown-group.open > .nav-dropdown-toggle .nav-chevron {
    transform: rotate(180deg);
    color: #0b57a4;
}

.nav-dropdown-group.has-active > .nav-dropdown-toggle {
    color: #0b57a4;
    font-weight: 600;
}

.nav-dropdown-group.has-active > .nav-dropdown-toggle .nav-icon {
    color: #0b57a4;
}

/* ─── Submenu Container ─── */
.nav-submenu {
    max-height: 0;
    opacity: 0;
    overflow: hidden;
    margin-left: 19px;
    padding-left: 10px;
    border-left: 1.5px solid #e2e8f0;
    transition: max-height 0.25s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.2s ease, margin 0.2s ease;
    margin-top: 0;
    margin-bottom: 0;
    display: flex;
    flex-direction: column;
}

.nav-dropdown-group.open > .nav-submenu {
    max-height: 320px;
    opacity: 1;
    margin-top: 3px;
    margin-bottom: 5px;
}

/* ─── Submenu Item ─── */
.nav-submenu-item {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 9px;
    padding: 7px 10px;
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

// Update CSS in a file
function updateCssFile(filePath) {
    if (!fs.existsSync(filePath)) return;
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Replace from `.sidebar {` to before `.logout-button {`
    const regex = /\.sidebar\s*\{[\s\S]*?(?=\.logout-button)/;
    if (regex.test(content)) {
        content = content.replace(regex, cssSidebarCode + '\n\n');
        fs.writeFileSync(filePath, content, 'utf8');
        console.log('Updated CSS in', filePath);
    } else {
        console.error('Could not match sidebar CSS in', filePath);
    }
}

updateCssFile(path.join(rootDir, 'frontend', 'admin', 'style.css'));
updateCssFile(path.join(rootDir, 'frontend', 'admin', 'css', 'admin.css'));

// Update JS files
const navJsCode = `// ─── Sidebar Navigation ────────────────────────────────────────────────────────

// Dropdown Toggles (Vendors, Intelligence, Management)
document.querySelectorAll(".nav-dropdown-toggle").forEach(button => {
    button.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        const group = button.closest(".nav-dropdown-group");
        if (!group) return;
        const wasOpen = group.classList.contains("open");
        group.classList.toggle("open", !wasOpen);
    });
});

// Backward compatibility for any remaining .main-menu elements
document.querySelectorAll(".main-menu").forEach(button => {
    button.addEventListener("click", () => {
        const sectionId = button.dataset.section;
        const section   = document.getElementById(sectionId) || document.getElementById(\`submenu-\${sectionId}\`);

        document.querySelectorAll(".main-menu").forEach(b => b.classList.remove("active"));
        document.querySelectorAll(".submenu, .nav-submenu").forEach(s => s.classList.remove("open"));

        button.classList.add("active");
        if (section) section.classList.add("open");
        const parentGroup = button.closest(".nav-dropdown-group");
        if (parentGroup) parentGroup.classList.add("open");
    });
});

// Actionable Navigation Items (.submenu-item)
document.querySelectorAll(".submenu-item").forEach(button => {
    button.addEventListener("click", () => {
        if (button.classList.contains("disabled") || button.disabled) return;

        // Clear active on all navigation items
        document.querySelectorAll(".submenu-item").forEach(b => b.classList.remove("active"));
        document.querySelectorAll(".page").forEach(p => p.classList.add("hidden"));

        button.classList.add("active");

        // Maintain dropdown group active indicator and ensure it stays open
        document.querySelectorAll(".nav-dropdown-group").forEach(g => g.classList.remove("has-active"));
        const parentGroup = button.closest(".nav-dropdown-group");
        if (parentGroup) {
            parentGroup.classList.add("has-active");
            parentGroup.classList.add("open");
        }

        const page = button.dataset.page;`;

function updateJsFile(filePath) {
    if (!fs.existsSync(filePath)) return;
    let content = fs.readFileSync(filePath, 'utf8');

    // Replace from `// ─── Sidebar Navigation ────────────────────────────────────────────────────────`
    // through `const page = button.dataset.page;`
    const regex = /\/\/\s*───\s*Sidebar Navigation[\s\S]*?const page = button\.dataset\.page;/;
    if (regex.test(content)) {
        content = content.replace(regex, navJsCode);
        fs.writeFileSync(filePath, content, 'utf8');
        console.log('Updated JS in', filePath);
    } else {
        console.error('Could not match sidebar JS in', filePath);
    }
}

updateJsFile(path.join(rootDir, 'frontend', 'admin', 'script.js'));
updateJsFile(path.join(rootDir, 'frontend', 'admin', 'js', 'admin.js'));
