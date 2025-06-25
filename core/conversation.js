// core/conversation.js
const { v4: uuidv4 } = require('uuid');

class Conversation {
  constructor(userId, conversationId = uuidv4()) {
    this.id = conversationId;
    this.userId = userId;
    this.history = [];
    this.params = {
      scalability: 'unknown',
      complexity: 'unknown',
      experience: 'unknown',
      cost: 'unknown',
      maintainability: 'unknown',
      security: 'unknown',
    };
    this.intent = 'start';
    this.state = 'greeting';
  }
}

module.exports = { Conversation };