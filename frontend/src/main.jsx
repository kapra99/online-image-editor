import React from 'react';
import ReactDOM from 'react-dom/client';
// Bootstrap 5 styles first, then our theme overrides on top.
import 'bootstrap/dist/css/bootstrap.min.css';
import App from './App.jsx';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
