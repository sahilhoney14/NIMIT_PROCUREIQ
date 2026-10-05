const express = require("express");
const router = express.Router();
const approvalController = require("./approval.controller");
const { verifyManager } = require("../../middleware/auth.middleware");

router.get("/approvals", verifyManager, approvalController.getApprovals);

module.exports = router;
