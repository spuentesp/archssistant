const { classifyIntent } = require('../core/intent_classifier');

jest.mock('groq-sdk');
const Groq = require('groq-sdk');

describe('Intent Classifier', () => {

    afterEach(() => {
        jest.clearAllMocks();
    });

    test('should classify intent as \'evaluate\' using LLM', async () => {
        const mockCompletion = {
            choices: [{ message: { content: 'evaluate' } }]
        };
        Groq.prototype.chat = {
            completions: {
                create: jest.fn().mockResolvedValue(mockCompletion)
            }
        };

        const intent = await classifyIntent('Necesito una arquitectura para mi nueva red social', 'fake_api_key', 'http://fake-server.com');
        expect(intent).toBe('evaluate');
        expect(Groq.prototype.chat.completions.create).toHaveBeenCalled();
    });

    test('should classify intent as \'compare\' using LLM', async () => {
        const mockCompletion = {
            choices: [{ message: { content: 'compare' } }]
        };
        Groq.prototype.chat.completions.create.mockResolvedValue(mockCompletion);

        const intent = await classifyIntent('diferencia entre monolítico y microservicios', 'fake_api_key', 'http://fake-server.com');
        expect(intent).toBe('compare');
    });

    test('should classify intent as \'inform\' using LLM', async () => {
        const mockCompletion = {
            choices: [{ message: { content: 'inform' } }]
        };
        Groq.prototype.chat.completions.create.mockResolvedValue(mockCompletion);

        const intent = await classifyIntent('¿qué es la escalabilidad?', 'fake_api_key', 'http://fake-server.com');
        expect(intent).toBe('inform');
    });

    test('should fall back to regex if LLM fails', async () => {
        Groq.prototype.chat.completions.create.mockRejectedValue(new Error('LLM Error'));

        const intent = await classifyIntent('comparar monolítico vs microservicios', 'fake_api_key', 'http://fake-server.com');
        expect(intent).toBe('compare');
    });

    test('should fall back to regex if LLM returns unexpected content', async () => {
        const mockCompletion = {
            choices: [{ message: { content: 'unexpected_intent' } }]
        };
        Groq.prototype.chat.completions.create.mockResolvedValue(mockCompletion);

        const intent = await classifyIntent('necesito una arquitectura para un sistema de logística', 'fake_api_key', 'http://fake-server.com');
        expect(intent).toBe('evaluate');
    });
});
