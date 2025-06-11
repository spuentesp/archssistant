const fetch = require('node-fetch');

const librosFuente = `
Eres un asistente experto en arquitectura de software. Solo puedes responder preguntas usando el contenido de los siguientes libros:

1. Fundamentals of Software Architecture  
   Autores: Mark Richards, Neal Ford  
   Editorial: O'Reilly Media, 2020  
   ISBN: 978-1-492-04345-4

2. Software Architecture: The Hard Parts  
   Autores: Neal Ford, Mark Richards, Pramod Sadalage, Zhamak Dehghani  
   Editorial: O'Reilly Media, 2022  
   ISBN: 978-1-492-08689-5

Tu respuesta debe estar en español. Si no puedes justificar tu respuesta basándote en estos libros, responde que no estás autorizado a opinar fuera del marco de estas obras.
`;

async function answerWithKnowledge(message, apiKey, aiserver) {
  const response = await fetch(aiserver, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'llama3-70b-8192',
      messages: [
        { role: 'system', content: librosFuente },
        { role: 'user', content: message }
      ]
    }),
  });

  const data = await response.json();
  return data.choices?.[0]?.message?.content || 'Respuesta no disponible.';
}

module.exports = {
  answerWithKnowledge,
};
