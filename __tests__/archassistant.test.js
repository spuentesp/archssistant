const request = require('supertest');
const express = require('express');
const bodyParser = require('body-parser');

// Mock core modules
jest.mock('../core/conversation_manager');
jest.mock('../core/intent_classifier');
jest.mock('../core/hybrid_extractor');
jest.mock('../core/evaluator');
jest.mock('../core/explainer');
jest.mock('../core/knowledge_responder');
jest.mock('../core/compare_architecture');
jest.mock('../core/compare_extractor');
jest.mock('../db/database'); // Mock the entire database module

const archssistantRoute = require('../routes/archassistant');
const { getOrCreateConversation, saveConversation, getNextAction, updateConversationParams, archiveConversation } = require('../core/conversation_manager');
const { classifyIntent } = require('../core/intent_classifier');
const { extractHybridParams } = require('../core/hybrid_extractor');
const { evaluateArchitecture } = require('../core/evaluator');
const { explainArchitecture, generateParameterQuestion } = require('../core/explainer');
const { answerWithKnowledge } = require('../core/knowledge_responder');
const { compareArchitectures } = require('../core/compare_architecture');
const { extractArchitecturesToCompare } = require('../core/compare_extractor');
const database = require('../db/database'); // Import the mocked module

// Set up a minimal express app
const app = express();
app.use(bodyParser.json());
app.use('/archssistant', archssistantRoute);

// Set dummy env vars for tests
process.env.GROQ_API_KEY = 'test-key';
process.env.AISERVER = 'test-server';

