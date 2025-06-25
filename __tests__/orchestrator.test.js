jest.mock('../db/database', () => ({}));
jest.mock('fs');
const fs = require('fs');
fs.readFileSync = jest.fn((filePath) => {
    if (filePath.includes('architecture_params.json')) {
        return JSON.stringify([
            {
                "name": "Microservices",
                "escalabilidad": "alta",
                "disponibilidad": "alta",
                "costo": "alto",
                "complejidad": "alta",
                "seguridad": "media",
                "latencia": "baja"
            }
        ]);
    }
    if (filePath.includes('param_rules.json')) {
        return JSON.stringify({
            "escalabilidad": ["escalable", "escalabilidad"],
            "disponibilidad": ["disponible", "disponibilidad"],
            "costo": ["costo", "precio"],
            "complejidad": ["complejo", "complejidad"],
            "seguridad": ["seguro", "seguridad"],
            "latencia": ["latencia", "rápido", "lento"]
        });
    }
    return '';
});

// Now import all project modules
const {
    ConversationOrchestrator,
    ApiConfigService,
    ArchitectureParamsService,
} = require('../core/orchestrator');

// Mock dependencies
jest.mock('../core/conversation/conversation_manager');
jest.mock('../core/ingestion/hybrid_extractor');
jest.mock('../core/ingestion/explainer');
jest.mock('../core/intent/intent_classifier');
jest.mock('../core/conversation/response_handler');

const { getOrCreateConversation, saveConversation, archiveCurrentConversation, updateConversationParams } = require('../core/conversation/conversation_manager');
const { extractHybridParams } = require('../core/ingestion/hybrid_extractor');
const { generateParameterQuestion, answerGeneralQuestion } = require('../core/ingestion/explainer');
const { classifyIntent } = require('../core/intent/intent_classifier');
const { evaluateAndRespond } = require('../core/conversation/response_handler');

