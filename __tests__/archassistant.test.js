const request = require('supertest');
const express = require('express');
const bodyParser = require('body-parser');

// Mock the orchestrator and database modules
jest.mock('../core/orchestrator');
jest.mock('../db/database');

describe('ArchAssistant Route with Orchestrator', () => {
    let app;
    let mockOrchestrator;
    let archssistantRoute;
    let ConversationOrchestrator;
    let getConversations;

    beforeEach(() => {
        jest.resetModules();

        // Re-require the mocks after resetModules
        ConversationOrchestrator = require('../core/orchestrator').ConversationOrchestrator;
        getConversations = require('../db/database').getConversations;

        // Force clear require cache for route and its dependencies
        delete require.cache[require.resolve('../routes/archassistant')];
        delete require.cache[require.resolve('../core/orchestrator')];
        delete require.cache[require.resolve('../db/database')];

        // Create a mock orchestrator instance
        mockOrchestrator = {
            processMessage: jest.fn(),
        };

        // Mock the ConversationOrchestrator constructor to return our mock instance
        ConversationOrchestrator.mockImplementation(() => mockOrchestrator);

        // Now require the route, which will use the mock implementation
        archssistantRoute = require('../routes/archassistant');

        app = express();
        app.use(bodyParser.json());
        app.use('/archassistant', archssistantRoute);

        // Set up environment variables
        process.env.GROQ_API_KEY = 'test-key';
        process.env.AISERVER = 'test-server';
    });

    afterEach(() => {
        jest.clearAllMocks();
        // Restore environment variables to avoid side effects
        delete process.env.GROQ_API_KEY;
        delete process.env.AISERVER;
    });

    afterAll(() => {
        jest.resetAllMocks();
    });

    describe('POST /', () => {
        it('should process message successfully through orchestrator', async () => {
            const userId = 'user123';
            const message = '¿Qué es escalabilidad?';
            
            const mockResult = {
                reply: 'La escalabilidad es la capacidad...',
                conversationId: 'conv123',
                state: 'initial'
            };

            mockOrchestrator.processMessage.mockResolvedValue(mockResult);

            const res = await request(app)
                .post('/archassistant')
                .send({ message, userId });

            expect(res.statusCode).toEqual(200);
            expect(res.body).toEqual(mockResult);
            expect(mockOrchestrator.processMessage).toHaveBeenCalledWith({ message, userId });
        });

        it('should handle missing userId error', async () => {
            const message = '¿Qué es escalabilidad?';
            
            mockOrchestrator.processMessage.mockRejectedValue(new Error('Falta el ID de usuario.'));

            const res = await request(app)
                .post('/archassistant')
                .send({ message });

            expect(res.statusCode).toEqual(400);
            expect(res.body.error).toBe('Falta el ID de usuario.');
        });

        it('should handle API settings missing error', async () => {
            const userId = 'user123';
            const message = '¿Qué es escalabilidad?';
            
            mockOrchestrator.processMessage.mockRejectedValue(new Error('API settings are missing'));

            const res = await request(app)
                .post('/archassistant')
                .send({ message, userId });

            expect(res.statusCode).toEqual(500);
            expect(res.body.error).toBe('Faltan configuraciones de API.');
        });

        it('should handle general errors', async () => {
            const userId = 'user123';
            const message = '¿Qué es escalabilidad?';
            
            mockOrchestrator.processMessage.mockRejectedValue(new Error('Some other error'));

            const res = await request(app)
                .post('/archassistant')
                .send({ message, userId });

            expect(res.statusCode).toEqual(500);
            expect(res.body.error).toBe('Error al procesar la solicitud.');
        });

        it('should handle evaluation flow through orchestrator', async () => {
            const userId = 'user-eval';
            const message = 'Necesito una arquitectura para mi aplicación web';
            
            const mockResult = {
                reply: '¿Cuántos usuarios esperas que tenga tu aplicación?',
                conversationId: 'conv-eval',
                state: 'evaluation_started'
            };

            mockOrchestrator.processMessage.mockResolvedValue(mockResult);

            const res = await request(app)
                .post('/archassistant')
                .send({ message, userId });

            expect(res.statusCode).toEqual(200);
            expect(res.body).toEqual(mockResult);
            expect(mockOrchestrator.processMessage).toHaveBeenCalledWith({ message, userId });
        });

        it('should handle archival flow through orchestrator', async () => {
            const userId = 'user-archive';
            const message = 'archivar conversación';
            
            const mockResult = {
                reply: '¡Conversación archivada! He guardado todo nuestro historial...',
                conversationId: 'new-conv',
                state: 'initial',
                archived: true
            };

            mockOrchestrator.processMessage.mockResolvedValue(mockResult);

            const res = await request(app)
                .post('/archassistant')
                .send({ message, userId });

            expect(res.statusCode).toEqual(200);
            expect(res.body).toEqual(mockResult);
            expect(mockOrchestrator.processMessage).toHaveBeenCalledWith({ message, userId });
        });
    });

    describe('GET /history/:userId', () => {
        it('should return conversation history for user', async () => {
            const userId = 'user123';
            const mockConversations = [
                { id: 'conv1', userId, history: [] },
                { id: 'conv2', userId, history: [] }
            ];

            getConversations.mockResolvedValue(mockConversations);

            const res = await request(app)
                .get(`/archassistant/history/${userId}`);

            expect(res.statusCode).toEqual(200);
            expect(res.body).toEqual(mockConversations);
            expect(getConversations).toHaveBeenCalledWith(userId);
        });

        it('should handle errors when loading history', async () => {
            const userId = 'user123';
            
            getConversations.mockRejectedValue(new Error('Database error'));

            const res = await request(app)
                .get(`/archassistant/history/${userId}`);

            expect(res.statusCode).toEqual(500);
            expect(res.body.error).toBe('Error al cargar el historial.');
        });
    });
});
