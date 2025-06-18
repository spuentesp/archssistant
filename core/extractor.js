async function extractParams(message, apiKey, aiserver) {
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
Do not include any explanation or extra text. Only output the JSON object.
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
  console.log('LLM response:', data);
  const content = data.choices?.[0]?.message?.content.trim();
  try {
    const parsed = JSON.parse(content);
    console.log('Parsed JSON:', parsed);
    return parsed;
  } catch (e) {
    console.error('Error parsing JSON:', e);
    throw new Error('LLM response was not JSON parseable', { cause: e });
    
  }
}

module.exports = { extractParams };