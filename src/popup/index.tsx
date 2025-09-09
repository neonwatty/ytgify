import React from 'react';
import ReactDOM from 'react-dom/client';
import './styles.css';
import './styles-modern.css';
import PopupApp from './popup-modern';

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);
root.render(<React.StrictMode><PopupApp /></React.StrictMode>);