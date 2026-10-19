const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..', '..');

function runChecks() {
    console.log('--- Verifying Clean Admin Sidebar ---');
    let pass = true;

    // 1. Check index.html
    const html = fs.readFileSync(path.join(rootDir, 'frontend', 'admin', 'index.html'), 'utf8');
    
    // Verify headings are REMOVED
    const removedHeadings = ['WORKSPACE', 'MASTER DATA', 'ANALYTICS', 'ADMINISTRATION'];
    for (const heading of removedHeadings) {
        if (html.includes(`<div class="nav-section-title">${heading}</div>`)) {
            console.error(`FAIL: Heading "${heading}" is still present in index.html`);
            pass = false;
        } else {
            console.log(`PASS: Heading "${heading}" has been removed`);
        }
    }

    // Verify main menus exist directly
    const directMenus = [
        { label: 'Workspace', dropdown: 'workspace' },
        { label: 'Vendors', dropdown: 'vendors' },
        { label: 'Intelligence', dropdown: 'intelligence' },
        { label: 'Management', dropdown: 'management' }
    ];

    for (const m of directMenus) {
        if (!html.includes(`data-dropdown="${m.dropdown}"`)) {
            console.error(`FAIL: "${m.label}" dropdown not found in index.html`);
            pass = false;
        } else {
            console.log(`PASS: "${m.label}" dropdown found`);
        }
    }

    if (!html.includes('data-page="manage-access"') || !html.includes('Users')) {
        console.error('FAIL: Users direct item not found in index.html');
        pass = false;
    } else {
        console.log('PASS: Users direct item found');
    }

    // 2. Check CSS
    const css = fs.readFileSync(path.join(rootDir, 'frontend', 'admin', 'style.css'), 'utf8');
    if (!css.includes('.nav-dropdown-toggle') || !css.includes('.nav-submenu') || !css.includes('.submenu-dot')) {
        console.error('FAIL: CSS missing dropdown or submenu classes');
        pass = false;
    } else {
        console.log('PASS: CSS has dropdown, submenu, and dot classes');
    }

    // Check sidebar background
    const bgMatch = css.match(/\.sidebar\s*\{[\s\S]*?background:\s*([^;]+);/);
    if (bgMatch && bgMatch[1].trim() === '#ffffff') {
        console.log('PASS: Sidebar background is clean white #ffffff');
    } else {
        console.error('FAIL: Sidebar background is not #ffffff');
        pass = false;
    }

    // 3. Check JS
    const js = fs.readFileSync(path.join(rootDir, 'frontend', 'admin', 'script.js'), 'utf8');
    if (!js.includes('g !== group') || !js.includes('g.classList.remove("open")')) {
        console.error('FAIL: Accordion single-open logic not found in script.js');
        pass = false;
    } else {
        console.log('PASS: Accordion single-open logic confirmed in script.js');
    }

    if (pass) {
        console.log('\nALL CLEAN SIDEBAR CHECKS PASSED!');
    } else {
        console.log('\nSOME CHECKS FAILED');
        process.exit(1);
    }
}

runChecks();
