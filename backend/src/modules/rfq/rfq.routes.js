const express = require("express");
const router = express.Router();
const rfqController = require("./rfq.controller");
const { verifyProcurement } = require("../../middleware/auth.middleware");

router.get("/inquiries", verifyProcurement, rfqController.getInquiries);
router.get("/inquiries/:id", verifyProcurement, rfqController.getInquiryById);

module.exports = router;
