import React from 'react';
import ReactDOM from 'react-dom/client';
import './styles.css';
import PopupApp from './popup';

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);
root.render(<React.StrictMode><PopupApp /></React.StrictMode>);