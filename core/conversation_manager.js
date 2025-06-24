const {
    createConversation,
    getConversation,
    saveConversation: dbSaveConversation,
    archiveConversation: dbArchiveConversation,
    getActiveConversationForUser,
    archiveAllConversationsForUserExceptOne,
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

    // 1. If a specific, active conversation is requested, prioritize it.
    if (conversationId) {
        const conversation = await getConversation(conversationId);
        // Ensure it belongs to the user and is active.
        if (conversation && conversation.userId === userId && conversation.isActive) {
            // As a data consistency measure, archive any other active conversations for this user.
            await archiveAllConversationsForUserExceptOne(userId, conversation.id);
            return parseConversation(conversation);
        }
    }

    // 2. If no valid conversationId was provided, find the last active conversation for the user.
    const activeConversation = await getActiveConversationForUser(userId);
    if (activeConversation) {
        // As a data consistency measure, archive any other active conversations for this user.
        await archiveAllConversationsForUserExceptOne(userId, activeConversation.id);
        return parseConversation(activeConversation);
    }

    // 3. If no active conversation exists for the user, create a new one.
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

    // Default to 'evaluar' if no intent is set but params are being discussed
    const intent = conversation.intent || 'evaluar';

    if (intent === 'evaluar') {
        if (missingParams.length > 0) {
            conversation.state = 'awaiting_params';
            return 'ask_params';
        } else {
            conversation.state = 'ready_to_evaluate';
            return 'recommend_architecture';
        }
    } else if (intent === 'comparar') {
        return 'compare_architecture';
    } else if (intent === 'informar') {
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
