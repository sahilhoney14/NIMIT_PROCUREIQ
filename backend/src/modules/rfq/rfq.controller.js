const rfqService = require("./rfq.service");

async function getInquiries(req, res) {
    try {
        const inquiries = await rfqService.listInquiries();
        return res.json({ success: true, inquiries });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
}

async function getInquiryById(req, res) {
    try {
        const inquiry = await rfqService.getInquiryById(Number(req.params.id));
        if (!inquiry) return res.status(404).json({ success: false, message: "Inquiry not found" });
        return res.json({ success: true, inquiry });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
}

module.exports = {
    getInquiries,
    getInquiryById
};
