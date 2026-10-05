const { badRequest } = require("../utils/response");

function validateBody(requiredFields = []) {
    return (req, res, next) => {
        const missing = [];
        for (const field of requiredFields) {
            if (req.body[field] === undefined || req.body[field] === null || String(req.body[field]).trim() === "") {
                missing.push(field);
            }
        }
        if (missing.length > 0) {
            return badRequest(res, `Missing required fields: ${missing.join(", ")}`);
        }
        next();
    };
}

module.exports = {
    validateBody
};
