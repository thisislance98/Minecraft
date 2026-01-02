/**
 * Script to clear all messages from community channels
 * Run with: npx ts-node scripts/clearMessages.ts
 */
import '../config';  // Initialize Firebase
import * as admin from 'firebase-admin';

async function clearAllMessages() {
    const db = admin.firestore();

    console.log('Fetching all messages...');

    const messagesRef = db.collection('messages');
    const snapshot = await messagesRef.get();

    if (snapshot.empty) {
        console.log('No messages to delete.');
        return;
    }

    console.log(`Found ${snapshot.size} messages. Deleting...`);

    // Delete in batches of 500 (Firestore limit)
    const batchSize = 500;
    const batches: admin.firestore.WriteBatch[] = [];
    let currentBatch = db.batch();
    let operationCount = 0;

    for (const doc of snapshot.docs) {
        currentBatch.delete(doc.ref);
        operationCount++;

        if (operationCount >= batchSize) {
            batches.push(currentBatch);
            currentBatch = db.batch();
            operationCount = 0;
        }
    }

    // Don't forget the last batch
    if (operationCount > 0) {
        batches.push(currentBatch);
    }

    // Execute all batches
    console.log(`Executing ${batches.length} batch(es)...`);
    for (let i = 0; i < batches.length; i++) {
        await batches[i].commit();
        console.log(`Batch ${i + 1}/${batches.length} committed.`);
    }

    console.log('All messages deleted successfully!');
}

clearAllMessages()
    .then(() => process.exit(0))
    .catch(err => {
        console.error('Error clearing messages:', err);
        process.exit(1);
    });
