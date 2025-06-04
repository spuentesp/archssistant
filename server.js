const express = require('express');
const bodyParser = require('body-parser');
const fetch = require('node-fetch');
const dotenv = require('dotenv');
const fs = require('fs');

dotenv.config();
const app = express();
const PORT = 3000;

app.use(express.static('public'));
app.use(bodyParser.json());

const storageFile = 'storage.json';

app.post('/api/ask', async (req, res) => {
  const { message } = req.body;
  const apiKey = process.env.GROQ_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: 'Falta la clave de API de Groq' });
  }

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'llama3-70b-8192',
      messages: [{ role: 'user', content: message }],
    }),
  });

  const data = await response.json();
  const reply = data.choices?.[0]?.message?.content || 'Error en la respuesta de Groq';

  const history = fs.existsSync(storageFile)
    ? JSON.parse(fs.readFileSync(storageFile))
    : [];
  history.push({ question: message, answer: reply });
  fs.writeFileSync(storageFile, JSON.stringify(history, null, 2));

  res.json({ reply });
});

app.listen(PORT, () => {
  console.log(`Servidor iniciado en http://localhost:${PORT}`);
});
