const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

// Cargar datos de arquitectura para obtener dinámicamente los nombres de los parámetros
const architectureDataPath = path.join(__dirname, '../core/architecture_params.json');
const architectureData = JSON.parse(fs.readFileSync(architectureDataPath, 'utf-8'));
const allParams = Object.keys(architectureData[0]).filter(key => key !== 'name');
const MAX_QUESTIONS_BEFORE_SUGGESTION = allParams.length;

const { getOrCreateConversation, saveConversation, updateConversationParams } = require('../core/conversation_manager');
const { extractHybridParams } = require('../core/hybrid_extractor');
const { generateParameterQuestion, answerGeneralQuestion } = require('../core/explainer');
const { classifyIntent } = require('../core/intent_classifier');
const { getConversations } = require('../db/database');
const { evaluateAndRespond } = require('../core/response_handler');

router.post('/', async (req, res) => {
  const { message, userId } = req.body;
  const apiKey = process.env.GROQ_API_KEY;
  const baseURL = process.env.AISERVER;

  if (!userId) {
    return res.status(400).json({ error: 'Falta el ID de usuario.' });
  }

  if (!apiKey || !baseURL) {
    console.error('[archssistant] Error: API settings are missing (GROQ_KEY or AISERVER)');
    return res.status(500).json({ error: 'Faltan configuraciones de API.' });
  }

  try {
    const conversation = await getOrCreateConversation(userId);
    let reply;

    conversation.history.push({ role: 'user', content: message });

    const intent = await classifyIntent(message, apiKey, baseURL);
    console.log(`[archassistant] Intent classified as: ${intent}`);
    console.log(`[archassistant] Current conversation state: ${conversation.state}`);

    if (intent === 'pregunta_general') {
        reply = await answerGeneralQuestion(message, apiKey, baseURL);
        conversation.history.push({ role: 'assistant', content: reply });
        await saveConversation(conversation);
        return res.json({ reply, conversationId: conversation.id, state: conversation.state });
    }

    if (intent === 'evaluar_arquitectura' || conversation.state === 'evaluation_started') {
        if (conversation.state !== 'evaluation_started') {
            conversation.state = 'evaluation_started';
        }

        // Solo extrae parámetros si la intención no es forzar la evaluación, 
        // ya que se asume que el usuario está dando una orden y no nueva información.
        if (intent !== 'forzar_evaluacion') {
            const extractedParams = await extractHybridParams(message, apiKey, baseURL);
            updateConversationParams(conversation, extractedParams);
            console.log('[archassistant] Extracted and updated params:', conversation.params);
        }

        const missingParams = allParams.filter(p => !conversation.params[p] || conversation.params[p] === 'desconocido');

        if (missingParams.length === 0 || intent === 'forzar_evaluacion') {
            if (intent === 'forzar_evaluacion') {
                console.log('[archassistant] User forced evaluation. Evaluating with current params.');
            } else {
                console.log('[archassistant] All params gathered. Evaluating.');
            }
            reply = await evaluateAndRespond(conversation, apiKey, baseURL);
            conversation.state = 'completed';
        } else {
            console.log(`[archassistant] Missing params: ${missingParams.join(', ')}. Asking for more info.`);
            
            if (conversation.questionsAsked && conversation.questionsAsked >= MAX_QUESTIONS_BEFORE_SUGGESTION) {
                const suggestion = "Veo que ya hemos cubierto varios puntos. ¿Quieres que evalúe una arquitectura con la información que tenemos, o prefieres que sigamos afinando con más preguntas? Puedes responder \"evalúa ya\" o seguir la conversación.";
                const nextQuestion = await generateParameterQuestion(missingParams, conversation.history, apiKey, baseURL);
                reply = `${suggestion}\n\n${nextQuestion}`;
            } else {
                reply = await generateParameterQuestion(missingParams, conversation.history, apiKey, baseURL);
            }
            conversation.questionsAsked = (conversation.questionsAsked || 0) + 1;
        }
    } else {
        console.log('[archassistant] Unclear intent, assuming evaluation. Asking for initial parameters.');
        conversation.state = 'evaluation_started';
        const missingParams = allParams.filter(p => !conversation.params[p] || conversation.params[p] === 'desconocido');
        reply = await generateParameterQuestion(missingParams, conversation.history, apiKey, baseURL);
        conversation.questionsAsked = (conversation.questionsAsked || 0) + 1;
    }

    conversation.history.push({ role: 'assistant', content: reply });
    await saveConversation(conversation);

    res.json({ reply, conversationId: conversation.id, state: conversation.state });

  } catch (err) {
    console.error('[archssistant] Error:', err);
    res.status(500).json({ error: 'Error al procesar la solicitud.' });
  }
});

router.get('/history/:userId', async (req, res) => {
    const { userId } = req.params;
    try {
        const conversations = await getConversations(userId);
        res.json(conversations);
    } catch (err) {
        console.error('[archssistant] Error loading history:', err);
        res.status(500).json({ error: 'Error al cargar el historial.' });
    }
});

module.exports = router;
