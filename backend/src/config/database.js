const mysql = require("mysql2/promise");
const env = require("./env");

const dbConfig = {
    host: env.DB_HOST,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    database: env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
};

const db = mysql.createPool(dbConfig);

const logDb = mysql.createPool({
    host: env.DB_HOST,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    database: env.DB2_NAME,
    waitForConnections: true,
    connectionLimit: 5,
    queueLimit: 0
});

module.exports = {
    db,
    logDb
};
