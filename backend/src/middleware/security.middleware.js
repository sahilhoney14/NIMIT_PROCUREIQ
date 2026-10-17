const helmet = require("helmet");
const rateLimit = require("express-rate-limit");

// Standard security HTTP headers
const securityHeaders = helmet({
    contentSecurityPolicy: false, // Disabled default strict CSP to avoid breaking inline injected portal session state
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" }
});

// Rate limiter for authentication endpoints (prevents brute-force credential stuffing)
const loginRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: process.env.NODE_ENV === "test" ? 10000 : 30, // 30 attempts per 15-minute window per IP (relaxed in test)
    skip: (req) => process.env.NODE_ENV === "test" && req.headers["x-test-bypass-rate-limit"] === "1",
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        message: "Too many login attempts from this IP. Please try again after 15 minutes."
    }
});

// General API rate limiter for DoS / scraping protection
const generalRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 1500, // 1500 requests per 15 minutes per IP
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        message: "Too many requests. Please slow down."
    }
});

module.exports = {
    securityHeaders,
    loginRateLimiter,
    generalRateLimiter
};
