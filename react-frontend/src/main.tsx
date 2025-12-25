import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
// Import Bootstrap and ColorAdmin styles
import 'bootstrap/dist/js/bootstrap.bundle.min.js';
import './index.css';;

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
