import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyAqR_nEoRIN4ePbJFbvb-8hk71OffknYpA",
  authDomain: "sianagritech.firebaseapp.com",
  projectId: "sianagritech",
  storageBucket: "sianagritech.firebasestorage.app",
  messagingSenderId: "722345676614",
  appId: "1:722345676614:web:27571ac2499187b6c25f47",
  measurementId: "G-65QB5T1N7M"
};

export const app = initializeApp(firebaseConfig);
export const analytics = getAnalytics(app);
export const db = getFirestore(app);
export const auth = getAuth(app);