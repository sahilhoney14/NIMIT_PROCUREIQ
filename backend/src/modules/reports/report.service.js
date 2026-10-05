const { logDb } = require("../../config/database");

async function getReportLogs({ page = 1, limit = 25, username, from, to }) {
    const offset = (page - 1) * limit;
    let whereClauses = [];
    let params = [];

    if (username) {
        whereClauses.push("username LIKE ?");
        params.push(`%${username}%`);
    }
    if (from) {
        whereClauses.push("log_timestamp >= ?");
        params.push(`${from} 00:00:00`);
    }
    if (to) {
        whereClauses.push("log_timestamp <= ?");
        params.push(`${to} 23:59:59`);
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";

    const [countRows] = await logDb.query(`SELECT COUNT(*) AS total FROM report_logs ${whereSql}`, params);
    const total = countRows[0].total;

    const [rows] = await logDb.query(
        `SELECT * FROM report_logs ${whereSql} ORDER BY log_timestamp DESC LIMIT ? OFFSET ?`,
        [...params, limit, offset]
    );

    const total_pages = Math.ceil(total / limit) || 1;
    return {
        rows,
        pagination: {
            page: Number(page),
            limit: Number(limit),
            total,
            total_pages,
            has_prev: page > 1,
            has_next: page < total_pages
        }
    };
}

module.exports = {
    getReportLogs
};
