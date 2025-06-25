const { archiveCurrentConversation } = require('../core/conversation_manager');
const { getActiveConversation, archiveConversation } = require('../db/database');

// Mock the database module
jest.mock('../db/database');

describe('ConversationManager - Archive Functionality', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('archiveCurrentConversation', () => {
        it('should archive active conversation when one exists', async () => {
            const userId = 'test-user';
            const activeConversation = {
                id: 'active-conv-123',
                userId,
                state: 'evaluation_started',
                params: { escalabilidad: 'alta' }
            };

            getActiveConversation.mockResolvedValue(activeConversation);
            archiveConversation.mockResolvedValue();

            const result = await archiveCurrentConversation(userId);

            expect(result).toBe(true);
            expect(getActiveConversation).toHaveBeenCalledWith(userId);
            expect(archiveConversation).toHaveBeenCalledWith('active-conv-123');
        });

        it('should return false when no active conversation exists', async () => {
            const userId = 'user-no-conv';

            getActiveConversation.mockResolvedValue(null);

            const result = await archiveCurrentConversation(userId);

            expect(result).toBe(false);
            expect(getActiveConversation).toHaveBeenCalledWith(userId);
            expect(archiveConversation).not.toHaveBeenCalled();
        });

        it('should throw error when userId is not provided', async () => {
            await expect(archiveCurrentConversation()).rejects.toThrow('userId is required to archive a conversation.');
        });

        it('should throw error when userId is null', async () => {
            await expect(archiveCurrentConversation(null)).rejects.toThrow('userId is required to archive a conversation.');
        });

        it('should handle database errors gracefully', async () => {
            const userId = 'error-user';
            getActiveConversation.mockRejectedValue(new Error('Database connection failed'));

            await expect(archiveCurrentConversation(userId)).rejects.toThrow('Database connection failed');
        });
    });
});
