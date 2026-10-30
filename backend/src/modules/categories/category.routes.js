const express = require("express");
const router = express.Router();
const { db } = require("../../config/db");
const { verifyProcurement, verifyAdmin } = require("../../middleware/auth.middleware");

router.get("/product-categories", verifyProcurement, async (req, res) => {
    try {
        const { search, status, page, limit } = req.query;
        let query = "SELECT category_id, category_name, status, created_at, updated_at FROM product_categories WHERE 1=1";
        const params = [];

        if (search && String(search).trim()) {
            query += " AND category_name LIKE ?";
            params.push(`%${String(search).trim()}%`);
        }
        if (status && status !== "All") {
            query += " AND status = ?";
            params.push(status);
        }

        query += " ORDER BY category_id ASC";

        if (limit && limit !== "all" && Number(limit) > 0) {
            const pageNum = Math.max(1, parseInt(page, 10) || 1);
            const limitNum = Math.max(1, parseInt(limit, 10));
            const offset = (pageNum - 1) * limitNum;

            let countQuery = "SELECT COUNT(*) as total FROM product_categories WHERE 1=1";
            const countParams = [];
            if (search && String(search).trim()) {
                countQuery += " AND category_name LIKE ?";
                countParams.push(`%${String(search).trim()}%`);
            }
            if (status && status !== "All") {
                countQuery += " AND status = ?";
                countParams.push(status);
            }
            const [countRows] = await db.query(countQuery, countParams);
            const total = countRows[0]?.total || 0;

            query += " LIMIT ? OFFSET ?";
            params.push(limitNum, offset);

            const [rows] = await db.query(query, params);
            return res.json({
                success: true,
                data: rows,
                pagination: {
                    page: pageNum,
                    limit: limitNum,
                    total,
                    total_pages: Math.ceil(total / limitNum)
                }
            });
        }

        const [rows] = await db.query(query, params);
        return res.json({ success: true, data: rows });
    } catch (err) {
        return res.status(500).json({ success: false, message: "Failed to fetch product categories" });
    }
});

router.get("/sub-product-categories", verifyProcurement, async (req, res) => {
    try {
        const { category_id, product_category_id, ProductCategoryId, category_name, parent_category, search, status, page, limit } = req.query;
        const targetCatId = category_id || product_category_id || ProductCategoryId;
        const targetCatName = category_name || parent_category;

        let query = `
            SELECT 
                spc.subcategory_id,
                spc.category_id,
                spc.category_id AS product_category_id,
                spc.category_id AS ProductCategoryId,
                spc.subcategory_name,
                pc.category_name AS parent_category,
                pc.category_name,
                spc.status,
                spc.created_at,
                spc.updated_at
            FROM sub_product_categories spc
            JOIN product_categories pc ON spc.category_id = pc.category_id
            WHERE 1=1
        `;
        const params = [];

        if (targetCatId && !isNaN(Number(targetCatId))) {
            query += " AND spc.category_id = ?";
            params.push(Number(targetCatId));
        } else if (targetCatName && String(targetCatName).trim()) {
            query += " AND LOWER(TRIM(pc.category_name)) = LOWER(TRIM(?))";
            params.push(String(targetCatName).trim());
        }

        if (search && String(search).trim()) {
            query += " AND (spc.subcategory_name LIKE ? OR pc.category_name LIKE ?)";
            params.push(`%${String(search).trim()}%`, `%${String(search).trim()}%`);
        }

        if (status && status !== "All") {
            query += " AND spc.status = ?";
            params.push(status);
        }

        query += " ORDER BY spc.subcategory_id ASC";

        if (limit && limit !== "all" && Number(limit) > 0) {
            const pageNum = Math.max(1, parseInt(page, 10) || 1);
            const limitNum = Math.max(1, parseInt(limit, 10));
            const offset = (pageNum - 1) * limitNum;

            let countQuery = `
                SELECT COUNT(*) as total
                FROM sub_product_categories spc
                JOIN product_categories pc ON spc.category_id = pc.category_id
                WHERE 1=1
            `;
            const countParams = [];
            if (targetCatId && !isNaN(Number(targetCatId))) {
                countQuery += " AND spc.category_id = ?";
                countParams.push(Number(targetCatId));
            } else if (targetCatName && String(targetCatName).trim()) {
                countQuery += " AND LOWER(TRIM(pc.category_name)) = LOWER(TRIM(?))";
                countParams.push(String(targetCatName).trim());
            }
            if (search && String(search).trim()) {
                countQuery += " AND (spc.subcategory_name LIKE ? OR pc.category_name LIKE ?)";
                countParams.push(`%${String(search).trim()}%`, `%${String(search).trim()}%`);
            }
            if (status && status !== "All") {
                countQuery += " AND spc.status = ?";
                countParams.push(status);
            }

            const [countRows] = await db.query(countQuery, countParams);
            const total = countRows[0]?.total || 0;

            query += " LIMIT ? OFFSET ?";
            params.push(limitNum, offset);

            const [rows] = await db.query(query, params);
            return res.json({
                success: true,
                data: rows,
                pagination: {
                    page: pageNum,
                    limit: limitNum,
                    total,
                    total_pages: Math.ceil(total / limitNum)
                }
            });
        }

        const [rows] = await db.query(query, params);
        return res.json({ success: true, data: rows });
    } catch (err) {
        return res.status(500).json({ success: false, message: "Failed to fetch sub product categories" });
    }
});

