// /src/editor/TargetRectEditor.ts
import { CanvasLayer } from "../rendering/CanvasLayer"
import type { Point } from "../data/types"

type Rect = {
  x: number
  y: number
  width: number
  height: number
}

export class TargetRectEditor {
  private canvasLayer: CanvasLayer
  private image = new Image()
  private imageLoaded = false

  private layout = { scale: 1, offsetX: 0, offsetY: 0, drawWidth: 0, drawHeight: 0 }

  private rects: Rect[] = []
  private isDrawing = false
  private startPoint: Point | null = null
  private currentRect: Rect | null = null

  private saveButton: { x: number, y: number, width: number, height: number, text: string } = {
    x: 20, y: 20, width: 100, height: 40, text: "Save JSON"
  }

  constructor(canvasId: string, imageSrc: string) {
    this.canvasLayer = new CanvasLayer(canvasId)
    this.loadImage(imageSrc)

    // Mouse events
    const canvas = this.canvasLayer.canvas
    canvas.addEventListener("mousedown", (e) => this.onPointerDown(this.getMousePos(e)))
    canvas.addEventListener("mousemove", (e) => this.onPointerMove(this.getMousePos(e)))
    canvas.addEventListener("mouseup", () => this.onPointerUp())
    window.addEventListener("resize", () => this.onResize())
    this.onResize()
    requestAnimationFrame(this.loop)
  }

  private loadImage(src: string) {
    this.image.onload = () => {
      this.imageLoaded = true
      this.computeLayout()
    }
    this.image.src = src
  }

  private computeLayout() {
    const canvas = this.canvasLayer.canvas
    const scale = Math.min(canvas.width / this.image.width, canvas.height / this.image.height)
    const drawWidth = this.image.width * scale
    const drawHeight = this.image.height * scale
    const offsetX = (canvas.width - drawWidth) / 2
    const offsetY = (canvas.height - drawHeight) / 2
    this.layout = { scale, offsetX, offsetY, drawWidth, drawHeight }
  }

  private onResize() {
    this.canvasLayer.resize(window.innerWidth, window.innerHeight)
    if (this.imageLoaded) this.computeLayout()
  }

  private getMousePos(e: MouseEvent): Point {
    const rect = this.canvasLayer.canvas.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  private screenToNormalized(p: Point): Point {
    const { offsetX, offsetY, drawWidth, drawHeight } = this.layout
    const x = (p.x - offsetX) / drawWidth
    const y = (p.y - offsetY) / drawHeight
    return { x, y }
  }

  private onPointerDown(p: Point) {
    // Check if Save button clicked
    if (this.pointInRect(p, this.saveButton)) {
      this.saveRects()
      return
    }

    if (!this.imageLoaded) return
    this.isDrawing = true
    this.startPoint = p
  }

  private onPointerMove(p: Point) {
    if (!this.isDrawing || !this.startPoint) return
    const start = this.screenToNormalized(this.startPoint)
    const end = this.screenToNormalized(p)

    const x = Math.min(start.x, end.x)
    const y = Math.min(start.y, end.y)
    const width = Math.abs(end.x - start.x)
    const height = Math.abs(end.y - start.y)
    this.currentRect = { x, y, width, height }
  }

  private onPointerUp() {
    if (this.currentRect) this.rects.push(this.currentRect)
    this.isDrawing = false
    this.startPoint = null
    this.currentRect = null
  }

  private pointInRect(p: Point, rect: { x: number, y: number, width: number, height: number }) {
    return p.x >= rect.x && p.x <= rect.x + rect.width &&
           p.y >= rect.y && p.y <= rect.y + rect.height
  }

  private saveRects() {
    const dataStr = JSON.stringify(this.rects, null, 2)
    const blob = new Blob([dataStr], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "targetRects.json"
    a.click()
    URL.revokeObjectURL(url)
  }

  private loop = () => {
    this.redraw()
    requestAnimationFrame(this.loop)
  }

  private redraw() {
    const ctx = this.canvasLayer.ctx
    ctx.clearRect(0, 0, this.canvasLayer.canvas.width, this.canvasLayer.canvas.height)

    if (this.imageLoaded) {
      const { offsetX, offsetY, drawWidth, drawHeight } = this.layout
      ctx.drawImage(this.image, offsetX, offsetY, drawWidth, drawHeight)
    }

    // Draw existing rects
    ctx.strokeStyle = "red"
    ctx.lineWidth = 2
    for (const r of this.rects) {
      const screen = this.normalizedToScreen(r)
      ctx.strokeRect(screen.x, screen.y, screen.width, screen.height)
    }

    // Draw current rect
    if (this.currentRect) {
      const screen = this.normalizedToScreen(this.currentRect)
      ctx.strokeStyle = "yellow"
      ctx.strokeRect(screen.x, screen.y, screen.width, screen.height)
    }

    // Draw Save button
    ctx.fillStyle = "gray"
    ctx.fillRect(this.saveButton.x, this.saveButton.y, this.saveButton.width, this.saveButton.height)
    ctx.fillStyle = "black"
    ctx.font = "16px sans-serif"
    ctx.fillText(this.saveButton.text, this.saveButton.x + 10, this.saveButton.y + 25)
  }

  private normalizedToScreen(r: Rect) {
    const { offsetX, offsetY, drawWidth, drawHeight } = this.layout
    return {
      x: r.x * drawWidth + offsetX,
      y: r.y * drawHeight + offsetY,
      width: r.width * drawWidth,
      height: r.height * drawHeight,
    }
  }
}
