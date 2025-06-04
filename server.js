const express = require('express');
const bodyParser = require('body-parser');
const fetch = require('node-fetch');
const dotenv = require('dotenv');
const fs = require('fs');
const cors = require('cors');
dotenv.config();

const app = express();
const PORT = 5000;
app.use(cors());
app.use(express.static('public'));
app.use(bodyParser.json());

const storageFile = 'storage.json';
const SERVER = process.env.SERVER;ç
console.log(SERVER);

app.post('/archssitant', async (req, res) => {
  console.log("Llega /archssistant");
  const { message } = req.body;
  const apiKey = process.env.GROQ_KEY;
  const aiserver = process.env.AISERVER;

  if (!apiKey) {
    return res.status(500).json({ error: 'Falta la clave de API de Groq' });
  }

  const response = await fetch(AISERVER, {
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

app.listen(PORT, () => {
  console.log(`Servidor iniciado en http://${SERVER}:${PORT}`);
});
