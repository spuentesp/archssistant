const Groq = require('groq-sdk');

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

async function answerWithKnowledge(message) {
  const client = new Groq({ apiKey: process.env.GROQ_API_KEY });
  const completion = await client.chat.completions.create({
    model: 'llama-3.1-8b-instant',
    messages: [
      { role: 'system', content: librosFuente },
      { role: 'user', content: message }
    ]
  });
  console.log('[knowledge_responder] Respuesta de Groq:', completion);

  return completion.choices?.[0]?.message?.content || 'Respuesta no disponible.';
}

module.exports = {
  answerWithKnowledge,
};
