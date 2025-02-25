export const UserUpgradeStatements = [
    {
        toVersion: 1,
        statements: [
            `CREATE TABLE IF NOT EXISTS users (
        identifier INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        active INTEGER DEFAULT 1,
        token_expire DATETIME DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS media (
        identifier string PRIMARY KEY,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        thumbnail TEXT,
        processStep INTEGER DEFAULT 0,
        feature BLOB DEFAULT 0
        );` 
        ]
    },
    /* add new statements below for next database version when required*/
    /*
    {
    toVersion: 2,
    statements: [
        `ALTER TABLE users ADD COLUMN email TEXT;`,
    ]
    },
    */
]