const {
    getOrCreateConversation,
    saveConversation,
    loadUserConversations,
    archiveConversation
} = require('../db/database');
const sqlite3 = require('sqlite3').verbose();

// This is a reference to the in-memory database created in database.js
const db = new sqlite3.Database(':memory:');

describe('Database Functions', () => {

    // Setup the table before all tests
    beforeAll((done) => {
        db.serialize(() => {
            db.run(`CREATE TABLE IF NOT EXISTS conversations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                userId TEXT NOT NULL,
                conversation TEXT,
                isActive INTEGER DEFAULT 1,
                createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
                updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
            )`);
            done();
        });
    });

    // Clear the table before each test
    beforeEach((done) => {
        db.run('DELETE FROM conversations', () => {
            done();
        });
    });

    // Close the DB connection after all tests
    afterAll((done) => {
        db.close(() => {
            done();
        });
    });

    test('getOrCreateConversation should create a new conversation for a new user', async () => {
        const userId = 'testUser1';
        const conversation = await getOrCreateConversation(userId);

        expect(conversation).toBeDefined();
        expect(conversation.userId).toBe(userId);
        expect(conversation.fullHistory).toEqual([]);
    });

    test('getOrCreateConversation should return an existing active conversation', async () => {
        const userId = 'testUser2';
        const initialConv = await getOrCreateConversation(userId);
        initialConv.fullHistory.push({ question: 'q1', answer: 'a1' });
        await saveConversation(userId, initialConv);

        const retrievedConv = await getOrCreateConversation(userId);
        expect(retrievedConv.fullHistory.length).toBe(1);
        expect(retrievedConv.fullHistory[0].question).toBe('q1');
    });

    test('saveConversation should update a conversation', async () => {
        const userId = 'testUser3';
        let conversation = await getOrCreateConversation(userId);
        conversation.userQuestions.push('is this saved?');
        await saveConversation(userId, conversation);

        const savedConv = await getOrCreateConversation(userId);
        expect(savedConv.userQuestions).toContain('is this saved?');
    });

    test('loadUserConversations should return all conversations for a user', async () => {
        const userId = 'testUser4';
        await getOrCreateConversation(userId); // First conversation
        await archiveConversation(userId);       // Archive it
        await getOrCreateConversation(userId); // Create a new active one

        const allConversations = await loadUserConversations(userId);
        expect(allConversations.length).toBe(2);
        expect(allConversations.find(c => c.isActive === 0)).toBeDefined();
        expect(allConversations.find(c => c.isActive === 1)).toBeDefined();
    });

    test('archiveConversation should mark a conversation as inactive', async () => {
        const userId = 'testUser5';
        await getOrCreateConversation(userId);
        await archiveConversation(userId);

        const conversations = await loadUserConversations(userId);
        expect(conversations[0].isActive).toBe(0);

        // Check that getOrCreateConversation now makes a new one
        const newConversation = await getOrCreateConversation(userId);
        expect(newConversation.fullHistory.length).toBe(0);
    });
});
