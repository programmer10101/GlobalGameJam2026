import type { Scene } from "./Scene"
import { CanvasLayer } from "../rendering/CanvasLayer"
import type { Point, RedactionMask } from "../data/types"

type StrokePoint = { x: number; y: number }
type DocumentLayout = { scale: number; offsetX: number; offsetY: number; drawWidth: number; drawHeight: number }
type UIButton = { x: number; y: number; width: number; height: number; text: string }

const RoundPhase = {
  Prompt: "Prompt",
  Redacting: "Redacting",
  Scoring: "Scoring",
} as const

type RoundPhase = typeof RoundPhase[keyof typeof RoundPhase]

export class GameScene implements Scene {
  private debugMode = false

  /* ---------- Layers ---------- */
  private docLayer: CanvasLayer
  private redactionLayer: CanvasLayer
  private uiLayer: CanvasLayer

  /* ---------- Document ---------- */
  private docImage = new Image()
  private imageLoaded = false
  private layout!: DocumentLayout

  /* ---------- Drawing ---------- */
  private strokes: StrokePoint[] = []
  private isDrawing = false
  private markerColor = "yellow"
  private markerRadiusNorm = 0.012

  /* ---------- Coverage ---------- */
  private coverageCanvas = document.createElement("canvas")
  private coverageCtx = this.coverageCanvas.getContext("2d")!

  /* ---------- Game State ---------- */
  private phase: RoundPhase = RoundPhase.Prompt
  private timer = 0
  private timeLimit = 30
  private roundScore = 0
  private totalScore = 0
  private needsRedraw = true

  private masks: RedactionMask[]
  private currentMaskIndex = 0
  private prompt: string = ""
  private mask!: RedactionMask

  /* ---------- Buttons ---------- */
  private readyButton!: UIButton
  private doneButton!: UIButton
  private continueButton!: UIButton
  private exitButton!: UIButton

  onExit: () => void

  constructor(
    docLayer: CanvasLayer,
    redactionLayer: CanvasLayer,
    uiLayer: CanvasLayer,
    masks: RedactionMask[],
    onExit: () => void
  ) {
    this.docLayer = docLayer
    this.redactionLayer = redactionLayer
    this.uiLayer = uiLayer
    this.masks = [...masks].sort(() => Math.random() - 0.5)
    this.onExit = onExit
    this.loadNextMask()
  }

  /* =======================
     Lifecycle
  ======================= */
  update(dt: number) {
    if (this.phase === RoundPhase.Redacting) {
      const prev = Math.ceil(this.timer)
      this.timer -= dt
      if (this.timer <= 0) {
        this.timer = 0
        this.finishRound()
      }
      if (Math.ceil(this.timer) !== prev) this.needsRedraw = true
    }
  }

  render() {
    if (!this.imageLoaded || !this.needsRedraw) return

    this.docLayer.clear()
    this.redactionLayer.clear()
    this.uiLayer.clear()

    if (this.phase === RoundPhase.Redacting || this.phase === RoundPhase.Scoring) {
      this.drawDocument()
      this.drawRedactions()
    }

    this.drawUI()
    this.needsRedraw = false
  }

  onResize() {
    if (!this.imageLoaded) return
    this.computeLayout()
    this.needsRedraw = true
  }

  /* =======================
     Input
  ======================= */
  onPointerDown(p: Point) {
    if (!p) return;
    switch (this.phase) {
      case RoundPhase.Prompt:
        if (this.readyButton && this.pointInRect(p, this.readyButton)) this.startRedaction()
        break
      case RoundPhase.Redacting:
        if (this.doneButton && this.pointInRect(p, this.doneButton)) this.finishRound()
        else this.startStroke(p)
        break
      case RoundPhase.Scoring:
        if (this.continueButton && this.pointInRect(p, this.continueButton)) this.loadNextMask()
        else if (this.exitButton && this.pointInRect(p, this.exitButton)) this.exitGame()
        break
    }
  }

  onPointerMove(p: Point) {
    if (!this.isDrawing || this.phase !== RoundPhase.Redacting) return
    this.addStroke(p)
  }

  onPointerUp() {
    this.isDrawing = false
  }

  /* =======================
     Debug Input
  ======================= */
  onKeyDown(e: KeyboardEvent) {
    if (e.key.toLowerCase() === "d") {
      this.debugMode = !this.debugMode
      this.needsRedraw = true
    }
  }

  /* =======================
     Phase Transitions
  ======================= */
  private startRedaction() {
    this.phase = RoundPhase.Redacting
    this.timer = this.timeLimit
    this.strokes = []
    this.coverageCtx.clearRect(0, 0, this.coverageCanvas.width, this.coverageCanvas.height)
    this.needsRedraw = true
  }

  private finishRound() {
    this.phase = RoundPhase.Scoring
    this.roundScore = this.calculateScore()
    this.totalScore += this.roundScore
    this.needsRedraw = true
  }

