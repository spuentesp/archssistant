const express = require('express');
const bodyParser = require('body-parser');
const fetch = require('node-fetch');
//const dotenv = require('dotenv');
const fs = require('fs');
const cors = require('cors');
//dotenv.config();
require('dotenv').config();
const app = express();

app.use(cors());
app.use(express.static('public'));
app.use(bodyParser.json());

const storageFile = 'storage.json';
const SERVER = process.env.SERVER;
const PORT = process.env.PORT;
console.log("servidor:"+SERVER);

app.post('/archssistant', async (req, res) => {
  
  const { message } = req.body;
  const apiKey = process.env.AI_KEY_MAIN;
  const aiserver = process.env.AI_URL_MAIN;
  console.log("Llega /archssistant");
  console.log("apiKey"+apiKey);

  if (!apiKey) {
    return res.status(500).json({ error: 'Falta la clave de API de Groq' });
  }

  const response = await fetch(aiserver, {
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
  const reply = data.choices?.[0]?.message?.content || 'Error en respuesta servicio IA';

  const history = fs.existsSync(storageFile)
    ? JSON.parse(fs.readFileSync(storageFile))
    : [];
  history.push({ question: message, answer: reply });
  fs.writeFileSync(storageFile, JSON.stringify(history, null, 2));

  res.json({ reply });
});

app.use((req, res) => {
  res.status(404).json({ error: 'Ruta no programada' });
});

app.listen(PORT, () => {
  console.log(`Servidor iniciado en http://${SERVER}:${PORT}`);
});
