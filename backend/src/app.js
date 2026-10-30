const path = require("path");
const express = require("express");
const session = require("express-session");
const cookieParser = require("cookie-parser");
const mysql = require("mysql2/promise");
const bcrypt = require("bcrypt");
const fs = require("fs");
const multer = require("multer");
const { readSheet } = require("read-excel-file/node");
const PDFDocument = require("pdfkit");
const ExcelJS = require("exceljs");
const env = require("./config/env");
const authController = require("./modules/auth/auth.controller");
const { generateAccessToken, generateRefreshToken, generateToken, verifyToken, verifyRefreshToken, extractToken, resolveAuthUser, invalidateUserCache } = require("./services/jwt.service");

const app = express();
const PORT = env.PORT || 3000;

/* ==========================================================================
   TECHNICAL LOGGER (console only - separate from business Report Logs)
   ========================================================================== */

function log(message) {
    console.log(`[${new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}] ${message}`);
}

/* ==========================================================================
   DATABASE CONNECTIONS
   ========================================================================== */

const dbConfig = {
    host: env.DB_HOST,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    database: env.DB_NAME
};

// Main procurement database pool
const db = mysql.createPool({
    ...dbConfig,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Logging database pool (same server and credentials, database = DB2_NAME) - holds report_logs
const logDb = mysql.createPool({
    host: env.DB_HOST,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    database: env.DB2_NAME,
    waitForConnections: true,
    connectionLimit: 5,
    queueLimit: 0
});

const authServiceUrl = process.env.AUTH_SERVICE_URL;

const { securityHeaders, loginRateLimiter } = require("./middleware/security.middleware");
const { memoryUpload: upload, excelUpload } = require("./middleware/upload.middleware");

const vendorFolder = path.resolve(__dirname, "../vendor");
const poFolder      = path.resolve(__dirname, "../purchase-orders");
const headerImgPath = path.resolve(__dirname, "../PO header.png");

app.use(securityHeaders);
app.use(express.json());
app.use(express.urlencoded({extended:false}));
app.use(cookieParser());

const SESSION_MAX_AGE = env.SESSION_MAX_AGE || (6 * 24 * 60 * 60 * 1000); // 6 days

app.use(session({
    name: "login_session",
    secret: env.SESSION_SECRET || "procureiq_secure_session_secret_key_2026",
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: SESSION_MAX_AGE
    }
}));

// Mount Modular API Router
const apiRouter = require("./routes");
app.use("/api", apiRouter);

/* ==========================================================================
   AUTHENTICATION (JWT & Session verification middleware)
   ========================================================================== */

function isDashboardPageRequest(req) {
    const p = (req.path || "").replace(/\/+$/, "") || "/";
    const acceptsHtml = req.headers.accept?.includes("text/html");
    return acceptsHtml && (p === "/admin" || p === "/procurement");
}

async function verifyAdmin(req, res, next) {
    try {
        const authUser = await resolveAuthUser(req);
        if (!authUser) {
            if (!isDashboardPageRequest(req)) {
                return res.status(401).json({ success: false, message: "Unauthenticated" });
            }
            return res.redirect("/?reason=unauthenticated");
        }
        if (authUser.role !== "ADMIN") {
            if (!isDashboardPageRequest(req)) {
                return res.status(403).json({ success: false, message: "Forbidden: ADMIN access required" });
            }
            if (authUser.role === "PROCUREMENT") return res.redirect("/procurement");
            return res.redirect("/");
        }
        req.user = authUser;
        next();
    } catch (err) {
        log(`verifyAdmin error: ${err.message}`);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
}

async function verifyManager(req, res, next) {
    try {
        const authUser = await resolveAuthUser(req);
        if (!authUser) {
            if (!isDashboardPageRequest(req)) {
                return res.status(401).json({ success: false, message: "Unauthenticated" });
            }
            return res.redirect("/?reason=unauthenticated");
        }
        if (authUser.role !== "ADMIN") {
            if (!isDashboardPageRequest(req)) {
                return res.status(403).json({ success: false, message: "Forbidden: ADMIN access required" });
            }
            if (authUser.role === "PROCUREMENT") return res.redirect("/procurement");
            return res.redirect("/");
        }
        req.user = authUser;
        next();
    } catch (err) {
        log(`verifyManager error: ${err.message}`);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
}

async function verifyProcurement(req, res, next) {
    try {
        const authUser = await resolveAuthUser(req);
        if (!authUser) {
            if (!isDashboardPageRequest(req)) {
                return res.status(401).json({ success: false, message: "Unauthenticated" });
            }
            return res.redirect("/?reason=unauthenticated");
        }
        if (!["ADMIN", "PROCUREMENT", "USER"].includes(authUser.role)) {
            if (!isDashboardPageRequest(req)) {
                return res.status(403).json({ success: false, message: "Forbidden: Procurement access required" });
            }
            return res.redirect("/");
        }
        req.user = authUser;
        next();
    } catch (err) {
        log(`verifyProcurement error: ${err.message}`);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
}

/* ==========================================================================
   REPORT LOG HELPERS (business activity history stored in DB2_NAME.report_logs)
   ========================================================================== */

const actorCache = new Map();
const ACTOR_CACHE_TTL_MS = 5 * 60 * 1000;

// Resolves the username performing the current request (from req.user, JWT token, or session)
async function getActor(req) {
    if (req.user?.username) return req.user.username;
    const authUser = await resolveAuthUser(req);
    return authUser?.username || "SYSTEM";
}

// Writes one business-activity entry to report_logs. Never throws, so a logging failure can never break a business action.
async function writeReportLog(req, action, report) {
    try {
        const username = await getActor(req);
        await logDb.execute(
            `INSERT INTO report_logs (username, action, report) VALUES (?, ?, ?)`,
            [String(username).slice(0, 100), String(action).slice(0, 100), String(report)]
        );
    } catch (error) {
        log(`ERROR writing report log (${action}): ${error.message}`);
    }
}

// Writes batch business-activity entries to report_logs in a single query (or 50-item chunks).
async function writeReportLogs(req, items) {
    if (!Array.isArray(items) || items.length === 0) return;
    try {
        const username = await getActor(req);
        const safeUser = String(username).slice(0, 100);
        const chunkSize = 50;
        for (let i = 0; i < items.length; i += chunkSize) {
            const chunk = items.slice(i, i + chunkSize);
            const placeholders = chunk.map(() => "(?, ?, ?)").join(", ");
            const params = [];
            chunk.forEach(item => {
                params.push(safeUser, String(item.action).slice(0, 100), String(item.report));
            });
            await logDb.execute(
                `INSERT INTO report_logs (username, action, report) VALUES ${placeholders}`,
                params
            );
        }
    } catch (error) {
        log(`ERROR writing batch report logs: ${error.message}`);
    }
}

// Writes one administrative-change entry to audit_logs. Never throws, so a logging failure can never break a business action.
async function writeAuditLog(req, action, oldValue, newValue) {
    try {
        const username = await getActor(req);
        await logDb.execute(
            `INSERT INTO audit_logs (username, action, old_value, new_value) VALUES (?, ?, ?, ?)`,
            [String(username).slice(0, 100), String(action).slice(0, 100), oldValue ?? null, newValue ?? null]
        );
    } catch (error) {
        log(`ERROR writing audit log (${action}): ${error.message}`);
    }
}

// Formats a number as an Indian-style currency amount for report text
function money(value) {
    return Number(value || 0).toLocaleString("en-IN", {minimumFractionDigits: 2,maximumFractionDigits: 2});
}

// Returns "-" for empty values so report text never contains blanks or "null"
function orDash(value) {
    if (value === null || value === undefined) return "-";
    const text = String(value).trim();
    return text === "" ? "-" : text;
}

// Formats a Date / date string as YYYY-MM-DD for report text
function dateText(value) {
    if (!value) return "-";
    if (value instanceof Date) return value.toISOString().split("T")[0];
    return String(value).split("T")[0];
}

// Builds the human-readable description of a purchase request used in several report entries
function describePr(pr) {
    return `PR ${pr.pr_number} dated ${dateText(pr.pr_date)} for party "${orDash(pr.party_name)}" ` +
        `(location: ${orDash(pr.location)}, territory: ${orDash(pr.territory)}). ` +
        `Product: ${orDash(pr.item_name)} [category: ${orDash(pr.product_category)}], make: ${orDash(pr.make)}, model: ${orDash(pr.model)}. ` +
        `Quantity: ${Number(pr.qty || 0)} ${orDash(pr.unit)} at sales rate ${money(pr.sales_rate)}, taxable value ${money(pr.taxable_value)}. ` +
        `Remarks: ${orDash(pr.product_remarks)}.`;
}

// Builds the human-readable payment-terms text used in quotation / PO report entries
function describePayment(q) {
    let text = `Payment type: ${orDash(q.payment_type)}`;
    if (q.advance_type) text += `, advance: ${q.advance_value} (${q.advance_type})`;
    if (q.balance_due_days) text += `, balance due in ${q.balance_due_days} days`;
    if (q.payment_terms_remarks) text += `, terms: ${q.payment_terms_remarks}`;
    return text;
}

/* ==========================================================================
   GENERAL HELPERS
   ========================================================================== */

// Trims strings and converts empty / "-" values to null
function cleanValue(value) {
    if (value === null || value === undefined) return null;
    if (typeof value === "string") {
        const cleaned = value.trim();
        if (cleaned === "" || cleaned === "-") return null;
        return cleaned;
    }
    return value;
}

// Converts a value to a finite number, defaulting to 0
function cleanNumber(value) {
    if (value === null || value === undefined || value === "") return 0;
    if (typeof value === "string" && value.trim() === "-") return 0;
    const number = Number(value);
    return Number.isFinite(number) ? number : 0;
}

// Returns the Indian financial year (April-March) as "YY-YY" for the given date
function getFinancialYear(date = new Date()) {
    const month = date.getMonth() + 1;
    const year = date.getFullYear();
    if (month >= 4)return `${String(year).slice(-2)}-${String(year + 1).slice(-2)}`;
    return `${String(year - 1).slice(-2)}-${String(year).slice(-2)}`;
}

// Generates the next sequential PR number for the current financial year inside the caller's transaction
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

// Generates multiple sequential PR numbers in batch inside the caller's transaction in O(1) DB calls
async function generatePrNumbers(connection, count) {
    if (count <= 0) return [];
    const financialYear = getFinancialYear();
    await connection.execute(
        `INSERT INTO pr_sequences (financial_year, last_number)
         VALUES (?, 0)
         ON DUPLICATE KEY UPDATE financial_year = financial_year`,
        [financialYear]
    );
    await connection.execute(
        `UPDATE pr_sequences
         SET last_number = LAST_INSERT_ID(last_number + ?)
         WHERE financial_year = ?`,
        [count, financialYear]
    );
    const [rows] = await connection.execute(`SELECT LAST_INSERT_ID() AS end_sequence`);
    const endSequence = Number(rows[0].end_sequence);
    const startSequence = endSequence - count + 1;
    const prNumbers = [];
    for (let i = startSequence; i <= endSequence; i++) {
        prNumbers.push(`NEE/${financialYear}/PR/${String(i).padStart(4, "0")}`);
    }
    return prNumbers;
}

// Normalizes an Excel header into a snake_case key
function normalizeHeader(value) {
    return String(value || "")
        .trim()
        .replace(/\s*\(\s*(required|optional)\s*\)/gi, "")
        .replace(/[*#?:.,!]/g, "")
        .toLowerCase()
        .replace(/\s+/g, "_")
        .replace(/[\/()-]+/g, "_")
        .replace(/_+/g, "_")
        .replace(/^_|_$/g, "");
}

// Converts Date objects and dd-mm-yyyy style text into YYYY-MM-DD
function formatDate(value) {
    if (!value) return null;
    if (value instanceof Date) return value.toISOString().split("T")[0];
    const text = String(value).trim();
    if (text === "" || text === "-") return null;
    const match = text.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
    if (match)return `${match[3]}-${match[2].padStart(2, "0")}-${match[1].padStart(2, "0")}`;
    return text;
}

// Makes a company name safe to use as a folder name
function sanitizeFolderName(name) {
    if (!name) return "unnamed_vendor";
    const clean = String(name)
        .trim()
        .replace(/[<>:"/\\|?*]/g, "_")
        .replace(/\s+/g, " ")
        .replace(/[.\s]+$/, "");
    return clean || "unnamed_vendor";
}

// Sanitizes text values to prevent Excel Formula Injection (CWE-1236)
function sanitizeExcelCellValue(val) {
    if (typeof val === "string" && /^[=+\-@\t\r]/.test(val)) {
        return `'${val}`;
    }
    return val;
}

// Returns the lower-case file extension of an upload, defaulting to .pdf
function getFileExtension(filename) {
    const extension = path.extname(filename || "").toLowerCase();
    return extension || ".pdf";
}

// Derives the PO number from the PR number by swapping /PR/ for /PO/
async function generatePoNumber(connection, prNumber) {
    return prNumber.replace("/PR/", "/PO/");
}

/* ==========================================================================
   VENDOR HELPERS
   ========================================================================== */

// Writes the uploaded vendor documents into vendor/<company name>/ and returns their locations
function saveVendorDocuments(files, companyName) {
    const folderName = sanitizeFolderName(companyName);
    const companyFolder = path.join(vendorFolder, folderName);
    fs.mkdirSync(companyFolder, { recursive: true });
    const documentLocations = {};
    const createdFiles = [];
    const documentNames = {
        gst_document: "GST",
        pan_document: "PAN",
        msme_document: "MSME",
        itr_last_year_document: "ITR_Last_Year",
        itr_second_last_year_document: "ITR_Second_Last_Year",
        itr_third_last_year_document: "ITR_Third_Last_Year"
    };
    for (const [fieldName, fileList] of Object.entries(files || {})) {
        const file = fileList?.[0];
        if (!file) continue;
        const fileName = `${documentNames[fieldName]}${getFileExtension(file.originalname)}`;
        const filePath = path.join(companyFolder, fileName);
        fs.writeFileSync(filePath, file.buffer);
        createdFiles.push(filePath);
        documentLocations[fieldName] = path.relative(__dirname, filePath).replace(/\\/g, "/");
    }
    return { documentLocations, createdFiles, companyFolder };
}

// Deletes files written during a failed vendor save and removes the company folder if it is empty
function cleanupFiles(files, companyFolder) {
    for (const filePath of files || []) {
        try {
            if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        } catch (error) {
            log(`ERROR deleting file: ${error.message}`);
        }
    }
    try {
        if (companyFolder && fs.existsSync(companyFolder) && fs.readdirSync(companyFolder).length === 0) {
            fs.rmdirSync(companyFolder);
        }
    } catch (error) {
        log(`ERROR removing vendor folder: ${error.message}`);
    }
}

// Multer middleware accepting the six vendor document uploads
function getVendorDocuments() {
    return upload.fields([
        { name: "gst_document", maxCount: 1 },
        { name: "pan_document", maxCount: 1 },
        { name: "msme_document", maxCount: 1 },
        { name: "itr_last_year_document", maxCount: 1 },
        { name: "itr_second_last_year_document", maxCount: 1 },
        { name: "itr_third_last_year_document", maxCount: 1 }
    ]);
}

// Parses the vendor_data JSON sent alongside the vendor document uploads
function parseVendorData(req) {
    if (!req.body.vendor_data) return null;
    try {
        return typeof req.body.vendor_data === "string" ? JSON.parse(req.body.vendor_data) : req.body.vendor_data;
    } catch {
        return null;
    }
}

// Database columns of vendor_oem_masters that hold vendor details
const VENDOR_FIELDS = [
    "registration_date",
    "vendor_name",
    "office_address",
    "office_contact_name",
    "office_contact_number",
    "factory_address",
    "factory_contact_name",
    "factory_contact_number",
    "warehouse_address",
    "warehouse_contact_name",
    "warehouse_contact_number",
    "workshop_address",
    "workshop_contact_name",
    "workshop_contact_number",
    "legal_entity",
    "commercial_role",
    "year_of_incorporation",
    "director_or_ceo_or_management_name",
    "director_or_ceo_or_management_designation",
    "director_or_ceo_or_management_mobile_no",
    "director_or_ceo_or_management_email",
    "director_or_ceo_or_management_web_address",
    "sales_team_name",
    "sales_team_contact",
    "sales_team_email",
    "accounts_team_name",
    "accounts_team_contact",
    "accounts_team_email",
    "gst_number",
    "pan_number",
    "msme_number",
    "bank_name",
    "bank_account_no",
    "bank_branch",
    "bank_account_type",
    "bank_ifsc",
    "branch_office_1_address",
    "branch_office_1_contact_name",
    "branch_office_1_contact_number",
    "branch_office_2_address",
    "branch_office_2_contact_name",
    "branch_office_2_contact_number",
    "branch_office_3_address",
    "branch_office_3_contact_name",
    "branch_office_3_contact_number",
    "turnover_year_1",
    "turnover_value_1",
    "turnover_year_2",
    "turnover_value_2",
    "turnover_year_3",
    "turnover_value_3",
    "recommended_by",
    "approved_by"
];

// Database columns of vendor_oem_masters that hold uploaded document paths
const VENDOR_DOCUMENT_FIELDS = [
    "gst_document",
    "pan_document",
    "msme_document",
    "itr_last_year_document",
    "itr_second_last_year_document",
    "itr_third_last_year_document"
];

// Checks that all required vendor fields (marked with * in import) are filled
function validateVendorData(data, files) {
    const requiredFields = [
        "vendor_name"
    ];
    const missingFields = requiredFields.filter(field => !cleanValue(data?.[field]));
    const requiredDocuments = []; // All documents are optional
    const missingDocuments = [];
    const invalidFields = [];
    return { missingFields, missingDocuments, invalidFields };
}

// Cleans the raw vendor data into the exact set of columns that get stored
function prepareVendorData(data) {
    const vendor = {};
    for (const field of VENDOR_FIELDS)vendor[field] = cleanValue(data?.[field]);
    vendor.registration_date = formatDate(data?.registration_date);
    return vendor;
}

// Inserts a vendor, stores documents and assigns the vendor code
async function saveVendor(connection, data, files) {
    const vendor = prepareVendorData(data);

    const customVendorCode = cleanValue(data?.vendor_code);
    if (customVendorCode) {
        const [existingCode] = await connection.execute(
            `SELECT vendor_id, vendor_name FROM vendor_oem_masters WHERE vendor_code = ? LIMIT 1`,
            [customVendorCode]
        );
        if (existingCode.length > 0) {
            throw new Error(`Vendor code "${customVendorCode}" already exists for vendor "${existingCode[0].vendor_name}"`);
        }
    }

    const { documentLocations, createdFiles, companyFolder } = saveVendorDocuments(files, vendor.vendor_name);
    try {
        const columns = [...VENDOR_FIELDS, ...VENDOR_DOCUMENT_FIELDS];
        const values = [
            ...VENDOR_FIELDS.map(field => {
                if (vendor[field] === null || vendor[field] === undefined) {
                    if (field === "registration_date") return new Date().toISOString().slice(0, 10);
                    return "";
                }
                return vendor[field];
            }),
            ...VENDOR_DOCUMENT_FIELDS.map(field => documentLocations[field] || null)
        ];
        const placeholders = columns.map(() => "?").join(", ");
        const [result] = await connection.execute(
            `INSERT INTO vendor_oem_masters (${columns.join(", ")})
             VALUES (${placeholders})`,
            values
        );
        const vendorId = result.insertId;
        const financialYear = getFinancialYear().replace("-", "");
        const vendorCode = customVendorCode || `NEE${financialYear}V${String(vendorId).padStart(3, "0")}`;
        await connection.execute(
            `UPDATE vendor_oem_masters SET vendor_code = ? WHERE vendor_id = ?`,
            [vendorCode, vendorId]
        );
        return { vendorId, vendorCode, createdFiles, companyFolder, documentLocations };
    } catch (error) {
        cleanupFiles(createdFiles, companyFolder);
        throw error;
    }
}

// Builds the report text for a newly registered vendor
function describeVendor(data, result, source) {
    const vendor = prepareVendorData(data);
    const documents = Object.keys(result.documentLocations || {}).join(", ");
    return `Vendor "${orDash(vendor.vendor_name)}" registered ${source} with vendor code ${result.vendorCode} (vendor ID ${result.vendorId}). ` +
        `Registration date: ${orDash(vendor.registration_date)}. Legal entity: ${orDash(vendor.legal_entity)}, commercial role: ${orDash(vendor.commercial_role)}, ` +
        `year of incorporation: ${orDash(vendor.year_of_incorporation)}. ` +
        `GST: ${orDash(vendor.gst_number)}, PAN: ${orDash(vendor.pan_number)}, MSME: ${orDash(vendor.msme_number)}. ` +
        `Office: ${orDash(vendor.office_address)} (contact: ${orDash(vendor.office_contact_name)}, ${orDash(vendor.office_contact_number)}). ` +
        `Management contact: ${orDash(vendor.director_or_ceo_or_management_name)} (${orDash(vendor.director_or_ceo_or_management_designation)}), ` +
        `${orDash(vendor.director_or_ceo_or_management_mobile_no)}, ${orDash(vendor.director_or_ceo_or_management_email)}. ` +
        `Sales contact: ${orDash(vendor.sales_team_name)}, ${orDash(vendor.sales_team_contact)}. ` +
        `Bank: ${orDash(vendor.bank_name)}, ${orDash(vendor.bank_branch)}, IFSC ${orDash(vendor.bank_ifsc)}. ` +
        `Recommended by: ${orDash(vendor.recommended_by)}, approved by: ${orDash(vendor.approved_by)}. ` +
        `Documents uploaded: ${orDash(documents)}.`;
}

const formStr = v => {
    const c = cleanValue(v);
    return c === null ? null : String(c).trim();
};

const formKey = v => (formStr(v) || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

// Maps form labels to database fields for each labelled section of the Vendor Registration Form
const VENDOR_FORM_SECTIONS = {
    director: {
        "name": "director_or_ceo_or_management_name",
        "designation": "director_or_ceo_or_management_designation",
        "mobile no": "director_or_ceo_or_management_mobile_no",
        "e mail": "director_or_ceo_or_management_email",
        "web address": "director_or_ceo_or_management_web_address"
    },
    sales: {
        "name": "sales_team_name",
        "contact detail": "sales_team_contact",
        "e mail": "sales_team_email"
    },
    accounts: {
        "name": "accounts_team_name",
        "contact detail": "accounts_team_contact",
        "e mail": "accounts_team_email"
    },
    company: {
        "gst no": "gst_number",
        "pan no": "pan_number",
        "bank name": "bank_name",
        "account no": "bank_account_no",
        "branch details": "bank_branch",
        "type of account": "bank_account_type",
        "ifsc rtgs code": "bank_ifsc"
    }
};

// Maps section heading text in the Vendor Registration Form to a section key
const SECTION_HEADERS = {
    "director ceo management team": "director",
    "sales team": "sales",
    "account team": "accounts",
    "company s detail": "company",
    "client details": "client",
    "turnover of last three years": "turnover",
    "documents to be submitted": "documents",
    "for office use only": "office_use"
};

// Detects whether an uploaded sheet is the formatted Vendor Registration Form
function isVendorForm(rows) {
    return rows.some(row => formKey(row[0]) === "vendor registration form");
}

// Parses the formatted Vendor Registration Form sheet into vendor fields
function parseVendorForm(rows) {
    const vendor = Object.fromEntries(VENDOR_FIELDS.map(field => [field, null]));
    const set = (field, value) => {
        const text = formStr(value);
        if (text) vendor[field] = text;
    };
    const locationBySide = {};
    let section = null;
    let branchNo = null;
    let turnoverNo = 0;
    for (const row of rows) {
        const a = formKey(row[0]);
        const b = formKey(row[1]);
        if (SECTION_HEADERS[a]) {
            section = SECTION_HEADERS[a];
            continue;
        }
        if (a.startsWith("details of branch office")) {
            section = "branch";
            continue;
        }
        if (a === "status") {
            set("legal_entity", row[1]);
            section = "status";
            continue;
        }
        if (section === "status" && !a && b) {
            set("commercial_role", row[1]);
            section = null;
            continue;
        }
        if (a === "year of incorporation") {
            set("year_of_incorporation", row[1]);
            continue;
        }
        if (section === null) {
            if (a === "name") set("vendor_name", row[1]);
            if (formKey(row[5]) === "date" && row[6])vendor.registration_date = formatDate(row[6]);
            for (const [labelCol, subCol, valueCol] of [[1, 2, 3], [4, 5, 6]]) {
                const loc = formKey(row[labelCol]);
                if (["office", "factory", "warehouse", "workshop"].includes(loc))locationBySide[subCol] = loc;
                const prefix = locationBySide[subCol];
                if (!prefix) continue;
                const sub = formKey(row[subCol]);
                if (sub === "address") set(`${prefix}_address`, row[valueCol]);
                if (sub === "contact name") set(`${prefix}_contact_name`, row[valueCol]);
                if (sub === "contact number") set(`${prefix}_contact_number`, row[valueCol]);
            }
            continue;
        }
        if (VENDOR_FORM_SECTIONS[section]) {
            if (section === "company" && a.startsWith("micro small medium")) {
                set("msme_number", row[1]);
                continue;
            }
            const field = VENDOR_FORM_SECTIONS[section][a];
            if (field) set(field, row[1]);
            continue;
        }
        if (section === "branch") {
            if (/^[1-3]$/.test(a)) branchNo = Number(a);
            if (!branchNo) continue;
            if (b === "address") set(`branch_office_${branchNo}_address`, row[2]);
            if (b === "contact name") set(`branch_office_${branchNo}_contact_name`, row[2]);
            if (b === "contact number") set(`branch_office_${branchNo}_contact_number`, row[2]);
            continue;
        }
        if (section === "turnover") {
            const year = formStr(row[0]);
            if (a === "year" || !year || turnoverNo >= 3) continue;
            turnoverNo++;
            set(`turnover_year_${turnoverNo}`, year);
            set(`turnover_value_${turnoverNo}`, row[1]);
            continue;
        }
        if (section === "office_use") {
            if (a.startsWith("recommended by")) set("recommended_by", row[1]);
            if (a.startsWith("approved by")) set("approved_by", row[1]);
        }
    }
    return vendor;
}

// Header aliases for robust column mapping during vendor Excel import
const VENDOR_HEADER_ALIASES = {
    vendor_name: ["vendor_name", "vendor", "company_name", "firm_name", "supplier_name", "vendor_oem_name", "oem_name"],
    registration_date: ["registration_date", "registration_date_yyyy_mm_dd", "registration_date_dd_mm_yyyy", "reg_date", "date"],
    legal_entity: ["legal_entity", "entity", "entity_type", "type_of_entity", "legal_entity_type"],
    commercial_role: ["commercial_role", "role", "role_type", "business_type", "commercial_role_type"],
    year_of_incorporation: ["year_of_incorporation", "incorporation_year", "est_year", "established_year", "year"],
    office_address: ["office_address", "reg_office_address", "registered_office_address", "address"],
    office_contact_name: ["office_contact_name", "office_contact_person", "contact_person", "office_contact", "contact_name"],
    office_contact_number: ["office_contact_number", "office_contact_phone", "office_phone", "contact_number", "phone_number", "mobile_number", "office_mobile", "contact_phone"],
    factory_address: ["factory_address", "works_address", "plant_address"],
    factory_contact_name: ["factory_contact_name", "factory_contact_person"],
    factory_contact_number: ["factory_contact_number", "factory_phone"],
    warehouse_address: ["warehouse_address", "godown_address"],
    warehouse_contact_name: ["warehouse_contact_name", "warehouse_contact_person"],
    warehouse_contact_number: ["warehouse_contact_number", "warehouse_phone"],
    workshop_address: ["workshop_address"],
    workshop_contact_name: ["workshop_contact_name", "workshop_contact_person"],
    workshop_contact_number: ["workshop_contact_number", "workshop_phone"],
    director_or_ceo_or_management_name: ["director_or_ceo_or_management_name", "management_name", "director_name", "ceo_name", "director_ceo_name", "director_ceo_management_name", "management_director_name", "director_or_ceo_name", "director_or_management_name"],
    director_or_ceo_or_management_designation: ["director_or_ceo_or_management_designation", "designation", "management_designation", "director_designation", "ceo_designation"],
    director_or_ceo_or_management_mobile_no: ["director_or_ceo_or_management_mobile_no", "management_mobile", "director_mobile", "director_phone", "management_contact", "management_mobile_no", "director_mobile_no", "management_phone"],
    director_or_ceo_or_management_email: ["director_or_ceo_or_management_email", "management_email", "director_email", "ceo_email"],
    director_or_ceo_or_management_web_address: ["director_or_ceo_or_management_web_address", "website", "web_address", "director_web_address", "web"],
    sales_team_name: ["sales_team_name", "sales_contact_name", "sales_name", "sales_person", "sales_contact_person"],
    sales_team_contact: ["sales_team_contact", "sales_contact_phone", "sales_contact", "sales_phone", "sales_mobile", "sales_contact_number"],
    sales_team_email: ["sales_team_email", "sales_email"],
    accounts_team_name: ["accounts_team_name", "accounts_contact_name", "accounts_name", "accounts_person", "accounts_contact_person"],
    accounts_team_contact: ["accounts_team_contact", "accounts_contact_phone", "accounts_contact", "accounts_phone", "accounts_mobile", "accounts_contact_number"],
    accounts_team_email: ["accounts_team_email", "accounts_email"],
    gst_number: ["gst_number", "gst_no", "gst", "gstin"],
    pan_number: ["pan_number", "pan_no", "pan"],
    msme_number: ["msme_number", "msme_no", "msme", "udyam_number", "udyam_registration", "udyam_no"],
    bank_name: ["bank_name", "bank"],
    bank_account_no: ["bank_account_no", "bank_account_number", "account_no", "account_number", "bank_acc_no"],
    bank_branch: ["bank_branch", "branch", "branch_name", "branch_details"],
    bank_account_type: ["bank_account_type", "account_type", "type_of_account"],
    bank_ifsc: ["bank_ifsc", "ifsc", "ifsc_code", "bank_ifsc_code", "rtgs_ifsc_code", "ifsc_rtgs_code"],
    branch_office_1_address: ["branch_office_1_address", "branch_1_address", "branch_office_1"],
    branch_office_1_contact_name: ["branch_office_1_contact_name", "branch_1_contact_name", "branch_1_contact"],
    branch_office_1_contact_number: ["branch_office_1_contact_number", "branch_1_contact_number", "branch_1_phone"],
    branch_office_2_address: ["branch_office_2_address", "branch_2_address", "branch_office_2"],
    branch_office_2_contact_name: ["branch_office_2_contact_name", "branch_2_contact_name", "branch_2_contact"],
    branch_office_2_contact_number: ["branch_office_2_contact_number", "branch_2_contact_number", "branch_2_phone"],
    branch_office_3_address: ["branch_office_3_address", "branch_3_address", "branch_office_3"],
    branch_office_3_contact_name: ["branch_office_3_contact_name", "branch_3_contact_name", "branch_3_contact"],
    branch_office_3_contact_number: ["branch_office_3_contact_number", "branch_3_contact_number", "branch_3_phone"],
    turnover_year_1: ["turnover_year_1", "year_1"],
    turnover_value_1: ["turnover_value_1", "value_1", "turnover_1"],
    turnover_year_2: ["turnover_year_2", "year_2"],
    turnover_value_2: ["turnover_value_2", "value_2", "turnover_2"],
    turnover_year_3: ["turnover_year_3", "year_3"],
    turnover_value_3: ["turnover_value_3", "value_3", "turnover_3"],
    recommended_by: ["recommended_by", "recommended"],
    approved_by: ["approved_by", "approved"]
};

// Parses a tabular vendor sheet (header row + N vendor rows) into vendor field objects
function parseVendorTable(excelRows) {
    const dataRows = excelRows.slice(1).filter(row => row && row.some(cell => cell !== null && cell !== undefined && String(cell).trim() !== ""));
    if (dataRows.length === 0) {
        const error = new Error("Excel file contains no vendor data");
        error.status = 400;
        throw error;
    }
    const headers = excelRows[0].map(normalizeHeader);
    const columnIndex = {};
    headers.forEach((header, index) => {
        if (!header) return;
        columnIndex[header] = index;
        for (const [canonicalField, aliases] of Object.entries(VENDOR_HEADER_ALIASES)) {
            if (aliases.includes(header) && columnIndex[canonicalField] === undefined) {
                columnIndex[canonicalField] = index;
            }
        }
    });

    const vendors = dataRows.map(row => {
        const getCell = field => {
            if (columnIndex[field] !== undefined) {
                return cleanValue(row[columnIndex[field]]);
            }
            const aliases = VENDOR_HEADER_ALIASES[field] || [];
            for (const alias of aliases) {
                if (columnIndex[alias] !== undefined) {
                    return cleanValue(row[columnIndex[alias]]);
                }
            }
            return null;
        };
        const vendor = {};
        for (const field of VENDOR_FIELDS) {
            const value = getCell(field);
            vendor[field] = (typeof value === "number" || typeof value === "bigint") ? String(value) : value;
        }
        vendor.registration_date = formatDate(getCell("registration_date")) || new Date().toISOString().slice(0, 10);
        return vendor;
    });

    return vendors;
}

/* ==========================================================================
   PURCHASE ORDER PDF GENERATION
   ========================================================================== */

// Renders the purchase order onto the company letterhead layout and saves it in the purchase-orders folder
function generatePoPdf(po) {
    return new Promise((resolve, reject) => {
        try {
            fs.mkdirSync(poFolder, { recursive: true });
            const safeFileName = String(po.po_number || "PO").replace(/[\/\\:*?"<>|]/g, "_") + ".pdf";
            const outputPath = path.join(poFolder, safeFileName);
            const doc = new PDFDocument({ size: [612, 792], margin: 0 });
            const stream = fs.createWriteStream(outputPath);
            doc.pipe(stream);

            const fontDir = path.resolve(__dirname, "../fonts");
            doc.registerFont("Arial", path.join(fontDir, "ARIAL.TTF"));
            doc.registerFont("Arial-Bold", path.join(fontDir, "ARIALBD.TTF"));
            doc.registerFont("Calibri", path.join(fontDir, "CALIBRI.TTF"));
            doc.registerFont("Calibri-Bold", path.join(fontDir, "CALIBRIB.TTF"));

            function fmtDate(val) {
                if (!val) return "-";
                if (typeof val === "string" && /^\d{4}-\d{2}-\d{2}/.test(val)) {
                    const parts = val.slice(0, 10).split("-");
                    return `${parts[2]}.${parts[1]}.${parts[0]}`;
                }
                const d = new Date(val);
                if (isNaN(d.getTime())) return String(val);
                return d.toLocaleDateString("en-GB", { timeZone: "Asia/Kolkata" }).replace(/\//g, ".");
            }

            function fmtCur(val) {
                return Number(val || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            }

            function line(x1, y1, x2, y2) {
                doc.moveTo(x1, y1).lineTo(x2, y2).stroke();
            }

            function rect(x, y, w, h) {
                doc.rect(x, y, w, h).stroke();
            }

            doc.lineWidth(1);

            // 1. Company letterhead image
            if (fs.existsSync(headerImgPath)) {
                doc.image(headerImgPath, 50.4, 54, {
                    width: 504.8,
                    height: 79
                });
            }

            const ML = 85.6;
            const MR = 524;
            const MW = MR - ML;

            // 2. Title box
            const titleY = 192.2;
            const titleH = 21.9;
            rect(ML, titleY, MW, titleH);
            doc.font("Arial-Bold")
                .fontSize(15.24)
                .text("PURCHASE ORDER", ML, titleY + 3.5, {
                    width: MW,
                    align: "center",
                    lineBreak: false
                });

            // 3. Vendor block (left) and PO reference block (right)
            const vendorY = 214.1;
            const vendorH = 84;
            rect(ML, vendorY, MW, vendorH);

            const splitX = 316.3; // Matches lower table column 2 border cleanly
            const colDivider = 416; // Divider between Label and Value in PO table

            line(splitX, vendorY, splitX, vendorY + vendorH);
            line(colDivider, vendorY, colDivider, vendorY + vendorH);

            // Left: Vendor details
            doc.font("Arial-Bold").fontSize(9).text("TO,", ML + 4, vendorY + 4, { lineBreak: false });
            const vendorName = String(po.vendor_name || "").trim();
            const vendorAddress = String(po.vendor_address || "").trim();
            const vendorGst = String(po.vendor_gst || po.gst_number || "").trim();

            let vendorTextY = vendorY + 16;
            if (vendorName) {
                doc.font("Arial-Bold").fontSize(8.5).text(vendorName, ML + 4, vendorTextY, { width: splitX - ML - 8, lineBreak: false });
                vendorTextY += 12;
            }
            if (vendorAddress) {
                doc.font("Arial").fontSize(8).text(vendorAddress, ML + 4, vendorTextY, { width: splitX - ML - 8, lineGap: 1 });
                const addrH = doc.heightOfString(vendorAddress, { width: splitX - ML - 8, lineGap: 1 });
                vendorTextY += addrH + 4;
            }
            if (vendorGst) {
                doc.font("Arial-Bold").fontSize(8.5).text(`GST: ${vendorGst}`, ML + 4, vendorTextY, { width: splitX - ML - 8, lineBreak: false });
            }

            // Right: Order References Table (6 rows x 14pt height = 84pt)
            const companyGst = process.env.GST_NUMBER || "24AAHPS5083K1ZO";
            const rowH = 14;
            const refRows = [
                { label: "REF. P.O. NO.", val: po.po_number || "-", boldVal: true },
                { label: "P.O. DATE",      val: fmtDate(po.po_date || po.created_at) },
                { label: "REF. P.R. NO.", val: po.pr_number || "-" },
                { label: "P.R. DATE",      val: fmtDate(po.pr_date || po.created_at) },
                { label: "GST NO.",        val: companyGst },
                { label: "VENDOR CODE",    val: po.vendor_code || "-" }
            ];

            refRows.forEach((r, idx) => {
                const currentY = vendorY + idx * rowH;
                if (idx > 0) {
                    line(splitX, currentY, MR, currentY);
                }
                const textY = currentY + 3.2;
                // Label
                doc.font("Arial-Bold").fontSize(8.2).text(r.label, splitX + 4, textY, { width: colDivider - splitX - 6, lineBreak: false });
                // Value
                doc.font(r.boldVal ? "Arial-Bold" : "Arial").fontSize(8.2).text(r.val, colDivider + 4, textY, { width: MR - colDivider - 6, lineBreak: false });
            });

            // 4. Attention Box
            const attnY = 298.1;
            const attnH = 21.5;
            rect(ML, attnY, MW, attnH);
            doc.font("Arial-Bold").fontSize(9).text(`ATTN. : ${po.vendor_name || ""}`, ML, attnY + 5.5, {
                width: MW,
                align: "center",
                lineBreak: false
            });

            // 5. Item Table
            const tableHeaderY = 319.6;
            const headerH = 16;
            const x0 = 85.6;
            const x1 = 147.6;
            const x2 = 316.3;
            const x3 = 350.3;
            const x4 = 428.4;
            const x5 = 524;
            const totalY = 509.7;
            const totalH = 14;
            const tableBottom = totalY + totalH;

            rect(x0, tableHeaderY, x5 - x0, tableBottom - tableHeaderY);
            line(x1, tableHeaderY, x1, tableBottom);
            line(x2, tableHeaderY, x2, tableBottom);
            line(x3, tableHeaderY, x3, tableBottom);
            line(x4, tableHeaderY, x4, tableBottom);
            line(x0, tableHeaderY + headerH, x5, tableHeaderY + headerH);

            doc.font("Calibri-Bold").fontSize(7.56);
            doc.text("SR. NO.", x0, tableHeaderY + 4, { width: x1 - x0, align: "center", lineBreak: false });
            doc.text("Model Number", x1, tableHeaderY + 4, { width: x2 - x1, align: "center", lineBreak: false });
            doc.text("Qty", x2, tableHeaderY + 4, { width: x3 - x2, align: "center", lineBreak: false });
            doc.text("Unit Rate", x3, tableHeaderY + 4, { width: x4 - x3, align: "center", lineBreak: false });
            doc.text("Total", x4, tableHeaderY + 4, { width: x5 - x4, align: "center", lineBreak: false });

            // Item row
            const itemTop = tableHeaderY + headerH;
            const itemDesc = [po.item_name, po.make, po.model].filter(Boolean).join(" / ");
            doc.font("Calibri").fontSize(7.56);
            doc.text("1", x0, itemTop + 4, { width: x1 - x0, align: "center", lineBreak: false });
            doc.text(itemDesc, x1 + 4, itemTop + 4, { width: x2 - x1 - 8, align: "left", lineBreak: false });
            doc.text(Number(po.qty || 0).toFixed(2), x2, itemTop + 4, { width: x3 - x2, align: "center", lineBreak: false });
            doc.text(fmtCur(po.price_per_unit), x3, itemTop + 4, { width: x4 - x3, align: "center", lineBreak: false });
            doc.text(fmtCur(po.total_price), x4, itemTop + 4, { width: x5 - x4, align: "center", lineBreak: false });

            // Total row
            line(x0, totalY, x5, totalY);
            doc.font("Calibri-Bold").fontSize(7.56).text("TOTAL:", x0, totalY + 3.5, { width: x4 - x0, align: "center", lineBreak: false });
            doc.text(fmtCur(po.total_price), x4, totalY + 3.5, { width: x5 - x4, align: "center", lineBreak: false });

            // 6. Footer: Terms & conditions (left) and signature block (right)
            const footerY = tableBottom;
            const footerBottom = 618.9;
            rect(x0, footerY, x5 - x0, footerBottom - footerY);
            const footerSplit = x3;
            line(footerSplit, footerY, footerSplit, footerBottom);
            line(x0, footerY + 14, footerSplit, footerY + 14);
            line(x1, footerY + 14, x1, 607.5);
            line(x0, 607.5, x5, 607.5);

            doc.font("Calibri-Bold").fontSize(7.56).text("TERMS & CONDITIONS :", x0, footerY + 3.5, { width: footerSplit - x0, align: "center", lineBreak: false });
            doc.font("Calibri").fontSize(7.56);
            doc.text("1", x0, footerY + 19, { width: x1 - x0, align: "center", lineBreak: false });
            doc.text("2", x0, footerY + 31, { width: x1 - x0, align: "center", lineBreak: false });
            doc.text("DELIVERY : AT OUR OFFICE.", x1 + 4, footerY + 19, { width: footerSplit - x1 - 8, lineBreak: false });
            doc.text("TAX : EXTRA", x1 + 4, footerY + 31, { width: footerSplit - x1 - 8, lineBreak: false });
            if (po.payment_terms_remarks) {
                doc.text("3", x0, footerY + 43, { width: x1 - x0, align: "center", lineBreak: false });
                doc.text(po.payment_terms_remarks, x1 + 4, footerY + 43, { width: footerSplit - x1 - 8, lineBreak: false });
            }

            // Signature block
            const signX = footerSplit + 6;
            doc.font("Arial-Bold").fontSize(7).text("FOR,", signX, footerY + 2, { lineBreak: false });
            doc.text("NIMIT ELECTRONICS AND EQUIPMENTS,", signX, footerY + 13, { width: x5 - signX - 4, lineBreak: false });
            doc.text("AUTHORISED SIGNATORY", signX, 595, { width: x5 - signX - 4, lineBreak: false });

            doc.end();
            stream.on("finish", () => resolve(outputPath));
            stream.on("error", reject);
        } catch (err) {
            reject(err);
        }
    });
}

/* ==========================================================================
   INSIGHTS HELPERS (date ranges and gap filling for Management Insights)
   ========================================================================== */

const pad2 = (n) => String(n).padStart(2, "0");
const ymd = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// Checks that a YYYY-MM-DD string is a real calendar date
function isRealDate(str) {
    if (!DATE_RE.test(str)) return false;
    const [y, m, d] = str.split("-").map(Number);
    const dt = new Date(y, m - 1, d);
    return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d;
}

// Converts a period keyword (or custom from/to) into a start and end date
function resolveInsightsRange(period, from, to) {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();
    const d = now.getDate();
    switch (period) {
        case "current_month":
            return { start: ymd(new Date(y, m, 1)), end: ymd(new Date(y, m + 1, 0)) };
        case "last_30_days":
            return { start: ymd(new Date(y, m, d - 29)), end: ymd(now) };
        case "last_month":
            return { start: ymd(new Date(y, m - 1, 1)), end: ymd(new Date(y, m, 0)) };
        case "last_3_months":
            return { start: ymd(new Date(y, m - 2, 1)), end: ymd(new Date(y, m + 1, 0)) };
        case "last_6_months":
            return { start: ymd(new Date(y, m - 5, 1)), end: ymd(new Date(y, m + 1, 0)) };
        case "last_1_year":
            return { start: ymd(new Date(y - 1, m, 1)), end: ymd(new Date(y, m + 1, 0)) };
        case "last_2_years":
            return { start: ymd(new Date(y - 2, m, 1)), end: ymd(new Date(y, m + 1, 0)) };
        case "all_time":
            return { start: null, end: null };
        case "custom":
            if (!from || !to) return { error: "Custom period requires from and to dates" };
            if (!isRealDate(from) || !isRealDate(to)) return { error: "Invalid custom date range" };
            if (from > to) return { error: "From date cannot be greater than to date" };
            return { start: from, end: to };
        default:
            return { error: "Invalid period" };
    }
}

// Lists every YYYY-MM between the first and last month present in the given keys
function monthsBetween(keys) {
    if (!keys.length) return [];
    const sorted = [...keys].sort();
    let [y, m] = sorted[0].split("-").map(Number);
    const [ly, lm] = sorted[sorted.length - 1].split("-").map(Number);
    const out = [];
    while (y < ly || (y === ly && m <= lm)) {
        out.push(`${y}-${pad2(m)}`);
        m += 1;
        if (m > 12) { m = 1; y += 1; }
    }
    return out;
}

// Lists every calendar day from a to b (YYYY-MM-DD, inclusive)
function daysBetween(a, b) {
    const [y, m, d] = a.split("-").map(Number);
    const out = [];
    for (let i = 0; i < 3700; i++) {
        const key = ymd(new Date(y, m - 1, d + i));
        if (key > b) break;
        out.push(key);
    }
    return out;
}

const num = (v) => Number(v || 0);

/* ==========================================================================
   STATIC FILES AND PAGE
   ========================================================================== */

// Static asset mounts (Public)
app.use("/logo", express.static(path.resolve(__dirname, "../NIMIT LOGO.png")));
app.use("/logo-white", express.static(path.resolve(__dirname, "../NIMIT LOGO WHITE.png")));
app.use("/shared", express.static(path.resolve(__dirname, "../../frontend/shared")));
app.use("/auth", express.static(path.resolve(__dirname, "../../frontend/auth"), { index: false }));
app.use(express.static(path.resolve(__dirname, "../../frontend/auth"), { index: false }));
app.use(express.static(path.resolve(__dirname, "../../frontend/auth-service"), { index: false }));

// Protected storage & uploaded files (Procurement, Manager, Admin only)
app.use("/backend/purchase-orders", verifyProcurement, express.static(poFolder));
app.use("/backend/vendor", verifyProcurement, express.static(vendorFolder));
app.use("/storage", verifyProcurement, express.static(path.resolve(__dirname, "../storage")));

// In-memory HTML template cache to eliminate repeated synchronous disk I/O
const portalHtmlCache = new Map();
function getPortalHtml(filePath) {
    if (process.env.NODE_ENV === "production") {
        if (!portalHtmlCache.has(filePath)) {
            portalHtmlCache.set(filePath, fs.readFileSync(filePath, "utf8"));
        }
        return portalHtmlCache.get(filePath);
    }
    return fs.readFileSync(filePath, "utf8");
}

// Portal Dashboard Routes (Enforce auth, role verification, and inject credentials)
app.get(["/admin", "/admin/", "/admin/index.html"], verifyAdmin, (req, res) => {
    const htmlPath = path.resolve(__dirname, "../../frontend/admin/index.html");
    const template = getPortalHtml(htmlPath);
    const safeUser = JSON.stringify(req.user.username).replace(/</g, "\\u003c");
    const safeRole = JSON.stringify(req.user.role).replace(/</g, "\\u003c");
    const html = template.replace("<head>", `<head><script>window.currentUsername=${safeUser};window.currentUserRole=${safeRole};</script>`);
    return res.send(html);
});

// Automatically redirect any legacy procurement-manager navigation to procurement or admin
app.use("/procurement-manager", async (req, res) => {
    const user = await resolveAuthUser(req);
    if (!user) return res.redirect("/?reason=unauthenticated");
    if (user.role === "ADMIN") return res.redirect("/admin");
    return res.redirect("/procurement");
});

app.get(["/procurement", "/procurement/", "/procurement/index.html"], verifyProcurement, (req, res) => {
    const htmlPath = path.resolve(__dirname, "../../frontend/procurement/index.html");
    const template = getPortalHtml(htmlPath);
    const safeUser = JSON.stringify(req.user.username).replace(/</g, "\\u003c");
    const safeRole = JSON.stringify(req.user.role).replace(/</g, "\\u003c");
    const html = template.replace("<head>", `<head><script>window.currentUsername=${safeUser};window.currentUserRole=${safeRole};</script>`);
    return res.send(html);
});

// Protect portal asset folders (css, js, images) so unauthorized requests cannot access them directly
app.use("/admin", verifyAdmin, express.static(path.resolve(__dirname, "../../frontend/admin"), { index: false }));
app.use("/procurement", verifyProcurement, express.static(path.resolve(__dirname, "../../frontend/procurement"), { index: false }));

// Root and Authentication Gateway Routes
app.get("/", async (req, res) => {
    if (req.query.reason) {
        res.clearCookie("jwt_token");
        res.clearCookie("access_token");
        res.clearCookie("refresh_token");
        res.clearCookie("auth_token");
        res.clearCookie("login_session");
        if (req.session) {
            req.session.destroy(() => {});
        }
        return res.sendFile(path.resolve(__dirname, "../../frontend/auth-service/index.html"));
    }
    const user = await resolveAuthUser(req);
    if (!user) {
        return res.sendFile(path.resolve(__dirname, "../../frontend/auth-service/index.html"));
    }
    if (user.role === "ADMIN") return res.redirect("/admin");
    return res.redirect("/procurement");
});

app.get("/login", async (req, res) => {
    if (req.query.reason) {
        res.clearCookie("jwt_token");
        res.clearCookie("access_token");
        res.clearCookie("refresh_token");
        res.clearCookie("auth_token");
        res.clearCookie("login_session");
        if (req.session) {
            req.session.destroy(() => {});
        }
        return res.sendFile(path.resolve(__dirname, "../../frontend/auth-service/index.html"));
    }
    const user = await resolveAuthUser(req);
    if (user) {
        if (user.role === "ADMIN") return res.redirect("/admin");
        return res.redirect("/procurement");
    }
    return res.sendFile(path.resolve(__dirname, "../../frontend/auth-service/index.html"));
});

app.post("/login", loginRateLimiter, authController.login);
app.post(["/refresh", "/api/auth/refresh"], authController.refresh);
app.get("/verify", authController.verify);
app.get("/logout", authController.logout);
app.post("/logout", authController.logout);

/* ==========================================================================
   TAB: USER MANAGEMENT
   ========================================================================== */

// GET /users - Read-only; no report log required.
app.get("/users",verifyAdmin,async(req,res)=>{
    log("GET /users - Fetching users");
    try{
        const[rows]=await db.execute(
            `SELECT user_id,username,role,is_active,created_at,updated_at FROM users ORDER BY user_id`
        );
        log(`Returning ${rows.length} users`);
        res.json({success:true,users:rows});
    }catch(error){
        log(`ERROR fetching users: ${error.message}`);
        res.status(500).json({success:false,message:"Internal server error"});
    }
});

// POST /users - Creates a new user.
app.post("/users",verifyAdmin,async(req,res)=>{
    log("POST /users - Add User request");
    try{
        const{username,password,role}=req.body;
        if(!username||!password||!role)return res.status(400).json({success:false,message:"Username, password and role are required"});
        if(String(password).length < 8)return res.status(400).json({success:false,message:"Password must be at least 8 characters long"});
        if(!["ADMIN","PROCUREMENT"].includes(role))return res.status(400).json({success:false,message:"Invalid role"});
        const passwordHash=await bcrypt.hash(password,10);
        const[result]=await db.execute(
            `INSERT INTO users (username,password_hash,role,is_active) VALUES (?,?,?,TRUE)`,
            [username,passwordHash,role]
        );
        await writeReportLog(req,"USER_CREATED",
            `New user created. Username: "${username}", Role: ${role}, User ID: ${result.insertId}. Account activated: YES.`
        );
        await writeAuditLog(req,"USER_CREATED",
            null,
            JSON.stringify({user_id:result.insertId,username,role,is_active:true})
        );
        log(`User added: ${username}`);
        res.status(201).json({success:true,message:"User added successfully"});
    }catch(error){
        if(error.code==="ER_DUP_ENTRY")
            return res.status(409).json({success:false,message:"Username already exists"});
        log(`ERROR adding user: ${error.message}`);
        res.status(500).json({success:false,message:"Internal server error"});
    }
});

// PUT /users/:user_id/password - Changes a user's password.
app.put("/users/:user_id/password",verifyAdmin,async(req,res)=>{
    const userId=Number(req.params.user_id);
    log(`PUT /users/${userId}/password - Change Password request`);
    if(!Number.isInteger(userId)||userId<=0)return res.status(400).json({success:false,message:"Invalid user ID"});
    try{
        const{password}=req.body;
        if(!password)return res.status(400).json({success:false,message:"Password is required"});
        if(String(password).length < 8)return res.status(400).json({success:false,message:"Password must be at least 8 characters long"});
        const[userRows]=await db.execute(
            `SELECT username,role FROM users WHERE user_id=? LIMIT 1`,[userId]
        );
        if(!userRows.length)return res.status(404).json({success:false,message:"User not found"});
        const passwordHash=await bcrypt.hash(password,10);
        await db.execute(`UPDATE users SET password_hash=?, token_version = token_version + 1 WHERE user_id=?`,[passwordHash,userId]);
        invalidateUserCache(userId);
        await writeReportLog(req,"USER_PASSWORD_CHANGED",
            `Password changed for user ID ${userId}. Username: "${userRows[0].username}", Role: ${userRows[0].role}.`
        );
        await writeAuditLog(req,"USER_PASSWORD_CHANGED",
            JSON.stringify({user_id:userId,username:userRows[0].username,role:userRows[0].role,password_hash:"[REDACTED]"}),
            JSON.stringify({user_id:userId,username:userRows[0].username,role:userRows[0].role,password_hash:"[REDACTED]"})
        );
        log(`Password changed for user ID: ${userId}`);
        res.json({success:true,message:"Password changed successfully"});
    }catch(error){
        log(`ERROR changing password: ${error.message}`);
        res.status(500).json({success:false,message:"Internal server error"});
    }
});

// PUT /users/:user_id/access - Grants or revokes user access.
app.put("/users/:user_id/access",verifyAdmin,async(req,res)=>{
    const userId=Number(req.params.user_id);
    log(`PUT /users/${userId}/access - Access change request`);
    if(!Number.isInteger(userId)||userId<=0)return res.status(400).json({success:false,message:"Invalid user ID"});
    try{
        const{is_active}=req.body;
        if(typeof is_active!=="boolean")return res.status(400).json({success:false,message:"is_active must be true or false"});
        const[userRows]=await db.execute(
            `SELECT username,role,is_active FROM users WHERE user_id=? LIMIT 1`,[userId]
        );
        if(!userRows.length)return res.status(404).json({success:false,message:"User not found"});
        const user=userRows[0];
        await db.execute(`UPDATE users SET is_active=?, token_version = token_version + 1 WHERE user_id=?`,[is_active,userId]);
        invalidateUserCache(userId);
        const action=is_active?"USER_ACCESS_GRANTED":"USER_ACCESS_REVOKED";
        await writeReportLog(req,action,
            `User access changed. User ID: ${userId}, Username: "${user.username}", Role: ${user.role}, Previous active status: ${user.is_active}, New active status: ${is_active}.`
        );
        await writeAuditLog(req,action,
            JSON.stringify({user_id:userId,username:user.username,role:user.role,is_active:Boolean(user.is_active)}),
            JSON.stringify({user_id:userId,username:user.username,role:user.role,is_active})
        );
        log(`${is_active?"Access granted to":"Access revoked from"} user ID: ${userId}`);
        res.json({
            success:true,
            message:is_active?"Access granted successfully":"Access revoked successfully"
        });
    }catch(error){
        log(`ERROR changing access: ${error.message}`);
        res.status(500).json({success:false,message:"Internal server error"});
    }
});

// DELETE /users/:user_id - Deletes a user account.
app.delete(["/users/:user_id", "/api/users/:user_id"], verifyAdmin, async (req, res) => {
    const userId = Number(req.params.user_id);
    log(`DELETE /users/${userId} - Delete User request`);
    if (!Number.isInteger(userId) || userId <= 0) {
        return res.status(400).json({ success: false, message: "Invalid user ID" });
    }
    if (req.user && req.user.user_id === userId) {
        return res.status(400).json({ success: false, message: "You cannot delete your own admin account" });
    }
    try {
        const [userRows] = await db.execute(
            `SELECT username, role, is_active FROM users WHERE user_id = ? LIMIT 1`,
            [userId]
        );
        if (!userRows.length) {
            return res.status(404).json({ success: false, message: "User not found" });
        }
        const user = userRows[0];
        if (user.username.toLowerCase() === "admin") {
            return res.status(400).json({ success: false, message: "The primary admin account cannot be deleted" });
        }

        const actingAdminId = req.user?.user_id || 1;

        // Clean up or reassign references before deletion
        await db.execute(`DELETE FROM login_logs WHERE user_id = ?`, [userId]);
        await db.execute(`UPDATE purchase_requests SET created_by = NULL WHERE created_by = ?`, [userId]);
        await db.execute(`UPDATE goods_received SET received_by = ? WHERE received_by = ?`, [actingAdminId, userId]);
        await db.execute(`UPDATE goods_returns SET returned_by = ? WHERE returned_by = ?`, [actingAdminId, userId]);

        // Delete user record
        await db.execute(`DELETE FROM users WHERE user_id = ?`, [userId]);
        invalidateUserCache(userId);

        await writeReportLog(req, "USER_DELETED",
            `User deleted. Username: "${user.username}", Role: ${user.role}, User ID: ${userId}.`
        );
        await writeAuditLog(req, "USER_DELETED",
            JSON.stringify({ user_id: userId, username: user.username, role: user.role, is_active: Boolean(user.is_active) }),
            null
        );

        log(`User deleted successfully: ${user.username} (ID: ${userId})`);
        res.json({ success: true, message: `User "${user.username}" deleted successfully` });
    } catch (error) {
        log(`ERROR deleting user: ${error.message}`);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
});

/* ==========================================================================
   TAB: WORKSPACE DASHBOARD
   ========================================================================== */

// GET /workspace/dashboard - Workspace activity metrics and lists
// Admins see company-wide activity by default (or can filter by user), while non-admins strictly see only their own PRs and Goods Received
app.get(["/workspace/dashboard", "/api/workspace/dashboard"], verifyProcurement, async (req, res) => {
    try {
        const currentUser = req.user;
        const isAdmin = currentUser.role === "ADMIN";

        let targetUserId = null;
        if (isAdmin) {
            const requestedUserId = req.query.user_id;
            if (requestedUserId && requestedUserId !== "all" && requestedUserId !== "") {
                targetUserId = Number(requestedUserId);
            }
        } else {
            // Strictly enforce logged-in user's user_id for non-admins
            targetUserId = currentUser.user_id;
        }

        // Available users for Admin filtering
        let availableUsers = [];
        if (isAdmin) {
            const [userRows] = await db.query(
                `SELECT user_id, username, role FROM users WHERE is_active = 1 ORDER BY username ASC`
            );
            availableUsers = userRows;
        }

        // Build conditions for PRs and GRs
        const prConditions = [];
        const prParams = [];
        if (targetUserId) {
            prConditions.push("pr.created_by = ?");
            prParams.push(targetUserId);
        }
        const prWhere = prConditions.length ? `WHERE ${prConditions.join(" AND ")}` : "";

        const grConditions = [];
        const grParams = [];
        if (targetUserId) {
            grConditions.push("gr.received_by = ?");
            grParams.push(targetUserId);
        }
        const grWhere = grConditions.length ? `WHERE ${grConditions.join(" AND ")}` : "";

        // Query PR metrics
        const [prMetricsRows] = await db.execute(
            `SELECT 
                COUNT(*) AS total_prs,
                COALESCE(SUM(pr.taxable_value), 0) AS total_pr_value
             FROM purchase_requests pr
             ${prWhere}`,
            prParams
        );

        // Query PO pipeline metrics
        const poConditions = [];
        const poParams = [];
        if (targetUserId) {
            poConditions.push("pr.created_by = ?");
            poParams.push(targetUserId);
        }
        const poWhere = poConditions.length ? `WHERE ${poConditions.join(" AND ")}` : "";

        const [poMetricsRows] = await db.execute(
            `SELECT 
                COALESCE(SUM(po.status != 'CANCELLED'), 0) AS total_pos,
                COALESCE(SUM(po.status = 'DRAFT'), 0) AS draft_pos,
                COALESCE(SUM(po.status = 'ISSUED'), 0) AS issued_pos,
                COALESCE(SUM(po.status = 'COMPLETED'), 0) AS completed_pos,
                COALESCE(SUM(po.status = 'CANCELLED'), 0) AS cancelled_pos
             FROM purchase_orders po
             LEFT JOIN purchase_requests pr ON po.pr_id = pr.id
             ${poWhere}`,
            poParams
        );

        // Query GR metrics
        const [grMetricsRows] = await db.execute(
            `SELECT 
                COUNT(*) AS total_grn_receipts,
                COALESCE(SUM(gr.received_quantity), 0) AS total_received_quantity,
                COALESCE(SUM(gr.defective_quantity), 0) AS total_defective_quantity
             FROM goods_received gr
             ${grWhere}`,
            grParams
        );

        // Query PR List (Recent 100 with status)
        const [prRows] = await db.query(
            `SELECT 
                pr.id,
                pr.pr_number,
                pr.pr_date,
                pr.party_name,
                pr.location,
                pr.territory,
                pr.product_category,
                pr.sub_product_category,
                pr.item_name,
                pr.make,
                pr.model,
                pr.qty,
                pr.unit,
                pr.sales_rate,
                pr.taxable_value,
                pr.created_by,
                COALESCE(u.username, 'admin') AS creator_username,
                COALESCE(u.role, 'ADMIN') AS creator_role,
                CASE
                    WHEN po.status = 'COMPLETED' THEN 'CLOSED'
                    WHEN po.status = 'CANCELLED' THEN 'CANCELLED'
                    WHEN vi.status IS NOT NULL THEN vi.status
                    ELSE 'OPEN'
                END AS status
             FROM purchase_requests pr
             LEFT JOIN users u ON pr.created_by = u.user_id
             LEFT JOIN vendor_inquiries vi ON vi.pr_id = pr.id
             LEFT JOIN purchase_orders po ON po.pr_id = pr.id
             ${prWhere}
             ORDER BY pr.id DESC
             LIMIT 100`,
            prParams
        );

        // Query Goods Received List (Recent 100)
        const [grRows] = await db.query(
            `SELECT 
                gr.receipt_id,
                gr.po_id,
                COALESCE(po.po_number, '-') AS po_number,
                COALESCE(po.vendor_name, '-') AS vendor_name,
                COALESCE(po.item_name, '-') AS item_name,
                COALESCE(po.make, '-') AS make,
                COALESCE(po.model, '-') AS model,
                COALESCE(po.unit, 'units') AS unit,
                gr.received_quantity,
                gr.defective_quantity,
                gr.received_date,
                gr.received_by,
                gr.remarks,
                gr.created_at,
                COALESCE(u.username, 'admin') AS receiver_username,
                COALESCE(u.role, 'ADMIN') AS receiver_role
             FROM goods_received gr
             LEFT JOIN purchase_orders po ON gr.po_id = po.po_id
             LEFT JOIN users u ON gr.received_by = u.user_id
             ${grWhere}
             ORDER BY gr.receipt_id DESC
             LIMIT 100`,
            grParams
        );

        // For Admin: User Procurement Activity Breakdown
        let userSummary = [];
        if (isAdmin) {
            const [summaryRows] = await db.query(`
                SELECT 
                    u.user_id,
                    u.username,
                    u.role,
                    COALESCE(pr_agg.pr_count, 0) AS pr_count,
                    COALESCE(pr_agg.total_pr_val, 0) AS total_pr_value,
                    COALESCE(gr_agg.gr_count, 0) AS gr_count,
                    COALESCE(gr_agg.total_received_qty, 0) AS total_received_qty
                FROM users u
                LEFT JOIN (
                    SELECT created_by, COUNT(*) AS pr_count, SUM(taxable_value) AS total_pr_val
                    FROM purchase_requests
                    WHERE created_by IS NOT NULL
                    GROUP BY created_by
                ) pr_agg ON pr_agg.created_by = u.user_id
                LEFT JOIN (
                    SELECT received_by, COUNT(*) AS gr_count, SUM(received_quantity) AS total_received_qty
                    FROM goods_received
                    GROUP BY received_by
                ) gr_agg ON gr_agg.received_by = u.user_id
                WHERE u.is_active = 1
                ORDER BY pr_count DESC, gr_count DESC, u.username ASC
            `);
            userSummary = summaryRows;
        }

        const metrics = {
            total_prs: Number(prMetricsRows[0]?.total_prs || 0),
            total_pr_value: Number(prMetricsRows[0]?.total_pr_value || 0),
            total_pos: Number(poMetricsRows[0]?.total_pos || 0),
            draft_pos: Number(poMetricsRows[0]?.draft_pos || 0),
            issued_pos: Number(poMetricsRows[0]?.issued_pos || 0),
            completed_pos: Number(poMetricsRows[0]?.completed_pos || 0),
            cancelled_pos: Number(poMetricsRows[0]?.cancelled_pos || 0),
            total_grn_receipts: Number(grMetricsRows[0]?.total_grn_receipts || 0),
            total_received_quantity: Number(grMetricsRows[0]?.total_received_quantity || 0),
            total_defective_quantity: Number(grMetricsRows[0]?.total_defective_quantity || 0),
            active_users_count: isAdmin ? availableUsers.length : 1
        };

        return res.json({
            success: true,
            is_admin: isAdmin,
            current_user: {
                user_id: currentUser.user_id,
                username: currentUser.username,
                role: currentUser.role
            },
            filter_user_id: targetUserId,
            available_users: availableUsers,
            metrics,
            purchase_requests: prRows,
            goods_received: grRows,
            user_summary: userSummary
        });

    } catch (error) {
        log(`Workspace Dashboard fetch failed - ${error.message}`);
        console.error(error);
        return res.status(500).json({
            success: false,
            message: "Failed to load workspace dashboard data"
        });
    }
});

/* ==========================================================================
   ITEM MASTER: PRODUCT CATEGORIES & SUB PRODUCT CATEGORIES
   ========================================================================== */

// GET /product-categories
app.get("/product-categories", verifyProcurement, async (req, res) => {
    try {
        const { search, status, page, limit } = req.query;
        let query = "SELECT category_id, category_name, status, created_at, updated_at FROM product_categories WHERE 1=1";
        const params = [];

        if (search && String(search).trim()) {
            query += " AND category_name LIKE ?";
            params.push(`%${String(search).trim()}%`);
        }
        if (status && status !== "All") {
            query += " AND status = ?";
            params.push(status);
        }

        query += " ORDER BY category_id ASC";

        if (limit && limit !== "all" && Number(limit) > 0) {
            const pageNum = Math.max(1, parseInt(page, 10) || 1);
            const limitNum = Math.max(1, parseInt(limit, 10));
            const offset = (pageNum - 1) * limitNum;

            let countQuery = "SELECT COUNT(*) as total FROM product_categories WHERE 1=1";
            const countParams = [];
            if (search && String(search).trim()) {
                countQuery += " AND category_name LIKE ?";
                countParams.push(`%${String(search).trim()}%`);
            }
            if (status && status !== "All") {
                countQuery += " AND status = ?";
                countParams.push(status);
            }
            const [countRows] = await db.query(countQuery, countParams);
            const total = countRows[0]?.total || 0;

            query += " LIMIT ? OFFSET ?";
            params.push(limitNum, offset);

            const [rows] = await db.query(query, params);
            return res.json({
                success: true,
                data: rows,
                pagination: {
                    page: pageNum,
                    limit: limitNum,
                    total,
                    total_pages: Math.ceil(total / limitNum)
                }
            });
        }

        const [rows] = await db.query(query, params);
        return res.json({
            success: true,
            data: rows
        });
    } catch (err) {
        log(`GET /product-categories error: ${err.message}`);
        return res.status(500).json({ success: false, message: "Failed to fetch product categories" });
    }
});

// POST /product-categories
app.post("/product-categories", verifyProcurement, async (req, res) => {
    try {
        const { category_name, status = "Active" } = req.body;
        if (!category_name || !String(category_name).trim()) {
            return res.status(400).json({ success: false, message: "Category name is required" });
        }
        const trimmedName = String(category_name).trim();

        const [existing] = await db.query(
            "SELECT category_id FROM product_categories WHERE LOWER(TRIM(category_name)) = LOWER(TRIM(?)) LIMIT 1",
            [trimmedName]
        );
        if (existing.length > 0) {
            return res.status(400).json({ success: false, message: "Product category already exists" });
        }

        const [result] = await db.query(
            "INSERT INTO product_categories (category_name, status) VALUES (?, ?)",
            [trimmedName, status === "Inactive" ? "Inactive" : "Active"]
        );

        await writeReportLog(req, "CREATE_PRODUCT_CATEGORY", `Created category: ${trimmedName}`);
        return res.json({
            success: true,
            message: "Product category created successfully",
            data: { category_id: result.insertId, category_name: trimmedName, status }
        });
    } catch (err) {
        log(`POST /product-categories error: ${err.message}`);
        return res.status(500).json({ success: false, message: "Failed to create product category" });
    }
});

// PUT /product-categories/:id
app.put("/product-categories/:id", verifyProcurement, async (req, res) => {
    try {
        const categoryId = parseInt(req.params.id, 10);
        if (isNaN(categoryId)) {
            return res.status(400).json({ success: false, message: "Invalid category ID" });
        }
        const { category_name, status } = req.body;

        const [existing] = await db.query(
            "SELECT category_id, category_name FROM product_categories WHERE category_id = ?",
            [categoryId]
        );
        if (existing.length === 0) {
            return res.status(404).json({ success: false, message: "Product category not found" });
        }

        if (category_name && String(category_name).trim()) {
            const trimmedName = String(category_name).trim();
            const [duplicate] = await db.query(
                "SELECT category_id FROM product_categories WHERE LOWER(TRIM(category_name)) = LOWER(TRIM(?)) AND category_id != ?",
                [trimmedName, categoryId]
            );
            if (duplicate.length > 0) {
                return res.status(400).json({ success: false, message: "A category with this name already exists" });
            }
        }

        const updates = [];
        const params = [];
        if (category_name && String(category_name).trim()) {
            updates.push("category_name = ?");
            params.push(String(category_name).trim());
        }
        if (status && ["Active", "Inactive"].includes(status)) {
            updates.push("status = ?");
            params.push(status);
        }

        if (updates.length > 0) {
            params.push(categoryId);
            await db.query(`UPDATE product_categories SET ${updates.join(", ")} WHERE category_id = ?`, params);
        }

        await writeReportLog(req, "UPDATE_PRODUCT_CATEGORY", `Updated category ID: ${categoryId}`);
        return res.json({ success: true, message: "Product category updated successfully" });
    } catch (err) {
        log(`PUT /product-categories/:id error: ${err.message}`);
        return res.status(500).json({ success: false, message: "Failed to update product category" });
    }
});

// DELETE /product-categories/:id
app.delete("/product-categories/:id", verifyProcurement, async (req, res) => {
    try {
        const categoryId = parseInt(req.params.id, 10);
        if (isNaN(categoryId)) {
            return res.status(400).json({ success: false, message: "Invalid category ID" });
        }

        const [existing] = await db.query(
            "SELECT category_name FROM product_categories WHERE category_id = ?",
            [categoryId]
        );
        if (existing.length === 0) {
            return res.status(404).json({ success: false, message: "Product category not found" });
        }

        await db.query("DELETE FROM product_categories WHERE category_id = ?", [categoryId]);
        await writeReportLog(req, "DELETE_PRODUCT_CATEGORY", `Deleted category: ${existing[0].category_name}`);
        return res.json({ success: true, message: "Product category deleted successfully" });
    } catch (err) {
        log(`DELETE /product-categories/:id error: ${err.message}`);
        return res.status(500).json({ success: false, message: "Failed to delete product category" });
    }
});

// GET /sub-product-categories
app.get("/sub-product-categories", verifyProcurement, async (req, res) => {
    try {
        const { category_id, product_category_id, ProductCategoryId, category_name, parent_category, search, status, page, limit } = req.query;
        const targetCatId = category_id || product_category_id || ProductCategoryId;
        const targetCatName = category_name || parent_category;

        let query = `
            SELECT 
                spc.subcategory_id,
                spc.category_id,
                spc.category_id AS product_category_id,
                spc.category_id AS ProductCategoryId,
                spc.subcategory_name,
                pc.category_name AS parent_category,
                pc.category_name,
                spc.status,
                spc.created_at,
                spc.updated_at
            FROM sub_product_categories spc
            JOIN product_categories pc ON spc.category_id = pc.category_id
            WHERE 1=1
        `;
        const params = [];

        if (targetCatId && !isNaN(Number(targetCatId))) {
            query += " AND spc.category_id = ?";
            params.push(Number(targetCatId));
        } else if (targetCatName && String(targetCatName).trim()) {
            query += " AND LOWER(TRIM(pc.category_name)) = LOWER(TRIM(?))";
            params.push(String(targetCatName).trim());
        }

        if (search && String(search).trim()) {
            query += " AND (spc.subcategory_name LIKE ? OR pc.category_name LIKE ?)";
            params.push(`%${String(search).trim()}%`, `%${String(search).trim()}%`);
        }

        if (status && status !== "All") {
            query += " AND spc.status = ?";
            params.push(status);
        }

        query += " ORDER BY spc.subcategory_id ASC";

        if (limit && limit !== "all" && Number(limit) > 0) {
            const pageNum = Math.max(1, parseInt(page, 10) || 1);
            const limitNum = Math.max(1, parseInt(limit, 10));
            const offset = (pageNum - 1) * limitNum;

            let countQuery = `
                SELECT COUNT(*) as total
                FROM sub_product_categories spc
                JOIN product_categories pc ON spc.category_id = pc.category_id
                WHERE 1=1
            `;
            const countParams = [];
            if (targetCatId && !isNaN(Number(targetCatId))) {
                countQuery += " AND spc.category_id = ?";
                countParams.push(Number(targetCatId));
            } else if (targetCatName && String(targetCatName).trim()) {
                countQuery += " AND LOWER(TRIM(pc.category_name)) = LOWER(TRIM(?))";
                countParams.push(String(targetCatName).trim());
            }
            if (search && String(search).trim()) {
                countQuery += " AND (spc.subcategory_name LIKE ? OR pc.category_name LIKE ?)";
                countParams.push(`%${String(search).trim()}%`, `%${String(search).trim()}%`);
            }
            if (status && status !== "All") {
                countQuery += " AND spc.status = ?";
                countParams.push(status);
            }

            const [countRows] = await db.query(countQuery, countParams);
            const total = countRows[0]?.total || 0;

            query += " LIMIT ? OFFSET ?";
            params.push(limitNum, offset);

            const [rows] = await db.query(query, params);
            return res.json({
                success: true,
                data: rows,
                pagination: {
                    page: pageNum,
                    limit: limitNum,
                    total,
                    total_pages: Math.ceil(total / limitNum)
                }
            });
        }

        const [rows] = await db.query(query, params);
        return res.json({
            success: true,
            data: rows
        });
    } catch (err) {
        log(`GET /sub-product-categories error: ${err.message}`);
        return res.status(500).json({ success: false, message: "Failed to fetch sub product categories" });
    }
});

// GET /product-categories/:category_id/subcategories
app.get("/product-categories/:category_id/subcategories", verifyProcurement, async (req, res) => {
    try {
        const categoryId = parseInt(req.params.category_id, 10);
        if (isNaN(categoryId)) {
            return res.status(400).json({ success: false, message: "Invalid category ID" });
        }
        const [rows] = await db.query(
            `SELECT 
                spc.subcategory_id,
                spc.category_id,
                spc.category_id AS product_category_id,
                spc.category_id AS ProductCategoryId,
                spc.subcategory_name,
                pc.category_name AS parent_category,
                spc.status,
                spc.created_at
            FROM sub_product_categories spc
            JOIN product_categories pc ON spc.category_id = pc.category_id
            WHERE spc.category_id = ? AND spc.status = 'Active'
            ORDER BY spc.subcategory_name ASC`,
            [categoryId]
        );
        return res.json({ success: true, data: rows });
    } catch (err) {
        log(`GET /product-categories/:category_id/subcategories error: ${err.message}`);
        return res.status(500).json({ success: false, message: "Failed to fetch subcategories" });
    }
});

// POST /sub-product-categories
app.post("/sub-product-categories", verifyProcurement, async (req, res) => {
    try {
        let { category_id, product_category_id, ProductCategoryId, category_name, parent_category, subcategory_name, status = "Active" } = req.body;
        let catId = category_id || product_category_id || ProductCategoryId;

        if (!catId && (category_name || parent_category)) {
            const targetName = String(category_name || parent_category).trim();
            const [catRows] = await db.query(
                "SELECT category_id FROM product_categories WHERE LOWER(TRIM(category_name)) = LOWER(TRIM(?)) LIMIT 1",
                [targetName]
            );
            if (catRows.length > 0) catId = catRows[0].category_id;
        }

        if (!catId || isNaN(Number(catId))) {
            return res.status(400).json({ success: false, message: "Parent product category is required" });
        }
        if (!subcategory_name || !String(subcategory_name).trim()) {
            return res.status(400).json({ success: false, message: "Subcategory name is required" });
        }

        const trimmedSubName = String(subcategory_name).trim();

        // Verify parent category exists
        const [parentExists] = await db.query(
            "SELECT category_id, category_name FROM product_categories WHERE category_id = ?",
            [Number(catId)]
        );
        if (parentExists.length === 0) {
            return res.status(404).json({ success: false, message: "Parent product category not found" });
        }

        // Check duplicate within this category
        const [existing] = await db.query(
            "SELECT subcategory_id FROM sub_product_categories WHERE category_id = ? AND LOWER(TRIM(subcategory_name)) = LOWER(TRIM(?)) LIMIT 1",
            [Number(catId), trimmedSubName]
        );
        if (existing.length > 0) {
            return res.status(400).json({ success: false, message: "Subcategory already exists under this product category" });
        }

        const [result] = await db.query(
            "INSERT INTO sub_product_categories (category_id, subcategory_name, status) VALUES (?, ?, ?)",
            [Number(catId), trimmedSubName, status === "Inactive" ? "Inactive" : "Active"]
        );

        await writeReportLog(req, "CREATE_SUB_PRODUCT_CATEGORY", `Created subcategory: ${trimmedSubName} under ${parentExists[0].category_name}`);
        return res.json({
            success: true,
            message: "Sub product category created successfully",
            data: {
                subcategory_id: result.insertId,
                category_id: Number(catId),
                product_category_id: Number(catId),
                ProductCategoryId: Number(catId),
                subcategory_name: trimmedSubName,
                parent_category: parentExists[0].category_name,
                status
            }
        });
    } catch (err) {
        log(`POST /sub-product-categories error: ${err.message}`);
        return res.status(500).json({ success: false, message: "Failed to create sub product category" });
    }
});

// PUT /sub-product-categories/:id
app.put("/sub-product-categories/:id", verifyProcurement, async (req, res) => {
    try {
        const subcategoryId = parseInt(req.params.id, 10);
        if (isNaN(subcategoryId)) {
            return res.status(400).json({ success: false, message: "Invalid subcategory ID" });
        }
        let { category_id, product_category_id, ProductCategoryId, category_name, parent_category, subcategory_name, status } = req.body;
        let catId = category_id || product_category_id || ProductCategoryId;

        const [existing] = await db.query(
            "SELECT subcategory_id, category_id, subcategory_name FROM sub_product_categories WHERE subcategory_id = ?",
            [subcategoryId]
        );
        if (existing.length === 0) {
            return res.status(404).json({ success: false, message: "Sub product category not found" });
        }

        const currentRecord = existing[0];
        let targetCatId = currentRecord.category_id;

        if (catId && !isNaN(Number(catId))) {
            targetCatId = Number(catId);
        } else if (category_name || parent_category) {
            const targetName = String(category_name || parent_category).trim();
            const [catRows] = await db.query(
                "SELECT category_id FROM product_categories WHERE LOWER(TRIM(category_name)) = LOWER(TRIM(?)) LIMIT 1",
                [targetName]
            );
            if (catRows.length > 0) targetCatId = catRows[0].category_id;
        }

        const targetSubName = (subcategory_name && String(subcategory_name).trim()) ? String(subcategory_name).trim() : currentRecord.subcategory_name;

        // Check duplicate
        const [duplicate] = await db.query(
            "SELECT subcategory_id FROM sub_product_categories WHERE category_id = ? AND LOWER(TRIM(subcategory_name)) = LOWER(TRIM(?)) AND subcategory_id != ?",
            [targetCatId, targetSubName, subcategoryId]
        );
        if (duplicate.length > 0) {
            return res.status(400).json({ success: false, message: "A subcategory with this name already exists under the selected category" });
        }

        const updates = ["category_id = ?", "subcategory_name = ?"];
        const params = [targetCatId, targetSubName];
        if (status && ["Active", "Inactive"].includes(status)) {
            updates.push("status = ?");
            params.push(status);
        }
        params.push(subcategoryId);

        await db.query(`UPDATE sub_product_categories SET ${updates.join(", ")} WHERE subcategory_id = ?`, params);
        await writeReportLog(req, "UPDATE_SUB_PRODUCT_CATEGORY", `Updated subcategory ID: ${subcategoryId}`);

        return res.json({ success: true, message: "Sub product category updated successfully" });
    } catch (err) {
        log(`PUT /sub-product-categories/:id error: ${err.message}`);
        return res.status(500).json({ success: false, message: "Failed to update sub product category" });
    }
});

// DELETE /sub-product-categories/:id
app.delete("/sub-product-categories/:id", verifyProcurement, async (req, res) => {
    try {
        const subcategoryId = parseInt(req.params.id, 10);
        if (isNaN(subcategoryId)) {
            return res.status(400).json({ success: false, message: "Invalid subcategory ID" });
        }

        const [existing] = await db.query(
            "SELECT subcategory_name FROM sub_product_categories WHERE subcategory_id = ?",
            [subcategoryId]
        );
        if (existing.length === 0) {
            return res.status(404).json({ success: false, message: "Sub product category not found" });
        }

        await db.query("DELETE FROM sub_product_categories WHERE subcategory_id = ?", [subcategoryId]);
        await writeReportLog(req, "DELETE_SUB_PRODUCT_CATEGORY", `Deleted subcategory: ${existing[0].subcategory_name}`);
        return res.json({ success: true, message: "Sub product category deleted successfully" });
    } catch (err) {
        log(`DELETE /sub-product-categories/:id error: ${err.message}`);
        return res.status(500).json({ success: false, message: "Failed to delete sub product category" });
    }
});

/* ==========================================================================
   TAB: PURCHASE REQUESTS
   ========================================================================== */

// POST /purchase-requests - Creates a single purchase request with the next PR number and opens a vendor inquiry for it
app.post("/purchase-requests", verifyProcurement, async (req, res) => {
    const {
        pr_date,
        party_name,
        location,
        territory,
        product_category,
        sub_product_category,
        item_name,
        product_remarks,
        make,
        model,
        qty,
        unit,
        sales_rate
    } = req.body;
    const requiredFields = {
        party_name,
        location,
        territory,
        product_category,
        item_name,
        make,
        model,
        qty,
        unit,
        sales_rate
    };
    for (const [field, value] of Object.entries(requiredFields)) {
        if (value === undefined || value === null || String(value).trim() === "") {
            return res.status(400).json({
                success: false,
                message: `${field.replace(/_/g, " ")} is required`
            });
        }
    }
    if (Number(qty) <= 0) {
        return res.status(400).json({
            success: false,
            message: "Quantity must be greater than 0"
        });
    }
    if (Number(sales_rate) <= 0) {
        return res.status(400).json({
            success: false,
            message: "Sales rate must be greater than 0"
        });
    }

    if (sub_product_category && String(sub_product_category).trim() !== "") {
        const [matchingSub] = await db.query(
            `SELECT spc.subcategory_id 
             FROM sub_product_categories spc
             JOIN product_categories pc ON spc.category_id = pc.category_id
             WHERE LOWER(TRIM(pc.category_name)) = LOWER(TRIM(?))
               AND LOWER(TRIM(spc.subcategory_name)) = LOWER(TRIM(?))
             LIMIT 1`,
            [product_category, sub_product_category]
        );
        if (matchingSub.length === 0) {
            const [hasSubs] = await db.query(
                `SELECT spc.subcategory_id
                 FROM sub_product_categories spc
                 JOIN product_categories pc ON spc.category_id = pc.category_id
                 WHERE LOWER(TRIM(pc.category_name)) = LOWER(TRIM(?))
                 LIMIT 1`,
                [product_category]
            );
            if (hasSubs.length > 0) {
                return res.status(400).json({
                    success: false,
                    message: `Sub Product Category "${sub_product_category}" does not belong to selected category "${product_category}"`
                });
            }
        }
    }

    const pr_date_final = pr_date && String(pr_date).trim() !== "" ? pr_date : new Date().toISOString().split("T")[0];
    const taxable_value = Number(qty) * Number(sales_rate);
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();
        const pr_number = await generatePrNumber(connection);
        const createdBy = req.user?.user_id || req.session?.user?.user_id || 1;
        const [result] = await connection.execute(
            `INSERT INTO purchase_requests
            (
                pr_number,
                pr_date,
                party_name,
                location,
                territory,
                product_category,
                sub_product_category,
                item_name,
                product_remarks,
                make,
                model,
                qty,
                unit,
                sales_rate,
                taxable_value,
                created_by
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                pr_number,
                pr_date_final,
                party_name,
                location,
                territory,
                product_category,
                (sub_product_category && String(sub_product_category).trim()) || null,
                item_name,
                product_remarks || null,
                make,
                model,
                qty,
                unit,
                sales_rate,
                taxable_value,
                createdBy
            ]
        );
        const [inquiryResult] = await connection.execute(
            `INSERT INTO vendor_inquiries
            (
                pr_id,
                status,
                remarks
            )
            VALUES (?, 'OPEN', ?)`,
            [
                result.insertId,
                product_remarks || null
            ]
        );
        await connection.commit();
        await writeReportLog(req, "PR_CREATED",
            `Purchase request raised. ${describePr({
                pr_number, pr_date: pr_date_final, party_name, location, territory, product_category,
                item_name, make, model, qty, unit, sales_rate, taxable_value, product_remarks
            })}`
        );
        await writeReportLog(req, "VENDOR_INQUIRY_CREATED",
            `Vendor inquiry (inquiry ID ${inquiryResult.insertId}) opened for ${pr_number}. ` +
            `Item: ${item_name}, make: ${make}, model: ${model}, quantity: ${Number(qty)} ${unit}. Status: OPEN, awaiting vendor quotations.`
        );
        return res.json({
            success: true,
            message: "Purchase request created successfully",
            pr_number,
            pr_id: result.insertId
        });
    } catch (error) {
        await connection.rollback();
        console.error(error);
        log(`Purchase request creation failed - ${error.message}`);
        return res.status(500).json({
            success: false,
            message: "Failed to create purchase request"
        });
    } finally {
        connection.release();
    }
});

// POST /purchase-requests/import-preview - Reads an uploaded Excel sheet and returns editable PR rows without saving anything
app.post("/purchase-requests/import-preview", verifyProcurement, excelUpload.single("file"), async (req, res) => {
    log("POST /purchase-requests/import-preview - Excel preview requested");
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: "Excel file is required"
            });
        }
        const excelRows = await readSheet(req.file.buffer);
        if (!excelRows || excelRows.length <= 1) {
            return res.status(400).json({
                success: false,
                message: "Excel file contains no data"
            });
        }
        const headers = excelRows[0].map(normalizeHeader);
        const columnIndex = {};
        headers.forEach((header, index) => {
            if (header) columnIndex[header] = index;
        });
        const PR_HEADER_ALIASES = {
            pr_date: ["pr_date", "pr_date_yyyy_mm_dd", "date", "request_date", "prdate"],
            party_name: ["party_name", "party", "client_name", "client", "customer_name", "customer"],
            location: ["location", "site_location", "plant_location", "site", "city"],
            territory: ["territory", "region", "zone"],
            product_category: ["product_category", "category", "prod_cat"],
            sub_product_category: ["sub_product_category", "sub_category", "subcategory", "sub_product_cat"],
            item_name: ["item_name", "item", "item_description", "description", "product_name"],
            product_remarks: ["product_remarks", "remarks", "remark", "notes", "specification", "item_remarks"],
            make: ["make", "brand", "manufacturer", "oem"],
            model: ["model", "model_no", "model_number", "part_number", "part_no"],
            qty: ["qty", "quantity", "quantities", "quantity_req", "qty_nos"],
            unit: ["unit", "uom", "unit_of_measure"],
            sales_rate: ["sales_rate", "rate", "price", "unit_price", "sales_rate_inr", "sales_rate_rs", "rate_rs"]
        };
        const getCell = (row, field) => {
            const aliases = PR_HEADER_ALIASES[field] || [field];
            for (const key of aliases) {
                if (columnIndex[key] !== undefined) {
                    return cleanValue(row[columnIndex[key]]);
                }
            }
            return null;
        };
        const rows = excelRows.slice(1).filter(row => row.some(cell => cell !== null && cell !== undefined && String(cell).trim() !== "")).map(row => {
            const quantity = cleanNumber(getCell(row, "qty"));
            const rate = cleanNumber(getCell(row, "sales_rate"));
            return {
                pr_date: formatDate(getCell(row, "pr_date")),
                party_name: getCell(row, "party_name"),
                location: getCell(row, "location"),
                territory: getCell(row, "territory"),
                product_category: getCell(row, "product_category"),
                sub_product_category: getCell(row, "sub_product_category") || getCell(row, "sub_category") || null,
                item_name: getCell(row, "item_name"),
                product_remarks: getCell(row, "product_remarks"),
                make: getCell(row, "make"),
                model: getCell(row, "model"),
                qty: quantity,
                unit: getCell(row, "unit"),
                sales_rate: rate,
                taxable_value: quantity * rate
            };
        });
        if (rows.length === 0) {
            return res.status(400).json({
                success: false,
                message: "Excel file contains no data"
            });
        }
        log(`Excel preview successful - ${rows.length} rows ready for editing`);
        return res.json({
            success: true,
            rows
        });
    } catch (error) {
        log(`ERROR creating Excel preview: ${error.message}`);
        return res.status(500).json({
            success: false,
            message: "Failed to process Excel file"
        });
    }
});

// POST /purchase-requests/import - Saves the reviewed Excel rows as purchase requests (one PR number and one vendor inquiry per row) in a single transaction
app.post("/purchase-requests/import", verifyProcurement, async (req, res) => {
    const connection = await db.getConnection();
    try {
        const rows = req.body.rows || [];
        if (!Array.isArray(rows) || rows.length === 0) {
            return res.status(400).json({
                success: false,
                message: "No rows available for import"
            });
        }
        if (rows.length > 1000) {
            return res.status(400).json({
                success: false,
                message: "Maximum batch limit exceeded: Cannot import more than 1,000 rows at once"
            });
        }
        await connection.beginTransaction();
        const insertedRows = [];
        const reportItems = [];
        const prNumbers = await generatePrNumbers(connection, rows.length);
        const createdBy = req.user?.user_id || req.session?.user?.user_id || 1;
        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            const pr_number = prNumbers[i];
            const qty = Number(row.qty || 0);
            const sales_rate = Number(row.sales_rate || 0);
            const taxable_value = qty * sales_rate;
            const [result] = await connection.execute(
                `INSERT INTO purchase_requests
                (pr_number, pr_date, party_name, location, territory,
                 product_category, sub_product_category, item_name, product_remarks, make, model,
                 qty, unit, sales_rate, taxable_value, created_by)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    pr_number,
                    row.pr_date || null,
                    row.party_name || null,
                    row.location || null,
                    row.territory || null,
                    row.product_category || null,
                    row.sub_product_category || null,
                    row.item_name || null,
                    row.product_remarks || null,
                    row.make || null,
                    row.model || null,
                    qty,
                    row.unit || null,
                    sales_rate,
                    taxable_value,
                    createdBy
                ]
            );
            const prId = result.insertId;
            const [inquiryResult] = await connection.execute(
                `INSERT INTO vendor_inquiries (pr_id, status, remarks)
                 VALUES (?, 'OPEN', ?)`,
                [prId, row.product_remarks || null]
            );
            insertedRows.push({ id: prId, pr_number });
            reportItems.push({
                inquiry_id: inquiryResult.insertId,
                pr: {
                    pr_number,
                    pr_date: row.pr_date,
                    party_name: row.party_name,
                    location: row.location,
                    territory: row.territory,
                    product_category: row.product_category,
                    item_name: row.item_name,
                    make: row.make,
                    model: row.model,
                    qty,
                    unit: row.unit,
                    sales_rate,
                    taxable_value,
                    product_remarks: row.product_remarks
                }
            });
        }
        await connection.commit();
        log(`Purchase Requests imported successfully - ${insertedRows.length} rows`);
        const logEntries = [];
        for (const item of reportItems) {
            logEntries.push({
                action: "PR_CREATED",
                report: `Purchase request raised through Excel import. ${describePr(item.pr)}`
            });
            logEntries.push({
                action: "VENDOR_INQUIRY_CREATED",
                report: `Vendor inquiry (inquiry ID ${item.inquiry_id}) opened for ${item.pr.pr_number} through Excel import. ` +
                    `Item: ${orDash(item.pr.item_name)}, make: ${orDash(item.pr.make)}, model: ${orDash(item.pr.model)}, ` +
                    `quantity: ${item.pr.qty} ${orDash(item.pr.unit)}. Status: OPEN, awaiting vendor quotations.`
            });
        }
        await writeReportLogs(req, logEntries);
        return res.json({
            success: true,
            message: "Purchase Requests imported successfully",
            rows: insertedRows
        });
    } catch (error) {
        await connection.rollback();
        console.error(error);
        log(`Purchase Request Excel import failed - ${error.message}`);
        return res.status(500).json({
            success: false,
            message: error.message
        });
    } finally {
        connection.release();
    }
});

// GET /purchase-requests/template - Downloads an Excel (.xlsx) template with standard headers and sample data for bulk purchase request import
app.get(["/purchase-requests/template", "/api/purchase-requests/template", "/purchase-requests/import-template"], verifyProcurement, async (req, res) => {
    try {
        const workbook = new ExcelJS.Workbook();
        workbook.creator = "ProcureIQ Enterprise";
        workbook.lastModifiedBy = "ProcureIQ Enterprise";
        workbook.created = new Date();
        workbook.modified = new Date();

        // Sheet 1: PR Import Template
        const sheet = workbook.addWorksheet("PR Import Template", {
            views: [{ state: "frozen", ySplit: 1, showGridLines: true }],
            properties: { defaultRowHeight: 22 }
        });

        const columns = [
            { header: "PR Date (YYYY-MM-DD)", key: "pr_date", width: 22 },
            { header: "Party Name *", key: "party_name", width: 28 },
            { header: "Location *", key: "location", width: 20 },
            { header: "Territory *", key: "territory", width: 20 },
            { header: "Product Category *", key: "product_category", width: 24 },
            { header: "Sub Product Category", key: "sub_product_category", width: 26 },
            { header: "Item Name *", key: "item_name", width: 30 },
            { header: "Make *", key: "make", width: 20 },
            { header: "Model *", key: "model", width: 20 },
            { header: "Quantity *", key: "qty", width: 14 },
            { header: "Unit *", key: "unit", width: 14 },
            { header: "Sales Rate *", key: "sales_rate", width: 18 },
            { header: "Product Remarks", key: "product_remarks", width: 32 }
        ];

        sheet.columns = columns.map(c => ({ header: c.header, key: c.key, width: c.width }));

        // Style Header Row (Row 1)
        const headerRow = sheet.getRow(1);
        headerRow.height = 32;
        headerRow.eachCell((cell) => {
            cell.font = { name: "Segoe UI", size: 10.5, bold: true, color: { argb: "FFFFFFFF" } };
            cell.fill = {
                type: "pattern",
                pattern: "solid",
                fgColor: { argb: "FF0B57A4" }
            };
            cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
            cell.border = {
                top: { style: "thin", color: { argb: "FF94A3B8" } },
                left: { style: "thin", color: { argb: "FF94A3B8" } },
                bottom: { style: "medium", color: { argb: "FF0F172A" } },
                right: { style: "thin", color: { argb: "FF94A3B8" } }
            };
        });

        const today = new Date().toISOString().slice(0, 10);

        // Sample Row 1
        const sample1 = sheet.addRow({
            pr_date: today,
            party_name: "Reliance Industries Limited",
            location: "Jamnagar",
            territory: "Pan India",
            product_category: "Surveillance System",
            sub_product_category: "PTZ CAMERA",
            item_name: "Speed Dome PTZ Camera",
            make: "Honeywell",
            model: "I-HMP123",
            qty: 10,
            unit: "number",
            sales_rate: 155275,
            product_remarks: "High-priority requirement for plant perimeter security"
        });

        // Sample Row 2
        const sample2 = sheet.addRow({
            pr_date: today,
            party_name: "JSW Steel Limited",
            location: "Bellary",
            territory: "West",
            product_category: "Networking",
            sub_product_category: "SWITCH",
            item_name: "24 Port Managed Gigabit PoE Switch",
            make: "Cisco",
            model: "CBS350-24T-4G",
            qty: 5,
            unit: "number",
            sales_rate: 42500,
            product_remarks: "Standard 3-year OEM enterprise warranty required"
        });

        [sample1, sample2].forEach((row) => {
            row.height = 24;
            row.eachCell((cell, colNumber) => {
                cell.font = { name: "Segoe UI", size: 9.5, italic: true, color: { argb: "FF334155" } };
                cell.fill = {
                    type: "pattern",
                    pattern: "solid",
                    fgColor: { argb: "FFF8FAFC" }
                };
                cell.border = {
                    top: { style: "thin", color: { argb: "FFE2E8F0" } },
                    left: { style: "thin", color: { argb: "FFE2E8F0" } },
                    bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
                    right: { style: "thin", color: { argb: "FFE2E8F0" } }
                };
                if (colNumber === 1 || colNumber === 11) {
                    cell.alignment = { vertical: "middle", horizontal: "center" };
                } else if (colNumber === 10 || colNumber === 12) {
                    cell.alignment = { vertical: "middle", horizontal: "right" };
                } else {
                    cell.alignment = { vertical: "middle", horizontal: "left" };
                }
            });
        });

        // Sheet 2: Guidelines & Reference
        const guideSheet = workbook.addWorksheet("Instructions & Guide", {
            views: [{ showGridLines: true }],
            properties: { defaultRowHeight: 22 }
        });

        guideSheet.mergeCells("A1:D1");
        const guideTitle = guideSheet.getCell("A1");
        guideTitle.value = "PURCHASE REQUEST BULK IMPORT GUIDELINES";
        guideTitle.font = { name: "Segoe UI", size: 13, bold: true, color: { argb: "FFFFFFFF" } };
        guideTitle.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0B57A4" } };
        guideTitle.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
        guideSheet.getRow(1).height = 30;

        const guideHeaders = ["Field Name", "Requirement", "Allowed Values / Format", "Description / Example"];
        const guideHeaderRow = guideSheet.getRow(2);
        guideHeaderRow.height = 26;
        guideHeaders.forEach((gh, idx) => {
            const cell = guideHeaderRow.getCell(idx + 1);
            cell.value = gh;
            cell.font = { name: "Segoe UI", size: 10, bold: true, color: { argb: "FF0F172A" } };
            cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE2E8F0" } };
            cell.alignment = { vertical: "middle", horizontal: "left" };
        });

        const guideRows = [
            ["PR Date", "Optional", "YYYY-MM-DD or DD-MM-YYYY", "Defaults to today's date if left blank"],
            ["Party Name", "Mandatory (*)", "Text", "Client or party name, e.g. 'Reliance Industries'"],
            ["Location", "Mandatory (*)", "Text", "Plant, delivery site, or city name, e.g. 'Jamnagar'"],
            ["Territory", "Mandatory (*)", "North, South (Dahej), South (Bharuch), West, Central Projects, Central Services, Central Contracts, Ahmedabad, Pan India, Kutch, Surat", "Must match one of the standard territory names"],
            ["Product Category", "Mandatory (*)", "Text", "Main category from Item Master (e.g. Surveillance System, Networking)"],
            ["Sub Product Category", "Optional", "Text", "Subcategory for specific cataloging (e.g. PTZ CAMERA, SWITCH)"],
            ["Item Name", "Mandatory (*)", "Text", "Full description of item required"],
            ["Make", "Mandatory (*)", "Text", "Manufacturer or brand, e.g. 'Honeywell', 'Cisco', 'Schneider'"],
            ["Model", "Mandatory (*)", "Text", "Model number, part number, or code"],
            ["Quantity", "Mandatory (*)", "Positive Number (e.g. 10, 25.5)", "Must be greater than 0"],
            ["Unit", "Mandatory (*)", "Number, Set, Meter, Lot", "Standard measuring unit"],
            ["Sales Rate", "Mandatory (*)", "Positive Number (₹)", "Rate per unit in INR (without currency symbol)"],
            ["Product Remarks", "Optional", "Text", "Technical specs, delivery deadlines, or instructions"]
        ];

        guideRows.forEach((r) => {
            const row = guideSheet.addRow(r);
            row.height = 22;
            row.eachCell((cell) => {
                cell.font = { name: "Segoe UI", size: 9.5, color: { argb: "FF334155" } };
                cell.alignment = { vertical: "middle", horizontal: "left" };
                cell.border = {
                    top: { style: "thin", color: { argb: "FFE2E8F0" } },
                    left: { style: "thin", color: { argb: "FFE2E8F0" } },
                    bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
                    right: { style: "thin", color: { argb: "FFE2E8F0" } }
                };
            });
        });

        guideSheet.getColumn(1).width = 24;
        guideSheet.getColumn(2).width = 16;
        guideSheet.getColumn(3).width = 40;
        guideSheet.getColumn(4).width = 50;

        res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        res.setHeader("Content-Disposition", 'attachment; filename="Purchase_Request_Import_Template.xlsx"');
        await workbook.xlsx.write(res);
        return res.end();
    } catch (error) {
        log(`ERROR generating purchase request template: ${error.message}`);
        return res.status(500).json({
            success: false,
            message: "Failed to generate Purchase Request import template"
        });
    }
});

// GET /purchase-requests/export - Export purchase requests matching applied filters as real Excel (.xlsx)
app.get(["/purchase-requests/export", "/api/purchase-requests/export"], verifyProcurement, async (req, res) => {
    const statusParam = (req.query.status || "").trim().toUpperCase();
    const searchParam = (req.query.search || "").trim();
    const partyParam = (req.query.party || req.query.vendor || "").trim();
    const territoryParam = (req.query.territory || "").trim();
    const singleDate = (req.query.date || "").trim();
    const fromDate = (req.query.from_date || req.query.from || singleDate).trim();
    const toDate = (req.query.to_date || req.query.to || singleDate).trim();

    try {
        const whereClauses = [];
        const params = [];

        if (statusParam && statusParam !== "ALL") {
            whereClauses.push(`
                (CASE
                    WHEN po.status = 'COMPLETED' THEN 'CLOSED'
                    WHEN po.status = 'CANCELLED' THEN 'CANCELLED'
                    WHEN vi.status IS NOT NULL THEN vi.status
                    ELSE 'OPEN'
                END) = ?
            `);
            params.push(statusParam);
        }

        if (partyParam && partyParam !== "ALL") {
            whereClauses.push("(pr.party_name = ? OR po.vendor_name = ?)");
            params.push(partyParam, partyParam);
        }

        if (territoryParam && territoryParam !== "ALL") {
            whereClauses.push("pr.territory = ?");
            params.push(territoryParam);
        }

        if (searchParam) {
            whereClauses.push("(pr.pr_number LIKE ? OR po.po_number LIKE ? OR pr.party_name LIKE ? OR po.vendor_name LIKE ? OR pr.item_name LIKE ? OR pr.make LIKE ? OR pr.model LIKE ?)");
            const wild = `%${searchParam}%`;
            params.push(wild, wild, wild, wild, wild, wild, wild);
        }

        if (fromDate) {
            if (!isRealDate(fromDate)) {
                return res.status(400).json({ success: false, message: "Invalid from_date format (YYYY-MM-DD required)" });
            }
            whereClauses.push("COALESCE(pr.pr_date, DATE(pr.created_at)) >= ?");
            params.push(fromDate);
        }

        if (toDate) {
            if (!isRealDate(toDate)) {
                return res.status(400).json({ success: false, message: "Invalid to_date format (YYYY-MM-DD required)" });
            }
            whereClauses.push("COALESCE(pr.pr_date, DATE(pr.created_at)) <= ?");
            params.push(toDate);
        }

        const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";

        const [rows] = await db.query(`
            SELECT
                pr.id AS pr_id,
                pr.pr_number,
                pr.pr_date,
                pr.created_at,
                pr.party_name,
                pr.location,
                pr.territory,
                pr.product_category,
                pr.sub_product_category,
                pr.item_name,
                pr.make,
                pr.model,
                pr.qty,
                pr.unit,
                pr.sales_rate,
                pr.taxable_value,
                pr.product_remarks,
                pr.created_by,
                COALESCE(u.username, 'admin') AS creator_username,
                vi.inquiry_id,
                vi.status AS vi_status,
                po.po_id,
                po.po_number,
                po.po_date,
                po.status AS po_status,
                po.vendor_name,
                po.price_per_unit AS po_unit_price,
                po.total_price AS po_total_price,
                CASE
                    WHEN po.status = 'COMPLETED' THEN 'CLOSED'
                    WHEN po.status = 'CANCELLED' THEN 'CANCELLED'
                    WHEN vi.status IS NOT NULL THEN vi.status
                    ELSE 'OPEN'
                END AS status
            FROM purchase_requests pr
            LEFT JOIN users u ON u.user_id = pr.created_by
            LEFT JOIN vendor_inquiries vi ON vi.pr_id = pr.id
            LEFT JOIN purchase_orders po ON po.pr_id = pr.id
            ${whereSql}
            ORDER BY pr.id DESC
        `, params);

        const workbook = new ExcelJS.Workbook();
        workbook.creator = "ProcureIQ Enterprise";
        workbook.lastModifiedBy = "ProcureIQ Enterprise";
        workbook.created = new Date();
        workbook.modified = new Date();

        const sheet = workbook.addWorksheet("Purchase Requests", {
            views: [{ state: "frozen", ySplit: 4, showGridLines: true }],
            properties: { defaultRowHeight: 22 }
        });

        // 1. Title Banner
        sheet.mergeCells("A1:U1");
        const titleCell = sheet.getCell("A1");
        titleCell.value = "NIMIT — PROCUREIQ BULK PURCHASE REQUESTS REPORT";
        titleCell.font = { name: "Segoe UI", size: 15, bold: true, color: { argb: "FFFFFFFF" } };
        titleCell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FF0B57A4" }
        };
        titleCell.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
        sheet.getRow(1).height = 36;

        // 2. Metadata / Filter Subtitle
        sheet.mergeCells("A2:U2");
        const metaCell = sheet.getCell("A2");
        const now = new Date();
        const dateTag = now.toISOString().slice(0, 10);
        const filterStatusText = (statusParam && statusParam !== "ALL") ? statusParam : "All Statuses";
        const filterDateText = (fromDate || toDate) ? `From: ${fromDate || "Start"} To: ${toDate || "Present"}` : "All Dates";
        const filterPartyText = partyParam && partyParam !== "ALL" ? ` | Party/Vendor: "${partyParam}"` : "";
        const filterTerritoryText = territoryParam && territoryParam !== "ALL" ? ` | Territory: "${territoryParam}"` : "";
        const filterSearchText = searchParam ? ` | Search: "${searchParam}"` : "";
        metaCell.value = `Exported: ${now.toLocaleDateString("en-IN")} ${now.toLocaleTimeString("en-IN")} | Status: ${filterStatusText} | Period: ${filterDateText}${filterTerritoryText}${filterPartyText}${filterSearchText} | Total Records: ${rows.length}`;
        metaCell.font = { name: "Segoe UI", size: 10, italic: true, color: { argb: "FF334155" } };
        metaCell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFF1F5F9" }
        };
        metaCell.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
        sheet.getRow(2).height = 24;

        sheet.getRow(3).height = 10; // Spacer

        // 3. Table Column Headers
        const columns = [
            { header: "S.No", key: "sno", width: 8, align: "center" },
            { header: "PR Number", key: "pr_number", width: 22, align: "center" },
            { header: "PR Date", key: "pr_date", width: 14, align: "center" },
            { header: "Status", key: "status", width: 18, align: "center" },
            { header: "Party / Client Name", key: "party_name", width: 28, align: "left" },
            { header: "Vendor Name", key: "vendor_name", width: 28, align: "left" },
            { header: "PO Number", key: "po_number", width: 22, align: "center" },
            { header: "Location", key: "location", width: 18, align: "left" },
            { header: "Territory", key: "territory", width: 18, align: "left" },
            { header: "Product Category", key: "product_category", width: 24, align: "left" },
            { header: "Sub Product Category", key: "sub_product_category", width: 22, align: "left" },
            { header: "Item Name", key: "item_name", width: 34, align: "left" },
            { header: "Make", key: "make", width: 18, align: "left" },
            { header: "Model", key: "model", width: 20, align: "left" },
            { header: "Quantity", key: "qty", width: 14, align: "right" },
            { header: "Unit", key: "unit", width: 12, align: "center" },
            { header: "Sales Rate (₹)", key: "sales_rate", width: 18, align: "right" },
            { header: "Taxable Value (₹)", key: "taxable_value", width: 20, align: "right" },
            { header: "PO Rate (₹)", key: "po_rate", width: 18, align: "right" },
            { header: "Product Remarks", key: "product_remarks", width: 32, align: "left" },
            { header: "Created By", key: "created_by", width: 16, align: "center" }
        ];

        const headerRow = sheet.getRow(4);
        headerRow.height = 28;
        columns.forEach((col, idx) => {
            const cell = headerRow.getCell(idx + 1);
            cell.value = col.header;
            cell.font = { name: "Segoe UI", size: 10.5, bold: true, color: { argb: "FFFFFFFF" } };
            cell.fill = {
                type: "pattern",
                pattern: "solid",
                fgColor: { argb: "FF0B57A4" }
            };
            cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
            cell.border = {
                top: { style: "medium", color: { argb: "FF0B57A4" } },
                left: { style: "thin", color: { argb: "FF94A3B8" } },
                bottom: { style: "medium", color: { argb: "FF0F172A" } },
                right: { style: "thin", color: { argb: "FF94A3B8" } }
            };
            sheet.getColumn(idx + 1).width = col.width;
        });

        // 4. Data Rows
        let currentRowIdx = 5;
        let totalQty = 0;
        let totalTaxableValue = 0;

        rows.forEach((row, idx) => {
            const dataRow = sheet.getRow(currentRowIdx);
            dataRow.height = 22;

            let prDateStr = "—";
            if (row.pr_date) {
                prDateStr = row.pr_date instanceof Date ? row.pr_date.toISOString().slice(0, 10) : String(row.pr_date).slice(0, 10);
            } else if (row.created_at) {
                prDateStr = row.created_at instanceof Date ? row.created_at.toISOString().slice(0, 10) : String(row.created_at).slice(0, 10);
            }

            const rawStatus = (row.status || "OPEN").toUpperCase();
            const statusDisplay = row.status ? row.status.replace(/_/g, " ") : "OPEN";

            const qty = Number(row.qty || 0);
            const salesRate = Number(row.sales_rate || 0);
            const taxableVal = Number(row.taxable_value || 0);
            const poRate = row.po_unit_price !== null && row.po_unit_price !== undefined ? Number(row.po_unit_price) : null;

            totalQty += qty;
            totalTaxableValue += taxableVal;

            const isEven = idx % 2 === 0;
            const bgArgb = isEven ? "FFFFFFFF" : "FFF8FAFC";

            const values = [
                idx + 1,
                row.pr_number || "—",
                prDateStr,
                statusDisplay,
                row.party_name || "—",
                row.vendor_name || "—",
                row.po_number || "—",
                row.location || "—",
                row.territory || "—",
                row.product_category || "—",
                row.sub_product_category || "—",
                row.item_name || "—",
                row.make || "—",
                row.model || "—",
                qty,
                row.unit || "—",
                salesRate,
                taxableVal,
                poRate !== null ? poRate : "—",
                row.product_remarks || "",
                row.creator_username || "admin"
            ];

            values.forEach((val, colIdx) => {
                const cell = dataRow.getCell(colIdx + 1);
                cell.value = sanitizeExcelCellValue(val);
                cell.font = { name: "Segoe UI", size: 10, color: { argb: "FF0F172A" } };
                cell.fill = {
                    type: "pattern",
                    pattern: "solid",
                    fgColor: { argb: bgArgb }
                };
                cell.border = {
                    top: { style: "thin", color: { argb: "FFE2E8F0" } },
                    left: { style: "thin", color: { argb: "FFE2E8F0" } },
                    bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
                    right: { style: "thin", color: { argb: "FFE2E8F0" } }
                };

                // Alignment & Formatting
                if (colIdx === 0 || colIdx === 1 || colIdx === 2 || colIdx === 6 || colIdx === 15 || colIdx === 20) {
                    cell.alignment = { vertical: "middle", horizontal: "center" };
                } else if (colIdx === 3) {
                    // Status styling
                    cell.alignment = { vertical: "middle", horizontal: "center" };
                    if (rawStatus === "OPEN") {
                        cell.font = { name: "Segoe UI", size: 9.5, bold: true, color: { argb: "FF1D4ED8" } };
                        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEFF6FF" } };
                    } else if (rawStatus === "VENDOR_SELECTED") {
                        cell.font = { name: "Segoe UI", size: 9.5, bold: true, color: { argb: "FFB45309" } };
                        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFFBEB" } };
                    } else if (rawStatus === "CLOSED") {
                        cell.font = { name: "Segoe UI", size: 9.5, bold: true, color: { argb: "FF15803D" } };
                        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF0FDF4" } };
                    } else if (rawStatus === "CANCELLED") {
                        cell.font = { name: "Segoe UI", size: 9.5, bold: true, color: { argb: "FFB91C1C" } };
                        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFEF2F2" } };
                    }
                } else if (colIdx === 14) {
                    cell.alignment = { vertical: "middle", horizontal: "right" };
                    cell.numFmt = "#,##0";
                } else if (colIdx === 16 || colIdx === 17) {
                    cell.alignment = { vertical: "middle", horizontal: "right" };
                    cell.numFmt = "₹#,##0.00";
                } else if (colIdx === 18) {
                    cell.alignment = { vertical: "middle", horizontal: "right" };
                    if (poRate !== null) cell.numFmt = "₹#,##0.00";
                } else {
                    cell.alignment = { vertical: "middle", horizontal: "left" };
                }
            });

            currentRowIdx++;
        });

        // 5. Total Summary Row
        const totalRow = sheet.getRow(currentRowIdx);
        totalRow.height = 26;
        sheet.mergeCells(`A${currentRowIdx}:N${currentRowIdx}`);
        const totalLabelCell = totalRow.getCell(1);
        totalLabelCell.value = "TOTAL SUMMARY";
        totalLabelCell.font = { name: "Segoe UI", size: 10.5, bold: true, color: { argb: "FF0F172A" } };
        totalLabelCell.alignment = { vertical: "middle", horizontal: "right" };
        totalLabelCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE2E8F0" } };

        for (let c = 1; c <= 21; c++) {
            const cell = totalRow.getCell(c);
            cell.border = {
                top: { style: "medium", color: { argb: "FF0F172A" } },
                bottom: { style: "double", color: { argb: "FF0F172A" } },
                left: { style: "thin", color: { argb: "FFE2E8F0" } },
                right: { style: "thin", color: { argb: "FFE2E8F0" } }
            };
            if (c > 14) {
                cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE2E8F0" } };
            }
        }

        const qtyTotalCell = totalRow.getCell(15);
        qtyTotalCell.value = totalQty;
        qtyTotalCell.font = { name: "Segoe UI", size: 10.5, bold: true, color: { argb: "FF0F172A" } };
        qtyTotalCell.alignment = { vertical: "middle", horizontal: "right" };
        qtyTotalCell.numFmt = "#,##0";

        const taxableTotalCell = totalRow.getCell(18);
        taxableTotalCell.value = totalTaxableValue;
        taxableTotalCell.font = { name: "Segoe UI", size: 10.5, bold: true, color: { argb: "FF0F172A" } };
        taxableTotalCell.alignment = { vertical: "middle", horizontal: "right" };
        taxableTotalCell.numFmt = "₹#,##0.00";

        // Auto filter on table headers
        if (currentRowIdx > 5) {
            sheet.autoFilter = `A4:U${currentRowIdx - 1}`;
        }

        const statusSuffix = (statusParam && statusParam !== "ALL") ? `_${statusParam}` : "";
        const filename = `Purchase_Requests_Export${statusSuffix}_${dateTag}.xlsx`;

        res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

        await workbook.xlsx.write(res);
        return res.end();
    } catch (error) {
        console.error(error);
        log(`Purchase requests Excel export failed - ${error.message}`);
        return res.status(500).json({
            success: false,
            message: "Failed to export purchase requests Excel file"
        });
    }
});

/* ==========================================================================
   TAB: ORDER TRACKING
   ========================================================================== */

// GET /order-tracking - Paginated list (10 per page) of all purchase requests with their inquiry status and PO number
app.get("/order-tracking", verifyProcurement, async (req, res) => {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = 10;
    const offset = (page - 1) * limit;
    const statusParam = (req.query.status || "").trim().toUpperCase();
    const searchParam = (req.query.search || "").trim();
    const partyParam = (req.query.party || req.query.vendor || "").trim();
    const singleDate = (req.query.date || "").trim();
    const fromDate = (req.query.from_date || req.query.from || singleDate).trim();
    const toDate = (req.query.to_date || req.query.to || singleDate).trim();

    try {
        const whereClauses = [];
        const params = [];

        if (statusParam && statusParam !== "ALL") {
            if (statusParam === "NO_INQUIRY" || statusParam === "NONE") {
                whereClauses.push("status IS NULL");
            } else {
                whereClauses.push("status = ?");
                params.push(statusParam);
            }
        }

        if (partyParam && partyParam !== "ALL") {
            whereClauses.push("(party_name = ? OR vendor_name = ?)");
            params.push(partyParam, partyParam);
        }

        if (searchParam) {
            whereClauses.push("(pr_number LIKE ? OR po_number LIKE ? OR party_name LIKE ? OR vendor_name LIKE ? OR item_name LIKE ?)");
            const wild = `%${searchParam}%`;
            params.push(wild, wild, wild, wild, wild);
        }

        if (fromDate) {
            if (!isRealDate(fromDate)) {
                return res.status(400).json({ success: false, message: "Invalid from_date format (YYYY-MM-DD required)" });
            }
            whereClauses.push("COALESCE(pr_date, DATE(created_at)) >= ?");
            params.push(fromDate);
        }

        if (toDate) {
            if (!isRealDate(toDate)) {
                return res.status(400).json({ success: false, message: "Invalid to_date format (YYYY-MM-DD required)" });
            }
            whereClauses.push("COALESCE(pr_date, DATE(created_at)) <= ?");
            params.push(toDate);
        }

        const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";

        const baseFromSql = `
            FROM (
                SELECT
                    pr.id AS pr_id,
                    pr.pr_number,
                    pr.pr_date,
                    pr.created_at,
                    pr.party_name,
                    pr.location,
                    pr.territory,
                    pr.product_category,
                    pr.sub_product_category,
                    pr.item_name,
                    pr.make,
                    pr.model,
                    pr.qty,
                    pr.unit,
                    pr.sales_rate,
                    pr.taxable_value,
                    pr.product_remarks,
                    vi.inquiry_id,
                    vi.status AS vi_status,
                    vi.updated_at AS vi_updated_at,
                    po.po_id,
                    po.po_number,
                    po.po_date,
                    po.status AS po_status,
                    po.vendor_name,
                    po.created_at AS po_created_at,
                    po.updated_at AS po_updated_at,
                    GREATEST(0, COALESCE((SELECT SUM(gr.received_quantity) FROM goods_received gr WHERE gr.po_id = po.po_id), 0) - COALESCE((SELECT SUM(ret.return_quantity) FROM goods_returns ret WHERE ret.po_id = po.po_id), 0)) AS total_received,
                    (SELECT MAX(gr.received_date) FROM goods_received gr WHERE gr.po_id = po.po_id) AS last_received_date,
                    CASE
                        WHEN po.status = 'COMPLETED' THEN 'CLOSED'
                        WHEN po.status = 'CANCELLED' THEN 'CANCELLED'
                        ELSE vi.status
                    END AS status
                FROM purchase_requests pr
                LEFT JOIN vendor_inquiries vi
                    ON vi.pr_id = pr.id
                LEFT JOIN purchase_orders po
                    ON po.pr_id = pr.id
            ) t
            ${whereSql}
        `;

        const countFromSql = `
            FROM (
                SELECT
                    pr.id AS pr_id,
                    pr.pr_number,
                    pr.pr_date,
                    pr.created_at,
                    pr.party_name,
                    pr.item_name,
                    po.po_number,
                    po.vendor_name,
                    CASE
                        WHEN po.status = 'COMPLETED' THEN 'CLOSED'
                        WHEN po.status = 'CANCELLED' THEN 'CANCELLED'
                        ELSE vi.status
                    END AS status
                FROM purchase_requests pr
                LEFT JOIN vendor_inquiries vi ON vi.pr_id = pr.id
                LEFT JOIN purchase_orders po ON po.pr_id = pr.id
            ) t
            ${whereSql}
        `;

        const [[countRows], [rows], [statusCountRows], [partyRows]] = await Promise.all([
            db.query(`SELECT COUNT(*) AS total ${countFromSql}`, params),
            db.query(`SELECT * ${baseFromSql} ORDER BY pr_id DESC LIMIT ? OFFSET ?`, [...params, limit, offset]),
            db.query(`
                SELECT
                    COUNT(*) AS total_all,
                    SUM(CASE WHEN status = 'OPEN' THEN 1 ELSE 0 END) AS total_open,
                    SUM(CASE WHEN status = 'VENDOR_SELECTED' THEN 1 ELSE 0 END) AS total_vendor_selected,
                    SUM(CASE WHEN status = 'CLOSED' THEN 1 ELSE 0 END) AS total_closed,
                    SUM(CASE WHEN status = 'CANCELLED' THEN 1 ELSE 0 END) AS total_cancelled
                FROM (
                    SELECT
                        pr.id,
                        CASE
                            WHEN po.status = 'COMPLETED' THEN 'CLOSED'
                            WHEN po.status = 'CANCELLED' THEN 'CANCELLED'
                            ELSE vi.status
                        END AS status
                    FROM purchase_requests pr
                    LEFT JOIN vendor_inquiries vi ON vi.pr_id = pr.id
                    LEFT JOIN purchase_orders po ON po.pr_id = pr.id
                ) all_ot
            `),
            db.query(`
                SELECT DISTINCT name FROM (
                    SELECT party_name AS name FROM purchase_requests WHERE party_name IS NOT NULL AND TRIM(party_name) != ''
                    UNION
                    SELECT vendor_name AS name FROM purchase_orders WHERE vendor_name IS NOT NULL AND TRIM(vendor_name) != ''
                ) plist ORDER BY name ASC
            `)
        ]);
        const total = countRows[0]?.total || 0;
        const totalPages = Math.max(1, Math.ceil(total / limit));

        const sc = statusCountRows[0] || {};
        const counts = {
            ALL: Number(sc.total_all) || 0,
            OPEN: Number(sc.total_open) || 0,
            VENDOR_SELECTED: Number(sc.total_vendor_selected) || 0,
            CLOSED: Number(sc.total_closed) || 0,
            CANCELLED: Number(sc.total_cancelled) || 0
        };

        const parties = (partyRows || []).map(r => r.name).filter(Boolean);

        return res.json({
            success: true,
            rows,
            pagination: {
                page,
                limit,
                total,
                total_pages: totalPages,
                has_prev: page > 1,
                has_next: page < totalPages
            },
            counts,
            parties
        });
    } catch (error) {
        console.error(error);
        log(`Order tracking fetch failed - ${error.message}`);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch order tracking data"
        });
    }
});

// GET /order-tracking/export - Export order tracking summary matching applied filters as real Excel (.xlsx)
app.get("/order-tracking/export", verifyProcurement, async (req, res) => {
    const statusParam = (req.query.status || "").trim().toUpperCase();
    const searchParam = (req.query.search || "").trim();
    const partyParam = (req.query.party || req.query.vendor || "").trim();
    const singleDate = (req.query.date || "").trim();
    const fromDate = (req.query.from_date || req.query.from || singleDate).trim();
    const toDate = (req.query.to_date || req.query.to || singleDate).trim();

    try {
        const whereClauses = [];
        const params = [];

        if (statusParam && statusParam !== "ALL") {
            if (statusParam === "NO_INQUIRY" || statusParam === "NONE") {
                whereClauses.push("status IS NULL");
            } else {
                whereClauses.push("status = ?");
                params.push(statusParam);
            }
        }

        if (partyParam && partyParam !== "ALL") {
            whereClauses.push("(party_name = ? OR vendor_name = ?)");
            params.push(partyParam, partyParam);
        }

        if (searchParam) {
            whereClauses.push("(pr_number LIKE ? OR po_number LIKE ? OR party_name LIKE ? OR vendor_name LIKE ? OR item_name LIKE ?)");
            const wild = `%${searchParam}%`;
            params.push(wild, wild, wild, wild, wild);
        }

        if (fromDate) {
            if (!isRealDate(fromDate)) {
                return res.status(400).json({ success: false, message: "Invalid from_date format (YYYY-MM-DD required)" });
            }
            whereClauses.push("COALESCE(pr_date, DATE(created_at)) >= ?");
            params.push(fromDate);
        }

        if (toDate) {
            if (!isRealDate(toDate)) {
                return res.status(400).json({ success: false, message: "Invalid to_date format (YYYY-MM-DD required)" });
            }
            whereClauses.push("COALESCE(pr_date, DATE(created_at)) <= ?");
            params.push(toDate);
        }

        const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";

        const baseFromSql = `
            FROM (
                SELECT
                    pr.id AS pr_id,
                    pr.pr_number,
                    pr.pr_date,
                    pr.created_at,
                    pr.party_name,
                    pr.location,
                    pr.territory,
                    pr.product_category,
                    pr.sub_product_category,
                    pr.item_name,
                    pr.make,
                    pr.model,
                    pr.qty,
                    pr.unit,
                    pr.sales_rate,
                    pr.taxable_value,
                    pr.product_remarks,
                    vi.inquiry_id,
                    vi.status AS vi_status,
                    vi.updated_at AS vi_updated_at,
                    po.po_id,
                    po.po_number,
                    po.po_date,
                    po.status AS po_status,
                    po.vendor_name,
                    po.created_at AS po_created_at,
                    po.updated_at AS po_updated_at,
                    GREATEST(0, COALESCE((SELECT SUM(gr.received_quantity) FROM goods_received gr WHERE gr.po_id = po.po_id), 0) - COALESCE((SELECT SUM(ret.return_quantity) FROM goods_returns ret WHERE ret.po_id = po.po_id), 0)) AS total_received,
                    (SELECT MAX(gr.received_date) FROM goods_received gr WHERE gr.po_id = po.po_id) AS last_received_date,
                    CASE
                        WHEN po.status = 'COMPLETED' THEN 'CLOSED'
                        WHEN po.status = 'CANCELLED' THEN 'CANCELLED'
                        ELSE vi.status
                    END AS status
                FROM purchase_requests pr
                LEFT JOIN vendor_inquiries vi
                    ON vi.pr_id = pr.id
                LEFT JOIN purchase_orders po
                    ON po.pr_id = pr.id
            ) t
            ${whereSql}
        `;

        const [rows] = await db.query(
            `SELECT * ${baseFromSql} ORDER BY pr_id DESC`,
            params
        );

        const workbook = new ExcelJS.Workbook();
        workbook.creator = "ProcureIQ";
        workbook.lastModifiedBy = "ProcureIQ Enterprise";
        workbook.created = new Date();
        workbook.modified = new Date();

        const sheet = workbook.addWorksheet("Order Summary", {
            views: [{ state: "frozen", ySplit: 4, showGridLines: true }],
            properties: { defaultRowHeight: 22 }
        });

        // 1. Title Banner
        sheet.mergeCells("A1:S1");
        const titleCell = sheet.getCell("A1");
        titleCell.value = "NIMIT — PROCUREIQ ORDER TRACKING SUMMARY";
        titleCell.font = { name: "Segoe UI", size: 16, bold: true, color: { argb: "FFFFFFFF" } };
        titleCell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FF0F172A" }
        };
        titleCell.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
        sheet.getRow(1).height = 36;

        // 2. Metadata / Filter Bar Subtitle
        sheet.mergeCells("A2:S2");
        const metaCell = sheet.getCell("A2");
        const now = new Date();
        const dateTag = now.toISOString().slice(0, 10);
        const filterStatusText = (statusParam && statusParam !== "ALL") ? statusParam : "All Statuses";
        const filterDateText = (fromDate || toDate) ? `From: ${fromDate || "Start"} To: ${toDate || "Present"}` : "All Dates";
        const filterSearchText = searchParam ? ` | Search: "${searchParam}"` : "";
        metaCell.value = `Exported: ${now.toLocaleDateString("en-IN")} ${now.toLocaleTimeString("en-IN")} | Status: ${filterStatusText} | Period: ${filterDateText}${filterSearchText} | Total Records: ${rows.length}`;
        metaCell.font = { name: "Segoe UI", size: 10, italic: true, color: { argb: "FF334155" } };
        metaCell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFF1F5F9" }
        };
        metaCell.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
        sheet.getRow(2).height = 24;

        // Blank spacer row
        sheet.getRow(3).height = 10;

        // 3. Table Column Headers
        const columns = [
            { header: "S.No", key: "sno", width: 8 },
            { header: "PR Number", key: "pr_number", width: 22 },
            { header: "PR Date", key: "pr_date", width: 14 },
            { header: "PO Number", key: "po_number", width: 22 },
            { header: "PO Date", key: "po_date", width: 14 },
            { header: "Status", key: "status", width: 18 },
            { header: "Party Name", key: "party_name", width: 30 },
            { header: "Location", key: "location", width: 18 },
            { header: "Territory", key: "territory", width: 14 },
            { header: "Product Category", key: "product_category", width: 24 },
            { header: "Sub Product Category", key: "sub_product_category", width: 22 },
            { header: "Item Name", key: "item_name", width: 36 },
            { header: "Make", key: "make", width: 18 },
            { header: "Model", key: "model", width: 20 },
            { header: "Quantity", key: "qty", width: 14 },
            { header: "Unit", key: "unit", width: 12 },
            { header: "Sales Rate (INR)", key: "sales_rate", width: 18 },
            { header: "Taxable Value (INR)", key: "taxable_value", width: 20 },
            { header: "Remarks", key: "remarks", width: 32 }
        ];

        const headerRow = sheet.getRow(4);
        headerRow.height = 28;
        columns.forEach((col, idx) => {
            const cell = headerRow.getCell(idx + 1);
            cell.value = col.header;
            cell.font = { name: "Segoe UI", size: 11, bold: true, color: { argb: "FFFFFFFF" } };
            cell.fill = {
                type: "pattern",
                pattern: "solid",
                fgColor: { argb: "FF2563EB" }
            };
            cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
            cell.border = {
                top: { style: "medium", color: { argb: "FF1D4ED8" } },
                left: { style: "thin", color: { argb: "FF93C5FD" } },
                bottom: { style: "medium", color: { argb: "FF1D4ED8" } },
                right: { style: "thin", color: { argb: "FF93C5FD" } }
            };
            sheet.getColumn(idx + 1).width = col.width;
        });

        // 4. Data Rows
        let currentRowIdx = 5;
        let totalQty = 0;
        let totalTaxableValue = 0;

        rows.forEach((row, idx) => {
            const dataRow = sheet.getRow(currentRowIdx);
            dataRow.height = 22;

            let prDateStr = "—";
            if (row.pr_date) {
                prDateStr = row.pr_date instanceof Date ? row.pr_date.toISOString().slice(0, 10) : String(row.pr_date).slice(0, 10);
            } else if (row.created_at) {
                prDateStr = row.created_at instanceof Date ? row.created_at.toISOString().slice(0, 10) : String(row.created_at).slice(0, 10);
            }

            let poDateStr = "—";
            if (row.po_date) {
                poDateStr = row.po_date instanceof Date ? row.po_date.toISOString().slice(0, 10) : String(row.po_date).slice(0, 10);
            }

            const rawStatus = (row.status || "NO_INQUIRY").toUpperCase();
            const statusDisplay = row.status ? row.status.replace(/_/g, " ") : "NO INQUIRY";

            const qty = Number(row.qty || 0);
            const salesRate = Number(row.sales_rate || 0);
            const taxableVal = Number(row.taxable_value || 0);

            totalQty += qty;
            totalTaxableValue += taxableVal;

            const isEven = idx % 2 === 0;
            const bgArgb = isEven ? "FFFFFFFF" : "FFF8FAFC";

            const values = [
                idx + 1,
                row.pr_number || "—",
                prDateStr,
                row.po_number || "—",
                poDateStr,
                statusDisplay,
                row.party_name || "—",
                row.location || "—",
                row.territory || "—",
                row.product_category || "—",
                row.sub_product_category || "—",
                row.item_name || "—",
                row.make || "—",
                row.model || "—",
                qty,
                row.unit || "—",
                salesRate,
                taxableVal,
                row.product_remarks || ""
            ];

            values.forEach((val, colIdx) => {
                const cell = dataRow.getCell(colIdx + 1);
                cell.value = sanitizeExcelCellValue(val);
                cell.font = { name: "Segoe UI", size: 10, color: { argb: "FF0F172A" } };
                cell.fill = {
                    type: "pattern",
                    pattern: "solid",
                    fgColor: { argb: bgArgb }
                };
                cell.border = {
                    top: { style: "thin", color: { argb: "FFE2E8F0" } },
                    left: { style: "thin", color: { argb: "FFE2E8F0" } },
                    bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
                    right: { style: "thin", color: { argb: "FFE2E8F0" } }
                };

                if (colIdx === 0) {
                    cell.alignment = { vertical: "middle", horizontal: "center" };
                } else if (colIdx >= 1 && colIdx <= 4) {
                    cell.alignment = { vertical: "middle", horizontal: "center" };
                } else if (colIdx === 5) {
                    cell.alignment = { vertical: "middle", horizontal: "center" };
                    if (rawStatus === "OPEN") {
                        cell.font = { name: "Segoe UI", size: 9.5, bold: true, color: { argb: "FF1D4ED8" } };
                        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEFF6FF" } };
                    } else if (rawStatus === "VENDOR_SELECTED") {
                        cell.font = { name: "Segoe UI", size: 9.5, bold: true, color: { argb: "FFB45309" } };
                        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFFBEB" } };
                    } else if (rawStatus === "CLOSED") {
                        cell.font = { name: "Segoe UI", size: 9.5, bold: true, color: { argb: "FF15803D" } };
                        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF0FDF4" } };
                    } else if (rawStatus === "CANCELLED") {
                        cell.font = { name: "Segoe UI", size: 9.5, bold: true, color: { argb: "FFB91C1C" } };
                        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFEF2F2" } };
                    }
                } else if (colIdx === 14) {
                    cell.alignment = { vertical: "middle", horizontal: "right" };
                    cell.numFmt = "#,##0";
                } else if (colIdx === 15) {
                    cell.alignment = { vertical: "middle", horizontal: "center" };
                } else if (colIdx === 16) {
                    cell.alignment = { vertical: "middle", horizontal: "right" };
                    cell.numFmt = "₹#,##0.00";
                } else if (colIdx === 17) {
                    cell.alignment = { vertical: "middle", horizontal: "right" };
                    cell.numFmt = "₹#,##0.00";
                } else {
                    cell.alignment = { vertical: "middle", horizontal: "left" };
                }
            });

            currentRowIdx++;
        });

        // 5. Total Row
        const totalRow = sheet.getRow(currentRowIdx);
        totalRow.height = 26;
        sheet.mergeCells(`A${currentRowIdx}:N${currentRowIdx}`);
        const totalLabelCell = totalRow.getCell(1);
        totalLabelCell.value = "TOTAL SUMMARY";
        totalLabelCell.font = { name: "Segoe UI", size: 10.5, bold: true, color: { argb: "FF0F172A" } };
        totalLabelCell.alignment = { vertical: "middle", horizontal: "right" };
        totalLabelCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE2E8F0" } };

        for (let c = 1; c <= 19; c++) {
            const cell = totalRow.getCell(c);
            cell.border = {
                top: { style: "medium", color: { argb: "FF0F172A" } },
                bottom: { style: "double", color: { argb: "FF0F172A" } },
                left: { style: "thin", color: { argb: "FFE2E8F0" } },
                right: { style: "thin", color: { argb: "FFE2E8F0" } }
            };
            if (c > 14) {
                cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE2E8F0" } };
            }
        }

        const qtyTotalCell = totalRow.getCell(15);
        qtyTotalCell.value = totalQty;
        qtyTotalCell.font = { name: "Segoe UI", size: 10.5, bold: true, color: { argb: "FF0F172A" } };
        qtyTotalCell.alignment = { vertical: "middle", horizontal: "right" };
        qtyTotalCell.numFmt = "#,##0";

        const taxableTotalCell = totalRow.getCell(18);
        taxableTotalCell.value = totalTaxableValue;
        taxableTotalCell.font = { name: "Segoe UI", size: 10.5, bold: true, color: { argb: "FF0F172A" } };
        taxableTotalCell.alignment = { vertical: "middle", horizontal: "right" };
        taxableTotalCell.numFmt = "₹#,##0.00";

        // Auto filter on table headers
        if (currentRowIdx > 5) {
            sheet.autoFilter = `A4:S${currentRowIdx - 1}`;
        }

        const statusSuffix = (statusParam && statusParam !== "ALL") ? `_${statusParam}` : "";
        const filename = `Order_Summary${statusSuffix}_${dateTag}.xlsx`;

        res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

        await workbook.xlsx.write(res);
        return res.end();
    } catch (error) {
        console.error(error);
        log(`Order tracking Excel export failed - ${error.message}`);
        return res.status(500).json({
            success: false,
            message: "Failed to export order tracking Excel file"
        });
    }
});

/* ==========================================================================
   TAB: VENDOR MASTER (registration, import, lookups)
   ========================================================================== */

// POST /vendors - Registers a vendor entered manually, together with its uploaded documents
app.post("/vendors", verifyProcurement, getVendorDocuments(), async (req, res) => {
    log("POST /vendors - Manual vendor entry");
    const connection = await db.getConnection();
    try {
        const data = parseVendorData(req);
        const files = req.files || {};
        const validation = validateVendorData(data, files);
        if (validation.missingFields.length || validation.missingDocuments.length || (validation.invalidFields && validation.invalidFields.length)) {
            const errorMsg = validation.invalidFields?.length
                ? validation.invalidFields.join(". ")
                : "Vendor data validation failed";
            return res.status(400).json({
                success: false,
                message: errorMsg,
                missing_fields: validation.missingFields,
                missing_documents: validation.missingDocuments,
                invalid_fields: validation.invalidFields
            });
        }
        await connection.beginTransaction();
        const result = await saveVendor(connection, data, files);
        await connection.commit();
        log(`Vendor created successfully - ${result.vendorCode}`);
        await writeReportLog(req, "VENDOR_CREATED", describeVendor(data, result, "through manual entry"));
        return res.status(201).json({
            success: true,
            message: "Vendor created successfully",
            vendor_id: result.vendorId,
            vendor_code: result.vendorCode
        });
    } catch (error) {
        await connection.rollback();
        log(`ERROR creating vendor: ${error.message}`);
        return res.status(error.message.includes("already exists") ? 409 : 500).json({
            success: false,
            message: error.message.includes("already exists") ? error.message : "Failed to create vendor"
        });
    } finally {
        connection.release();
    }
});

// GET /vendors/check-gst - Checks whether a vendor with the given GST number is already registered
app.get("/vendors/check-gst", verifyProcurement, async (req, res) => {
    const gstNumber = cleanValue(req.query.gst_number);
    if (!gstNumber) {
        return res.status(400).json({
            success: false,
            message: "GST number is required"
        });
    }
    try {
        const [rows] = await db.execute(
            `SELECT vendor_name FROM vendor_oem_masters WHERE gst_number = ? LIMIT 1`,
            [gstNumber]
        );
        if (rows.length > 0) {
            return res.json({
                success: true,
                exists: true,
                vendor_name: rows[0].vendor_name
            });
        }
        return res.json({
            success: true,
            exists: false
        });
    } catch (error) {
        log(`ERROR checking GST number: ${error.message}`);
        return res.status(500).json({
            success: false,
            message: "Failed to check GST number"
        });
    }
});

// GET /vendors/template - Downloads an Excel (.xlsx) template with standard headers and sample data for bulk vendor import
app.get(["/vendors/template", "/api/vendors/template", "/vendors/import-template"], verifyProcurement, async (req, res) => {
    try {
        const workbook = new ExcelJS.Workbook();
        workbook.creator = "ProcureIQ";
        workbook.created = new Date();

        const sheet = workbook.addWorksheet("Vendor Import Template", {
            views: [{ state: "frozen", ySplit: 2, showGridLines: true }]
        });

        const columns = [
            { header: "Vendor Name *", key: "vendor_name", width: 30 },
            { header: "Registration Date (YYYY-MM-DD)", key: "registration_date", width: 22 },
            { header: "Legal Entity *", key: "legal_entity", width: 18 },
            { header: "Commercial Role *", key: "commercial_role", width: 18 },
            { header: "Year of Incorporation *", key: "year_of_incorporation", width: 20 },
            { header: "GST Number *", key: "gst_number", width: 20 },
            { header: "PAN Number *", key: "pan_number", width: 16 },
            { header: "MSME Number", key: "msme_number", width: 20 },
            { header: "Office Address *", key: "office_address", width: 36 },
            { header: "Office Contact Name *", key: "office_contact_name", width: 22 },
            { header: "Office Contact Number *", key: "office_contact_number", width: 22 },
            { header: "Management / Director Name *", key: "director_or_ceo_or_management_name", width: 26 },
            { header: "Management Designation *", key: "director_or_ceo_or_management_designation", width: 22 },
            { header: "Management Mobile No *", key: "director_or_ceo_or_management_mobile_no", width: 22 },
            { header: "Management Email *", key: "director_or_ceo_or_management_email", width: 26 },
            { header: "Website", key: "director_or_ceo_or_management_web_address", width: 24 },
            { header: "Bank Name *", key: "bank_name", width: 22 },
            { header: "Bank Account No *", key: "bank_account_no", width: 22 },
            { header: "Bank Branch *", key: "bank_branch", width: 22 },
            { header: "Account Type *", key: "bank_account_type", width: 16 },
            { header: "IFSC Code *", key: "bank_ifsc", width: 16 },
            { header: "Sales Team Name", key: "sales_team_name", width: 20 },
            { header: "Sales Team Contact", key: "sales_team_contact", width: 20 },
            { header: "Sales Team Email", key: "sales_team_email", width: 24 },
            { header: "Accounts Team Name", key: "accounts_team_name", width: 20 },
            { header: "Accounts Team Contact", key: "accounts_team_contact", width: 20 },
            { header: "Accounts Team Email", key: "accounts_team_email", width: 24 },
            { header: "Factory Address", key: "factory_address", width: 28 },
            { header: "Factory Contact Name", key: "factory_contact_name", width: 20 },
            { header: "Factory Contact Number", key: "factory_contact_number", width: 20 },
            { header: "Warehouse Address", key: "warehouse_address", width: 28 },
            { header: "Warehouse Contact Name", key: "warehouse_contact_name", width: 20 },
            { header: "Warehouse Contact Number", key: "warehouse_contact_number", width: 20 },
            { header: "Workshop Address", key: "workshop_address", width: 28 },
            { header: "Workshop Contact Name", key: "workshop_contact_name", width: 20 },
            { header: "Workshop Contact Number", key: "workshop_contact_number", width: 20 },
            { header: "Turnover Year 1", key: "turnover_year_1", width: 16 },
            { header: "Turnover Value 1", key: "turnover_value_1", width: 18 },
            { header: "Turnover Year 2", key: "turnover_year_2", width: 16 },
            { header: "Turnover Value 2", key: "turnover_value_2", width: 18 },
            { header: "Turnover Year 3", key: "turnover_year_3", width: 16 },
            { header: "Turnover Value 3", key: "turnover_value_3", width: 18 },
            { header: "Branch 1 Address", key: "branch_office_1_address", width: 26 },
            { header: "Branch 1 Contact Name", key: "branch_office_1_contact_name", width: 20 },
            { header: "Branch 1 Contact Number", key: "branch_office_1_contact_number", width: 20 },
            { header: "Recommended By", key: "recommended_by", width: 18 },
            { header: "Approved By", key: "approved_by", width: 18 }
        ];

        sheet.columns = columns.map(c => ({ header: c.header, key: c.key, width: c.width }));

        // Style Header Row (Row 1)
        const headerRow = sheet.getRow(1);
        headerRow.height = 32;
        headerRow.eachCell((cell) => {
            cell.font = { name: "Segoe UI", size: 10, bold: true, color: { argb: "FFFFFFFF" } };
            cell.fill = {
                type: "pattern",
                pattern: "solid",
                fgColor: { argb: "FF0B57A4" }
            };
            cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
            cell.border = {
                top: { style: "thin", color: { argb: "FF94A3B8" } },
                left: { style: "thin", color: { argb: "FF94A3B8" } },
                bottom: { style: "medium", color: { argb: "FF0F172A" } },
                right: { style: "thin", color: { argb: "FF94A3B8" } }
            };
        });

        // Sample Data Row (Row 2) to illustrate proper formatting
        const sampleRow = sheet.addRow({
            vendor_name: "Apex Engineering Technologies Pvt Ltd",
            registration_date: new Date().toISOString().slice(0, 10),
            legal_entity: "Private Limited",
            commercial_role: "Manufacturer",
            year_of_incorporation: "2018",
            gst_number: "07AAAAA1234A1Z5",
            pan_number: "AAAAA1234A",
            msme_number: "UDYAM-DL-01-0012345",
            office_address: "Plot 42, Phase-2, Okhla Industrial Area, New Delhi - 110020",
            office_contact_name: "Rajesh Kumar",
            office_contact_number: "9876543210",
            director_or_ceo_or_management_name: "Amit Sharma",
            director_or_ceo_or_management_designation: "Managing Director",
            director_or_ceo_or_management_mobile_no: "9876543211",
            director_or_ceo_or_management_email: "amit.sharma@apexeng.com",
            director_or_ceo_or_management_web_address: "https://www.apexeng.com",
            bank_name: "HDFC Bank",
            bank_account_no: "50200012345678",
            bank_branch: "Okhla Phase 2, New Delhi",
            bank_account_type: "Current",
            bank_ifsc: "HDFC0000123",
            sales_team_name: "Vikas Gupta",
            sales_team_contact: "9876543212",
            sales_team_email: "sales@apexeng.com",
            accounts_team_name: "Sanjay Verma",
            accounts_team_contact: "9876543213",
            accounts_team_email: "accounts@apexeng.com",
            factory_address: "Sector 58, Industrial Area, Faridabad, Haryana",
            factory_contact_name: "Ramesh Singh",
            factory_contact_number: "9876543214",
            warehouse_address: "",
            warehouse_contact_name: "",
            warehouse_contact_number: "",
            workshop_address: "",
            workshop_contact_name: "",
            workshop_contact_number: "",
            turnover_year_1: "2026-2027",
            turnover_value_1: "5000000",
            turnover_year_2: "2025-2026",
            turnover_value_2: "4200000",
            turnover_year_3: "2024-2025",
            turnover_value_3: "3500000",
            branch_office_1_address: "",
            branch_office_1_contact_name: "",
            branch_office_1_contact_number: "",
            recommended_by: req.user?.username || "admin",
            approved_by: req.user?.username || "admin"
        });

        sampleRow.height = 24;
        sampleRow.eachCell((cell) => {
            cell.font = { name: "Segoe UI", size: 9, italic: true, color: { argb: "FF475569" } };
            cell.fill = {
                type: "pattern",
                pattern: "solid",
                fgColor: { argb: "FFF8FAFC" }
            };
            cell.alignment = { vertical: "middle", horizontal: "left" };
            cell.border = {
                top: { style: "thin", color: { argb: "FFE2E8F0" } },
                left: { style: "thin", color: { argb: "FFE2E8F0" } },
                bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
                right: { style: "thin", color: { argb: "FFE2E8F0" } }
            };
        });

        res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        res.setHeader("Content-Disposition", 'attachment; filename="Vendor_Import_Template.xlsx"');
        await workbook.xlsx.write(res);
        res.end();
    } catch (error) {
        log(`ERROR generating vendor import template: ${error.message}`);
        return res.status(500).json({
            success: false,
            message: "Failed to generate vendor import template"
        });
    }
});

// POST /vendors/import-preview - Reads an uploaded vendor Excel (registration form or multi-row table) and returns the parsed vendors without saving
app.post("/vendors/import-preview", verifyProcurement, excelUpload.single("file"), async (req, res) => {
    log("POST /vendors/import-preview - Vendor Excel preview requested");
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: "Excel file is required"
            });
        }
        const excelRows = await readSheet(req.file.buffer);
        if (!excelRows || excelRows.length <= 1) {
            return res.status(400).json({
                success: false,
                message: "Excel file contains no vendor data"
            });
        }
        const isForm = isVendorForm(excelRows);
        const vendors = isForm ? [parseVendorForm(excelRows)] : parseVendorTable(excelRows);
        log(`Vendor Excel preview successful - parsed ${vendors.length} vendor(s)`);
        return res.json({
            success: true,
            is_form: isForm,
            count: vendors.length,
            vendors,
            vendor: vendors[0] // backwards-compatibility
        });
    } catch (error) {
        log(`ERROR creating vendor Excel preview: ${error.message}`);
        return res.status(error.status || 500).json({
            success: false,
            message: error.status ? error.message : "Failed to process vendor Excel file"
        });
    }
});

// POST /vendors/import - Saves the reviewed vendor(s) from Excel import (supports single and bulk imports)
app.post("/vendors/import", verifyProcurement, getVendorDocuments(), async (req, res) => {
    log("POST /vendors/import - Saving imported vendor(s)");
    const connection = await db.getConnection();
    try {
        let rawData = null;
        if (req.body.vendors) {
            rawData = typeof req.body.vendors === "string" ? JSON.parse(req.body.vendors) : req.body.vendors;
        } else if (req.body.vendor_data) {
            rawData = typeof req.body.vendor_data === "string" ? JSON.parse(req.body.vendor_data) : req.body.vendor_data;
        }

        const isBulk = Array.isArray(rawData);
        const vendorsList = isBulk ? rawData : (rawData ? [rawData] : []);

        if (vendorsList.length === 0) {
            return res.status(400).json({
                success: false,
                message: "No vendor data provided for import"
            });
        }

        if (vendorsList.length > 500) {
            return res.status(400).json({
                success: false,
                message: "Maximum batch limit exceeded: Cannot import more than 500 vendors at once"
            });
        }

        const files = req.files || {};
        const currentUser = req.user?.username || req.session?.user?.username || "admin";

        // Validate all vendors before starting transaction
        const validationErrors = [];

        for (let i = 0; i < vendorsList.length; i++) {
            const rowNumber = i + 1;
            const v = vendorsList[i];
            if (!v.registration_date) v.registration_date = new Date().toISOString().slice(0, 10);
            if (!v.recommended_by) v.recommended_by = currentUser;
            if (!v.approved_by) v.approved_by = currentUser;

            // Only check uploaded files for single vendor imports
            const rowFiles = isBulk ? {} : files;
            const validation = validateVendorData(v, rowFiles);

            if (validation.missingFields.length || validation.missingDocuments.length || (validation.invalidFields && validation.invalidFields.length)) {
                const fieldLabels = {
                    vendor_name: "Vendor Name",
                    gst_number: "GST Number",
                    pan_number: "PAN Number",
                    legal_entity: "Legal Entity",
                    commercial_role: "Commercial Role",
                    office_address: "Office Address",
                    office_contact_name: "Contact Person",
                    office_contact_number: "Contact Phone",
                    director_or_ceo_or_management_name: "Director Name",
                    director_or_ceo_or_management_mobile_no: "Director Mobile",
                    director_or_ceo_or_management_email: "Director Email",
                    bank_name: "Bank Name",
                    bank_account_no: "Bank Account No",
                    bank_ifsc: "IFSC Code"
                };
                for (const field of validation.missingFields) {
                    const label = fieldLabels[field] || field.replace(/_/g, " ");
                    validationErrors.push(`Row ${rowNumber}: ${label} is required.`);
                }
                for (const inv of (validation.invalidFields || [])) {
                    validationErrors.push(`Row ${rowNumber}: ${inv}`);
                }
            }
        }

        if (validationErrors.length > 0) {
            return res.status(400).json({
                success: false,
                message: `Validation failed for ${validationErrors.length} vendor(s):\n` + validationErrors.slice(0, 5).join("\n") + (validationErrors.length > 5 ? `\n...and ${validationErrors.length - 5} more errors` : ""),
                errors: validationErrors
            });
        }

        await connection.beginTransaction();
        const savedVendors = [];

        for (const v of vendorsList) {
            const rowFiles = isBulk ? {} : files;
            const result = await saveVendor(connection, v, rowFiles);
            savedVendors.push({
                vendor_id: result.vendorId,
                vendor_code: result.vendorCode,
                vendor_name: v.vendor_name
            });
            await writeReportLog(req, "VENDOR_IMPORTED", describeVendor(v, result, "through Excel import"));
        }

        await connection.commit();
        log(`Successfully imported ${savedVendors.length} vendor(s)`);

        return res.status(201).json({
            success: true,
            message: savedVendors.length === 1
                ? `Vendor "${savedVendors[0].vendor_name}" imported successfully with code ${savedVendors[0].vendor_code}`
                : `Successfully imported ${savedVendors.length} vendors!`,
            count: savedVendors.length,
            vendor_id: savedVendors[0]?.vendor_id,
            vendor_code: savedVendors[0]?.vendor_code,
            vendors: savedVendors
        });

    } catch (error) {
        await connection.rollback();
        log(`ERROR saving imported vendor: ${error.message}`);
        return res.status(error.message.includes("already exists") ? 409 : 500).json({
            success: false,
            message: error.message.includes("already exists") ? error.message : "Failed to import vendor(s)"
        });
    } finally {
        connection.release();
    }
});

// GET /vendors - Lists all non-blacklisted vendors (oldest first) for vendor dropdowns
app.get("/vendors", verifyProcurement, async (req, res) => {
    try {
        const [rows] = await db.execute(
            `SELECT
                vendor_id,
                vendor_code,
                vendor_name,
                gst_number
             FROM vendor_oem_masters
             WHERE is_blacklisted = FALSE
             ORDER BY vendor_id ASC`
        );
        return res.json({
            success: true,
            vendors: rows
        });
    } catch (error) {
        console.error(error);
        log(`Vendor list fetch failed - ${error.message}`);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch vendors"
        });
    }
});

