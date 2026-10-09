const { db } = require("../src/config/database");

async function test() {
    try {
        const [rows] = await db.query("SELECT @@sql_mode");
        console.log("SQL_MODE:", rows[0]["@@sql_mode"]);

        // Test 1: Vendor Performance Query
        console.log("Testing vendor performance query...");
        const [vp] = await db.execute(`
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
            ORDER BY vom.vendor_name ASC
        `);
        console.log("Vendor performance query SUCCESS! Rows:", vp.length);

        // Test 2: Edit Vendor (/vendors/all) Query
        console.log("Testing /vendors/all query...");
        const [vAll] = await db.execute(`
            SELECT vendor_id, vendor_code, vendor_name
            FROM vendor_oem_masters
            ORDER BY vendor_name ASC
        `);
        console.log("/vendors/all query SUCCESS! Rows:", vAll.length);

        // Test 3: Past Price Reference models query
        console.log("Testing /past-price-reference/models query...");
        const [models] = await db.execute(`
            SELECT DISTINCT model, make, item_name, product_category
            FROM purchase_orders
            WHERE model IS NOT NULL AND model != ''
            ORDER BY model ASC
        `);
        console.log("/past-price-reference/models query SUCCESS! Rows:", models.length);

        // Test 4: Management Insights Query
        console.log("Testing management insights query...");
        const from = "2026-10-01";
        const to = "2026-10-31";
        const [prStats] = await db.execute(`
            SELECT COUNT(*) AS total_prs, COALESCE(SUM(taxable_value), 0) AS total_pr_cost
            FROM purchase_requests
            WHERE pr_date BETWEEN ? AND ?
        `, [from, to]);
        console.log("Management insights query SUCCESS! prStats:", prStats[0]);

        // Test 5: Report Logs Query
        console.log("Testing report logs query in audit db...");
        const { logDb } = require("../src/config/database");
        const [logs] = await logDb.execute(`
            SELECT report_log_id, log_timestamp, username, action, report
            FROM report_logs
            ORDER BY log_timestamp DESC
            LIMIT 20
        `);
        console.log("Report logs query SUCCESS! Rows:", logs.length);

    } catch (e) {
        console.error("TEST FAILED WITH ERROR:", e.message);
        console.error(e.stack);
    }
    process.exit(0);
}

test();
