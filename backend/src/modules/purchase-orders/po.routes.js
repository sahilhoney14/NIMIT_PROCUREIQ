const express = require("express");
const router = express.Router();
const poController = require("./po.controller");
const { verifyProcurement } = require("../../middleware/auth.middleware");

router.get("/purchase-orders", verifyProcurement, poController.getPurchaseOrders);
router.get("/purchase-orders/:id", verifyProcurement, poController.getPurchaseOrderById);

module.exports = router;
