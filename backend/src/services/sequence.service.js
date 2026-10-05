const fs = require("fs");
const path = require("path");
const { getFileExtension } = require("../utils/sanitizers");

const piFolder = path.resolve(__dirname, "../../proforma-invoice");

function getFinancialYear(date = new Date()) {
    const month = date.getMonth() + 1;
    const year = date.getFullYear();
    if (month >= 4) {
        return `${String(year).slice(-2)}-${String(year + 1).slice(-2)}`;
    }
    return `${String(year - 1).slice(-2)}-${String(year).slice(-2)}`;
}

async function generatePrNumber(connection) {
    const financialYear = getFinancialYear();
    await connection.execute(
        `INSERT INTO pr_sequences (financial_year, last_number)
         VALUES (?, 0)
         ON DUPLICATE KEY UPDATE financial_year = financial_year`,
        [financialYear]
    );
    await connection.execute(
        `UPDATE pr_sequences
         SET last_number = LAST_INSERT_ID(last_number + 1)
         WHERE financial_year = ?`,
        [financialYear]
    );
    const [rows] = await connection.execute(`SELECT LAST_INSERT_ID() AS sequence_number`);
    const sequenceNumber = rows[0].sequence_number;
    return `NEE/${financialYear}/PR/${String(sequenceNumber).padStart(4, "0")}`;
}

async function generatePoNumber(connection, prNumber) {
    return prNumber.replace("/PR/", "/PO/");
}

function getPiBaseName(poNumber) {
    const piNumber = String(poNumber || "PI").replace(/PO/gi, "PI");
    return piNumber.replace(/[\/\\:*?"<>|]/g, "_");
}

function getPiFileName(poNumber, originalName) {
    return `${getPiBaseName(poNumber)}${getFileExtension(originalName)}`;
}

function findPiFilePath(poNumber) {
    const baseName = getPiBaseName(poNumber);
    if (!fs.existsSync(piFolder)) return null;
    const match = fs.readdirSync(piFolder).find(fileName => path.parse(fileName).name === baseName);
    return match ? path.join(piFolder, match) : null;
}

module.exports = {
    getFinancialYear,
    generatePrNumber,
    generatePoNumber,
    getPiBaseName,
    getPiFileName,
    findPiFilePath,
    piFolder
};
