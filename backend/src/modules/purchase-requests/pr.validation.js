function validateCreatePr(req, res, next) {
    const {
        party_name,
        location,
        territory,
        product_category,
        item_name,
        make,
        model,
        qty,
        unit,
        sales_rate
    } = req.body;

    const required = { party_name, location, territory, product_category, item_name, make, model, qty, unit, sales_rate };
    for (const [key, val] of Object.entries(required)) {
        if (val === undefined || val === null || String(val).trim() === "") {
            return res.status(400).json({ success: false, message: `${key.replace(/_/g, " ")} is required` });
        }
    }

    if (Number(qty) <= 0) {
        return res.status(400).json({ success: false, message: "Quantity must be greater than 0" });
    }
    if (Number(sales_rate) <= 0) {
        return res.status(400).json({ success: false, message: "Sales rate must be greater than 0" });
    }

    next();
}

module.exports = {
    validateCreatePr
};
