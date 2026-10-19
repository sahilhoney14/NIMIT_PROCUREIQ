const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..', '..');

const modalHtml = `    <!-- ── Confirm Vendor Selection Modal ───────────────────── -->
    <div id="selectVendorModal" class="modal hidden">
        <div class="modal-card" style="max-width: 490px; padding: 0; overflow: hidden; border-radius: 16px; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.05);">
            <div class="modal-header" style="padding: 20px 24px 16px 24px; margin-bottom: 0; border-bottom: 1px solid #eef2f6;">
                <h2 style="font-size: 18px; font-weight: 700; color: #0f172a; margin: 0;">Confirm Vendor Selection</h2>
                <button id="closeSelectVendorModal" class="close-button" type="button" title="Close" aria-label="Close modal">&times;</button>
            </div>
            <div class="modal-body" style="padding: 20px 24px 20px 24px; font-size: 14px; color: #334155;">
                <p style="margin-bottom: 16px; color: #64748b; font-size: 13.5px; line-height: 1.5;">
                    Please confirm that you want to select this vendor. Once selected, a draft Purchase Order will be created.
                </p>
                <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px 18px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 9px;">
                        <span style="color: #64748b; font-size: 13px; font-weight: 500;">PR Number:</span>
                        <strong id="confirmPrNumber" style="color: #0f172a; font-size: 13.5px; font-weight: 600;">-</strong>
                    </div>
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 9px;">
                        <span style="color: #64748b; font-size: 13px; font-weight: 500;">Vendor:</span>
                        <strong id="confirmVendorName" style="color: #0f172a; text-align: right; max-width: 270px; font-size: 13.5px; font-weight: 600;">-</strong>
                    </div>
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 9px;">
                        <span style="color: #64748b; font-size: 13px; font-weight: 500;">Price / Unit:</span>
                        <strong id="confirmUnitPrice" style="color: #0f172a; font-size: 13.5px; font-weight: 600;">-</strong>
                    </div>
                    <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px dashed #cbd5e1; padding-top: 10px; margin-top: 6px;">
                        <span style="color: #334155; font-weight: 600; font-size: 13.5px;">Total Price:</span>
                        <strong id="confirmTotalPrice" style="color: #16803c; font-size: 16px; font-weight: 700;">-</strong>
                    </div>
                </div>
            </div>
            <div class="modal-footer">
                <button id="cancelSelectVendorBtn" type="button" class="btn-modal-cancel">Cancel</button>
                <button id="confirmSelectVendorBtn" type="button" class="btn-modal-confirm">Confirm Selection</button>
            </div>
        </div>
    </div>`;

// Update HTML files
function updateHtmlModal(filePath) {
    if (!fs.existsSync(filePath)) return;
    let html = fs.readFileSync(filePath, 'utf8');
    const regex = /<!--\s*──\s*Confirm Vendor Selection Modal[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/;
    if (regex.test(html)) {
        html = html.replace(regex, modalHtml.trim());
        fs.writeFileSync(filePath, html, 'utf8');
        console.log('Updated modal in', filePath);
    } else {
        console.error('Could not match selectVendorModal in', filePath);
    }
}

updateHtmlModal(path.join(rootDir, 'frontend', 'admin', 'index.html'));
updateHtmlModal(path.join(rootDir, 'frontend', 'procurement-manager', 'index.html'));

// CSS styling for modal buttons
const modalBtnCss = `
/* ─── Enterprise Modal Footer & Action Buttons ─── */
.modal-footer {
    display: flex;
    justify-content: flex-end;
    align-items: center;
    gap: 12px;
    padding: 14px 24px;
    border-top: 1px solid #e2e8f0;
    background: #f8fafc;
    border-bottom-left-radius: 16px;
    border-bottom-right-radius: 16px;
    box-sizing: border-box;
}

.btn-modal-cancel,
.btn-modal-confirm,
.modal-footer .option-button,
.modal-footer .primary-button,
.modal-footer .danger-button {
    height: 40px !important;
    margin: 0 !important;
    display: inline-flex !important;
    align-items: center !important;
    justify-content: center !important;
    font-size: 13.5px !important;
    font-weight: 600 !important;
    border-radius: 8px !important;
    box-sizing: border-box !important;
    cursor: pointer !important;
    line-height: 1 !important;
    transition: all 0.15s ease-in-out !important;
}

.btn-modal-cancel,
.modal-footer .option-button {
    background: #ffffff !important;
    border: 1px solid #cbd5e1 !important;
    color: #334155 !important;
    padding: 0 20px !important;
    min-width: 100px !important;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05) !important;
}

.btn-modal-cancel:hover,
.modal-footer .option-button:hover {
    background: #f1f5f9 !important;
    border-color: #94a3b8 !important;
    color: #0f172a !important;
}

.btn-modal-confirm,
.modal-footer .primary-button {
    background: #0B57A4 !important;
    border: 1px solid #0B57A4 !important;
    color: #ffffff !important;
    padding: 0 22px !important;
    min-width: 150px !important;
    box-shadow: 0 1px 3px rgba(11, 87, 164, 0.25) !important;
}

.btn-modal-confirm:hover,
.modal-footer .primary-button:hover {
    background: #084482 !important;
    border-color: #084482 !important;
    box-shadow: 0 3px 8px rgba(11, 87, 164, 0.35) !important;
}

.modal-footer .danger-button {
    background: #fee2e2 !important;
    border: 1px solid #fecaca !important;
    color: #b91c1c !important;
    padding: 0 18px !important;
}

.modal-footer .danger-button:hover {
    background: #dc2626 !important;
    border-color: #dc2626 !important;
    color: #ffffff !important;
}
`;

function appendCss(filePath) {
    if (!fs.existsSync(filePath)) return;
    let css = fs.readFileSync(filePath, 'utf8');
    if (!css.includes('.btn-modal-cancel')) {
        css += '\n' + modalBtnCss + '\n';
        fs.writeFileSync(filePath, css, 'utf8');
        console.log('Appended modal button styles to', filePath);
    } else {
        // Replace existing rule
        const regex = /\/\*\s*───\s*Enterprise Modal Footer[\s\S]*?(?=\/\*|$)/;
        if (regex.test(css)) {
            css = css.replace(regex, modalBtnCss.trim() + '\n\n');
            fs.writeFileSync(filePath, css, 'utf8');
            console.log('Updated modal button styles in', filePath);
        }
    }
}

appendCss(path.join(rootDir, 'frontend', 'admin', 'style.css'));
appendCss(path.join(rootDir, 'frontend', 'admin', 'css', 'admin.css'));
appendCss(path.join(rootDir, 'frontend', 'procurement-manager', 'style.css'));
appendCss(path.join(rootDir, 'frontend', 'procurement-manager', 'css', 'manager.css'));
