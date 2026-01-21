import { useState } from 'react'
import axios from 'axios'
import { Upload, FileType, CheckCircle, AlertCircle } from 'lucide-react'

export default function Uploader({ apiUrl, token, onUploadComplete }) {
    const [files, setFiles] = useState([])
    const [uploading, setUploading] = useState(false)
    const [error, setError] = useState(null)

    const handleFileChange = (e) => {
        setFiles(Array.from(e.target.files))
        setError(null)
    }

    const handleUpload = async () => {
        if (files.length === 0) return

        const formData = new FormData()
        files.forEach(file => {
            formData.append('files', file)
        })

        setUploading(true)
        try {
            const headers = {
                'Content-Type': 'multipart/form-data'
            }
            if (token) {
                headers['Authorization'] = `Bearer ${token}`
            }

            await axios.post(`${apiUrl}/api/upload`, formData, {
                headers: headers
            })
            onUploadComplete()
        } catch (e) {
            setError("Failed to upload files. Check backend connection.")
            console.error(e)
        } finally {
            setUploading(false)
        }
    }

    return (
        <div className="backdrop-blur-xl bg-gray-900/60 p-8 rounded-2xl shadow-2xl w-full max-w-md border border-gray-700/50 ring-1 ring-white/10">
            <div className="flex flex-col items-center gap-6">
                <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center ring-1 ring-emerald-500/20">
                    <Upload className="w-8 h-8 text-emerald-400" />
                </div>

                <h2 className="text-2xl font-bold text-gray-100">Upload Presentation</h2>
                <p className="text-gray-400 text-center">
                    Select your slide images (JPG, PNG) or PowerPoint (PPT, PPTX).
                </p>

                <div className="w-full">
                    <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-600 border-dashed rounded-lg cursor-pointer hover:bg-gray-700/50 hover:border-emerald-500/50 transition-all group">
                        <div className="flex flex-col items-center justify-center pt-5 pb-6">
                            <FileType className="w-8 h-8 mb-2 text-gray-400 group-hover:text-emerald-400 transition-colors" />
                            <p className="mb-2 text-sm text-gray-400">
                                <span className="font-semibold group-hover:text-emerald-300 transition-colors">Click to upload</span> or drag and drop
                            </p>
                        </div>
                        <input
                            type="file"
                            className="hidden"
                            multiple
                            accept="image/*,.ppt,.pptx"
                            onChange={handleFileChange}
                        />
                    </label>
                </div>

                {files.length > 0 && (
                    <div className="w-full bg-emerald-950/30 border border-emerald-500/20 p-3 rounded-lg flex items-center gap-2">
                        <CheckCircle className="w-5 h-5 text-emerald-400" />
                        <span className="text-sm text-emerald-200">{files.length} files selected</span>
                    </div>
                )}

                {error && (
                    <div className="w-full bg-red-950/30 border border-red-500/20 p-3 rounded-lg flex items-center gap-2 text-red-300">
                        <AlertCircle className="w-5 h-5 text-red-400" />
                        <span className="text-sm">{error}</span>
                    </div>
                )}

                <button
                    onClick={handleUpload}
                    disabled={uploading || files.length === 0}
                    className={`w-full py-3 px-4 rounded-xl font-semibold transition-all ${uploading || files.length === 0
                        ? 'bg-gray-800 text-gray-500 cursor-not-allowed border border-gray-700'
                        : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-900/50 hover:shadow-emerald-900/70 border border-emerald-500'
                        }`}
                >
                    {uploading ? 'Uploading...' : 'Start Presentation'}
                </button>
            </div>
        </div>
    )
}
