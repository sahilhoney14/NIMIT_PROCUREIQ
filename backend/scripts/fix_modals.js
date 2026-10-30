const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..', '..');

// 1. Fix admin index.html
const adminPath = path.join(rootDir, 'frontend', 'admin', 'index.html');
let adminHtml = fs.readFileSync(adminPath, 'utf8');

const targetAdmin = `<button id="confirmSelectVendorBtn" type="button" class="btn-modal-confirm">Confirm Selection</button>
            </div>
         View Modal ──────────────────────────────── -->
    <div id="vendorDetailsModal"`;

const replaceAdmin = `<button id="confirmSelectVendorBtn" type="button" class="btn-modal-confirm">Confirm Selection</button>
            </div>
        </div>
    </div>

    <!-- ── Vendor Details View Modal ──────────────────────────────── -->
    <div id="vendorDetailsModal"`;

if (adminHtml.includes('View Modal ──────────────────────────────── -->')) {
    adminHtml = adminHtml.replace(
        /<button id="confirmSelectVendorBtn"[^>]*>Confirm Selection<\/button>\s*<\/div>[\s\S]*?<div id="vendorDetailsModal"/,
        replaceAdmin
    );
    fs.writeFileSync(adminPath, adminHtml, 'utf8');
    console.log('Successfully fixed admin index.html');
} else {
    console.log('admin index.html does not have corrupt tag');
}

let pmHtml = fs.readFileSync(pmPath, 'utf8');

const replacePm = `<button id="confirmSelectVendorBtn" type="button" class="btn-modal-confirm">Confirm Selection</button>
            </div>
        </div>
    </div>

    <script src="/shared/js/workspace-dashboard.js">`;

if (pmHtml.includes('src="/shared/js/workspace-dashboard.js"')) {
    pmHtml = pmHtml.replace(
        /<button id="confirmSelectVendorBtn"[^>]*>Confirm Selection<\/button>\s*<\/div>[\s\S]*?<script src="\/shared\/js\/workspace-dashboard\.js"/,
        replacePm
    );
    fs.writeFileSync(pmPath, pmHtml, 'utf8');
}
