const fs = require('fs');
const path = require('path');

const reglasPath = path.join(__dirname, 'param_rules.json');
const reglas = JSON.parse(fs.readFileSync(reglasPath, 'utf-8'));

function detectarParametros(texto) {
  texto = texto.toLowerCase();
  const resultado = {};

  for (const [param, niveles] of Object.entries(reglas)) {
    for (const [valor, palabras] of Object.entries(niveles)) {
      for (const palabra of palabras) {
        if (texto.includes(palabra)) {
          resultado[param] = valor;
          break;
        }
      }
      if (resultado[param]) break;
    }
  }

  return resultado;
}

module.exports = { detectarParametros };
