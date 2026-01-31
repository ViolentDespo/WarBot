
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
    db.prepare(`
        CREATE TABLE IF NOT EXISTS settings (
            guild_id TEXT PRIMARY KEY,
            leader_role_id TEXT,
            participant_role_id TEXT,
            default_channel_id TEXT
        )
    `).run();

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