// GET /product-categories/:category_id/subcategories
router.get("/product-categories/:category_id/subcategories", verifyProcurement, async (req, res) => {
    try {
        const categoryId = parseInt(req.params.category_id, 10);
        if (isNaN(categoryId)) {
            return res.status(400).json({ success: false, message: "Invalid category ID" });
        }
        const [rows] = await db.query(
            `SELECT 
                spc.subcategory_id,
                spc.category_id,
                spc.category_id AS product_category_id,
                spc.category_id AS ProductCategoryId,
                spc.subcategory_name,
                pc.category_name AS parent_category,
                spc.status,
                spc.created_at
            FROM sub_product_categories spc
            JOIN product_categories pc ON spc.category_id = pc.category_id
            WHERE spc.category_id = ? AND spc.status = 'Active'
            ORDER BY spc.subcategory_name ASC`,
            [categoryId]
        );
        return res.json({ success: true, data: rows });
    } catch (err) {
        return res.status(500).json({ success: false, message: "Failed to fetch subcategories" });
    }
});

// POST /product-categories
router.post("/product-categories", verifyProcurement, async (req, res) => {
    try {
        const { category_name, status = "Active" } = req.body;
        if (!category_name || !String(category_name).trim()) {
            return res.status(400).json({ success: false, message: "Category name is required" });
        }
        const trimmedName = String(category_name).trim();

        const [existing] = await db.query(
            "SELECT category_id FROM product_categories WHERE LOWER(TRIM(category_name)) = LOWER(TRIM(?)) LIMIT 1",
            [trimmedName]
        );
        if (existing.length > 0) {
            return res.status(400).json({ success: false, message: "Product category already exists" });
        }

        const [result] = await db.query(
            "INSERT INTO product_categories (category_name, status) VALUES (?, ?)",
            [trimmedName, status === "Inactive" ? "Inactive" : "Active"]
        );

        return res.json({
            success: true,
            message: "Product category created successfully",
            data: { category_id: result.insertId, category_name: trimmedName, status }
        });
    } catch (err) {
        return res.status(500).json({ success: false, message: "Failed to create product category" });
    }
});

