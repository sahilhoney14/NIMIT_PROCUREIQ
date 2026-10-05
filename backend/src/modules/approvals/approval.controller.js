const approvalService = require("./approval.service");

async function getApprovals(req, res) {
    try {
        const approvals = await approvalService.getPendingApprovals();
        return res.json({ success: true, ...approvals });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
}

module.exports = {
    getApprovals
};
