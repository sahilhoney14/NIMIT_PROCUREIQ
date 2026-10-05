const fs = require("fs");
const path = require("path");
const { sanitizeFolderName, getFileExtension } = require("../utils/sanitizers");
const { log } = require("../utils/logger");

const vendorFolder = path.resolve(__dirname, "../../vendor");

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
    "nature_of_business",
    "established_year",
    "annual_turnover",
    "gst_number",
    "pan_number",
    "msme_type",
    "bank_name",
    "bank_branch",
    "account_number",
    "ifsc_code",
    "is_active"
];

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

        // Store standard relative path for backward compatibility
        documentLocations[fieldName] = `../vendor/${folderName}/${fileName}`;
    }

    return { documentLocations, createdFiles, companyFolder };
}

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

function parseVendorData(req) {
    if (!req.body.vendor_data) return null;
    try {
        return typeof req.body.vendor_data === "string" ? JSON.parse(req.body.vendor_data) : req.body.vendor_data;
    } catch {
        return null;
    }
}

module.exports = {
    vendorFolder,
    VENDOR_FIELDS,
    saveVendorDocuments,
    cleanupFiles,
    parseVendorData
};
