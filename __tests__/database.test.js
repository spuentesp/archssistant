const database = require('../db/database');

describe('Database Functions', () => {
    beforeAll(async () => {
        // Use an in-memory database for testing
        await database.initDB(':memory:');
    });

    afterAll(async () => {
        await database.closeDB();
    });

    beforeEach(async () => {
        // Clear the conversations table before each test
        const db = database.getDB();
        await new Promise((resolve, reject) => {
            db.run('DELETE FROM conversations', (err) => {
                if (err) return reject(err);
                resolve();
            });
        });
    });

    test('createConversation should insert a new conversation and return it', async () => {
        const userId = 'user1';
        const conversation = await database.createConversation(userId);

        expect(conversation).toBeDefined();
        expect(typeof conversation.id).toBe('string');
        expect(conversation.userId).toBe(userId);
        expect(conversation.state).toBe('initial');
        expect(conversation.isActive).toBe(true);
        expect(conversation.params).toEqual({});
        expect(conversation.history).toEqual([]);
    });

    test('getConversation should retrieve a specific conversation by ID', async () => {
        const userId = 'user2';
        const newConv = await database.createConversation(userId);
        const retrievedConv = await database.getConversation(newConv.id);

        expect(retrievedConv).toBeDefined();
        expect(retrievedConv.id).toBe(newConv.id);
        expect(retrievedConv.userId).toBe(userId);
    });

    test('getConversation should return null if conversation does not exist', async () => {
        const conversation = await database.getConversation('non-existent-id');
        expect(conversation).toBeNull();
    });

    test('saveConversation should update an existing conversation', async () => {
        const userId = 'user3';
        let conversation = await database.createConversation(userId);

        // Modify the conversation object
        conversation.state = 'awaiting_params';
        conversation.intent = 'clarify_intent';
        const params = { missing: 'component' };
        const history = [{ user: 'q1', assistant: 'a1' }];
        conversation.params = params;
        conversation.history = history;

        await database.saveConversation(conversation);

        const updatedConv = await database.getConversation(conversation.id);
        expect(updatedConv.state).toBe('awaiting_params');
        expect(updatedConv.intent).toBe('clarify_intent');
        expect(updatedConv.params).toEqual(params);
        expect(updatedConv.history).toEqual(history);
    });

    test('getConversationsForUser should retrieve all conversations for a user', async () => {
        const userId = 'user4';
        await database.createConversation(userId);
        await database.createConversation(userId);

        const conversations = await database.getConversationsForUser(userId);
        expect(conversations.length).toBe(2);
        expect(conversations[0].userId).toBe(userId);
        expect(conversations[1].userId).toBe(userId);
    });

    test('archiveConversation should mark a conversation as inactive', async () => {
        const userId = 'user5';
        const conversation = await database.createConversation(userId);
        await database.archiveConversation(conversation.id);

        const archivedConv = await database.getConversation(conversation.id);
        expect(archivedConv.isActive).toBe(false);

        // Check that it's not returned when fetching only active conversations
        const activeConversations = await database.getConversationsForUser(userId, true);
        expect(activeConversations.length).toBe(0);
    });

    test('getConversationsForUser should respect the activeOnly flag', async () => {
        const userId = 'user6';
        const conv1 = await database.createConversation(userId);
        const conv2 = await database.createConversation(userId);

        await database.archiveConversation(conv1.id);

        const allConvs = await database.getConversationsForUser(userId, false); // all
        expect(allConvs.length).toBe(2);

        const activeConvs = await database.getConversationsForUser(userId, true); // active only
        expect(activeConvs.length).toBe(1);
        expect(activeConvs[0].id).toBe(conv2.id);
    });

    test('getActiveConversationForUser should retrieve the most recent active conversation', async () => {
        const userId = 'user7';
        const conv1 = await database.createConversation(userId);
        await database.archiveConversation(conv1.id); // Archive the first one
        const conv2 = await database.createConversation(userId); // This one is active

        const activeConv = await database.getActiveConversationForUser(userId);
        expect(activeConv).toBeDefined();
        expect(activeConv.id).toBe(conv2.id);
        expect(activeConv.isActive).toBe(true);
    });

    test('getActiveConversationForUser should return null if no active conversations exist', async () => {
        const userId = 'user8';
        const conv1 = await database.createConversation(userId);
        await database.archiveConversation(conv1.id);

        const activeConv = await database.getActiveConversationForUser(userId);
        expect(activeConv).toBeNull();
    });

    test('archiveAllConversationsForUser should mark all user conversations as inactive', async () => {
        const userId = 'user9';
        await database.createConversation(userId);
        await database.createConversation(userId);

        let activeConvs = await database.getConversationsForUser(userId, true);
        expect(activeConvs.length).toBe(2);

        await database.archiveAllConversationsForUser(userId);

        activeConvs = await database.getConversationsForUser(userId, true);
        expect(activeConvs.length).toBe(0);

        const allConvs = await database.getConversationsForUser(userId, false);
        expect(allConvs.length).toBe(2);
        expect(allConvs[0].isActive).toBe(false);
        expect(allConvs[1].isActive).toBe(false);
    });
});
