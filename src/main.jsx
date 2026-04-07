import React from 'react'
import ReactDOM from 'react-dom/client'
import { createClient } from '@supabase/supabase-js'
import App from './App.jsx'

// Supabase client — available globally for App.jsx
window._supabase = createClient(
  'https://zwrhxsmhtzibgvrlqmdk.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp3cmh4c21odHppYmd2cmxxbWRrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU1NDU4MTIsImV4cCI6MjA5MTEyMTgxMn0.Yb-fAw30YPMWyFRnEPe7A_G3DB8t8oB9V4qoco-OJlI'
)

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)