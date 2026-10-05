const quotationService = require("./quotation.service");

async function getQuotations(req, res) {
    try {
        const inquiryId = Number(req.params.inquiry_id);
        const quotations = await quotationService.getQuotationsByInquiry(inquiryId);
        return res.json({ success: true, quotations });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
}

module.exports = {
    getQuotations
};
