// core/evaluator.js
const fs = require('fs');
const path = require('path');

const table = JSON.parse(fs.readFileSync(path.join(__dirname,  'decision_engine.json'), 'utf-8'));

function mapToScore(value) {
  const val = value?.toLowerCase?.() || '';
  if (val === 'alto' || val === 'alta') return 3;
  if (val === 'medio' || val === 'media') return 2;
  if (val === 'bajo' || val === 'baja') return 1;
  return 0;
}

function evaluateArchitecture(paramMap) {
  console.log('[evaluator] Evaluando arquitecturas con parámetros:', paramMap);

  const weights = Object.keys(paramMap)
    .filter(k => paramMap[k] !== 'desconocido')
    .reduce((acc, k) => {
      acc[k] = 1;
      return acc;
    }, {});

  const totalWeight = Object.keys(weights).length;
  if (totalWeight === 0) throw new Error('No se detectaron parámetros válidos para evaluar.');

  // Normalizar pesos
  for (const key in weights) weights[key] = 1 / totalWeight;

  const result = table.map(arch => {
    let score = 0;
    for (const param in weights) {
      score += weights[param] * (arch[param] || 0);
    }
    return { name: arch.name, score };
  }).sort((a, b) => b.score - a.score);

  console.log('[evaluator] Resultado de evaluación:', result);
  return result;
}

module.exports = { evaluateArchitecture };
