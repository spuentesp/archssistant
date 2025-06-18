const Groq = require('groq-sdk');

async function extractParams(message, apiKey) {
  const systemPrompt = `
You are a semantic extractor for software architecture requirements.
Extract the following parameters: scalability, complexity, experience, cost, maintainability, security.
Respond ONLY with a valid JSON object, with each key being one of the parameters above and each value being one of: "low", "medium", "high".
If you cannot infer a value for a parameter, set its value to "unknown".
The response MUST be a single line, valid JSON object, with all six keys present. Example:
{
  "scalability": "medium",
  "complexity": "high",
  "experience": "unknown",
  "cost": "low",
  "maintainability": "medium",
  "security": "high"
}
Do not include any explanation or extra text. Only output the JSON object. if there is now information about a parameter, omit it.
`;

  const client = new Groq({ apiKey: process.env.GROQ_API_KEY });
  const completion = await client.chat.completions.create({
    model: 'llama-3.1-8b-instant',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: message }
    ],
    response_format: { type: 'json_object' }
  });

  const content = completion.choices?.[0]?.message?.content.trim();
  console.log(`[extractor] LLM response: ${content}`);
  try {
    const parsed = JSON.parse(content);
    return parsed;
  } catch (e) {
    console.error('Error parsing LLM response:', e);
    throw new Error('Invalid JSON from LLM');
  }
}

module.exports = { extractParams };