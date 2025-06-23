const request = require('supertest');
const express = require('express');
const bodyParser = require('body-parser');

// Mock the core and db modules
jest.mock('../db/database');
jest.mock('../core/hybrid_extractor');
jest.mock('../core/evaluator');
jest.mock('../core/explainer');
jest.mock('../core/knowledge_responder');

const archssistantRoute = require('../routes/archassistant');
const { getOrCreateConversation, saveConversation, loadUserConversations } = require('../db/database');
const { extractHybridParams } = require('../core/hybrid_extractor');
const { evaluateArchitecture } = require('../core/evaluator');
const { explainArchitecture } = require('../core/explainer');
const { answerWithKnowledge } = require('../core/knowledge_responder');

// Set up a minimal express app
const app = express();
app.use(bodyParser.json());
app.use('/archssistant', archssistantRoute);

// Set dummy env vars for tests
process.env.GROQ_KEY = 'test-key';
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

        it('should process a message with params, evaluate, and save', async () => {
            const userId = 'user123';
            const message = 'a message with params';
            const mockConversation = { userId, detectedParameters: {}, userQuestions: [], fullHistory: [] };

            getOrCreateConversation.mockResolvedValue(mockConversation);
            extractHybridParams.mockResolvedValue({ param1: 'value1' });
            evaluateArchitecture.mockReturnValue([{ name: 'Microservices', score: 0.9 }]);
            explainArchitecture.mockResolvedValue('A great explanation.');
            saveConversation.mockResolvedValue();

            const res = await request(app)
                .post('/archssistant')
                .send({ message, userId });

            expect(res.statusCode).toEqual(200);
            expect(res.body.reply).toContain('A great explanation.');
            expect(getOrCreateConversation).toHaveBeenCalledWith(userId);
            expect(extractHybridParams).toHaveBeenCalled();
            expect(evaluateArchitecture).toHaveBeenCalled();
            expect(explainArchitecture).toHaveBeenCalled();
            expect(saveConversation).toHaveBeenCalledWith(userId, expect.any(Object));
        });

        it('should process a message with no params, use knowledge base, and save', async () => {
            const userId = 'user456';
            const message = 'a generic question';
            const mockConversation = { userId, detectedParameters: {}, userQuestions: [], fullHistory: [] };

            getOrCreateConversation.mockResolvedValue(mockConversation);
            extractHybridParams.mockResolvedValue({}); // No params detected
            answerWithKnowledge.mockResolvedValue('A knowledgeable answer.');
            saveConversation.mockResolvedValue();

            const res = await request(app)
                .post('/archssistant')
                .send({ message, userId });

            expect(res.statusCode).toEqual(200);
            expect(res.body.reply).toBe('A knowledgeable answer.');
            expect(getOrCreateConversation).toHaveBeenCalledWith(userId);
            expect(extractHybridParams).toHaveBeenCalled();
            expect(answerWithKnowledge).toHaveBeenCalled();
            expect(saveConversation).toHaveBeenCalled();
            expect(evaluateArchitecture).not.toHaveBeenCalled(); // Should not be called
        });

        it('should handle errors gracefully', async () => {
            getOrCreateConversation.mockRejectedValue(new Error('DB Error'));

            const res = await request(app)
                .post('/archssistant')
                .send({ message: 'any', userId: 'error-user' });

            expect(res.statusCode).toEqual(500);
            expect(res.body.error).toBe('Error al procesar la solicitud.');
        });
    });

    describe('GET /archssistant/history/:userId', () => {
        it('should return the conversation history for a user', async () => {
            const userId = 'history-user';
            const mockHistory = [{ id: 1, conversation: { fullHistory: [] }, isActive: 1 }];
            loadUserConversations.mockResolvedValue(mockHistory);

            const res = await request(app).get(`/archssistant/history/${userId}`);

            expect(res.statusCode).toEqual(200);
            expect(res.body).toEqual(mockHistory);
            expect(loadUserConversations).toHaveBeenCalledWith(userId);
        });

        it('should handle errors when fetching history', async () => {
            const userId = 'history-error-user';
            loadUserConversations.mockRejectedValue(new Error('History DB Error'));

            const res = await request(app).get(`/archssistant/history/${userId}`);

            expect(res.statusCode).toEqual(500);
            expect(res.body.error).toBe('Error al cargar el historial.');
        });
    });
});
