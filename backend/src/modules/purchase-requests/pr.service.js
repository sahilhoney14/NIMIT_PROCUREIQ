const prRepo = require("./pr.repository");
const { generatePrNumber } = require("../../services/sequence.service");

async function listPurchaseRequests() {
    return prRepo.findAll();
}

async function getPurchaseRequestById(id) {
    return prRepo.findById(id);
}

module.exports = {
    listPurchaseRequests,
    getPurchaseRequestById,
    generatePrNumber
};
