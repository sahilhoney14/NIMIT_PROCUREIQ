const express = require("express");
const router = express.Router();
const prController = require("../controllers/pr.controller");
const { memoryUpload } = require("../middleware/upload.middleware");
const { verifyProcurement } = require("../middleware/auth.middleware");

router.get("/purchase-requests", verifyProcurement, prController.getPurchaseRequests);
router.post("/purchase-requests", verifyProcurement, prController.createPurchaseRequest);
router.post("/purchase-requests/import-preview", verifyProcurement, memoryUpload.single("file"), prController.previewExcel);
router.post("/purchase-requests/import", verifyProcurement, prController.importExcel);

module.exports = router;
