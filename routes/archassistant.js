const express = require('express');
const router = express.Router();

const { getOrCreateConversation, saveConversation, archiveConversation, updateConversationParams, getNextAction, ALL_PARAMS } = require('../core/conversation_manager');
const { extractHybridParams } = require('../core/hybrid_extractor');
const { evaluateArchitecture } = require('../core/evaluator');
const { explainArchitecture, generateParameterQuestion } = require('../core/explainer');
const { answerWithKnowledge } = require('../core/knowledge_responder');
const { classifyIntent } = require('../core/intent_classifier');
const { getConversationsForUser } = require('../db/database');

router.post('/', async (req, res) => {
  const { message, conversationId, userId } = req.body;
  const apiKey = process.env.GROQ_API_KEY;
  const baseURL = process.env.AISERVER;

  if (!userId) {
    return res.status(400).json({ error: 'Falta el ID de usuario' });
  }

  if (!apiKey || !baseURL) {
    console.error('[archssistant] Error: Faltan configuraciones de API (GROQ_KEY o AISERVER)');
    return res.status(500).json({ error: 'Faltan configuraciones de API' });
  }

  try {
    console.log(`[archssistant] Mensaje recibido: "${message}"`);

    const conversation = await getOrCreateConversation(userId, conversationId);

    // 2. Classify intent
    if (!conversation.intent || message.toLowerCase().startsWith('system:')) {
        conversation.intent = await classifyIntent(message, apiKey, baseURL);
    }

    // 3. Update conversation state
    const params = await extractHybridParams(message, apiKey, baseURL);
    updateConversationParams(conversation, params);

    const action = getNextAction(conversation);
    let reply;

    console.log(`[archssistant] Action: ${action}`);

    switch (action) {
        case 'ask_params': {
            const missingParams = ALL_PARAMS.filter(p => !conversation.params[p]);
            reply = await generateParameterQuestion(missingParams, conversation.history, apiKey, baseURL);
            break;
        }
        case 'recommend_architecture': {
            const evaluacion = evaluateArchitecture(conversation.params);
            const topArch = evaluacion[0]?.name || 'Monolítica';
            const fallbackArch = evaluacion[1]?.name || 'Layered';
            const explicacion = await explainArchitecture(baseURL, apiKey, topArch, fallbackArch, conversation.params);
            reply = `📊 Evaluación:\n${evaluacion
                .map(r => `${r.name}: ${r.score.toFixed(2)}`)
                .join('\n')}\n\n🧠 Recomendación:\n${explicacion}`;
            conversation.state = 'completed';
            break;
        }
        case 'answer_knowledge':
            reply = await answerWithKnowledge(message, apiKey, baseURL);
            break;
        case 'compare_architecture':
            // Lógica para comparar arquitecturas (a implementar)
            reply = "La funcionalidad de comparación aún no está implementada.";
            break;
        case 'clarify_intent':
            reply = "No estoy seguro de cómo ayudarte. ¿Podrías reformular tu pregunta?";
            break;
        default:
            reply = "Ha ocurrido un error inesperado.";
            break;
    }

    conversation.history.push({ role: 'user', content: message });
    conversation.history.push({ role: 'assistant', content: reply });

    await saveConversation(conversation);

    if (conversation.state === 'completed') {
        await archiveConversation(conversation.id);
    }

    res.json({ reply, conversationId: conversation.id, state: conversation.state });

  } catch (err) {
    console.error('[archssistant] Error:', err);
    res.status(500).json({ error: 'Error al procesar la solicitud.' });
  }
});

router.get('/history/:userId', async (req, res) => {
    const { userId } = req.params;
    try {
        const conversations = await getConversationsForUser(userId);
        res.json(conversations);
    } catch (err) {
        console.error('[archssistant] Error al cargar el historial:', err);
        res.status(500).json({ error: 'Error al cargar el historial.' });
    }
});

module.exports = router;
