import type { Scene } from "./Scene"
import type { CanvasLayer } from "../rendering/CanvasLayer"

export class MenuScene implements Scene {
  private ui: CanvasLayer
  private onStart: () => void

  constructor(ui: CanvasLayer, onStart: () => void) {
    this.ui = ui
    this.onStart = onStart
  }

  update() {}

  render() {
    const ctx = this.ui.ctx
    this.ui.clear()

    ctx.fillStyle = "white"
    ctx.font = "32px monospace"
    ctx.textAlign = "center"
    ctx.fillText(
      "REDACT-TED",
      this.ui.width / 2,
      this.ui.height / 2 - 40
    )

    ctx.font = "20px monospace"
    ctx.fillText(
      "Click to Begin",
      this.ui.width / 2,
      this.ui.height / 2 + 20
    )
  }

  onPointerDown() {
    this.onStart()
  }
}