app.get("/vendors/all", verifyAdmin, async (req, res) => {
    try {
        const [rows] = await db.execute(
            `SELECT * FROM vendor_oem_masters ORDER BY vendor_id ASC`
        );
        return res.json({ success: true, vendors: rows });
    } catch (error) {
        log(`Vendor list (all) fetch failed - ${error.message}`);
        return res.status(500).json({ success: false, message: "Failed to fetch vendors" });
    }
});

// Helper: Build SQL query and parameters for vendor export based on active filters
function buildVendorFilterQuery(req) {
    const search = (req.query.search || "").trim();
    const role = (req.query.role || "").trim();
    const entity = (req.query.entity || "").trim();

    const conditions = [];
    const params = [];

    if (role) {
        conditions.push("commercial_role = ?");
        params.push(role);
    }
    if (entity) {
        conditions.push("legal_entity = ?");
        params.push(entity);
    }
    if (search) {
        conditions.push(`(
            vendor_name LIKE ? OR
            vendor_code LIKE ? OR
            office_contact_name LIKE ? OR
            office_contact_number LIKE ? OR
            director_or_ceo_or_management_name LIKE ? OR
            director_or_ceo_or_management_mobile_no LIKE ? OR
            director_or_ceo_or_management_email LIKE ? OR
            sales_team_name LIKE ? OR
            sales_team_contact LIKE ? OR
            sales_team_email LIKE ? OR
            accounts_team_name LIKE ? OR
            accounts_team_contact LIKE ? OR
            accounts_team_email LIKE ? OR
            gst_number LIKE ? OR
            pan_number LIKE ? OR
            bank_name LIKE ? OR
            office_address LIKE ?
        )`);
        const searchPattern = `%${search}%`;
        for (let i = 0; i < 17; i++) {
            params.push(searchPattern);
        }
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const sql = `SELECT * FROM vendor_oem_masters ${whereClause} ORDER BY vendor_id ASC`;
    return { sql, params, search, role, entity };
}

// GET /vendors/export/excel - Exports complete vendor directory to Excel (.xlsx)
app.get(["/vendors/export/excel", "/api/vendors/export/excel"], verifyProcurement, async (req, res) => {
    try {
        const { sql, params, search, role, entity } = buildVendorFilterQuery(req);
        const [rows] = await db.execute(sql, params);

        const workbook = new ExcelJS.Workbook();
        workbook.creator = "ProcureIQ";
        workbook.created = new Date();

        const sheet = workbook.addWorksheet("Vendor Master", {
            views: [{ state: "frozen", ySplit: 4, showGridLines: true }]
        });

        // 1. Title Banner
        sheet.mergeCells("A1:AY1");
        const titleCell = sheet.getCell("A1");
        titleCell.value = "NIMIT ENGINEERING — VENDOR MASTER & DIRECTORY REPORT";
        titleCell.font = { name: "Segoe UI", size: 14, bold: true, color: { argb: "FFFFFFFF" } };
        titleCell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FF0F172A" }
        };
        titleCell.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
        sheet.getRow(1).height = 36;

        // 2. Subtitle Banner
        sheet.mergeCells("A2:AY2");
        const metaCell = sheet.getCell("A2");
        const now = new Date();
        const dateTag = now.toISOString().slice(0, 10);
        const filterRoleText = role || "All Commercial Roles";
        const filterEntityText = entity || "All Legal Entities";
        const filterSearchText = search ? ` | Search: "${search}"` : "";
        metaCell.value = `Exported: ${now.toLocaleDateString("en-IN")} ${now.toLocaleTimeString("en-IN")} | Role: ${filterRoleText} | Entity: ${filterEntityText}${filterSearchText} | Total Records: ${rows.length}`;
        metaCell.font = { name: "Segoe UI", size: 10, italic: true, color: { argb: "FF334155" } };
        metaCell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFF1F5F9" }
        };
        metaCell.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
        sheet.getRow(2).height = 24;

        sheet.getRow(3).height = 10; // blank row

        // 3. Header Columns
        const columns = [
            { header: "No.", key: "sno", width: 8 },
            { header: "Vendor Code", key: "vendor_code", width: 16 },
            { header: "Vendor Name", key: "vendor_name", width: 32 },
            { header: "Legal Entity", key: "legal_entity", width: 18 },
            { header: "Commercial Role", key: "commercial_role", width: 20 },
            { header: "Incorporation Year", key: "year_of_incorporation", width: 16 },
            { header: "Registration Date", key: "registration_date", width: 16 },
            { header: "GST Number", key: "gst_number", width: 20 },
            { header: "PAN Number", key: "pan_number", width: 16 },
            { header: "MSME Number", key: "msme_number", width: 18 },
            { header: "Office Address", key: "office_address", width: 35 },
            { header: "Office Contact Person", key: "office_contact_name", width: 22 },
            { header: "Office Contact Number", key: "office_contact_number", width: 18 },
            { header: "Management / Director", key: "director_or_ceo_or_management_name", width: 24 },
            { header: "Designation", key: "director_or_ceo_or_management_designation", width: 18 },
            { header: "Management Mobile", key: "director_or_ceo_or_management_mobile_no", width: 18 },
            { header: "Management Email", key: "director_or_ceo_or_management_email", width: 26 },
            { header: "Website", key: "director_or_ceo_or_management_web_address", width: 26 },
            { header: "Sales Contact Name", key: "sales_team_name", width: 22 },
            { header: "Sales Contact Phone", key: "sales_team_contact", width: 18 },
            { header: "Sales Email", key: "sales_team_email", width: 26 },
            { header: "Accounts Contact Name", key: "accounts_team_name", width: 22 },
            { header: "Accounts Contact Phone", key: "accounts_team_contact", width: 18 },
            { header: "Accounts Email", key: "accounts_team_email", width: 26 },
            { header: "Bank Name", key: "bank_name", width: 24 },
            { header: "Bank Branch", key: "bank_branch", width: 20 },
            { header: "Bank Account No.", key: "bank_account_no", width: 22 },
            { header: "IFSC Code", key: "bank_ifsc", width: 16 },
            { header: "Account Type", key: "bank_account_type", width: 16 },
            { header: "Factory Address", key: "factory_address", width: 30 },
            { header: "Factory Contact Person", key: "factory_contact_name", width: 20 },
            { header: "Factory Contact Phone", key: "factory_contact_number", width: 18 },
            { header: "Warehouse Address", key: "warehouse_address", width: 30 },
            { header: "Warehouse Contact Person", key: "warehouse_contact_name", width: 20 },
            { header: "Warehouse Contact Phone", key: "warehouse_contact_number", width: 18 },
            { header: "Workshop Address", key: "workshop_address", width: 30 },
            { header: "Workshop Contact Person", key: "workshop_contact_name", width: 20 },
            { header: "Workshop Contact Phone", key: "workshop_contact_number", width: 18 },
            { header: "Turnover Year 1", key: "turnover_year_1", width: 15 },
            { header: "Turnover Value 1", key: "turnover_value_1", width: 18 },
            { header: "Turnover Year 2", key: "turnover_year_2", width: 15 },
            { header: "Turnover Value 2", key: "turnover_value_2", width: 18 },
            { header: "Turnover Year 3", key: "turnover_year_3", width: 15 },
            { header: "Turnover Value 3", key: "turnover_value_3", width: 18 },
            { header: "Branch 1 Address", key: "branch_office_1_address", width: 26 },
            { header: "Branch 1 Contact", key: "branch_office_1_contact_name", width: 18 },
            { header: "Branch 2 Address", key: "branch_office_2_address", width: 26 },
            { header: "Branch 2 Contact", key: "branch_office_2_contact_name", width: 18 },
            { header: "Branch 3 Address", key: "branch_office_3_address", width: 26 },
            { header: "Branch 3 Contact", key: "branch_office_3_contact_name", width: 18 },
            { header: "Status", key: "status", width: 14 }
        ];

        const headerRow = sheet.getRow(4);
        headerRow.height = 28;
        columns.forEach((col, idx) => {
            const cell = headerRow.getCell(idx + 1);
            cell.value = col.header;
            cell.font = { name: "Segoe UI", size: 10, bold: true, color: { argb: "FFFFFFFF" } };
            cell.fill = {
                type: "pattern",
                pattern: "solid",
                fgColor: { argb: "FF0B57A4" }
            };
            cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
            cell.border = {
                top: { style: "thin", color: { argb: "FF94A3B8" } },
                left: { style: "thin", color: { argb: "FF94A3B8" } },
                bottom: { style: "medium", color: { argb: "FF0F172A" } },
                right: { style: "thin", color: { argb: "FF94A3B8" } }
            };
            sheet.getColumn(idx + 1).width = col.width;
        });

        // 4. Populate rows
        let currentRowIdx = 5;
        rows.forEach((row, idx) => {
            const dataRow = sheet.getRow(currentRowIdx);
            dataRow.height = 22;

            const isEven = idx % 2 === 0;
            const bgArgb = isEven ? "FFFFFFFF" : "FFF8FAFC";

            let regDateStr = "—";
            if (row.registration_date) {
                regDateStr = row.registration_date instanceof Date
                    ? row.registration_date.toISOString().slice(0, 10)
                    : String(row.registration_date).slice(0, 10);
            }

            const values = [
                idx + 1,
                row.vendor_code || "—",
                row.vendor_name || "—",
                row.legal_entity || "—",
                row.commercial_role || "—",
                row.year_of_incorporation || "—",
                regDateStr,
                row.gst_number || "—",
                row.pan_number || "—",
                row.msme_number || "—",
                row.office_address || "—",
                row.office_contact_name || "—",
                row.office_contact_number || "—",
                row.director_or_ceo_or_management_name || "—",
                row.director_or_ceo_or_management_designation || "—",
                row.director_or_ceo_or_management_mobile_no || "—",
                row.director_or_ceo_or_management_email || "—",
                row.director_or_ceo_or_management_web_address || "—",
                row.sales_team_name || "—",
                row.sales_team_contact || "—",
                row.sales_team_email || "—",
                row.accounts_team_name || "—",
                row.accounts_team_contact || "—",
                row.accounts_team_email || "—",
                row.bank_name || "—",
                row.bank_branch || "—",
                row.bank_account_no || "—",
                row.bank_ifsc || "—",
                row.bank_account_type || "—",
                row.factory_address || "—",
                row.factory_contact_name || "—",
                row.factory_contact_number || "—",
                row.warehouse_address || "—",
                row.warehouse_contact_name || "—",
                row.warehouse_contact_number || "—",
                row.workshop_address || "—",
                row.workshop_contact_name || "—",
                row.workshop_contact_number || "—",
                row.turnover_year_1 || "—",
                row.turnover_value_1 || "—",
                row.turnover_year_2 || "—",
                row.turnover_value_2 || "—",
                row.turnover_year_3 || "—",
                row.turnover_value_3 || "—",
                row.branch_office_1_address || "—",
                row.branch_office_1_contact_name || "—",
                row.branch_office_2_address || "—",
                row.branch_office_2_contact_name || "—",
                row.branch_office_3_address || "—",
                row.branch_office_3_contact_name || "—",
                row.is_blacklisted ? "Blacklisted" : "Active"
            ];

            values.forEach((val, colIdx) => {
                const cell = dataRow.getCell(colIdx + 1);
                cell.value = sanitizeExcelCellValue(val);
                cell.font = { name: "Segoe UI", size: 9.5, color: { argb: "FF0F172A" } };
                cell.fill = {
                    type: "pattern",
                    pattern: "solid",
                    fgColor: { argb: bgArgb }
                };
                cell.border = {
                    top: { style: "thin", color: { argb: "FFE2E8F0" } },
                    left: { style: "thin", color: { argb: "FFE2E8F0" } },
                    bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
                    right: { style: "thin", color: { argb: "FFE2E8F0" } }
                };
                cell.alignment = {
                    vertical: "middle",
                    horizontal: colIdx === 0 ? "center" : "left"
                };
            });

            currentRowIdx++;
        });

        if (currentRowIdx > 5) {
            sheet.autoFilter = `A4:AY${currentRowIdx - 1}`;
        }

        const filename = `Vendor_Directory_${dateTag}.xlsx`;
        res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
        await workbook.xlsx.write(res);
        return res.end();
    } catch (error) {
        console.error(error);
        log(`Vendor Excel export failed - ${error.message}`);
        return res.status(500).json({ success: false, message: "Failed to export vendor Excel file" });
    }
});

