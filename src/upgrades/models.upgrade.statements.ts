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
        identifier TEXT PRIMARY KEY,
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
    {
        toVersion: 2,
        statements: [
            `CREATE TABLE IF NOT EXISTS users (
        identifier INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        active INTEGER DEFAULT 1,
        token_expire DATETIME DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS media (
        identifier TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        thumbnail TEXT,
        processStep INTEGER DEFAULT 0,
        feature BLOB DEFAULT 0
        );`,
            `CREATE TABLE IF NOT EXISTS classes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        artificial INTEGER DEFAULT 0
        );`,
            `CREATE TABLE IF NOT EXISTS media_classes (
        media_id TEXT NOT NULL,
        class_id INTEGER NOT NULL,
        PRIMARY KEY (media_id, class_id),
        FOREIGN KEY (media_id) REFERENCES media(identifier),
        FOREIGN KEY (class_id) REFERENCES classes(id)
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
]
