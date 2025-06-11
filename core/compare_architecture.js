const fetch = require('node-fetch');

async function compareArchitectures(arch1, arch2, apiKey, aiserver) {
  const prompt = `
Eres un asistente experto en arquitectura de software. Compara las arquitecturas "${arch1}" y "${arch2}" en base a escalabilidad, costo, mantenibilidad, y complejidad.

Utiliza exclusivamente los siguientes libros como base:

1. "Fundamentals of Software Architecture", Mark Richards y Neal Ford, O'Reilly Media, 2020. ISBN: 978-1-492-04345-4  
2. "Software Architecture: The Hard Parts", Neal Ford et al., O'Reilly Media, 2022. ISBN: 978-1-492-08689-5

La respuesta debe ser objetiva, precisa y en español. Si no tienes suficiente información, dilo directamente.`;

  const response = await fetch(aiserver, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'llama3-70b-8192',
      messages: [
        { role: 'system', content: prompt },
        { role: 'user', content: `Compara ${arch1} y ${arch2}.` }
      ]
    })
  });

  const data = await response.json();
  return data.choices?.[0]?.message?.content || 'Sin información disponible.';
}

module.exports = { compareArchitectures };
