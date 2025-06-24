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

                // Comprehensive migration to add any missing columns.
                db.all("PRAGMA table_info(conversations)", (err, existingColumns) => {
                    if (err) {
                        console.error("Error getting table info:", err);
                        return reject(err);
                    }

                    console.log("Existing columns info:", existingColumns);

                    const existingColumnNames = existingColumns.map(c => c.name);

                    const expectedSchema = {
                        params: 'TEXT',
                        history: 'TEXT',
                        intent: 'TEXT',
                        state: 'TEXT',
                        isActive: 'INTEGER DEFAULT 1',
                        createdAt: 'DATETIME DEFAULT CURRENT_TIMESTAMP',
                        updatedAt: 'DATETIME DEFAULT CURRENT_TIMESTAMP'
                    };

                    const migrations = Object.entries(expectedSchema)
                        .filter(([name]) => !existingColumnNames.includes(name))
                        .map(([name, definition]) => {
                            return new Promise((res, rej) => {
                                console.log(`Running migration: Adding missing column "${name}".`);
                                db.run(`ALTER TABLE conversations ADD COLUMN ${name} ${definition}`, (e) => e ? rej(e) : res());
                            });
                        });

                    if (migrations.length > 0) {
                        console.log(`Found ${migrations.length} missing columns to add.`);
                        Promise.all(migrations)
                            .then(() => {
                                console.log('Database migration completed successfully.');
                                resolve();
                            })
                            .catch(err => {
                                console.error('Database migration failed:', err);
                                reject(err);
                            });
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
        console.log(`[database] Attempting to create conversation for userId: ${userId}`);
        const newConversation = {
            id: uuidv4(),
            userId,
            params: JSON.stringify({}),
            history: JSON.stringify([]),
            intent: '',
            state: 'initial',
            isActive: 1,
        };

        const sql = `INSERT INTO conversations (id, userId, params, history, intent, state, isActive)
                     VALUES (?, ?, ?, ?, ?, ?, ?)`;
        
        console.log(`[database] Executing SQL: ${sql}`);
        const sqlParams = [newConversation.id, newConversation.userId, newConversation.params, newConversation.history, newConversation.intent, newConversation.state, newConversation.isActive];
        console.log('[database] Parameters:', sqlParams);
        db.run(sql, sqlParams, function(err) {
            if (err) {
                console.error('[database] Error creating conversation:', err);
                return reject(err);
            }
            console.log(`[database] Conversation created with id: ${newConversation.id}`);
            // Return the full conversation object
            getConversation(newConversation.id).then(resolve).catch(reject);
        });
    });
}


function getConversation(id) {
    return new Promise((resolve, reject) => {
        console.log(`[database] Attempting to get conversation with id: ${id}`);
        console.log('[database] Parameters:', [id]);
        db.get('SELECT * FROM conversations WHERE id = ?', [id], (err, row) => {
            if (err) {
                console.error(`[database] Error getting conversation with id ${id}:`, err);
                return reject(err);
            }
            if (row) {
                console.log(`[database] Found conversation with id: ${id}`);
                row.params = JSON.parse(row.params || '{}');
                row.history = JSON.parse(row.history || '[]');
                row.isActive = !!row.isActive; // Convert integer to boolean
            } else {
                console.log(`[database] No conversation found with id: ${id}`);
            }
            resolve(row || null);
        });
    });
}

function getActiveConversationForUser(userId) {
    return new Promise((resolve, reject) => {
        console.log(`[database] Attempting to get active conversation for userId: ${userId}`);
        db.get(
            'SELECT * FROM conversations WHERE userId = ? AND isActive = 1 ORDER BY updatedAt DESC LIMIT 1',
            [userId],
            (err, row) => {
                if (err) {
                    console.error(`[database] Error getting active conversation for userId ${userId}:`, err);
                    return reject(err);
                }
                if (row) {
                    console.log(`[database] Found active conversation with id: ${row.id}`);
                    row.params = JSON.parse(row.params || '{}');
                    row.history = JSON.parse(row.history || '[]');
                    row.isActive = !!row.isActive;
                } else {
                    console.log(`[database] No active conversation found for userId: ${userId}`);
                }
                resolve(row || null);
            }
        );
    });
}

