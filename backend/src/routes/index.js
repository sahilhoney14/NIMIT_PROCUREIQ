const express = require("express");
const router = express.Router();

const authRoutes = require("../modules/auth/auth.routes");
const userRoutes = require("../modules/users/user.routes");
const vendorRoutes = require("../modules/vendors/vendor.routes");
const prRoutes = require("../modules/purchase-requests/pr.routes");
const rfqRoutes = require("../modules/rfq/rfq.routes");
const quotationRoutes = require("../modules/quotations/quotation.routes");
const poRoutes = require("../modules/purchase-orders/po.routes");
const inventoryRoutes = require("../modules/inventory/inventory.routes");
const grnRoutes = require("../modules/goods-receipt/grn.routes");
const approvalRoutes = require("../modules/approvals/approval.routes");
const reportRoutes = require("../modules/reports/report.routes");

router.use("/", authRoutes);
router.use("/", userRoutes);
router.use("/", vendorRoutes);
router.use("/", prRoutes);
router.use("/", rfqRoutes);
router.use("/", quotationRoutes);
router.use("/", poRoutes);
router.use("/", inventoryRoutes);
router.use("/", grnRoutes);
router.use("/", approvalRoutes);
router.use("/", reportRoutes);

module.exports = router;