// GET /vendors/export/pdf - Exports formatted vendor directory report to PDF (.pdf)
app.get(["/vendors/export/pdf", "/api/vendors/export/pdf"], verifyProcurement, async (req, res) => {
    try {
        const { sql, params, search, role, entity } = buildVendorFilterQuery(req);
        const [rows] = await db.execute(sql, params);

        const doc = new PDFDocument({
            size: "A4",
            layout: "landscape",
            margins: { top: 20, bottom: 20, left: 20, right: 20 },
            bufferPages: true
        });

        const now = new Date();
        const dateTag = now.toISOString().slice(0, 10);
        const filename = `Vendor_Directory_${dateTag}.pdf`;

        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
        doc.pipe(res);

        const pageWidth = 841.89;
        const pageHeight = 595.28;
        const marginLeft = 20;
        const contentWidth = pageWidth - (marginLeft * 2); // 801.89 pt

        function drawPageHeader() {
            // 1. Top Header Banner
            doc.rect(marginLeft, 20, contentWidth, 44).fill("#0F172A");

            // Title
            doc.fillColor("#FFFFFF").font("Helvetica-Bold").fontSize(13.5);
            doc.text("PROCUREIQ — VENDOR MASTER DIRECTORY", marginLeft + 14, 28, { width: contentWidth - 28, lineBreak: false });

            // Subtitle
            doc.font("Helvetica").fontSize(8).fillColor("#94A3B8");
            const filterInfo = `Generated: ${now.toLocaleDateString("en-IN")} ${now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}  |  Role: ${role || "All"}  |  Entity: ${entity || "All"}${search ? `  |  Search: "${search}"` : ""}  |  Records: ${rows.length}`;
            doc.text(filterInfo, marginLeft + 14, 46, { width: contentWidth - 28, lineBreak: false });

            // 2. Table Column Header Bar
            const headerY = 72;
            doc.rect(marginLeft, headerY, contentWidth, 24).fill("#1E293B");

            const colDefs = [
                { title: "No.", x: marginLeft + 2, w: 24, align: "center" },
                { title: "Vendor Code", x: marginLeft + 28, w: 70 },
                { title: "Vendor Name & Entity", x: marginLeft + 100, w: 138 },
                { title: "Commercial Role", x: marginLeft + 240, w: 76, align: "center" },
                { title: "Office Contact", x: marginLeft + 318, w: 98 },
                { title: "Email & Contact Person", x: marginLeft + 418, w: 116 },
                { title: "GST / PAN", x: marginLeft + 536, w: 88 },
                { title: "Location", x: marginLeft + 626, w: 92 },
                { title: "Bank Details", x: marginLeft + 720, w: 80 }
            ];

            doc.font("Helvetica-Bold").fontSize(8).fillColor("#FFFFFF");
            colDefs.forEach(c => {
                doc.text(c.title, c.x, headerY + 7.5, { width: c.w, align: c.align || "left", lineBreak: false });
            });

            return headerY + 24; // 96
        }

        function parseLocation(addr) {
            if (!addr) return { line1: "—", line2: "—" };
            const clean = addr.replace(/[\r\n\t]+/g, " ").replace(/\s+/g, " ").trim();
            const parts = clean.split(",").map(s => s.trim()).filter(Boolean);
            if (parts.length >= 2) {
                const line2 = parts.slice(-2).join(", ");
                const line1 = parts.slice(0, -2).join(", ") || parts[0];
                return { line1, line2 };
            }
            const cityMatch = clean.match(/^(.*?)\s+(Vadodara|Ahmedabad|Surat|Mumbai|Delhi|Kiriburu|Jharkhand|Gujarat)(.*)$/i);
            if (cityMatch) {
                return {
                    line1: cityMatch[1].trim(),
                    line2: (cityMatch[2] + " " + cityMatch[3]).trim()
                };
            }
            return { line1: clean, line2: "Office" };
        }

        function parseBank(bank, branch) {
            const bName = (bank || "—").trim();
            const capBank = bName.replace(/\b\w/g, c => c.toUpperCase());
            const bBranch = (branch || "").trim();
            const capBranch = bBranch ? bBranch.replace(/\b\w/g, c => c.toUpperCase()) : "—";
            return { line1: capBank, line2: capBranch };
        }

        let currentY = drawPageHeader();
        const rowHeight = 44;
        const maxY = pageHeight - 38;

        rows.forEach((v, idx) => {
            if (currentY + rowHeight > maxY) {
                doc.addPage();
                currentY = drawPageHeader();
            }

            const isEven = idx % 2 === 0;
            const fillBg = isEven ? "#FFFFFF" : "#F8FAFC";
            doc.rect(marginLeft, currentY, contentWidth, rowHeight).fill(fillBg);
            doc.rect(marginLeft, currentY, contentWidth, rowHeight).strokeColor("#E2E8F0").lineWidth(0.5).stroke();

            // 1. No. (Vertically Centered)
            doc.font("Helvetica").fontSize(8).fillColor("#64748B");
            doc.text(String(idx + 1), marginLeft + 2, currentY + 16, { width: 24, align: "center", lineBreak: false });

            // 2. Vendor Code ONLY (Vertically Centered, NO status / %l Active)
            doc.font("Helvetica-Bold").fontSize(8.5).fillColor("#0B57A4");
            doc.text(v.vendor_code || "—", marginLeft + 28, currentY + 16, { width: 70, lineBreak: false, ellipsis: true });

            // 3. Vendor Name & Legal Entity
            doc.font("Helvetica-Bold").fontSize(8.5).fillColor("#0F172A");
            doc.text(v.vendor_name || "—", marginLeft + 100, currentY + 8, { width: 138, lineBreak: false, ellipsis: true });
            doc.font("Helvetica").fontSize(7).fillColor("#64748B");
            const entityText = [v.legal_entity, v.year_of_incorporation ? `Est. ${v.year_of_incorporation}` : ""].filter(Boolean).join(" • ");
            doc.text(entityText || "—", marginLeft + 100, currentY + 23, { width: 138, lineBreak: false, ellipsis: true });

            // 4. Commercial Role (Vertically Centered)
            doc.font("Helvetica-Bold").fontSize(8).fillColor("#334155");
            doc.text(v.commercial_role || "—", marginLeft + 240, currentY + 16, { width: 76, align: "center", lineBreak: false, ellipsis: true });

            // 5. Office Contact
            doc.font("Helvetica-Bold").fontSize(8).fillColor("#0F172A");
            doc.text(v.office_contact_name || "—", marginLeft + 318, currentY + 8, { width: 98, lineBreak: false, ellipsis: true });
            doc.font("Helvetica").fontSize(7.5).fillColor("#64748B");
            doc.text(v.office_contact_number || "—", marginLeft + 318, currentY + 23, { width: 98, lineBreak: false, ellipsis: true });

            // 6. Key Person & Email
            const mgmtEmail = v.director_or_ceo_or_management_email || v.sales_team_email || "—";
            const mgmtName = v.director_or_ceo_or_management_name || v.sales_team_name || "—";
            doc.font("Helvetica").fontSize(7.5).fillColor("#2563EB");
            doc.text(mgmtEmail, marginLeft + 418, currentY + 8, { width: 116, lineBreak: false, ellipsis: true });
            doc.font("Helvetica").fontSize(7).fillColor("#64748B");
            doc.text(mgmtName, marginLeft + 418, currentY + 23, { width: 116, lineBreak: false, ellipsis: true });

            // 7. GST / PAN
            doc.font("Helvetica-Bold").fontSize(7.5).fillColor("#0F172A");
            doc.text(`GST: ${v.gst_number || "—"}`, marginLeft + 536, currentY + 8, { width: 88, lineBreak: false, ellipsis: true });
            doc.font("Helvetica").fontSize(7).fillColor("#64748B");
            doc.text(`PAN: ${v.pan_number || "—"}`, marginLeft + 536, currentY + 23, { width: 88, lineBreak: false, ellipsis: true });

            // 8. Location (Separated & Dedicated Column)
            const loc = parseLocation(v.office_address);
            doc.font("Helvetica-Bold").fontSize(7.5).fillColor("#0F172A");
            doc.text(loc.line1, marginLeft + 626, currentY + 8, { width: 92, lineBreak: false, ellipsis: true });
            doc.font("Helvetica").fontSize(7).fillColor("#64748B");
            doc.text(loc.line2, marginLeft + 626, currentY + 23, { width: 92, lineBreak: false, ellipsis: true });

            // 9. Bank Details (Separated & Dedicated Column)
            const bank = parseBank(v.bank_name, v.bank_branch);
            doc.font("Helvetica-Bold").fontSize(7.5).fillColor("#0F172A");
            doc.text(bank.line1, marginLeft + 720, currentY + 8, { width: 80, lineBreak: false, ellipsis: true });
            doc.font("Helvetica").fontSize(7).fillColor("#64748B");
            doc.text(bank.line2, marginLeft + 720, currentY + 23, { width: 80, lineBreak: false, ellipsis: true });

            currentY += rowHeight;
        });

        // Small bottom summary bar if space permits
        if (currentY + 24 < maxY) {
            doc.rect(marginLeft, currentY + 4, contentWidth, 18).fill("#F1F5F9");
            doc.font("Helvetica-Bold").fontSize(7.5).fillColor("#475569");
            doc.text(`Total Records: ${rows.length}   •   ProcureIQ Master Vendor Directory`, marginLeft + 12, currentY + 9, { width: contentWidth - 24, align: "left", lineBreak: false });
        }

        // Add page numbers and footer on all buffered pages
        const range = doc.bufferedPageRange();
        for (let i = range.start; i < range.start + range.count; i++) {
            doc.switchToPage(i);
            doc.page.margins.bottom = 0; // Prevent auto page breaks from footer text

            // Footer separator line
            doc.strokeColor("#E2E8F0").lineWidth(0.5);
            doc.moveTo(marginLeft, pageHeight - 22).lineTo(marginLeft + contentWidth, pageHeight - 22).stroke();

            // Footer left
            doc.font("Helvetica").fontSize(7.5).fillColor("#94A3B8");
            doc.text(
                "ProcureIQ Enterprise Procurement Platform  |  NIMIT Engineering",
                marginLeft,
                pageHeight - 15,
                { width: 320, align: "left", lineBreak: false }
            );

            // Footer center
            doc.text(
                "Confidential Document — For Internal Use Only",
                marginLeft + 280,
                pageHeight - 15,
                { width: contentWidth - 560, align: "center", lineBreak: false }
            );

            // Footer right
            doc.text(
                `Page ${i + 1} of ${range.count}`,
                marginLeft + contentWidth - 120,
                pageHeight - 15,
                { width: 120, align: "right", lineBreak: false }
            );
        }

        doc.end();
    } catch (error) {
        console.error(error);
        log(`Vendor PDF export failed - ${error.message}`);
        return res.status(500).json({ success: false, message: "Failed to export vendor PDF file" });
    }
});

