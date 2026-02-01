import { SceneManager } from "./SceneManager"
// import type { Scene } from "./Scene"
import { Input } from "../input/Input"
// import type { Point } from "../input/Input"

export class Game {
  sceneManager = new SceneManager()
  lastTime = performance.now()

  constructor(target: HTMLElement) {
new Input(
  target,
  (p) => this.sceneManager.onPointerDown(p),
  (p) => this.sceneManager.onPointerMove(p),
  (p) => this.sceneManager.onPointerUp({ x: 0, y: 0 })
)

  }

  start() {
    requestAnimationFrame(this.loop)
  }

  loop = (time: number) => {
    const dt = (time - this.lastTime) / 1000
    this.lastTime = time

    this.sceneManager.update(dt)
    this.sceneManager.render()

    requestAnimationFrame(this.loop)
  }
}
