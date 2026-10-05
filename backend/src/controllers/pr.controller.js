const { readSheet } = require("read-excel-file/node");
const { db } = require("../config/db");
const { log } = require("../utils/logger");
const { generatePrNumber } = require("../services/sequence.service");
const { writeReportLog, describePr } = require("../services/audit.service");

function normalizeHeader(value) {
    return String(value || "")
        .trim()
        .toLowerCase()
        .replace(/\s+/g, "_")
        .replace(/[\/()-]+/g, "_")
        .replace(/_+/g, "_")
        .replace(/^_|_$/g, "");
}

function cleanValue(value) {
    if (value === null || value === undefined) return null;
    const text = String(value).trim();
    return text === "" || text === "-" ? null : text;
}

function cleanNumber(value) {
    if (value === null || value === undefined || value === "") return 0;
    const n = Number(value);
    return isNaN(n) ? 0 : n;
}

function formatDate(value) {
    if (!value) return null;
    if (value instanceof Date) return value.toISOString().split("T")[0];
    const text = String(value).trim();
    if (text === "" || text === "-") return null;
    const match = text.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
    if (match) return `${match[3]}-${match[2].padStart(2, "0")}-${match[1].padStart(2, "0")}`;
    return text;
}

async function getPurchaseRequests(req, res) {
    try {
        const [rows] = await db.query(`SELECT * FROM purchase_requests ORDER BY pr_id DESC`);
        return res.json({ success: true, data: rows });
    } catch (error) {
        log(`Error fetching purchase requests: ${error.message}`);
        return res.status(500).json({ success: false, message: "Failed to fetch purchase requests" });
    }
}

