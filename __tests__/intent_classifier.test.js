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

    test('should classify intent as \'comparar\' using LLM', async () => {
        const mockCompletion = {
            choices: [{ message: { content: 'comparar' } }]
        };
        Groq.prototype.chat.completions.create.mockResolvedValue(mockCompletion);

        const intent = await classifyIntent('diferencia entre monolítico y microservicios', 'fake_api_key', 'http://fake-server.com');
        expect(intent).toBe('comparar');
    });

    test('should classify intent as \'informar\' using LLM', async () => {
        const mockCompletion = {
            choices: [{ message: { content: 'informar' } }]
        };
        Groq.prototype.chat.completions.create.mockResolvedValue(mockCompletion);

        const intent = await classifyIntent('¿qué es la escalabilidad?', 'fake_api_key', 'http://fake-server.com');
        expect(intent).toBe('informar');
    });

    test('should fall back to regex if LLM fails', async () => {
        Groq.prototype.chat.completions.create.mockRejectedValue(new Error('LLM Error'));

        const intent = await classifyIntent('comparar monolítico vs microservicios', 'fake_api_key', 'http://fake-server.com');
        expect(intent).toBe('comparar');
    });

    test('should fall back to regex if LLM returns unexpected content', async () => {
        const mockCompletion = {
            choices: [{ message: { content: 'unexpected_intent' } }]
        };
        Groq.prototype.chat.completions.create.mockResolvedValue(mockCompletion);

        const intent = await classifyIntent('necesito una arquitectura para un sistema de logística', 'fake_api_key', 'http://fake-server.com');
        expect(intent).toBe('evaluar');
    });
});
