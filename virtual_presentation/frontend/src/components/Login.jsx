import { useState } from 'react'

export default function Login({ apiUrl, onLogin, onSwitchToSignup }) {
    const [username, setUsername] = useState('')
    const [password, setPassword] = useState('')
    const [error, setError] = useState('')

    const handleSubmit = async (e) => {
        e.preventDefault()
        setError('')

        try {
            const res = await fetch(`${apiUrl}/api/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            })

            const data = await res.json()
            if (res.ok) {
                onLogin(data.token, data.username)
            } else {
                setError(data.message || 'Login failed')
            }
        } catch (err) {
            setError('Connection error')
        }
    }

    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-black text-white p-4">
            <div className="w-full max-w-md p-8 bg-gray-900 rounded-2xl shadow-2xl border border-gray-800">
                <h2 className="text-3xl font-bold mb-6 text-center text-purple-400">AI Presenter Login</h2>

                {error && <div className="mb-4 p-3 bg-red-900/50 text-red-200 rounded border border-red-800 text-center">{error}</div>}

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm text-gray-400 mb-1">Username</label>
                        <input
                            type="text"
                            className="w-full p-3 bg-gray-800 rounded border border-gray-700 text-white focus:border-purple-500 focus:outline-none"
                            value={username}
                            onChange={e => setUsername(e.target.value)}
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-sm text-gray-400 mb-1">Password</label>
                        <input
                            type="password"
                            className="w-full p-3 bg-gray-800 rounded border border-gray-700 text-white focus:border-purple-500 focus:outline-none"
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            required
                        />
                    </div>

                    <button type="submit" className="w-full py-3 bg-purple-600 hover:bg-purple-500 rounded font-bold transition">
                        Sign In
                    </button>
                </form>

                <div className="mt-6 text-center text-gray-500">
                    Don't have an account?
                    <button onClick={onSwitchToSignup} className="ml-2 text-purple-400 hover:text-purple-300">Sign Up</button>
                </div>
            </div>
        </div>
    )
}
