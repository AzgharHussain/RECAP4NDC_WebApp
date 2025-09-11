import React from 'react';
import ReactDOM from 'react-dom/client';  // Correct import for React 18

import { BrowserRouter } from 'react-router-dom';
import App from './App';

const rootElement = document.getElementById('root');
const root = ReactDOM.createRoot(rootElement);  // Use createRoot for React 18
root.render(
  <BrowserRouter>
    <App />
  </BrowserRouter>
);
