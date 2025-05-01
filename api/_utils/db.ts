// api/_utils/db.ts
import Database from 'better-sqlite3'
import { join } from 'path'

const dbPath = process.env.NODE_ENV === 'production'
    ? '/var/task/db.sqlite3'
    : join(process.cwd(), 'db.sqlite3')

export const db = new Database(dbPath)

// On startup, create table if missing
db
    .prepare(`
    CREATE TABLE IF NOT EXISTS users (
      steamID64   TEXT PRIMARY KEY,
      tier        TEXT     NOT NULL DEFAULT 'Cadet',
      updatedAt   INTEGER  NOT NULL
    )
  `)
    .run()

export default db
