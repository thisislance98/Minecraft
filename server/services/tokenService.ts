import { db } from '../config';
import { FieldValue } from 'firebase-admin/firestore';

export async function addTokens(userId: string, amount: number, source: string, description: string) {
    if (!userId) throw new Error('UserId is required');
    if (!db) throw new Error('Firestore is not initialized');

    const userRef = db.collection('users').doc(userId);

    // Run transaction to ensure atomicity
    await db.runTransaction(async (transaction) => {
        const userDoc = await transaction.get(userRef);

        if (!userDoc.exists) {
            // Create user if not exists
            transaction.set(userRef, {
                tokens: amount,
                createdAt: FieldValue.serverTimestamp(),
                updatedAt: FieldValue.serverTimestamp()
            });
        } else {
            // Update existing user
            const currentTokens = userDoc.data()?.tokens || 0;
            transaction.update(userRef, {
                tokens: currentTokens + amount,
                updatedAt: FieldValue.serverTimestamp()
            });
        }

        // Add transaction record
        const transactionRef = db!.collection('transactions').doc();
        transaction.set(transactionRef, {
            userId,
            amount,
            source,
            description,
            createdAt: FieldValue.serverTimestamp()
        });
    });
}

export async function getUserTokens(userId: string): Promise<number> {
    if (!db) return 0;
    const userDoc = await db.collection('users').doc(userId).get();
    return userDoc.data()?.tokens || 0;
}
