const { VENDOR_REQUIRED_FIELDS } = require("./vendor.constants");

function validateVendorPayload(req, res, next) {
    const missing = [];
    for (const field of VENDOR_REQUIRED_FIELDS) {
        if (!req.body[field] || String(req.body[field]).trim() === "") {
            missing.push(field);
        }
    }
    if (missing.length > 0) {
        return res.status(400).json({
            success: false,
            message: `Missing required vendor fields: ${missing.join(", ")}`
        });
    }
    next();
}

module.exports = {
    validateVendorPayload
};
