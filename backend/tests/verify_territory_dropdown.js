const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '../../');
const files = [
    'frontend/admin/index.html',
    'frontend/procurement/index.html'
];

const expectedOptions = [
    'North',
    'South (Dahej)',
    'South (Bharuch)',
    'West',
    'Central Projects',
    'Central Services',
    'Central Contracts',
    'Ahmedabad',
    'Pan India',
    'Kutch',
    'Surat'
];

console.log('Testing territory dropdowns in HTML templates...');

for (const relPath of files) {
    const fullPath = path.join(rootDir, relPath);
    const content = fs.readFileSync(fullPath, 'utf8');

    if (!content.includes('<select id="territory" required>')) {
        throw new Error(`Failed: <select id="territory" required> not found in ${relPath}`);
    }

    if (!content.includes('<option value="" disabled selected>Select Territory</option>')) {
        throw new Error(`Failed: placeholder option missing in ${relPath}`);
    }

    for (const opt of expectedOptions) {
        const optionStr = `<option value="${opt}">${opt}</option>`;
        if (!content.includes(optionStr)) {
            throw new Error(`Failed: Option "${opt}" not found in ${relPath}`);
        }
    }

    console.log(`✓ ${relPath}: All 11 territory options verified.`);
}

async function testApi() {
    console.log('\nTesting PR Creation API with dropdown territory "South (Dahej)"...');
    const { db } = require('../src/config/db');
    const { generateAccessToken } = require('../src/services/jwt.service');

    const [users] = await db.query("SELECT user_id, username, role, token_version FROM users WHERE role = 'ADMIN' AND is_active = 1 LIMIT 1");
    if (!users || users.length === 0) {
        console.log('Skipping API test: no admin user found');
        return;
    }

    const token = generateAccessToken(users[0]);
    const res = await fetch('http://localhost:3000/purchase-requests', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
            pr_date: '2026-10-19',
            party_name: 'Test Territory Party',
            location: 'Dahej Plant',
            territory: 'South (Dahej)',
            product_category: 'Industrial',
            item_name: 'Test Valve',
            make: 'L&T',
            model: 'V-100',
            qty: 10,
            unit: 'number',
            sales_rate: 1500,
            product_remarks: 'Testing territory dropdown'
        })
    });

    const data = await res.json();
    console.log('API Response status:', res.status, 'data:', data);
    if (!res.ok || !data.success) {
        throw new Error('API failed to create PR with territory: ' + JSON.stringify(data));
    }

    // Verify stored in DB
    const [rows] = await db.query('SELECT pr_number, territory FROM purchase_requests WHERE pr_number = ?', [data.pr_number]);
    console.log('DB record:', rows[0]);
    if (rows[0].territory !== 'South (Dahej)') {
        throw new Error('Stored territory mismatch: expected South (Dahej), got ' + rows[0].territory);
    }

    // Clean up test PR and inquiry
    await db.query('DELETE FROM vendor_inquiries WHERE pr_id = ?', [data.pr_id]);
    await db.query('DELETE FROM purchase_requests WHERE id = ?', [data.pr_id]);
    console.log('Cleaned up test PR', data.pr_number);
    console.log('\n✓ PR Creation with territory "South (Dahej)" tested and verified successfully!');
}

testApi()
    .then(() => {
        console.log('\nAll territory dropdown verification tests passed successfully!');
        process.exit(0);
    })
    .catch(err => {
        console.error('Test error:', err);
        process.exit(1);
    });

