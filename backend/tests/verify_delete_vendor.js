const fs = require('fs');
const path = require('path');
const app = require('../src/app');
const { db } = require('../src/config/db');
const { generateAccessToken } = require('../src/services/jwt.service');

async function testDeleteVendor() {
    console.log('==================================================');
    console.log('       ProcureIQ Delete Vendor Verification       ');
    console.log('==================================================\n');

    // Start test server on port 3999
    const TEST_PORT = 3999;
    const server = app.listen(TEST_PORT);
    const baseUrl = `http://localhost:${TEST_PORT}`;

    try {
        // 1. Verify frontend files have delete button/icon
        console.log('[1] Verifying Frontend Markup & Scripts...');
        const htmlPath = path.resolve(__dirname, '../../frontend/admin/index.html');
        const scriptPath = path.resolve(__dirname, '../../frontend/admin/script.js');
        const stylePath = path.resolve(__dirname, '../../frontend/admin/style.css');

        const html = fs.readFileSync(htmlPath, 'utf8');
        const script = fs.readFileSync(scriptPath, 'utf8');
        const style = fs.readFileSync(stylePath, 'utf8');

        if (!html.includes('id="vdModalDeleteVendorBtn"')) throw new Error('Missing vdModalDeleteVendorBtn in index.html');
        if (!html.includes('id="vdModalDeleteVendorFooterBtn"')) throw new Error('Missing vdModalDeleteVendorFooterBtn in index.html');
        if (!script.includes('ev-btn-delete')) throw new Error('Missing ev-btn-delete in script.js');
        if (!script.includes('confirmDeleteVendor')) throw new Error('Missing confirmDeleteVendor in script.js');
        if (!style.includes('.ev-btn-delete')) throw new Error('Missing .ev-btn-delete in style.css');
        console.log(' - Frontend markup and scripts: PASS');

        // 2. Fetch admin and non-admin users for auth testing
        console.log('\n[2] Fetching test credentials...');
        const [users] = await db.query('SELECT user_id, username, role, token_version FROM users WHERE is_active = 1');
        const admin = users.find(u => u.role === 'ADMIN');
        const nonAdmin = users.find(u => u.role === 'PROCUREMENT');

        if (!admin) throw new Error('No ADMIN user in database');
        const adminToken = generateAccessToken(admin);
        const nonAdminToken = nonAdmin ? generateAccessToken(nonAdmin) : null;

        // 3. Test non-admin authorization check
        if (nonAdminToken) {
            console.log('\n[3] Testing Non-Admin Authorization...');
            const resNonAdmin = await fetch(`${baseUrl}/vendors/99999`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${nonAdminToken}` }
            });
            console.log(' - Non-admin status:', resNonAdmin.status, '(expected 403 or redirect)');
            if (resNonAdmin.status !== 403 && resNonAdmin.status !== 401) {
                throw new Error('Expected 403/401 for non-admin delete request');
            }
            console.log(' - Authorization check: PASS');
        }

        // 4. Test protection for vendor with purchase orders
        console.log('\n[4] Testing protection for vendor with Purchase Orders...');
        const [poVendors] = await db.query('SELECT DISTINCT vendor_id FROM purchase_orders WHERE vendor_id IS NOT NULL LIMIT 1');
        if (poVendors.length > 0) {
            const poVendorId = poVendors[0].vendor_id;
            const resPoVendor = await fetch(`${baseUrl}/vendors/${poVendorId}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${adminToken}` }
            });
            const poData = await resPoVendor.json();
            console.log(' - Delete vendor with PO response:', resPoVendor.status, poData.message);
            if (resPoVendor.status !== 400 || poData.success !== false) {
                throw new Error('Should prevent deleting vendor with purchase orders');
            }
            console.log(' - PO protection check: PASS');
        }

        // 5. Create a test vendor, delete it, and verify
        console.log('\n[5] Testing successful deletion of a vendor...');
        const testCode = 'DEL_' + Date.now().toString().slice(-6);
        const [insertResult] = await db.query(
            `INSERT INTO vendor_oem_masters (
                vendor_code, vendor_name, registration_date, legal_entity, commercial_role,
                year_of_incorporation, director_or_ceo_or_management_name,
                director_or_ceo_or_management_designation, director_or_ceo_or_management_mobile_no,
                director_or_ceo_or_management_email, gst_number, pan_number, office_address,
                office_contact_name, office_contact_number, bank_name, bank_account_no,
                bank_branch, bank_account_type, bank_ifsc
            )
            SELECT 
                ?, 'Test Delete Vendor Co.', registration_date, legal_entity, commercial_role,
                year_of_incorporation, director_or_ceo_or_management_name,
                director_or_ceo_or_management_designation, director_or_ceo_or_management_mobile_no,
                director_or_ceo_or_management_email, '24AABCT9999Z1Z5', 'AABCT9999Z', office_address,
                office_contact_name, office_contact_number, bank_name, bank_account_no,
                bank_branch, bank_account_type, bank_ifsc
            FROM vendor_oem_masters LIMIT 1`,
            [testCode]
        );
        const newVendorId = insertResult.insertId;
        console.log(` - Created temporary vendor ID ${newVendorId} (${testCode})`);

        // Verify it exists
        const [created] = await db.query('SELECT vendor_id FROM vendor_oem_masters WHERE vendor_id = ?', [newVendorId]);
        if (!created.length) throw new Error('Failed to create test vendor in database');

        // Perform DELETE request via Admin API
        const resDelete = await fetch(`${baseUrl}/vendors/${newVendorId}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${adminToken}` }
        });
        const deleteData = await resDelete.json();
        console.log(' - Delete API response:', resDelete.status, deleteData);
        if (!resDelete.ok || !deleteData.success) {
            throw new Error('Failed to delete vendor via API: ' + JSON.stringify(deleteData));
        }

        // Verify removed from database
        const [afterDelete] = await db.query('SELECT vendor_id FROM vendor_oem_masters WHERE vendor_id = ?', [newVendorId]);
        if (afterDelete.length > 0) {
            throw new Error('Vendor still exists in database after delete!');
        }
        console.log(' - Vendor successfully removed from database: PASS');

        console.log('\n==================================================');
        console.log('     ALL DELETE VENDOR TESTS PASSED SUCCESSFULLY!  ');
        console.log('==================================================');

    } finally {
        server.close();
    }

    process.exit(0);
}

testDeleteVendor().catch(err => {
    console.error('Test failed with error:', err);
    process.exit(1);
});
