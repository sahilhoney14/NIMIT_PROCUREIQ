const express = require("express");
const router = express.Router();
const quotationController = require("./quotation.controller");
const { verifyProcurement } = require("../../middleware/auth.middleware");

router.get("/inquiries/:inquiry_id/quotations", verifyProcurement, quotationController.getQuotations);

module.exports = router;
