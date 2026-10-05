const quoteRepo = require("./quotation.repository");

async function getQuotationsByInquiry(inquiryId) {
    return quoteRepo.findByInquiryId(inquiryId);
}

module.exports = {
    getQuotationsByInquiry
};
