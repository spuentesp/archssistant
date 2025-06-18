
// ===== 3. core/hybridExtractor.js =====

const { detectarParametros } = require('./param_analyzer');
const { extractParams } = require('./extractor');

const escala = { bajo: 1, medio: 2, alto: 3 };

function promedio(paramA, paramB) {
  const a = escala[paramA] || 0;
  const b = escala[paramB] || 0;
  if (!a && !b) return 'desconocido';
  if (!a) return paramB;
  if (!b) return paramA;

  const avg = (a + b) / 2;
  if (avg <= 1.5) return 'bajo';
  if (avg <= 2.4) return 'medio';
  return 'alto';
}

async function extractHybridParams(message, apiKey, aiserver) {
  const localParams = detectarParametros(message);
  let llmParams = {};

  try {
    llmParams = await extractParams(message, apiKey, aiserver);
  } catch (e) {
    console.warn('[hybridExtractor] Error LLM, usando solo local', e.message);
  }

  const todos = new Set([...Object.keys(localParams), ...Object.keys(llmParams)]);
  const resultado = {};
  for (const k of todos) {
    resultado[k] = promedio(localParams[k], llmParams[k]);
  }

  console.log('[hybridExtractor] Resultado combinado:', resultado);
  return resultado;
}

module.exports = { extractHybridParams };
