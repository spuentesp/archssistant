const Groq = require('groq-sdk');

async function extractArchitecturesToCompare(message, apiKey, baseURL) {
    const groq = new Groq({ apiKey, baseURL });

    const systemPrompt = `
Eres un experto en extraer entidades de texto.
Tu tarea es extraer los nombres de las arquitecturas de software de la siguiente consulta del usuario.
Ejemplos de arquitecturas: "monolítica", "microservicios", "orientada a servicios", "SOA", "event-driven", "espacio-compartido", "pipes and filters", "layered", "cliente-servidor".
Devuelve un array JSON con los nombres de las arquitecturas encontradas. Por ejemplo: {"architectures": ["microservicios", "monolítica"]}.
Si no encuentras ninguna, devuelve un array vacío: {"architectures": []}.
Responde únicamente con el objeto JSON.
`;

    try {
        const completion = await groq.chat.completions.create({
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: `Extrae las arquitecturas de esta consulta: "${message}"` },
            ],
            model: "gemma2-9b-it",
            response_format: { type: 'json_object' },
        });

        const content = completion.choices[0]?.message?.content;
        if (!content) {
            return [];
        }
        
        const result = JSON.parse(content);
        return result.architectures || [];

    } catch (error) {
        console.error('[CompareExtractor] Error extracting architectures:', error);
        // Fallback to simple regex if LLM fails
        const patterns = ["monolítica", "microservicios", "orientada a servicios", "soa", "event-driven", "espacio-compartido", "pipes and filters", "layered", "cliente-servidor"];
        const found = [];
        const lowerMsg = message.toLowerCase();
        for (const p of patterns) {
            if (lowerMsg.includes(p)) {
                found.push(p);
            }
        }
        console.log(`[CompareExtractor] Fallback extracted: ${found.join(', ')}`);
        return found;
    }
}

module.exports = { extractArchitecturesToCompare };