// GET /vendor-inquiries - Lists OPEN and VENDOR_SELECTED inquiries
// Excludes inquiries whose PO has been issued/completed/cancelled
app.get("/vendor-inquiries", verifyProcurement, async (req, res) => {
    try {
        const [inquiries] = await db.execute(`
            SELECT
                vi.inquiry_id,
                vi.status AS inquiry_status,
                pr.id AS pr_id,
                pr.pr_number,
                pr.pr_date,
                pr.party_name,
                pr.location,
                pr.territory,
                pr.product_category,
                pr.sub_product_category,
                pr.item_name,
                pr.make,
                pr.model,
                pr.qty,
                pr.unit,
                pr.sales_rate,
                pr.taxable_value,
                pr.product_remarks,
                po.po_id,
                po.po_number,
                po.status AS po_status,
                COUNT(viv.inquiry_vendor_id) AS vendor_count
            FROM vendor_inquiries vi
            INNER JOIN purchase_requests pr ON pr.id = vi.pr_id
            LEFT JOIN purchase_orders po ON po.pr_id = pr.id
            LEFT JOIN vendor_inquiry_vendors viv ON viv.inquiry_id = vi.inquiry_id
            WHERE vi.status IN ('OPEN', 'VENDOR_SELECTED')
            AND (po.po_id IS NULL OR po.status = 'DRAFT')
            GROUP BY
                vi.inquiry_id, vi.status, pr.id, pr.pr_number, pr.pr_date,
                pr.party_name, pr.location, pr.territory, pr.product_category,
                pr.sub_product_category,
                pr.item_name, pr.make, pr.model, pr.qty, pr.unit, pr.sales_rate,
                pr.taxable_value, pr.product_remarks, po.po_id, po.po_number, po.status
            ORDER BY pr.id DESC
        `);
        return res.json({ success: true, inquiries });
    } catch (error) {
        console.error(error);
        log(`Vendor Inquiry fetch failed - ${error.message}`);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch vendor inquiries"
        });
    }
});

