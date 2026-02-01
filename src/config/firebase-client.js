import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult, signOut, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';

// Config from civit/web-app/services/auth.ts
const firebaseConfig = {
    apiKey: "AIzaSyC4WR8qF_g9OHKykGMQjPgez6hxS-OK0jE",
    authDomain: "trackit-8b903.firebaseapp.com",
    projectId: "trackit-8b903",
    storageBucket: "trackit-8b903.appspot.com",
    messagingSenderId: "600817915451",
    appId: "1:600817915451:web:783bda2f77518028a16e1e"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

// Handle redirect result immediately on module load (before game initializes)
// This is critical because getRedirectResult must be called early
getRedirectResult(auth)
    .then((result) => {
        if (result) {
            console.log('[Firebase] Google redirect sign-in successful:', result.user.email);
        } else {
            console.log('[Firebase] No pending redirect result');
        }
    })
    .catch((error) => {
        console.error('[Firebase] Redirect result error:', error.code, error.message);
    });

// Initialize Analytics
import { getAnalytics, logEvent } from 'firebase/analytics';
let analytics = null;
try {
    analytics = getAnalytics(app);
} catch (e) {
    console.warn("Firebase Analytics failed to initialize (possibly missing measurementId):", e);
}

export { auth, analytics, logEvent, googleProvider, signInWithPopup, signInWithRedirect, getRedirectResult, signOut, signInWithEmailAndPassword, createUserWithEmailAndPassword };
