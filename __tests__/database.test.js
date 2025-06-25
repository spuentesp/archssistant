const database = require('../db/database');

describe('Database Functions', () => {
    beforeAll(async () => {
        // Use an in-memory database for testing
        await database.initializeDatabase(':memory:');
    });

    afterAll(async () => {
        // Database connection will be closed automatically
        // No getDB function available in the current implementation
    });

    beforeEach(async () => {
        // Since we don't have direct access to the database instance,
        // we'll rely on the fact that we're using :memory: database
        // which gets cleared between test runs, or we can create isolated users
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
        expect(conversation.questionsAsked).toBe(0);
    });

    test('getConversation should retrieve a specific conversation by ID', async () => {
        const userId = 'user2';
        const newConv = await database.createConversation(userId);
        const retrievedConv = await database.getConversation(newConv.id);

        expect(retrievedConv).toBeDefined();
        expect(retrievedConv.id).toBe(newConv.id);
        expect(retrievedConv.userId).toBe(userId);
        expect(retrievedConv.state).toBe('initial');
        expect(retrievedConv.isActive).toBe(true);
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
        const params = { missing: 'component' };
        const history = [{ user: 'q1', assistant: 'a1' }];
        conversation.params = params;
        conversation.history = history;
        conversation.questionsAsked = 3;

        await database.saveConversation(conversation);

        const updatedConv = await database.getConversation(conversation.id);
        expect(updatedConv.state).toBe('awaiting_params');
        expect(updatedConv.params).toEqual(params);
        expect(updatedConv.history).toEqual(history);
        expect(updatedConv.questionsAsked).toBe(3);
    });

    test('getConversations should retrieve all conversations for a user', async () => {
        const userId = 'user4';
        await database.createConversation(userId);
        await database.createConversation(userId);

        const conversations = await database.getConversations(userId);
        expect(conversations.length).toBe(2);
        expect(conversations[0].userId).toBe(userId);
        expect(conversations[1].userId).toBe(userId);
        // Should be ordered by updatedAt DESC
        expect(conversations[0].createdAt).toBeDefined();
        expect(conversations[1].createdAt).toBeDefined();
    });

    test('archiveConversation should mark a conversation as inactive', async () => {
        const userId = 'user5';
        const conversation = await database.createConversation(userId);
        
        expect(conversation.isActive).toBe(true);
        
        await database.archiveConversation(conversation.id);

        const archivedConv = await database.getConversation(conversation.id);
        expect(archivedConv.isActive).toBe(false);
    });

    test('getActiveConversation should retrieve the most recent active conversation', async () => {
        const userId = 'user7';
        const conv1 = await database.createConversation(userId);
        await database.archiveConversation(conv1.id); // Archive the first one
        
        // Wait a bit to ensure different timestamps
        await new Promise(resolve => setTimeout(resolve, 10));
        
        const conv2 = await database.createConversation(userId); // This one is active

        const activeConv = await database.getActiveConversation(userId);
        expect(activeConv).toBeDefined();
        expect(activeConv.id).toBe(conv2.id);
        expect(activeConv.isActive).toBe(true);
    });

    test('getActiveConversation should return null if no active conversations exist', async () => {
        const userId = 'user8';
        const conv1 = await database.createConversation(userId);
        await database.archiveConversation(conv1.id);

        const activeConv = await database.getActiveConversation(userId);
        expect(activeConv).toBeNull();
    });

    test('unarchiveConversation should reactivate a conversation and deactivate others', async () => {
        const userId = 'user9';
        const conv1 = await database.createConversation(userId);
        const conv2 = await database.createConversation(userId);
        
        // Archive both conversations
        await database.archiveConversation(conv1.id);
        await database.archiveConversation(conv2.id);
        
        // Verify both are archived
        let activeConv = await database.getActiveConversation(userId);
        expect(activeConv).toBeNull();
        
        // Unarchive the first conversation
        await database.unarchiveConversation(conv1.id, userId);
        
        // Verify conv1 is now active and conv2 remains archived
        activeConv = await database.getActiveConversation(userId);
        expect(activeConv).toBeDefined();
        expect(activeConv.id).toBe(conv1.id);
        expect(activeConv.isActive).toBe(true);
        
        const conv2Updated = await database.getConversation(conv2.id);
        expect(conv2Updated.isActive).toBe(false);
    });

    test('unarchiveConversation should make only one conversation active when user has multiple active', async () => {
        const userId = 'user10';
        const conv1 = await database.createConversation(userId);
        const conv2 = await database.createConversation(userId);
        const conv3 = await database.createConversation(userId);
        
        // Archive conv2
        await database.archiveConversation(conv2.id);
        
        // Unarchive conv2 - this should archive conv1 and conv3
        await database.unarchiveConversation(conv2.id, userId);
        
        // Verify only conv2 is active
        const activeConv = await database.getActiveConversation(userId);
        expect(activeConv.id).toBe(conv2.id);
        
        const conv1Updated = await database.getConversation(conv1.id);
        const conv3Updated = await database.getConversation(conv3.id);
        
        expect(conv1Updated.isActive).toBe(false);
        expect(conv3Updated.isActive).toBe(false);
    });

    test('saveConversation should preserve all conversation properties', async () => {
        const userId = 'user11';
        let conversation = await database.createConversation(userId);
        
        const originalId = conversation.id;
        const originalUserId = conversation.userId;
        const originalCreatedAt = conversation.createdAt;
        
        // Modify multiple properties
        conversation.state = 'completed';
        conversation.params = { component: 'database', layer: 'persistence' };
        conversation.history = [
            { role: 'user', content: 'Hello' },
            { role: 'assistant', content: 'Hi there!' }
        ];
        conversation.isActive = false;
        conversation.questionsAsked = 5;
        
        await database.saveConversation(conversation);
        
        const updatedConv = await database.getConversation(originalId);
        
        // Verify all properties were saved correctly
        expect(updatedConv.id).toBe(originalId);
        expect(updatedConv.userId).toBe(originalUserId);
        expect(updatedConv.state).toBe('completed');
        expect(updatedConv.params).toEqual({ component: 'database', layer: 'persistence' });
        expect(updatedConv.history).toEqual([
            { role: 'user', content: 'Hello' },
            { role: 'assistant', content: 'Hi there!' }
        ]);
        expect(updatedConv.isActive).toBe(false);
        expect(updatedConv.questionsAsked).toBe(5);
        expect(updatedConv.createdAt).toBe(originalCreatedAt);
        expect(updatedConv.updatedAt).toBeDefined();
    });

    test('getConversations should return conversations ordered by updatedAt DESC', async () => {
        const userId = 'user12';
        const conv1 = await database.createConversation(userId);
        
        // Wait to ensure different timestamps
        await new Promise(resolve => setTimeout(resolve, 10));
        
        const conv2 = await database.createConversation(userId);
        
        // Update conv1 to make it more recent
        conv1.state = 'updated';
        await database.saveConversation(conv1);
        
        const conversations = await database.getConversations(userId);
        expect(conversations.length).toBe(2);
        
        // conv1 should be first because it was updated last
        expect(conversations[0].id).toBe(conv1.id);
        expect(conversations[1].id).toBe(conv2.id);
    });

    test('getConversations should return empty array for user with no conversations', async () => {
        const conversations = await database.getConversations('nonexistent-user');
        expect(conversations).toEqual([]);
    });

    test('unarchiveConversation should handle non-existent conversation gracefully', async () => {
        const userId = 'user13';
        // This should not throw an error, even if the conversation doesn't exist
        await expect(database.unarchiveConversation('non-existent-id', userId)).resolves.not.toThrow();
    });

    test('archiveConversation should handle non-existent conversation gracefully', async () => {
        // This should not throw an error, even if the conversation doesn't exist
        await expect(database.archiveConversation('non-existent-id')).resolves.not.toThrow();
    });
});
