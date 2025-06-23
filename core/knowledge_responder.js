const Groq = require('groq-sdk');

const librosFuente = `
Eres un asistente experto y conversacional en arquitectura de software. Tu conocimiento se basa exclusivamente en los siguientes libros:

1. "Fundamentals of Software Architecture" (Mark Richards, Neal Ford)
2. "Software Architecture: The Hard Parts" (Neal Ford, Mark Richards, et al.)

Responde siempre en español.

Tu objetivo es mantener un diálogo útil. Si la pregunta del usuario es ambigua, incompleta o poco clara, haz una pregunta de seguimiento para obtener los detalles que necesitas antes de dar una respuesta definitiva. No asumas ni inventes información.

Si la pregunta está fuera del alcance de los libros de referencia, indica amablemente que no puedes responder sobre temas no cubiertos por tus fuentes.
`;

async function answerWithKnowledge(message, history, apiKey) {
  const client = new Groq({ apiKey });

  const messages = [
      { role: 'system', content: librosFuente },
      ...history,
      { role: 'user', content: message }
  ];

  const completion = await client.chat.completions.create({
    model: 'llama3-8b-8192',
    messages: messages
  });
  console.log('[knowledge_responder] Respuesta de Groq:', completion);

  return completion.choices?.[0]?.message?.content || 'Respuesta no disponible.';
}

module.exports = {
  answerWithKnowledge,
};
