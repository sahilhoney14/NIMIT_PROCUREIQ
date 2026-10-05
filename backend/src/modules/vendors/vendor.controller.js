const vendorService = require("./vendor.service");
const { log } = require("../../utils/logger");

async function getVendors(req, res) {
    try {
        const vendors = await vendorService.listVendors();
        return res.json({ success: true, vendors });
    } catch (err) {
        log(`Error fetching vendors: ${err.message}`);
        return res.status(500).json({ success: false, message: "Failed to fetch vendors" });
    }
}

async function getVendorById(req, res) {
    try {
        const vendorId = Number(req.params.id);
        const vendor = await vendorService.getVendorById(vendorId);
        if (!vendor) {
            return res.status(404).json({ success: false, message: "Vendor not found" });
        }
        return res.json({ success: true, vendor });
    } catch (err) {
        log(`Error fetching vendor ${req.params.id}: ${err.message}`);
        return res.status(500).json({ success: false, message: "Failed to fetch vendor" });
    }
}

module.exports = {
    getVendors,
    getVendorById
};
