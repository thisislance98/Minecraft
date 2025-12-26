import { initFirebase } from '../src/config/firebase.js';
import { stripe } from '../src/config/stripe.js';
import { CIVITAI_API_KEY } from '../src/config/civitai.js';

async function test() {
    console.log('Testing integrations...');

    // Test Firebase
    try {
        const firebase = await initFirebase();
        if (firebase) {
            console.log('✅ Firebase initialized');
        } else {
            console.error('❌ Firebase failed to initialize');
            process.exitCode = 1;
        }
    } catch (e) {
        console.error('❌ Firebase initialization threw error:', e);
        process.exitCode = 1;
    }

    // Test Stripe
    if (stripe) {
        console.log('✅ Stripe client created');
    } else {
        console.error('❌ Stripe client missing');
        process.exitCode = 1;
    }

    // Test CivitAI
    if (CIVITAI_API_KEY) {
        console.log('✅ CivitAI API Key found');
    } else {
        console.error('❌ CivitAI API Key missing');
        process.exitCode = 1;
    }
}

test().catch(error => {
    console.error('Test script failed:', error);
    process.exit(1);
});
