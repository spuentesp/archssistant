const sqlite3 = require('sqlite3').verbose();
const { v4: uuidv4 } = require('uuid');

let db;

function initDB(dbPath = './archssistant.db') {
    return new Promise((resolve, reject) => {
        db = new sqlite3.Database(dbPath, (err) => {
            if (err) {
                console.error('Error opening database', err.message);
                return reject(err);
            }
            console.log('Connected to the SQLite database.');

            const createTableSql = `CREATE TABLE IF NOT EXISTS conversations (
                id TEXT PRIMARY KEY,
                userId TEXT NOT NULL,
                params TEXT,
                history TEXT,
                intent TEXT,
                state TEXT,
                isActive INTEGER DEFAULT 1,
                createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
                updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
            )`;

            db.run(createTableSql, (err) => {
                if (err) {
                    return reject(err);
                }

                // Migration for columns that might be missing in older DBs
                db.all("PRAGMA table_info(conversations)", (err, columns) => {
                    if (err) {
                        console.error("Error getting table info:", err);
                        return reject(err);
                    }

                    const columnNames = columns.map(c => c.name);
                    const migrations = [];

                    if (!columnNames.includes('params')) {
                        migrations.push(new Promise((res, rej) => {
                            console.log('Running migration: Adding "params" column.');
                            db.run('ALTER TABLE conversations ADD COLUMN params TEXT', e => e ? rej(e) : res());
                        }));
                    }

                    if (!columnNames.includes('intent')) {
                        migrations.push(new Promise((res, rej) => {
                            console.log('Running migration: Adding "intent" column.');
                            db.run('ALTER TABLE conversations ADD COLUMN intent TEXT', e => e ? rej(e) : res());
                        }));
                    }

                    if (migrations.length > 0) {
                        Promise.all(migrations)
                            .then(() => {
                                console.log('Database migration completed.');
                                resolve();
                            })
                            .catch(reject);
                    } else {
                        console.log('Database schema is up to date.');
                        resolve();
                    }
                });
            });
        });
    });
}

function getDB() {
    if (!db) {
        throw new Error("Database not initialized. Call initDB first.");
    }
    return db;
}

function closeDB() {
    return new Promise((resolve, reject) => {
        if (db) {
            db.close((err) => {
                if (err) {
                    return reject(err);
                }
                console.log('Closed the database connection.');
                db = null;
                resolve();
            });
        } else {
            resolve();
        }
    });
}

function createConversation(userId) {
    return new Promise((resolve, reject) => {
        const newConversation = {
            id: uuidv4(),
            userId,
            params: JSON.stringify({}),
            history: JSON.stringify([]),
            intent: null,
            state: 'initial',
            isActive: 1,
        };

        const sql = `INSERT INTO conversations (id, userId, params, history, intent, state, isActive, createdAt, updatedAt)
                     VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`;

        db.run(sql, [newConversation.id, newConversation.userId, newConversation.params, newConversation.history, newConversation.intent, newConversation.state, newConversation.isActive], function(err) {
            if (err) {
                return reject(err);
            }
            // Return the full conversation object
            getConversation(newConversation.id).then(resolve).catch(reject);
        });
    });
}


function getConversation(id) {
    return new Promise((resolve, reject) => {
        db.get('SELECT * FROM conversations WHERE id = ?', [id], (err, row) => {
            if (err) {
                return reject(err);
            }
            if (row) {
                row.params = JSON.parse(row.params || '{}');
                row.history = JSON.parse(row.history || '[]');
            }
            resolve(row || null);
        });
    });
}

function saveConversation(conversation) {
    return new Promise((resolve, reject) => {
        const { id, params, history, intent, state, isActive } = conversation;
        const sql = `UPDATE conversations
                     SET params = ?, history = ?, intent = ?, state = ?, isActive = ?, updatedAt = CURRENT_TIMESTAMP
                     WHERE id = ?`;
        const paramsString = typeof params === 'string' ? params : JSON.stringify(params);
        const historyString = typeof history === 'string' ? history : JSON.stringify(history);

        db.run(sql, [paramsString, historyString, intent, state, isActive, id], function(err) {
            if (err) {
                return reject(err);
            }
            resolve();
        });
    });
}

function getConversationsForUser(userId, activeOnly = false) {
    return new Promise((resolve, reject) => {
        let sql = 'SELECT * FROM conversations WHERE userId = ?';
        const params = [userId];

        if (activeOnly) {
            sql += ' AND isActive = 1';
        }
        sql += ' ORDER BY createdAt DESC';

        db.all(sql, params, (err, rows) => {
            if (err) {
                return reject(err);
            }
            resolve(rows.map(row => ({
                ...row,
                params: JSON.parse(row.params || '{}'),
                history: JSON.parse(row.history || '[]')
            })));
        });
    });
}

function archiveConversation(id) {
    return new Promise((resolve, reject) => {
        const sql = `UPDATE conversations SET isActive = 0, updatedAt = CURRENT_TIMESTAMP WHERE id = ?`;
        db.run(sql, [id], function(err) {
            if (err) {
                return reject(err);
            }
            resolve();
        });
    });
}


module.exports = {
    initDB,
    getDB,
    closeDB,
    createConversation,
    getConversation,
    saveConversation,
    getConversationsForUser,
    archiveConversation,
};
