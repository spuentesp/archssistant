const express = require('express');
const router = express.Router();

const { getOrCreateConversation, saveConversation, loadUserConversations } = require('../db/database');
const { extractHybridParams } = require('../core/hybrid_extractor');
const { evaluateArchitecture } = require('../core/evaluator');
const { explainArchitecture } = require('../core/explainer');
const { answerWithKnowledge } = require('../core/knowledge_responder');

router.post('/', async (req, res) => {
  const { message, userId } = req.body;
  const apiKey = process.env.GROQ_KEY;
  const aiserver = process.env.AISERVER;

  if (!apiKey || !aiserver) {
    return res.status(500).json({ error: 'Faltan configuraciones de API' });
  }

  if (!userId) {
    return res.status(400).json({ error: 'Falta el ID de usuario' });
  }

  try {
    console.log(`[archssistant] Mensaje recibido de ${userId}: "${message}"`);

    const conversation = await getOrCreateConversation(userId);

    const params = await extractHybridParams(message, apiKey, aiserver);
    const validKeys = Object.keys(params).filter(k => params[k] !== 'desconocido');

    let reply;

    if (validKeys.length > 0) {
      console.log('[archssistant] Parámetros detectados:', params);
      conversation.detectedParameters = { ...conversation.detectedParameters, ...params };

      const evaluacion = evaluateArchitecture(conversation.detectedParameters);
      const topArch = evaluacion[0]?.name || 'Monolítica';
      const fallbackArch = evaluacion[1]?.name || 'Layered';

      console.log(`[archssistant] Top 1: ${topArch} | Fallback: ${fallbackArch}`);

      const explicacion = await explainArchitecture(aiserver, apiKey, topArch, fallbackArch, conversation.detectedParameters);

      reply = `📊 Evaluación:\n${evaluacion
        .map(r => `${r.name}: ${r.score.toFixed(2)}`)
        .join('\n')}\n\n🧠 Recomendación:\n${explicacion}`;
    } else {
      console.log('[archssistant] No se detectaron parámetros. Consultando módulo de conocimiento...');
      reply = await answerWithKnowledge(message, apiKey, aiserver);
    }

    conversation.fullHistory.push({ question: message, answer: reply });
    conversation.userQuestions.push(message);

    await saveConversation(userId, conversation);

    res.json({ reply });

  } catch (err) {
    console.error('[archssistant] Error:', err);
    res.status(500).json({ error: 'Error al procesar la solicitud.' });
  }
});

router.get('/history/:userId', async (req, res) => {
    const { userId } = req.params;
    try {
        const conversations = await loadUserConversations(userId);
        res.json(conversations);
    } catch (err) {
        console.error('[archssistant] Error al cargar el historial:', err);
        res.status(500).json({ error: 'Error al cargar el historial.' });
    }
});

module.exports = router;
