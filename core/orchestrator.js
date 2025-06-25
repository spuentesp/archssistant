const fs = require('fs');
const path = require('path');

// Dependencies
const { getOrCreateConversation, saveConversation, updateConversationParams, archiveCurrentConversation } = require('./conversation/conversation_manager');
const { extractHybridParams } = require('./ingestion/hybrid_extractor');
const { generateParameterQuestion, answerGeneralQuestion } = require('./ingestion/explainer');
const { classifyIntent } = require('./intent/intent_classifier');
const { evaluateAndRespond } = require('./conversation/response_handler');

/**
 * Service for handling API configuration validation
 * Single Responsibility: API configuration validation
 */
class ApiConfigService {
    constructor() {
        this.apiKey = process.env.GROQ_API_KEY;
        this.baseURL = process.env.AISERVER;
    }

    validate() {
        if (!this.apiKey || !this.baseURL) {
            throw new Error('API settings are missing (GROQ_KEY or AISERVER)');
        }
        return { apiKey: this.apiKey, baseURL: this.baseURL };
    }
}

/**
 * Service for loading architecture parameters
 * Single Responsibility: Architecture parameter management
 */
class ArchitectureParamsService {
    constructor() {
        this.architectureDataPath = path.join(__dirname, 'ingestion/architecture_params.json');
        this.architectureData = JSON.parse(fs.readFileSync(this.architectureDataPath, 'utf-8'));
        this.allParams = Object.keys(this.architectureData[0]).filter(key => key !== 'name');
    }

    getAllParams() {
        return this.allParams;
    }

    getMissingParams(conversation) {
        return this.allParams.filter(p => !conversation.params[p] || conversation.params[p] === 'desconocido');
    }

    getKnownParams(conversation) {
        return this.allParams.filter(p => conversation.params[p] && conversation.params[p] !== 'desconocido');
    }
}

/**
 * Strategy interface for handling different conversation intents
 * Open/Closed Principle: Open for extension, closed for modification
 */
class ConversationStrategy {
    async handle(context) {
        // eslint-disable-next-line no-unused-vars
        const { message, userId, conversation, intent, apiConfig } = context;
        throw new Error('handle method must be implemented');
    }
}

/**
 * Strategy for handling general questions
 */
class GeneralQuestionStrategy extends ConversationStrategy {
    async handle(context) {
        const { message, conversation, apiConfig } = context;
        
        const reply = await answerGeneralQuestion(message, apiConfig.apiKey, apiConfig.baseURL);
        conversation.history.push({ role: 'assistant', content: reply });
        await saveConversation(conversation);
        
        return {
            reply,
            conversationId: conversation.id,
            state: conversation.state
        };
    }
}

/**
 * Strategy for handling conversation archival
 */
class ArchivalStrategy extends ConversationStrategy {
    async handle(context) {
        const { userId } = context;
        
        await archiveCurrentConversation(userId);
        const reply = "¡Conversación archivada! He guardado todo nuestro historial y estoy listo para empezar una nueva conversación. ¿En qué puedo ayudarte ahora? 😊";
        
        const newConversation = await getOrCreateConversation(userId);
        newConversation.history.push({ role: 'assistant', content: reply });
        await saveConversation(newConversation);
        
        return {
            reply,
            conversationId: newConversation.id,
            state: newConversation.state,
            archived: true
        };
    }
}

/**
 * Strategy for handling evaluation requests
 */
class EvaluationStrategy extends ConversationStrategy {
    constructor(architectureParamsService) {
        super();
        this.architectureParamsService = architectureParamsService;
    }

    async handle(context) {
        const { message, conversation, intent, apiConfig } = context;
        
        if (conversation.state !== 'evaluation_started') {
            conversation.state = 'evaluation_started';
        }

        // Extract parameters if not forcing evaluation
        if (intent !== 'forzar_evaluacion') {
            const extractedParams = await extractHybridParams(message, apiConfig.apiKey, apiConfig.baseURL);
            // Merge extractedParams with previous params, preferring previous value if new is 'desconocido'
            const mergedParams = { ...conversation.params };
            for (const key of Object.keys(extractedParams)) {
                if (extractedParams[key] && extractedParams[key] !== 'desconocido') {
                    mergedParams[key] = extractedParams[key];
                } else if (conversation.params[key]) {
                    mergedParams[key] = conversation.params[key];
                } else {
                    mergedParams[key] = 'desconocido';
                }
            }
            conversation.params = mergedParams;
            updateConversationParams(conversation, mergedParams);
            console.log('[orchestrator] Extracted and updated params:', conversation.params);
        }

        const missingParams = this.architectureParamsService.getMissingParams(conversation);
        const knownParams = this.architectureParamsService.getKnownParams(conversation);

        let reply;

        if (missingParams.length === 0 || intent === 'forzar_evaluacion') {
            if (intent === 'forzar_evaluacion') {
                console.log('[orchestrator] User forced evaluation. Evaluating with current params.');
            } else {
                console.log('[orchestrator] All params gathered. Evaluating.');
            }
            reply = await evaluateAndRespond(conversation, apiConfig.apiKey, apiConfig.baseURL);
            conversation.state = 'completed';
        } else {
            console.log(`[orchestrator] Missing params: ${missingParams.join(', ')}. Asking for more info.`);
            const questionsAsked = conversation.questionsAsked || 0;

            // Suggest evaluation if 3 questions asked or 3 parameters known
            if ((questionsAsked >= 3 || knownParams.length >= 3) && !conversation.suggestion_given) {
                const suggestion = "Veo que ya tenemos suficiente información para una evaluación preliminar. Si quieres, puedo darte una recomendación ahora, o podemos seguir profundizando. Puedes decir \"evalúa ya\" cuando quieras.";
                const nextQuestion = await generateParameterQuestion(missingParams, conversation.history, apiConfig.apiKey, apiConfig.baseURL);
                reply = `${suggestion}\n\n${nextQuestion}`;
                conversation.suggestion_given = true;
            } else {
                reply = await generateParameterQuestion(missingParams, conversation.history, apiConfig.apiKey, apiConfig.baseURL);
            }
            conversation.questionsAsked = questionsAsked + 1;
        }

        conversation.history.push({ role: 'assistant', content: reply });
        await saveConversation(conversation);

        return {
            reply,
            conversationId: conversation.id,
            state: conversation.state
        };
    }
}

