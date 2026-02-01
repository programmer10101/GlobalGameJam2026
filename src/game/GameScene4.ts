import type { Scene } from "./Scene"
import { CanvasLayer } from "../rendering/CanvasLayer"
import type { Point, RedactionMask } from "../data/types"

/* =======================
   Types
   ======================= */

type StrokePoint = {
  x: number
  y: number
}

type DocumentLayout = {
  scale: number
  offsetX: number
  offsetY: number
  drawWidth: number
  drawHeight: number
}

type UIButton = {
  x: number
  y: number
  width: number
  height: number
  text: string
}

const RoundPhase = {
  Prompt: "Prompt",
  Redacting: "Redacting",
  Scoring: "Scoring",
} as const

type RoundPhase = typeof RoundPhase[keyof typeof RoundPhase]

/* =======================
   GameScene
   ======================= */

export class GameScene4 implements Scene {
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

  private allMasks: RedactionMask[] = []
  private currentMaskIndex = 0
  private mask!: RedactionMask
  private prompt = ""

  /* ---------- Buttons ---------- */
  private readyButton!: UIButton
  private doneButton!: UIButton
  private continueButton!: UIButton
  private exitButton!: UIButton

  onExit: () => void

  /* =======================
     Constructor
     ======================= */
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
    this.allMasks = this.shuffleMasks(masks)
    this.onExit = onExit

    this.loadCurrentMask()
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

