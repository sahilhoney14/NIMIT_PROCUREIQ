const reportService = require("./report.service");

async function getReportLogs(req, res) {
    try {
        const { page, limit, username, from, to } = req.query;
        const result = await reportService.getReportLogs({
            page: Number(page) || 1,
            limit: Number(limit) || 25,
            username,
            from,
            to
        });
        return res.json({ success: true, ...result });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
}

module.exports = {
    getReportLogs
};
