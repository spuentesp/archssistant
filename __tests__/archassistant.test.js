const request = require('supertest');
const express = require('express');
const bodyParser = require('body-parser');

// Mock core modules
jest.mock('../core/conversation_manager');
jest.mock('../core/intent_classifier');
jest.mock('../core/hybrid_extractor');
jest.mock('../core/explainer');
jest.mock('../core/response_handler');
jest.mock('../db/database');

const archssistantRoute = require('../routes/archassistant');
const { getOrCreateConversation, saveConversation, updateConversationParams, archiveCurrentConversation } = require('../core/conversation_manager');
const { classifyIntent } = require('../core/intent_classifier');
const { extractHybridParams } = require('../core/hybrid_extractor');
const { generateParameterQuestion, answerGeneralQuestion } = require('../core/explainer');
const { evaluateAndRespond } = require('../core/response_handler');
const { getConversations } = require('../db/database');

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
            expect(res.body.error).toBe('Falta el ID de usuario.');
        });

        it('should handle general questions', async () => {
            const userId = 'user-general';
            const message = '¿Qué es la escalabilidad?';
            const mockConversation = {
                id: 'conv-general',
                userId,
                params: {},
                history: [],
                state: 'initial'
            };

            getOrCreateConversation.mockResolvedValue(mockConversation);
            classifyIntent.mockResolvedValue('pregunta_general');
            answerGeneralQuestion.mockResolvedValue('La escalabilidad es la capacidad...');
            saveConversation.mockResolvedValue();

            const res = await request(app)
                .post('/archssistant')
                .send({ message, userId });

            expect(res.statusCode).toEqual(200);
            expect(res.body.reply).toBe('La escalabilidad es la capacidad...');
            expect(res.body.conversationId).toBe('conv-general');
            expect(classifyIntent).toHaveBeenCalledWith(message, 'test-key', 'test-server');
            expect(answerGeneralQuestion).toHaveBeenCalledWith(message, 'test-key', 'test-server');
            expect(saveConversation).toHaveBeenCalledWith(expect.objectContaining({
                history: expect.arrayContaining([
                    { role: 'user', content: message },
                    { role: 'assistant', content: 'La escalabilidad es la capacidad...' }
                ])
            }));
        });

        it('should start architecture evaluation process', async () => {
            const userId = 'user-eval';
            const message = 'Necesito una arquitectura para mi aplicación web';
            const mockConversation = {
                id: 'conv-eval',
                userId,
                params: {},
                history: [],
                state: 'initial'
            };

            getOrCreateConversation.mockResolvedValue(mockConversation);
            classifyIntent.mockResolvedValue('evaluar');
            extractHybridParams.mockResolvedValue({ tipo_aplicacion: 'web' });
            generateParameterQuestion.mockResolvedValue('¿Cuántos usuarios esperas que tenga tu aplicación?');
            updateConversationParams.mockImplementation(() => {
                mockConversation.params.tipo_aplicacion = 'web';
            });
            saveConversation.mockResolvedValue();

            const res = await request(app)
                .post('/archssistant')
                .send({ message, userId });

            expect(res.statusCode).toEqual(200);
            expect(res.body.reply).toBe('¿Cuántos usuarios esperas que tenga tu aplicación?');
            expect(classifyIntent).toHaveBeenCalledWith(message, 'test-key', 'test-server');
            expect(extractHybridParams).toHaveBeenCalledWith(message, 'test-key', 'test-server');
            expect(updateConversationParams).toHaveBeenCalled();
            expect(generateParameterQuestion).toHaveBeenCalled();
        });

        it('should complete evaluation when all parameters are gathered', async () => {
            const userId = 'user-complete';
            const message = 'Alta escalabilidad, bajo costo';
            const mockConversation = {
                id: 'conv-complete',
                userId,
                params: {
                    escalabilidad: 'alta',
                    costo: 'bajo',
                    complejidad: 'media',
                    experiencia: 'buena',
                    seguridad: 'alta',
                    mantenibilidad: 'alta' // Added missing param
                },
                history: [],
                state: 'evaluation_started'
            };

            getOrCreateConversation.mockResolvedValue(mockConversation);
            classifyIntent.mockResolvedValue('evaluar');
            extractHybridParams.mockResolvedValue({});
            evaluateAndRespond.mockResolvedValue('Recomiendo una arquitectura Service-Based...');
            saveConversation.mockResolvedValue();

            const res = await request(app)
                .post('/archssistant')
                .send({ message, userId });

            expect(res.statusCode).toEqual(200);
            expect(res.body.reply).toBe('Recomiendo una arquitectura Service-Based...');
            expect(evaluateAndRespond).toHaveBeenCalledWith(mockConversation, 'test-key', 'test-server');
            expect(mockConversation.state).toBe('completed');
        });

        it('should archive current conversation and start new one when intent is "archivar"', async () => {
            const userId = 'archive-user';
            const message = 'archivar conversación';
            const currentConversation = {
                id: 'conv-to-archive',
                userId,
                params: { tipo_aplicacion: 'web' },
                history: [
                    { role: 'user', content: 'necesito una arquitectura' },
                    { role: 'assistant', content: '¿Qué tipo de aplicación?' }
                ],
                state: 'evaluation_started'
            };
            const newConversation = {
                id: 'new-conv',
                userId,
                params: {},
                history: [],
                state: 'initial'
            };

            // Mock conversation flow
            getOrCreateConversation
                .mockResolvedValueOnce(currentConversation)  // First call returns current conversation
                .mockResolvedValueOnce(newConversation);     // Second call returns new conversation
            classifyIntent.mockResolvedValue('archivar');
            archiveCurrentConversation.mockResolvedValue(true);
            saveConversation.mockResolvedValue();

            const res = await request(app)
                .post('/archssistant')
                .send({ message, userId });

            expect(res.statusCode).toEqual(200);
            expect(res.body.reply).toContain('¡Conversación archivada!');
            expect(res.body.reply).toContain('estoy listo para empezar una nueva conversación');
            expect(res.body.conversationId).toBe('new-conv');
            expect(res.body.state).toBe('initial');
            expect(res.body.archived).toBe(true);
            
            // Verify archiving flow
            expect(classifyIntent).toHaveBeenCalledWith(message, 'test-key', 'test-server');
            expect(archiveCurrentConversation).toHaveBeenCalledWith(userId);
            expect(getOrCreateConversation).toHaveBeenCalledTimes(2);
            expect(saveConversation).toHaveBeenCalledWith(expect.objectContaining({
                id: 'new-conv',
                history: expect.arrayContaining([
                    expect.objectContaining({
                        role: 'assistant',
                        content: expect.stringContaining('¡Conversación archivada!')
                    })
                ])
            }));
        });

        it('should handle forced evaluation', async () => {
            const userId = 'user-force';
            const message = 'evalúa con lo que tienes';
            const mockConversation = {
                id: 'conv-force',
                userId,
                params: { escalabilidad: 'alta' }, // Only partial params
                history: [],
                state: 'evaluation_started'
            };

            getOrCreateConversation.mockResolvedValue(mockConversation);
            classifyIntent.mockResolvedValue('forzar_evaluacion');
            evaluateAndRespond.mockResolvedValue('Con la información disponible, recomiendo...');
            saveConversation.mockResolvedValue();

            const res = await request(app)
                .post('/archssistant')
                .send({ message, userId });

            expect(res.statusCode).toEqual(200);
            expect(res.body.reply).toBe('Con la información disponible, recomiendo...');
            expect(evaluateAndRespond).toHaveBeenCalledWith(mockConversation, 'test-key', 'test-server');
            expect(extractHybridParams).not.toHaveBeenCalled(); // Should not extract params for forced evaluation
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
            getConversations.mockResolvedValue(mockHistory);

            const res = await request(app).get(`/archssistant/history/${userId}`);

            expect(res.statusCode).toEqual(200);
            expect(res.body).toEqual(mockHistory);
            expect(getConversations).toHaveBeenCalledWith(userId);
        });

        it('should handle errors when fetching history', async () => {
            const userId = 'history-error-user';
            getConversations.mockRejectedValue(new Error('DB History Error'));

            const res = await request(app).get(`/archssistant/history/${userId}`);

            expect(res.statusCode).toEqual(500);
            expect(res.body.error).toBe('Error al cargar el historial.');
        });
    });
});
