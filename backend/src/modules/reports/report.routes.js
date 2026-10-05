const express = require("express");
const router = express.Router();
const reportController = require("./report.controller");
const { verifyManager } = require("../../middleware/auth.middleware");

router.get("/report-logs", verifyManager, reportController.getReportLogs);

module.exports = router;
