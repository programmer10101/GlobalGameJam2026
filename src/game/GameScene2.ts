import type { Scene } from "./Scene"
import { CanvasLayer } from "../rendering/CanvasLayer"
import type { Point, RedactionMask } from "../data/types"

/* =======================
   Types
   ======================= */

type StrokePoint = {
  x: number // normalized document space (0..1)
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

/* =======================
   GameScene
   ======================= */

export class GameScene2 implements Scene {
    // --- Scoring / coverage ---
  private coverageCanvas = document.createElement("canvas")
  private coverageCtx = this.coverageCanvas.getContext("2d")!


  private docLayer: CanvasLayer
  private redactionLayer: CanvasLayer
  private uiLayer: CanvasLayer

  private docImage = new Image()
  private imageLoaded = false

  private layout!: DocumentLayout

  private strokes: StrokePoint[] = []
  private isDrawing = false
  private needsRedraw = true

  private markerColor = "yellow"
  private markerRadiusNorm = 0.012

  // Timer / gameplay
  private timer: number = 0
  private timeLimit: number = 30
  private isCountingDown: boolean = false
  private score: number = 0

  private prompt: string
  private mask: RedactionMask

  // Buttons
  private readyButton: UIButton = { x: 20, y: 50, width: 100, height: 40, text: "Ready" }
  private doneButton: UIButton = { x: 140, y: 50, width: 100, height: 40, text: "Done" }


  constructor(
    docLayer: CanvasLayer,
    redactionLayer: CanvasLayer,
    uiLayer: CanvasLayer,
    mask: RedactionMask
  ) {
    this.docLayer = docLayer
    this.redactionLayer = redactionLayer
    this.uiLayer = uiLayer
    this.mask = mask
    this.prompt = mask.prompt

    this.loadDocument(mask.imageSrc)
  }

  /* =======================
     Lifecycle
     ======================= */

  update(dt: number) {
  if (this.isCountingDown) {
    const prev = Math.floor(this.timer)
    this.timer -= dt

    if (this.timer <= 0) {
      this.timer = 0
      this.isCountingDown = false
      this.calculateScore()
      this.needsRedraw = true
    }

    // redraw only when visible value changes
    if (Math.floor(this.timer) !== prev) {
      this.needsRedraw = true
    }
  }
}


  render() {
    if (!this.imageLoaded || !this.needsRedraw) return
    this.redrawAll()
    this.needsRedraw = false
}


  onResize() {
    if (!this.imageLoaded) return
    this.computeLayout()
    this.needsRedraw = true
    // this.redrawAll()
  }

  /* =======================
     Input (called by Game)
     ======================= */

  onPointerDown(p: Point) {
    // Check buttons
    if (this.pointInRect(p, this.readyButton)) {
      this.strokes = []
      this.coverageCtx.clearRect(
        0,
        0,
        this.coverageCanvas.width,
        this.coverageCanvas.height
      ) 
      this.isCountingDown = true
      this.timer = this.timeLimit
      this.score = 0
      this.needsRedraw = true
      return
    }

    if (this.pointInRect(p, this.doneButton)) {
      this.isCountingDown = false
      this.calculateScore()
      this.needsRedraw = true
      return
    }

    const docPoint = this.screenToDocument(p)
    if (!docPoint) return

    this.isDrawing = true
    this.strokes.push(docPoint)
    this.drawCoveragePoint(docPoint)
    this.needsRedraw = true
  }

  onPointerMove(p: Point) {
    if (!this.isDrawing) return

    const docPoint = this.screenToDocument(p)
    if (!docPoint) return

    this.strokes.push(docPoint)
    this.drawCoveragePoint(docPoint)
    this.needsRedraw = true
  }

  onPointerUp() {
    this.isDrawing = false
  }

  private pointInRect(p: Point, rect: UIButton) {
    return p.x >= rect.x && p.x <= rect.x + rect.width &&
           p.y >= rect.y && p.y <= rect.y + rect.height
  }

  /* =======================
     Document loading
     ======================= */

  private loadDocument(src: string) {
    this.docImage.onload = () => {
      this.imageLoaded = true

      // Match document resolution
      this.coverageCanvas.width = this.docImage.width
      this.coverageCanvas.height = this.docImage.height
      this.coverageCtx.clearRect(
        0,
        0,
        this.coverageCanvas.width,
        this.coverageCanvas.height
      )

      this.computeLayout()
      this.needsRedraw = true
      // this.redrawAll()
    }
    this.docImage.src = src
  }



  /* =======================
     Layout & transforms
     ======================= */

  private computeLayout() {
    const canvas = this.docLayer.canvas

    const scale = Math.min(
      this.docLayer.width / this.docImage.width,
      this.docLayer.height / this.docImage.height
    )

    const drawWidth = this.docImage.width * scale
    const drawHeight = this.docImage.height * scale

    // const offsetX = (canvas.width - drawWidth) / 2
    // const offsetY = (canvas.height - drawHeight) / 2
    const offsetX = (this.docLayer.width - drawWidth) / 2
    const offsetY = (this.docLayer.height - drawHeight) / 2

    this.layout = { scale, offsetX, offsetY, drawWidth, drawHeight }

    console.log(
  "canvas.width:", canvas.width,
  "css width:", canvas.getBoundingClientRect().width
)
console.log(
  "layout width:", this.docLayer.width,
  "canvas width:", this.docLayer.canvas.width
)


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
    return {
      x: p.x * drawWidth + offsetX,
      y: p.y * drawHeight + offsetY,
    }
  }

  /* =======================
     Rendering
     ======================= */

  private redrawAll() {
    this.docLayer.clear()
    this.redactionLayer.clear()
    this.uiLayer.clear()

    this.drawDocument()
    this.drawRedactions()
    this.drawUI()
  }

  private drawDocument() {
    const ctx = this.docLayer.ctx
    const { offsetX, offsetY, drawWidth, drawHeight } = this.layout

    ctx.drawImage(this.docImage, offsetX, offsetY, drawWidth, drawHeight)

    // debug border
    ctx.strokeStyle = "red"
    ctx.lineWidth = 2
    ctx.strokeRect(offsetX, offsetY, drawWidth, drawHeight)
  }

  private drawRedactions() {
    const ctx = this.redactionLayer.ctx
    ctx.fillStyle = this.markerColor

    for (const p of this.strokes) {
      const screen = this.documentToScreen(p)
      const radius = this.markerRadiusNorm * this.layout.drawWidth

      ctx.beginPath()
      ctx.arc(screen.x, screen.y, radius, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  private drawUI() {
    const ctx = this.uiLayer.ctx

    // Prompt
    ctx.fillStyle = "white"
    ctx.font = "20px sans-serif"
    const { offsetX } = this.layout
    ctx.fillText(`REDACT: ${this.prompt}`, offsetX, 30)
   

    // Buttons
    for (const btn of [this.readyButton, this.doneButton]) {
      ctx.fillStyle = "gray"
      ctx.fillRect(btn.x, btn.y, btn.width, btn.height)
      ctx.fillStyle = "black"
      ctx.fillText(btn.text, btn.x + 10, btn.y + 25)
    }

    // Timer
    if (this.isCountingDown) {
      ctx.fillStyle = "yellow"
      ctx.fillText(`Time: ${this.timer.toFixed(1)}`, 300, 70)
    }

    // Score display if not counting down
    if (!this.isCountingDown && this.score > 0) {
      ctx.fillStyle = "lime"
      ctx.fillText(`Score: ${this.score}`, 450, 70)
    }
  }

  private drawCoveragePoint(p: StrokePoint) {
    const ctx = this.coverageCtx
    const r = this.markerRadiusNorm * this.coverageCanvas.width

    ctx.fillStyle = "white"
    ctx.beginPath()
    ctx.arc(
      p.x * this.coverageCanvas.width,
      p.y * this.coverageCanvas.height,
      r,
      0,
      Math.PI * 2
    )
    ctx.fill()
  }


  /* =======================
     Scoring
     ======================= */

  private scoreRedaction(mask: RedactionMask) {
  const { targetRects } = mask
  const ctx = this.coverageCtx
  const { width: w, height: h } = this.coverageCanvas
  const data = ctx.getImageData(0, 0, w, h).data

  const step = 4 // sampling resolution

  let correct = 0
  let missed = 0
  let falsePositive = 0

  function inTarget(x: number, y: number) {
    return targetRects.some(r =>
      x >= r.x &&
      y >= r.y &&
      x <= r.x + r.width &&
      y <= r.y + r.height
    )
  }

  for (let y = 0; y < h; y += step) {
    for (let x = 0; x < w; x += step) {
      const i = (y * w + x) * 4
      const painted = data[i + 3] > 0

      if (!painted) continue

      const nx = x / w
      const ny = y / h

      if (inTarget(nx, ny)) {
        correct++
      } else {
        falsePositive++
      }
    }
  }

  // Missed pixels inside targetRects
  for (const r of targetRects) {
    const rx0 = Math.floor(r.x * w)
    const ry0 = Math.floor(r.y * h)
    const rx1 = Math.ceil((r.x + r.width) * w)
    const ry1 = Math.ceil((r.y + r.height) * h)

    for (let y = ry0; y < ry1; y += step) {
      for (let x = rx0; x < rx1; x += step) {
        const i = (y * w + x) * 4
        if (data[i + 3] === 0) missed++
      }
    }
  }

  const score =
    correct * 2 -
    falsePositive * 1.5 -
    missed * 3

  return {
    score: Math.max(0, Math.round(score)),
    correct,
    falsePositive,
    missed,
  }
}

private calculateScore() {
  const result = this.scoreRedaction(this.mask)
  this.score = result.score
  console.log("Final score:", this.score)
  console.log("Details:", result)
} 


  // private calculateScore() {
  //   let score = 0
  //   // const radius = this.markerRadiusNorm

  //   // Points for hitting target rects
  //   for (const target of this.mask.targetRects) {
  //     const hits = this.strokes.filter(s =>
  //       s.x >= target.x &&
  //       s.x <= target.x + target.width &&
  //       s.y >= target.y &&
  //       s.y <= target.y + target.height
  //     ).length
  //     score += hits
  //   }

  //   // Penalty for redacting outside target rects
  //   for (const s of this.strokes) {
  //     const inTarget = this.mask.targetRects.some(t =>
  //       s.x >= t.x &&
  //       s.x <= t.x + t.width &&
  //       s.y >= t.y &&
  //       s.y <= t.y + t.height
  //     )
  //     if (!inTarget) score -= 1
  //   }

  //   this.score = Math.max(0, score)
  //   console.log("Final score:", this.score)
  // }
}
