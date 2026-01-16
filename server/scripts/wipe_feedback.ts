import { db } from '../config';

async function wipeFeedback() {
    if (!db) {
        console.error('Database not initialized');
        process.exit(1);
    }

    console.log('Fetching feedback items...');
    const snapshot = await db.collection('feedback').get();

    if (snapshot.empty) {
        console.log('No feedback items found.');
        return;
    }

    console.log(`Found ${snapshot.size} items. Deleting...`);

    // Firestore batches are limited to 500 ops. If we have more, we need multiple batches.
    // For now, assuming < 500 based on previous curl (limit 50).
    // To be safe, let's just delete one by one or use chunks if needed, but simple batch is fine for small data.

    const batch = db.batch();
    snapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
    });

    await batch.commit();
    console.log('Successfully deleted all feedback items.');
}

wipeFeedback().then(() => {
    process.exit(0);
}).catch(err => {
    console.error(err);
    process.exit(1);
});
