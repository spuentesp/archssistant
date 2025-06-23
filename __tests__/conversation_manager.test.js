const conversationManager = require('../core/conversation_manager');
const database = require('../db/database');

// Mock the database module to avoid actual DB calls and control test data
jest.mock('../db/database', () => ({
    initDB: jest.fn(),
    closeDB: jest.fn(),
    getDB: jest.fn(),
    createConversation: jest.fn(),
    getConversation: jest.fn(),
    saveConversation: jest.fn(),
    archiveConversation: jest.fn(),
}));

describe('Conversation Manager', () => {

    beforeEach(() => {
        // Reset mocks before each test
        jest.clearAllMocks();
    });

    test('getOrCreateConversation should create a new conversation if conversationId is not found', async () => {
        const userId = 'user1';
        const newConv = { id: 'conv1', userId, params: {}, history: [], state: 'initial', isActive: 1 };
        database.getConversation.mockResolvedValue(null); // It doesn't exist
        database.createConversation.mockResolvedValue(newConv);

        const conversation = await conversationManager.getOrCreateConversation(userId, 'non-existent-id');

        expect(database.getConversation).toHaveBeenCalledWith('non-existent-id');
        expect(database.createConversation).toHaveBeenCalledWith(userId);
        expect(conversation).toEqual(newConv);
    });

    test('getOrCreateConversation should retrieve an existing, active conversation', async () => {
        const userId = 'user2';
        const conversationId = 'conv2';
        const existingConv = { id: conversationId, userId, params: '{}', history: '[]', state: 'ongoing', isActive: 1 };
        database.getConversation.mockResolvedValue(existingConv);

        const conversation = await conversationManager.getOrCreateConversation(userId, conversationId);

        expect(database.getConversation).toHaveBeenCalledWith(conversationId);
        expect(database.createConversation).not.toHaveBeenCalled();
        expect(conversation.id).toBe(conversationId);
        expect(conversation.params).toEqual({}); // Check parsing
    });
    
    test('getOrCreateConversation should create a new one if existing conversation is inactive', async () => {
        const userId = 'user3';
        const conversationId = 'conv3';
        const inactiveConv = { id: conversationId, userId, params: '{}', history: '[]', state: 'completed', isActive: 0 };
        const newConv = { id: 'conv4', userId, params: {}, history: [], state: 'initial', isActive: 1 };

        database.getConversation.mockResolvedValue(inactiveConv);
        database.createConversation.mockResolvedValue(newConv);

        const conversation = await conversationManager.getOrCreateConversation(userId, conversationId);

        expect(database.getConversation).toHaveBeenCalledWith(conversationId);
        expect(database.createConversation).toHaveBeenCalledWith(userId);
        expect(conversation.id).toBe('conv4');
    });

    test('getOrCreateConversation should throw an error if userId is missing', async () => {
        await expect(conversationManager.getOrCreateConversation(null, 'some-id')).rejects.toThrow('userId is required to get or create a conversation.');
    });


    test('saveConversation should stringify params and history before saving', async () => {
        const conversation = {
            id: 'conv5',
            userId: 'user5',
            params: { app_type: 'web' },
            history: [{ role: 'user', content: 'hello' }],
            state: 'ongoing',
            intent: 'evaluate'
        };

        await conversationManager.saveConversation(conversation);

        expect(database.saveConversation).toHaveBeenCalledWith(expect.objectContaining({
            id: 'conv5',
            params: JSON.stringify({ app_type: 'web' }),
            history: JSON.stringify([{ role: 'user', content: 'hello' }]),
        }));
    });

    test('updateConversationParams should merge new params', () => {
        const conversation = { params: { app_type: 'web' } };
        const newParams = { user_traffic: 'high' };
        const updatedConv = conversationManager.updateConversationParams(conversation, newParams);
        expect(updatedConv.params).toEqual({ app_type: 'web', user_traffic: 'high' });
    });

    describe('getNextAction', () => {
        it("should return 'ask_params' when intent is 'evaluate' and params are missing", () => {
            const conversation = { intent: 'evaluate', params: { app_type: 'web' } };
            const action = conversationManager.getNextAction(conversation);
            expect(action).toBe('ask_params');
            expect(conversation.state).toBe('awaiting_params');
        });

        it("should return 'recommend_architecture' when intent is 'evaluate' and all params are present", () => {
            const params = conversationManager.ALL_PARAMS.reduce((acc, p) => ({ ...acc, [p]: 'value' }), {});
            const conversation = { intent: 'evaluate', params };
            const action = conversationManager.getNextAction(conversation);
            expect(action).toBe('recommend_architecture');
            expect(conversation.state).toBe('ready_to_evaluate');
        });

        it("should return 'answer_knowledge' when intent is 'inform'", () => {
            const conversation = { intent: 'inform', params: {} };
            const action = conversationManager.getNextAction(conversation);
            expect(action).toBe('answer_knowledge');
        });

        it("should return 'clarify_intent' for unknown intents", () => {
            const conversation = { intent: 'unknown', params: {} };
            const action = conversationManager.getNextAction(conversation);
            expect(action).toBe('clarify_intent');
            expect(conversation.state).toBe('clarifying');
        });
    });
});
