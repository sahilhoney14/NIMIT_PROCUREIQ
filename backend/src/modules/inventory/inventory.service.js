const invRepo = require("./inventory.repository");

async function getInventoryHistory(poId) {
    const receipts = await invRepo.findGoodsReceivedByPo(poId);
    const returns = await invRepo.findGoodsReturnsByPo(poId);
    return { receipts, returns };
}

module.exports = {
    getInventoryHistory
};
