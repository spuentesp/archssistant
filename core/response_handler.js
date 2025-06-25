const { evaluateArchitecture } = require('./evaluator');
const { explainArchitecture } = require('./explainer');

/**
 * Generates a response with the architecture evaluation.
 * @param {object} conversation - The conversation object.
 * @param {string} apiKey - The API key for the AI service.
 * @param {string} baseURL - The base URL for the AI service.
 * @returns {Promise<string>} The evaluation response.
 */
async function evaluateAndRespond(conversation, apiKey, baseURL) {
    const evaluation = evaluateArchitecture(conversation.params);
    if (evaluation.length === 0) {
        return "No tengo suficiente información para hacer una recomendación. ¿Podrías darme más detalles sobre tu proyecto?";
    }
    
    const topArch = evaluation[0].name;
    const fallbackArch = evaluation[1]?.name;
    const explanation = await explainArchitecture(baseURL, apiKey, topArch, fallbackArch, conversation.params);
    
    const evaluationText = evaluation
        .map(r => `${r.name}: ${r.score.toFixed(2)}`)
        .join('\n');

    return `Basado en nuestra conversación, aquí tienes mi recomendación:\n\nEvaluación:\n${evaluationText}\n\nRecomendación:\n${explanation}`;
}

module.exports = {
    evaluateAndRespond,
};
