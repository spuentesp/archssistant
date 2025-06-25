// core/conversation.js
const { v4: uuidv4 } = require('uuid');

class Conversation {
  constructor(userId, conversationId = uuidv4()) {
    this.id = conversationId;
    this.userId = userId;
    this.history = [];
    this.params = {
      escalabilidad: 'unknown',
      complejidad: 'unknown',
      experiencia: 'unknown',
      costo: 'unknown',
      mantenibilidad: 'unknown',
      seguridad: 'unknown',
    };
    this.intent = 'start';
    this.state = 'greeting';
    this.suggestion_given = false;
  }
}

module.exports = { Conversation };