async function createPurchaseRequest(req, res) {
    const {
        pr_date,
        party_name,
        location,
        territory,
        product_category,
        item_name,
        product_remarks,
        make,
        model,
        qty,
        unit,
        sales_rate
    } = req.body;

    const requiredFields = {
        party_name,
        location,
        territory,
        product_category,
        item_name,
        make,
        model,
        qty,
        unit,
        sales_rate
    };

    for (const [field, value] of Object.entries(requiredFields)) {
        if (value === undefined || value === null || String(value).trim() === "") {
            return res.status(400).json({
                success: false,
                message: `${field.replace(/_/g, " ")} is required`
            });
        }
    }

    if (Number(qty) <= 0) {
        return res.status(400).json({ success: false, message: "Quantity must be greater than 0" });
    }
    if (Number(sales_rate) <= 0) {
        return res.status(400).json({ success: false, message: "Sales rate must be greater than 0" });
    }

    const pr_date_final = pr_date && String(pr_date).trim() !== "" ? pr_date : new Date().toISOString().split("T")[0];
    const taxable_value = Number(qty) * Number(sales_rate);

    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();
        const pr_number = await generatePrNumber(connection);

        const [result] = await connection.execute(
            `INSERT INTO purchase_requests
            (
                pr_number, pr_date, party_name, location, territory,
                product_category, item_name, product_remarks, make, model,
                qty, unit, sales_rate, taxable_value
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                pr_number,
                pr_date_final,
                party_name,
                location,
                territory,
                product_category,
                item_name,
                product_remarks || null,
                make,
                model,
                qty,
                unit,
                sales_rate,
                taxable_value
            ]
        );

        const [inquiryResult] = await connection.execute(
            `INSERT INTO vendor_inquiries (pr_id, status, remarks) VALUES (?, 'OPEN', ?)`,
            [result.insertId, product_remarks || null]
        );

        await connection.commit();

        await writeReportLog(req, "PR_CREATED",
            `Purchase request raised. ${describePr({
                pr_number, pr_date: pr_date_final, party_name, location, territory, product_category,
                item_name, make, model, qty, unit, sales_rate, taxable_value, product_remarks
            })}`
        );

        await writeReportLog(req, "VENDOR_INQUIRY_CREATED",
            `Vendor inquiry (inquiry ID ${inquiryResult.insertId}) opened for ${pr_number}. ` +
            `Item: ${item_name}, make: ${make}, model: ${model}, quantity: ${Number(qty)} ${unit}. Status: OPEN, awaiting vendor quotations.`
        );

        return res.json({
            success: true,
            message: "Purchase request created successfully",
            pr_number,
            pr_id: result.insertId
        });
    } catch (error) {
        await connection.rollback();
        log(`ERROR adding purchase request: ${error.message}`);
        return res.status(500).json({ success: false, message: "Internal server error" });
    } finally {
        connection.release();
    }
}

async function previewExcel(req, res) {
    log("POST /purchase-requests/import-preview - Excel preview requested");
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: "Excel file is required" });
        }

        const excelRows = await readSheet(req.file.buffer);
        if (!excelRows || excelRows.length <= 1) {
            return res.status(400).json({ success: false, message: "Excel file contains no data" });
        }

        const headers = excelRows[0].map(normalizeHeader);
        const columnIndex = {};
        headers.forEach((header, index) => {
            if (header) columnIndex[header] = index;
        });

        const getCell = (row, field) => {
            if (columnIndex[field] === undefined) return null;
            return cleanValue(row[columnIndex[field]]);
        };

        const rows = excelRows
            .slice(1)
            .filter(row => row.some(cell => cell !== null && cell !== undefined && String(cell).trim() !== ""))
            .map(row => {
                const quantity = cleanNumber(getCell(row, "qty"));
                const rate = cleanNumber(getCell(row, "sales_rate"));
                return {
                    pr_date: formatDate(getCell(row, "pr_date")),
                    party_name: getCell(row, "party_name"),
                    location: getCell(row, "location"),
                    territory: getCell(row, "territory"),
                    product_category: getCell(row, "product_category"),
                    item_name: getCell(row, "item_name"),
                    product_remarks: getCell(row, "product_remarks"),
                    make: getCell(row, "make"),
                    model: getCell(row, "model"),
                    qty: quantity,
                    unit: getCell(row, "unit"),
                    sales_rate: rate,
                    taxable_value: quantity * rate
                };
            });

        if (rows.length === 0) {
            return res.status(400).json({ success: false, message: "Excel file contains no data" });
        }

        log(`Excel preview successful - ${rows.length} rows ready`);
        return res.json({ success: true, rows });
    } catch (error) {
        log(`ERROR creating Excel preview: ${error.message}`);
        return res.status(500).json({ success: false, message: "Failed to process Excel file" });
    }
}

async function importExcel(req, res) {
    const connection = await db.getConnection();
    try {
        const rows = req.body.rows || [];
        if (!Array.isArray(rows) || rows.length === 0) {
            return res.status(400).json({ success: false, message: "No rows available for import" });
        }

        await connection.beginTransaction();
        const insertedRows = [];
        const reportItems = [];

        for (const row of rows) {
            const pr_number = await generatePrNumber(connection);
            const qty = Number(row.qty || 0);
            const sales_rate = Number(row.sales_rate || 0);
            const taxable_value = qty * sales_rate;

            const [result] = await connection.execute(
                `INSERT INTO purchase_requests
                (pr_number, pr_date, party_name, location, territory,
                 product_category, item_name, product_remarks, make, model,
                 qty, unit, sales_rate, taxable_value)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    pr_number,
                    row.pr_date || new Date().toISOString().split("T")[0],
                    row.party_name,
                    row.location,
                    row.territory,
                    row.product_category,
                    row.item_name,
                    row.product_remarks || null,
                    row.make,
                    row.model,
                    qty,
                    row.unit,
                    sales_rate,
                    taxable_value
                ]
            );

            await connection.execute(
                `INSERT INTO vendor_inquiries (pr_id, status, remarks) VALUES (?, 'OPEN', ?)`,
                [result.insertId, row.product_remarks || null]
            );

            insertedRows.push({ pr_number, pr_id: result.insertId });
            reportItems.push(`${pr_number} (${row.item_name} x ${qty} ${row.unit || ""})`);
        }

        await connection.commit();
        await writeReportLog(req, "PR_EXCEL_IMPORTED", `Imported ${insertedRows.length} PRs: ${reportItems.join(", ")}`);

        return res.json({
            success: true,
            message: `Successfully imported ${insertedRows.length} purchase requests`,
            data: insertedRows
        });
    } catch (error) {
        await connection.rollback();
        log(`Error importing PR Excel rows: ${error.message}`);
        return res.status(500).json({ success: false, message: "Failed to import purchase requests" });
    } finally {
        connection.release();
    }
}

module.exports = {
    getPurchaseRequests,
    createPurchaseRequest,
    previewExcel,
    importExcel
};
