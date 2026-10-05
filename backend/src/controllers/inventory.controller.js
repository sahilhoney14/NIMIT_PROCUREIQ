const { db } = require("../config/db");
const { log } = require("../utils/logger");
const { writeReportLog, orDash, dateText } = require("../services/audit.service");

async function getGoodsReceived(req, res) {
    try {
        const [rows] = await db.query(`
            SELECT
                gr.receipt_id,
                gr.po_id,
                gr.received_quantity,
                gr.defective_quantity,
                gr.received_date,
                gr.remarks,
                gr.created_at,
                po.po_number,
                po.vendor_name,
                po.item_name,
                po.qty AS ordered_qty,
                po.unit
            FROM goods_received gr
            JOIN purchase_orders po ON gr.po_id = po.po_id
            ORDER BY gr.receipt_id DESC
        `);
        return res.json({ success: true, data: rows });
    } catch (error) {
        log(`Error fetching goods received: ${error.message}`);
        return res.status(500).json({ success: false, message: "Failed to fetch goods received" });
    }
}

async function getGoodsReceivedByPo(req, res) {
    const poId = Number(req.params.po_id);
    if (!Number.isInteger(poId) || poId <= 0) {
        return res.status(400).json({ success: false, message: "Invalid PO ID" });
    }

    try {
        const [rows] = await db.execute(`
            SELECT
                gr.receipt_id,
                gr.po_id,
                gr.received_quantity,
                gr.defective_quantity,
                gr.received_date,
                gr.remarks,
                gr.created_at,
                u.username AS received_by_user
            FROM goods_received gr
            LEFT JOIN users u ON gr.received_by = u.user_id
            WHERE gr.po_id = ?
            ORDER BY gr.receipt_id DESC
        `, [poId]);

        return res.json({ success: true, data: rows });
    } catch (error) {
        log(`Error fetching receipts for PO ${poId}: ${error.message}`);
        return res.status(500).json({ success: false, message: "Failed to fetch receipts" });
    }
}

async function createGoodsReceived(req, res) {
    const { po_id, received_quantity, receipt_date, remarks } = req.body;
    const poId = Number(po_id);
    const receivedQty = Number(received_quantity);

    if (!Number.isInteger(poId) || poId <= 0) {
        return res.status(400).json({ success: false, message: "Invalid PO ID" });
    }
    if (!Number.isFinite(receivedQty) || receivedQty <= 0) {
        return res.status(400).json({ success: false, message: "Received quantity must be greater than 0" });
    }

    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        const [poRows] = await connection.execute(`
            SELECT po_id, qty, status, unit, po_number, vendor_name, vendor_code, item_name, make, model
            FROM purchase_orders
            WHERE po_id = ?
            FOR UPDATE
        `, [poId]);

        if (poRows.length === 0) {
            await connection.rollback();
            return res.status(404).json({ success: false, message: "Purchase Order not found" });
        }

        const po = poRows[0];
        const orderedQuantity = Number(po.qty);

        const [receivedRows] = await connection.execute(`
            SELECT COALESCE(SUM(received_quantity), 0) AS total_received
            FROM goods_received
            WHERE po_id = ?
        `, [poId]);

        const [returnRows] = await connection.execute(`
            SELECT COALESCE(SUM(return_quantity), 0) AS total_returned
            FROM goods_returns
            WHERE po_id = ?
        `, [poId]);

        const alreadyReceived = Number(receivedRows[0].total_received);
        const totalReturned = Number(returnRows[0].total_returned);
        const remainingQuantity = orderedQuantity - alreadyReceived + totalReturned;

        if (receivedQty > remainingQuantity) {
            await connection.rollback();
            return res.status(400).json({
                success: false,
                message: `Cannot receive ${receivedQty}. Only ${remainingQuantity} ${po.unit || "units"} remaining.`
            });
        }

        const finalReceivedQuantity = alreadyReceived + receivedQty;
        const receivedDate = receipt_date && String(receipt_date).trim() !== "" ? receipt_date : new Date().toISOString().split("T")[0];

        // Ensure received_by is always supplied from session or fallback to 1 (ADMIN)
        const receivedBy = req.user?.user_id || req.session?.user?.user_id || 1;

        const [result] = await connection.execute(`
            INSERT INTO goods_received (po_id, received_quantity, received_date, remarks, received_by)
            VALUES (?, ?, ?, ?, ?)
        `, [poId, receivedQty, receivedDate, remarks?.trim() || null, receivedBy]);

        await connection.commit();
        log(`Goods received - PO: ${poId}, Received: ${receivedQty}`);

        await writeReportLog(
            req,
            "GOODS_RECEIVED",
            `Goods received against purchase order ${po.po_number} from vendor "${orDash(po.vendor_name)}" (${orDash(po.vendor_code)}) on ${dateText(receivedDate)} (receipt ID ${result.insertId}). ` +
            `Item: ${orDash(po.item_name)}, make: ${orDash(po.make)}, model: ${orDash(po.model)}. ` +
            `Quantity received now: ${receivedQty} ${orDash(po.unit)}. ` +
            `Total received so far: ${finalReceivedQuantity} of ${orderedQuantity} ${orDash(po.unit)} ordered, ` +
            `remaining: ${Math.max(orderedQuantity - finalReceivedQuantity, 0)} ${orDash(po.unit)}. ` +
            `Remarks: ${orDash(remarks)}.`
        );

        return res.status(201).json({
            success: true,
            message: "Goods received successfully",
            receipt_id: result.insertId,
            received_quantity: receivedQty,
            total_received: finalReceivedQuantity,
            remaining_quantity: Math.max(orderedQuantity - finalReceivedQuantity, 0),
            progress: orderedQuantity > 0 ? Number(Math.min((finalReceivedQuantity / orderedQuantity) * 100, 100).toFixed(2)) : 0,
            po_status: po.status
        });
    } catch (error) {
        await connection.rollback();
        log(`Goods Received creation failed - ${error.message}`);
        return res.status(500).json({ success: false, message: "Failed to record goods received" });
    } finally {
        connection.release();
    }
}