// PUT /vendor-inquiries/:inquiry_id/purchase-request
// Edits PR fields on an open or vendor-selected inquiry.
// OPEN: all fields editable.
// VENDOR_SELECTED + DRAFT PO: only non-financial fields editable.
app.put("/vendor-inquiries/:inquiry_id/purchase-request", verifyProcurement, async (req, res) => {
    const inquiryId = Number(req.params.inquiry_id);
    if (!Number.isInteger(inquiryId) || inquiryId <= 0) {
        return res.status(400).json({ success: false, message: "Invalid inquiry ID" });
    }

    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        // Lock the inquiry and its PR, also check PO status
        const [inquiryRows] = await connection.execute(`
            SELECT
                vi.inquiry_id,
                vi.status AS inquiry_status,
                vi.pr_id,
                pr.pr_number,
                pr.pr_date,
                pr.location,
                pr.territory,
                pr.product_category,
                pr.sub_product_category,
                pr.item_name,
                pr.make,
                pr.model,
                pr.qty,
                pr.unit,
                pr.sales_rate,
                pr.taxable_value,
                pr.product_remarks,
                po.po_id,
                po.status AS po_status
            FROM vendor_inquiries vi
            INNER JOIN purchase_requests pr ON pr.id = vi.pr_id
            LEFT JOIN purchase_orders po ON po.pr_id = pr.id
            WHERE vi.inquiry_id = ?
            FOR UPDATE
        `, [inquiryId]);

        if (!inquiryRows.length) {
            await connection.rollback();
            return res.status(404).json({ success: false, message: "Vendor inquiry not found" });
        }

        const row = inquiryRows[0];
        const inquiryStatus = row.inquiry_status;
        const poStatus = row.po_status;

        // Guard: only OPEN and VENDOR_SELECTED (with DRAFT PO) are editable
        if (inquiryStatus !== "OPEN" && inquiryStatus !== "VENDOR_SELECTED") {
            await connection.rollback();
            return res.status(409).json({
                success: false,
                message: "Only OPEN or VENDOR_SELECTED inquiries can be edited"
            });
        }
        if (poStatus && poStatus !== "DRAFT") {
            await connection.rollback();
            return res.status(409).json({
                success: false,
                message: "Cannot edit a purchase request whose PO has already been issued or completed"
            });
        }

        const [quotedRows] = await connection.execute(
            `SELECT COUNT(*) AS cnt FROM vendor_inquiry_vendors WHERE inquiry_id = ?`,
            [inquiryId]
        );
        const hasQuotations = Number(quotedRows[0].cnt) > 0;
        const isOpen = inquiryStatus === "OPEN" && !hasQuotations;

        // Snapshot old values for audit log
        const oldPr = {
            pr_number:        row.pr_number,
            pr_date:          dateText(row.pr_date),
            location:         row.location,
            territory:        row.territory,
            product_category: row.product_category,
            sub_product_category: row.sub_product_category,
            item_name:        row.item_name,
            make:             row.make,
            model:            row.model,
            qty:              row.qty,
            unit:             row.unit,
            sales_rate:       row.sales_rate,
            taxable_value:    row.taxable_value,
            product_remarks:  row.product_remarks
        };

        const {
            // Non-financial — always editable
            location,
            territory,
            product_remarks,
            // Financial — only editable when OPEN
            product_category,
            item_name,
            make,
            model,
            qty,
            unit,
            sales_rate
        } = req.body;

        // Validate non-financial required fields
        if (location !== undefined && !String(location).trim()) {
            await connection.rollback();
            return res.status(400).json({ success: false, message: "Location cannot be empty" });
        }
        if (territory !== undefined && !String(territory).trim()) {
            await connection.rollback();
            return res.status(400).json({ success: false, message: "Territory cannot be empty" });
        }

        // Build the SET clause dynamically
        const updates = [];
        const params  = [];

        // Non-financial fields (always allowed)
        if (location !== undefined)         { updates.push("location = ?");         params.push(cleanValue(location)); }
        if (territory !== undefined)        { updates.push("territory = ?");        params.push(cleanValue(territory)); }
        if (product_remarks !== undefined)  { updates.push("product_remarks = ?");  params.push(cleanValue(product_remarks)); }

        // Financial fields (only when OPEN)
        if (isOpen) {
            if (product_category !== undefined) { updates.push("product_category = ?"); params.push(cleanValue(product_category)); }
            if (req.body.sub_product_category !== undefined) { updates.push("sub_product_category = ?"); params.push(cleanValue(req.body.sub_product_category)); }
            if (item_name !== undefined)        { updates.push("item_name = ?");        params.push(cleanValue(item_name)); }
            if (make !== undefined)             { updates.push("make = ?");             params.push(cleanValue(make)); }
            if (model !== undefined)            { updates.push("model = ?");            params.push(cleanValue(model)); }

            if (qty !== undefined || sales_rate !== undefined) {
                const newQty  = qty !== undefined  ? Number(qty)        : Number(row.qty);
                const newRate = sales_rate !== undefined ? Number(sales_rate) : Number(row.sales_rate);

                if (!Number.isFinite(newQty)  || newQty  <= 0) {
                    await connection.rollback();
                    return res.status(400).json({ success: false, message: "Quantity must be greater than 0" });
                }
                if (!Number.isFinite(newRate) || newRate <= 0) {
                    await connection.rollback();
                    return res.status(400).json({ success: false, message: "Sales rate must be greater than 0" });
                }

                if (qty !== undefined)        { updates.push("qty = ?");           params.push(newQty); }
                if (sales_rate !== undefined) { updates.push("sales_rate = ?");    params.push(newRate); }
                updates.push("taxable_value = ?");
                params.push(newQty * newRate);
            }

            if (unit !== undefined) { updates.push("unit = ?"); params.push(cleanValue(unit)); }
        }

        if (!updates.length) {
            await connection.rollback();
            return res.status(400).json({ success: false, message: "No fields to update" });
        }

        const actor = await getActor(req);
        updates.push("updated_by = ?");
        params.push(actor);

        params.push(row.pr_id);
        await connection.execute(
            `UPDATE purchase_requests SET ${updates.join(", ")} WHERE id = ?`,
            params
        );

        // If financial fields changed on an OPEN inquiry, also update vendor_inquiries remarks
        if (isOpen && product_remarks !== undefined) {
            await connection.execute(
                `UPDATE vendor_inquiries SET remarks = ? WHERE inquiry_id = ?`,
                [cleanValue(product_remarks) || null, inquiryId]
            );
        }

        await connection.commit();

        // Re-read the updated PR for logging
        const [updatedRows] = await db.execute(
            `SELECT * FROM purchase_requests WHERE id = ? LIMIT 1`, [row.pr_id]
        );
        const newPr = updatedRows[0] || {};

        // Build changed-fields list for the report
        const changedFields = Object.keys(oldPr).filter(k => {
            const oldVal = String(oldPr[k] ?? "");
            const newVal = String(k === "taxable_value"
                ? (newPr.taxable_value ?? "")
                : (newPr[k] ?? ""));
            return oldVal !== newVal;
        });

        await writeReportLog(req, "PR_UPDATED",
            `Purchase request ${row.pr_number} updated on ${inquiryStatus} inquiry ${inquiryId}. ` +
            `Editable mode: ${isOpen ? "FULL (inquiry open)" : "RESTRICTED (vendor selected, PO draft)"}. ` +
            `Fields changed: ${changedFields.length ? changedFields.join(", ") : "none"}. ` +
            `Updated values: party name: ${orDash(newPr.party_name)}, location: ${orDash(newPr.location)}, ` +
            `territory: ${orDash(newPr.territory)}, product remarks: ${orDash(newPr.product_remarks)}` +
            (isOpen ? `, item: ${orDash(newPr.item_name)}, make: ${orDash(newPr.make)}, ` +
                `model: ${orDash(newPr.model)}, qty: ${newPr.qty}, unit: ${orDash(newPr.unit)}, ` +
                `sales rate: ${money(newPr.sales_rate)}, taxable value: ${money(newPr.taxable_value)}` : "") + "."
        );

        await writeAuditLog(req, "PR_UPDATED",
            JSON.stringify(oldPr),
            JSON.stringify({
                pr_number:        newPr.pr_number,
                pr_date:          dateText(newPr.pr_date),
                location:         newPr.location,
                territory:        newPr.territory,
                product_category: newPr.product_category,
                sub_product_category: newPr.sub_product_category,
                item_name:        newPr.item_name,
                make:             newPr.make,
                model:            newPr.model,
                qty:              newPr.qty,
                unit:             newPr.unit,
                sales_rate:       newPr.sales_rate,
                taxable_value:    newPr.taxable_value,
                product_remarks:  newPr.product_remarks
            })
        );

        log(`PR updated via inquiry edit - Inquiry: ${inquiryId}, PR: ${row.pr_number}`);

        return res.json({
            success: true,
            message: "Purchase request updated successfully",
            pr_number: row.pr_number,
            edit_mode: isOpen ? "full" : "restricted"
        });

    } catch (error) {
        await connection.rollback();
        console.error(error);
        log(`PR edit via inquiry failed - ${error.message}`);
        return res.status(500).json({ success: false, message: "Failed to update purchase request" });
    } finally {
        connection.release();
    }
});

// GET /vendor-inquiries/:inquiry_id - Returns one OPEN inquiry with all vendor quotations added to it so far
app.get("/vendor-inquiries/:inquiry_id", verifyProcurement, async (req, res) => {
    const inquiryId = Number(req.params.inquiry_id);
    if (!Number.isInteger(inquiryId) || inquiryId <= 0) {
        return res.status(400).json({ success: false, message: "Invalid inquiry ID" });
    }
    try {
        const [inquiries] = await db.execute(`
            SELECT
                vi.inquiry_id,
                vi.pr_id,
                pr.pr_number,
                pr.party_name,
                pr.item_name,
                pr.make,
                pr.model,
                pr.qty,
                pr.unit,
                vi.remarks
            FROM vendor_inquiries vi
            INNER JOIN purchase_requests pr ON vi.pr_id = pr.id
            WHERE vi.inquiry_id = ? AND vi.status IN ('OPEN', 'VENDOR_SELECTED')
            LIMIT 1
        `, [inquiryId]);
        if (inquiries.length === 0)return res.status(404).json({ success: false, message: "Open Vendor Inquiry not found" });
        const [vendors] = await db.execute(`
            SELECT
                viv.inquiry_vendor_id,
                viv.vendor_id,
                vom.vendor_code,
                vom.vendor_name,
                viv.price_per_unit,
                viv.total_price,
                viv.expected_delivery_date,
                viv.payment_type,
                viv.advance_type,
                viv.advance_value,
                COALESCE(
                    viv.advance_amount,
                    CASE
                        WHEN viv.advance_type = 'FIXED_AMOUNT' THEN viv.advance_value
                        WHEN viv.advance_type = 'PERCENTAGE' AND viv.advance_value IS NOT NULL AND viv.total_price IS NOT NULL
                            THEN ROUND((viv.advance_value / 100.0) * viv.total_price, 2)
                        ELSE NULL
                    END
                ) AS advance_amount,
                viv.balance_due_days,
                viv.payment_terms_remarks,
                COALESCE(viv.remarks, viv.payment_terms_remarks) AS remarks
            FROM vendor_inquiry_vendors viv
            INNER JOIN vendor_oem_masters vom ON viv.vendor_id = vom.vendor_id
            WHERE viv.inquiry_id = ?
            ORDER BY viv.inquiry_vendor_id DESC
        `, [inquiryId]);
        return res.json({ success: true, inquiry: inquiries[0], vendors });
    } catch (error) {
        console.error(error);
        log(`Vendor Inquiry details fetch failed - ${error.message}`);
        return res.status(500).json({ success: false, message: "Failed to fetch Vendor Inquiry details" });
    }
});

