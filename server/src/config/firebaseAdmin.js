import admin from 'firebase-admin';
import dotenv from 'dotenv';

dotenv.config();

let serviceAccount;

try {
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  }
} catch (error) {
  console.error("Error parsing FIREBASE_SERVICE_ACCOUNT environment variable:", error);
}

if (serviceAccount) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
  console.log("Firebase Admin SDK initialized successfully.");
} else {
  console.warn("FIREBASE_SERVICE_ACCOUNT environment variable is missing or invalid. Firebase Admin SDK not initialized.");
}

export default admin;
