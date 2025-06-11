
async function extractParams(message, apiKey, aiserver) {
  const systemPrompt = `
Eres un extractor semántico de requerimientos de arquitectura de software.
Extrae los siguientes parámetros: escalabilidad, complejidad, experiencia, costo, mantenibilidad, seguridad.
Responde únicamente con un JSON válido con valores: bajo, medio, alto.
Si no puedes inferir un valor, pon "desconocido".
`;

  const body = {
    model: 'llama3-70b-8192',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: message }
    ]
  };

  const response = await fetch(aiserver, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content.trim();
  try {
    const parsed = JSON.parse(content);
    return parsed;
  } catch (e) {
    throw new Error('Respuesta LLM no fue JSON parseable', { cause: e });
  }
}

module.exports = { extractParams };
