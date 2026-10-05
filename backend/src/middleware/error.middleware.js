const { log } = require("../utils/logger");

function errorHandler(err, req, res, next) {
    const statusCode = err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    log(`[ERROR] ${req.method} ${req.originalUrl} - ${message}`);
    if (process.env.NODE_ENV !== "production") {
        console.error(err.stack);
    }

    return res.status(statusCode).json({
        success: false,
        message,
        ...(process.env.NODE_ENV !== "production" ? { stack: err.stack } : {})
    });
}

module.exports = {
    errorHandler
};
