const { db } = require("../src/config/database");

async function testInsights() {
    try {
        const period = "current_month";
        const from = null;
        const to = null;
        const now = new Date();
        const start = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
        const endDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
        const end = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(endDay).padStart(2, "0")}`;

        const params = [start, end];
        const inRange = (col) => `${col} BETWEEN ? AND ?`;
        const FIN = "po.status IN ('ISSUED','COMPLETED')";
        const run = (sql) => db.execute(sql, params);
        const UNIT = "COALESCE(po.unit, '')";

        const res = await Promise.all([
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
            `)
        ]);

        console.log("Insights test succeeded!");
    } catch (e) {
        console.error("Insights test failed:", e.message);
    }
    process.exit(0);
}

testInsights();
