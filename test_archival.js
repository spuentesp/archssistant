const { classifyIntent } = require('./core/intent_classifier');

async function testArchivalIntent() {
    console.log('Testing archival intent classification...\n');
    
    const testMessages = [
        'archivar conversación',
        'nueva conversación', 
        'empezar de nuevo',
        'reset',
        'terminar',
        'guardar chat',
        'reiniciar'
    ];

    // Simular que el LLM no está disponible para probar el fallback
    for (const message of testMessages) {
        try {
            const intent = await classifyIntent(message, 'fake_key', 'fake_url');
            console.log(`Message: "${message}" -> Intent: ${intent}`);
        } catch (error) {
            console.error(`Error classifying "${message}":`, error.message);
        }
    }
    
    console.log('\nArchival intent test completed!');
}

testArchivalIntent();
