import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getAnalytics } from "firebase/analytics";

const firebaseConfig = {
  apiKey: "AIzaSyA9LCBbShwRA7OLbb7rlDL6djrUc5Oytl0",
  authDomain: "palmmeritglobal.firebaseapp.com",
  projectId: "palmmeritglobal",
  storageBucket: "palmmeritglobal.firebasestorage.app",
  messagingSenderId: "267787668584",
  appId: "1:267787668584:web:95bbb3e7ef62f75f1affdd",
  measurementId: "G-SF95G9QBXN"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const analytics = typeof window !== "undefined" ? getAnalytics(app) : null;
export default app;
