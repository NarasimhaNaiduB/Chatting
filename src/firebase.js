// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getDatabase } from "firebase/database";

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyBSHYEBRwfD82Gk5KvfSwDW0MseqhJkW-8",
  authDomain: "fir-5826c.firebaseapp.com",
  projectId: "fir-5826c",
  databaseURL: "https://fir-5826c-default-rtdb.firebaseio.com",
  storageBucket: "fir-5826c.firebasestorage.app",
  messagingSenderId: "504248720683",
  appId: "1:504248720683:web:c9e8e656ff44149925b96e",
  measurementId: "G-MP7MNMFRQ8"
};

// Initialize Firebase
export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const realtimeDatabase = getDatabase(app);