// POST /vendor-inquiries/:inquiry_id/vendors
// Adds a vendor's quotation to an OPEN or VENDOR_SELECTED inquiry
// Allowed only while the related PO is still DRAFT (or does not exist)
app.post("/vendor-inquiries/:inquiry_id/vendors", verifyProcurement, async (req, res) => {
    const inquiryId = Number(req.params.inquiry_id);

    const {
        vendor_id,
        price_per_unit,
        expected_delivery_date,
        payment_type,
        advance_type,
        advance_value,
        balance_due_days,
        payment_terms_remarks,
        remarks
    } = req.body;

    if (!Number.isInteger(inquiryId) || inquiryId <= 0) {
        return res.status(400).json({
            success: false,
            message: "Invalid inquiry ID"
        });
    }

    const vendorId = Number(vendor_id);
    const price = Number(price_per_unit);

    if (!Number.isInteger(vendorId) || vendorId <= 0) {
        return res.status(400).json({
            success: false,
            message: "Please select a valid vendor"
        });
    }

    if (
        price_per_unit === undefined ||
        price_per_unit === null ||
        String(price_per_unit).trim() === "" ||
        !Number.isFinite(price) ||
        price <= 0
    ) {
        return res.status(400).json({
            success: false,
            message: "Price per unit must be greater than 0"
        });
    }

    const validPaymentTypes = [
        "ADVANCE",
        "CREDIT",
        "ADVANCE_PLUS_BALANCE",
        "CUSTOM"
    ];

    if (!payment_type || !validPaymentTypes.includes(payment_type)) {
        return res.status(400).json({
            success: false,
            message: "Please select a valid payment type"
        });
    }

    if (["ADVANCE", "ADVANCE_PLUS_BALANCE"].includes(payment_type)) {
        if (
            !advance_type ||
            !["PERCENTAGE", "FIXED_AMOUNT"].includes(advance_type)
        ) {
            return res.status(400).json({
                success: false,
                message: "Advance type is required for this payment type"
            });
        }

        if (!advance_value || Number(advance_value) <= 0) {
            return res.status(400).json({
                success: false,
                message: "Advance value is required for this payment type"
            });
        }
    }

    const connection = await db.getConnection();

    try {
        await connection.beginTransaction();

        // Get inquiry, PR and PO status.
        // Vendor quotations can be added when inquiry is OPEN
        // or VENDOR_SELECTED, but only while the PO is DRAFT.
        const [inquiryRows] = await connection.execute(`
            SELECT
                vi.inquiry_id,
                vi.status AS inquiry_status,
                vi.pr_id,
                pr.qty,
                pr.pr_number,
                pr.item_name,
                pr.make,
                pr.model,
                pr.unit,
                po.po_id,
                po.status AS po_status
            FROM vendor_inquiries vi
            INNER JOIN purchase_requests pr
                ON vi.pr_id = pr.id
            LEFT JOIN purchase_orders po
                ON po.pr_id = pr.id
            WHERE vi.inquiry_id = ?
            FOR UPDATE
        `, [inquiryId]);

        if (inquiryRows.length === 0) {
            await connection.rollback();

            return res.status(404).json({
                success: false,
                message: "Vendor inquiry not found"
            });
        }

        const inquiry = inquiryRows[0];

        // Allow adding vendors to both OPEN and VENDOR_SELECTED inquiries.
        if (!["OPEN", "VENDOR_SELECTED"].includes(inquiry.inquiry_status)) {
            await connection.rollback();

            return res.status(409).json({
                success: false,
                message: "Vendor quotation cannot be added to this inquiry"
            });
        }

        // Once the PO is issued/completed, no more vendors can be added.
        // If there is no PO yet, this is also allowed.
        if (inquiry.po_status && inquiry.po_status !== "DRAFT") {
            await connection.rollback();

            return res.status(409).json({
                success: false,
                message: "Cannot add a vendor after the Purchase Order has been issued"
            });
        }

        // Check that the vendor exists and is not blacklisted.
        const [vendorRows] = await connection.execute(`
            SELECT
                vendor_id,
                vendor_name,
                vendor_code
            FROM vendor_oem_masters
            WHERE vendor_id = ?
              AND is_blacklisted = FALSE
            LIMIT 1
        `, [vendorId]);

        if (vendorRows.length === 0) {
            await connection.rollback();

            return res.status(400).json({
                success: false,
                message: "Vendor does not exist or is blacklisted"
            });
        }

        // Prevent the same vendor from being added twice
        // to the same inquiry.
        const [existingRows] = await connection.execute(`
            SELECT inquiry_vendor_id
            FROM vendor_inquiry_vendors
            WHERE inquiry_id = ?
              AND vendor_id = ?
            LIMIT 1
        `, [inquiryId, vendorId]);

        if (existingRows.length > 0) {
            await connection.rollback();

            return res.status(409).json({
                success: false,
                message: "This vendor has already been added to the inquiry"
            });
        }

        // Calculate total quotation price.
        const qty = Number(inquiry.qty);
        const totalPrice = qty * price;

        let advanceAmount = null;

        if (advance_value && Number(advance_value) > 0) {
            if (advance_type === "FIXED_AMOUNT") {
                advanceAmount = parseFloat(Number(advance_value).toFixed(2));
            } else {
                advanceAmount = parseFloat(
                    ((Number(advance_value) / 100) * totalPrice).toFixed(2)
                );
            }
        }

        const finalRemarks = (remarks || "").trim() || (payment_terms_remarks || "").trim() || null;
        const finalPaymentRemarks = (payment_terms_remarks || "").trim() || (remarks || "").trim() || null;

        if (!Number.isFinite(totalPrice)) {
            await connection.rollback();

            return res.status(400).json({
                success: false,
                message: "Calculated total price is invalid"
            });
        }

        // Insert vendor quotation.
        const [result] = await connection.execute(`
            INSERT INTO vendor_inquiry_vendors
            (
                inquiry_id,
                vendor_id,
                price_per_unit,
                total_price,
                expected_delivery_date,
                payment_type,
                advance_type,
                advance_value,
                advance_amount,
                balance_due_days,
                payment_terms_remarks,
                is_selected,
                remarks
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, FALSE, ?)
        `, [
            inquiryId,
            vendorId,
            price,
            totalPrice,
            expected_delivery_date || null,
            payment_type,
            advance_type || null,
            advance_value ? Number(advance_value) : null,
            advanceAmount,
            balance_due_days ? Number(balance_due_days) : null,
            finalPaymentRemarks,
            finalRemarks
        ]);

        await connection.commit();

        log(
            `Vendor added to Inquiry - Inquiry ID: ${inquiryId}, Vendor ID: ${vendorId}`
        );

        const vendorRow = vendorRows[0];

        // Report log
        await writeReportLog(
            req,
            "VENDOR_QUOTATION_ADDED",
            `Vendor "${vendorRow.vendor_name}" (${orDash(vendorRow.vendor_code)}) added to vendor inquiry ${inquiryId} for ${inquiry.pr_number} with a quotation. ` +
            `Item: ${orDash(inquiry.item_name)}, make: ${orDash(inquiry.make)}, model: ${orDash(inquiry.model)}, quantity: ${qty} ${orDash(inquiry.unit)}. ` +
            `Quoted price per unit: ${money(price)}, total price: ${money(totalPrice)}. ` +
            `Expected delivery: ${dateText(expected_delivery_date)}. ` +
            `${describePayment({
                payment_type,
                advance_type,
                advance_value,
                balance_due_days,
                payment_terms_remarks
            })}` +
            `${advanceAmount !== null
                ? `, advance amount: ${money(advanceAmount)}`
                : ""}. ` +
            `Remarks: ${orDash(remarks)}.`
        );

        return res.status(201).json({
            success: true,
            message: "Vendor quotation added successfully",
            inquiry_vendor_id: result.insertId,
            total_price: totalPrice
        });

    } catch (error) {
        await connection.rollback();

        console.error(error);

        log(`Vendor quotation addition failed - ${error.message}`);

        return res.status(500).json({
            success: false,
            message: "Failed to add vendor quotation"
        });

    } finally {
        connection.release();
    }
});

// POST /vendor-inquiries/:inquiry_id/cancel
// Cancels an OPEN inquiry (with or without quotations). Not allowed once a PO exists.
app.post("/vendor-inquiries/:inquiry_id/cancel", verifyManager, async (req, res) => {
    const inquiryId = Number(req.params.inquiry_id);
    const { reason } = req.body;

    if (!Number.isInteger(inquiryId) || inquiryId <= 0) {
        return res.status(400).json({ success: false, message: "Invalid inquiry ID" });
    }
    if (!reason || !String(reason).trim()) {
        return res.status(400).json({ success: false, message: "Cancellation reason is required" });
    }

    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        const [rows] = await connection.execute(`
            SELECT
                vi.inquiry_id,
                vi.status AS inquiry_status,
                vi.pr_id,
                pr.pr_number,
                pr.item_name,
                pr.make,
                pr.model,
                pr.qty,
                pr.unit,
                po.po_id,
                po.po_number,
                po.status AS po_status
            FROM vendor_inquiries vi
            INNER JOIN purchase_requests pr ON pr.id = vi.pr_id
            LEFT JOIN purchase_orders po ON po.pr_id = pr.id
            WHERE vi.inquiry_id = ?
            FOR UPDATE
        `, [inquiryId]);

        if (!rows.length) {
            await connection.rollback();
            return res.status(404).json({ success: false, message: "Inquiry not found" });
        }

        const row = rows[0];

        if (row.inquiry_status === "CLOSED" || row.inquiry_status === "CANCELLED") {
            await connection.rollback();
            return res.status(409).json({ success: false, message: "Inquiry is already closed or cancelled" });
        }

        // If a PO exists at all, cancellation must go through the PO page
        if (row.po_id) {
            await connection.rollback();
            return res.status(409).json({
                success: false,
                message: `A Purchase Order (${row.po_number}) already exists for this inquiry. Cancel the PO from the Purchase Orders page instead.`
            });
        }

        await connection.execute(
            `UPDATE vendor_inquiries SET status = 'CANCELLED' WHERE inquiry_id = ?`,
            [inquiryId]
        );

        await connection.commit();

        await writeReportLog(req, "INQUIRY_CANCELLED",
            `Vendor inquiry ${inquiryId} for ${row.pr_number} cancelled. ` +
            `Item: ${orDash(row.item_name)}, make: ${orDash(row.make)}, ` +
            `model: ${orDash(row.model)}, quantity: ${Number(row.qty)} ${orDash(row.unit)}. ` +
            `No PO existed. Reason: ${String(reason).trim()}.`
        );

        log(`Inquiry cancelled - Inquiry ID: ${inquiryId}, PR: ${row.pr_number}`);

        return res.json({
            success: true,
            message: "Inquiry cancelled. Please raise a new Purchase Request with the updated details.",
            pr_number: row.pr_number
        });

    } catch (error) {
        await connection.rollback();
        console.error(error);
        log(`Inquiry cancellation failed - ${error.message}`);
        return res.status(500).json({ success: false, message: "Failed to cancel inquiry" });
    } finally {
        connection.release();
    }
});

// GET /quotation-comparisons - Lists all OPEN inquiries with every vendor quotation (cheapest first) for side-by-side comparison
app.get("/quotation-comparisons", verifyProcurement, async (req, res) => {
    try {
        const [inquiries] = await db.execute(`
            SELECT
                vi.inquiry_id,
                pr.id AS pr_id,
                pr.pr_number,
                pr.pr_date,
                pr.party_name,
                pr.location,
                pr.territory,
                pr.product_category,
                pr.sub_product_category,
                pr.item_name,
                pr.make,
                pr.model,
                pr.qty,
                pr.unit,
                pr.sales_rate,
                pr.taxable_value,
                pr.product_remarks
            FROM vendor_inquiries vi
            INNER JOIN purchase_requests pr
                ON pr.id = vi.pr_id
            WHERE vi.status = 'OPEN'
            ORDER BY pr.id DESC
        `);
        if (!inquiries.length)return res.json({ success: true, inquiries: [] });
        const inquiryIds = inquiries.map(i => i.inquiry_id);
        const [vendors] = await db.execute(`
            SELECT
                viv.inquiry_vendor_id,
                viv.inquiry_id,
                viv.vendor_id,
                vom.vendor_code,
                vom.vendor_name,
                viv.price_per_unit,
                viv.total_price,
                viv.advance_type,
                viv.advance_value,
                COALESCE(
                    viv.advance_amount,
                    CASE
                        WHEN viv.advance_type = 'FIXED_AMOUNT' THEN viv.advance_value
                        WHEN viv.advance_type = 'PERCENTAGE' AND viv.advance_value IS NOT NULL AND viv.total_price IS NOT NULL
                            THEN ROUND((viv.advance_value / 100.0) * viv.total_price, 2)
                        ELSE NULL
                    END
                ) AS advance_amount,
                viv.expected_delivery_date,
                viv.balance_due_days,
                viv.payment_type,
                viv.is_selected,
                viv.payment_terms_remarks,
                COALESCE(viv.remarks, viv.payment_terms_remarks) AS remarks
            FROM vendor_inquiry_vendors viv
            INNER JOIN vendor_oem_masters vom
                ON viv.vendor_id = vom.vendor_id
            WHERE viv.inquiry_id IN (${inquiryIds.map(() => "?").join(",")})
            ORDER BY viv.inquiry_id, viv.price_per_unit ASC
        `, inquiryIds);
        const vendorMap = {};
        vendors.forEach(v => {
            if (!vendorMap[v.inquiry_id]) vendorMap[v.inquiry_id] = [];
            vendorMap[v.inquiry_id].push(v);
        });
        const result = inquiries.map(inq => ({...inq,vendors: vendorMap[inq.inquiry_id] || []}));
        return res.json({ success: true, inquiries: result });
    } catch (error) {
        console.error(error);
        log(`Quotation comparison fetch failed - ${error.message}`);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch quotation comparisons"
        });
    }
});

// POST /vendor-inquiries/:inquiry_id/select-vendor - Finalizes the chosen vendor quotation and creates a DRAFT purchase order from it
app.post("/vendor-inquiries/:inquiry_id/select-vendor", verifyProcurement, async (req, res) => {
    const inquiryId = Number(req.params.inquiry_id);
    const { inquiry_vendor_id } = req.body;
    if (!Number.isInteger(inquiryId) || inquiryId <= 0)return res.status(400).json({ success: false, message: "Invalid inquiry ID" });
    const inquiryVendorId = Number(inquiry_vendor_id);
    if (!Number.isInteger(inquiryVendorId) || inquiryVendorId <= 0)return res.status(400).json({ success: false, message: "Please select a valid vendor quotation" });
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();
        const [inquiryRows] = await connection.execute(`
            SELECT vi.inquiry_id, vi.status, vi.pr_id
            FROM vendor_inquiries vi
            WHERE vi.inquiry_id = ?
            FOR UPDATE
        `, [inquiryId]);
        if (inquiryRows.length === 0) {
            await connection.rollback();
            return res.status(404).json({ success: false, message: "Vendor Inquiry not found" });
        }
        if (inquiryRows[0].status !== "OPEN") {
            await connection.rollback();
            return res.status(409).json({ success: false, message: "A vendor has already been selected for this inquiry" });
        }
        const prId = inquiryRows[0].pr_id;
        const [vendorRows] = await connection.execute(`
            SELECT
                viv.inquiry_vendor_id,
                viv.vendor_id,
                viv.price_per_unit,
                viv.total_price,
                viv.expected_delivery_date,
                viv.payment_type,
                viv.advance_type,
                viv.advance_value,
                viv.balance_due_days,
                viv.payment_terms_remarks,
                viv.remarks,
                vom.vendor_code,
                vom.vendor_name,
                vom.office_address,
                vom.office_contact_name,
                vom.office_contact_number
            FROM vendor_inquiry_vendors viv
            INNER JOIN vendor_oem_masters vom ON vom.vendor_id = viv.vendor_id
            WHERE viv.inquiry_vendor_id = ? AND viv.inquiry_id = ?
            LIMIT 1
        `, [inquiryVendorId, inquiryId]);
        if (vendorRows.length === 0) {
            await connection.rollback();
            return res.status(404).json({ success: false, message: "Vendor quotation not found for this inquiry" });
        }
        const [prRows] = await connection.execute(`
            SELECT * FROM purchase_requests WHERE id = ? LIMIT 1
        `, [prId]);
        if (prRows.length === 0) {
            await connection.rollback();
            return res.status(404).json({ success: false, message: "Purchase request not found" });
        }
        const [quotationRows] = await connection.execute(`
            SELECT vom.vendor_name, viv.price_per_unit, viv.total_price
            FROM vendor_inquiry_vendors viv
            INNER JOIN vendor_oem_masters vom ON vom.vendor_id = viv.vendor_id
            WHERE viv.inquiry_id = ?
            ORDER BY viv.price_per_unit ASC
        `, [inquiryId]);
        const viv = vendorRows[0];
        const pr  = prRows[0];
        const contactLine = [viv.office_contact_name, viv.office_contact_number].filter(Boolean).join(" - ");
        const vendorAddress = [viv.office_address, contactLine].filter(Boolean).join("\n");
        await connection.execute(`
            UPDATE vendor_inquiry_vendors SET is_selected = FALSE WHERE inquiry_id = ?
        `, [inquiryId]);
        await connection.execute(`
            UPDATE vendor_inquiry_vendors SET is_selected = TRUE WHERE inquiry_vendor_id = ?
        `, [inquiryVendorId]);
        await connection.execute(`
            UPDATE vendor_inquiries SET status = 'VENDOR_SELECTED' WHERE inquiry_id = ?
        `, [inquiryId]);
        const poNumber = await generatePoNumber(connection, pr.pr_number);
        const poDate   = new Date().toISOString().split("T")[0];
        await connection.execute(`
            INSERT INTO purchase_orders (
                po_number,
                po_date,
                pr_id,
                inquiry_id,
                inquiry_vendor_id,
                vendor_id,
                pr_number,
                pr_date,
                party_name,
                location,
                territory,
                product_category,
                sub_product_category,
                item_name,
                product_remarks,
                make,
                model,
                qty,
                unit,
                sales_rate,
                taxable_value,
                vendor_code,
                vendor_name,
                vendor_address,
                price_per_unit,
                total_price,
                expected_delivery_date,
                payment_type,
                advance_type,
                advance_value,
                balance_due_days,
                payment_terms_remarks,
                status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'DRAFT')
        `, [
            poNumber,
            poDate,
            prId,
            inquiryId,
            inquiryVendorId,
            viv.vendor_id,
            pr.pr_number,
            pr.pr_date,
            pr.party_name,
            pr.location,
            pr.territory,
            pr.product_category,
            pr.sub_product_category || null,
            pr.item_name,
            pr.product_remarks,
            pr.make,
            pr.model,
            pr.qty,
            pr.unit,
            pr.sales_rate,
            pr.taxable_value,
            viv.vendor_code,
            viv.vendor_name,
            vendorAddress,
            viv.price_per_unit,
            viv.total_price,
            viv.expected_delivery_date || null,
            viv.payment_type,
            viv.advance_type || null,
            viv.advance_value || null,
            viv.balance_due_days || null,
            viv.payment_terms_remarks || null
        ]);
        await connection.commit();
        log(`Vendor selected and PO created - Inquiry ID: ${inquiryId}, PO: ${poNumber}`);
        const comparison = quotationRows.map((q, i) => `${i + 1}. ${q.vendor_name} - ${money(q.price_per_unit)} per unit (total ${money(q.total_price)})`).join("; ");
        const grossProfit = Number(pr.taxable_value || 0) - Number(viv.total_price || 0);
        await writeReportLog(req, "VENDOR_SELECTED",
            `Quotation finalized for vendor inquiry ${inquiryId} (${pr.pr_number}). ` +
            `${quotationRows.length} quotation(s) compared, cheapest first: ${comparison}. ` +
            `Selected vendor: "${viv.vendor_name}" (${orDash(viv.vendor_code)}) at ${money(viv.price_per_unit)} per unit, total ${money(viv.total_price)}. ` +
            `Item: ${orDash(pr.item_name)}, make: ${orDash(pr.make)}, model: ${orDash(pr.model)}, quantity: ${Number(pr.qty)} ${orDash(pr.unit)}. ` +
            `Sales taxable value: ${money(pr.taxable_value)}, expected gross profit: ${money(grossProfit)}. ` +
            `Inquiry status changed from OPEN to VENDOR_SELECTED.`
        );
        await writeReportLog(req, "PO_CREATED",
            `Draft purchase order ${poNumber} dated ${poDate} created from ${pr.pr_number} (inquiry ID ${inquiryId}). ` +
            `Vendor: "${viv.vendor_name}" (${orDash(viv.vendor_code)}). Party: "${orDash(pr.party_name)}" (${orDash(pr.location)}, ${orDash(pr.territory)}). ` +
            `Item: ${orDash(pr.item_name)}, make: ${orDash(pr.make)}, model: ${orDash(pr.model)}, quantity: ${Number(pr.qty)} ${orDash(pr.unit)}. ` +
            `Price per unit: ${money(viv.price_per_unit)}, PO total: ${money(viv.total_price)}. ` +
            `Expected delivery: ${dateText(viv.expected_delivery_date)}. ${describePayment(viv)}. Status: DRAFT.`
        );
        return res.json({
            success: true,
            message: "Vendor selected successfully",
            vendor_id: viv.vendor_id,
            po_number: poNumber
        });

    } catch (error) {
        await connection.rollback();
        console.error(error);
        log(`Vendor selection failed - ${error.message}`);
        return res.status(500).json({ success: false, message: "Failed to select vendor" });
    } finally {
        connection.release();
    }
});

/* ==========================================================================
   TAB: PURCHASE ORDERS
   ========================================================================== */

// GET /purchase-orders - Lists all purchase orders (newest first) with full vendor master details and quotation remarks
app.get("/purchase-orders", verifyProcurement, async (req, res) => {
    try {
        const [rows] = await db.execute(`
            SELECT
                po.po_id,
                po.po_number,
                po.po_date,
                po.pr_number,
                po.pr_date,
                po.party_name,
                po.location,
                po.territory,
                po.product_category,
                po.sub_product_category,
                po.item_name,
                po.product_remarks,
                po.make,
                po.model,
                po.qty,
                po.unit,
                po.sales_rate,
                po.taxable_value,
                po.vendor_id,
                vom.vendor_code,
                vom.vendor_name,
                po.vendor_address,
                po.price_per_unit,
                po.total_price,
                po.expected_delivery_date,
                po.payment_type,
                po.advance_type,
                po.advance_value,
                po.balance_due_days,
                po.payment_terms_remarks,
                po.status,
                vom.registration_date,
                vom.legal_entity,
                vom.commercial_role,
                vom.year_of_incorporation,
                vom.office_address,
                vom.office_contact_name,
                vom.office_contact_number,
                vom.factory_address,
                vom.factory_contact_name,
                vom.factory_contact_number,
                vom.warehouse_address,
                vom.warehouse_contact_name,
                vom.warehouse_contact_number,
                vom.workshop_address,
                vom.workshop_contact_name,
                vom.workshop_contact_number,
                CONCAT_WS(' - ',
                    vom.office_address,
                    vom.office_contact_name,
                    vom.office_contact_number
                ) AS office_address_and_phone,
                CONCAT_WS(' - ',
                    vom.factory_address,
                    vom.factory_contact_name,
                    vom.factory_contact_number
                ) AS factory_address_and_phone,
                CONCAT_WS(' - ',
                    vom.warehouse_address,
                    vom.warehouse_contact_name,
                    vom.warehouse_contact_number
                ) AS warehouse_address_and_phone,
                CONCAT_WS(' - ',
                    vom.workshop_address,
                    vom.workshop_contact_name,
                    vom.workshop_contact_number
                ) AS workshop_address_and_phone,
                vom.director_or_ceo_or_management_name,
                vom.director_or_ceo_or_management_designation,
                vom.director_or_ceo_or_management_mobile_no,
                vom.director_or_ceo_or_management_email,
                vom.director_or_ceo_or_management_web_address,
                vom.sales_team_name,
                vom.sales_team_contact,
                vom.sales_team_email,
                vom.accounts_team_name,
                vom.accounts_team_contact,
                vom.accounts_team_email,
                vom.gst_number,
                vom.pan_number,
                vom.msme_number,
                vom.bank_name,
                vom.bank_account_no,
                vom.bank_branch,
                vom.bank_account_type,
                vom.bank_ifsc,
                CONCAT_WS(' - ',
                    vom.bank_name,
                    vom.bank_account_no,
                    vom.bank_branch,
                    vom.bank_account_type,
                    vom.bank_ifsc
                ) AS bank_details,
                vom.branch_office_1_address,
                vom.branch_office_1_contact_name,
                vom.branch_office_1_contact_number,
                CONCAT_WS(' - ',
                    vom.branch_office_1_address,
                    vom.branch_office_1_contact_name,
                    vom.branch_office_1_contact_number
                ) AS branch_office_1,
                vom.branch_office_2_address,
                vom.branch_office_2_contact_name,
                vom.branch_office_2_contact_number,
                CONCAT_WS(' - ',
                    vom.branch_office_2_address,
                    vom.branch_office_2_contact_name,
                    vom.branch_office_2_contact_number
                ) AS branch_office_2,
                vom.branch_office_3_address,
                vom.branch_office_3_contact_name,
                vom.branch_office_3_contact_number,
                CONCAT_WS(' - ',
                    vom.branch_office_3_address,
                    vom.branch_office_3_contact_name,
                    vom.branch_office_3_contact_number
                ) AS branch_office_3,
                vom.turnover_year_1,
                vom.turnover_value_1,
                vom.turnover_year_2,
                vom.turnover_value_2,
                vom.turnover_year_3,
                vom.turnover_value_3,
                vom.recommended_by,
                vom.approved_by,
                vom.client_details,
                vom.is_blacklisted,
                viv.remarks AS quotation_remarks
            FROM purchase_orders po
            LEFT JOIN vendor_oem_masters vom
                ON vom.vendor_id = po.vendor_id
            LEFT JOIN vendor_inquiry_vendors viv
                ON viv.inquiry_vendor_id = po.inquiry_vendor_id
            ORDER BY po.po_id DESC
        `);
        return res.json({
            success: true,
            purchase_orders: rows
        });
    } catch (error) {
        console.error(error);
        log(`Purchase order fetch failed - ${error.message}`);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch purchase orders"
        });
    }
});

// GET /purchase-orders/export - Export purchase orders matching applied filters as real Excel (.xlsx) with full PR and Vendor details
app.get(["/purchase-orders/export", "/api/purchase-orders/export"], verifyProcurement, async (req, res) => {
    const statusParam = (req.query.status || "").trim().toUpperCase();
    const searchParam = (req.query.search || "").trim();
    const partyParam = (req.query.party || req.query.vendor || "").trim();
    const singleDate = (req.query.date || "").trim();
    const fromDate = (req.query.from_date || req.query.from || singleDate).trim();
    const toDate = (req.query.to_date || req.query.to || singleDate).trim();

    try {
        const whereClauses = [];
        const params = [];

        if (statusParam && statusParam !== "ALL") {
            whereClauses.push("po.status = ?");
            params.push(statusParam);
        }

        if (partyParam && partyParam !== "ALL") {
            whereClauses.push("(po.party_name = ? OR po.vendor_name = ? OR vom.vendor_name = ?)");
            params.push(partyParam, partyParam, partyParam);
        }

        if (searchParam) {
            whereClauses.push("(po.po_number LIKE ? OR po.pr_number LIKE ? OR po.party_name LIKE ? OR po.vendor_name LIKE ? OR vom.vendor_name LIKE ? OR po.item_name LIKE ? OR po.make LIKE ? OR po.model LIKE ?)");
            const wild = `%${searchParam}%`;
            params.push(wild, wild, wild, wild, wild, wild, wild, wild);
        }

        if (fromDate) {
            if (!isRealDate(fromDate)) {
                return res.status(400).json({ success: false, message: "Invalid from_date format (YYYY-MM-DD required)" });
            }
            whereClauses.push("COALESCE(po.po_date, DATE(po.created_at)) >= ?");
            params.push(fromDate);
        }

        if (toDate) {
            if (!isRealDate(toDate)) {
                return res.status(400).json({ success: false, message: "Invalid to_date format (YYYY-MM-DD required)" });
            }
            whereClauses.push("COALESCE(po.po_date, DATE(po.created_at)) <= ?");
            params.push(toDate);
        }

        const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";

        const [rows] = await db.query(`
            SELECT
                po.po_id,
                po.po_number,
                po.po_date,
                po.status AS po_status,
                po.pr_id,
                po.pr_number,
                po.pr_date,
                po.party_name,
                po.location,
                po.territory,
                po.product_category,
                po.sub_product_category,
                po.item_name,
                po.product_remarks,
                po.make,
                po.model,
                po.qty,
                po.unit,
                po.sales_rate,
                po.taxable_value,
                po.vendor_id,
                COALESCE(po.vendor_code, vom.vendor_code) AS vendor_code,
                COALESCE(po.vendor_name, vom.vendor_name) AS vendor_name,
                COALESCE(po.vendor_address, vom.office_address) AS vendor_address,
                po.price_per_unit,
                po.total_price,
                po.expected_delivery_date,
                po.payment_type,
                po.advance_type,
                po.advance_value,
                po.balance_due_days,
                po.payment_terms_remarks,
                po.created_at,
                vom.commercial_role,
                vom.legal_entity,
                vom.gst_number,
                vom.pan_number,
                vom.msme_number,
                vom.office_contact_name,
                vom.office_contact_number,
                vom.sales_team_email,
                viv.remarks AS quotation_remarks,
                GREATEST(0, COALESCE((SELECT SUM(gr.received_quantity) FROM goods_received gr WHERE gr.po_id = po.po_id), 0) - COALESCE((SELECT SUM(ret.return_quantity) FROM goods_returns ret WHERE ret.po_id = po.po_id), 0)) AS total_received,
                (SELECT MAX(gr.received_date) FROM goods_received gr WHERE gr.po_id = po.po_id) AS last_received_date
            FROM purchase_orders po
            LEFT JOIN vendor_oem_masters vom ON vom.vendor_id = po.vendor_id
            LEFT JOIN vendor_inquiry_vendors viv ON viv.inquiry_vendor_id = po.inquiry_vendor_id
            LEFT JOIN purchase_requests pr ON pr.id = po.pr_id
            ${whereSql}
            ORDER BY po.po_id DESC
        `, params);

        const workbook = new ExcelJS.Workbook();
        workbook.creator = "ProcureIQ Enterprise";
        workbook.lastModifiedBy = "ProcureIQ Enterprise";
        workbook.created = new Date();
        workbook.modified = new Date();

        const sheet = workbook.addWorksheet("Purchase Orders", {
            views: [{ state: "frozen", ySplit: 4, showGridLines: true }],
            properties: { defaultRowHeight: 22 }
        });

        // 1. Title Banner
        sheet.mergeCells("A1:AJ1");
        const titleCell = sheet.getCell("A1");
        titleCell.value = "NIMIT — PROCUREIQ PURCHASE ORDERS & PR FULFILLMENT REPORT";
        titleCell.font = { name: "Segoe UI", size: 15, bold: true, color: { argb: "FFFFFFFF" } };
        titleCell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FF0B57A4" }
        };
        titleCell.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
        sheet.getRow(1).height = 36;

        // 2. Subtitle / Metadata Banner
        sheet.mergeCells("A2:AJ2");
        const metaCell = sheet.getCell("A2");
        const now = new Date();
        const dateTag = now.toISOString().slice(0, 10);
        const filterStatusText = (statusParam && statusParam !== "ALL") ? statusParam : "All Statuses";
        const filterDateText = (fromDate || toDate) ? `From: ${fromDate || "Start"} To: ${toDate || "Present"}` : "All Dates";
        const filterPartyText = partyParam && partyParam !== "ALL" ? ` | Vendor/Party: "${partyParam}"` : "";
        const filterSearchText = searchParam ? ` | Search: "${searchParam}"` : "";
        metaCell.value = `Exported: ${now.toLocaleDateString("en-IN")} ${now.toLocaleTimeString("en-IN")} | Status: ${filterStatusText} | Period: ${filterDateText}${filterPartyText}${filterSearchText} | Total Records: ${rows.length}`;
        metaCell.font = { name: "Segoe UI", size: 10, italic: true, color: { argb: "FF334155" } };
        metaCell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFF1F5F9" }
        };
        metaCell.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
        sheet.getRow(2).height = 24;

        sheet.getRow(3).height = 8; // Spacer

        // 3. Header Row Definition
        const columns = [
            { header: "S.No", key: "sno", width: 8, align: "center" },
            { header: "PO Number", key: "po_number", width: 22, align: "center" },
            { header: "PO Date", key: "po_date", width: 14, align: "center" },
            { header: "PO Status", key: "po_status", width: 15, align: "center" },
            { header: "PR Number", key: "pr_number", width: 22, align: "center" },
            { header: "PR Date", key: "pr_date", width: 14, align: "center" },
            { header: "Party / Client Name", key: "party_name", width: 28, align: "left" },
            { header: "Location", key: "location", width: 18, align: "left" },
            { header: "Territory", key: "territory", width: 16, align: "left" },
            { header: "Product Category", key: "product_category", width: 22, align: "left" },
            { header: "Sub Product Category", key: "sub_product_category", width: 22, align: "left" },
            { header: "Item Name", key: "item_name", width: 32, align: "left" },
            { header: "Make", key: "make", width: 16, align: "left" },
            { header: "Model", key: "model", width: 18, align: "left" },
            { header: "Quantity", key: "qty", width: 12, align: "right" },
            { header: "Unit", key: "unit", width: 10, align: "center" },
            { header: "PR Sales Rate (₹)", key: "sales_rate", width: 20, align: "right" },
            { header: "PR Taxable Value (₹)", key: "taxable_value", width: 22, align: "right" },
            { header: "Vendor Code", key: "vendor_code", width: 16, align: "center" },
            { header: "Vendor Name", key: "vendor_name", width: 32, align: "left" },
            { header: "Commercial Role", key: "commercial_role", width: 18, align: "center" },
            { header: "Vendor GSTIN", key: "gst_number", width: 18, align: "center" },
            { header: "Vendor Contact Person", key: "office_contact_name", width: 22, align: "left" },
            { header: "Vendor Phone", key: "office_contact_number", width: 18, align: "center" },
            { header: "Vendor Purchase Rate (₹)", key: "price_per_unit", width: 24, align: "right" },
            { header: "Total PO Amount (₹)", key: "total_price", width: 22, align: "right" },
            { header: "Savings / Margin (₹)", key: "savings", width: 22, align: "right" },
            { header: "Margin %", key: "margin_pct", width: 14, align: "right" },
            { header: "Expected Delivery Date", key: "expected_delivery_date", width: 20, align: "center" },
            { header: "Payment Type", key: "payment_type", width: 22, align: "center" },
            { header: "Advance Terms", key: "advance_terms", width: 18, align: "center" },
            { header: "Balance Due (Days)", key: "balance_due_days", width: 18, align: "center" },
            { header: "Received Quantity", key: "total_received", width: 16, align: "right" },
            { header: "Balance Quantity", key: "balance_qty", width: 16, align: "right" },
            { header: "Delivery Status", key: "delivery_status", width: 18, align: "center" },
            { header: "Quotation / PO Remarks", key: "remarks", width: 32, align: "left" }
        ];

        const headerRow = sheet.getRow(4);
        headerRow.height = 28;
        columns.forEach((col, idx) => {
            const cell = headerRow.getCell(idx + 1);
            cell.value = col.header;
            cell.font = { name: "Segoe UI", size: 10.5, bold: true, color: { argb: "FFFFFFFF" } };
            cell.fill = {
                type: "pattern",
                pattern: "solid",
                fgColor: { argb: "FF0F172A" }
            };
            cell.alignment = { vertical: "middle", horizontal: "center", wrapText: false };
            cell.border = {
                top: { style: "thin", color: { argb: "FF334155" } },
                bottom: { style: "medium", color: { argb: "FF0284C7" } },
                left: { style: "thin", color: { argb: "FF334155" } },
                right: { style: "thin", color: { argb: "FF334155" } }
            };
            sheet.getColumn(idx + 1).width = col.width;
        });

        // 4. Data Rows
        const formatDate = (val) => {
            if (!val) return "—";
            const d = new Date(val);
            if (isNaN(d.getTime())) return String(val).slice(0, 10);
            return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
        };

        let totalQty = 0;
        let totalPrValue = 0;
        let totalPoAmount = 0;
        let totalSavings = 0;

        rows.forEach((row, i) => {
            const rowIndex = 5 + i;
            const r = sheet.getRow(rowIndex);
            r.height = 22;

            const qtyNum = Number(row.qty) || 0;
            const salesRateNum = Number(row.sales_rate) || 0;
            const taxableValNum = Number(row.taxable_value) || 0;
            const pricePerUnitNum = Number(row.price_per_unit) || 0;
            const totalPoNum = Number(row.total_price) || 0;
            const savingsNum = taxableValNum > 0 ? (taxableValNum - totalPoNum) : 0;
            const marginPct = taxableValNum > 0 ? ((savingsNum / taxableValNum) * 100).toFixed(2) + "%" : "—";
            const receivedNum = Number(row.total_received) || 0;
            const balanceQtyNum = Math.max(0, qtyNum - receivedNum);

            let deliveryStatus = "Pending Delivery";
            if (receivedNum >= qtyNum && qtyNum > 0) deliveryStatus = "Fully Received";
            else if (receivedNum > 0) deliveryStatus = "Partially Received";

            let advanceTerms = "—";
            if (row.advance_type && row.advance_value) {
                advanceTerms = row.advance_type === "PERCENTAGE" ? `${row.advance_value}%` : `₹ ${row.advance_value}`;
            }

            totalQty += qtyNum;
            totalPrValue += taxableValNum;
            totalPoAmount += totalPoNum;
            totalSavings += savingsNum;

            const values = [
                i + 1,
                row.po_number || "—",
                formatDate(row.po_date || row.created_at),
                row.po_status || "—",
                row.pr_number || "—",
                formatDate(row.pr_date),
                row.party_name || "—",
                row.location || "—",
                row.territory || "—",
                row.product_category || "—",
                row.sub_product_category || "—",
                row.item_name || "—",
                row.make || "—",
                row.model || "—",
                qtyNum,
                row.unit || "—",
                salesRateNum,
                taxableValNum,
                row.vendor_code || "—",
                row.vendor_name || "—",
                row.commercial_role || "—",
                row.gst_number || "—",
                row.office_contact_name || "—",
                row.office_contact_number || "—",
                pricePerUnitNum,
                totalPoNum,
                savingsNum,
                marginPct,
                formatDate(row.expected_delivery_date),
                row.payment_type ? row.payment_type.replace(/_/g, " ") : "—",
                advanceTerms,
                row.balance_due_days != null ? row.balance_due_days : "—",
                receivedNum,
                balanceQtyNum,
                deliveryStatus,
                row.quotation_remarks || row.payment_terms_remarks || "—"
            ];

            const isEven = i % 2 === 1;
            const rowBg = isEven ? "FFF8FAFC" : "FFFFFFFF";

            values.forEach((v, cIdx) => {
                const cell = r.getCell(cIdx + 1);
                cell.value = v;
                cell.font = { name: "Segoe UI", size: 10, color: { argb: "FF0F172A" } };
                cell.fill = {
                    type: "pattern",
                    pattern: "solid",
                    fgColor: { argb: rowBg }
                };
                cell.border = {
                    top: { style: "thin", color: { argb: "FFE2E8F0" } },
                    bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
                    left: { style: "thin", color: { argb: "FFE2E8F0" } },
                    right: { style: "thin", color: { argb: "FFE2E8F0" } }
                };

                const align = columns[cIdx].align;
                cell.alignment = { vertical: "middle", horizontal: align };

                // Currency formatting
                if ([16, 17, 24, 25, 26].includes(cIdx)) {
                    cell.numFmt = "₹#,##0.00";
                }

                // Status styling
                if (cIdx === 3) {
                    const st = (row.po_status || "").toUpperCase();
                    if (st === "COMPLETED") {
                        cell.font = { name: "Segoe UI", size: 9.5, bold: true, color: { argb: "FF15803D" } };
                    } else if (st === "ISSUED") {
                        cell.font = { name: "Segoe UI", size: 9.5, bold: true, color: { argb: "FF1D4ED8" } };
                    } else if (st === "CANCELLED") {
                        cell.font = { name: "Segoe UI", size: 9.5, bold: true, color: { argb: "FFB91C1C" } };
                    } else if (st === "DRAFT") {
                        cell.font = { name: "Segoe UI", size: 9.5, bold: true, color: { argb: "FFB45309" } };
                    }
                }
            });
        });

        // 5. Total Summary Row
        const summaryRowIndex = 5 + rows.length;
        const sumRow = sheet.getRow(summaryRowIndex);
        sumRow.height = 28;
        for (let colIdx = 1; colIdx <= columns.length; colIdx++) {
            const cell = sumRow.getCell(colIdx);
            cell.font = { name: "Segoe UI", size: 10.5, bold: true, color: { argb: "FF0F172A" } };
            cell.fill = {
                type: "pattern",
                pattern: "solid",
                fgColor: { argb: "FFE2E8F0" }
            };
            cell.border = {
                top: { style: "medium", color: { argb: "FF94A3B8" } },
                bottom: { style: "double", color: { argb: "FF0F172A" } },
                left: { style: "thin", color: { argb: "FFCBD5E1" } },
                right: { style: "thin", color: { argb: "FFCBD5E1" } }
            };
            cell.alignment = { vertical: "middle", horizontal: columns[colIdx - 1].align };
        }

        sumRow.getCell(1).value = "";
        sumRow.getCell(7).value = "TOTAL SUMMARY";
        sumRow.getCell(7).font = { name: "Segoe UI", size: 11, bold: true, color: { argb: "FF0B57A4" } };
        sumRow.getCell(15).value = totalQty;
        sumRow.getCell(18).value = totalPrValue;
        sumRow.getCell(18).numFmt = "₹#,##0.00";
        sumRow.getCell(26).value = totalPoAmount;
        sumRow.getCell(26).numFmt = "₹#,##0.00";
        sumRow.getCell(27).value = totalSavings;
        sumRow.getCell(27).numFmt = "₹#,##0.00";
        if (totalPrValue > 0) {
            sumRow.getCell(28).value = ((totalSavings / totalPrValue) * 100).toFixed(2) + "%";
        }

        // Enable auto filter
        if (rows.length > 0) {
            sheet.autoFilter = `A4:AJ${summaryRowIndex - 1}`;
        }

        const statusSuffix = (statusParam && statusParam !== "ALL") ? `_${statusParam}` : "";
        const filename = `Purchase_Orders_Summary${statusSuffix}_${dateTag}.xlsx`;

        res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

        await workbook.xlsx.write(res);
        return res.end();
    } catch (error) {
        console.error("Purchase orders Excel export failed:", error);
        log(`Purchase orders Excel export failed - ${error.message}`);
        return res.status(500).json({
            success: false,
            message: "Failed to export purchase orders to Excel"
        });
    }
});

