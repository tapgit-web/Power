import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
    apiKey: "AIzaSyBgc-qS0x3qeuQMV22GxmpJlNH5X5L3tMk",
    authDomain: "taprw-c7977.firebaseapp.com",
    databaseURL: "https://taprw-c7977-default-rtdb.firebaseio.com",
    projectId: "taprw-c7977",
    storageBucket: "taprw-c7977.firebasestorage.app",
    messagingSenderId: "1094519464495",
    appId: "1:1094519464495:web:644cc3c8c323cefa501cda",
    measurementId: "G-2GVMBDE7X7"
  };

 const app = initializeApp(firebaseConfig);
 const auth = getAuth(app)



 export default { app, auth };
 export  { app, auth };


