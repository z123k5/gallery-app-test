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
        );`,
        `INSERT INTO users (name, email, active) VALUES ('admin', 'admin@example.com', 1);`
        ] // end of statements
    },
    /* add new statements below for next database version when required*/
    {
        toVersion: 2,
        statements: [
        `CREATE TABLE IF NOT EXISTS media (
        identifier TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        modified_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        thumbnailV1Path TEXT,
        thumbnailV2Path TEXT,
        source TEXT NOT NULL,
        isDeleted INTEGER DEFAULT 0,
        processInfo INTEGER DEFAULT 0,
        feature BLOB DEFAULT 0,
        phash TEXT DEFAULT ''
        );`,
            `CREATE TABLE IF NOT EXISTS classes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        artificial INTEGER DEFAULT 0
        );`,
            `CREATE TABLE IF NOT EXISTS media_classes (
        media_id TEXT NOT NULL,
        class_id INTEGER NOT NULL,
        artificial INTEGER DEFAULT 0,
        PRIMARY KEY (media_id, class_id),
        FOREIGN KEY (media_id) REFERENCES media(identifier) ON DELETE CASCADE ON UPDATE CASCADE,
        FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE ON UPDATE CASCADE
        );`, // 默认添加一些分类
            `INSERT INTO classes (name, artificial) VALUES ('人物', 0);`,
            `INSERT INTO classes (name, artificial) VALUES ('动物', 0);`,
            `INSERT INTO classes (name, artificial) VALUES ('植物', 0);`,
            `INSERT INTO classes (name, artificial) VALUES ('食物', 0);`,
            `INSERT INTO classes (name, artificial) VALUES ('建筑', 0);`,
            `INSERT INTO classes (name, artificial) VALUES ('家具', 0);`,
            `INSERT INTO classes (name, artificial) VALUES ('交通工具', 0);`,
            `INSERT INTO classes (name, artificial) VALUES ('电子产品', 0);`,
            `INSERT INTO classes (name, artificial) VALUES ('服装', 0);`,
            `INSERT INTO classes (name, artificial) VALUES ('乐器', 0);`,
            `INSERT INTO classes (name, artificial) VALUES ('屏幕截图', 0);`,
        ]
    },
    {
        toVersion: 3,
        statements: [
            `CREATE TABLE IF NOT EXISTS logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        message TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );`,
            `CREATE TABLE IF NOT EXISTS media_metadata (
            media_id TEXT NOT NULL PRIMARY KEY,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            exif_lat REAL,
            exif_lon REAL,
            exif_dev TEXT,
            location TEXT,
            FOREIGN KEY (media_id) REFERENCES media(identifier) ON DELETE CASCADE ON UPDATE CASCADE
        );`,
            `CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        );`,
        ]
    }
]
