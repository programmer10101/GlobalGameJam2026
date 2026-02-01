export class CanvasLayer {
  canvas: HTMLCanvasElement
  ctx: CanvasRenderingContext2D
  width = 0
  height = 0
  dpr = window.devicePixelRatio || 1

  constructor(id: string) {
    const canvas = document.getElementById(id) as HTMLCanvasElement
    const ctx = canvas.getContext("2d")

    if (!ctx) throw new Error("Canvas not supported")

    this.canvas = canvas
    this.ctx = ctx
  }

  resize(width: number, height: number) {
    this.width = width
    this.height = height

    this.canvas.width = Math.floor(width * this.dpr)
    this.canvas.height = Math.floor(height * this.dpr)

    this.canvas.style.width = `${width}px`
    this.canvas.style.height = `${height}px`

    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0)
  }

  clear() {
    this.ctx.clearRect(0, 0, this.width, this.height)
  }
}
