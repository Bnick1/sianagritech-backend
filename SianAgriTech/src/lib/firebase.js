import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyAqR_nEoRIN4ePbJFbvb-8hk71OffknYpA",
  authDomain: "sianagritech.firebaseapp.com",
  projectId: "sianagritech",
  storageBucket: "sianagritech.firebasestorage.app",
  messagingSenderId: "722345676614",
  appId: "1:722345676614:web:27571ac2499187b6c25f47",
  measurementId: "G-65QB5T1N7M"
};

const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const db = getFirestore(app);
const auth = getAuth(app);
const storage = getStorage(app);

export { app, analytics, db, auth, storage };