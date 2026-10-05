const express = require("express");
const router = express.Router();
const vendorController = require("./vendor.controller");
const { verifyProcurement } = require("../../middleware/auth.middleware");

router.get("/vendors", verifyProcurement, vendorController.getVendors);
router.get("/vendors/:id", verifyProcurement, vendorController.getVendorById);

module.exports = router;
