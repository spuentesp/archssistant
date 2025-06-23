const Groq = require('groq-sdk');

/**
 * Explica por qué una arquitectura es adecuada usando fuentes autorizadas.
 * Si la explicación es insuficiente, intenta con una arquitectura secundaria (fallback).
 * @param {string} apiKey - Clave API.
 * @param {string} architecture - Arquitectura recomendada principal.
 * @param {string} fallbackArch - Segunda mejor opción.
 * @param {object} params - Parámetros técnicos detectados.
 * @returns {Promise<string>} - Explicación en español, estructurada.
 */
async function explainArchitecture(architecture, fallbackArch, params) {
  const paramSummary = JSON.stringify(params, null, 2);

  const systemPrompt = `
Eres un experto en arquitectura de software. Siempre debes responder en español, sin incluir otros libros, autores ni temas ajenos a arquitectura de software.

Tu tarea es recomendar una arquitectura adecuada basándote en los siguientes parámetros técnicos:

${paramSummary}

Debes justificar por qué la arquitectura "${architecture}" es una buena opción. 
Si no encuentras respaldo directo en los libros, puedes usar principios generales descritos en ellos: escalabilidad, acoplamiento, cohesión, mantenibilidad, etc.

Usa exclusivamente los siguientes libros:

1. "Fundamentals of Software Architecture"  
   Autores: Mark Richards, Neal Ford  
   Editorial: O'Reilly Media, 2020  
   ISBN: 978-1-492-04345-4

2. "Software Architecture: The Hard Parts"  
   Autores: Neal Ford, Mark Richards, Pramod Sadalage, Zhamak Dehghani  
   Editorial: O'Reilly Media, 2022  
   ISBN: 978-1-492-08689-5

Tu respuesta debe tener esta estructura:
- ✅ Arquitectura sugerida: {nombre}
- 📌 Parámetros relevantes: {lista de parámetros evaluados}
- ➕ Ventajas relevantes según los libros
- ➖ Posibles limitaciones o desventajas
- 📚 Justificación técnica
- 💬 Conclusión final


tu respuesta y explicacion debe estar siempre en idioma español. Puedes incluir ejemplos o analogías si son relevantes. Puedes citar otros libros de arquitectura de software siempre y cuando tengas la fuente, pagina, ISBN y autores. debes publicar esa informacion y advertir que viene de fuera de los otros parametros.
`;

  const userPrompt = `¿Por qué "${architecture}" es adecuada para estos parámetros? Si no tienes suficiente respaldo, sugiere una mejor opción.`

  try {
    const client = new Groq({ apiKey: process.env.GROQ_API_KEY });
    const completion = await client.chat.completions.create({
      model: 'meta-llama/llama-guard-4-12b',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      response_format: { type: 'json_object' }
    });
    const content = completion.choices?.[0]?.message?.content?.trim();

    if (content && content.length > 100 && !/no (hay|tengo) (suficiente|información)/i.test(content)) {
      console.log(`[explainer] Explicación recibida (main): ${content.slice(0, 100)}...`);
      return content;
    }

    console.warn('[explainer] Primera arquitectura no fue útil. Intentando fallback...');
    return await explainFallback(apiKey, fallbackArch, params);

  } catch (error) {
    console.error('[explainer] Error al solicitar explicación:', error);
    return '⚠️ Error al generar explicación desde LLM.';
  }
}

async function explainFallback(apiKey, fallbackArch, params) {
  const paramSummary = JSON.stringify(params, null, 2);

  const systemPrompt = `
Eres un experto en arquitectura de software. Siempre responde en español y usa únicamente los libros indicados.

Tu tarea es recomendar una arquitectura adecuada para los siguientes parámetros:

${paramSummary}

Justifica por qué "${fallbackArch}" podría ser una opción más apropiada si la primera no fue válida. Apóyate en principios generales como acoplamiento, escalabilidad, simplicidad, separación de preocupaciones, etc.

Usa solo:

- "Fundamentals of Software Architecture"
- "Software Architecture: The Hard Parts"
`;

  const userPrompt = `Justifica el uso de la arquitectura "${fallbackArch}" en lugar de otra que no tuvo suficiente respaldo.`

  try {
    const client = new Groq({ apiKey: process.env.GROQ_API_KEY });
    const completion = await client.chat.completions.create({
      model: 'llama-3.1-8b-instant',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      response_format: { type: 'json_object' }
    });
    const content = completion.choices?.[0]?.message?.content?.trim();

    if (content && content.length > 100) {
      console.log(`[explainer] Explicación recibida (fallback): ${content.slice(0, 100)}...`);
      return `ℹ️ Respuesta alternativa:\n\n${content}`;
    }

    return '⚠️ No se pudo generar una explicación útil ni con la arquitectura secundaria.';

  } catch (error) {
    console.error('[explainer] Error en fallback:', error);
    return '⚠️ Error en la explicación fallback.';
  }
}

async function generateParameterQuestion(missingParams, history, apiKey, aiserver) {
    const groq = new Groq({ apiKey });

    const systemPrompt = `
Eres un asistente de arquitectura de software amigable y conversacional. Tu objetivo es ayudar al usuario a definir los parámetros necesarios para una recomendación de arquitectura.
NO des una recomendación de arquitectura todavía. Tu única tarea es hacer preguntas para aclarar los parámetros que faltan.
Basado en el historial de la conversación y los parámetros que faltan, formula una pregunta natural y amigable para obtener la siguiente pieza de información.
Solo pregunta por UN parámetro a la vez para no abrumar al usuario.

Parámetros que faltan: ${missingParams.join(', ')}
Historial de la conversación:
${history.map(h => `${h.role}: ${h.content}`).join('\n')}
`;

    const userPrompt = "Formula la siguiente pregunta que debo hacerle al usuario.";

    try {
        const completion = await groq.chat.completions.create({
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt },
            ],
            model: "llama3-8b-8192",
        });

        const question = completion.choices[0]?.message?.content.trim();
        return question || "¿Podrías darme más detalles sobre tu proyecto?";

    } catch (error) {
        console.error('[explainer] Error al generar la pregunta sobre parámetros:', error);
        return 'Tuve un problema al generar la siguiente pregunta. ¿Podemos intentarlo de nuevo?';
    }
}

module.exports = {
    explainArchitecture,
    generateParameterQuestion
};
