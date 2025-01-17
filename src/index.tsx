import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';
import { initializeApp } from 'firebase/app';
// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAaqom27qucRMOXJJ03IAGA8LiPYiCxwOU",
  authDomain: "empathyai-71e90.firebaseapp.com",
  databaseURL: "https://empathyai-71e90-default-rtdb.firebaseio.com",
  projectId: "empathyai-71e90",
  storageBucket: "empathyai-71e90.appspot.com",
  messagingSenderId: "523011715771",
  appId: "1:523011715771:web:c1f434592b57a15b3a6f9e",
  measurementId: "G-T7S210PVP5"
};
// Initialize Firebase
initializeApp(firebaseConfig);

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();

