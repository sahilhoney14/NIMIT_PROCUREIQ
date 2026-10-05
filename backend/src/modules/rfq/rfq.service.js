const rfqRepo = require("./rfq.repository");

async function listInquiries() {
    return rfqRepo.findAllInquiries();
}

async function getInquiryById(inquiryId) {
    return rfqRepo.findInquiryById(inquiryId);
}

module.exports = {
    listInquiries,
    getInquiryById
};
