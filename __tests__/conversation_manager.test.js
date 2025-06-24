const conversationManager = require('../core/conversation_manager');
const database = require('../db/database');

// Mock the database module to avoid actual DB calls and control test data
jest.mock('../db/database', () => ({
    getConversation: jest.fn(),
    createConversation: jest.fn(),
    saveConversation: jest.fn(),
    archiveConversation: jest.fn(),
    getActiveConversationForUser: jest.fn(),
    archiveAllConversationsForUserExceptOne: jest.fn(),
}));

describe('Conversation Manager', () => {

    beforeEach(() => {
        // Reset mocks before each test
        jest.clearAllMocks();
    });

    describe('getOrCreateConversation', () => {
        const userId = 'test-user';
        const existingConv = { id: 'conv1', userId, params: {}, history: [], state: 'ongoing', isActive: true };
        const newConv = { id: 'conv2', userId, params: {}, history: [], state: 'initial', isActive: true };

        test('should retrieve an existing, active conversation by ID and archive others', async () => {
            database.getConversation.mockResolvedValue(existingConv);

            const conversation = await conversationManager.getOrCreateConversation(userId, 'conv1');

            expect(database.getConversation).toHaveBeenCalledWith('conv1');
            expect(database.archiveAllConversationsForUserExceptOne).toHaveBeenCalledWith(userId, 'conv1');
            expect(database.getActiveConversationForUser).not.toHaveBeenCalled();
            expect(database.createConversation).not.toHaveBeenCalled();
            expect(conversation).toEqual(existingConv);
        });

        test('should not retrieve a conversation if the ID is for another user and should find the last active one', async () => {
            database.getConversation.mockResolvedValue({ ...existingConv, userId: 'another-user' });
            database.getActiveConversationForUser.mockResolvedValue(existingConv); // Find the correct active one

            const conversation = await conversationManager.getOrCreateConversation(userId, 'conv1');

            expect(database.getConversation).toHaveBeenCalledWith('conv1');
            expect(database.getActiveConversationForUser).toHaveBeenCalledWith(userId);
            expect(database.archiveAllConversationsForUserExceptOne).toHaveBeenCalledWith(userId, existingConv.id);
            expect(database.createConversation).not.toHaveBeenCalled();
            expect(conversation).toEqual(existingConv);
        });

        test('should retrieve the last active conversation and archive others if no ID is provided', async () => {
            database.getActiveConversationForUser.mockResolvedValue(existingConv);

            const conversation = await conversationManager.getOrCreateConversation(userId);

            expect(database.getConversation).not.toHaveBeenCalled();
            expect(database.getActiveConversationForUser).toHaveBeenCalledWith(userId);
            expect(database.archiveAllConversationsForUserExceptOne).toHaveBeenCalledWith(userId, existingConv.id);
            expect(database.createConversation).not.toHaveBeenCalled();
            expect(conversation).toEqual(existingConv);
        });

        test('should create a new conversation if no active one exists', async () => {
            database.getActiveConversationForUser.mockResolvedValue(null);
            database.createConversation.mockResolvedValue(newConv);

            const conversation = await conversationManager.getOrCreateConversation(userId);

            expect(database.getActiveConversationForUser).toHaveBeenCalledWith(userId);
            expect(database.archiveAllConversationsForUserExceptOne).not.toHaveBeenCalled();
            expect(database.createConversation).toHaveBeenCalledWith(userId);
            expect(conversation).toEqual(newConv);
        });

        test('should find last active conversation if the one found by ID is inactive', async () => {
            const inactiveConv = { ...existingConv, isActive: false };
            database.getConversation.mockResolvedValue(inactiveConv);
            database.getActiveConversationForUser.mockResolvedValue(existingConv); // Find the correct active one

            const conversation = await conversationManager.getOrCreateConversation(userId, 'conv1');

            expect(database.getConversation).toHaveBeenCalledWith('conv1');
            expect(database.getActiveConversationForUser).toHaveBeenCalledWith(userId);
            expect(database.archiveAllConversationsForUserExceptOne).toHaveBeenCalledWith(userId, existingConv.id);
            expect(database.createConversation).not.toHaveBeenCalled();
            expect(conversation).toEqual(existingConv);
        });

        test('should throw an error if userId is missing', async () => {
            await expect(conversationManager.getOrCreateConversation(null)).rejects.toThrow('userId is required to get or create a conversation.');
        });
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

        it("should return 'compare_architecture' when intent is 'compare'", () => {
            const conversation = { intent: 'compare', params: {} };
            const action = conversationManager.getNextAction(conversation);
            expect(action).toBe('compare_architecture');
        });

        it("should return 'clarify_intent' for unknown intents", () => {
            const conversation = { intent: 'unknown', params: {} };
            const action = conversationManager.getNextAction(conversation);
            expect(action).toBe('clarify_intent');
            expect(conversation.state).toBe('clarifying');
        });
    });
});
