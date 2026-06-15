type Particle = {
  x: number
  y: number
  px: number
  py: number
  life: number
  maxLife: number
}

const canvas = document.getElementById("field") as HTMLCanvasElement
const ctx: CanvasRenderingContext2D = (() => {
  const c = canvas.getContext("2d")
  if (!c) throw new Error("2d context unavailable")
  return c
})()

const DPR = Math.min(window.devicePixelRatio || 1, 2)
let width = 0
let height = 0

function resize() {
  width = Math.max(1, Math.floor(canvas.clientWidth * DPR))
  height = Math.max(1, Math.floor(canvas.clientHeight * DPR))
  canvas.width = width
  canvas.height = height
}
resize()
new ResizeObserver(resize).observe(canvas)

function hash21(x: number, y: number): number {
  let h = Math.sin(x * 127.1 + y * 311.7) * 43758.5453
  h = h - Math.floor(h)
  return h
}

function fade(t: number): number {
  return t * t * (3 - 2 * t)
}

function valueNoise(x: number, y: number): number {
  const xi = Math.floor(x)
  const yi = Math.floor(y)
  const xf = x - xi
  const yf = y - yi
  const a = hash21(xi, yi)
  const b = hash21(xi + 1, yi)
  const c = hash21(xi, yi + 1)
  const d = hash21(xi + 1, yi + 1)
  const u = fade(xf)
  const v = fade(yf)
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v
}

function flow(x: number, y: number, t: number): number {
  const nx = x * 0.0035
  const ny = y * 0.0035
  const n = valueNoise(nx + t * 0.05, ny - t * 0.04)
  return n * Math.PI * 2.2
}

const PARTICLE_COUNT = 220
const particles: Particle[] = []

function seed(p: Particle) {
  p.x = Math.random() * width
  p.y = Math.random() * height
  p.px = p.x
  p.py = p.y
  p.maxLife = 80 + Math.random() * 140
  p.life = Math.random() * p.maxLife
}

for (let i = 0; i < PARTICLE_COUNT; i++) {
  const p: Particle = { x: 0, y: 0, px: 0, py: 0, life: 0, maxLife: 1 }
  seed(p)
  particles.push(p)
}

const STEP = 1.4 * DPR
const start = performance.now()

function frame() {
  const t = (performance.now() - start) / 1000

  ctx.fillStyle = "rgba(0, 0, 0, 0.08)"
  ctx.fillRect(0, 0, width, height)

  ctx.lineWidth = Math.max(1, DPR * 0.6)

  for (const p of particles) {
    const angle = flow(p.x, p.y, t)
    p.px = p.x
    p.py = p.y
    p.x += Math.cos(angle) * STEP
    p.y += Math.sin(angle) * STEP
    p.life++

    const off =
      p.x < -8 ||
      p.x > width + 8 ||
      p.y < -8 ||
      p.y > height + 8 ||
      p.life >= p.maxLife

    if (off) {
      seed(p)
      continue
    }

    const fadeIn = Math.min(1, p.life / 18)
    const fadeOut = Math.min(1, (p.maxLife - p.life) / 25)
    const alpha = 0.18 * Math.min(fadeIn, fadeOut)

    ctx.strokeStyle = `rgba(245, 245, 250, ${alpha})`
    ctx.beginPath()
    ctx.moveTo(p.px, p.py)
    ctx.lineTo(p.x, p.y)
    ctx.stroke()
  }

  requestAnimationFrame(frame)
}

requestAnimationFrame(frame)
