const express = require("express");
const router = express.Router();
const inventoryController = require("../controllers/inventory.controller");
const { verifyProcurement } = require("../middleware/auth.middleware");

router.get("/goods-received", verifyProcurement, inventoryController.getGoodsReceived);
router.get("/goods-received/:po_id", verifyProcurement, inventoryController.getGoodsReceivedByPo);
router.post("/goods-received", verifyProcurement, inventoryController.createGoodsReceived);
router.post("/goods-returns", verifyProcurement, inventoryController.createGoodsReturn);

module.exports = router;
