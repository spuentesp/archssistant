const sqlite3 = require('sqlite3').verbose();

// Use in-memory DB for tests, file-based for all other environments
const dbPath = process.env.NODE_ENV === 'test' ? ':memory:' : './archssistant.db';

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening database', err.message);
    } else {
        console.log('Connected to the SQLite database.');
        db.run(`CREATE TABLE IF NOT EXISTS conversations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            userId TEXT NOT NULL,
            conversation TEXT,
            isActive INTEGER DEFAULT 1,
            createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
            updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);
    }
});

function getOrCreateConversation(userId) {
    return new Promise((resolve, reject) => {
        db.get('SELECT * FROM conversations WHERE userId = ? AND isActive = 1 ORDER BY updatedAt DESC', [userId], (err, row) => {
            if (err) {
                return reject(err);
            }
            if (row) {
                resolve(JSON.parse(row.conversation));
            } else {
                const newConversation = {
                    userId: userId,
                    detectedParameters: {},
                    userQuestions: [],
                    fullHistory: []
                };
                const conversationJson = JSON.stringify(newConversation);
                db.run('INSERT INTO conversations (userId, conversation) VALUES (?, ?)', [userId, conversationJson], function(err) {
                    if (err) {
                        return reject(err);
                    }
                    resolve(newConversation);
                });
            }
        });
    });
}

function saveConversation(userId, conversation) {
    return new Promise((resolve, reject) => {
        const conversationJson = JSON.stringify(conversation);
        db.run('UPDATE conversations SET conversation = ?, updatedAt = CURRENT_TIMESTAMP WHERE userId = ? AND isActive = 1', [conversationJson, userId], function(err) {
            if (err) {
                return reject(err);
            }
            resolve();
        });
    });
}

function loadUserConversations(userId) {
    return new Promise((resolve, reject) => {
        db.all('SELECT * FROM conversations WHERE userId = ? ORDER BY createdAt DESC', [userId], (err, rows) => {
            if (err) {
                return reject(err);
            }
            resolve(rows.map(row => ({...row, conversation: JSON.parse(row.conversation)})));
        });
    });
}

function archiveConversation(userId) {
    return new Promise((resolve, reject) => {
        db.run('UPDATE conversations SET isActive = 0 WHERE userId = ? AND isActive = 1', [userId], function(err) {
            if (err) {
                return reject(err);
            }
            resolve();
        });
    });
}

module.exports = {
    getOrCreateConversation,
    saveConversation,
    loadUserConversations,
    archiveConversation
};
