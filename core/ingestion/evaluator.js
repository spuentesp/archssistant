// core/evaluator.js
const fs = require('fs');
const path = require('path');

// Load the architecture knowledge base.
const architectureData = JSON.parse(fs.readFileSync(path.join(__dirname, 'architecture_params.json'), 'utf-8'));

// Define el mapeo de los valores cualitativos (texto) a puntuaciones numéricas.
// Esto nos permite convertir las descripciones del usuario en un formato matemático.
const valueMapping = {
    bajo: 1,
    medio: 2,
    alto: 3,
};

/**
 * Evalúa y clasifica las arquitecturas de software basándose en los parámetros proporcionados por el usuario.
 * Utiliza un enfoque de distancia vectorial para encontrar la arquitectura más cercana a los requisitos del usuario.
 * @param {Object} userParams - Un objeto con los parámetros extraídos de la consulta del usuario (ej: { escalabilidad: 'alto', costo: 'bajo' }).
 * @returns {Array} Una lista de objetos de arquitectura, ordenados por su puntuación de similitud (de mayor a menor).
 */
function evaluateArchitecture(userParams) {
    console.log('[Evaluator] Iniciando evaluación de arquitecturas con los parámetros:', userParams);

    // --- PASO 1: Vectorización de la consulta del usuario ---
    // Convierte los parámetros del usuario de texto ('alto', 'medio', 'bajo') a un vector numérico.
    const knownUserParams = Object.entries(userParams)
        // Filtra cualquier parámetro que no fue identificado ('desconocido').
        .filter(([, value]) => value && value !== 'desconocido')
        // Mapea el valor de texto a su equivalente numérico usando `valueMapping`.
        .map(([param, value]) => [param, valueMapping[value.toLowerCase()]])
        // Se asegura de que solo se incluyan parámetros con un valor numérico válido.
        .filter(([, numericValue]) => numericValue !== undefined);

    // Si no hay parámetros conocidos después del filtrado, no se puede evaluar.
    if (knownUserParams.length === 0) {
        console.log('[Evaluator] No hay parámetros conocidos para realizar la evaluación.');
        return [];
    }

    // Crea el "vector del usuario" final a partir de los parámetros conocidos.
    const userVector = Object.fromEntries(knownUserParams);

    // --- PASO 2: Cálculo de similitud (basado en distancia) ---
    // Se calcula una puntuación de similitud basada en qué tan "cercanos" están los parámetros de cada arquitectura
    // a los que el usuario especificó. Una distancia menor resulta en una puntuación mayor.
    const results = architectureData.map(arch => {
        let totalDistance = 0;
        let paramsConsidered = 0;

        // Itera sobre los parámetros que el usuario especificó.
        for (const param in userVector) {
            if (arch[param] !== undefined) {
                // Calcula la distancia normalizada (0 a 1) entre el valor deseado y el valor de la arquitectura.
                // El rango de valores es de 1 a 3, por lo que la distancia máxima es 2.
                const distance = Math.abs(userVector[param] - arch[param]) / 2;
                totalDistance += distance;
                paramsConsidered++;
            }
        }

        // La puntuación es el inverso de la distancia promedio.
        // Si la distancia promedio es 0 (coincidencia perfecta), la puntuación es 1.
        // Si la distancia promedio es 1 (máxima diferencia), la puntuación es 0.
        const score = paramsConsidered > 0 ? 1 - (totalDistance / paramsConsidered) : 0;

        return { name: arch.name, score };
    // --- PASO 3: Ranking ---
    // Ordena las arquitecturas de la más recomendada (mayor puntuación) a la menos recomendada.
    }).sort((a, b) => b.score - a.score);

    console.log('[Evaluator] Resultado de la evaluación:', results);
    return results;
}

module.exports = { evaluateArchitecture };
