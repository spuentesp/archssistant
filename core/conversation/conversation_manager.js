const {
    createConversation,
    saveConversation: dbSaveConversation,
    getActiveConversation,
    archiveConversation,
} = require('../../db/database');

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

async function getOrCreateConversation(userId) {
    if (!userId) {
        throw new Error('userId is required to get or create a conversation.');
    }

    console.log(`[conversation_manager] Getting or creating conversation for user ${userId}`);

    // 1. Intenta obtener la conversación activa para el usuario.
    let conversation = await getActiveConversation(userId);

    // 2. Si no existe ninguna conversación activa, se crea una nueva.
    // La función createConversation en la capa de base de datos se encarga de archivar las antiguas.
    if (!conversation) {
        console.log(`[conversation_manager] No active conversation found for user ${userId}. Creating a new one.`);
        conversation = await createConversation(userId);
    } else {
        console.log(`[conversation_manager] Found active conversation ${conversation.id} for user ${userId}.`);
        conversation = parseConversation(conversation);
    }

    return conversation;
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

function updateConversationParams(conversation, newParams) {
    for (const key in newParams) {
        if (newParams[key] !== 'unknown') {
            conversation.params[key] = newParams[key];
        }
    }
}

async function archiveCurrentConversation(userId) {
    if (!userId) {
        throw new Error('userId is required to archive a conversation.');
    }

    console.log(`[conversation_manager] Archiving current conversation for user ${userId}`);

    // Obtener la conversación activa
    const activeConversation = await getActiveConversation(userId);
    
    if (activeConversation) {
        // Archivar la conversación actual
        await archiveConversation(activeConversation.id);
        console.log(`[conversation_manager] Archived conversation ${activeConversation.id} for user ${userId}`);
        return true;
    } else {
        console.log(`[conversation_manager] No active conversation found to archive for user ${userId}`);
        return false;
    }
}

module.exports = {
    getOrCreateConversation,
    saveConversation,
    updateConversationParams,
    archiveCurrentConversation,
};