// POST /purchase-orders/:po_id/issue - Issues a DRAFT purchase order: generates the PDF, marks it ISSUED and returns the PDF as a download
app.post("/purchase-orders/:po_id/issue", verifyProcurement, async (req, res) => {
    const poId = Number(req.params.po_id);
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();
        const [rows] = await connection.execute(`
            SELECT
                po.*,
                COALESCE(po.vendor_address, vom.office_address) AS vendor_address,
                vom.gst_number     AS vendor_gst,
                vom.office_contact_name,
                vom.office_contact_number
            FROM purchase_orders po
            LEFT JOIN vendor_oem_masters vom ON vom.vendor_id = po.vendor_id
            WHERE po.po_id = ?
            FOR UPDATE
        `, [poId]);
        if (!rows.length) {
            await connection.rollback();
            return res.status(404).json({ success: false, message: "PO not found" });
        }
        if (rows[0].status !== "DRAFT") {
            await connection.rollback();
            return res.status(409).json({ success: false, message: "PO is not in DRAFT status" });
        }
        const po = rows[0];
        const pdfPath = await generatePoPdf(po);
        const relPath = path.relative(__dirname, pdfPath).replace(/\\/g, "/");
        await connection.execute(
            `UPDATE purchase_orders SET status = 'ISSUED', issued_po_path = ? WHERE po_id = ?`,
            [relPath, poId]
        );
        await connection.commit();
        log(`PO issued - PO ID: ${poId}, Number: ${po.po_number}`);
        await writeReportLog(req, "PO_ISSUED",
            `Purchase order ${po.po_number} issued to vendor "${orDash(po.vendor_name)}" (${orDash(po.vendor_code)}, GST: ${orDash(po.vendor_gst)}). ` +
            `Reference ${po.pr_number} for party "${orDash(po.party_name)}". ` +
            `Item: ${orDash(po.item_name)}, make: ${orDash(po.make)}, model: ${orDash(po.model)}, quantity: ${Number(po.qty)} ${orDash(po.unit)}. ` +
            `Price per unit: ${money(po.price_per_unit)}, PO total: ${money(po.total_price)}. ` +
            `Expected delivery: ${dateText(po.expected_delivery_date)}. ${describePayment(po)}. ` +
            `Status changed from DRAFT to ISSUED and the PO PDF was generated.`
        );
        if (req.headers.accept?.includes("application/json") || req.query.format === "json") {
            return res.json({
                success: true,
                message: "PO generated and issued successfully",
                po_id: poId,
                po_number: po.po_number,
                download_url: `/purchase-orders/${poId}/download`
            });
        }
        const safeFileName = po.po_number.replace(/\//g, "_") + ".pdf";
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `attachment; filename="${safeFileName}"`);
        res.setHeader("Content-Length", fs.statSync(pdfPath).size);
        fs.createReadStream(pdfPath).pipe(res);
    } catch (error) {
        await connection.rollback();
        console.error(error);
        log(`PO issue failed - ${error.message}`);
        return res.status(500).json({ success: false, message: "Failed to issue PO" });
    } finally {
        connection.release();
    }
});

// GET /purchase-orders/:po_id/download - Downloads the PDF of an issued purchase order
app.get("/purchase-orders/:po_id/download", verifyProcurement, async (req, res) => {
    const poId = Number(req.params.po_id);
    if (!Number.isInteger(poId) || poId <= 0) return res.status(400).json({ success: false, message: "Invalid PO ID" });
    try {
        const [rows] = await db.execute(
            `SELECT
                po.*,
                COALESCE(po.vendor_address, vom.office_address) AS vendor_address,
                vom.gst_number AS vendor_gst,
                vom.office_contact_name,
                vom.office_contact_number
             FROM purchase_orders po
             LEFT JOIN vendor_oem_masters vom ON vom.vendor_id = po.vendor_id
             WHERE po.po_id = ? LIMIT 1`,
            [poId]
        );
        if (!rows.length) return res.status(404).json({ success: false, message: "Purchase Order not found" });
        const po = rows[0];

        const generatedPath = await generatePoPdf(po);
        const relPath = path.relative(__dirname, generatedPath).replace(/\\/g, "/");
        await db.execute(`UPDATE purchase_orders SET issued_po_path = ? WHERE po_id = ?`, [relPath, poId]);

        const safeFileName = String(po.po_number || "PO").replace(/[\/\\:*?"<>|]/g, "_") + ".pdf";
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `attachment; filename="${safeFileName}"`);
        res.setHeader("Content-Length", fs.statSync(generatedPath).size);
        fs.createReadStream(generatedPath).pipe(res);
    } catch (error) {
        console.error(error);
        log(`PO download failed - ${error.message}`);
        return res.status(500).json({ success: false, message: "Failed to download PO" });
    }
});

// POST /purchase-orders/:po_id/complete - Manually marks a purchase order COMPLETED (needs at least one receipt) and closes its inquiry
app.post("/purchase-orders/:po_id/complete", verifyProcurement, async (req, res) => {
    const poId = Number(req.params.po_id);
    if (!Number.isInteger(poId) || poId <= 0)return res.status(400).json({ success: false, message: "Invalid PO ID" });
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();
        const [poRows] = await connection.execute(`
            SELECT po_id, qty, status, po_number, pr_number, vendor_name, vendor_code,
                   item_name, make, model, unit, total_price, inquiry_id
            FROM purchase_orders
            WHERE po_id = ?
            FOR UPDATE
        `, [poId]);
        if (poRows.length === 0) {
            await connection.rollback();
            return res.status(404).json({ success: false, message: "Purchase Order not found" });
        }
        const po = poRows[0];
        if (po.status === "CANCELLED") {
            await connection.rollback();
            return res.status(409).json({ success: false, message: "Cancelled PO cannot be completed" });
        }
        if (po.status === "COMPLETED") {
            await connection.rollback();
            return res.status(409).json({ success: false, message: "PO is already completed" });
        }
        const [receivedRows] = await connection.execute(`
            SELECT COALESCE(SUM(received_quantity), 0) AS total_received
            FROM goods_received
            WHERE po_id = ?
        `, [poId]);
        const totalReceived = Number(receivedRows[0].total_received);
        if (totalReceived === 0) {
            await connection.rollback();
            return res.status(400).json({ success: false, message: "Cannot complete a PO with no goods received" });
        }
        await connection.execute(`
            UPDATE purchase_orders SET status = 'COMPLETED' WHERE po_id = ?
        `, [poId]);
        await connection.execute(`
            UPDATE vendor_inquiries
            SET status = 'CLOSED'
            WHERE inquiry_id = (
                SELECT inquiry_id FROM purchase_orders WHERE po_id = ?
            )
        `, [poId]);
        await connection.commit();
        log(`PO completed manually - PO: ${poId}`);
        await writeReportLog(req, "PO_COMPLETED",
            `Purchase order ${po.po_number} (${po.pr_number}) marked as completed. ` +
            `Vendor: "${orDash(po.vendor_name)}" (${orDash(po.vendor_code)}). ` +
            `Item: ${orDash(po.item_name)}, make: ${orDash(po.make)}, model: ${orDash(po.model)}. ` +
            `Ordered quantity: ${Number(po.qty)} ${orDash(po.unit)}, total received before completion: ${totalReceived} ${orDash(po.unit)}` +
            `${totalReceived < Number(po.qty) ? ` (short by ${Number(po.qty) - totalReceived} ${orDash(po.unit)})` : ""}. ` +
            `PO value: ${money(po.total_price)}. Status changed to COMPLETED and vendor inquiry ${orDash(po.inquiry_id)} closed.`
        );
        return res.json({ success: true, message: "Purchase Order marked as completed" });
    } catch (error) {
        await connection.rollback();
        console.error(error);
        log(`PO complete failed - ${error.message}`);
        return res.status(500).json({ success: false, message: "Failed to complete Purchase Order" });
    } finally {
        connection.release();
    }
});

// POST /purchase-orders/:po_id/reselect
// Deletes a DRAFT PO row entirely and re-opens the inquiry for vendor re-selection.
// The PO number is freed so it can be assigned to the next vendor selected.
// Use this when the wrong vendor was selected.
app.post("/purchase-orders/:po_id/reselect", verifyProcurement, async (req, res) => {
    const poId = Number(req.params.po_id);
    const { reason } = req.body;

    if (!Number.isInteger(poId) || poId <= 0) {
        return res.status(400).json({ success: false, message: "Invalid PO ID" });
    }
    if (!reason || !String(reason).trim()) {
        return res.status(400).json({ success: false, message: "Reason is required" });
    }

    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        const [rows] = await connection.execute(`
            SELECT
                po.po_id,
                po.po_number,
                po.pr_number,
                po.status,
                po.inquiry_id,
                po.vendor_name,
                po.vendor_code,
                po.item_name,
                po.make,
                po.model,
                po.qty,
                po.unit,
                po.total_price
            FROM purchase_orders po
            WHERE po.po_id = ?
            FOR UPDATE
        `, [poId]);

        if (!rows.length) {
            await connection.rollback();
            return res.status(404).json({ success: false, message: "Purchase Order not found" });
        }

        const po = rows[0];

        if (po.status !== "DRAFT") {
            await connection.rollback();
            return res.status(409).json({
                success: false,
                message: "Only DRAFT purchase orders can be re-selected"
            });
        }

        // Delete the DRAFT PO row so the PO number is freed
        await connection.execute(
            `DELETE FROM purchase_orders WHERE po_id = ?`,
            [poId]
        );

        // Re-open the inquiry
        await connection.execute(
            `UPDATE vendor_inquiries SET status = 'OPEN' WHERE inquiry_id = ?`,
            [po.inquiry_id]
        );

        // Unselect all vendor quotations so comparison page shows them fresh
        await connection.execute(
            `UPDATE vendor_inquiry_vendors SET is_selected = FALSE WHERE inquiry_id = ?`,
            [po.inquiry_id]
        );

        await connection.commit();

        await writeReportLog(req, "PO_RESELECT",
            `Draft PO ${po.po_number} (${po.pr_number}) deleted for vendor re-selection. ` +
            `Previous vendor: "${orDash(po.vendor_name)}" (${orDash(po.vendor_code)}). ` +
            `Item: ${orDash(po.item_name)}, make: ${orDash(po.make)}, model: ${orDash(po.model)}, ` +
            `quantity: ${Number(po.qty)} ${orDash(po.unit)}, value: ${money(po.total_price)}. ` +
            `Inquiry ${po.inquiry_id} re-opened. PO number ${po.po_number} freed for reuse. ` +
            `Reason: ${String(reason).trim()}.`
        );

        log(`Draft PO deleted for reselect - PO: ${po.po_number}, Inquiry: ${po.inquiry_id}`);

        return res.json({
            success: true,
            message: "Purchase Order removed. The inquiry has been re-opened — go to Quotation Comparisons to select a different vendor.",
            inquiry_id: po.inquiry_id,
            pr_number: po.pr_number
        });

    } catch (error) {
        await connection.rollback();
        console.error(error);
        log(`PO reselect failed - ${error.message}`);
        return res.status(500).json({ success: false, message: "Failed to process re-selection" });
    } finally {
        connection.release();
    }
});


// POST /purchase-orders/:po_id/cancel
// Permanently cancels the entire requirement chain: PO + inquiry + PR.
// The PO row is KEPT for audit trail but marked CANCELLED.
// The PO number is never reused.
// Use this when the client has cancelled the requirement entirely.
app.post("/purchase-orders/:po_id/cancel", verifyManager, async (req, res) => {
    const poId = Number(req.params.po_id);
    const { reason } = req.body;

    if (!Number.isInteger(poId) || poId <= 0) {
        return res.status(400).json({ success: false, message: "Invalid PO ID" });
    }
    if (!reason || !String(reason).trim()) {
        return res.status(400).json({ success: false, message: "Cancellation reason is required" });
    }

    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        const [rows] = await connection.execute(`
            SELECT
                po.po_id,
                po.po_number,
                po.pr_number,
                po.pr_id,
                po.status,
                po.inquiry_id,
                po.vendor_name,
                po.vendor_code,
                po.item_name,
                po.make,
                po.model,
                po.qty,
                po.unit,
                po.total_price
            FROM purchase_orders po
            WHERE po.po_id = ?
            FOR UPDATE
        `, [poId]);

        if (!rows.length) {
            await connection.rollback();
            return res.status(404).json({ success: false, message: "Purchase Order not found" });
        }

        const po = rows[0];

        if (po.status !== "DRAFT" && po.status !== "ISSUED") {
            await connection.rollback();
            return res.status(409).json({
                success: false,
                message: "Only DRAFT or ISSUED purchase orders can be cancelled."
            });
        }

        // If PO is ISSUED, verify no goods remain received in inventory
        const [grRows] = await connection.execute(`
            SELECT 
                GREATEST(0, COALESCE((SELECT SUM(received_quantity) FROM goods_received WHERE po_id = ?), 0) - COALESCE((SELECT SUM(return_quantity) FROM goods_returns WHERE po_id = ?), 0)) AS net_received
        `, [poId, poId]);
        const netReceived = Number(grRows[0]?.net_received || 0);

        if (po.status === "ISSUED" && netReceived > 0) {
            await connection.rollback();
            return res.status(409).json({
                success: false,
                message: `Cannot cancel Purchase Order ${po.po_number}: ${netReceived} ${po.unit || "units"} have already been received into inventory. Please return all received goods first.`
            });
        }

        // Mark PO cancelled (keep row for audit)
        await connection.execute(
            `UPDATE purchase_orders SET status = 'CANCELLED' WHERE po_id = ?`,
            [poId]
        );

        // Close the inquiry permanently
        if (po.inquiry_id) {
            await connection.execute(
                `UPDATE vendor_inquiries SET status = 'CANCELLED' WHERE inquiry_id = ?`,
                [po.inquiry_id]
            );
        }

        await connection.commit();

        await writeReportLog(req, "REQUIREMENT_CANCELLED",
            `Client requirement cancelled. Full chain closed: ` +
            `PR ${po.pr_number}, inquiry ${po.inquiry_id}, ${po.status.toLowerCase()} PO ${po.po_number}. ` +
            `Vendor: "${orDash(po.vendor_name)}" (${orDash(po.vendor_code)}). ` +
            `Item: ${orDash(po.item_name)}, make: ${orDash(po.make)}, model: ${orDash(po.model)}, ` +
            `quantity: ${Number(po.qty)} ${orDash(po.unit)}, PO value: ${money(po.total_price)}. ` +
            `PO number ${po.po_number} permanently retired. ` +
            `Reason: ${String(reason).trim()}.`
        );

        log(`Requirement cancelled - PR: ${po.pr_number}, PO: ${po.po_number}`);

        return res.json({
            success: true,
            message: "Requirement cancelled. The PR, inquiry and PO have all been closed permanently.",
            pr_number: po.pr_number
        });

    } catch (error) {
        await connection.rollback();
        console.error(error);
        log(`Requirement cancellation failed - ${error.message}`);
        return res.status(500).json({ success: false, message: "Failed to cancel requirement" });
    } finally {
        connection.release();
    }
});

/* ==========================================================================
   TAB: GOODS RECEIVED AND RETURNS
   ========================================================================== */

// GET /goods-received - Lists ISSUED purchase orders with ordered / received / remaining quantities and progress
app.get("/goods-received", verifyProcurement, async (req, res) => {
    try {
        const [rows] = await db.execute(`
            SELECT
                po.po_id,
                po.po_number,
                po.po_date,
                po.pr_number,
                po.pr_date,
                po.party_name,
                po.location,
                po.territory,
                po.product_category,
                po.sub_product_category,
                po.item_name,
                po.product_remarks,
                po.make,
                po.model,
                po.qty AS ordered_quantity,
                po.unit,
                po.vendor_code,
                po.vendor_name,
                po.vendor_address,
                po.expected_delivery_date,
                po.status AS po_status,
                COALESCE(gr_sum.received_quantity, 0) AS received_quantity,
                COALESCE(ret_sum.returned_quantity, 0) AS returned_quantity
            FROM purchase_orders po
            LEFT JOIN (
                SELECT po_id, SUM(received_quantity) AS received_quantity
                FROM goods_received
                GROUP BY po_id
            ) gr_sum ON gr_sum.po_id = po.po_id
            LEFT JOIN (
                SELECT po_id, SUM(return_quantity) AS returned_quantity
                FROM goods_returns
                GROUP BY po_id
            ) ret_sum ON ret_sum.po_id = po.po_id
            WHERE po.status IN ('ISSUED', 'COMPLETED')
            ORDER BY po.po_id DESC
        `);
        const result = rows.map(row => {
            const orderedQuantity   = Number(row.ordered_quantity);
            const totalReceived     = Number(row.received_quantity);
            const returnedQuantity  = Number(row.returned_quantity);
            const receivedQuantity  = Math.max(totalReceived - returnedQuantity, 0);
            const remainingQuantity = Math.max(orderedQuantity - receivedQuantity, 0);
            const progress = orderedQuantity > 0 ? Math.min((receivedQuantity / orderedQuantity) * 100, 100) : 0;
            return {
                ...row,
                ordered_quantity:   orderedQuantity,
                received_quantity:  receivedQuantity,
                remaining_quantity: remainingQuantity,
                progress: Number(progress.toFixed(2))
            };
        });
        return res.json({ success: true, orders: result });
    } catch (error) {
        console.error(error);
        log(`Goods Received fetch failed - ${error.message}`);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch goods received data"
        });
    }
});

// GET /goods-received/:po_id - Returns one purchase order with its full receipt and return history and stock figures
app.get("/goods-received/:po_id", verifyProcurement, async (req, res) => {
    const poId = Number(req.params.po_id);
    if (!Number.isInteger(poId) || poId <= 0)return res.status(400).json({ success: false, message: "Invalid PO ID" });
    try {
        const [poRows] = await db.execute(`
            SELECT
                po_id, po_number, po_date,
                vendor_code, vendor_name,
                item_name, make, model,
                qty AS ordered_quantity, unit,
                expected_delivery_date, status
            FROM purchase_orders
            WHERE po_id = ?
            LIMIT 1
        `, [poId]);
        if (poRows.length === 0)return res.status(404).json({ success: false, message: "Purchase Order not found" });
        const [receipts] = await db.execute(`
            SELECT receipt_id, received_date, received_quantity, remarks
            FROM goods_received
            WHERE po_id = ?
            ORDER BY received_date DESC, receipt_id DESC
        `, [poId]);
        const [returns] = await db.execute(`
            SELECT return_id, return_date, return_quantity, return_reason
            FROM goods_returns
            WHERE po_id = ?
            ORDER BY return_date DESC, return_id DESC
        `, [poId]);
        const po               = poRows[0];
        const orderedQuantity  = Number(po.ordered_quantity);
        const totalReceived    = receipts.reduce((sum, r) => sum + Number(r.received_quantity), 0);
        const totalReturned    = returns.reduce((sum, r)  => sum + Number(r.return_quantity), 0);
        const stockInHand      = Math.max(totalReceived - totalReturned, 0);
        const remainingQuantity = Math.max(orderedQuantity - totalReceived, 0);
        const progress         = orderedQuantity > 0 ? Math.min((totalReceived / orderedQuantity) * 100, 100) : 0;
        return res.json({
            success: true,
            order: {
                ...po,
                ordered_quantity:   orderedQuantity,
                received_quantity:  totalReceived,
                returned_quantity:  totalReturned,
                stock_in_hand:      stockInHand,
                remaining_quantity: remainingQuantity,
                progress: Number(progress.toFixed(2))
            },
            receipts,
            returns
        });
    } catch (error) {
        console.error(error);
        log(`Goods Received history fetch failed - ${error.message}`);
        return res.status(500).json({ success: false, message: "Failed to fetch goods received history" });
    }
});

// POST /goods-received - Records a goods receipt against a purchase order (cannot exceed the remaining quantity)
app.post("/goods-received", verifyProcurement, async (req, res) => {
    const { po_id, received_quantity, receipt_date, remarks } = req.body;
    const poId        = Number(po_id);
    const receivedQty = Number(received_quantity);
    if (!Number.isInteger(poId) || poId <= 0)return res.status(400).json({ success: false, message: "Invalid PO ID" });
    if (!Number.isFinite(receivedQty) || receivedQty <= 0)return res.status(400).json({ success: false, message: "Received quantity must be greater than 0" });
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();
        const [poRows] = await connection.execute(`
            SELECT po_id, qty, unit, status, po_number, vendor_name, vendor_code, item_name, make, model
            FROM purchase_orders
            WHERE po_id = ?
            FOR UPDATE
        `, [poId]);
        if (poRows.length === 0) {
            await connection.rollback();
            return res.status(404).json({ success: false, message: "Purchase Order not found" });
        }
        const po = poRows[0];
        if (po.status === "CANCELLED") {
            await connection.rollback();
            return res.status(409).json({ success: false, message: "Cancelled Purchase Order cannot receive goods" });
        }
        if (po.status === "COMPLETED") {
            await connection.rollback();
            return res.status(409).json({ success: false, message: "Purchase Order is already completed" });
        }
        const orderedQuantity = Number(po.qty);
        const [receivedRows] = await connection.execute(`
            SELECT COALESCE(SUM(received_quantity), 0) AS total_received
            FROM goods_received
            WHERE po_id = ?
        `, [poId]);
        const [returnRows] = await connection.execute(`
            SELECT COALESCE(SUM(return_quantity), 0) AS total_returned
            FROM goods_returns
            WHERE po_id = ?
        `, [poId]);
        const alreadyReceived   = Number(receivedRows[0].total_received);
        const totalReturned     = Number(returnRows[0].total_returned);
        const remainingQuantity = orderedQuantity - alreadyReceived + totalReturned;
        if (receivedQty > remainingQuantity) {
            await connection.rollback();
            return res.status(400).json({
                success: false,
                message: `Cannot receive ${receivedQty}. Only ${remainingQuantity} ${po.unit || "units"} remaining.`
            });
        }
        const finalReceivedQuantity = alreadyReceived + receivedQty;
        const receivedDate = receipt_date && String(receipt_date).trim() !== "" ? receipt_date : new Date().toISOString().split("T")[0];
        const receivedBy = req.user?.user_id || req.session?.user?.user_id || 1;
        const [result] = await connection.execute(`
            INSERT INTO goods_received (po_id, received_quantity, received_date, remarks, received_by)
            VALUES (?, ?, ?, ?, ?)
        `, [poId, receivedQty, receivedDate, remarks?.trim() || null, receivedBy]);
        await connection.commit();
        log(`Goods received - PO: ${poId}, Received: ${receivedQty}`);
        await writeReportLog(req, "GOODS_RECEIVED",
            `Goods received against purchase order ${po.po_number} from vendor "${orDash(po.vendor_name)}" (${orDash(po.vendor_code)}) on ${dateText(receivedDate)} (receipt ID ${result.insertId}). ` +
            `Item: ${orDash(po.item_name)}, make: ${orDash(po.make)}, model: ${orDash(po.model)}. ` +
            `Quantity received now: ${receivedQty} ${orDash(po.unit)}. ` +
            `Total received so far: ${finalReceivedQuantity} of ${orderedQuantity} ${orDash(po.unit)} ordered, ` +
            `remaining: ${Math.max(orderedQuantity - finalReceivedQuantity, 0)} ${orDash(po.unit)}. ` +
            `Remarks: ${orDash(remarks)}.`
        );
        return res.status(201).json({
            success: true,
            message: "Goods received successfully",
            receipt_id:         result.insertId,
            received_quantity:  receivedQty,
            total_received:     finalReceivedQuantity,
            remaining_quantity: Math.max(orderedQuantity - finalReceivedQuantity, 0),
            progress: orderedQuantity > 0 ? Number(Math.min((finalReceivedQuantity / orderedQuantity) * 100, 100).toFixed(2)) : 0,
            po_status: po.status
        });
    } catch (error) {
        await connection.rollback();
        console.error(error);
        log(`Goods Received creation failed - ${error.message}`);
        return res.status(500).json({ success: false, message: "Failed to record goods received" });
    } finally {
        connection.release();
    }
});

// POST /goods-returns - Records goods returned to the vendor against a purchase order (cannot exceed the quantity in hand)
app.post("/goods-returns", verifyProcurement, async (req, res) => {
    const { po_id, receipt_id, return_quantity, return_reason, return_date } = req.body;
    const poId      = Number(po_id);
    const receiptId = receipt_id ? Number(receipt_id) : null;
    const returnQty = Number(return_quantity);
    if (!Number.isInteger(poId) || poId <= 0)return res.status(400).json({ success: false, message: "Invalid PO ID" });
    if (receiptId !== null && (!Number.isInteger(receiptId) || receiptId <= 0))return res.status(400).json({ success: false, message: "Invalid receipt ID" });
    if (!Number.isFinite(returnQty) || returnQty <= 0)return res.status(400).json({ success: false, message: "Return quantity must be greater than 0" });
    if (!return_reason || String(return_reason).trim() === "")return res.status(400).json({ success: false, message: "Return reason is required" });
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();
        const [poRows] = await connection.execute(`
            SELECT po_id, qty, status, unit, po_number, vendor_name, vendor_code, item_name, make, model
            FROM purchase_orders
            WHERE po_id = ?
            FOR UPDATE
        `, [poId]);
        if (poRows.length === 0) {
            await connection.rollback();
            return res.status(404).json({ success: false, message: "Purchase Order not found" });
        }
        const [receivedRows] = await connection.execute(`
            SELECT COALESCE(SUM(received_quantity), 0) AS total_received
            FROM goods_received
            WHERE po_id = ?
        `, [poId]);
        const totalReceived = Number(receivedRows[0].total_received);
        const [returnRows] = await connection.execute(`
            SELECT COALESCE(SUM(return_quantity), 0) AS total_returned
            FROM goods_returns
            WHERE po_id = ?
        `, [poId]);
        const totalReturned    = Number(returnRows[0].total_returned);
        const availableToReturn = totalReceived - totalReturned;
        if (returnQty > availableToReturn) {
            await connection.rollback();
            return res.status(400).json({
                success: false,
                message: `Cannot return ${returnQty}. Only ${availableToReturn} units available to return.`
            });
        }
        if (receiptId !== null) {
            const [receiptRows] = await connection.execute(`
                SELECT receipt_id
                FROM goods_received
                WHERE receipt_id = ? AND po_id = ?
                LIMIT 1
            `, [receiptId, poId]);
            if (receiptRows.length === 0) {
                await connection.rollback();
                return res.status(400).json({
                    success: false,
                    message: "Receipt does not belong to this Purchase Order"
                });
            }
        }
        const returnDate = return_date && String(return_date).trim() !== "" ? return_date : new Date().toISOString().split("T")[0];
        const returnedBy = req.user?.user_id || req.session?.user?.user_id || 1;
        const [result] = await connection.execute(`
            INSERT INTO goods_returns (po_id, receipt_id, return_quantity, return_date, return_reason, returned_by)
            VALUES (?, ?, ?, ?, ?, ?)
        `, [poId, receiptId, returnQty, returnDate, String(return_reason).trim(), returnedBy]);
        await connection.commit();
        log(`Goods returned - PO: ${poId}, Return: ${returnQty}, Reason: ${String(return_reason).trim()}`);
        const newTotalReturned = totalReturned + returnQty;
        const po = poRows[0];
        await writeReportLog(req, "GOODS_RETURNED",
            `Goods returned against purchase order ${po.po_number} to vendor "${orDash(po.vendor_name)}" (${orDash(po.vendor_code)}) on ${dateText(returnDate)} (return ID ${result.insertId}` +
            `${receiptId !== null ? `, against receipt ID ${receiptId}` : ""}). ` +
            `Item: ${orDash(po.item_name)}, make: ${orDash(po.make)}, model: ${orDash(po.model)}. ` +
            `Quantity returned: ${returnQty} ${orDash(po.unit)}. Reason: ${String(return_reason).trim()}. ` +
            `Total received: ${totalReceived} ${orDash(po.unit)}, total returned: ${newTotalReturned} ${orDash(po.unit)}, ` +
            `stock in hand: ${Math.max(totalReceived - newTotalReturned, 0)} ${orDash(po.unit)}.`
        );
        return res.status(201).json({
            success: true,
            message: "Goods returned successfully",
            return_id:        result.insertId,
            return_quantity:  returnQty,
            total_received:   totalReceived,
            total_returned:   newTotalReturned,
            stock_in_hand:    Math.max(totalReceived - newTotalReturned, 0),
            available_to_return: availableToReturn - returnQty
        });
    } catch (error) {
        await connection.rollback();
        console.error(error);
        log(`Goods Return creation failed - ${error.message}`);
        return res.status(500).json({ success: false, message: "Failed to record goods return" });
    } finally {
        connection.release();
    }
});

/* ==========================================================================
   TAB: VENDOR PERFORMANCE
   ========================================================================== */

// GET /vendor-performance - Scorecard for every vendor: order count and value, average lead time, on-time delivery %, open orders
app.get("/vendor-performance", verifyProcurement, async (req, res) => {
    try {
        const [rows] = await db.execute(`
            SELECT
                vom.vendor_id,
                COALESCE(vom.vendor_code, '')          AS vendor_code,
                vom.vendor_name,
                vom.is_blacklisted,
                COUNT(DISTINCT po.po_id)               AS total_orders,
                COALESCE(SUM(po.total_price), 0)       AS order_value,
                ROUND(
                    AVG(
                        CASE
                            WHEN gr_first.first_received_date IS NOT NULL
                            THEN DATEDIFF(gr_first.first_received_date, po.po_date)
                        END
                    ), 1
                )                                       AS avg_lead_time_days,
                COUNT(
                    CASE
                        WHEN gr_first.first_received_date IS NOT NULL
                         AND po.expected_delivery_date IS NOT NULL
                         AND gr_first.first_received_date <= po.expected_delivery_date
                        THEN 1
                    END
                )                                       AS on_time_deliveries,
                COUNT(
                    CASE
                        WHEN gr_first.first_received_date IS NOT NULL
                        THEN 1
                    END
                )                                       AS total_deliveries,
                COUNT(
                    CASE
                        WHEN po.status IN ('DRAFT', 'ISSUED')
                        THEN 1
                    END
                )                                       AS open_orders
            FROM vendor_oem_masters vom
            LEFT JOIN purchase_orders po
                ON po.vendor_id = vom.vendor_id
            LEFT JOIN (
                SELECT po_id, MIN(received_date) AS first_received_date
                FROM goods_received
                GROUP BY po_id
            ) gr_first
                ON gr_first.po_id = po.po_id
            GROUP BY vom.vendor_id, vom.vendor_code, vom.vendor_name
            ORDER BY vom.vendor_id ASC
        `);
        const result = rows.map(row => {
            const onTime  = Number(row.on_time_deliveries);
            const total   = Number(row.total_deliveries);
            return {
                vendor_id:          row.vendor_id,
                vendor_code:        row.vendor_code,
                vendor_name:        row.vendor_name,
                is_blacklisted:     Boolean(row.is_blacklisted),
                total_orders:       Number(row.total_orders),
                order_value:        Number(row.order_value),
                avg_lead_time_days: row.avg_lead_time_days !== null ? Number(row.avg_lead_time_days) : null,
                on_time_deliveries: onTime,
                total_deliveries:   total,
                on_time_pct:        total > 0 ? Number(((onTime / total) * 100).toFixed(1)) : null,
                open_orders:        Number(row.open_orders)
            };
        });
        return res.json({ success: true, vendors: result });
    } catch (error) {
        console.error(error);
        log(`Vendor performance fetch failed - ${error.message}`);
        return res.status(500).json({ success: false, message: "Failed to fetch vendor performance" });
    }
});

// GET /vendor-performance/:vendor_id - Detailed performance of one vendor: profile, KPIs and per-PO delivery breakdown
app.get("/vendor-performance/:vendor_id", verifyProcurement, async (req, res) => {
    const vendorId = Number(req.params.vendor_id);
    if (!Number.isInteger(vendorId) || vendorId <= 0)return res.status(400).json({ success: false, message: "Invalid vendor ID" });
    try {
        const [profileRows] = await db.execute(`
            SELECT
                vendor_id, vendor_code, vendor_name,
                gst_number, pan_number, msme_number,
                office_address, office_contact_name, office_contact_number,
                sales_team_name, sales_team_contact, sales_team_email,
                is_blacklisted
            FROM vendor_oem_masters
            WHERE vendor_id = ?
            LIMIT 1
        `, [vendorId]);
        if (profileRows.length === 0)return res.status(404).json({ success: false, message: "Vendor not found" });
        const [orderRows] = await db.execute(`
            SELECT
                po.po_id,
                po.po_number,
                po.po_date,
                po.item_name,
                po.make,
                po.model,
                po.qty,
                po.unit,
                po.price_per_unit,
                po.total_price,
                po.expected_delivery_date,
                po.status,
                gr_first.first_received_date,
                CASE
                    WHEN gr_first.first_received_date IS NOT NULL
                    THEN DATEDIFF(gr_first.first_received_date, po.po_date)
                END                                         AS lead_time_days,
                CASE
                    WHEN gr_first.first_received_date IS NOT NULL
                     AND po.expected_delivery_date IS NOT NULL
                     AND gr_first.first_received_date <= po.expected_delivery_date
                    THEN 1
                    ELSE 0
                END                                         AS delivered_on_time
            FROM purchase_orders po
            LEFT JOIN (
                SELECT po_id, MIN(received_date) AS first_received_date
                FROM goods_received
                GROUP BY po_id
            ) gr_first ON gr_first.po_id = po.po_id
            WHERE po.vendor_id = ?
            ORDER BY po.po_id DESC
        `, [vendorId]);
        const orders        = orderRows.map(r => ({
            po_id:                  r.po_id,
            po_number:              r.po_number,
            po_date:                r.po_date,
            item_name:              r.item_name,
            make:                   r.make,
            model:                  r.model,
            qty:                    Number(r.qty),
            unit:                   r.unit,
            price_per_unit:         Number(r.price_per_unit),
            total_price:            Number(r.total_price),
            expected_delivery_date: r.expected_delivery_date,
            first_received_date:    r.first_received_date,
            lead_time_days:         r.lead_time_days !== null ? Number(r.lead_time_days) : null,
            delivered_on_time:      Boolean(r.delivered_on_time),
            status:                 r.status
        }));
        const totalOrders       = orders.length;
        const orderValue        = orders.reduce((s, o) => s + o.total_price, 0);
        const openOrders        = orders.filter(o => ["DRAFT", "ISSUED"].includes(o.status)).length;
        const delivered         = orders.filter(o => o.lead_time_days !== null);
        const avgLeadTime       = delivered.length ? Number((delivered.reduce((s, o) => s + o.lead_time_days, 0) / delivered.length).toFixed(1)) : null;
        const onTimeCount       = delivered.filter(o => o.delivered_on_time).length;
        const onTimePct         = delivered.length ? Number(((onTimeCount / delivered.length) * 100).toFixed(1)) : null;
        return res.json({
            success: true,
            profile: profileRows[0],
            kpis: {
                total_orders:       totalOrders,
                order_value:        orderValue,
                avg_lead_time_days: avgLeadTime,
                on_time_deliveries: onTimeCount,
                total_deliveries:   delivered.length,
                on_time_pct:        onTimePct,
                open_orders:        openOrders
            },
            orders
        });
    } catch (error) {
        console.error(error);
        log(`Vendor performance detail fetch failed - ${error.message}`);
        return res.status(500).json({ success: false, message: "Failed to fetch vendor performance details" });
    }
});

// POST /vendor-performance/:vendor_id/blacklist - Blacklists a vendor so it no longer appears in vendor dropdowns or quotations
app.post("/vendor-performance/:vendor_id/blacklist", verifyManager, async (req, res) => {
    const vendorId = Number(req.params.vendor_id);
    const { reason } = req.body;
    if (!Number.isInteger(vendorId) || vendorId <= 0)return res.status(400).json({ success: false, message: "Invalid vendor ID" });
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();
        const [rows] = await connection.execute(`
            SELECT vendor_id, vendor_code, vendor_name, is_blacklisted
            FROM vendor_oem_masters
            WHERE vendor_id = ?
            FOR UPDATE
        `, [vendorId]);
        if (rows.length === 0) {
            await connection.rollback();
            return res.status(404).json({ success: false, message: "Vendor not found" });
        }
        const vendor = rows[0];
        if (vendor.is_blacklisted) {
            await connection.rollback();
            return res.status(409).json({ success: false, message: "Vendor is already blacklisted" });
        }
        await connection.execute(`
            UPDATE vendor_oem_masters SET is_blacklisted = TRUE WHERE vendor_id = ?
        `, [vendorId]);
        await connection.commit();
        log(`Vendor blacklisted - Vendor ID: ${vendorId}`);
        await writeReportLog(req, "VENDOR_BLACKLISTED",
            `Vendor "${vendor.vendor_name}" (${orDash(vendor.vendor_code)}, vendor ID ${vendorId}) blacklisted. ` +
            `Reason: ${orDash(reason)}. Vendor will no longer appear in vendor dropdowns or be selectable for new quotations.`
        );
        return res.json({ success: true, message: "Vendor blacklisted successfully" });
    } catch (error) {
        await connection.rollback();
        console.error(error);
        log(`Vendor blacklist failed - ${error.message}`);
        return res.status(500).json({ success: false, message: "Failed to blacklist vendor" });
    } finally {
        connection.release();
    }
});

