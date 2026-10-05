function validateIssuePo(req, res, next) {
    const poId = Number(req.params.id);
    if (!Number.isInteger(poId) || poId <= 0) {
        return res.status(400).json({ success: false, message: "Invalid PO ID" });
    }
    next();
}

module.exports = {
    validateIssuePo
};
