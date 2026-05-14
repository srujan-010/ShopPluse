import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithRedirect, signInWithPopup } from "firebase/auth";
import { getAnalytics } from "firebase/analytics";

const firebaseConfig = {
  apiKey: "AIzaSyAT13Bj0vFXK-tyv7DdJGNw4fN1xSPiK7M",
  authDomain: "shoppulse-ba1b1.firebaseapp.com",
  projectId: "shoppulse-ba1b1",
  storageBucket: "shoppulse-ba1b1.firebasestorage.app",
  messagingSenderId: "538539338496",
  appId: "1:538539338496:web:531ec360f40b61b0bae1e5",
  measurementId: "G-NF96CEDXYV"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Initialize Analytics conditionally to avoid SSR issues if any
let analytics;
if (typeof window !== 'undefined') {
  analytics = getAnalytics(app);
}

export const provider = new GoogleAuthProvider();

export const signInWithGoogle = async () => {
    try {
        // Force signInWithPopup as requested for production stability
        return await signInWithPopup(auth, provider);
    } catch (error) {
        console.error("Google Login Error:", error);
        throw error;
    }
};
