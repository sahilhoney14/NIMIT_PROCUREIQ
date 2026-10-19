const fs = require("fs");
const path = require("path");

const rootDir = path.resolve(__dirname, "../..");

// 1. Update HTML files
const htmlFiles = [
    "frontend/admin/index.html",
    "frontend/procurement-manager/index.html"
];

const newModalFooterHtml = `            <div class="modal-footer" style="display: flex; justify-content: flex-end; align-items: center; gap: 12px; padding: 16px 24px; border-top: 1px solid #e2e8f0; background: #f8fafc; border-bottom-left-radius: 16px; border-bottom-right-radius: 16px; box-sizing: border-box; width: 100%;">
                <button id="cancelSelectVendorBtn" type="button" class="btn-modal-cancel" style="height: 42px; min-height: 42px; max-height: 42px; box-sizing: border-box; margin: 0; padding: 0 22px; display: inline-flex; align-items: center; justify-content: center; font-size: 14px; font-weight: 600; border-radius: 8px; line-height: 1; cursor: pointer; background: #ffffff; border: 1px solid #cbd5e1; color: #334155; min-width: 100px; box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05); vertical-align: middle;">Cancel</button>
                <button id="confirmSelectVendorBtn" type="button" class="btn-modal-confirm" style="height: 42px; min-height: 42px; max-height: 42px; box-sizing: border-box; margin: 0; padding: 0 24px; display: inline-flex; align-items: center; justify-content: center; font-size: 14px; font-weight: 600; border-radius: 8px; line-height: 1; cursor: pointer; background: #0B57A4; border: 1px solid #0B57A4; color: #ffffff; min-width: 160px; box-shadow: 0 1px 3px rgba(11, 87, 164, 0.25); vertical-align: middle;">Confirm Selection</button>
            </div>`;

for (const rel of htmlFiles) {
    const fullPath = path.join(rootDir, rel);
    if (!fs.existsSync(fullPath)) continue;

    let html = fs.readFileSync(fullPath, "utf8");

    // Match the modal-footer inside selectVendorModal
    const footerRegex = /<div class="modal-footer"[\s\S]*?<button id="cancelSelectVendorBtn"[\s\S]*?<button id="confirmSelectVendorBtn"[\s\S]*?<\/div>/;
    if (footerRegex.test(html)) {
        html = html.replace(footerRegex, newModalFooterHtml.trim());
        console.log(`Updated selectVendorModal footer in ${rel}`);
    } else {
        console.warn(`Could not find selectVendorModal footer in ${rel}`);
    }

    // Bump versions to v=2.7
    html = html.replace(/style\.css\?v=[0-9.]+/g, "style.css?v=2.7");
    html = html.replace(/admin\.css\?v=[0-9.]+/g, "admin.css?v=2.7");
    html = html.replace(/workspace-dashboard\.css\?v=[0-9.]+/g, "workspace-dashboard.css?v=2.7");
    html = html.replace(/script\.js\?v=[0-9.]+/g, "script.js?v=2.7");

    fs.writeFileSync(fullPath, html, "utf8");
}

// 2. CSS replacement
const cssFooterBlock = `/* ─── Enterprise Modal Footer & Action Buttons ─── */
.modal-footer {
    display: flex !important;
    justify-content: flex-end !important;
    align-items: center !important;
    gap: 12px !important;
    padding: 16px 24px !important;
    border-top: 1px solid #e2e8f0 !important;
    background: #f8fafc !important;
    border-bottom-left-radius: 16px !important;
    border-bottom-right-radius: 16px !important;
    box-sizing: border-box !important;
    width: 100% !important;
}

.btn-modal-cancel,
.btn-modal-confirm,
#cancelSelectVendorBtn,
#confirmSelectVendorBtn,
.modal-footer .option-button,
.modal-footer .primary-button,
.modal-footer .danger-button {
    height: 42px !important;
    min-height: 42px !important;
    max-height: 42px !important;
    margin: 0 !important;
    display: inline-flex !important;
    align-items: center !important;
    justify-content: center !important;
    font-size: 14px !important;
    font-weight: 600 !important;
    border-radius: 8px !important;
    box-sizing: border-box !important;
    cursor: pointer !important;
    line-height: 1 !important;
    vertical-align: middle !important;
    transition: all 0.15s ease-in-out !important;
}

.btn-modal-cancel,
#cancelSelectVendorBtn,
.modal-footer .option-button {
    background: #ffffff !important;
    border: 1px solid #cbd5e1 !important;
    color: #334155 !important;
    padding: 0 22px !important;
    min-width: 100px !important;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05) !important;
}

.btn-modal-cancel:hover,
#cancelSelectVendorBtn:hover,
.modal-footer .option-button:hover {
    background: #f1f5f9 !important;
    border-color: #94a3b8 !important;
    color: #0f172a !important;
}

.btn-modal-confirm,
#confirmSelectVendorBtn,
.modal-footer .primary-button {
    background: #0B57A4 !important;
    border: 1px solid #0B57A4 !important;
    color: #ffffff !important;
    padding: 0 24px !important;
    min-width: 160px !important;
    box-shadow: 0 1px 3px rgba(11, 87, 164, 0.25) !important;
}

.btn-modal-confirm:hover,
#confirmSelectVendorBtn:hover,
.modal-footer .primary-button:hover {
    background: #084482 !important;
    border-color: #084482 !important;
    box-shadow: 0 3px 8px rgba(11, 87, 164, 0.35) !important;
}

.modal-footer .danger-button {
    background: #ef4444 !important;
    border: 1px solid #ef4444 !important;
    color: #ffffff !important;
    padding: 0 20px !important;
    min-width: 120px !important;
    box-shadow: 0 1px 3px rgba(239, 68, 68, 0.25) !important;
}

.modal-footer .danger-button:hover {
    background: #dc2626 !important;
    border-color: #dc2626 !important;
    box-shadow: 0 3px 8px rgba(239, 68, 68, 0.35) !important;
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

    const cssRegex = /\/\* ─── Enterprise Modal Footer[\s\S]*$/;
    if (cssRegex.test(css)) {
        css = css.replace(cssRegex, cssFooterBlock);
        fs.writeFileSync(fullPath, css, "utf8");
        console.log(`Replaced modal footer CSS in ${rel}`);
    } else {
        css = css + "\n\n" + cssFooterBlock;
        fs.writeFileSync(fullPath, css, "utf8");
        console.log(`Appended modal footer CSS to ${rel}`);
    }
}

console.log("All button alignments successfully updated!");
