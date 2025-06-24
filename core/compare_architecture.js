const Groq = require('groq-sdk');

async function compareArchitectures(arch1, arch2, apiKey, baseURL) {
  const prompt = `
Eres un asistente experto en arquitectura de software. Compara las arquitecturas "${arch1}" y "${arch2}" en base a los siguientes criterios:
- escalabilidad
- costo
- mantenibilidad
- complejidad

Utiliza exclusivamente los siguientes libros como base de conocimiento:
1. "Fundamentals of Software Architecture", Mark Richards y Neal Ford, O'Reilly Media, 2020. ISBN: 978-1-492-04345-4
2. "Software Architecture: The Hard Parts", Neal Ford et al., O'Reilly Media, 2022. ISBN: 978-1-492-08689-5

La respuesta debe ser objetiva, precisa y en español.
Devuelve un objeto JSON con la siguiente estructura:
{
  "comparison": {
    "escalabilidad": "...",
    "costo": "...",
    "mantenibilidad": "...",
    "complejidad": "..."
  },
  "summary": "..."
}
Si no tienes suficiente información para comparar, devuelve un JSON con un mensaje de error.
`;

  const client = new Groq({ apiKey, baseURL });
  const completion = await client.chat.completions.create({
    model: 'gemma2-9b-it',
    messages: [
      { role: 'system', content: prompt },
      { role: 'user', content: `Compara ${arch1} y ${arch2}.` }
    ],
    response_format: { type: 'json_object' }
  });

  try {
    const content = completion.choices?.[0]?.message?.content;
    if (!content) {
        return 'No se pudo obtener una comparación.';
    }
    const result = JSON.parse(content);
    
    let formattedReply = `### Comparación: ${arch1} vs ${arch2}\n\n`;
    if (result.comparison) {
        for (const key in result.comparison) {
            formattedReply += `**${key.charAt(0).toUpperCase() + key.slice(1)}:** ${result.comparison[key]}\n`;
        }
    }
    if (result.summary) {
        formattedReply += `\n**Resumen:** ${result.summary}`;
    }
    
    return formattedReply;

  } catch (e) {
    console.error("[CompareArchitecture] Error parsing LLM response", e);
    return completion.choices?.[0]?.message?.content || 'Sin información disponible.';
  }
}

module.exports = { compareArchitectures };
