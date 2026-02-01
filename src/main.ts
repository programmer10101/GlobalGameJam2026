import { CanvasLayer } from "./rendering/CanvasLayer"
import { Game } from "./game/Game"
import { MenuScene } from "./game/MenuScene"
import { GameScene } from "./game/GameScene"
import { masks } from "./data/masks" // move mask data to separate file

// --- Canvas Layers ---
const docLayer = new CanvasLayer("doc")
const redactionLayer = new CanvasLayer("redaction")
const uiLayer = new CanvasLayer("ui")

// --- Game Manager ---
const game = new Game(uiLayer.canvas)

function resize() {
  const w = window.innerWidth
  const h = window.innerHeight
  docLayer.resize(w, h)
  redactionLayer.resize(w, h)
  uiLayer.resize(w, h)
  game.sceneManager.currentScene?.onResize?.()
}
window.addEventListener("resize", resize)
resize()

// --- Scene Setup ---
let menuScene: MenuScene
let gameScene: GameScene

// Initialize GameScene but don't switch yet
gameScene = new GameScene(docLayer, redactionLayer, uiLayer, masks, () => {
  game.sceneManager.set(menuScene)
})

// Initialize MenuScene
menuScene = new MenuScene(uiLayer, () => {
  gameScene.resetGame() // reset scores and masks
  game.sceneManager.set(gameScene)
})

// Start in menu
game.sceneManager.set(menuScene)
game.start()

// --- Keydown routing ---
window.addEventListener("keydown", (e) => {
  game.sceneManager.currentScene?.onKeyDown?.(e)
})
