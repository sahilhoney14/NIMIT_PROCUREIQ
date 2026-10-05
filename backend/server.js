require("dotenv").config();
const app = require("./src/app");
const { db, logDb } = require("./src/config/db");
const { log } = require("./src/utils/logger");

const PORT = process.env.PORT || 3000;

app.listen(PORT, async () => {
    log(`=======================================================`);
    log(`   ProcureIQ Enterprise Unified Server (Port ${PORT})   `);
    log(`=======================================================`);

    try {
        await db.query("SELECT 1");
        log("Main Database connection successful (ProcureIQ)");
    } catch (err) {
        log(`Main Database connection failed: ${err.message}`);
    }

    try {
        await logDb.query("SELECT 1");
        log("Audit Database connection successful (ProcureIQ_Logs)");
    } catch (err) {
        log(`Audit Database connection failed: ${err.message}`);
    }

    log(`Server running at http://localhost:${PORT}`);
    log(`Auth / Login: http://localhost:${PORT}/`);
    log(`Admin Portal: http://localhost:${PORT}/admin`);
    log(`Procurement Manager Portal: http://localhost:${PORT}/procurement-manager`);
    log(`Procurement Portal: http://localhost:${PORT}/procurement`);
});
