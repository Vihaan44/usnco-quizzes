import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBjdxwgaAOGGZw5sddwJ6fyQtJHSBMrTLQ",
  authDomain: "usnco-quiz.firebaseapp.com",
  projectId: "usnco-quiz",
  storageBucket: "usnco-quiz.firebasestorage.app",
  messagingSenderId: "665667836931",
  appId: "1:665667836931:web:aaa5031453c49f84a74236"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const db = getFirestore(app);