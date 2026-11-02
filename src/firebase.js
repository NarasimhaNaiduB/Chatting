// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyBSHYEBRwfD82Gk5KvfSwDW0MseqhJkW-8",
  authDomain: "fir-5826c.firebaseapp.com",
  projectId: "fir-5826c",
  storageBucket: "fir-5826c.firebasestorage.app",
  messagingSenderId: "504248720683",
  appId: "1:504248720683:web:c9e8e656ff44149925b96e",
  measurementId: "G-MP7MNMFRQ8"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const analytics = getAnalytics(app);