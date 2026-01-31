
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const dbPath = process.env.DB_PATH || path.join(__dirname, '../../db.sqlite');
// Ensure the directory exists if we are using a custom path
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
}

export const db = new Database(dbPath);

// Enable WAL mode for better concurrency
db.pragma('journal_mode = WAL');

export const initDb = () => {
    // Settings Table
    // Note: If you have an existing DB, you might need to drop the table or migrate manually.
    db.prepare(`
        CREATE TABLE IF NOT EXISTS settings (
            guild_id TEXT PRIMARY KEY,
            leader_role_ids TEXT,
            participant_role_ids TEXT,
            default_channel_id TEXT
        )
    `).run();

    // Quick migration attempt for dev (optional, but helpful if user keeps DB)
    try {
        const info = db.pragma('table_info(settings)') as any[];
        const hasLeaderId = info.some(c => c.name === 'leader_role_id');
        if (hasLeaderId) {
            console.log('Migrating settings table...');
            db.prepare('ALTER TABLE settings RENAME COLUMN leader_role_id TO leader_role_ids').run();
            db.prepare('ALTER TABLE settings RENAME COLUMN participant_role_id TO participant_role_ids').run();
            // Data will be old ID (string), which is not a JSON array, but we can handle that in code or update it here.
            // Let's just rename for now, the code will check if it's array-like later.
        }
    } catch (e) {
        // Ignore errors if columns don't exist etc
    }

    // Readychecks Table
    db.prepare(`
        CREATE TABLE IF NOT EXISTS readychecks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            message_id TEXT NOT NULL,
            channel_id TEXT NOT NULL,
            guild_id TEXT NOT NULL,
            creator_id TEXT NOT NULL,
            war_name TEXT NOT NULL,
            start_time INTEGER NOT NULL,
            status TEXT CHECK(status IN ('active', 'ended', 'removed')) DEFAULT 'active',
            participating_guilds TEXT NOT NULL -- JSON array of guild names
        )
    `).run();

    // Signups Table
    db.prepare(`
        CREATE TABLE IF NOT EXISTS signups (
            user_id TEXT NOT NULL,
            readycheck_id INTEGER NOT NULL,
            guild_name TEXT NOT NULL,
            class_name TEXT NOT NULL,
            PRIMARY KEY (user_id, readycheck_id),
            FOREIGN KEY (readycheck_id) REFERENCES readychecks(id) ON DELETE CASCADE
        )
    `).run();

    console.log('Database initialized at ' + dbPath);
};
