export type DocumentLayout = {
  x: number
  y: number
  width: number
  height: number
}

export class DocumentRenderer {
  image: HTMLImageElement
  layout: DocumentLayout | null = null

  constructor(imageSrc: string) {
    this.image = new Image()
    this.image.src = imageSrc
  }

  async load() {
    if (this.image.complete) return
    await new Promise<void>((resolve, reject) => {
      this.image.onload = () => resolve()
      this.image.onerror = reject
    })
  }

  computeLayout(canvasWidth: number, canvasHeight: number): DocumentLayout {
    const imgW = this.image.width
    const imgH = this.image.height

    const scale = Math.min(
      canvasWidth / imgW,
      canvasHeight / imgH
    )

    const width = imgW * scale
    const height = imgH * scale

    const x = (canvasWidth - width) / 2
    const y = (canvasHeight - height) / 2

    this.layout = { x, y, width, height }
    return this.layout
  }

  draw(ctx: CanvasRenderingContext2D) {
    if (!this.layout) return

    const { x, y, width, height } = this.layout
    ctx.drawImage(this.image, x, y, width, height)
  }

  // Convert screen coords → document normalized (0-1)
  screenToDocument(p: { x: number; y: number }) {
    if (!this.layout) return null
    const { x, y, width, height } = this.layout
    return {
      x: (p.x - x) / width,
      y: (p.y - y) / height,
    }
  }
}
