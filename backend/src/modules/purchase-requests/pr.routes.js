const express = require("express");
const router = express.Router();
const prController = require("./pr.controller");
const { verifyProcurement } = require("../../middleware/auth.middleware");
const { uploadExcel } = require("../../middleware/upload.middleware");

router.get("/pr", verifyProcurement, prController.getPurchaseRequests);
router.post("/pr", verifyProcurement, prController.createPurchaseRequest);
router.post("/pr/preview", verifyProcurement, uploadExcel, prController.previewExcel);
router.post("/pr/import", verifyProcurement, prController.importExcel);

module.exports = router;
