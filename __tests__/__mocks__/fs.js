module.exports = {
  readFileSync: (filePath) => {
    if (filePath.includes('architecture_params.json')) {
      return JSON.stringify([
        {
          "name": "Microservices",
          "escalabilidad": "alta",
          "disponibilidad": "alta",
          "costo": "alto",
          "complejidad": "alta",
          "seguridad": "media",
          "latencia": "baja"
        }
      ]);
    }
    if (filePath.includes('param_rules.json')) {
      return JSON.stringify({
        "escalabilidad": ["escalable", "escalabilidad"],
        "disponibilidad": ["disponible", "disponibilidad"],
        "costo": ["costo", "precio"],
        "complejidad": ["complejo", "complejidad"],
        "seguridad": ["seguro", "seguridad"],
        "latencia": ["latencia", "rápido", "lento"]
      });
    }
    if (filePath.includes('intent_rules.json')) {
      return JSON.stringify({
        "pregunta_general": ["qué", "quién", "cómo", "dónde", "por qué"],
        "archivar": ["archiva", "archivar", "guardar"],
        "evaluar": ["evalúa", "evaluar", "recomienda"],
        "forzar_evaluacion": ["evalúa ya", "forzar evaluación"]
      });
    }
    return '';
  },
  // Add any other fs methods your code might use as no-ops or mocks
};
