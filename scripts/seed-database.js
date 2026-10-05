/**
 * ProcureIQ Automated Database Seeder
 * Applies migration and seed SQL scripts sequentially into MySQL.
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../backend/.env') });
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

async function runSeed() {
    console.log('Connecting to database:', process.env.DB_HOST, process.env.DB_NAME);

    const connection = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || 'Password@123',
        multipleStatements: true
    });

    try {
        console.log('Provisioning databases...');
        await connection.query(`CREATE DATABASE IF NOT EXISTS \`${process.env.DB_NAME || 'ProcureIQ'}\`;`);
        await connection.query(`CREATE DATABASE IF NOT EXISTS \`${process.env.DB2_NAME || 'ProcureIQ_Logs'}\`;`);

        await connection.changeUser({ database: process.env.DB_NAME || 'ProcureIQ' });

        // Apply migrations
        const migrationsDir = path.resolve(__dirname, '../database/migrations');
        if (fs.existsSync(migrationsDir)) {
            const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();
            for (const file of files) {
                console.log(`Executing migration: ${file}`);
                const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
                if (file.includes('audit_logs')) {
                    await connection.changeUser({ database: process.env.DB2_NAME || 'ProcureIQ_Logs' });
                    await connection.query(sql);
                    await connection.changeUser({ database: process.env.DB_NAME || 'ProcureIQ' });
                } else {
                    await connection.query(sql);
                }
            }
        }

        // Apply seeds
        const seedsDir = path.resolve(__dirname, '../database/seeds');
        if (fs.existsSync(seedsDir)) {
            const files = fs.readdirSync(seedsDir).filter(f => f.endsWith('.sql')).sort();
            for (const file of files) {
                console.log(`Executing seed: ${file}`);
                const sql = fs.readFileSync(path.join(seedsDir, file), 'utf8');
                await connection.query(sql);
            }
        }

        console.log('✔ All migrations and seeds applied successfully!');
    } catch (err) {
        console.error('Database seeding failed:', err.message);
        process.exit(1);
    } finally {
        await connection.end();
    }
}

runSeed();
