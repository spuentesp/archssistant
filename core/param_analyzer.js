function detectarParametros(texto) {
  texto = texto.toLowerCase();

  const reglas = [
    { keywords: ['muy escalable', 'alta escalabilidad', 'muchos usuarios', 'gran carga'], param: 'escalabilidad', value: 'alto' },
    { keywords: ['escalable', 'media escalabilidad'], param: 'escalabilidad', value: 'medio' },
    { keywords: ['poca escalabilidad', 'no escalable', 'baja escalabilidad'], param: 'escalabilidad', value: 'bajo' },

    { keywords: ['barato', 'bajo costo', 'sin presupuesto'], param: 'costo', value: 'bajo' },
    { keywords: ['costo medio', 'presupuesto medio'], param: 'costo', value: 'medio' },
    { keywords: ['caro', 'costoso', 'alto costo'], param: 'costo', value: 'alto' },

    { keywords: ['alta seguridad', 'muy seguro', 'protegido'], param: 'seguridad', value: 'alto' },
    { keywords: ['seguridad media', 'seguro a secas'], param: 'seguridad', value: 'medio' },
    { keywords: ['inseguro', 'sin seguridad', 'riesgoso'], param: 'seguridad', value: 'bajo' },

    { keywords: ['complejo', 'muchas reglas', 'dominio complicado'], param: 'complejidad', value: 'alto' },
    { keywords: ['moderado', 'algo complejo'], param: 'complejidad', value: 'medio' },
    { keywords: ['sencillo', 'pocas reglas', 'simple'], param: 'complejidad', value: 'bajo' },

    { keywords: ['equipo senior', 'experto', 'mucha experiencia'], param: 'experiencia', value: 'alto' },
    { keywords: ['experiencia media', 'algunos juniors'], param: 'experiencia', value: 'medio' },
    { keywords: ['equipo nuevo', 'poca experiencia', 'junior'], param: 'experiencia', value: 'bajo' },

    { keywords: ['fácil de mantener', 'alta mantenibilidad'], param: 'mantenibilidad', value: 'alto' },
    { keywords: ['mantenibilidad media'], param: 'mantenibilidad', value: 'medio' },
    { keywords: ['difícil de mantener', 'baja mantenibilidad', 'mucho mantenimiento'], param: 'mantenibilidad', value: 'bajo' }
  ];

  const resultado = {};
  for (const regla of reglas) {
    for (const palabra of regla.keywords) {
      if (texto.includes(palabra)) {
        resultado[regla.param] = regla.value;
        break;
      }
    }
  }
  return resultado;
}

module.exports = { detectarParametros };