  private loadNextMask() {
    if (this.currentMaskIndex >= this.masks.length) this.currentMaskIndex = 0
    this.mask = this.masks[this.currentMaskIndex++]
    this.prompt = this.mask.prompt
    this.loadDocument(this.mask.imageSrc)
    this.phase = RoundPhase.Prompt
    this.strokes = []
    this.coverageCtx.clearRect(0, 0, this.coverageCanvas.width, this.coverageCanvas.height)
    this.needsRedraw = true
  }

  private exitGame() {
    this.roundScore = 0
    this.totalScore = 0
    this.strokes = []
    this.phase = RoundPhase.Prompt

    // Clear layers and coverage
    this.docLayer.clear()
    this.redactionLayer.clear()
    this.uiLayer.clear()
    this.coverageCtx.clearRect(0, 0, this.coverageCanvas.width, this.coverageCanvas.height)
    
    this.needsRedraw = true
    this.onExit()
  }


  resetGame() {
    this.roundScore = 0
    this.totalScore = 0
    this.currentMaskIndex = 0
    this.strokes = []
    this.coverageCtx.clearRect(0, 0, this.coverageCanvas.width, this.coverageCanvas.height)
    this.loadNextMask()
  }

  /* =======================
     Drawing Helpers
  ======================= */
  private startStroke(p: Point) {
    const docPoint = this.screenToDocument(p)
    if (!docPoint) return
    this.isDrawing = true
    this.strokes.push(docPoint)
    this.drawCoveragePoint(docPoint)
    this.needsRedraw = true
  }

  private addStroke(p: Point) {
    const docPoint = this.screenToDocument(p)
    if (!docPoint) return
    this.strokes.push(docPoint)
    this.drawCoveragePoint(docPoint)
    this.needsRedraw = true
  }

  private computeLayout() {
    const rect = this.docLayer.canvas.getBoundingClientRect()
    const scale = Math.min(rect.width / this.docImage.width, rect.height / this.docImage.height)
    const drawWidth = this.docImage.width * scale
    const drawHeight = this.docImage.height * scale
    const offsetX = (rect.width - drawWidth) / 2
    const offsetY = (rect.height - drawHeight) / 2
    this.layout = { scale, offsetX, offsetY, drawWidth, drawHeight }
  }

  private screenToDocument(p: Point): StrokePoint | null {
    const { offsetX, offsetY, drawWidth, drawHeight } = this.layout
    const x = (p.x - offsetX) / drawWidth
    const y = (p.y - offsetY) / drawHeight
    if (x < 0 || x > 1 || y < 0 || y > 1) return null
    return { x, y }
  }

  private documentToScreen(p: StrokePoint): Point {
    const { offsetX, offsetY, drawWidth, drawHeight } = this.layout
    return { x: p.x * drawWidth + offsetX, y: p.y * drawHeight + offsetY }
  }

  /* =======================
     Rendering
  ======================= */
  private drawDocument() {
    const { ctx } = this.docLayer
    const { offsetX, offsetY, drawWidth, drawHeight } = this.layout
    ctx.drawImage(this.docImage, offsetX, offsetY, drawWidth, drawHeight)
  }