// PUT /product-categories/:id
router.put("/product-categories/:id", verifyProcurement, async (req, res) => {
    try {
        const categoryId = parseInt(req.params.id, 10);
        if (isNaN(categoryId)) {
            return res.status(400).json({ success: false, message: "Invalid category ID" });
        }
        const { category_name, status } = req.body;

        const [existing] = await db.query(
            "SELECT category_id, category_name FROM product_categories WHERE category_id = ?",
            [categoryId]
        );
        if (existing.length === 0) {
            return res.status(404).json({ success: false, message: "Product category not found" });
        }

        if (category_name && String(category_name).trim()) {
            const trimmedName = String(category_name).trim();
            const [duplicate] = await db.query(
                "SELECT category_id FROM product_categories WHERE LOWER(TRIM(category_name)) = LOWER(TRIM(?)) AND category_id != ?",
                [trimmedName, categoryId]
            );
            if (duplicate.length > 0) {
                return res.status(400).json({ success: false, message: "A category with this name already exists" });
            }
        }

        const updates = [];
        const params = [];
        if (category_name && String(category_name).trim()) {
            updates.push("category_name = ?");
            params.push(String(category_name).trim());
        }
        if (status && ["Active", "Inactive"].includes(status)) {
            updates.push("status = ?");
            params.push(status);
        }

        if (updates.length > 0) {
            params.push(categoryId);
            await db.query(`UPDATE product_categories SET ${updates.join(", ")} WHERE category_id = ?`, params);
        }

        return res.json({ success: true, message: "Product category updated successfully" });
    } catch (err) {
        return res.status(500).json({ success: false, message: "Failed to update product category" });
    }
});

// DELETE /product-categories/:id
router.delete("/product-categories/:id", verifyProcurement, async (req, res) => {
    try {
        const categoryId = parseInt(req.params.id, 10);
        if (isNaN(categoryId)) {
            return res.status(400).json({ success: false, message: "Invalid category ID" });
        }

        const [existing] = await db.query(
            "SELECT category_name FROM product_categories WHERE category_id = ?",
            [categoryId]
        );
        if (existing.length === 0) {
            return res.status(404).json({ success: false, message: "Product category not found" });
        }

        await db.query("DELETE FROM product_categories WHERE category_id = ?", [categoryId]);
        return res.json({ success: true, message: "Product category deleted successfully" });
    } catch (err) {
        return res.status(500).json({ success: false, message: "Failed to delete product category" });
    }
});

// POST /sub-product-categories
router.post("/sub-product-categories", verifyProcurement, async (req, res) => {
    try {
        let { category_id, product_category_id, ProductCategoryId, category_name, parent_category, subcategory_name, status = "Active" } = req.body;
        let catId = category_id || product_category_id || ProductCategoryId;

        if (!catId && (category_name || parent_category)) {
            const targetName = String(category_name || parent_category).trim();
            const [catRows] = await db.query(
                "SELECT category_id FROM product_categories WHERE LOWER(TRIM(category_name)) = LOWER(TRIM(?)) LIMIT 1",
                [targetName]
            );
            if (catRows.length > 0) catId = catRows[0].category_id;
        }

        if (!catId || isNaN(Number(catId))) {
            return res.status(400).json({ success: false, message: "Parent product category is required" });
        }
        if (!subcategory_name || !String(subcategory_name).trim()) {
            return res.status(400).json({ success: false, message: "Subcategory name is required" });
        }

        const trimmedSubName = String(subcategory_name).trim();

        const [parentExists] = await db.query(
            "SELECT category_id, category_name FROM product_categories WHERE category_id = ?",
            [Number(catId)]
        );
        if (parentExists.length === 0) {
            return res.status(404).json({ success: false, message: "Parent product category not found" });
        }

        const [existing] = await db.query(
            "SELECT subcategory_id FROM sub_product_categories WHERE category_id = ? AND LOWER(TRIM(subcategory_name)) = LOWER(TRIM(?)) LIMIT 1",
            [Number(catId), trimmedSubName]
        );
        if (existing.length > 0) {
            return res.status(400).json({ success: false, message: "Subcategory already exists under this product category" });
        }

        const [result] = await db.query(
            "INSERT INTO sub_product_categories (category_id, subcategory_name, status) VALUES (?, ?, ?)",
            [Number(catId), trimmedSubName, status === "Inactive" ? "Inactive" : "Active"]
        );

        return res.json({
            success: true,
            message: "Sub product category created successfully",
            data: {
                subcategory_id: result.insertId,
                category_id: Number(catId),
                product_category_id: Number(catId),
                ProductCategoryId: Number(catId),
                subcategory_name: trimmedSubName,
                parent_category: parentExists[0].category_name,
                status
            }
        });
    } catch (err) {
        return res.status(500).json({ success: false, message: "Failed to create sub product category" });
    }
});

