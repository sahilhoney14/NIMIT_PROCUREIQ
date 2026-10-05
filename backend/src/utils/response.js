/**
 * Standardized API Response Helpers
 */

function success(res, data = {}, message = "Success", statusCode = 200) {
    return res.status(statusCode).json({
        success: true,
        message,
        ...data
    });
}

function error(res, message = "Internal Server Error", statusCode = 500, details = null) {
    return res.status(statusCode).json({
        success: false,
        message,
        ...(details ? { details } : {})
    });
}

function badRequest(res, message = "Bad Request", details = null) {
    return error(res, message, 400, details);
}

function notFound(res, message = "Resource not found") {
    return error(res, message, 404);
}

function unauthorized(res, message = "Unauthorized") {
    return error(res, message, 401);
}

function forbidden(res, message = "Forbidden") {
    return error(res, message, 403);
}

module.exports = {
    success,
    error,
    badRequest,
    notFound,
    unauthorized,
    forbidden
};
