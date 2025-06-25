const Groq = require('groq-sdk');
const fs = require('fs');
const path = require('path');

// Load intent rules from the JSON file.
const intentRulesPath = path.join(__dirname, 'intent_rules.json');
const intentRules = JSON.parse(fs.readFileSync(intentRulesPath, 'utf8'));


// Fallback function in case the LLM fails. It uses rules from intent_rules.json.
function classifyIntentRegex(message) {
    const lowerMsg = message.toLowerCase();

    // Iterate through each intent defined in the rules file.
    for (const intent in intentRules) {
        const ruleGroups = intentRules[intent];

        // An intent is matched if any of its rule groups match.
        const matched = ruleGroups.some(group => {
            const patterns = group.patterns.map(p => new RegExp(p, 'i'));

            if (group.type === 'all') {
                // For an "all" group, every pattern must match.
                return patterns.every(regex => regex.test(lowerMsg));
            } else { // 'any' is the default
                // For an "any" group, at least one pattern must match.
                return patterns.some(regex => regex.test(lowerMsg));
            }
        });

        if (matched) {
            return intent;
        }
    }

    // If no specific intent is matched, default to "pregunta_general".
    return 'pregunta_general';
}

async function classifyIntent(message, apiKey, baseURL) {
    const groq = new Groq({
        apiKey,
        baseURL
    });

    const systemPrompt = `
Eres un clasificador de intenciones para un asistente de arquitectura de software.
Tu tarea es clasificar la intención del usuario en una de las siguientes categorías:

- "evaluar": El usuario quiere una recomendación de arquitectura de software, o está describiendo su proyecto. Ejemplos: "necesito una arquitectura para una red social", "mi app tendrá mucho tráfico de usuarios", "busco algo con alta disponibilidad".
- "forzar_evaluacion": El usuario, después de que se le pidieran más datos, insiste en obtener una respuesta con la información que ya ha proporcionado. Ejemplos: "evalúa con lo que tienes", "no tengo más datos, solo responde", "dame la respuesta ya", "continúa", "así está bien".
- "pregunta_general": El usuario está haciendo una pregunta de conocimiento general sobre arquitectura de software. Ejemplos: "¿qué es la escalabilidad?", "¿me explicas qué es un service mesh?", "¿cuál es la diferencia entre microservicios y monolítico?", "monolítico vs microservicios".
- "archivar": El usuario quiere archivar la conversación actual y empezar una nueva. Ejemplos: "archivar conversación", "guardar chat", "empezar de nuevo", "nueva conversación", "terminar", "reset".

Analiza la siguiente consulta del usuario y responde únicamente con la etiqueta de la intención. Si la consulta no tiene sentido o no puedes clasificarla, responde 'no puedo clasificar la consulta'.
`;

    try {
        const completion = await groq.chat.completions.create({
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: `Clasifica esta consulta: "${message}"` },
            ],
            model: "gemma2-9b-it",
        });

        let intent = completion.choices[0]?.message?.content.trim().toLowerCase().replace(/"/g, '');

        if (['evaluar', 'pregunta_general', 'forzar_evaluacion', 'archivar'].includes(intent)) {
            console.log(`[IntentClassifier] LLM classified intent as: ${intent}`);
            return intent;
        }

        if (intent.includes('no puedo clasificar la consulta')) {
            console.log('[IntentClassifier] LLM could not classify intent.');
            return intent;
        }
        
        console.warn(`[IntentClassifier] LLM returned unexpected intent: ${intent}. Falling back to regex.`);
        return classifyIntentRegex(message);

    } catch (error) {
        console.error('[IntentClassifier] Error using LLM for intent classification, falling back to regex:', error);
        return classifyIntentRegex(message);
    }
}

module.exports = { classifyIntent };