/**
 * Direct Batch Vendor Importer
 * Reads vendor names from 001_GrpSum.xlsx (Column 2, starting from Row 2)
 * and inserts them into vendor_oem_masters with auto-generated vendor codes.
 */

const path = require("path");
const backendDir = path.resolve(__dirname, "../backend");
require(path.join(backendDir, "node_modules/dotenv")).config({ path: path.join(backendDir, ".env") });
const ExcelJS = require(path.join(backendDir, "node_modules/exceljs"));
const mysql = require(path.join(backendDir, "node_modules/mysql2/promise"));

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

function getFinancialYear() {
    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth() + 1;
    const startYear = currentMonth >= 4 ? currentYear : currentYear - 1;
    const endYear = startYear + 1;
    return `${String(startYear).slice(-2)}${String(endYear).slice(-2)}`;
}

async function importVendors() {
    const excelPath = path.resolve(__dirname, "../../001_GrpSum.xlsx");
    console.log(`Reading Excel file from: ${excelPath}`);

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(excelPath);
    const sheet = wb.worksheets[0];

    const vendorNames = [];
    for (let r = 2; r <= sheet.rowCount; r++) {
        const val = sheet.getRow(r).getCell(2).value;
        if (val && String(val).trim()) {
            vendorNames.push(String(val).trim());
        }
    }

    console.log(`Found ${vendorNames.length} valid vendor names in column 2 starting from row 2.`);
    if (vendorNames.length === 0) {
        console.error("No vendor names found to import!");
        return;
    }

    const host = process.env.DB_HOST || "localhost";
    const user = process.env.DB_USER || "root";
    const password = process.env.DB_PASSWORD || "Password@123";
    const dbName = process.env.DB_NAME || "ProcureIQ";

    const connection = await mysql.createConnection({
        host,
        user,
        password,
        database: dbName
    });

    try {
        await connection.beginTransaction();

        const todayStr = new Date().toISOString().slice(0, 10);
        const fy = getFinancialYear(); // e.g. "2627"

        console.log(`Starting bulk insert for ${vendorNames.length} vendors with FY: ${fy}...`);

        let insertedCount = 0;
        for (let i = 0; i < vendorNames.length; i++) {
            const vName = vendorNames[i];
            const vendorObj = {
                registration_date: todayStr,
                vendor_name: vName,
                recommended_by: "admin",
                approved_by: "admin"
            };

            const columns = [...VENDOR_FIELDS];
            const values = columns.map(field => {
                if (vendorObj[field] !== undefined && vendorObj[field] !== null) {
                    return vendorObj[field];
                }
                return "";
            });

            const placeholders = columns.map(() => "?").join(", ");
            const [insertRes] = await connection.execute(
                `INSERT INTO vendor_oem_masters (${columns.join(", ")}) VALUES (${placeholders})`,
                values
            );

            const vendorId = insertRes.insertId;
            const vendorCode = `NEE${fy}V${String(vendorId).padStart(3, "0")}`;

            await connection.execute(
                `UPDATE vendor_oem_masters SET vendor_code = ? WHERE vendor_id = ?`,
                [vendorCode, vendorId]
            );

            insertedCount++;
            if (insertedCount % 100 === 0 || insertedCount === vendorNames.length) {
                console.log(`  Inserted ${insertedCount}/${vendorNames.length} vendors (Latest code: ${vendorCode})`);
            }
        }

        await connection.commit();
        console.log(`\n✔ Successfully imported all ${insertedCount} vendors!`);
        console.log(`  Range: NEE${fy}V001 to NEE${fy}V${String(insertedCount).padStart(3, "0")}`);

    } catch (err) {
        await connection.rollback();
        console.error("Error importing vendors:", err.message);
        process.exit(1);
    } finally {
        await connection.end();
    }
}

importVendors();
