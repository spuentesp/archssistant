const fs = require('fs');
const path = require('path');

const table = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../decision_engine.json'), 'utf-8')
);

/**
 * Mapea un valor textual a un valor numérico.
 * Ej: "alta" → 3, "media" → 2, "baja" → 1
 */
function mapInputToScore(value) {
  if (typeof value === 'string') {
    const val = value.toLowerCase();
    if (['alta', 'alto', 'high'].includes(val)) return 3;
    if (['media', 'medio', 'medium'].includes(val)) return 2;
    if (['baja', 'bajo', 'low'].includes(val)) return 1;
  }
  const num = parseInt(value);
  return isNaN(num) ? 0 : num;
}

/**
 * Evalúa arquitecturas con base en parámetros de entrada y sus pesos.
 * @param {Object} inputValues - Ej: { escalabilidad: 3, costo: 1, mantenibilidad: 2 }
 * @param {Object} weights - Ej: { escalabilidad: 0.2, costo: 0.3, mantenibilidad: 0.5 }
 * @returns {Array} - Lista ordenada de arquitecturas y su puntaje.
 */
function evaluateArchitecture(inputValues, weights) {
  return table.map(arch => {
    let score = 0;
    for (const param in inputValues) {
      const weight = weights[param] || 0;
      const archScore = arch[param] || 0;
      score += weight * archScore;
    }
    return { name: arch.name, score };
  }).sort((a, b) => b.score - a.score);
}

module.exports = {
  evaluateArchitecture,
  mapInputToScore
};
