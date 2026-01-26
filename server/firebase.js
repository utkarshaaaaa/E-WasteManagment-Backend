const { initializeApp } = require("firebase/app");
const { getStorage } = require("firebase/storage");


const app = initializeApp({
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: "ai-video-generator-3fc26.firebaseapp.com",
  projectId: "ai-video-generator-3fc26",
  storageBucket: "ai-video-generator-3fc26.firebasestorage.app",
  messagingSenderId: "408316941673",
  appId: "1:408316941673:web:b4d0fdb67d68c1bbab19f8",
  measurementId: "G-LQNC38JM8M",
});

const storage = getStorage(app);

module.exports = { app, storage }; ;
