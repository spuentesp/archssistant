// ===== 3. core/hybridExtractor.js =====

const fs = require('fs');
const path = require('path');
const Groq = require('groq-sdk');

// Load parameter rules from the JSON file for local extraction.
const paramRulesPath = path.join(__dirname, 'param_rules.json');
const paramRules = JSON.parse(fs.readFileSync(paramRulesPath, 'utf8'));

/**
 * Extracts parameters locally using keyword matching from param_rules.json.
 * This provides a fast, baseline extraction.
 * @param {string} message The user's message.
 * @returns {Object} An object with the detected parameters.
 */
function extractLocalParams(message) {
    const lowerMsg = message.toLowerCase();
    const detectedParams = {};

    for (const param in paramRules) {
        for (const level in paramRules[param]) {
            const keywords = paramRules[param][level];
            const found = keywords.some(keyword => {
                // Use word boundaries (\b) to match whole words, making it more accurate.
                const regex = new RegExp(`\\b${keyword}\\b`, 'i');
                return regex.test(lowerMsg);
            });

            if (found) {
                detectedParams[param] = level;
                break; // Stop searching for this parameter once a level is found.
            }
        }
    }
    console.log('[HybridExtractor] Locally extracted params:', detectedParams);
    return detectedParams;
}

/**
 * Extracts parameters using a powerful LLM for deep, semantic analysis.
 * @param {string} message The user's message.
 * @param {string} apiKey The API key for the LLM service.
 * @param {string} baseURL The base URL for the LLM service.
 * @returns {Promise<Object>} A promise that resolves to an object of extracted parameters.
 */
async function extractLLMParams(message, apiKey, baseURL) {
    const groq = new Groq({
        apiKey,
        baseURL
    });

    const systemPrompt = `
Eres un experto en arquitectura de software. Tu tarea es analizar la consulta de un usuario y extraer los parámetros clave para una recomendación de arquitectura.
Los parámetros que debes identificar son: escalabilidad, costo, seguridad, complejidad, experiencia, mantenibilidad.
Para cada parámetro, asigna uno de los siguientes valores: "alto", "medio", "bajo" o "desconocido" si no se menciona.
Devuelve SÓLO un objeto JSON con los parámetros. No incluyas explicaciones.

Ejemplo de consulta: "Necesito una arquitectura muy segura y de bajo costo."
Ejemplo de JSON de salida:
{
  "escalabilidad": "desconocido",
  "costo": "bajo",
  "seguridad": "alto",
  "complejidad": "desconocido",
  "experiencia": "desconocido",
  "mantenibilidad": "desconocido"
}
`;

    try {
        const completion = await groq.chat.completions.create({
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: `Extrae los parámetros de esta consulta: "${message}"` },
            ],
            model: "gemma2-9b-it",
            response_format: { type: "json_object" },
        });

        const content = completion.choices[0]?.message?.content;
        if (!content) {
            console.warn('[HybridExtractor] LLM returned no content.');
            return {};
        }

        const params = JSON.parse(content);
        console.log('[HybridExtractor] LLM extracted params:', params);
        return params;

    } catch (error) {
        console.error('[HybridExtractor] Error during LLM parameter extraction:', error);
        return {}; // Return empty on error to allow local params to be used as fallback.
    }
}

/**
 * Orchestrates a hybrid approach to extract software architecture parameters from a message.
 * It combines a fast, local keyword-based extraction with a deep, semantic LLM-based extraction.
 * @param {string} message The user's message.
 * @param {string} apiKey The API key for the LLM service.
 * @param {string} baseURL The base URL for the LLM service.
 * @returns {Promise<Object>} A promise that resolves to the final, merged parameters.
 */
async function extractHybridParams(message, apiKey, baseURL) {
    // 1. Extract parameters locally for a quick and robust baseline.
    const localParams = extractLocalParams(message);

    // 2. Extract parameters using the LLM for deeper, semantic analysis.
    let llmParams = {};
    try {
        llmParams = await extractLLMParams(message, apiKey, baseURL);
    } catch (e) {
        console.warn('[HybridExtractor] LLM extraction failed, relying on local params.', e.message);
    }

    // 3. Merge results, prioritizing the LLM's deeper analysis only if not 'desconocido'.
    const result = {};
    const allKeys = new Set([
        ...Object.keys(localParams),
        ...Object.keys(llmParams)
    ]);
    for (const key of allKeys) {
        if (llmParams[key] && llmParams[key] !== 'desconocido') {
            result[key] = llmParams[key];
        } else if (localParams[key]) {
            result[key] = localParams[key];
        } else {
            result[key] = llmParams[key] || 'desconocido';
        }
    }

    console.log('[HybridExtractor] Merged result:', result);
    return result;
}

module.exports = { extractHybridParams };
