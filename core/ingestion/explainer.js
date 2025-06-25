const Groq = require('groq-sdk');

async function explainArchitecture(baseURL, apiKey, topArch, fallbackArch, params) {
  const paramSummary = JSON.stringify(params, null, 2);

  const systemPrompt = `
Eres un experto en arquitectura de software. IMPORTANTE: Tu respuesta DEBE SER SIEMPRE en idioma ESPAÑOL. No incluyas otros libros, autores ni temas ajenos a arquitectura de software.

Tu tarea es recomendar una arquitectura adecuada basándote en los siguientes parámetros técnicos:

${paramSummary}

Debes justificar por qué la arquitectura "${topArch}" es una buena opción. 
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

IMPORTANTE: Tu respuesta y explicación DEBEN ESTAR SIEMPRE en idioma ESPAÑOL. Puedes incluir ejemplos o analogías si son relevantes. Puedes citar otros libros de arquitectura de software siempre y cuando tengas la fuente, pagina, ISBN y autores. debes publicar esa informacion y advertir que viene de fuera de los otros parametros.
`;

  const userPrompt = `¿Por qué "${topArch}" es adecuada para estos parámetros? Si no tienes suficiente respaldo, sugiere una mejor opción.`

  try {
    const client = new Groq({ apiKey });
    const completion = await client.chat.completions.create({
      model: 'gemma2-9b-it',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
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
    return 'Error al generar explicación desde LLM.';
  }
}

async function explainFallback(apiKey, fallbackArch, params) {
  const paramSummary = JSON.stringify(params, null, 2);

  const systemPrompt = `
Eres un experto en arquitectura de software. IMPORTANTE: Tu respuesta DEBE SER SIEMPRE en idioma ESPAÑOL y usa únicamente los libros indicados.

Tu tarea es recomendar una arquitectura adecuada para los siguientes parámetros:

${paramSummary}

Justifica por qué "${fallbackArch}" podría ser una opción más apropiada si la primera no fue válida. Apóyate en principios generales como acoplamiento, escalabilidad, simplicidad, separación de preocupaciones, etc.

Usa solo:

- "Fundamentals of Software Architecture"
- "Software Architecture: The Hard Parts"
`;

  const userPrompt = `Justifica el uso de la arquitectura "${fallbackArch}" en lugar de otra que no tuvo suficiente respaldo.`

  try {
    const client = new Groq({ apiKey });
    const completion = await client.chat.completions.create({
      model: 'gemma2-9b-it',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
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

async function generateParameterQuestion(missingParams, history, apiKey, baseURL) {
    const groq = new Groq({
        apiKey,
        baseURL
    });

    const systemPrompt = `
Eres un asistente de arquitectura de software. Tu objetivo es recopilar los requisitos del usuario para poder hacer una buena recomendación.
Basado en el historial de la conversación, haz una pregunta para obtener información sobre los siguientes parámetros que faltan: ${missingParams.join(', ')}.
Sé amigable y conversacional. No pidas la información de una manera robótica.
IMPORTANTE: Tu respuesta DEBE SER SIEMPRE en idioma ESPAÑOL.
`;
    const limitedHistory = history.slice(-6);

    const userPrompt = `El usuario ha descrito un proyecto, pero faltan algunos detalles. Basado en el historial de la conversación, formula una única pregunta natural para preguntarle al usuario sobre los siguientes aspectos que faltan: ${missingParams.join(', ')}. No los pidas uno por uno. Combínalos en una pregunta fluida. Por ejemplo: "¡Gracias por los detalles! Para darte una mejor recomendación, ¿podrías contarme también sobre tu presupuesto y el nivel de experiencia del equipo?"

Historial de la Conversación:
${limitedHistory.map(h => `${h.role}: ${h.content}`).join('\n')}`;

    try {
        const completion = await groq.chat.completions.create({
            model: "gemma2-9b-it",
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userPrompt }
            ],
        });

        const question = completion.choices[0]?.message?.content.trim();
        console.log(`[Explainer] Generated question: ${question}`);
        return question;

    } catch (error) {
        console.error('[Explainer] Error generating parameter question:', error);
        return "Lo siento, no pude generar la siguiente pregunta. ¿Podrías darme más detalles sobre tu proyecto?";
    }
}

async function answerGeneralQuestion(message, apiKey, baseURL) {
    const groq = new Groq({
        apiKey,
        baseURL
    });

    const systemPrompt = `
Eres un experto en arquitectura de software. Responde a la pregunta del usuario de forma clara y concisa.
Usa un lenguaje sencillo y evita la jerga técnica excesiva.
IMPORTANTE: Tu respuesta DEBE SER SIEMPRE en idioma ESPAÑOL.
`;

    try {
        const completion = await groq.chat.completions.create({
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: message },
            ],
            model: "gemma2-9b-it",
        });

        const answer = completion.choices[0]?.message?.content.trim();
        console.log(`[Explainer] LLM answered general question: ${answer}`);
        return answer;

    } catch (error) {
        console.error('[Explainer] Error using LLM for answering question:', error);
        return "Lo siento, no pude procesar tu pregunta en este momento.";
    }
}

module.exports = {
    explainArchitecture,
    generateParameterQuestion,
    answerGeneralQuestion
};