function archiveAllConversationsForUser(userId) {
    return new Promise((resolve, reject) => {
        console.log(`[database] Archiving all conversations for userId: ${userId}`);
        const sql = 'UPDATE conversations SET isActive = 0 WHERE userId = ?';
        db.run(sql, [userId], function(err) {
            if (err) {
                console.error(`[database] Error archiving conversations for userId ${userId}:`, err);
                return reject(err);
            }
            console.log(`[database] Archived ${this.changes} conversations for userId: ${userId}`);
            resolve();
        });
    });
}

function archiveAllConversationsForUserExceptOne(userId, conversationIdToKeepActive) {
    return new Promise((resolve, reject) => {
        console.log(`[database] Archiving all conversations for userId: ${userId} except for ${conversationIdToKeepActive}`);
        const sql = 'UPDATE conversations SET isActive = 0 WHERE userId = ? AND id != ?';
        db.run(sql, [userId, conversationIdToKeepActive], function(err) {
            if (err) {
                console.error(`[database] Error archiving other conversations for userId ${userId}:`, err);
                return reject(err);
            }
            console.log(`[database] Archived ${this.changes} other conversations for userId: ${userId}`);
            resolve();
        });
    });
}

function saveConversation(conversation) {
    return new Promise((resolve, reject) => {
        console.log(`[database] Attempting to save conversation with id: ${conversation.id}`, conversation);
        const { id, params, history, intent, state, isActive } = conversation;
        const sql = `UPDATE conversations
                     SET params = ?, history = ?, intent = ?, state = ?, isActive = ?, updatedAt = CURRENT_TIMESTAMP
                     WHERE id = ?`;
        const paramsString = typeof params === 'string' ? params : JSON.stringify(params);
        const historyString = typeof history === 'string' ? history : JSON.stringify(history);
        
        // Ensure isActive is always an integer (0 or 1)
        let isActiveInt;
        if (typeof isActive === 'boolean') {
            isActiveInt = isActive ? 1 : 0;
        } else if (isActive === null || isActive === undefined) {
            isActiveInt = 1; // Default to active if not specified
        } else {
            isActiveInt = isActive; // Assume it's already 0 or 1
        }

        const sqlParams = [paramsString, historyString, intent, state, isActiveInt, id];
        console.log(`[database] Executing SQL: ${sql}`);
        console.log('[database] Parameters:', sqlParams);
        db.run(sql, sqlParams, function(err) {
            if (err) {
                console.error(`[database] Error saving conversation with id ${id}:`, err);
                return reject(err);
            }
            console.log(`[database] Successfully saved conversation with id: ${id}`);
            resolve();
        });
    });
}

function getConversationsForUser(userId, activeOnly = false) {
    return new Promise((resolve, reject) => {
        console.log(`[database] Getting conversations for userId: ${userId}, activeOnly: ${activeOnly}`);
        let sql = 'SELECT * FROM conversations WHERE userId = ?';
        const params = [userId];

        if (activeOnly) {
            sql += ' AND isActive = 1';
        }
        sql += ' ORDER BY createdAt DESC';

        console.log(`[database] Executing SQL: ${sql}`);
        console.log('[database] Parameters:', params);
        db.all(sql, params, (err, rows) => {
            if (err) {
                console.error(`[database] Error getting conversations for userId ${userId}:`, err);
                return reject(err);
            }
            console.log(`[database] Found ${rows.length} conversations for userId: ${userId}`);
            resolve(rows.map(row => ({
                ...row,
                params: JSON.parse(row.params || '{}'),
                history: JSON.parse(row.history || '[]'),
                isActive: !!row.isActive
            })));
        });
    });
}

function archiveConversation(id) {
    return new Promise((resolve, reject) => {
        console.log(`[database] Archiving conversation with id: ${id}`);
        const sql = `UPDATE conversations SET isActive = 0, updatedAt = CURRENT_TIMESTAMP WHERE id = ?`;
        console.log(`[database] Executing SQL: ${sql}`);
        console.log('[database] Parameters:', [id]);
        db.run(sql, [id], function(err) {
            if (err) {
                console.error(`[database] Error archiving conversation with id ${id}:`, err);
                return reject(err);
            }
            console.log(`[database] Successfully archived conversation with id: ${id}`);
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
    getActiveConversationForUser,
    archiveAllConversationsForUser,
    archiveAllConversationsForUserExceptOne,
    saveConversation,
    getConversationsForUser,
    archiveConversation,
};
