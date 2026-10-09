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
 * Collects all candidate JWT tokens from request in order of priority.
 * @param {import('express').Request} req 
 * @returns {string[]} List of token strings
 */
function getAllCandidateTokens(req) {
    if (!req) return [];
    const candidates = [];

    // 1. Authorization: Bearer <token>
    const authHeader = req.headers?.authorization;
    if (authHeader && typeof authHeader === "string") {
        const parts = authHeader.trim().split(" ");
        if (parts.length === 2 && parts[0].toLowerCase() === "bearer" && parts[1]) {
            candidates.push(parts[1]);
        }
    }

    // 2. HTTP-only Cookies
    if (req.cookies) {
        if (req.cookies.access_token) candidates.push(req.cookies.access_token);
        if (req.cookies.jwt_token) candidates.push(req.cookies.jwt_token);
        if (req.cookies.auth_token) candidates.push(req.cookies.auth_token);
    }

    // 3. Query string fallback (useful for window.open / PDF download links)
    if (req.query?.auth_token) {
        candidates.push(req.query.auth_token);
    }

    return candidates;
}

/**
 * Extracts the primary candidate JWT token from request.
 * @param {import('express').Request} req 
 * @returns {string|null} Token or null
 */
function extractToken(req) {
    const list = getAllCandidateTokens(req);
    return list.length > 0 ? list[0] : null;
}

// User validation cache (in-memory) to prevent DB hammering on every request
// Cache expires in 5 seconds or immediately when invalidated
const userValidationCache = new Map();
const USER_CACHE_TTL_MS = 5000;

function invalidateUserCache(userId) {
    if (userId) {
        userValidationCache.delete(Number(userId));
    } else {
        userValidationCache.clear();
    }
}

async function getValidUser(userId) {
    if (!userId) return null;
    const numericId = Number(userId);
    const now = Date.now();
    const cached = userValidationCache.get(numericId);
    if (cached && (now - cached.cachedAt < USER_CACHE_TTL_MS)) {
        return cached.user;
    }

    try {
        const { db } = require("../config/database");
        const [rows] = await db.execute(
            "SELECT user_id, username, role, is_active, token_version FROM users WHERE user_id = ? LIMIT 1",
            [numericId]
        );
        const user = rows[0] || null;
        userValidationCache.set(numericId, { user, cachedAt: now });
        return user;
    } catch {
        return cached ? cached.user : null;
    }
}

/**
 * Resolves authenticated user with full cryptographic and revocation validation.
 * Verifies token signature, active status in DB, and token_version match.
 * Falls back to req.session.user if present and valid.
 * @param {import('express').Request} req 
 * @returns {Promise<Object|null>} { sub, user_id, username, role, token_version } or null
 */
async function resolveAuthUser(req) {
    if (!req) return null;

    // Fast-path: already resolved and validated for this request lifecycle
    if (req.user && req.user.user_id) {
        return req.user;
    }

    // 1. Check all candidate JWT tokens
    const tokens = getAllCandidateTokens(req);
    for (const token of tokens) {
        const decoded = verifyAccessToken(token);
        if (decoded && decoded.user_id) {
            const dbUser = await getValidUser(decoded.user_id);
            if (dbUser && dbUser.is_active) {
                const tokenVer = Number(decoded.token_version || 1);
                const dbVer = Number(dbUser.token_version || 1);
                if (tokenVer === dbVer) {
                    return {
                        sub: dbUser.user_id,
                        user_id: dbUser.user_id,
                        username: dbUser.username,
                        role: dbUser.role,
                        token_version: dbUser.token_version
                    };
                }
            }
        }
    }

    // 2. Backward compatibility fallback to session
    if (req?.session?.user && req.session.user.user_id) {
        const sessionUser = req.session.user;
        const dbUser = await getValidUser(sessionUser.user_id);
        if (dbUser && dbUser.is_active) {
            const sessionVer = Number(sessionUser.token_version || 1);
            const dbVer = Number(dbUser.token_version || 1);
            if (sessionVer === dbVer) {
                return {
                    sub: dbUser.user_id,
                    user_id: dbUser.user_id,
                    username: dbUser.username,
                    role: dbUser.role,
                    token_version: dbUser.token_version
                };
            }
        }
        // If session user revoked or inactive, clean up dead session
        try {
            req.session.destroy(() => {});
        } catch {}
    }

    return null;
}

/**
 * Synchronous version using fast-path and cached user validity.
 */
function resolveAuthUserSync(req) {
    if (!req) return null;
    if (req.user && req.user.user_id) return req.user;

    const tokens = getAllCandidateTokens(req);
    for (const token of tokens) {
        const decoded = verifyAccessToken(token);
        if (decoded && decoded.user_id) {
            const cached = userValidationCache.get(Number(decoded.user_id));
            if (cached && (Date.now() - cached.cachedAt < USER_CACHE_TTL_MS)) {
                const dbUser = cached.user;
                if (dbUser && dbUser.is_active) {
                    if (Number(decoded.token_version || 1) === Number(dbUser.token_version || 1)) {
                        return {
                            sub: dbUser.user_id,
                            user_id: dbUser.user_id,
                            username: dbUser.username,
                            role: dbUser.role,
                            token_version: dbUser.token_version
                        };
                    }
                }
                return null;
            }
            return decoded;
        }
    }

    if (req?.session?.user) return req.session.user;
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
    getAllCandidateTokens,
    resolveAuthUser,
    resolveAuthUserSync,
    invalidateUserCache
};

