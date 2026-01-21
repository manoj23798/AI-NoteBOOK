import { useRef, useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, PenTool, Eraser, Hand, MousePointer2, Square, Circle, Minus, ArrowUpRight, Trash2, Undo } from 'lucide-react'
import { Hands } from '@mediapipe/hands'
import { Camera } from '@mediapipe/camera_utils'

export default function Presenter({ apiUrl, onBack }) {
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
    const [activeTool, setActiveTool] = useState('pen') // pen, rect, circle, line, arrow

    // Game Loop State
    const gameState = useRef({
        annotations: [], // array of objects {type, points...}
        currentShape: null, // {type, start: {x,y}, end: {x,y}, points: []}
        isDrawing: false,
        lastGestureTime: 0,
        slideIndex: 0,
        cursorX: 0.5,
        cursorY: 0.5,
        pointerVisible: false,
        mode: 'pen',
        wasPinching: false
    })

    // Sync State
    useEffect(() => {
        gameState.current.slideIndex = slideIndex
        if (slides.length > 0) setSlideUrl(`${apiUrl}/slides/${slides[slideIndex]}`)
    }, [slideIndex, slides, apiUrl])

    useEffect(() => {
        gameState.current.mode = isPenMode ? 'pen' : 'hand'
        gameState.current.wasPinching = false
    }, [isPenMode])

    // Load Slides
    useEffect(() => {
        fetch(`${apiUrl}/current-state`)
            .then(res => res.json())
            .then(data => {
                if (data.slides?.length > 0) setSlides(data.slides)
                else setStatus("Upload slides first")
            })
    }, [apiUrl])

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

        // Render All Annotations
        gameState.current.annotations.forEach(shape => drawShape(ctx, shape, w, h))

        // Render Current Shape Preview
        if (gameState.current.currentShape) {
            drawShape(ctx, gameState.current.currentShape, w, h)
        }

        if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
            gameState.current.pointerVisible = true
            processHand(results.multiHandLandmarks[0], ctx, w, h)
        } else {
            gameState.current.pointerVisible = false
            gameState.current.isDrawing = false
            commitShape()
        }
    }

    const processHand = (lm, ctx, w, h) => {
        const mode = gameState.current.mode
        const tool = activeTool

        // Finger States
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
        const getPinchDist = () => {
            const dx = indexTip.x - thumbTip.x
            const dy = indexTip.y - thumbTip.y
            return Math.sqrt(dx * dx + dy * dy)
        }

        if (mode === 'pen') {
            // Pinch Mode
            rawX = (indexTip.x + thumbTip.x) / 2
            rawY = (indexTip.y + thumbTip.y) / 2

            const dist = getPinchDist()
            if (gameState.current.wasPinching) {
                isActive = dist < 0.08
            } else {
                isActive = dist < 0.05
            }
            gameState.current.wasPinching = isActive
        } else {
            // Hand Mode
            rawX = indexTip.x
            rawY = indexTip.y
            isActive = indexUp && !middleUp && !ringUp && !pinkyUp
            gameState.current.wasPinching = isActive
        }

        // Smoothing
        const sensitivity = 1.8; const offsetX = 0.5; const offsetY = 0.5
        rawX = (rawX - offsetX) * sensitivity + offsetX
        rawY = (rawY - offsetY) * sensitivity + offsetY
        rawX = Math.max(0, Math.min(1, rawX))
        rawY = Math.max(0, Math.min(1, rawY))

        const alpha = 0.15
        gameState.current.cursorX += (rawX - gameState.current.cursorX) * alpha
        gameState.current.cursorY += (rawY - gameState.current.cursorY) * alpha

        const cx = gameState.current.cursorX
        const cy = gameState.current.cursorY

        // --- NAVIGATION (Guarded) ---
        const cooldown = 1500
        const notCool = timeNow - gameState.current.lastGestureTime < cooldown

        if (!notCool && !isActive && !gameState.current.isDrawing) {
            // Prev Slide (Check Thumb)
            const thumbHigh = lm[4].y < lm[5].y - 0.05
            const indexCurled = lm[8].y > lm[5].y
            if (thumbHigh && indexCurled && !middleUp && !ringUp && !pinkyUp) triggerGesture("PREV")

            // Next Slide (Pinky)
            if (!indexUp && !middleUp && !ringUp && pinkyUp) triggerGesture("NEXT")

            // Undo (Open Palm)
            const dist = getPinchDist()
            const isOpen = dist > 0.12
            if (indexUp && middleUp && ringUp && pinkyUp && isOpen) {
                if (gameState.current.annotations.length > 0) {
                    gameState.current.annotations.pop()
                    triggerSimpleFeedback("UNDO")
                }
            }
        }

        // --- DRAWING / SHAPE LOGIC ---
        if (isActive) {
            // START
            if (!gameState.current.isDrawing) {
                gameState.current.isDrawing = true
                // Initialize Shape
                if (tool === 'pen') {
                    gameState.current.currentShape = { type: 'pen', points: [{ x: cx, y: cy }], color: 'red' }
                } else {
                    // Rect, Circle, Line, Arrow
                    gameState.current.currentShape = {
                        type: tool,
                        start: { x: cx, y: cy },
                        end: { x: cx, y: cy },
                        color: 'red'
                    }
                }
            }
            // UPDATE
            const shape = gameState.current.currentShape
            if (shape) {
                if (shape.type === 'pen') {
                    shape.points.push({ x: cx, y: cy })
                } else {
                    // Update End Point for dragging effect
                    shape.end = { x: cx, y: cy }
                }
            }

            drawCursor(ctx, cx, cy, w, h, "red", true)
        } else {
            // END
            if (gameState.current.isDrawing) {
                gameState.current.isDrawing = false
                commitShape()
            }
            drawCursor(ctx, cx, cy, w, h, "cyan", false)
        }
    }

    const commitShape = () => {
        const shape = gameState.current.currentShape
        if (shape) {
            // Filter very small shapes (accidental clicks)
            let isValid = true
            if (shape.type === 'pen' && shape.points.length < 2) isValid = false
            if (shape.type !== 'pen') {
                const dx = shape.end.x - shape.start.x
                const dy = shape.end.y - shape.start.y
                // Minimal size check
                if (Math.abs(dx) < 0.01 && Math.abs(dy) < 0.01) isValid = false
            }

            if (isValid) {
                gameState.current.annotations.push(shape)
            }
            gameState.current.currentShape = null
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
    const handleUndo = () => {
        if (gameState.current.annotations.length > 0) {
            gameState.current.annotations.pop()
            triggerSimpleFeedback("Undo")
        }
    }
    const handleClear = () => {
        gameState.current.annotations = []
        triggerSimpleFeedback("Cleared")
    }

    // --- RENDERERS ---
    const drawShape = (ctx, shape, w, h) => {
        ctx.strokeStyle = shape.color || "red"
        ctx.lineWidth = 5
        ctx.lineCap = 'round'
        ctx.lineJoin = 'round'

        ctx.beginPath()

        if (shape.type === 'pen') {
            if (shape.points.length < 2) return
            ctx.moveTo((1 - shape.points[0].x) * w, shape.points[0].y * h)
            for (let i = 1; i < shape.points.length; i++) {
                ctx.lineTo((1 - shape.points[i].x) * w, shape.points[i].y * h)
            }
        }
        else {
            // Shapes defined by Start/End
            const sx = (1 - shape.start.x) * w
            const sy = shape.start.y * h
            const ex = (1 - shape.end.x) * w
            const ey = shape.end.y * h

            if (shape.type === 'rect' || shape.type === 'square') { // Square just tool name
                const rw = ex - sx
                const rh = ey - sy
                ctx.rect(sx, sy, rw, rh)
            }
            else if (shape.type === 'circle') {
                // Radius is distance from center(start) to end
                const dx = sx - ex
                const dy = sy - ey
                const r = Math.sqrt(dx * dx + dy * dy)
                ctx.arc(sx, sy, r, 0, 2 * Math.PI)
            }
            else if (shape.type === 'line') {
                ctx.moveTo(sx, sy)
                ctx.lineTo(ex, ey)
            }
            else if (shape.type === 'arrow') {
                // Head size
                const headlen = 20
                const angle = Math.atan2(ey - sy, ex - sx)
                ctx.moveTo(sx, sy)
                ctx.lineTo(ex, ey)
                ctx.lineTo(ex - headlen * Math.cos(angle - Math.PI / 6), ey - headlen * Math.sin(angle - Math.PI / 6))
                ctx.moveTo(ex, ey)
                ctx.lineTo(ex - headlen * Math.cos(angle + Math.PI / 6), ey - headlen * Math.sin(angle + Math.PI / 6))
            }
        }
        ctx.stroke()
    }

    const drawCursor = (ctx, x, y, w, h, color, fill) => {
        const px = (1 - x) * w
        const py = y * h
        const radius = fill ? 8 : 15
        ctx.beginPath()
        ctx.arc(px, py, radius, 0, 2 * Math.PI)
        if (fill) { ctx.fillStyle = color; ctx.fill() }
        ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.stroke()
    }

    const manualPrev = () => setSlideIndex(prev => Math.max(prev - 1, 0))
    const manualNext = () => setSlideIndex(prev => Math.min(prev + 1, slides.length - 1))

    // Tools List
    const TOOLS = [
        { id: 'pen', icon: PenTool, label: 'Pen' },
        { id: 'rect', icon: Square, label: 'Box' },
        { id: 'circle', icon: Circle, label: 'Circle' },
        { id: 'line', icon: Minus, label: 'Line' },
        { id: 'arrow', icon: ArrowUpRight, label: 'Arrow' },
    ]

    return (
        <div className="relative w-full h-full flex flex-col overflow-hidden bg-black select-none">
            {/* TOP BAR */}
            <div className="h-16 bg-gray-900 flex items-center justify-between px-4 z-20 border-b border-gray-800">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => setIsPenMode(!isPenMode)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold transition-all ${isPenMode ? 'bg-purple-600 text-white' : 'bg-blue-600 text-white'
                            }`}
                    >
                        {isPenMode ? <PenTool className="w-5 h-5" /> : <Hand className="w-5 h-5" />}
                        {isPenMode ? "PINCH MODE" : "INDEX MODE"}
                    </button>

                    {/* TOOLS */}
                    <div className="flex bg-gray-800 rounded-lg p-1 gap-1">
                        {TOOLS.map(t => (
                            <button
                                key={t.id}
                                onClick={() => setActiveTool(t.id)}
                                className={`p-2 rounded-md transition ${activeTool === t.id ? 'bg-gray-600 text-white' : 'text-gray-400 hover:text-white'}`}
                                title={t.label}
                            >
                                <t.icon className="w-5 h-5" />
                            </button>
                        ))}
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button onClick={handleUndo} className="p-2 bg-gray-800 hover:bg-gray-700 rounded-md text-white" title="Undo">
                        <Undo className="w-5 h-5" />
                    </button>
                    <button onClick={handleClear} className="p-2 bg-red-900/50 hover:bg-red-900 rounded-md text-white" title="Clear All">
                        <Trash2 className="w-5 h-5" />
                    </button>
                    <button onClick={onBack} className="ml-4 text-sm bg-gray-800 hover:bg-gray-700 px-3 py-1 rounded text-white">Example Exit</button>
                </div>
            </div>

            {/* STAGE */}
            <div className="flex-1 relative bg-gray-900 flex items-center justify-center">
                {slideUrl && <img src={slideUrl} className="max-w-full max-h-full object-contain pointer-events-none" />}
                <canvas ref={canvasRef} width={1280} height={720} className="absolute inset-0 w-full h-full" />

                {gesture && (
                    <div className="absolute top-10 left-1/2 -translate-x-1/2 z-50 bg-black/70 text-white px-8 py-4 rounded-full text-2xl font-bold backdrop-blur-md animate-bounce border border-white/20">
                        {gesture}
                    </div>
                )}

                <button onClick={manualPrev} className="absolute left-4 top-1/2 -translate-y-1/2 bg-black/30 hover:bg-black/80 text-white p-4 rounded-full backdrop-blur z-40"><ChevronLeft /></button>
                <button onClick={manualNext} className="absolute right-4 top-1/2 -translate-y-1/2 bg-black/30 hover:bg-black/80 text-white p-4 rounded-full backdrop-blur z-40"><ChevronRight /></button>

                <video ref={videoRef} className="absolute bottom-4 right-4 w-48 h-36 object-cover rounded-xl border-2 border-white/20 shadow-2xl z-10" playsInline style={{ transform: 'scaleX(-1)' }} />
            </div>
        </div>
    )
}
