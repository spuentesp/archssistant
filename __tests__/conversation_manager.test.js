const conversationManager = require('../core/conversation/conversation_manager');
const database = require('../db/database');

// Mock the database module to avoid actual DB calls and control test data
jest.mock('../db/database', () => ({
    createConversation: jest.fn(),
    saveConversation: jest.fn(),
    getActiveConversation: jest.fn(),
    archiveConversation: jest.fn(),
}));

describe('Conversation Manager', () => {

    beforeEach(() => {
        // Reset mocks before each test
        jest.clearAllMocks();
    });

    describe('getOrCreateConversation', () => {
        const userId = 'test-user';
        const existingConv = { 
            id: 'conv1', 
            userId, 
            params: '{}', 
            history: '[]', 
            state: 'ongoing', 
            isActive: true 
        };
        const newConv = { 
            id: 'conv2', 
            userId, 
            params: {}, 
            history: [], 
            state: 'initial', 
            isActive: true 
        };

        test('should retrieve an existing active conversation and parse it', async () => {
            database.getActiveConversation.mockResolvedValue(existingConv);

            const conversation = await conversationManager.getOrCreateConversation(userId);

            expect(database.getActiveConversation).toHaveBeenCalledWith(userId);
            expect(database.createConversation).not.toHaveBeenCalled();
            expect(conversation.params).toEqual({}); // Should be parsed from string
            expect(conversation.history).toEqual([]); // Should be parsed from string
            expect(conversation.id).toBe('conv1');
        });

        test('should create a new conversation if no active one exists', async () => {
            database.getActiveConversation.mockResolvedValue(null);
            database.createConversation.mockResolvedValue(newConv);

            const conversation = await conversationManager.getOrCreateConversation(userId);

            expect(database.getActiveConversation).toHaveBeenCalledWith(userId);
            expect(database.createConversation).toHaveBeenCalledWith(userId);
            expect(conversation).toEqual(newConv);
        });

        test('should throw an error if userId is missing', async () => {
            await expect(conversationManager.getOrCreateConversation(null)).rejects.toThrow('userId is required to get or create a conversation.');
            await expect(conversationManager.getOrCreateConversation()).rejects.toThrow('userId is required to get or create a conversation.');
        });

        test('should handle conversation with string params and history', async () => {
            const convWithStrings = {
                id: 'conv3',
                userId,
                params: '{"app_type":"web","user_traffic":"high"}',
                history: '[{"role":"user","content":"hello"}]',
                state: 'ongoing',
                isActive: true
            };
            database.getActiveConversation.mockResolvedValue(convWithStrings);

            const conversation = await conversationManager.getOrCreateConversation(userId);

            expect(conversation.params).toEqual({ app_type: 'web', user_traffic: 'high' });
            expect(conversation.history).toEqual([{ role: 'user', content: 'hello' }]);
        });
    });

    describe('saveConversation', () => {
        test('should stringify params and history before saving', async () => {
            const conversation = {
                id: 'conv5',
                userId: 'user5',
                params: { app_type: 'web' },
                history: [{ role: 'user', content: 'hello' }],
                state: 'ongoing',
                isActive: true
            };

            await conversationManager.saveConversation(conversation);

            expect(database.saveConversation).toHaveBeenCalledWith(expect.objectContaining({
                id: 'conv5',
                userId: 'user5',
                params: JSON.stringify({ app_type: 'web' }),
                history: JSON.stringify([{ role: 'user', content: 'hello' }]),
                state: 'ongoing',
                isActive: true
            }));
        });

        test('should not modify the original conversation object', async () => {
            const conversation = {
                id: 'conv6',
                params: { app_type: 'web' },
                history: [{ role: 'user', content: 'hello' }]
            };
            const originalParams = conversation.params;
            const originalHistory = conversation.history;

            await conversationManager.saveConversation(conversation);

            // Original object should remain unchanged
            expect(conversation.params).toBe(originalParams);
            expect(conversation.history).toBe(originalHistory);
            expect(typeof conversation.params).toBe('object');
            expect(typeof conversation.history).toBe('object');
        });

        test('should handle already stringified params and history', async () => {
            const conversation = {
                id: 'conv7',
                params: '{"app_type":"web"}',
                history: '[{"role":"user","content":"hello"}]'
            };

            await conversationManager.saveConversation(conversation);

            expect(database.saveConversation).toHaveBeenCalledWith(expect.objectContaining({
                params: '{"app_type":"web"}',
                history: '[{"role":"user","content":"hello"}]'
            }));
        });
    });

    describe('updateConversationParams', () => {
        test('should merge new params into existing conversation params', () => {
            const conversation = { params: { app_type: 'web' } };
            const newParams = { user_traffic: 'high', scalability: 'horizontal' };
            
            conversationManager.updateConversationParams(conversation, newParams);
            
            expect(conversation.params).toEqual({ 
                app_type: 'web', 
                user_traffic: 'high',
                scalability: 'horizontal'
            });
        });

        test('should overwrite existing params with new values', () => {
            const conversation = { params: { app_type: 'web', user_traffic: 'low' } };
            const newParams = { user_traffic: 'high' };
            
            conversationManager.updateConversationParams(conversation, newParams);
            
            expect(conversation.params).toEqual({ 
                app_type: 'web', 
                user_traffic: 'high'
            });
        });

        test('should ignore params with "unknown" value', () => {
            const conversation = { params: { app_type: 'web' } };
            const newParams = { user_traffic: 'unknown', scalability: 'horizontal' };
            
            conversationManager.updateConversationParams(conversation, newParams);
            
            expect(conversation.params).toEqual({ 
                app_type: 'web',
                scalability: 'horizontal'
            });
            expect(conversation.params.user_traffic).toBeUndefined();
        });

        test('should handle empty params object', () => {
            const conversation = { params: {} };
            const newParams = { app_type: 'web', user_traffic: 'high' };
            
            conversationManager.updateConversationParams(conversation, newParams);
            
            expect(conversation.params).toEqual({ 
                app_type: 'web', 
                user_traffic: 'high'
            });
        });
    });

    describe('archiveCurrentConversation', () => {
        const userId = 'test-user';

        test('should archive the active conversation and return true', async () => {
            const activeConversation = { id: 'conv1', userId, isActive: true };
            database.getActiveConversation.mockResolvedValue(activeConversation);
            database.archiveConversation.mockResolvedValue();

            const result = await conversationManager.archiveCurrentConversation(userId);

            expect(database.getActiveConversation).toHaveBeenCalledWith(userId);
            expect(database.archiveConversation).toHaveBeenCalledWith('conv1');
            expect(result).toBe(true);
        });

        test('should return false when no active conversation exists', async () => {
            database.getActiveConversation.mockResolvedValue(null);

            const result = await conversationManager.archiveCurrentConversation(userId);

            expect(database.getActiveConversation).toHaveBeenCalledWith(userId);
            expect(database.archiveConversation).not.toHaveBeenCalled();
            expect(result).toBe(false);
        });

        test('should throw error when userId is not provided', async () => {
            await expect(conversationManager.archiveCurrentConversation()).rejects.toThrow('userId is required to archive a conversation.');
            await expect(conversationManager.archiveCurrentConversation(null)).rejects.toThrow('userId is required to archive a conversation.');
        });
    });
});