async function createGoodsReturn(req, res) {
    const { po_id, receipt_id, return_quantity, return_reason, return_date } = req.body;
    const poId = Number(po_id);
    const receiptId = receipt_id ? Number(receipt_id) : null;
    const returnQty = Number(return_quantity);

    if (!Number.isInteger(poId) || poId <= 0) return res.status(400).json({ success: false, message: "Invalid PO ID" });
    if (receiptId !== null && (!Number.isInteger(receiptId) || receiptId <= 0)) return res.status(400).json({ success: false, message: "Invalid receipt ID" });
    if (!Number.isFinite(returnQty) || returnQty <= 0) return res.status(400).json({ success: false, message: "Return quantity must be greater than 0" });
    if (!return_reason || String(return_reason).trim() === "") return res.status(400).json({ success: false, message: "Return reason is required" });

    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        const [poRows] = await connection.execute(`
            SELECT po_id, qty, status, unit, po_number, vendor_name, vendor_code, item_name, make, model
            FROM purchase_orders
            WHERE po_id = ?
            FOR UPDATE
        `, [poId]);

        if (poRows.length === 0) {
            await connection.rollback();
            return res.status(404).json({ success: false, message: "Purchase Order not found" });
        }

        const [receivedRows] = await connection.execute(`
            SELECT COALESCE(SUM(received_quantity), 0) AS total_received
            FROM goods_received
            WHERE po_id = ?
        `, [poId]);

        const totalReceived = Number(receivedRows[0].total_received);

        const [returnRows] = await connection.execute(`
            SELECT COALESCE(SUM(return_quantity), 0) AS total_returned
            FROM goods_returns
            WHERE po_id = ?
        `, [poId]);

        const totalReturned = Number(returnRows[0].total_returned);
        const availableToReturn = totalReceived - totalReturned;

        if (returnQty > availableToReturn) {
            await connection.rollback();
            return res.status(400).json({
                success: false,
                message: `Cannot return ${returnQty}. Only ${availableToReturn} units available to return.`
            });
        }

        const returnDate = return_date && String(return_date).trim() !== "" ? return_date : new Date().toISOString().split("T")[0];
        const returnedBy = req.user?.user_id || req.session?.user?.user_id || 1;

        const [result] = await connection.execute(`
            INSERT INTO goods_returns (po_id, receipt_id, return_quantity, return_reason, return_date, returned_by)
            VALUES (?, ?, ?, ?, ?, ?)
        `, [poId, receiptId, returnQty, return_reason.trim(), returnDate, returnedBy]);

        await connection.commit();
        log(`Goods returned - PO: ${poId}, Returned: ${returnQty}`);

        return res.status(201).json({
            success: true,
            message: "Goods return recorded successfully",
            return_id: result.insertId
        });
    } catch (error) {
        await connection.rollback();
        log(`Goods return failed: ${error.message}`);
        return res.status(500).json({ success: false, message: "Failed to record goods return" });
    } finally {
        connection.release();
    }
}

module.exports = {
    getGoodsReceived,
    getGoodsReceivedByPo,
    createGoodsReceived,
    createGoodsReturn
};
