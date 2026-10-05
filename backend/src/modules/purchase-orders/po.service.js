const poRepo = require("./po.repository");

async function listPurchaseOrders() {
    return poRepo.findAll();
}

async function getPurchaseOrderById(poId) {
    return poRepo.findById(poId);
}

module.exports = {
    listPurchaseOrders,
    getPurchaseOrderById
};
