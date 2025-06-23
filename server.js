const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
require('dotenv').config();
const { initDB } = require('./db/database');

const app = express();
const archssistantRoute = require('./routes/archassistant');

const SERVER = process.env.SERVER || 'localhost';
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.static('public'));
app.use(bodyParser.json());

app.use('/archssistant', archssistantRoute);

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/index.html'));
});

app.use((req, res) => {
  res.status(404).json({ error: 'Ruta no programada' });
});

async function startServer() {
  try {
    await initDB();
    app.listen(PORT, () => {
      console.log(`Servidor iniciado en http://${SERVER}:${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();