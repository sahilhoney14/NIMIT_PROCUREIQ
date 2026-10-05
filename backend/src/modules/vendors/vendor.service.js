const vendorRepo = require("./vendor.repository");
const vendorService = require("../../services/vendor.service");

async function listVendors() {
    return vendorRepo.findAll();
}

async function getVendorById(vendorId) {
    return vendorRepo.findById(vendorId);
}

module.exports = {
    listVendors,
    getVendorById,
    generateVendorCode: vendorService.generateVendorCode
};