  private drawRedactions() {
    const ctx = this.redactionLayer.ctx
    ctx.fillStyle = this.markerColor
    const rNorm = this.markerRadiusNorm * this.layout.drawWidth
    for (const p of this.strokes) {
      const screen = this.documentToScreen(p)
      ctx.beginPath()
      ctx.arc(screen.x, screen.y, rNorm, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  private drawUI() {
    const ctx = this.uiLayer.ctx
    const w = this.uiLayer.width
    const h = this.uiLayer.height
    ctx.font = "20px sans-serif"
    ctx.textAlign = "center"
    ctx.textBaseline = "middle"

    // --- Debug overlay ---
    if (this.debugMode) {
      ctx.fillStyle = "white"
      ctx.font = "bold 18px sans-serif"
      ctx.fillText(this.prompt, w / 2, 20)
      ctx.strokeStyle = "red"
      ctx.lineWidth = 2
      for (const r of this.mask.targetRects) {
        const x = r.x * this.layout.drawWidth + this.layout.offsetX
        const y = r.y * this.layout.drawHeight + this.layout.offsetY
        const width = r.width * this.layout.drawWidth
        const height = r.height * this.layout.drawHeight
        ctx.strokeRect(x, y, width, height)
      }
    }

    switch (this.phase) {
      case RoundPhase.Prompt:
        ctx.fillStyle = "white"
        ctx.fillText(this.prompt, w / 2, h * 0.25)
        this.readyButton = this.drawButton("READY", w / 2, h * 0.35)
        break

      case RoundPhase.Redacting:
        ctx.textAlign = "left"
        ctx.fillStyle = "yellow"
        ctx.fillText(`Time: ${Math.ceil(this.timer)}`, 20, 30)
        this.doneButton = this.drawButton("DONE", w - 80, 30)
        break

      case RoundPhase.Scoring:
        const centerX = w / 2
        this.drawLabel(`Round Score: ${this.roundScore}`, centerX, h * 0.28, { bgColor: "rgba(0,0,0,0.75)", textColor: "#7CFF7C", font: "bold 22px sans-serif" })
        this.drawLabel(`Total Score: ${this.totalScore}`, centerX, h * 0.36, { bgColor: "rgba(0,0,0,0.75)", textColor: "white" })
        this.continueButton = this.drawButton("CONTINUE", centerX, h * 0.5)
        this.exitButton = this.drawButton("EXIT", centerX, h * 0.57)

        if (this.debugMode) {
          ctx.strokeStyle = "red"
          ctx.lineWidth = 2
          for (const r of this.mask.targetRects) {
            const x = r.x * this.layout.drawWidth + this.layout.offsetX
            const y = r.y * this.layout.drawHeight + this.layout.offsetY
            const width = r.width * this.layout.drawWidth
            const height = r.height * this.layout.drawHeight
            ctx.strokeRect(x, y, width, height)
          }
        }
        break
    }
  }

  private drawButton(text: string, cx: number, cy: number): UIButton {
    const ctx = this.uiLayer.ctx
    const width = 140
    const height = 40
    ctx.fillStyle = "#444"
    ctx.fillRect(cx - width / 2, cy - height / 2, width, height)
    ctx.fillStyle = "white"
    ctx.font = "20px sans-serif"
    ctx.textAlign = "center"
    ctx.textBaseline = "middle"
    ctx.fillText(text, cx, cy)
    return { x: cx - width / 2, y: cy - height / 2, width, height, text }
  }

  private drawLabel(text: string, cx: number, cy: number, options?: { bgColor?: string; textColor?: string; font?: string }) {
    const ctx = this.uiLayer.ctx
    const font = options?.font ?? "20px sans-serif"
    ctx.font = font
    ctx.textBaseline = "middle"
    const metrics = ctx.measureText(text)
    const width = metrics.width + 16
    const height = parseInt(ctx.font, 10) + 12
    ctx.fillStyle = options?.bgColor ?? "rgba(0,0,0,0.65)"
    ctx.fillRect(cx - width / 2, cy - height / 2, width, height)
    ctx.fillStyle = options?.textColor ?? "white"
    ctx.fillText(text, cx, cy)
  }

  private pointInRect(p: Point, r: UIButton) {
    if (!p || !("x" in p)) return false;
    if (!r) return false;
    return p.x >= r.x && p.x <= r.x + r.width && p.y >= r.y && p.y <= r.y + r.height
  }

  private drawCoveragePoint(p: StrokePoint) {
    const ctx = this.coverageCtx
    const r = this.markerRadiusNorm * this.coverageCanvas.width
    ctx.fillStyle = "white"
    ctx.beginPath()
    ctx.arc(p.x * this.coverageCanvas.width, p.y * this.coverageCanvas.height, r, 0, Math.PI * 2)
    ctx.fill()
  }

  private calculateScore(): number {
    const { targetRects } = this.mask
    const w = this.coverageCanvas.width
    const h = this.coverageCanvas.height
    const data = this.coverageCtx.getImageData(0, 0, w, h).data
    const step = 4
    let correct = 0
    let missed = 0
    let falsePositive = 0

    // Check painted pixels
    for (let y = 0; y < h; y += step) {
      for (let x = 0; x < w; x += step) {
        const i = (y * w + x) * 4
        if (data[i + 3] === 0) continue // not painted
        const inside = targetRects.some(r =>
          x >= r.x * w && y >= r.y * h && x <= (r.x + r.width) * w && y <= (r.y + r.height) * h
        )
        inside ? correct++ : falsePositive++
      }
    }

    // Count missed pixels in target rects
    for (const r of targetRects) {
      const startX = Math.floor(r.x * w)
      const endX = Math.ceil((r.x + r.width) * w)
      const startY = Math.floor(r.y * h)
      const endY = Math.ceil((r.y + r.height) * h)
      for (let y = startY; y < endY; y += step) {
        for (let x = startX; x < endX; x += step) {
          const i = (y * w + x) * 4
          if (data[i + 3] === 0) missed++
        }
      }
    }

    let roundScore = correct * 20 - falsePositive * 1.5 - missed * 0.5

    // Add a time bonus if user finishes early
    if (this.phase === RoundPhase.Scoring) {
      const timeFactor = Math.max(0, this.timer / this.timeLimit) // 0..1
      roundScore += roundScore * timeFactor * 0.5 // up to 50% bonus
    }

    return Math.max(0, Math.round(roundScore))
  }



  private loadDocument(src: string) {
    this.docImage.onload = () => {
      this.imageLoaded = true
      this.coverageCanvas.width = this.docImage.width
      this.coverageCanvas.height = this.docImage.height
      this.computeLayout()
      this.needsRedraw = true
    }
    this.docImage.src = src
  }
}
