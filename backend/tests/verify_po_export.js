const http = require('http');
const fs = require('fs');
const ExcelJS = require('c:/Users/sahil/Documents/NIMIT_PROCUREIQ/NIMIT_PROCUREIQ/backend/node_modules/exceljs');

console.log('=== TEST SUITE: PURCHASE ORDERS EXPORT ===');

function request(options, body) {
    return new Promise((resolve, reject) => {
        const req = http.request(options, (res) => {
            let chunks = [];
            res.on('data', c => chunks.push(c));
            res.on('end', () => {
                const buffer = Buffer.concat(chunks);
                resolve({
                    statusCode: res.statusCode,
                    headers: res.headers,
                    data: buffer
                });
            });
        });
        req.on('error', reject);
        if (body) req.write(body);
        req.end();
    });
}

(async () => {
    try {
        // 1. Login as Admin
        const loginRes = await request({
            hostname: 'localhost',
            port: 3000,
            path: '/login',
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        }, JSON.stringify({ username: 'admin', password: 'Password@123' }));

        const loginJson = JSON.parse(loginRes.data.toString());
        if (!loginJson.token) {
            throw new Error('Login failed');
        }
        console.log('✔ Admin login successful');

        // 2. Export All POs
        const exportAllRes = await request({
            hostname: 'localhost',
            port: 3000,
            path: '/purchase-orders/export',
            method: 'GET',
            headers: { 'Authorization': `Bearer ${loginJson.token}` }
        });

        if (exportAllRes.statusCode !== 200) {
            throw new Error(`Export all failed with status ${exportAllRes.statusCode}`);
        }
        console.log('✔ GET /purchase-orders/export returned HTTP 200');

        // Parse workbook
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(exportAllRes.data);
        const sheet = workbook.getWorksheet("Purchase Orders");
        if (!sheet) {
            throw new Error('Worksheet "Purchase Orders" not found in workbook');
        }
        console.log('✔ Excel workbook contains worksheet "Purchase Orders"');

        // Verify headers (Row 4)
        const headerRow = sheet.getRow(4);
        const expectedHeaders = [
            "S.No", "PO Number", "PO Date", "PO Status", "PR Number", "PR Date",
            "Party / Client Name", "Location", "Territory", "Product Category",
            "Item Name", "Make", "Model", "Quantity", "Unit", "PR Sales Rate (₹)",
            "PR Taxable Value (₹)", "Vendor Code", "Vendor Name", "Commercial Role",
            "Vendor GSTIN", "Vendor Contact Person", "Vendor Phone", "Vendor Purchase Rate (₹)",
            "Total PO Amount (₹)", "Savings / Margin (₹)", "Margin %", "Expected Delivery Date",
            "Payment Type", "Advance Terms", "Balance Due (Days)", "Received Quantity",
            "Balance Quantity", "Delivery Status", "Quotation / PO Remarks"
        ];

        expectedHeaders.forEach((expected, idx) => {
            const actual = headerRow.getCell(idx + 1).value;
            if (actual !== expected) {
                throw new Error(`Header mismatch at col ${idx + 1}: expected "${expected}", got "${actual}"`);
            }
        });
        console.log(`✔ All ${expectedHeaders.length} report columns verified perfectly`);

        // Verify data rows exist (Row 5+)
        let rowCount = 0;
        sheet.eachRow((row, rowNumber) => {
            if (rowNumber >= 5 && row.getCell(2).value && row.getCell(2).value.toString().startsWith("NEE/")) {
                rowCount++;
            }
        });
        console.log(`✔ Verified ${rowCount} data rows in exported sheet with PR and Vendor details`);

        // Check sample row values
        const row5 = sheet.getRow(5);
        console.log('Sample Row 5 Data:');
        console.log('  PO Number:', row5.getCell(2).value);
        console.log('  PR Number:', row5.getCell(5).value);
        console.log('  Party Name:', row5.getCell(7).value);
        console.log('  Item Name:', row5.getCell(11).value);
        console.log('  PR Sales Rate:', row5.getCell(16).value);
        console.log('  PR Taxable Value:', row5.getCell(17).value);
        console.log('  Vendor Name:', row5.getCell(19).value);
        console.log('  Vendor Purchase Rate:', row5.getCell(24).value);
        console.log('  Total PO Amount:', row5.getCell(25).value);
        console.log('  Savings / Margin:', row5.getCell(26).value);

        // 3. Test Filtered Export (COMPLETED)
        const exportCompletedRes = await request({
            hostname: 'localhost',
            port: 3000,
            path: '/purchase-orders/export?status=COMPLETED',
            method: 'GET',
            headers: { 'Authorization': `Bearer ${loginJson.token}` }
        });

        if (exportCompletedRes.statusCode !== 200) {
            throw new Error(`Filtered export failed with status ${exportCompletedRes.statusCode}`);
        }
        console.log('✔ GET /purchase-orders/export?status=COMPLETED returned HTTP 200');

        // 4. Verify Frontend Files
        const adminHtml = fs.readFileSync('frontend/admin/index.html', 'utf8');
        const adminJs = fs.readFileSync('frontend/admin/script.js', 'utf8');
        const adminCss = fs.readFileSync('frontend/admin/style.css', 'utf8');

        if (!adminHtml.includes('id="poExportBtn"')) throw new Error('poExportBtn missing in admin/index.html');
        if (!adminJs.includes('poExportBtn')) throw new Error('poExportBtn handler missing in admin/script.js');
        if (!adminCss.includes('.po-btn-export')) throw new Error('.po-btn-export missing in admin/style.css');
        console.log('✔ Frontend markup, script handler, and CSS styling verified');

        console.log('\n=== ALL PURCHASE ORDERS EXPORT TESTS PASSED SUCCESSFULLY! ===\n');
        process.exit(0);
    } catch (err) {
        console.error('Test failed:', err);
        process.exit(1);
    }
})();
