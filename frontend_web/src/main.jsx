import React, { useEffect } from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import useAuthStore from './store/authStore.js'

function Root() {
  const init = useAuthStore((s) => s.init);

  useEffect(() => {
    init(); // Validate token against server on every app load
  }, [init]);

  return <App />;
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>,
)