// POST /vendor-performance/:vendor_id/unblacklist - Removes a vendor from the blacklist, restoring it to normal use
app.post("/vendor-performance/:vendor_id/unblacklist", verifyManager, async (req, res) => {
    const vendorId = Number(req.params.vendor_id);
    const { reason } = req.body;
    if (!Number.isInteger(vendorId) || vendorId <= 0)return res.status(400).json({ success: false, message: "Invalid vendor ID" });
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();
        const [rows] = await connection.execute(`
            SELECT vendor_id, vendor_code, vendor_name, is_blacklisted
            FROM vendor_oem_masters
            WHERE vendor_id = ?
            FOR UPDATE
        `, [vendorId]);
        if (rows.length === 0) {
            await connection.rollback();
            return res.status(404).json({ success: false, message: "Vendor not found" });
        }
        const vendor = rows[0];
        if (!vendor.is_blacklisted) {
            await connection.rollback();
            return res.status(409).json({ success: false, message: "Vendor is not blacklisted" });
        }
        await connection.execute(`
            UPDATE vendor_oem_masters SET is_blacklisted = FALSE WHERE vendor_id = ?
        `, [vendorId]);
        await connection.commit();
        log(`Vendor unblacklisted - Vendor ID: ${vendorId}`);
        await writeReportLog(req, "VENDOR_UNBLACKLISTED",
            `Vendor "${vendor.vendor_name}" (${orDash(vendor.vendor_code)}, vendor ID ${vendorId}) removed from blacklist. ` +
            `Reason: ${orDash(reason)}. Vendor is available again in vendor dropdowns and for new quotations.`
        );
        return res.json({ success: true, message: "Vendor removed from blacklist successfully" });
    } catch (error) {
        await connection.rollback();
        console.error(error);
        log(`Vendor unblacklist failed - ${error.message}`);
        return res.status(500).json({ success: false, message: "Failed to unblacklist vendor" });
    } finally {
        connection.release();
    }
});

app.get("/vendors/:vendor_id", verifyProcurement, async (req, res) => {
    const vendorId = Number(req.params.vendor_id);
    if (!Number.isInteger(vendorId) || vendorId <= 0) {
        return res.status(400).json({ success: false, message: "Invalid vendor ID" });
    }
    try {
        const [rows] = await db.execute(
            `SELECT * FROM vendor_oem_masters WHERE vendor_id = ? LIMIT 1`,
            [vendorId]
        );
        if (!rows.length) {
            return res.status(404).json({ success: false, message: "Vendor not found" });
        }
        return res.json({ success: true, vendor: rows[0] });
    } catch (error) {
        log(`Vendor fetch failed - ${error.message}`);
        return res.status(500).json({ success: false, message: "Failed to fetch vendor" });
    }
});

const VENDOR_EDITABLE_FIELDS = [
    "vendor_name",
    "commercial_role",
    "gst_number",
    "pan_number",
    "msme_number",
    "year_of_incorporation",
    "director_or_ceo_or_management_name",
    "director_or_ceo_or_management_designation",
    "director_or_ceo_or_management_mobile_no",
    "director_or_ceo_or_management_email",
    "director_or_ceo_or_management_web_address",
    "sales_team_name",
    "sales_team_contact",
    "sales_team_email",
    "accounts_team_name",
    "accounts_team_contact",
    "accounts_team_email",
    "office_address",
    "office_contact_name",
    "office_contact_number",
    "factory_address",
    "factory_contact_name",
    "factory_contact_number",
    "warehouse_address",
    "warehouse_contact_name",
    "warehouse_contact_number",
    "workshop_address",
    "workshop_contact_name",
    "workshop_contact_number",
    "branch_office_1_address",
    "branch_office_1_contact_name",
    "branch_office_1_contact_number",
    "branch_office_2_address",
    "branch_office_2_contact_name",
    "branch_office_2_contact_number",
    "branch_office_3_address",
    "branch_office_3_contact_name",
    "branch_office_3_contact_number",
    "turnover_year_1",
    "turnover_value_1",
    "turnover_year_2",
    "turnover_value_2",
    "turnover_year_3",
    "turnover_value_3",
    "recommended_by",
    "approved_by"
];

const VENDOR_FIELD_LABELS = {
    vendor_name: "Vendor Name",
    commercial_role: "Commercial Role",
    gst_number: "GST Number",
    pan_number: "PAN Number",
    msme_number: "MSME Number",
    year_of_incorporation: "Year of Incorporation",
    director_or_ceo_or_management_name: "Director/Management Name",
    director_or_ceo_or_management_designation: "Director Designation",
    director_or_ceo_or_management_mobile_no: "Director Mobile",
    director_or_ceo_or_management_email: "Director Email",
    director_or_ceo_or_management_web_address: "Director Web Address",
    sales_team_name: "Sales Team Name",
    sales_team_contact: "Sales Team Contact",
    sales_team_email: "Sales Team Email",
    accounts_team_name: "Accounts Team Name",
    accounts_team_contact: "Accounts Team Contact",
    accounts_team_email: "Accounts Team Email",
    office_address: "Office Address",
    office_contact_name: "Office Contact Name",
    office_contact_number: "Office Contact Number",
    factory_address: "Factory Address",
    factory_contact_name: "Factory Contact Name",
    factory_contact_number: "Factory Contact Number",
    warehouse_address: "Warehouse Address",
    warehouse_contact_name: "Warehouse Contact Name",
    warehouse_contact_number: "Warehouse Contact Number",
    workshop_address: "Workshop Address",
    workshop_contact_name: "Workshop Contact Name",
    workshop_contact_number: "Workshop Contact Number",
    branch_office_1_address: "Branch 1 Address",
    branch_office_1_contact_name: "Branch 1 Contact Name",
    branch_office_1_contact_number: "Branch 1 Contact Number",
    branch_office_2_address: "Branch 2 Address",
    branch_office_2_contact_name: "Branch 2 Contact Name",
    branch_office_2_contact_number: "Branch 2 Contact Number",
    branch_office_3_address: "Branch 3 Address",
    branch_office_3_contact_name: "Branch 3 Contact Name",
    branch_office_3_contact_number: "Branch 3 Contact Number",
    turnover_year_1: "Turnover Year 1",
    turnover_value_1: "Turnover Value 1",
    turnover_year_2: "Turnover Year 2",
    turnover_value_2: "Turnover Value 2",
    turnover_year_3: "Turnover Year 3",
    turnover_value_3: "Turnover Value 3",
    recommended_by: "Recommended By",
    approved_by: "Approved By",
    gst_document: "GST Document",
    pan_document: "PAN Document",
    msme_document: "MSME Document",
    itr_last_year_document: "ITR Last Year Document",
    itr_second_last_year_document: "ITR Second Last Year Document",
    itr_third_last_year_document: "ITR Third Last Year Document",
    legal_entity: "Legal Entity",
    bank_name: "Bank Name",
    bank_account_no: "Bank Account No.",
    bank_branch: "Bank Branch",
    bank_account_type: "Bank Account Type",
    bank_ifsc: "Bank IFSC Code"
};

function formatVendorChanges(changedFields, oldObj, newObj) {
    if (!changedFields.length) return "none";
    return changedFields.map(f => {
        const label = VENDOR_FIELD_LABELS[f] || f;
        const oldVal = (oldObj[f] !== null && oldObj[f] !== undefined && String(oldObj[f]).trim() !== "") ? `"${oldObj[f]}"` : 'empty';
        const newVal = (newObj[f] !== null && newObj[f] !== undefined && String(newObj[f]).trim() !== "") ? `"${newObj[f]}"` : 'empty';
        return `${label}: ${oldVal} → ${newVal}`;
    }).join("; ");
}

app.put("/vendors/:vendor_id", verifyAdmin, getVendorDocuments(), async (req, res) => {
    const vendorId = Number(req.params.vendor_id);
    if (!Number.isInteger(vendorId) || vendorId <= 0) {
        return res.status(400).json({ success: false, message: "Invalid vendor ID" });
    }

    let bodyData = { ...req.body };
    if (req.body.vendor_data) {
        try {
            const parsed = typeof req.body.vendor_data === "string" ? JSON.parse(req.body.vendor_data) : req.body.vendor_data;
            bodyData = { ...parsed, ...bodyData };
        } catch {
            // keep bodyData as is
        }
    }

    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        const [existing] = await connection.execute(
            `SELECT * FROM vendor_oem_masters WHERE vendor_id = ? LIMIT 1`,
            [vendorId]
        );
        if (!existing.length) {
            await connection.rollback();
            return res.status(404).json({ success: false, message: "Vendor not found" });
        }

        const old = existing[0];

        // Check if GST changed and conflicts with another vendor
        if (bodyData.gst_number && cleanValue(bodyData.gst_number) !== old.gst_number) {
            const cleanGst = cleanValue(bodyData.gst_number);
            const [existingGst] = await connection.execute(
                `SELECT vendor_id, vendor_name FROM vendor_oem_masters WHERE gst_number = ? AND vendor_id != ? LIMIT 1`,
                [cleanGst, vendorId]
            );
            if (existingGst.length > 0) {
                await connection.rollback();
                return res.status(409).json({
                    success: false,
                    message: `A vendor named "${existingGst[0].vendor_name}" already exists with this GST number`
                });
            }
        }

        const updates = [];
        const params  = [];
        const changed = [];

        for (const field of VENDOR_EDITABLE_FIELDS) {
            if (bodyData[field] !== undefined) {
                const cleaned = cleanValue(bodyData[field]);
                updates.push(`${field} = ?`);
                params.push(cleaned);
                if (String(old[field] ?? "") !== String(cleaned ?? "")) {
                    changed.push(field);
                }
            }
        }

        // Process any uploaded document files
        const files = req.files || {};
        if (Object.keys(files).length > 0) {
            const companyName = cleanValue(bodyData.vendor_name) || old.vendor_name || `vendor_${vendorId}`;
            const { documentLocations } = saveVendorDocuments(files, companyName);
            for (const [docField, docPath] of Object.entries(documentLocations)) {
                if (VENDOR_DOCUMENT_FIELDS.includes(docField)) {
                    updates.push(`${docField} = ?`);
                    params.push(docPath);
                    changed.push(docField);
                    bodyData[docField] = docPath;
                }
            }
        }

        if (!updates.length) {
            await connection.rollback();
            return res.status(400).json({ success: false, message: "No fields to update" });
        }

        params.push(vendorId);
        await connection.execute(
            `UPDATE vendor_oem_masters SET ${updates.join(", ")} WHERE vendor_id = ?`,
            params
        );

        const [updatedRows] = await connection.execute(
            `SELECT * FROM vendor_oem_masters WHERE vendor_id = ? LIMIT 1`,
            [vendorId]
        );

        await connection.commit();

        const changeDetails = formatVendorChanges(changed, old, bodyData);

        await writeReportLog(req, "VENDOR_UPDATED",
            `Vendor "${cleanValue(bodyData.vendor_name) || old.vendor_name}" (${orDash(old.vendor_code)}, vendor ID ${vendorId}) details updated. ` +
            `Changes: ${changeDetails}.`
        );

        await writeAuditLog(req, "VENDOR_UPDATED",
            JSON.stringify(Object.fromEntries(changed.map(f => [f, old[f]]))),
            JSON.stringify(Object.fromEntries(changed.map(f => [f, bodyData[f]])))
        );

        log(`Vendor updated - Vendor ID: ${vendorId}, Changes: ${changeDetails}`);

        return res.json({
            success: true,
            message: "Vendor details updated successfully",
            vendor: updatedRows[0]
        });

    } catch (error) {
        await connection.rollback();
        log(`Vendor update failed - ${error.message}`);
        return res.status(500).json({ success: false, message: "Failed to update vendor details: " + error.message });
    } finally {
        connection.release();
    }
});

const VENDOR_BANK_FIELDS = [
    "legal_entity",
    "bank_name",
    "bank_account_no",
    "bank_branch",
    "bank_account_type",
    "bank_ifsc"
];

app.put("/vendors/:vendor_id/bank", verifyAdmin, async (req, res) => {
    const vendorId = Number(req.params.vendor_id);
    if (!Number.isInteger(vendorId) || vendorId <= 0) {
        return res.status(400).json({ success: false, message: "Invalid vendor ID" });
    }

    const { password, ...bankData } = req.body;

    if (!password) {
        return res.status(400).json({ success: false, message: "Password is required to change bank details" });
    }

    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        // Verify admin password
        const [userRows] = await connection.execute(
            `SELECT password_hash FROM users WHERE user_id = ? LIMIT 1`,
            [req.user.user_id]
        );
        if (!userRows.length) {
            await connection.rollback();
            return res.status(401).json({ success: false, message: "User not found" });
        }

        const passwordMatch = await bcrypt.compare(password, userRows[0].password_hash);
        if (!passwordMatch) {
            await connection.rollback();
            return res.status(401).json({ success: false, message: "Incorrect password" });
        }

        const [existing] = await connection.execute(
            `SELECT * FROM vendor_oem_masters WHERE vendor_id = ? LIMIT 1`,
            [vendorId]
        );
        if (!existing.length) {
            await connection.rollback();
            return res.status(404).json({ success: false, message: "Vendor not found" });
        }

        const old = existing[0];
        const updates = [];
        const params  = [];

        for (const field of VENDOR_BANK_FIELDS) {
            if (bankData[field] !== undefined) {
                updates.push(`${field} = ?`);
                params.push(cleanValue(bankData[field]));
            }
        }

        if (!updates.length) {
            await connection.rollback();
            return res.status(400).json({ success: false, message: "No fields to update" });
        }

        params.push(vendorId);
        await connection.execute(
            `UPDATE vendor_oem_masters SET ${updates.join(", ")} WHERE vendor_id = ?`,
            params
        );

        await connection.commit();

        const changed = VENDOR_BANK_FIELDS.filter(f =>
            bankData[f] !== undefined &&
            String(old[f] ?? "") !== String(cleanValue(bankData[f]) ?? "")
        );

        const changeDetails = formatVendorChanges(changed, old, bankData);

        await writeReportLog(req, "VENDOR_BANK_UPDATED",
            `Bank/legal details updated for vendor "${old.vendor_name}" (${orDash(old.vendor_code)}, vendor ID ${vendorId}). ` +
            `Changes: ${changeDetails}. Password verified before save.`
        );

        await writeAuditLog(req, "VENDOR_BANK_UPDATED",
            JSON.stringify(Object.fromEntries(changed.map(f => [f, old[f]]))),
            JSON.stringify(Object.fromEntries(changed.map(f => [f, cleanValue(bankData[f])])))
        );

        log(`Vendor bank details updated - Vendor ID: ${vendorId}, Changes: ${changeDetails}`);

        return res.json({ success: true, message: "Bank details updated successfully" });

    } catch (error) {
        await connection.rollback();
        log(`Vendor bank update failed - ${error.message}`);
        return res.status(500).json({ success: false, message: "Failed to update bank details" });
    } finally {
        connection.release();
    }
});

// DELETE /vendors/:vendor_id - Delete vendor if no purchase orders exist
app.delete(["/vendors/:vendor_id", "/api/vendors/:vendor_id"], verifyAdmin, async (req, res) => {
    const vendorId = Number(req.params.vendor_id);
    log(`DELETE /vendors/${vendorId} - Delete Vendor request`);
    if (!Number.isInteger(vendorId) || vendorId <= 0) {
        return res.status(400).json({ success: false, message: "Invalid vendor ID" });
    }

    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        const [existing] = await connection.execute(
            `SELECT * FROM vendor_oem_masters WHERE vendor_id = ? LIMIT 1`,
            [vendorId]
        );
        if (!existing.length) {
            await connection.rollback();
            return res.status(404).json({ success: false, message: "Vendor not found" });
        }
        const vendor = existing[0];

        // 1. Check if vendor has purchase orders
        const [poRows] = await connection.execute(
            `SELECT COUNT(*) as count FROM purchase_orders WHERE vendor_id = ?`,
            [vendorId]
        );
        if (poRows[0].count > 0) {
            await connection.rollback();
            return res.status(400).json({
                success: false,
                message: `Cannot delete vendor "${vendor.vendor_name}" (${vendor.vendor_code || "ID " + vendorId}) because they are associated with ${poRows[0].count} Purchase Order(s). Historical order records must be preserved.`
            });
        }

        // 2. Clean up any unlinked vendor_inquiry_vendors records
        await connection.execute(
            `DELETE FROM vendor_inquiry_vendors WHERE vendor_id = ?`,
            [vendorId]
        );

        // 3. Delete from vendor_oem_masters
        await connection.execute(
            `DELETE FROM vendor_oem_masters WHERE vendor_id = ?`,
            [vendorId]
        );

        await connection.commit();

        const actorName = req.session?.user?.username || req.user?.username || "Admin";
        await writeReportLog(req, "VENDOR_DELETED",
            `${actorName} deleted vendor "${vendor.vendor_name}" (Vendor Number: ${orDash(vendor.vendor_code)}, ID: ${vendorId}).`
        );

        await writeAuditLog(req, "VENDOR_DELETED",
            JSON.stringify(vendor),
            null
        );

        log(`Vendor deleted successfully - Vendor ID: ${vendorId}, Name: "${vendor.vendor_name}"`);
        return res.json({ success: true, message: `Vendor "${vendor.vendor_name}" deleted successfully` });

    } catch (error) {
        await connection.rollback();
        log(`Vendor delete failed - ${error.message}`);
        return res.status(500).json({ success: false, message: "Failed to delete vendor: " + error.message });
    } finally {
        connection.release();
    }
});

/* ==========================================================================
   TAB: PAST PRICE REFERENCE
   ========================================================================== */

// GET /past-price-reference/models - Lists the distinct models ever purchased (with make, item and category) for the model picker
app.get("/past-price-reference/models", verifyProcurement, async (req, res) => {
    try {
        const [rows] = await db.execute(`
            SELECT DISTINCT
                model,
                make,
                item_name,
                product_category
            FROM purchase_orders
            WHERE model IS NOT NULL AND model != '' AND status IN ('ISSUED', 'COMPLETED')
            ORDER BY item_name ASC, make ASC, model ASC
        `);
        return res.json({ success: true, models: rows });
    } catch (error) {
        console.error(error);
        log(`Past price reference model list failed - ${error.message}`);
        return res.status(500).json({ success: false, message: "Failed to fetch model list" });
    }
});

// GET /past-price-reference - Purchase price history of one model/make/item: all purchases, the last three, and purchases grouped by vendor
app.get("/past-price-reference", verifyProcurement, async (req, res) => {
    const model = cleanValue(req.query.model);
    const make = cleanValue(req.query.make);
    const itemName = cleanValue(req.query.item_name);

    if (!model && !itemName) return res.status(400).json({ success: false, message: "Model or item name is required" });

    try {
        const conditions = [];
        const params = [];

        if (model) {
            conditions.push("po.model = ?");
            params.push(model);
        }
        if (make) {
            conditions.push("po.make = ?");
            params.push(make);
        }
        if (itemName) {
            conditions.push("po.item_name = ?");
            params.push(itemName);
        }

        // Only valid purchase orders (issued or completed)
        conditions.push("po.status IN ('ISSUED', 'COMPLETED')");

        const whereClause = `WHERE ${conditions.join(" AND ")}`;

        const [purchases] = await db.execute(`
            SELECT
                po.po_id,
                po.po_number,
                po.po_date,
                po.item_name,
                po.make,
                po.model,
                po.product_category,
                po.qty,
                po.unit,
                po.price_per_unit,
                po.total_price,
                COALESCE(vom.vendor_code, po.vendor_code) AS vendor_code,
                COALESCE(vom.vendor_name, po.vendor_name) AS vendor_name,
                po.status
            FROM purchase_orders po
            LEFT JOIN vendor_oem_masters vom ON po.vendor_id = vom.vendor_id
            ${whereClause}
            ORDER BY po.po_date DESC, po.po_id DESC
        `, params);

        if (!purchases.length) {
            return res.json({
                success: true,
                model: model || itemName,
                item_name: itemName || "",
                make: make || "",
                purchases: [],
                last3: [],
                byVendor: []
            });
        }

        const last3 = purchases.slice(0, 3);
        const vendorMap = {};
        purchases.forEach(p => {
            const key = p.vendor_code || p.vendor_name;
            if (!vendorMap[key]) {
                vendorMap[key] = {
                    vendor_code: p.vendor_code,
                    vendor_name: p.vendor_name,
                    purchases:   []
                };
            }
            vendorMap[key].purchases.push(p);
        });
        const byVendor = Object.values(vendorMap);

        return res.json({
            success:   true,
            model:     model || purchases[0].model,
            item_name: itemName || purchases[0].item_name,
            make:      make || purchases[0].make,
            purchases,
            last3,
            byVendor
        });
    } catch (error) {
        console.error(error);
        log(`Past price reference fetch failed - ${error.message}`);
        return res.status(500).json({ success: false, message: "Failed to fetch price history" });
    }
});

// GET /management-insights - Dashboard analytics for a chosen period: PR/PO overview, financials, trends, top performers, payments, receipts and PR-to-PO efficiency
app.get("/management-insights", verifyManager, async (req, res) => {
    try {
        const { period = "current_month", from, to } = req.query;
        const range = resolveInsightsRange(period, from, to);
        if (range.error)return res.status(400).json({ success: false, message: range.error });
        const { start, end } = range;
        const params = start ? [start, end] : [];
        const inRange = (col) => (start ? `${col} BETWEEN ? AND ?` : "1=1");
        const FIN = "po.status IN ('ISSUED','COMPLETED')";
        const run = (sql) => db.execute(sql, params);
        const UNIT = "COALESCE(po.unit, '')";
        const [
            [financialRows],
            [prRows],
            [monthlyFinRows],
            [monthlyPrRows],
            [monthlyStatusRows],
            [statusRows],
            [topMakeRows],
            [topModelRows],
            [topVendorRows],
            [dailyFinRows],
            [paymentRows],
            [receiptUnitRows],
            [efficiencyRows]
        ] = await Promise.all([
            run(`
                SELECT
                    COALESCE(SUM(pr.taxable_value), 0) AS total_sales_value,
                    COALESCE(SUM(po.total_price), 0)   AS total_procurement_value,
                    COALESCE(SUM(pr.taxable_value - po.total_price), 0) AS gross_profit,
                    COALESCE(SUM(pr.taxable_value - po.total_price)
                             / NULLIF(SUM(pr.taxable_value), 0) * 100, 0) AS gross_margin_percentage,
                    COALESCE(AVG(po.total_price), 0) AS average_po_value,
                    COALESCE(MAX(po.total_price), 0) AS highest_po_value,
                    COALESCE(MAX(pr.taxable_value - po.total_price), 0) AS highest_gross_profit
                FROM purchase_orders po
                INNER JOIN purchase_requests pr ON pr.id = po.pr_id
                WHERE ${inRange("COALESCE(po.po_date, DATE(po.created_at))")} AND ${FIN}
            `),
            run(`
                SELECT
                    COUNT(*) AS total_prs,
                    COALESCE(SUM(pr.taxable_value), 0) AS total_sales_value,
                    COALESCE(AVG(pr.taxable_value), 0) AS average_pr_value,
                    COALESCE(MAX(pr.taxable_value), 0) AS highest_pr_value
                FROM purchase_requests pr
                WHERE ${inRange("COALESCE(pr.pr_date, DATE(pr.created_at))")}
            `),
            run(`
                SELECT
                    DATE_FORMAT(COALESCE(po.po_date, DATE(po.created_at)), '%Y-%m') AS month,
                    COALESCE(SUM(pr.taxable_value), 0) AS sales_value,
                    COALESCE(SUM(po.total_price), 0)   AS procurement_value,
                    COALESCE(SUM(pr.taxable_value - po.total_price), 0) AS gross_profit,
                    COALESCE(SUM(pr.taxable_value - po.total_price)
                             / NULLIF(SUM(pr.taxable_value), 0) * 100, 0) AS gross_margin_percentage
                FROM purchase_orders po
                INNER JOIN purchase_requests pr ON pr.id = po.pr_id
                WHERE ${inRange("COALESCE(po.po_date, DATE(po.created_at))")} AND ${FIN}
                GROUP BY DATE_FORMAT(COALESCE(po.po_date, DATE(po.created_at)), '%Y-%m')
            `),
            run(`
                SELECT DATE_FORMAT(COALESCE(pr.pr_date, DATE(pr.created_at)), '%Y-%m') AS month, COUNT(*) AS pr_count
                FROM purchase_requests pr
                WHERE ${inRange("COALESCE(pr.pr_date, DATE(pr.created_at))")}
                GROUP BY DATE_FORMAT(COALESCE(pr.pr_date, DATE(pr.created_at)), '%Y-%m')
            `),
            run(`
                SELECT
                    DATE_FORMAT(COALESCE(po.po_date, DATE(po.created_at)), '%Y-%m') AS month,
                    COUNT(*) AS total_pos,
                    SUM(po.status = 'COMPLETED') AS completed_pos,
                    SUM(po.status = 'ISSUED')    AS issued_pos,
                    SUM(po.status = 'DRAFT')     AS draft_pos,
                    SUM(po.status = 'CANCELLED') AS cancelled_pos
                FROM purchase_orders po
                WHERE ${inRange("COALESCE(po.po_date, DATE(po.created_at))")}
                GROUP BY DATE_FORMAT(COALESCE(po.po_date, DATE(po.created_at)), '%Y-%m')
            `),
            run(`
                SELECT po.status, COUNT(*) AS po_count,
                       COALESCE(SUM(po.total_price), 0) AS procurement_value
                FROM purchase_orders po
                WHERE ${inRange("COALESCE(po.po_date, DATE(po.created_at))")}
                GROUP BY po.status
                ORDER BY po_count DESC
            `),
            run(`
                SELECT TRIM(po.make) AS make,
                       COUNT(*) AS po_count,
                       COALESCE(SUM(po.total_price), 0) AS procurement_value
                FROM purchase_orders po
                WHERE ${inRange("COALESCE(po.po_date, DATE(po.created_at))")} AND ${FIN}
                  AND po.make IS NOT NULL AND TRIM(po.make) <> ''
                GROUP BY TRIM(po.make)
                ORDER BY procurement_value DESC, po_count DESC
                LIMIT 1
            `),
            run(`
                SELECT TRIM(po.model) AS model,
                       MAX(TRIM(po.make)) AS make,
                       COUNT(*) AS po_count,
                       COALESCE(SUM(po.total_price), 0) AS procurement_value
                FROM purchase_orders po
                WHERE ${inRange("COALESCE(po.po_date, DATE(po.created_at))")} AND ${FIN}
                  AND po.model IS NOT NULL AND TRIM(po.model) <> ''
                GROUP BY TRIM(po.model)
                ORDER BY procurement_value DESC, po_count DESC
                LIMIT 1
            `),
            run(`
                SELECT po.vendor_id,
                       MAX(po.vendor_name) AS vendor_name,
                       MAX(po.vendor_code) AS vendor_code,
                       COUNT(*) AS po_count,
                       COALESCE(SUM(po.total_price), 0) AS procurement_value
                FROM purchase_orders po
                WHERE ${inRange("COALESCE(po.po_date, DATE(po.created_at))")} AND ${FIN}
                GROUP BY po.vendor_id
                ORDER BY procurement_value DESC, po_count DESC
                LIMIT 1
            `),
            run(`
                SELECT
                    DATE_FORMAT(COALESCE(po.po_date, DATE(po.created_at)), '%Y-%m-%d') AS day,
                    COALESCE(SUM(pr.taxable_value), 0) AS sales_value,
                    COALESCE(SUM(po.total_price), 0)   AS procurement_value,
                    COALESCE(SUM(pr.taxable_value - po.total_price), 0) AS gross_profit
                FROM purchase_orders po
                INNER JOIN purchase_requests pr ON pr.id = po.pr_id
                WHERE ${inRange("COALESCE(po.po_date, DATE(po.created_at))")} AND ${FIN}
                GROUP BY DATE_FORMAT(COALESCE(po.po_date, DATE(po.created_at)), '%Y-%m-%d')
            `),
            run(`
                SELECT COALESCE(po.payment_type, 'Not Specified') AS payment_type,
                       COUNT(*) AS po_count,
                       COALESCE(SUM(po.total_price), 0) AS procurement_value
                FROM purchase_orders po
                WHERE ${inRange("COALESCE(po.po_date, DATE(po.created_at))")} AND ${FIN}
                GROUP BY COALESCE(po.payment_type, 'Not Specified')
                ORDER BY procurement_value DESC
            `),
            run(`
                SELECT ${UNIT} AS unit,
                       COUNT(*) AS receipts,
                       COALESCE(SUM(gr.received_quantity), 0) AS received
                FROM goods_received gr
                INNER JOIN purchase_orders po ON po.po_id = gr.po_id
                WHERE ${inRange("COALESCE(gr.received_date, DATE(gr.created_at))")}
                GROUP BY ${UNIT}
            `),
            run(`
                SELECT
                    AVG(DATEDIFF(COALESCE(po.po_date, DATE(po.created_at)), COALESCE(pr.pr_date, DATE(pr.created_at)))) AS average_pr_to_po_days,
                    MIN(DATEDIFF(COALESCE(po.po_date, DATE(po.created_at)), COALESCE(pr.pr_date, DATE(pr.created_at)))) AS fastest_pr_to_po_days,
                    MAX(DATEDIFF(COALESCE(po.po_date, DATE(po.created_at)), COALESCE(pr.pr_date, DATE(pr.created_at)))) AS slowest_pr_to_po_days,
                    COUNT(*) AS sample_size
                FROM purchase_orders po
                INNER JOIN purchase_requests pr ON pr.id = po.pr_id
                WHERE ${inRange("COALESCE(po.po_date, DATE(po.created_at))")}
                  AND po.status <> 'CANCELLED'
                  AND COALESCE(po.po_date, DATE(po.created_at)) >= COALESCE(pr.pr_date, DATE(pr.created_at))
            `)
        ]);
        const fin = financialRows[0] || {};
        const prs = prRows[0] || {};
        const eff = efficiencyRows[0] || {};
        const statusCount = (s) => num(statusRows.find(r => r.status === s)?.po_count);
        const totalPos = statusRows.reduce((sum, r) => sum + num(r.po_count), 0);
        const finMap = new Map(monthlyFinRows.map(r => [r.month, r]));
        const prMap = new Map(monthlyPrRows.map(r => [r.month, r]));
        const stMap = new Map(monthlyStatusRows.map(r => [r.month, r]));
        const months = monthsBetween([...finMap.keys(), ...prMap.keys(), ...stMap.keys()]);
        const monthlyProcurement = months.map(month => {
            const f = finMap.get(month);
            return {
                month,
                pr_count: num(prMap.get(month)?.pr_count),
                po_count: num(stMap.get(month)?.total_pos),
                sales_value: num(f?.sales_value),
                procurement_value: num(f?.procurement_value),
                gross_profit: num(f?.gross_profit),
                gross_margin_percentage: num(f?.gross_margin_percentage)
            };
        });
        const monthlyCompletion = months.map(month => {
            const s = stMap.get(month) || {};
            return {
                month,
                total_pos: num(s.total_pos),
                completed_pos: num(s.completed_pos),
                issued_pos: num(s.issued_pos),
                draft_pos: num(s.draft_pos),
                cancelled_pos: num(s.cancelled_pos)
            };
        });
        const dayMap = new Map(dailyFinRows.map(r => [r.day, r]));
        const dayKeys = [...dayMap.keys()].sort();
        const todayStr = ymd(new Date());
        const dayFrom = start || dayKeys[0];
        let dayTo = end || dayKeys[dayKeys.length - 1] || todayStr;
        if (dayTo > todayStr && (!dayKeys.length || dayKeys[dayKeys.length - 1] <= todayStr)) {
            dayTo = todayStr;
        }
        const dailyProcurement = (dayFrom && dayTo && dayFrom <= dayTo) ? daysBetween(dayFrom, dayTo).map(day => {
            const r = dayMap.get(day);
            return {
                day,
                sales_value: num(r?.sales_value),
                procurement_value: num(r?.procurement_value),
                gross_profit: num(r?.gross_profit)
            };
        }) : [];
        const topMake = topMakeRows[0] ? { name: topMakeRows[0].make, po_count: num(topMakeRows[0].po_count), procurement_value: num(topMakeRows[0].procurement_value) } : null;
        const topModel = topModelRows[0] ? { name: topModelRows[0].model, make: topModelRows[0].make || "", po_count: num(topModelRows[0].po_count), procurement_value: num(topModelRows[0].procurement_value) } : null;
        const topVendor = topVendorRows[0] ? { name: topVendorRows[0].vendor_name, code: topVendorRows[0].vendor_code || "", po_count: num(topVendorRows[0].po_count), procurement_value: num(topVendorRows[0].procurement_value) } : null;
        const nullableNum = (v) => (v === null || v === undefined ? null : Number(v));
        return res.json({
            success: true,
            period: { type: period, from: start, to: end },
            overview: {
                total_prs: num(prs.total_prs),
                total_pos: totalPos,
                draft_pos: statusCount("DRAFT"),
                issued_pos: statusCount("ISSUED"),
                completed_pos: statusCount("COMPLETED"),
                cancelled_pos: statusCount("CANCELLED"),
                average_po_value: num(fin.average_po_value),
                highest_po_value: num(fin.highest_po_value)
            },
            financial: {
                total_sales_value: num(fin.total_sales_value),
                total_procurement_value: num(fin.total_procurement_value),
                gross_profit: num(fin.gross_profit),
                gross_margin_percentage: num(fin.gross_margin_percentage),
                highest_gross_profit: num(fin.highest_gross_profit)
            },
            purchase_requests: {
                total: num(prs.total_prs),
                total_sales_value: num(prs.total_sales_value),
                average_pr_value: num(prs.average_pr_value),
                highest_pr_value: num(prs.highest_pr_value)
            },
            trends: {
                daily_procurement: dailyProcurement,
                monthly_procurement: monthlyProcurement,
                monthly_completion: monthlyCompletion
            },
            top_performers: { make: topMake, model: topModel, vendor: topVendor },
            payment_types: paymentRows,
            po_status: statusRows,
            goods_received: {
                total_receipts: receiptUnitRows.reduce((s, r) => s + num(r.receipts), 0),
                by_unit: receiptUnitRows.map(r => ({
                    unit: r.unit,
                    received: num(r.received)
                }))
            },
            efficiency: {
                average_pr_to_po_days: nullableNum(eff.average_pr_to_po_days),
                fastest_pr_to_po_days: nullableNum(eff.fastest_pr_to_po_days),
                slowest_pr_to_po_days: nullableNum(eff.slowest_pr_to_po_days),
                sample_size: num(eff.sample_size)
            }
        });
    } catch (error) {
        console.error("Management Insights Error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to load management insights"
        });
    }
});

// GET /report-logs - Paginated business-activity history from report_logs, optionally filtered by username, action, and date range
app.get("/report-logs", verifyManager, async (req, res) => {
    const page  = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 25));
    const offset = (page - 1) * limit;
    const username = cleanValue(req.query.username);
    const action   = cleanValue(req.query.action);
    const from     = cleanValue(req.query.from);
    const to       = cleanValue(req.query.to);
    const conditions = [];
    const params = [];
    if (username) { conditions.push("username = ?"); params.push(username); }
    if (action)   { conditions.push("action = ?"); params.push(action); }
    if (from)     { conditions.push("log_timestamp >= ?"); params.push(`${from} 00:00:00`); }
    if (to)       { conditions.push("log_timestamp <= ?"); params.push(`${to} 23:59:59`); }
    const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    try {
        const [[[{ total }]], [rows]] = await Promise.all([
            logDb.execute(
                `SELECT COUNT(*) AS total FROM report_logs ${whereClause}`,
                params
            ),
            logDb.query(
                `SELECT report_log_id, log_timestamp, username, action, report
                FROM report_logs
                ${whereClause}
                ORDER BY log_timestamp DESC, report_log_id DESC
                LIMIT ? OFFSET ?`,
                [...params, limit, offset]
            )
        ]);
        const totalPages = Math.max(1, Math.ceil(total / limit));
        return res.json({
            success: true,
            rows,
            pagination: {
                page,
                limit,
                total,
                total_pages: totalPages,
                has_prev: page > 1,
                has_next: page < totalPages
            }
        });
    } catch (error) {
        console.error(error);
        log(`Report log fetch failed - ${error.message}`);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch report logs"
        });
    }
});

// GET /audit-logs - Paginated administrative/system change history from audit_logs, optionally filtered by username, action, and date range
app.get("/audit-logs", verifyAdmin, async (req, res) => {
    const page  = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 25));
    const offset = (page - 1) * limit;
    const username = cleanValue(req.query.username);
    const action   = cleanValue(req.query.action);
    const from     = cleanValue(req.query.from);
    const to       = cleanValue(req.query.to);
    const conditions = [];
    const params = [];
    if (username) { conditions.push("username = ?"); params.push(username); }
    if (action)   { conditions.push("action = ?"); params.push(action); }
    if (from)     { conditions.push("log_timestamp >= ?"); params.push(`${from} 00:00:00`); }
    if (to)       { conditions.push("log_timestamp <= ?"); params.push(`${to} 23:59:59`); }
    const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    try {
        const [[[{ total }]], [rows]] = await Promise.all([
            logDb.execute(
                `SELECT COUNT(*) AS total FROM audit_logs ${whereClause}`,
                params
            ),
            logDb.query(
                `SELECT audit_log_id, log_timestamp, username, action, old_value, new_value
                FROM audit_logs
                ${whereClause}
                ORDER BY log_timestamp DESC, audit_log_id DESC
                LIMIT ? OFFSET ?`,
                [...params, limit, offset]
            )
        ]);
        const totalPages = Math.max(1, Math.ceil(total / limit));
        return res.json({
            success: true,
            rows,
            pagination: {
                page,
                limit,
                total,
                total_pages: totalPages,
                has_prev: page > 1,
                has_next: page < totalPages
            }
        });
    } catch (error) {
        console.error(error);
        log(`Audit log fetch failed - ${error.message}`);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch audit logs"
        });
    }
});

// GET /login-logs - Paginated access history from login_logs
app.get("/login-logs", verifyAdmin, async (req, res) => {
    const page  = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 25));
    const offset = (page - 1) * limit;

    const username = cleanValue(req.query.username);
    const from     = cleanValue(req.query.from);
    const to       = cleanValue(req.query.to);

    const conditions = [];
    const params = [];

    if (username) { conditions.push("u.username = ?"); params.push(username); }
    if (from)     { conditions.push("ll.login_time >= ?"); params.push(`${from} 00:00:00`); }
    if (to)       { conditions.push("ll.login_time <= ?"); params.push(`${to} 23:59:59`); }

    const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    try {
        const [[[{ total }]], [rows]] = await Promise.all([
            db.execute(
                `SELECT COUNT(*) AS total
                 FROM login_logs ll
                 INNER JOIN users u ON u.user_id = ll.user_id
                 ${whereClause}`,
                params
            ),
            db.query(
                `SELECT
                    ll.login_log_id,
                    ll.login_time,
                    u.username,
                    ll.login_status
                 FROM login_logs ll
                 INNER JOIN users u ON u.user_id = ll.user_id
                 ${whereClause}
                 ORDER BY ll.login_time DESC, ll.login_log_id DESC
                 LIMIT ? OFFSET ?`,
                [...params, limit, offset]
            )
        ]);

        const totalPages = Math.max(1, Math.ceil(total / limit));

        return res.json({
            success: true,
            rows,
            pagination: {
                page,
                limit,
                total,
                total_pages: totalPages,
                has_prev: page > 1,
                has_next: page < totalPages
            }
        });

    } catch (error) {
        console.error(error);
        log(`Login log fetch failed - ${error.message}`);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch access logs"
        });
    }
});

const { errorHandler } = require("./middleware/error.middleware");
app.use(errorHandler);

module.exports = app;

