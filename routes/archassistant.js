const express = require('express');
const fs = require('fs');
const path = require('path');
const router = express.Router();

const { extractHybridParams } = require('../core/hybrid_extractor');
const { evaluateArchitecture } = require('../core/evaluator');
const { explainArchitecture } = require('../core/explainer');
const { answerWithKnowledge } = require('../core/knowledge_responder');

const storageFile = path.join(__dirname, '..', 'storage.json');

router.post('/', async (req, res) => {
  const { message } = req.body;
  const apiKey = process.env.GROQ_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: 'Faltan configuraciones de API' });
  }

  try {
    console.log(`[archssistant] Mensaje recibido: "${message}"`);

    // Cargar historial desde archivo si existe
    const history = fs.existsSync(storageFile)
      ? JSON.parse(fs.readFileSync(storageFile, 'utf-8'))
      : [];

    // Paso 1: extraer parámetros desde el mensaje
    const params = await extractHybridParams(message, apiKey);
    const validKeys = Object.keys(params).filter(k => params[k] !== 'desconocido');

    let reply;

    if (validKeys.length > 0) {
      console.log('[archssistant] Parámetros detectados:', params);

      // Paso 2: evaluar arquitecturas en base a los parámetros
      const evaluacion = evaluateArchitecture(params);
      const topArch = evaluacion[0]?.name || 'Monolítica';
      const fallbackArch = evaluacion[1]?.name || 'Layered';

      console.log(`[archssistant] Top 1: ${topArch} | Fallback: ${fallbackArch}`);

      // Paso 3: generar explicación con fallback si necesario
      const explicacion = await explainArchitecture(apiKey, topArch, fallbackArch, params);

      // Armar respuesta final
      reply = `📊 Evaluación:\n${evaluacion
        .map(r => `${r.name}: ${r.score.toFixed(2)}`)
        .join('\n')}\n\n🧠 Recomendación:\n${explicacion}`;
    } else {
      console.log('[archssistant] No se detectaron parámetros. Consultando módulo de conocimiento...');
      reply = await answerWithKnowledge(message, apiKey);
    }

    // Guardar en historial
    history.push({ question: message, answer: reply });
    fs.writeFileSync(storageFile, JSON.stringify(history, null, 2));

    res.json({ reply });

  } catch (err) {
    console.error('[archssistant] Error:', err);
    res.status(500).json({ error: 'Error al procesar la solicitud.' });
  }
});

module.exports = router;
