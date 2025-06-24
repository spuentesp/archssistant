// ===== 3. core/hybridExtractor.js =====

const { detectarParametros } = require('./param_analyzer');
const { extractParams } = require('./extractor');

async function extractHybridParams(message, apiKey) {
  const localParams = detectarParametros(message);
  let llmParams = {};

  try {
    llmParams = await extractParams(message, apiKey);
  } catch (e) {
    console.warn('[hybridExtractor] Error LLM, usando solo local', e.message);
  }

  // Merge local and LLM parameters.
  // LLM parameters are prioritized because they result from a deeper analysis.
  // We include 'unknown' to signify that the parameter has been processed,
  // preventing the assistant from asking for it again.
  const result = { ...localParams, ...llmParams };

  console.log('[hybridExtractor] Resultado combinado:', result);
  return result;
}

module.exports = { extractHybridParams };
