const { classifyIntent } = require('../core/intent_classifier');

jest.mock('groq-sdk');
const Groq = require('groq-sdk');

describe('Intent Classifier', () => {

    afterEach(() => {
        jest.clearAllMocks();
    });

    test('should classify intent as \'evaluar\' using LLM', async () => {
        const mockCompletion = {
            choices: [{ message: { content: 'evaluar' } }]
        };
        Groq.prototype.chat = {
            completions: {
                create: jest.fn().mockResolvedValue(mockCompletion)
            }
        };

        const intent = await classifyIntent('Necesito una arquitectura para mi nueva red social', 'fake_api_key', 'http://fake-server.com');
        expect(intent).toBe('evaluar');
        expect(Groq.prototype.chat.completions.create).toHaveBeenCalled();
    });

    test('should classify intent as \'pregunta_general\' using LLM', async () => {
        const mockCompletion = {
            choices: [{ message: { content: 'pregunta_general' } }]
        };
        Groq.prototype.chat.completions.create.mockResolvedValue(mockCompletion);

        const intent = await classifyIntent('diferencia entre monolítico y microservicios', 'fake_api_key', 'http://fake-server.com');
        expect(intent).toBe('pregunta_general');
    });

    test('should classify intent as \'pregunta_general\' for knowledge questions using LLM', async () => {
        const mockCompletion = {
            choices: [{ message: { content: 'pregunta_general' } }]
        };
        Groq.prototype.chat.completions.create.mockResolvedValue(mockCompletion);

        const intent = await classifyIntent('¿qué es la escalabilidad?', 'fake_api_key', 'http://fake-server.com');
        expect(intent).toBe('pregunta_general');
    });

    test('should fall back to regex if LLM fails', async () => {
        Groq.prototype.chat.completions.create.mockRejectedValue(new Error('LLM Error'));

        const intent = await classifyIntent('¿qué es la escalabilidad?', 'fake_api_key', 'http://fake-server.com');
        expect(intent).toBe('pregunta_general');
    });

    test('should fall back to regex if LLM returns unexpected content', async () => {
        const mockCompletion = {
            choices: [{ message: { content: 'unexpected_intent' } }]
        };
        Groq.prototype.chat.completions.create.mockResolvedValue(mockCompletion);

        const intent = await classifyIntent('necesito una arquitectura para un sistema de logística', 'fake_api_key', 'http://fake-server.com');
        expect(intent).toBe('evaluar');
    });

    test('should classify intent as \'archivar\' using LLM', async () => {
        const mockCompletion = {
            choices: [{ message: { content: 'archivar' } }]
        };
        Groq.prototype.chat.completions.create.mockResolvedValue(mockCompletion);

        const intent = await classifyIntent('archivar conversación', 'fake_api_key', 'http://fake-server.com');
        expect(intent).toBe('archivar');
    });

    test('should classify intent as \'archivar\' using regex fallback', async () => {
        Groq.prototype.chat.completions.create.mockRejectedValue(new Error('LLM Error'));

        const intent = await classifyIntent('empezar de nuevo', 'fake_api_key', 'http://fake-server.com');
        expect(intent).toBe('archivar');
    });

    test('should classify intent as \'archivar\' for various archiving phrases', async () => {
        Groq.prototype.chat.completions.create.mockRejectedValue(new Error('LLM Error'));

        const archiveMessages = [
            'nueva conversación',
            'reset',
            'terminar',
            'guardar chat',
            'reiniciar'
        ];

        for (const message of archiveMessages) {
            const intent = await classifyIntent(message, 'fake_api_key', 'http://fake-server.com');
            expect(intent).toBe('archivar');
        }
    });
});
