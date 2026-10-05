/**
 * ProcureIQ Automated Database Backup Utility
 * Exports MySQL databases to timestamped SQL dump files.
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../backend/.env') });
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function backup() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupDir = path.resolve(__dirname, '../database/backups');
    if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
    }

    const host = process.env.DB_HOST || 'localhost';
    const user = process.env.DB_USER || 'root';
    const password = process.env.DB_PASSWORD || '';
    const db1 = process.env.DB_NAME || 'ProcureIQ';
    const db2 = process.env.DB2_NAME || 'ProcureIQ_Logs';

    const dumpFile1 = path.join(backupDir, `${db1}_${timestamp}.sql`);
    const dumpFile2 = path.join(backupDir, `${db2}_${timestamp}.sql`);

    console.log(`Creating backup for ${db1} and ${db2}...`);

    try {
        const passArg = password ? `-p"${password}"` : '';
        execSync(`mysqldump -h ${host} -u ${user} ${passArg} ${db1} > "${dumpFile1}"`, { stdio: 'inherit' });
        console.log(`✔ Dumped ${db1} to ${dumpFile1}`);

        execSync(`mysqldump -h ${host} -u ${user} ${passArg} ${db2} > "${dumpFile2}"`, { stdio: 'inherit' });
        console.log(`✔ Dumped ${db2} to ${dumpFile2}`);

        console.log('Database backup completed successfully!');
    } catch (err) {
        console.error('Backup failed:', err.message);
    }
}

backup();
