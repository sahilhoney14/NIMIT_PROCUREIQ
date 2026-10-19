const fs = require("fs");
const path = require("path");

const rootDir = path.resolve(__dirname, "../..");

console.log("Removing borders in text across frontend files...");

// 1. Update CSS in style.css and css/admin.css
const cssReplacement = `/* Activity Report Styling - Clean, Borderless Natural Typography */
.activity-report-lead {
    font-size: 13px;
    line-height: 1.55;
    color: #1e293b;
}

.activity-actor {
    font-weight: 700;
    color: #0f172a;
    background: none !important;
    border: none !important;
    padding: 0 !important;
    margin-right: 2px;
}

.report-entity {
    color: #0f172a;
    font-weight: 700;
}

.report-meta {
    color: #64748b;
    font-size: 12.5px;
    margin-left: 2px;
}

.report-code-badge,
.report-code-text {
    font-family: inherit;
    font-size: inherit;
    font-weight: 600;
    color: #334155;
    background: none !important;
    border: none !important;
    padding: 0 !important;
    border-radius: 0 !important;
}

.report-ref-badge,
.report-ref-text {
    font-family: inherit;
    font-size: inherit;
    font-weight: 600;
    color: #1d4ed8;
    background: none !important;
    border: none !important;
    padding: 0 !important;
    border-radius: 0 !important;
}

.report-amount {
    color: #15803d;
    font-weight: 700;
}

.report-status-pill,
.report-status-text {
    font-size: inherit;
    font-weight: 700;
    color: #0f172a;
    background: none !important;
    border: none !important;
    padding: 0 !important;
    border-radius: 0 !important;
}

.status-text-danger {
    color: #b91c1c;
    font-weight: 600;
}

.status-text-success {
    color: #15803d;
    font-weight: 600;
}

.activity-report-text {
    font-size: 13px;
    line-height: 1.6;
    color: #334155;
}`;

const cssFiles = [
    "frontend/admin/style.css",
    "frontend/admin/css/admin.css",
    "frontend/procurement-manager/style.css",
    "frontend/procurement-manager/css/manager.css"
];

for (const rel of cssFiles) {
    const fullPath = path.join(rootDir, rel);
    if (!fs.existsSync(fullPath)) continue;

    let css = fs.readFileSync(fullPath, "utf8");

    const regex = /\/\* Activity Report Styling \*\/[\s\S]*?\.activity-report-text\s*\{[\s\S]*?\}/;
    if (regex.test(css)) {
        css = css.replace(regex, cssReplacement);
        fs.writeFileSync(fullPath, css, "utf8");
        console.log(`Updated Activity Report CSS in ${rel}`);
    } else {
        console.warn(`Could not match Activity Report CSS in ${rel}`);
    }
}

// 2. Update JS in script.js and js/admin.js
const jsFiles = [
    "frontend/admin/script.js",
    "frontend/admin/js/admin.js"
];

for (const rel of jsFiles) {
    const fullPath = path.join(rootDir, rel);
    if (!fs.existsSync(fullPath)) continue;

    let js = fs.readFileSync(fullPath, "utf8");

    // Replace <code class="report-code-badge">${escapeHtml(vCode)}</code> with <span class="report-code-badge">${escapeHtml(vCode)}</span>
    js = js.replace(/<code class="report-code-badge">\$\{escapeHtml\(vCode\)\}<\/code>/g, '<span class="report-code-badge">${escapeHtml(vCode)}</span>');
    js = js.replace(/<code class="report-code-badge">\$1<\/code>/g, '<span class="report-code-badge">$1</span>');

    // Replace audit-pill-danger in user access with status-text-danger
    js = js.replace(/'<span class="audit-pill-danger">Deactivated<\/span>'/g, "'<span class=\"status-text-danger\">Deactivated</span>'");
    js = js.replace(/'<span class="audit-pill-success">Activated<\/span>'/g, "'<span class=\"status-text-success\">Activated</span>'");

    fs.writeFileSync(fullPath, js, "utf8");
    console.log(`Updated formatReportText JS in ${rel}`);
}

// 3. Update index.html cache-busting version to v=2.8
const indexPath = path.join(rootDir, "frontend/admin/index.html");
if (fs.existsSync(indexPath)) {
    let html = fs.readFileSync(indexPath, "utf8");
    html = html.replace(/style\.css\?v=[0-9.]+/g, "style.css?v=2.8");
    html = html.replace(/workspace-dashboard\.css\?v=[0-9.]+/g, "workspace-dashboard.css?v=2.8");
    html = html.replace(/script\.js\?v=[0-9.]+/g, "script.js?v=2.8");
    fs.writeFileSync(indexPath, html, "utf8");
    console.log("Bumped version query in index.html to v=2.8");
}

console.log("All text borders successfully removed!");