/**
 * Strategy for handling unclear intents (default evaluation)
 */
class DefaultEvaluationStrategy extends ConversationStrategy {
    constructor(architectureParamsService) {
        super();
        this.architectureParamsService = architectureParamsService;
    }

    async handle(context) {
        const { conversation, apiConfig } = context;
        
        console.log('[orchestrator] Unclear intent, assuming evaluation. Asking for initial parameters.');
        conversation.state = 'evaluation_started';
        const missingParams = this.architectureParamsService.getMissingParams(conversation);
        const reply = await generateParameterQuestion(missingParams, conversation.history, apiConfig.apiKey, apiConfig.baseURL);
        conversation.questionsAsked = (conversation.questionsAsked || 0) + 1;

        conversation.history.push({ role: 'assistant', content: reply });
        await saveConversation(conversation);

        return {
            reply,
            conversationId: conversation.id,
            state: conversation.state
        };
    }
}

/**
 * Factory for creating conversation strategies
 * Dependency Inversion: Depends on abstractions, not concretions
 */
class ConversationStrategyFactory {
    constructor(architectureParamsService) {
        this.architectureParamsService = architectureParamsService;
        this.strategies = new Map([
            ['pregunta_general', new GeneralQuestionStrategy()],
            ['archivar', new ArchivalStrategy()],
            ['evaluar', new EvaluationStrategy(architectureParamsService)],
            ['forzar_evaluacion', new EvaluationStrategy(architectureParamsService)],
            ['default', new DefaultEvaluationStrategy(architectureParamsService)]
        ]);
    }

    getStrategy(intent, conversationState) {
        // Handle evaluation continuation
        if (conversationState === 'evaluation_started' && !this.strategies.has(intent)) {
            return this.strategies.get('evaluar');
        }
        
        return this.strategies.get(intent) || this.strategies.get('default');
    }
}

/**
 * Main orchestrator service
 * Single Responsibility: Orchestrate conversation flow
 * Open/Closed: Open for extension via strategies
 * Liskov Substitution: All strategies implement the same interface
 * Interface Segregation: Each strategy has a focused interface
 * Dependency Inversion: Depends on abstractions (strategies)
 */
class ConversationOrchestrator {
    constructor() {
        this.apiConfigService = new ApiConfigService();
        this.architectureParamsService = new ArchitectureParamsService();
        this.strategyFactory = new ConversationStrategyFactory(this.architectureParamsService);
    }

    async processMessage(messageData) {
        const { message, userId } = messageData;

        // Validate required fields
        if (!userId) {
            throw new Error('Falta el ID de usuario.');
        }

        // Validate API configuration
        const apiConfig = this.apiConfigService.validate();

        // Get or create conversation
        const conversation = await getOrCreateConversation(userId);
        
        // Add user message to history
        conversation.history.push({ role: 'user', content: message });

        // Classify intent
        const intent = await classifyIntent(message, apiConfig.apiKey, apiConfig.baseURL);
        console.log(`[orchestrator] Intent classified as: ${intent}`);
        console.log(`[orchestrator] Current conversation state: ${conversation.state}`);

        // Get appropriate strategy
        const strategy = this.strategyFactory.getStrategy(intent, conversation.state);

        // Execute strategy
        const context = {
            message,
            userId,
            conversation,
            intent,
            apiConfig
        };

        return await strategy.handle(context);
    }
}

module.exports = {
    ConversationOrchestrator,
    // Export for testing
    ApiConfigService,
    ArchitectureParamsService,
    ConversationStrategyFactory,
    GeneralQuestionStrategy,
    ArchivalStrategy,
    EvaluationStrategy,
    DefaultEvaluationStrategy
};