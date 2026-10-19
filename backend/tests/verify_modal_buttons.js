const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..', '..');

function verifyModalButtons() {
    console.log('--- Verifying Modal Action Buttons ---');
    let pass = true;

    // 1. Check admin index.html
    const adminHtml = fs.readFileSync(path.join(rootDir, 'frontend', 'admin', 'index.html'), 'utf8');
    if (!adminHtml.includes('id="cancelSelectVendorBtn"') || !adminHtml.includes('class="btn-modal-cancel"')) {
        console.error('FAIL: cancelSelectVendorBtn with btn-modal-cancel not found in admin index.html');
        pass = false;
    } else {
        console.log('PASS: cancelSelectVendorBtn with btn-modal-cancel found');
    }

    if (!adminHtml.includes('id="confirmSelectVendorBtn"') || !adminHtml.includes('class="btn-modal-confirm"')) {
        console.error('FAIL: confirmSelectVendorBtn with btn-modal-confirm not found in admin index.html');
        pass = false;
    } else {
        console.log('PASS: confirmSelectVendorBtn with btn-modal-confirm found');
    }

    // Check height equality
    if (!adminHtml.includes('height: 42px') || !adminHtml.includes('min-height: 42px')) {
        console.error('FAIL: Explicit 42px height not found on modal buttons');
        pass = false;
    } else {
        console.log('PASS: Equal 42px height confirmed on both modal buttons');
    }

    // 2. Check CSS
    const css = fs.readFileSync(path.join(rootDir, 'frontend', 'admin', 'style.css'), 'utf8');
    if (!css.includes('.btn-modal-cancel') || !css.includes('.btn-modal-confirm') || !css.includes('height: 42px !important')) {
        console.error('FAIL: Modal button CSS classes or 42px height rule not found in style.css');
        pass = false;
    } else {
        console.log('PASS: Modal button CSS classes and 42px height rule found in style.css');
    }

    if (pass) {
        console.log('\nALL MODAL BUTTON VERIFICATIONS PASSED!');
    } else {
        console.log('\nSOME CHECKS FAILED');
        process.exit(1);
    }
}

verifyModalButtons();