describe('ConversationOrchestrator', () => {
    let orchestrator;

    beforeEach(() => {
        // Reset mocks before each test
        jest.clearAllMocks();

        // Mock environment variables
        process.env.GROQ_API_KEY = 'test-api-key';
        process.env.AISERVER = 'http://localhost:8080';

        orchestrator = new ConversationOrchestrator();
    });

    describe('ApiConfigService', () => {
        it('should validate and return api config', () => {
            const configService = new ApiConfigService();
            const config = configService.validate();
            expect(config).toEqual({
                apiKey: 'test-api-key',
                baseURL: 'http://localhost:8080'
            });
        });

        it('should throw an error if API settings are missing', () => {
            delete process.env.GROQ_API_KEY;
            const configService = new ApiConfigService();
            expect(() => configService.validate()).toThrow('API settings are missing (GROQ_KEY or AISERVER)');
        });
    });

    describe('ArchitectureParamsService', () => {
        it('should load and provide architecture parameters', () => {
            const paramsService = new ArchitectureParamsService();
            const allParams = paramsService.getAllParams();
            expect(allParams).toEqual(["escalabilidad", "disponibilidad", "costo", "complejidad", "seguridad", "latencia"]);

            const conversation = { params: { escalabilidad: 'alta' } };
            const missingParams = paramsService.getMissingParams(conversation);
            expect(missingParams).toEqual(["disponibilidad", "costo", "complejidad", "seguridad", "latencia"]);

            const knownParams = paramsService.getKnownParams(conversation);
            expect(knownParams).toEqual(['escalabilidad']);
        });
    });

    describe('processMessage', () => {
        it('should throw an error if userId is missing', async () => {
            const messageData = { message: 'Hello' };
            await expect(orchestrator.processMessage(messageData)).rejects.toThrow('Falta el ID de usuario.');
        });

        it('should handle general questions', async () => {
            const messageData = { message: 'What is your name?', userId: 'test-user' };
            const mockConversation = { id: 'conv-1', history: [], params: {}, state: 'initial' };

            getOrCreateConversation.mockResolvedValue(mockConversation);
            classifyIntent.mockResolvedValue('pregunta_general');
            answerGeneralQuestion.mockResolvedValue('I am an AI assistant.');

            const result = await orchestrator.processMessage(messageData);

            expect(classifyIntent).toHaveBeenCalledWith('What is your name?', 'test-api-key', 'http://localhost:8080');
            expect(answerGeneralQuestion).toHaveBeenCalledWith('What is your name?', 'test-api-key', 'http://localhost:8080');
            expect(saveConversation).toHaveBeenCalled();
            expect(result.reply).toBe('I am an AI assistant.');
            expect(result.conversationId).toBe('conv-1');
        });

        it('should handle archival requests', async () => {
            const messageData = { message: 'archive this conversation', userId: 'test-user' };
            const mockConversation = { id: 'conv-1', history: [], params: {}, state: 'initial' };
            const newMockConversation = { id: 'conv-2', history: [], params: {}, state: 'initial' };

            getOrCreateConversation.mockResolvedValueOnce(mockConversation); // for the original conversation
            getOrCreateConversation.mockResolvedValueOnce(newMockConversation); // for the new one after archival
            classifyIntent.mockResolvedValue('archivar');
            archiveCurrentConversation.mockResolvedValue();
            saveConversation.mockResolvedValue();

            const result = await orchestrator.processMessage(messageData);

            expect(archiveCurrentConversation).toHaveBeenCalledWith('test-user');
            expect(saveConversation).toHaveBeenCalledWith(expect.objectContaining({ id: 'conv-2' }));
            expect(result.reply).toContain('¡Conversación archivada!');
            expect(result.conversationId).toBe('conv-2');
            expect(result.archived).toBe(true);
            // Ensure the reply is in the new conversation's history
            expect(newMockConversation.history).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({ role: 'assistant', content: expect.stringContaining('¡Conversación archivada!') })
                ])
            );
        });

        it('should start an evaluation if intent is to evaluate', async () => {
            const messageData = { message: 'evaluate my architecture', userId: 'test-user' };
            const mockConversation = { id: 'conv-1', history: [], params: {}, state: 'initial', questionsAsked: 0 };

            getOrCreateConversation.mockResolvedValue(mockConversation);
            classifyIntent.mockResolvedValue('evaluar');
            extractHybridParams.mockResolvedValue({ escalabilidad: 'alta' });
            generateParameterQuestion.mockResolvedValue('What about availability?');

            const result = await orchestrator.processMessage(messageData);

            expect(extractHybridParams).toHaveBeenCalled();
            expect(generateParameterQuestion).toHaveBeenCalled();
            expect(saveConversation).toHaveBeenCalled();
            expect(result.reply).toBe('What about availability?');
            expect(mockConversation.state).toBe('evaluation_started');
        });

        it('should continue an evaluation', async () => {
            const messageData = { message: 'it should be highly available', userId: 'test-user' };
            const mockConversation = {
                id: 'conv-1',
                history: [],
                params: { escalabilidad: 'alta' },
                state: 'evaluation_started',
                questionsAsked: 1
            };

            getOrCreateConversation.mockResolvedValue(mockConversation);
            // When continuing an evaluation, the intent might be different, but the state forces the evaluation strategy
            classifyIntent.mockResolvedValue('informar_parametro');
            extractHybridParams.mockResolvedValue({ disponibilidad: 'alta' });
            generateParameterQuestion.mockResolvedValue('What about cost?');

            const result = await orchestrator.processMessage(messageData);

            expect(extractHybridParams).toHaveBeenCalled();
            expect(generateParameterQuestion).toHaveBeenCalled();
            expect(saveConversation).toHaveBeenCalled();
            expect(result.reply).toBe('What about cost?');
            expect(mockConversation.questionsAsked).toBe(2);
        });

        it('should perform evaluation when all params are gathered', async () => {
            const messageData = { message: 'last param is low latency', userId: 'test-user' };
            const mockConversation = {
                id: 'conv-1',
                history: [],
                params: {
                    escalabilidad: "alta",
                    disponibilidad: "alta",
                    costo: "alto",
                    complejidad: "alta",
                    seguridad: "media",
                    latencia: "baja"
                },
                state: 'evaluation_started'
            };

            getOrCreateConversation.mockResolvedValue(mockConversation);
            classifyIntent.mockResolvedValue('informar_parametro');
            // Return all missing params so orchestrator proceeds to evaluation
            extractHybridParams.mockResolvedValue({ latencia: 'baja' });
            evaluateAndRespond.mockResolvedValue('Based on your requirements, a Microservices architecture is recommended.');

            const result = await orchestrator.processMessage(messageData);

            expect(extractHybridParams).toHaveBeenCalled();
            expect(evaluateAndRespond).toHaveBeenCalled();
            expect(saveConversation).toHaveBeenCalled();
            expect(result.reply).toContain('Microservices');
            expect(mockConversation.state).toBe('completed');
        });

        it('should perform evaluation when user forces it', async () => {
            const messageData = { message: 'evalúa ya', userId: 'test-user' };
            const mockConversation = {
                id: 'conv-1',
                history: [],
                params: { escalabilidad: 'alta' },
                state: 'evaluation_started'
            };

            getOrCreateConversation.mockResolvedValue(mockConversation);
            classifyIntent.mockResolvedValue('forzar_evaluacion');
            evaluateAndRespond.mockResolvedValue('Based on your requirements, a Monolithic architecture is recommended.');

            const result = await orchestrator.processMessage(messageData);

            expect(extractHybridParams).not.toHaveBeenCalled(); // Should not extract params when forcing
            expect(evaluateAndRespond).toHaveBeenCalled();
            expect(saveConversation).toHaveBeenCalled();
            expect(result.reply).toContain('Monolithic');
            expect(mockConversation.state).toBe('completed');
        });

        it('should handle unclear intent by starting an evaluation', async () => {
            const messageData = { message: 'I have a project', userId: 'test-user' };
            const mockConversation = { id: 'conv-1', history: [], params: {}, state: 'initial', questionsAsked: 0 };

            getOrCreateConversation.mockResolvedValue(mockConversation);
            classifyIntent.mockResolvedValue('desconocido'); // Unclear intent
            generateParameterQuestion.mockResolvedValue('What are your scalability requirements?');

            const result = await orchestrator.processMessage(messageData);

            expect(generateParameterQuestion).toHaveBeenCalled();
            expect(saveConversation).toHaveBeenCalled();
            expect(result.reply).toBe('What are your scalability requirements?');
            expect(mockConversation.state).toBe('evaluation_started');
        });
    });
});
