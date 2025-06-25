const readline = require('readline');
const Conversation = require('./core/conversation');
const { getNextState } = require('./core/state_machine');
const { ParamExtractor } = require('./core/param_extractor');
const { evaluateArchitecture } = require('./core/evaluator');
const db = require('./core/database');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const extractor = new ParamExtractor();

async function processConversation(conversation, userInput) {
  try {
    conversation.addMessage('user', userInput);

    if (conversation.intent === 'start' && userInput.toLowerCase().includes('new conversation')) {
        const newConv = await Conversation.startNew('test');
        console.log("Starting a new conversation.");
        return newConv;
    }

    const extractedParams = await extractor.extract(conversation.history);
    conversation.updateParams(extractedParams);

    const { nextAction, message } = getNextState(conversation);
    console.log(`\n🤖 Assistant: ${message}`);

    if (nextAction === 'evaluate') {
      const recommendations = evaluateArchitecture(conversation.params);
      recommendations.forEach((rec, index) => {
        console.log(`\n${index + 1}. ${rec.name} (Score: ${rec.score.toFixed(2)})`);
        console.log(`   ${rec.description}`);
      });
      return null; // End conversation
    }

    await db.saveConversation(conversation);
    return conversation;
  } catch (error) {
    console.error("An error occurred:", error);
    return null;
  }
}

async function main() {
  let conversation = await Conversation.getActive('test') || await Conversation.startNew('test');
  
  console.log("🤖 Assistant: Hello! I'm your architecture assistant. You can start by describing your project or type 'new conversation' to begin fresh.");

  rl.on('line', async (input) => {
    if (input.toLowerCase() === 'exit') {
      rl.close();
      return;
    }

    if (!conversation) {
        console.log("Starting a new conversation.");
        conversation = await Conversation.startNew('test');
    }

    conversation = await processConversation(conversation, input);

    if (!conversation) {
      rl.close();
    } else {
      process.stdout.write('> ');
    }
  });

  process.stdout.write('> ');
}

main();
