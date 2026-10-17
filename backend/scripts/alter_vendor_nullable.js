const { db } = require('../src/config/database');

async function run() {
    try {
        const alterQuery = `
            ALTER TABLE vendor_oem_masters
            MODIFY COLUMN sales_team_name TEXT NULL,
            MODIFY COLUMN sales_team_contact TEXT NULL,
            MODIFY COLUMN sales_team_email TEXT NULL,
            MODIFY COLUMN accounts_team_name TEXT NULL,
            MODIFY COLUMN accounts_team_contact TEXT NULL,
            MODIFY COLUMN accounts_team_email TEXT NULL,
            MODIFY COLUMN turnover_year_1 VARCHAR(20) NULL,
            MODIFY COLUMN turnover_value_1 VARCHAR(100) NULL,
            MODIFY COLUMN gst_document TEXT NULL,
            MODIFY COLUMN pan_document TEXT NULL,
            MODIFY COLUMN itr_last_year_document TEXT NULL,
            MODIFY COLUMN branch_office_1_address TEXT NULL,
            MODIFY COLUMN recommended_by TEXT NULL,
            MODIFY COLUMN approved_by TEXT NULL
        `;
        await db.query(alterQuery);
        console.log("SUCCESS: vendor_oem_masters columns modified to NULLable");
        process.exit(0);
    } catch (err) {
        console.error("ERROR modifying table:", err);
        process.exit(1);
    }
}

run();
