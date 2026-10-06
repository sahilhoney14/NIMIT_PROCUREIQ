const jwt = require("jsonwebtoken");
const { JWT_SECRET, JWT_EXPIRES_IN } = require("../config/env");

/**
 * Generates a signed JWT token with user credentials.
 * @param {Object} payload { user_id, username, role }
 * @param {Object} options optional jwt options (e.g. expiresIn)
 * @returns {string} JWT token string
 */
function generateToken(payload, options = {}) {
    const data = {
        user_id: payload.user_id,
        username: payload.username,
        role: payload.role
    };
    return jwt.sign(data, JWT_SECRET, {
        expiresIn: options.expiresIn || JWT_EXPIRES_IN || "8h"
    });
}

/**
 * Verifies a JWT token.
 * @param {string} token 
 * @returns {Object|null} Decoded payload or null if invalid/expired
 */
function verifyToken(token) {
    if (!token) return null;
    try {
        return jwt.verify(token, JWT_SECRET);
    } catch {
        return null;
    }
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

    // 2. HTTP-only Cookie
    if (req.cookies) {
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
 * @returns {Object|null} { user_id, username, role } or null
 */
function resolveAuthUser(req) {
    const token = extractToken(req);
    if (token) {
        const decoded = verifyToken(token);
        if (decoded) return decoded;
    }
    // Backward compatibility fallback to session
    if (req?.session?.user) {
        return req.session.user;
    }
    return null;
}

module.exports = {
    generateToken,
    verifyToken,
    extractToken,
    resolveAuthUser
};
