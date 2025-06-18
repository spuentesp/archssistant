function classifyIntent(message) {
  const lowerMsg = message.toLowerCase();

  if (/(diferencia|similitud|cuál.*mejor|versus|vs|compar(a|ación))/i.test(lowerMsg)) {
    return 'comparar';
  }

  if (/(escalabilidad|mantenibilidad|costo|experiencia|seguridad|complejidad)/i.test(lowerMsg) &&
      /(alto|media|bajo|alta|medio|baja)/i.test(lowerMsg)) {
    return 'evaluar';
  }

  return 'informar';
}

module.exports = { classifyIntent };