describe('Archssistant Routes', () => {

    beforeEach(() => {
        // Clear all mocks before each test
        jest.clearAllMocks();
    });

    describe('POST /archssistant', () => {

        it('should return 400 if userId is not provided', async () => {
            const res = await request(app)
                .post('/archssistant')
                .send({ message: 'hello' });
            expect(res.statusCode).toEqual(400);
            expect(res.body.error).toBe('Falta el ID de usuario');
        });

        it('should start a new conversation, ask for params, and save state', async () => {
            const userId = 'user1';
            const message = 'I want to build a new app';
            const mockConversation = {
                id: 'conv1',
                userId,
                params: {},
                history: [],
                state: 'initial'
            };

            getOrCreateConversation.mockResolvedValue(mockConversation);
            classifyIntent.mockResolvedValue('evaluate');
            extractHybridParams.mockResolvedValue({ app_type: 'web' });
            // Mock getNextAction to return 'ask_params'
            getNextAction.mockReturnValue('ask_params');
            generateParameterQuestion.mockResolvedValue('What is your expected user traffic?');
            saveConversation.mockResolvedValue();

            const res = await request(app)
                .post('/archssistant')
                .send({ message, userId });

            expect(res.statusCode).toEqual(200);
            expect(res.body.reply).toBe('What is your expected user traffic?');
            expect(res.body.conversationId).toBe('conv1');
            expect(getOrCreateConversation).toHaveBeenCalledWith(userId, undefined);
            expect(classifyIntent).toHaveBeenCalled();
            expect(updateConversationParams).toHaveBeenCalledWith(mockConversation, { app_type: 'web' });
            expect(getNextAction).toHaveBeenCalledWith(mockConversation);
            expect(generateParameterQuestion).toHaveBeenCalled();
            expect(saveConversation).toHaveBeenCalledWith(mockConversation);
        });

        it('should continue a conversation, recommend architecture when params are complete', async () => {
            const userId = 'user2';
            const conversationId = 'conv2';
            const message = 'The final parameter is high availability';
            const mockConversation = {
                id: conversationId,
                userId,
                params: { app_type: 'web', user_traffic: 'high', /*...other params*/ },
                history: [{ role: 'user', content: '...' }],
                state: 'awaiting_params',
                intent: 'evaluate'
            };

            getOrCreateConversation.mockResolvedValue(mockConversation);
            extractHybridParams.mockResolvedValue({ availability: '99.99%' });
            // Mock getNextAction to return 'recommend_architecture'
            getNextAction.mockReturnValue('recommend_architecture');
            evaluateArchitecture.mockReturnValue([{ name: 'Microservices', score: 0.95 }]);
            explainArchitecture.mockResolvedValue('Microservices is the best fit.');
            saveConversation.mockResolvedValue();
            archiveConversation.mockResolvedValue();

            const res = await request(app)
                .post('/archssistant')
                .send({ message, userId, conversationId });

            expect(res.statusCode).toEqual(200);
            expect(res.body.reply).toContain('Microservices is the best fit.');
            expect(evaluateArchitecture).toHaveBeenCalled();
            expect(explainArchitecture).toHaveBeenCalled();
            expect(saveConversation).toHaveBeenCalled();
            expect(archiveConversation).toHaveBeenCalledWith(conversationId); // Check if completed conversation is archived
        });

        it('should handle architecture comparison', async () => {
            const userId = 'user-compare';
            const message = 'compara monolítica y microservicios';
            const mockConversation = { id: 'conv-compare', userId, params: {}, history: [], state: 'initial' };

            getOrCreateConversation.mockResolvedValue(mockConversation);
            classifyIntent.mockResolvedValue('compare');
            extractHybridParams.mockResolvedValue({}); // No params needed for comparison
            getNextAction.mockReturnValue('compare_architecture');
            extractArchitecturesToCompare.mockResolvedValue(['monolítica', 'microservicios']);
            compareArchitectures.mockResolvedValue('Monolithic is simple, Microservices are scalable.');

            const res = await request(app)
                .post('/archssistant')
                .send({ message, userId });

            expect(res.statusCode).toEqual(200);
            expect(res.body.reply).toBe('Monolithic is simple, Microservices are scalable.');
            expect(extractArchitecturesToCompare).toHaveBeenCalledWith(message, 'test-key', 'test-server');
            expect(compareArchitectures).toHaveBeenCalledWith('monolítica', 'microservicios', 'test-key', 'test-server');
            expect(saveConversation).toHaveBeenCalled();
        });

        it('should ask for clarification if two architectures are not provided for comparison', async () => {
            const userId = 'user-compare-fail';
            const message = 'compara monolítica';
            const mockConversation = { id: 'conv-compare-fail', userId, params: {}, history: [], state: 'initial' };

            getOrCreateConversation.mockResolvedValue(mockConversation);
            classifyIntent.mockResolvedValue('compare');
            extractHybridParams.mockResolvedValue({});
            getNextAction.mockReturnValue('compare_architecture');
            extractArchitecturesToCompare.mockResolvedValue(['monolítica']); // Only one architecture

            const res = await request(app)
                .post('/archssistant')
                .send({ message, userId });

            expect(res.statusCode).toEqual(200);
            expect(res.body.reply).toBe("Por favor, especifica dos arquitecturas para comparar. Por ejemplo: 'compara monolítica y microservicios'.");
            expect(compareArchitectures).not.toHaveBeenCalled();
        });

        it('should use knowledge base for informational questions', async () => {
            const userId = 'user3';
            const message = 'What is a monolithic architecture?';
            const mockConversation = { id: 'conv3', userId, params: {}, history: [], state: 'initial' };

            getOrCreateConversation.mockResolvedValue(mockConversation);
            classifyIntent.mockResolvedValue('inform');
            extractHybridParams.mockResolvedValue({});
            getNextAction.mockReturnValue('answer_knowledge');
            answerWithKnowledge.mockResolvedValue('A monolithic architecture is a traditional model...');

            const res = await request(app)
                .post('/archssistant')
                .send({ message, userId });

            expect(res.statusCode).toEqual(200);
            expect(res.body.reply).toBe('A monolithic architecture is a traditional model...');
            expect(answerWithKnowledge).toHaveBeenCalled();
            expect(evaluateArchitecture).not.toHaveBeenCalled();
        });

        it('should handle intent clarification', async () => {
            const userId = 'user4';
            const message = 'gibberish input';
            const mockConversation = { id: 'conv4', userId, params: {}, history: [], state: 'initial' };

            getOrCreateConversation.mockResolvedValue(mockConversation);
            classifyIntent.mockResolvedValue('unknown'); // or some other intent that leads to clarify
            extractHybridParams.mockResolvedValue({});
            getNextAction.mockReturnValue('clarify_intent');

            const res = await request(app)
                .post('/archssistant')
                .send({ message, userId });

            expect(res.statusCode).toEqual(200);
            expect(res.body.reply).toBe('No estoy seguro de cómo ayudarte. ¿Podrías reformular tu pregunta?');
        });

        it('should handle errors gracefully', async () => {
            getOrCreateConversation.mockRejectedValue(new Error('Internal DB Error'));

            const res = await request(app)
                .post('/archssistant')
                .send({ message: 'any', userId: 'error-user' });

            expect(res.statusCode).toEqual(500);
            expect(res.body.error).toBe('Error al procesar la solicitud.');
        });
    });

    describe('GET /archssistant/history/:userId', () => {
        it('should retrieve user conversation history', async () => {
            const userId = 'history-user';
            const mockHistory = [
                { id: 'c1', history: '[]', state: 'completed' },
                { id: 'c2', history: '[]', state: 'ongoing' }
            ];
            // Correctly mock the getConversationsForUser function from the mocked module
            database.getConversationsForUser.mockResolvedValue(mockHistory);

            const res = await request(app).get(`/archssistant/history/${userId}`);

            expect(res.statusCode).toEqual(200);
            expect(res.body).toEqual(mockHistory);
            expect(database.getConversationsForUser).toHaveBeenCalledWith(userId);
        });

        it('should handle errors when fetching history', async () => {
            const userId = 'history-error-user';
            // Correctly mock the getConversationsForUser function for a rejection
            database.getConversationsForUser.mockRejectedValue(new Error('DB History Error'));

            const res = await request(app).get(`/archssistant/history/${userId}`);

            expect(res.statusCode).toEqual(500);
            expect(res.body.error).toBe('Error al cargar el historial.');
        });
    });
});
