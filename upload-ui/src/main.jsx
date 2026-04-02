import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import App from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
      <Toaster
        position="bottom-right"
        toastOptions={{
          style: {
            background: '#161e2a',
            color: '#e8f0f5',
            border: '1px solid #1f2d3d',
            fontFamily: '"IBM Plex Mono", monospace',
            fontSize: '12px',
            borderRadius: '12px',
            padding: '12px 16px',
          },
          success: { iconTheme: { primary: '#7fffb2', secondary: '#161e2a' } },
          error:   { iconTheme: { primary: '#ff4757', secondary: '#161e2a' } },
        }}
      />
    </BrowserRouter>
  </React.StrictMode>
)
