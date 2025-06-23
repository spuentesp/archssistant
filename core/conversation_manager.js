const {
    createConversation,
    getConversation,
    saveConversation: dbSaveConversation,
    archiveConversation: dbArchiveConversation,
} = require('../db/database');

const ALL_PARAMS = [
    "app_type", "user_traffic", "data_storage", "security_level",
    "scalability", "budget", "dev_team_size", "deployment_speed",
    "tech_stack", "real_time_features", "third_party_integrations",
    "geographic_distribution", "availability", "compliance"
];

function parseConversation(conversation) {
    if (conversation) {
        if (typeof conversation.params === 'string') {
            conversation.params = JSON.parse(conversation.params);
        }
        if (typeof conversation.history === 'string') {
            conversation.history = JSON.parse(conversation.history);
        }
    }
    return conversation;
}

async function getOrCreateConversation(userId, conversationId) {
    if (!userId) {
        throw new Error('userId is required to get or create a conversation.');
    }

    if (conversationId) {
        const conversation = await getConversation(conversationId);
        // Ensure the conversation belongs to the user and is active
        if (conversation && conversation.userId === userId && conversation.isActive) {
            return parseConversation(conversation);
        }
    }

    // If no valid conversationId, or it doesn't belong to the user,
    // or it's inactive, create a new one.
    const newConversation = await createConversation(userId);
    return parseConversation(newConversation);
}

async function saveConversation(conversation) {
    // Create a copy to avoid mutating the object in memory
    const toSave = { ...conversation };
    if (typeof toSave.params !== 'string') {
        toSave.params = JSON.stringify(toSave.params);
    }
    if (typeof toSave.history !== 'string') {
        toSave.history = JSON.stringify(toSave.history);
    }
    await dbSaveConversation(toSave);
}

async function archiveConversation(conversationId) {
    await dbArchiveConversation(conversationId);
}

function updateConversationParams(conversation, newParams) {
    conversation.params = { ...conversation.params, ...newParams };
    return conversation;
}

function getNextAction(conversation) {
    const missingParams = ALL_PARAMS.filter(p => !conversation.params[p]);

    // Default to 'evaluate' if no intent is set but params are being discussed
    const intent = conversation.intent || 'evaluate';

    if (intent === 'evaluate') {
        if (missingParams.length > 0) {
            conversation.state = 'awaiting_params';
            return 'ask_params';
        } else {
            conversation.state = 'ready_to_evaluate';
            return 'recommend_architecture';
        }
    } else if (intent === 'compare') {
        return 'compare_architecture';
    } else if (intent === 'inform') {
        return 'answer_knowledge';
    }

    conversation.state = 'clarifying';
    return 'clarify_intent';
}

module.exports = {
    getOrCreateConversation,
    saveConversation,
    archiveConversation,
    updateConversationParams,
    getNextAction,
    ALL_PARAMS,
};
