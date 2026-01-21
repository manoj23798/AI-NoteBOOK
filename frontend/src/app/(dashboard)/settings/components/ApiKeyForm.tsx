
'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Key, Eye, EyeOff } from 'lucide-react'
import { toast } from 'sonner'

export function ApiKeyForm() {
    const [apiKey, setApiKey] = useState('')
    const [showKey, setShowKey] = useState(false)

    useEffect(() => {
        const storedKey = localStorage.getItem('openai_api_key')
        if (storedKey) {
            setApiKey(storedKey)
        }
    }, [])

    const handleSave = () => {
        localStorage.setItem('openai_api_key', apiKey)
        toast.success('API Key saved successfully')
    }

    const handleClear = () => {
        localStorage.removeItem('openai_api_key')
        setApiKey('')
        toast.info('API Key removed')
    }

    return (
        <Card className="border-emerald-500/50 shadow-emerald-900/10 shadow-lg">
            <CardHeader>
                <div className="flex items-center gap-2">
                    <Key className="h-5 w-5 text-emerald-500" />
                    <CardTitle>SaaS Mode Configuration</CardTitle>
                </div>
                <CardDescription>
                    Bring Your Own Key (BYOK). Enter your OpenAI API Key to use the application functionality.
                    Your key is stored locally in your browser and sent securely to the server only when needed.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="space-y-2">
                    <Label htmlFor="api_key">OpenAI API Key</Label>
                    <div className="relative">
                        <Input
                            id="api_key"
                            type={showKey ? 'text' : 'password'}
                            placeholder="sk-proj-..."
                            value={apiKey}
                            onChange={(e) => setApiKey(e.target.value)}
                            className="pr-10"
                        />
                        <button
                            type="button"
                            onClick={() => setShowKey(!showKey)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-200"
                        >
                            {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                        We recommend using a restricted key with usage limits.
                    </p>
                </div>

                <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={handleClear} disabled={!apiKey}>
                        Clear
                    </Button>
                    <Button onClick={handleSave} className="bg-emerald-600 hover:bg-emerald-500 text-white">
                        Save API Key
                    </Button>
                </div>
            </CardContent>
        </Card>
    )
}
