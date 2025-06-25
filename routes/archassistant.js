const express = require('express');
const router = express.Router();
const { ConversationOrchestrator } = require('../core/orchestrator');
const { getConversations } = require('../db/database');

// Initialize orchestrator
const orchestrator = new ConversationOrchestrator();

router.post('/', async (req, res) => {
  try {
    const result = await orchestrator.processMessage(req.body);
    res.json(result);
  } catch (err) {
    console.error('[archassistant] Error:', err.message);
    
    // Handle specific error types
    if (err.message.includes('Falta el ID de usuario')) {
      return res.status(400).json({ error: err.message });
    }
    
    if (err.message.includes('API settings are missing')) {
      return res.status(500).json({ error: 'Faltan configuraciones de API.' });
    }
    
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
