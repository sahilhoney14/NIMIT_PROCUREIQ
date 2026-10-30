const assert = require("assert");
const { db } = require("../backend/src/config/db");

async function testItemMasterAndValidation() {
    console.log("=== Testing Item Master & Dependent Dropdown APIs ===");

    // Login as Admin
    const loginRes = await fetch("http://localhost:5000/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: "admin", password: "Password@123" })
    });
    const loginData = await loginRes.json();
    assert.strictEqual(loginData.success, true);
    const token = loginData.token;
    const authHeaders = {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
    };

    // 1. GET /product-categories
    const catRes = await fetch("http://localhost:5000/product-categories?page=1&limit=10", {
        headers: authHeaders
    });
    const catData = await catRes.json();
    assert.strictEqual(catData.success, true);
    console.log(`✔ GET /product-categories returned ${catData.data.length} categories (total: ${catData.pagination.total})`);

    // Ensure Cable category and subcategories exist for tests
    let cableId;
    const [existingCable] = await db.query("SELECT category_id FROM product_categories WHERE category_name = 'Cable'");
    if (existingCable.length > 0) {
        cableId = existingCable[0].category_id;
    } else {
        const [cRes] = await db.query("INSERT INTO product_categories (category_name, status) VALUES ('Cable', 'Active')");
        cableId = cRes.insertId;
        const cableSubs = ['Power Cable', 'Control Cable', 'Armoured Cable', 'Flexible Cable'];
        for (const cs of cableSubs) {
            await db.query("INSERT IGNORE INTO sub_product_categories (category_id, subcategory_name, status) VALUES (?, ?, 'Active')", [cableId, cs]);
        }
    }

    // 2. GET /sub-product-categories
    const allSubsRes = await fetch("http://localhost:5000/sub-product-categories", {
        headers: authHeaders
    });
    const allSubsData = await allSubsRes.json();
    assert.strictEqual(allSubsData.success, true);
    console.log(`✔ GET /sub-product-categories returned ${allSubsData.data.length} subcategories`);

    // 3. Test POST, PUT, DELETE /product-categories
    const newCatRes = await fetch("http://localhost:5000/product-categories", {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({ category_name: "Test Cat Temp", status: "Active" })
    });
    const newCatData = await newCatRes.json();
    assert.strictEqual(newCatData.success, true);
    const tempCatId = newCatData.data.category_id;
    console.log(`✔ Created temp category ID: ${tempCatId}`);

    // Test Duplicate Category Name rejection
    const dupCatRes = await fetch("http://localhost:5000/product-categories", {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({ category_name: "Test Cat Temp" })
    });
    assert.strictEqual(dupCatRes.status, 400);
    console.log("✔ Duplicate category correctly rejected with 400");

    // Test PUT category
    const updateCatRes = await fetch(`http://localhost:5000/product-categories/${tempCatId}`, {
        method: "PUT",
        headers: authHeaders,
        body: JSON.stringify({ category_name: "Test Cat Temp Renamed" })
    });
    const updateCatData = await updateCatRes.json();
    assert.strictEqual(updateCatData.success, true);
    console.log("✔ Updated temp category");

    // 4. Test POST, PUT, DELETE /sub-product-categories
    const newSubRes = await fetch("http://localhost:5000/sub-product-categories", {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({
            category_id: tempCatId,
            subcategory_name: "Test Sub Temp",
            status: "Active"
        })
    });
    const newSubData = await newSubRes.json();
    assert.strictEqual(newSubData.success, true);
    const tempSubId = newSubData.data.subcategory_id;
    console.log(`✔ Created temp subcategory ID: ${tempSubId}`);

    // Test PUT subcategory
    const updateSubRes = await fetch(`http://localhost:5000/sub-product-categories/${tempSubId}`, {
        method: "PUT",
        headers: authHeaders,
        body: JSON.stringify({ subcategory_name: "Test Sub Temp Renamed" })
    });
    const updateSubData = await updateSubRes.json();
    assert.strictEqual(updateSubData.success, true);
    console.log("✔ Updated temp subcategory");

    // 5. PR Validation: Mismatch rejection
    const mismatchPrRes = await fetch("http://localhost:5000/purchase-requests", {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({
            pr_date: "2026-10-29",
            party_name: "Mismatch Test",
            location: "Site A",
            territory: "North",
            product_category: "Test Cat Temp Renamed",
            sub_product_category: "Invalid Subcategory",
            item_name: "Test Item",
            make: "Test Make",
            model: "Test Model",
            qty: 10,
            unit: "meter",
            sales_rate: 100
        })
    });
    assert.strictEqual(mismatchPrRes.status, 400);
    const mismatchData = await mismatchPrRes.json();
    console.log(`✔ Mismatched PR rejected: "${mismatchData.message}"`);

    // 6. PR Validation: Valid match acceptance
    const validPrRes = await fetch("http://localhost:5000/purchase-requests", {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({
            pr_date: "2026-10-29",
            party_name: "Valid Match Test",
            location: "Site A",
            territory: "North",
            product_category: "Test Cat Temp Renamed",
            sub_product_category: "Test Sub Temp Renamed",
            item_name: "Valid Item",
            make: "Test Make",
            model: "Test Model",
            qty: 10,
            unit: "meter",
            sales_rate: 100
        })
    });
    assert.strictEqual(validPrRes.status, 200);
    const validData = await validPrRes.json();
    console.log(`✔ Valid matching PR accepted: PR ${validData.pr_number} (ID: ${validData.pr_id})`);

    // Cleanup valid PR and inquiry
    if (validData.pr_id) {
        await db.query("DELETE FROM vendor_inquiries WHERE pr_id = ?", [validData.pr_id]);
        await db.query("DELETE FROM purchase_requests WHERE id = ?", [validData.pr_id]);
    }

    // Cleanup temp subcategory and category
    await fetch(`http://localhost:5000/sub-product-categories/${tempSubId}`, {
        method: "DELETE",
        headers: authHeaders
    });
    await fetch(`http://localhost:5000/product-categories/${tempCatId}`, {
        method: "DELETE",
        headers: authHeaders
    });
    console.log("✔ Cleanup complete");
    console.log("=== ALL ITEM MASTER & VALIDATION TESTS PASSED ===");
    process.exit(0);
}

testItemMasterAndValidation().catch(e => {
    console.error("Test failed:", e);
    process.exit(1);
});
