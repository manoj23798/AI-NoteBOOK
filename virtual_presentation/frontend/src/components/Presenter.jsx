import { useRef, useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, PenTool, Eraser, Hand, MousePointer2, ArrowLeftCircle, ArrowRightCircle, Trash2 } from 'lucide-react'
import { Hands } from '@mediapipe/hands'
import { Camera } from '@mediapipe/camera_utils'

export default function Presenter({ apiUrl, token, onBack }) {
    const videoRef = useRef(null)
    const canvasRef = useRef(null)
    const [status, setStatus] = useState("AI Initializing...")

    // API State
    const [slides, setSlides] = useState([])
    const [slideIndex, setSlideIndex] = useState(0)
    const [slideUrl, setSlideUrl] = useState(null)
    const [gesture, setGesture] = useState(null)

    // UI State
    const [isPenMode, setIsPenMode] = useState(true)

    // Game Loop State
    const gameState = useRef({
        annotations: [[]],
        currentStroke: [],
        isDrawing: false,
        lastGestureTime: 0,
        slideIndex: 0,
        cursorX: 0.5,
        cursorY: 0.5,
        pointerVisible: false,
        mode: 'pen',
        wasPinching: false // For hysteresis
    })

    // Sync State
    useEffect(() => {
        gameState.current.slideIndex = slideIndex
        if (slides.length > 0) setSlideUrl(`${apiUrl}/slides/${slides[slideIndex]}`)
    }, [slideIndex, slides, apiUrl])

    useEffect(() => {
        gameState.current.mode = isPenMode ? 'pen' : 'hand'
        gameState.current.wasPinching = false // Reset
    }, [isPenMode])

    // Load Slides (Secured)
    useEffect(() => {
        fetch(`${apiUrl}/api/current-state`, {
            headers: { Authorization: `Bearer ${token}` }
        })
            .then(res => res.json())
            .then(data => {
                if (data.slides?.length > 0) setSlides(data.slides)
                else setStatus("Upload slides first")
            })
            .catch(err => setStatus("Connection failed"))
    }, [apiUrl, token])

    // AI
    useEffect(() => {
        const hands = new Hands({
            locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
        })
        hands.setOptions({
            maxNumHands: 1,
            modelComplexity: 0,
            minDetectionConfidence: 0.7,
            minTrackingConfidence: 0.7
        })

        hands.onResults(onResults)

        if (videoRef.current) {
            const camera = new Camera(videoRef.current, {
                onFrame: async () => {
                    if (videoRef.current) await hands.send({ image: videoRef.current })
                },
                width: 640,
                height: 360
            })
            camera.start()
            setStatus("Ready!")
        }
        return () => { try { hands.close() } catch (e) { } }
    }, [])

    const onResults = (results) => {
        const canvas = canvasRef.current
        if (!canvas) return
        const ctx = canvas.getContext('2d')
        const w = canvas.width
        const h = canvas.height

        ctx.clearRect(0, 0, w, h)

        // Draw Strokes
        ctx.strokeStyle = "red"
        ctx.lineWidth = 6
        ctx.lineCap = 'round'
        ctx.lineJoin = 'round'
        gameState.current.annotations.forEach(stroke => drawStroke(ctx, stroke, w, h))
        drawStroke(ctx, gameState.current.currentStroke, w, h)

        if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
            gameState.current.pointerVisible = true
            processHand(results.multiHandLandmarks[0], ctx, w, h)
        } else {
            gameState.current.pointerVisible = false
            gameState.current.isDrawing = false
            commitStroke()
        }
    }

    const processHand = (lm, ctx, w, h) => {
        const mode = gameState.current.mode

        // Finger States (Up if Tip y < Pip y)
        const isUp = (t, p) => lm[t].y < lm[p].y
        const indexUp = isUp(8, 6)
        const middleUp = isUp(12, 10)
        const ringUp = isUp(16, 14)
        const pinkyUp = isUp(20, 18)
        const thumbTip = lm[4]
        const indexTip = lm[8]
        const timeNow = Date.now()

        // --- INPUT MODE LOGIC ---
        let rawX, rawY, isActive

        // Helper: Pinch Distance
        const getPinchDist = () => {
            const dx = indexTip.x - thumbTip.x
            const dy = indexTip.y - thumbTip.y
            return Math.sqrt(dx * dx + dy * dy)
        }

        if (mode === 'pen') {
            // --- PEN MODE (Pinch) ---
            rawX = (indexTip.x + thumbTip.x) / 2
            rawY = (indexTip.y + thumbTip.y) / 2

            const dist = getPinchDist()

            // HYSTERESIS
            if (gameState.current.wasPinching) {
                if (dist < 0.08) isActive = true
                else isActive = false
            } else {
                if (dist < 0.05) isActive = true
                else isActive = false
            }
            gameState.current.wasPinching = isActive

        } else {
            // --- HAND MODE (Point) ---
            rawX = indexTip.x
            rawY = indexTip.y
            // Strict Point
            isActive = indexUp && !middleUp && !ringUp && !pinkyUp
            gameState.current.wasPinching = isActive
        }

        // Sensitivity & Smoothing
        const sensitivity = 1.8
        const offsetX = 0.5; const offsetY = 0.5
        rawX = (rawX - offsetX) * sensitivity + offsetX
        rawY = (rawY - offsetY) * sensitivity + offsetY
        rawX = Math.max(0, Math.min(1, rawX))
        rawY = Math.max(0, Math.min(1, rawY))

        const alpha = 0.15
        gameState.current.cursorX += (rawX - gameState.current.cursorX) * alpha
        gameState.current.cursorY += (rawY - gameState.current.cursorY) * alpha

        const cx = gameState.current.cursorX
        const cy = gameState.current.cursorY

        // --- NAVIGATION GESTURES (Guarded) ---
        const cooldown = 1500
        const notCool = timeNow - gameState.current.lastGestureTime < cooldown

        // GUARD: Cannot Nav if Pinching/Drawing
        if (!notCool && !isActive && !gameState.current.isDrawing) {

            // 1. NEXT SLIDE: Pinky ONLY up (Strict)
            if (!indexUp && !middleUp && !ringUp && pinkyUp) {
                triggerGesture("NEXT")
            }

            // 2. PREV SLIDE: Strict THUMBS UP
            const thumbHigh = lm[4].y < lm[5].y - 0.05
            const indexCurled = lm[8].y > lm[5].y

            if (thumbHigh && indexCurled && !middleUp && !ringUp && !pinkyUp) {
                triggerGesture("PREV")
            }

            // 3. UNDO: OPEN PALM (Open Hand)
            const dist = getPinchDist()
            const isOpen = dist > 0.12

            if (indexUp && middleUp && ringUp && pinkyUp && isOpen) {
                if (gameState.current.annotations.length > 0) {
                    gameState.current.annotations.pop()
                    triggerSimpleFeedback("UNDO")
                }
            }
        }

        // --- DRAWING ACTION ---
        if (isActive) {
            if (!gameState.current.isDrawing) {
                gameState.current.isDrawing = true
                gameState.current.currentStroke = []
            }
            gameState.current.currentStroke.push({ x: cx, y: cy })
            drawCursor(ctx, cx, cy, w, h, "red", true)
        } else {
            if (gameState.current.isDrawing) {
                gameState.current.isDrawing = false
                commitStroke()
            }
            drawCursor(ctx, cx, cy, w, h, "cyan", false)
        }
    }

    const triggerGesture = (type) => {
        gameState.current.lastGestureTime = Date.now()
        setGesture(type)
        if (type === "NEXT") setSlideIndex(prev => Math.min(prev + 1, slides.length - 1))
        if (type === "PREV") setSlideIndex(prev => Math.max(prev - 1, 0))
        setTimeout(() => setGesture(null), 1000)
    }

    const triggerSimpleFeedback = (text) => {
        gameState.current.lastGestureTime = Date.now()
        setGesture(text)
        setTimeout(() => setGesture(null), 1000)
    }

    const commitStroke = () => {
        if (gameState.current.currentStroke.length > 0) {
            gameState.current.annotations.push(gameState.current.currentStroke)
        }
        gameState.current.currentStroke = []
    }

    const drawStroke = (ctx, stroke, w, h) => {
        if (stroke.length < 2) return
        ctx.beginPath()
        ctx.moveTo((1 - stroke[0].x) * w, stroke[0].y * h)
        for (let i = 1; i < stroke.length; i++) {
            ctx.lineTo((1 - stroke[i].x) * w, stroke[i].y * h)
        }
        ctx.stroke()
    }

    const drawCursor = (ctx, x, y, w, h, color, fill) => {
        const px = (1 - x) * w
        const py = y * h
        const radius = fill ? 8 : 15
        ctx.beginPath()
        ctx.arc(px, py, radius, 0, 2 * Math.PI)
        if (fill) {
            ctx.fillStyle = color
            ctx.fill()
        }
        ctx.strokeStyle = color
        ctx.lineWidth = 2
        ctx.stroke()
    }

    const manualPrev = () => {
        setSlideIndex(prev => Math.max(prev - 1, 0))
    }
    const manualNext = () => {
        setSlideIndex(prev => Math.min(prev + 1, slides.length - 1))
    }

    const clearAll = () => {
        gameState.current.annotations = [[]]
        triggerSimpleFeedback("CLEARED")
    }

    return (
        <div className="relative w-full h-full flex flex-col overflow-hidden bg-black select-none font-sans">
            {/* AMBIENT GLOW */}
            <div className="absolute inset-0 pointer-events-none z-0">
                <div className="absolute top-0 right-0 w-[30%] h-[30%] bg-emerald-900/10 blur-[100px]" />
                <div className="absolute bottom-0 left-0 w-[30%] h-[30%] bg-teal-900/10 blur-[100px]" />
            </div>

            {/* HEADER */}
            <div className="h-16 backdrop-blur-md bg-gray-900/80 flex items-center justify-between px-4 z-20 border-b border-white/5">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => setIsPenMode(!isPenMode)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold transition-all ${isPenMode
                            ? 'bg-purple-600 hover:bg-purple-500 text-white shadow-[0_0_15px_rgba(147,51,234,0.3)] ring-1 ring-purple-500/50'
                            : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-[0_0_15px_rgba(16,185,129,0.3)] ring-1 ring-emerald-500/50'
                            }`}
                    >
                        {isPenMode ? <PenTool className="w-5 h-5" /> : <Hand className="w-5 h-5" />}
                        {isPenMode ? "PEN MODE (PINCH)" : "HAND MODE (POINT)"}
                    </button>
                    <button
                        onClick={clearAll}
                        className="flex items-center gap-2 px-4 py-2 bg-red-600/90 hover:bg-red-500 text-white rounded-lg font-bold transition shadow-lg shadow-red-600/20 ring-1 ring-red-500/30"
                    >
                        <Trash2 className="w-5 h-5" />
                        Undo All
                    </button>
                    <span className="text-gray-400 text-sm hidden sm:block font-mono tracking-wide">{status}</span>
                </div>

                <div className="flex gap-4 text-gray-400 text-xs font-semibold tracking-wider uppercase hidden lg:flex">
                    <span className="flex items-center gap-1"><ArrowLeftCircle className="w-4 h-4 text-emerald-500" /> Thumb High: Prev</span>
                    <span className="flex items-center gap-1"><ArrowRightCircle className="w-4 h-4 text-emerald-500" /> Pinky: Next</span>
                    <span className="flex items-center gap-1"><Eraser className="w-4 h-4 text-red-500" /> Open Hand: Undo</span>
                </div>

                <button onClick={onBack} className="text-sm border border-white/10 hover:bg-white/5 px-4 py-1.5 rounded transition text-gray-300">
                    Exit
                </button>
            </div>

            {/* STAGE */}
            <div className="flex-1 relative bg-gray-950 flex items-center justify-center">
                {slideUrl && <img src={slideUrl} className="max-w-full max-h-full object-contain pointer-events-none shadow-2xl" />}
                <canvas ref={canvasRef} width={1280} height={720} className="absolute inset-0 w-full h-full" />

                {gesture && (
                    <div className="absolute top-10 left-1/2 -translate-x-1/2 z-50 bg-black/70 text-emerald-400 px-8 py-4 rounded-full text-2xl font-bold backdrop-blur-md animate-bounce border border-emerald-500/30 shadow-[0_0_30px_rgba(16,185,129,0.2)]">
                        {gesture}
                    </div>
                )}

                <button onClick={manualPrev} className="absolute left-4 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-emerald-600/80 text-white p-4 rounded-full backdrop-blur-sm transition hover:scale-110 z-40 border border-white/10 group">
                    <ChevronLeft className="w-8 h-8 group-hover:text-white transition-colors" />
                </button>
                <button onClick={manualNext} className="absolute right-4 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-emerald-600/80 text-white p-4 rounded-full backdrop-blur-sm transition hover:scale-110 z-40 border border-white/10 group">
                    <ChevronRight className="w-8 h-8 group-hover:text-white transition-colors" />
                </button>

                <video ref={videoRef} className="absolute bottom-4 right-4 w-48 h-36 object-cover rounded-xl border-2 border-emerald-500/30 shadow-2xl z-10" playsInline style={{ transform: 'scaleX(-1)' }} />
            </div>
        </div>
    )
}
