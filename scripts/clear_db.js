const db = require('../db/database');

async function clearDatabase() {
  console.log('Attempting to clear the conversations table...');
  try {
    await db.clearConversations();
    console.log('Successfully cleared the conversations table.');
  } catch (error) {
    console.error('Failed to clear the database:', error);
  } finally {
    db.close();
  }
}

clearDatabase();
