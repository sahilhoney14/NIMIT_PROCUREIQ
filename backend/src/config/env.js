require("dotenv").config();

module.exports = {
    PORT: process.env.PORT || 3000,
    DB_HOST: process.env.DB_HOST || "localhost",
    DB_USER: process.env.DB_USER || "root",
    DB_PASSWORD: process.env.DB_PASSWORD || "Password@123",
    DB_NAME: process.env.DB_NAME || "ProcureIQ",
    DB2_NAME: process.env.DB2_NAME || "ProcureIQ_Logs",
    SESSION_SECRET: process.env.SESSION_SECRET || "procureiq_secure_session_secret_key_2026",
    JWT_SECRET: process.env.JWT_SECRET || "procureiq_jwt_super_secure_secret_token_2026",
    JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || "8h",
    JWT_ACCESS_EXPIRES_IN: process.env.JWT_ACCESS_EXPIRES_IN || "15m",
    JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || "procureiq_refresh_jwt_super_secure_key_2026",
    JWT_REFRESH_EXPIRES_IN: process.env.JWT_REFRESH_EXPIRES_IN || "7d",
    NODE_ENV: process.env.NODE_ENV || "development"
};
