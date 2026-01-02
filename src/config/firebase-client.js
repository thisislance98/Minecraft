import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';

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

export { auth, googleProvider, signInWithPopup, signOut, signInWithEmailAndPassword, createUserWithEmailAndPassword };
