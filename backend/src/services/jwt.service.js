const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const { 
    JWT_SECRET, 
    JWT_EXPIRES_IN, 
    JWT_ACCESS_EXPIRES_IN, 
    JWT_REFRESH_SECRET, 
    JWT_REFRESH_EXPIRES_IN 
} = require("../config/env");

/**
 * Generates a signed Access Token (short-lived, 15m default).
 * @param {Object} payload { user_id, username, role, token_version }
 * @param {Object} options optional jwt options (e.g. expiresIn)
 * @returns {string} JWT token string
 */
function generateAccessToken(payload, options = {}) {
    const data = {
        sub: payload.user_id,
        user_id: payload.user_id,
        username: payload.username,
        role: payload.role,
        token_version: payload.token_version || 1
    };
    return jwt.sign(data, JWT_SECRET, {
        expiresIn: options.expiresIn || JWT_ACCESS_EXPIRES_IN || "12h",
        issuer: "ProcureIQ",
        audience: "ProcureIQ-App"
    });
}

/**
 * Generates a signed Refresh Token (12h default).
 * @param {Object} payload { user_id, token_version }
 * @param {Object} options optional jwt options
 * @returns {string} Refresh token string
 */
function generateRefreshToken(payload, options = {}) {
    const data = {
        sub: payload.user_id,
        user_id: payload.user_id,
        token_version: payload.token_version || 1,
        jti: crypto.randomUUID()
    };
    return jwt.sign(data, JWT_REFRESH_SECRET, {
        expiresIn: options.expiresIn || JWT_REFRESH_EXPIRES_IN || "12h",
        issuer: "ProcureIQ",
        audience: "ProcureIQ-App"
    });
}

/**
 * Legacy token generator (defaults to access token or explicit expiresIn).
 */
function generateToken(payload, options = {}) {
    return generateAccessToken(payload, options);
}

/**
 * Verifies an Access Token.
 * @param {string} token 
 * @returns {Object|null} Decoded payload or null if invalid/expired
 */
function verifyAccessToken(token) {
    if (!token) return null;
    try {
        return jwt.verify(token, JWT_SECRET, {
            issuer: "ProcureIQ",
            audience: "ProcureIQ-App"
        });
    } catch {
        // Fallback verify without strict audience/issuer for tokens generated prior to update
        try {
            return jwt.verify(token, JWT_SECRET);
        } catch {
            return null;
        }
    }
}

/**
 * Verifies a Refresh Token.
 * @param {string} token 
 * @returns {Object|null} Decoded payload or null if invalid/expired
 */
function verifyRefreshToken(token) {
    if (!token) return null;
    try {
        return jwt.verify(token, JWT_REFRESH_SECRET, {
            issuer: "ProcureIQ",
            audience: "ProcureIQ-App"
        });
    } catch {
        try {
            return jwt.verify(token, JWT_REFRESH_SECRET);
        } catch {
            return null;
        }
    }
}

/**
 * Legacy token verifier (aliases verifyAccessToken).
 */
function verifyToken(token) {
    return verifyAccessToken(token);
}

/**
 * Extracts JWT token from request (Bearer Authorization header or Cookie).
 * @param {import('express').Request} req 
 * @returns {string|null} Token or null
 */
function extractToken(req) {
    if (!req) return null;

    // 1. Authorization: Bearer <token>
    const authHeader = req.headers?.authorization;
    if (authHeader && typeof authHeader === "string") {
        const parts = authHeader.trim().split(" ");
        if (parts.length === 2 && parts[0].toLowerCase() === "bearer") {
            return parts[1];
        }
    }

    // 2. HTTP-only Cookie (checks access_token, jwt_token, and auth_token)
    if (req.cookies) {
        if (req.cookies.access_token) return req.cookies.access_token;
        if (req.cookies.jwt_token) return req.cookies.jwt_token;
        if (req.cookies.auth_token) return req.cookies.auth_token;
    }

    // 3. Query string fallback (useful for window.open / PDF download links)
    if (req.query?.auth_token) {
        return req.query.auth_token;
    }

    return null;
}

/**
 * Resolves authenticated user from JWT token, with fallback to req.session.user
 * @param {import('express').Request} req 
 * @returns {Object|null} { user_id, username, role, token_version } or null
 */
function resolveAuthUser(req) {
    const token = extractToken(req);
    if (token) {
        const decoded = verifyAccessToken(token);
        if (decoded) return decoded;
    }
    // Backward compatibility fallback to session
    if (req?.session?.user) {
        return req.session.user;
    }
    return null;
}

module.exports = {
    generateAccessToken,
    generateRefreshToken,
    generateToken,
    verifyAccessToken,
    verifyRefreshToken,
    verifyToken,
    extractToken,
    resolveAuthUser
};
