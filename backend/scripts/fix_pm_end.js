const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..', '..');
const pmPath = path.join(rootDir, 'frontend', 'procurement-manager', 'index.html');
let pmHtml = fs.readFileSync(pmPath, 'utf8');

const target = `<button id="confirmSelectVendorBtn" type="button" class="btn-modal-confirm">Confirm Selection</button>
            </div>
         src="/shared/js/workspace-dashboard.js">`;

const replacement = `<button id="confirmSelectVendorBtn" type="button" class="btn-modal-confirm">Confirm Selection</button>
            </div>
        </div>
    </div>

    <script src="/shared/js/workspace-dashboard.js">`;

pmHtml = pmHtml.replace(target, replacement);
fs.writeFileSync(pmPath, pmHtml, 'utf8');
console.log('Fixed procurement-manager end tag precisely');