// PUT /sub-product-categories/:id
router.put("/sub-product-categories/:id", verifyProcurement, async (req, res) => {
    try {
        const subcategoryId = parseInt(req.params.id, 10);
        if (isNaN(subcategoryId)) {
            return res.status(400).json({ success: false, message: "Invalid subcategory ID" });
        }
        let { category_id, product_category_id, ProductCategoryId, category_name, parent_category, subcategory_name, status } = req.body;
        let catId = category_id || product_category_id || ProductCategoryId;

        const [existing] = await db.query(
            "SELECT subcategory_id, category_id, subcategory_name FROM sub_product_categories WHERE subcategory_id = ?",
            [subcategoryId]
        );
        if (existing.length === 0) {
            return res.status(404).json({ success: false, message: "Sub product category not found" });
        }

        const currentRecord = existing[0];
        let targetCatId = currentRecord.category_id;

        if (catId && !isNaN(Number(catId))) {
            targetCatId = Number(catId);
        } else if (category_name || parent_category) {
            const targetName = String(category_name || parent_category).trim();
            const [catRows] = await db.query(
                "SELECT category_id FROM product_categories WHERE LOWER(TRIM(category_name)) = LOWER(TRIM(?)) LIMIT 1",
                [targetName]
            );
            if (catRows.length > 0) targetCatId = catRows[0].category_id;
        }

        const targetSubName = (subcategory_name && String(subcategory_name).trim()) ? String(subcategory_name).trim() : currentRecord.subcategory_name;

        const [duplicate] = await db.query(
            "SELECT subcategory_id FROM sub_product_categories WHERE category_id = ? AND LOWER(TRIM(subcategory_name)) = LOWER(TRIM(?)) AND subcategory_id != ?",
            [targetCatId, targetSubName, subcategoryId]
        );
        if (duplicate.length > 0) {
            return res.status(400).json({ success: false, message: "A subcategory with this name already exists under the selected category" });
        }

        const updates = ["category_id = ?", "subcategory_name = ?"];
        const params = [targetCatId, targetSubName];
        if (status && ["Active", "Inactive"].includes(status)) {
            updates.push("status = ?");
            params.push(status);
        }
        params.push(subcategoryId);

        await db.query(`UPDATE sub_product_categories SET ${updates.join(", ")} WHERE subcategory_id = ?`, params);

        return res.json({ success: true, message: "Sub product category updated successfully" });
    } catch (err) {
        return res.status(500).json({ success: false, message: "Failed to update sub product category" });
    }
});

// DELETE /sub-product-categories/:id
router.delete("/sub-product-categories/:id", verifyProcurement, async (req, res) => {
    try {
        const subcategoryId = parseInt(req.params.id, 10);
        if (isNaN(subcategoryId)) {
            return res.status(400).json({ success: false, message: "Invalid subcategory ID" });
        }

        const [existing] = await db.query(
            "SELECT subcategory_name FROM sub_product_categories WHERE subcategory_id = ?",
            [subcategoryId]
        );
        if (existing.length === 0) {
            return res.status(404).json({ success: false, message: "Sub product category not found" });
        }

        await db.query("DELETE FROM sub_product_categories WHERE subcategory_id = ?", [subcategoryId]);
        return res.json({ success: true, message: "Sub product category deleted successfully" });
    } catch (err) {
        return res.status(500).json({ success: false, message: "Failed to delete sub product category" });
    }
});

module.exports = router;
