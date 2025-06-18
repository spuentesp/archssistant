function classifyIntent(message) {
  const lowerMsg = message.toLowerCase();
  console.log(`Classifying intent for message: ${lowerMsg}`);


  return 'informar';
}

module.exports = { classifyIntent };