      if (Math.ceil(this.timer) !== prev) {
        this.needsRedraw = true
      }
    }
  }

  render() {
    if (!this.imageLoaded || !this.needsRedraw) return

    this.docLayer.clear()
    this.redactionLayer.clear()
    this.uiLayer.clear()

    if (this.phase !== RoundPhase.Prompt) {
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
    switch (this.phase) {
      case RoundPhase.Prompt:
        if (this.pointInRect(p, this.readyButton)) this.startRedaction()
        break

      case RoundPhase.Redacting:
        if (this.pointInRect(p, this.doneButton)) {
          this.finishRound()
          return
        }

        const docPoint = this.screenToDocument(p)
        if (!docPoint) return

        this.isDrawing = true
        this.strokes.push(docPoint)
        this.drawCoveragePoint(docPoint)
        this.needsRedraw = true
        break

      case RoundPhase.Scoring:
        if (this.pointInRect(p, this.continueButton)) {
          this.startPrompt()
          return
        }
        if (this.pointInRect(p, this.exitButton)) {
          this.exitToMenu()
          return
        }
        break
    }
  }

  onPointerMove(p: Point) {
    if (!this.isDrawing || this.phase !== RoundPhase.Redacting) return
    const docPoint = this.screenToDocument(p)
    if (!docPoint) return
    this.strokes.push(docPoint)
    this.drawCoveragePoint(docPoint)
    this.needsRedraw = true
  }

  onPointerUp() {
    this.isDrawing = false
  }

  /* =======================
     Phase Transitions
     ======================= */
  private startPrompt() {
    this.phase = RoundPhase.Prompt
    this.loadCurrentMask() // new document & prompt
    this.needsRedraw = true
  }

  private startRedaction() {
    this.phase = RoundPhase.Redacting
    this.timer = this.timeLimit
    this.strokes = []

    this.coverageCtx.clearRect(
      0,
      0,
      this.coverageCanvas.width,
      this.coverageCanvas.height
    )

    this.needsRedraw = true
  }

  private finishRound() {
    this.phase = RoundPhase.Scoring
    this.roundScore = this.calculateScore()
    this.totalScore += this.roundScore
    this.needsRedraw = true

    // Prepare next mask
    this.currentMaskIndex++
    if (this.currentMaskIndex >= this.allMasks.length) {
      this.currentMaskIndex = 0
      this.allMasks = this.shuffleMasks(this.allMasks)
    }
  }

  private exitToMenu() {
    // Clean up everything
    this.roundScore = 0
    this.totalScore = 0
    this.strokes = []
    this.phase = RoundPhase.Prompt
    this.docLayer.clear()
    this.redactionLayer.clear()
    this.uiLayer.clear()
    this.onExit()
  }

  /* =======================
     Layout
     ======================= */
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
     Rendering Helpers
     ======================= */
  private drawLabel(
    text: string,
    x: number,
    y: number,
    options?: {
      padding?: number
      bgColor?: string
      textColor?: string
      font?: string
      radius?: number
    }
  ) {
    const ctx = this.uiLayer.ctx
    const padding = options?.padding ?? 8
    const bgColor = options?.bgColor ?? "rgba(0,0,0,0.65)"
    const textColor = options?.textColor ?? "white"
    const font = options?.font ?? "20px sans-serif"
    const radius = options?.radius ?? 6

    ctx.font = font
    ctx.textBaseline = "top"
    const metrics = ctx.measureText(text)
    const textHeight = metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent
    const w = metrics.width + padding * 2
    const h = textHeight + padding * 2

    ctx.fillStyle = bgColor
    ctx.beginPath()
    ctx.roundRect(x, y, w, h, radius)
    ctx.fill()

    ctx.fillStyle = textColor
    ctx.fillText(text, x + padding, y + padding)
  }

  private drawDocument() {
    const { ctx } = this.docLayer
    const { offsetX, offsetY, drawWidth, drawHeight } = this.layout
    ctx.drawImage(this.docImage, offsetX, offsetY, drawWidth, drawHeight)
  }

  private drawRedactions() {
    const ctx = this.redactionLayer.ctx
    ctx.fillStyle = this.markerColor
    for (const p of this.strokes) {
      const screen = this.documentToScreen(p)
      const r = this.markerRadiusNorm * this.layout.drawWidth
      ctx.beginPath()
      ctx.arc(screen.x, screen.y, r, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  private drawUI() {
    const ctx = this.uiLayer.ctx
    const w = this.uiLayer.width
    const h = this.uiLayer.height

    ctx.font = "20px sans-serif"
    ctx.textAlign = "center"

    if (this.phase === RoundPhase.Prompt) {
      ctx.fillStyle = "white"
      ctx.fillText(this.prompt, w / 2, h * 0.25)
      this.readyButton = this.drawButton("READY", w / 2, h * 0.35)
    }

    if (this.phase === RoundPhase.Redacting) {
      ctx.textAlign = "left"
      ctx.fillStyle = "yellow"
      ctx.fillText(`Time: ${Math.ceil(this.timer)}`, 20, 30)
      this.doneButton = this.drawButton("DONE", w - 80, 30)
    }

    if (this.phase === RoundPhase.Scoring) {
      const centerX = w / 2
      ctx.textAlign = "left"
      ctx.textBaseline = "middle"
      this.drawLabel(`Round Score: ${this.roundScore}`, centerX - 70, h * 0.28, {
        bgColor: "rgba(0,0,0,0.75)",
        textColor: "#7CFF7C",
        font: "bold 22px sans-serif",
      })
      this.drawLabel(`Total Score: ${this.totalScore}`, centerX - 70, h * 0.35, {
        bgColor: "rgba(0,0,0,0.75)",
        textColor: "white",
      })

      this.continueButton = this.drawButton("CONTINUE", w / 2, h * 0.6)
      this.exitButton = this.drawButton("EXIT", w / 2, h * 0.68)
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

  private pointInRect(p: Point, r: UIButton) {
    return p.x >= r.x && p.x <= r.x + r.width && p.y >= r.y && p.y <= r.y + r.height
  }

  /* =======================
     Coverage + Scoring
     ======================= */
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
    const ctx = this.coverageCtx
    const { width: w, height: h } = this.coverageCanvas
    const data = ctx.getImageData(0, 0, w, h).data

    const step = 4
    let correct = 0
    let missed = 0
    let falsePositive = 0

    const inTarget = (x: number, y: number) =>
      targetRects.some(r =>
        x >= r.x && y >= r.y && x <= r.x + r.width && y <= r.y + r.height
      )

    for (let y = 0; y < h; y += step) {
      for (let x = 0; x < w; x += step) {
        const i = (y * w + x) * 4
        if (data[i + 3] === 0) continue
        inTarget(x / w, y / h) ? correct++ : falsePositive++
      }
    }

    for (const r of targetRects) {
      for (let y = Math.floor(r.y * h); y < Math.ceil((r.y + r.height) * h); y += step) {
        for (let x = Math.floor(r.x * w); x < Math.ceil((r.x + r.width) * w); x += step) {
          const i = (y * w + x) * 4
          if (data[i + 3] === 0) missed++
        }
      }
    }

    return Math.max(0, Math.round(correct * 2 - falsePositive * 1.5 - missed * 3))
  }

  /* =======================
     Document Loading
     ======================= */
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

  private shuffleMasks(masks: RedactionMask[]): RedactionMask[] {
    const arr = [...masks]
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[arr[i], arr[j]] = [arr[j], arr[i]]
    }
    return arr
  }

  private loadCurrentMask() {
    const mask = this.allMasks[this.currentMaskIndex]
    this.mask = mask
    this.prompt = mask.prompt
    this.loadDocument(mask.imageSrc)
  }
}
