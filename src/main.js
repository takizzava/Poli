import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './styles/index.css'
import './styles/voice-panel.css'
import './styles/tasks-panel.css'
import './styles/create-panel.css'
import './styles/settings-panel.css'
import './styles/auth-panel.css'
import './styles/mic-button.css'
import './styles/mic-skins.css'
import './styles/theme.css'
import './styles/user-badge.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  React.createElement(React.StrictMode, null, React.createElement(App))
)
