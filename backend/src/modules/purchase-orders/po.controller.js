const poService = require("./po.service");

async function getPurchaseOrders(req, res) {
    try {
        const orders = await poService.listPurchaseOrders();
        return res.json({ success: true, orders });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
}

async function getPurchaseOrderById(req, res) {
    try {
        const poId = Number(req.params.id);
        const order = await poService.getPurchaseOrderById(poId);
        if (!order) return res.status(404).json({ success: false, message: "Purchase Order not found" });
        return res.json({ success: true, order });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
}

module.exports = {
    getPurchaseOrders,
    getPurchaseOrderById
};
