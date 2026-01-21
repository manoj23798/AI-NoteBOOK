import { useState, useEffect } from 'react'
import axios from 'axios'
import Presenter from './components/Presenter'
import Uploader from './components/Uploader'

function App() {
  const [view, setView] = useState('loading')
  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

  // Initial check only - no auth needed
  useEffect(() => {
    checkState()
  }, [])

  const checkState = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/current-state`)
      if (res.data.slides && res.data.slides.length > 0) {
        setView('presenter')
      } else {
        setView('uploader')
      }
    } catch (e) {
      console.error("Backend error", e)
      setView('uploader')
    }
  }

  return (
    <div className="relative w-full h-screen bg-gray-950 text-emerald-50 flex flex-col items-center justify-center font-sans overflow-hidden">

      {/* Ambient Background */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-emerald-900/20 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-teal-900/20 rounded-full blur-[120px]" />
      </div>

      {view !== 'presenter' && (
        <h1 className="absolute top-6 left-6 text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 to-teal-400 z-50 tracking-tight drop-shadow-sm">
          AI Presenter
        </h1>
      )}

      {view === 'loading' && (
        <div className="z-10 animate-pulse text-xl text-emerald-400 font-medium tracking-wide">Loading AI Presenter...</div>
      )}

      <div className="z-10 w-full h-full flex flex-col justify-center items-center">
        {view === 'uploader' && (
          <Uploader apiUrl={API_URL} token={null} onUploadComplete={() => setView('presenter')} />
        )}

        {view === 'presenter' && (
          <Presenter apiUrl={API_URL} token={null} onBack={() => setView('uploader')} />
        )}
      </div>
    </div>
  )
}

export default App
