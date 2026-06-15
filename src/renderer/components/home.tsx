import { useEffect, useRef, useState } from "react"
import { getCwd, openExternal, notifyMainReady } from "@/lib/api"

const VERT = `#version 300 es
in vec2 a_pos;
void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }
`

const FRAG = `#version 300 es
precision highp float;

uniform vec2  uResolution;
uniform float uTime;
uniform vec2  uMouse;
uniform float uMouseStrength;

out vec4 outColor;

float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash21(i);
  float b = hash21(i + vec2(1.0, 0.0));
  float c = hash21(i + vec2(0.0, 1.0));
  float d = hash21(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  mat2 rot = mat2(0.80, 0.60, -0.60, 0.80);
  for (int i = 0; i < 6; i++) {
    v += a * noise(p);
    p = rot * p * 2.02;
    a *= 0.5;
  }
  return v;
}

// Iridescent cosine palette (Inigo Quilez)
vec3 palette(float t) {
  vec3 a = vec3(0.50, 0.40, 0.55);
  vec3 b = vec3(0.55, 0.50, 0.50);
  vec3 c = vec3(1.00, 1.10, 0.90);
  vec3 d = vec3(0.00, 0.18, 0.42);
  return a + b * cos(6.28318 * (c * t + d));
}

void main() {
  vec2 res = uResolution;
  vec2 uv  = (gl_FragCoord.xy - 0.5 * res) / min(res.x, res.y);
  vec2 mp  = (uMouse - 0.5 * res) / min(res.x, res.y);

  float t = uTime * 0.07;

  // Gentle radial pull toward the cursor
  vec2 toMouse = uv - mp;
  float md = length(toMouse);
  vec2 warp = -toMouse * exp(-md * 3.5) * 0.35 * uMouseStrength;

  vec2 p = uv * 1.6 + warp;

  // Domain warping (Quilez)
  vec2 q = vec2(
    fbm(p + vec2(0.0,  t)),
    fbm(p + vec2(5.2, -t + 1.3))
  );

  vec2 r = vec2(
    fbm(p + 4.0 * q + vec2(1.7 + t * 1.3, 9.2)),
    fbm(p + 4.0 * q + vec2(8.3, 2.8 - t * 0.9))
  );

  float f = fbm(p + 4.0 * r);

  // Iridescent body
  float hue = f + length(r) * 0.45 + t * 1.2;
  vec3 col = palette(hue);

  // Sculpt highlights/shadows
  float lum = smoothstep(0.10, 1.10, length(q));
  col *= 0.35 + 1.15 * lum;

  // Specular wisps along ridges
  float ridge = pow(smoothstep(0.55, 0.95, f), 6.0);
  col += vec3(1.0, 0.92, 0.78) * ridge * 0.55;

  // Cool shadow base
  vec3 deep = vec3(0.015, 0.012, 0.030);
  col = mix(deep, col, smoothstep(0.05, 0.65, length(q) + f * 0.4));

  // Gamma & contrast lift
  col = pow(col, vec3(1.15));
  col = (col - 0.5) * 1.10 + 0.5;

  // Vignette
  float v = 1.0 - smoothstep(0.55, 1.45, length(uv));
  col *= mix(0.35, 1.0, v);

  // Film grain
  float g = hash21(gl_FragCoord.xy + fract(uTime * 60.0)) - 0.5;
  col += g * 0.025;

  outColor = vec4(col, 1.0);
}
`

function compile(gl: WebGL2RenderingContext, type: number, src: string) {
  const sh = gl.createShader(type)!
  gl.shaderSource(sh, src)
  gl.compileShader(sh)
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(sh)
    gl.deleteShader(sh)
    throw new Error("shader compile: " + log)
  }
  return sh
}

function program(gl: WebGL2RenderingContext) {
  const v = compile(gl, gl.VERTEX_SHADER, VERT)
  const f = compile(gl, gl.FRAGMENT_SHADER, FRAG)
  const p = gl.createProgram()!
  gl.attachShader(p, v)
  gl.attachShader(p, f)
  gl.linkProgram(p)
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(p)
    throw new Error("link: " + log)
  }
  return p
}

export function Home() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [cwd, setCwd] = useState<string | null>(null)

  useEffect(() => {
    getCwd().then(setCwd)
    notifyMainReady()
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const gl = canvas.getContext("webgl2", {
      antialias: false,
      premultipliedAlpha: false,
    })
    if (!gl) {
      // eslint-disable-next-line no-console
      console.error("webgl2 unavailable")
      return
    }

    const prog = program(gl)
    gl.useProgram(prog)

    const quad = new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1])
    const vbo = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo)
    gl.bufferData(gl.ARRAY_BUFFER, quad, gl.STATIC_DRAW)
    const aPos = gl.getAttribLocation(prog, "a_pos")
    gl.enableVertexAttribArray(aPos)
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0)

    const uRes = gl.getUniformLocation(prog, "uResolution")
    const uTime = gl.getUniformLocation(prog, "uTime")
    const uMouse = gl.getUniformLocation(prog, "uMouse")
    const uMouseStrength = gl.getUniformLocation(prog, "uMouseStrength")

    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    let width = 0
    let height = 0
    let mouseX = 0
    let mouseY = 0
    let mouseTargetStrength = 0
    let mouseStrength = 0

    const resize = () => {
      const w = canvas.clientWidth
      const h = canvas.clientHeight
      width = Math.max(1, Math.floor(w * dpr))
      height = Math.max(1, Math.floor(h * dpr))
      canvas.width = width
      canvas.height = height
      gl.viewport(0, 0, width, height)
    }

    const onMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect()
      mouseX = (e.clientX - rect.left) * dpr
      mouseY = (rect.height - (e.clientY - rect.top)) * dpr
      mouseTargetStrength = 1
    }
    const onLeave = () => {
      mouseTargetStrength = 0
    }

    resize()
    mouseX = width * 0.5
    mouseY = height * 0.5

    const ro = new ResizeObserver(resize)
    ro.observe(canvas)
    canvas.addEventListener("mousemove", onMove)
    canvas.addEventListener("mouseleave", onLeave)

    const start = performance.now()
    let raf = 0
    const draw = () => {
      const t = (performance.now() - start) / 1000
      mouseStrength += (mouseTargetStrength - mouseStrength) * 0.04
      gl.uniform2f(uRes, width, height)
      gl.uniform1f(uTime, t)
      gl.uniform2f(uMouse, mouseX, mouseY)
      gl.uniform1f(uMouseStrength, mouseStrength)
      gl.drawArrays(gl.TRIANGLES, 0, 6)
      raf = requestAnimationFrame(draw)
    }
    raf = requestAnimationFrame(draw)

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      canvas.removeEventListener("mousemove", onMove)
      canvas.removeEventListener("mouseleave", onLeave)
      gl.deleteBuffer(vbo)
      gl.deleteProgram(prog)
    }
  }, [])

  return (
    <main className="relative h-full w-full overflow-hidden bg-black text-zinc-100">
      <canvas
        ref={canvasRef}
        className="absolute inset-0 h-full w-full block"
      />

      {/* Top-left whisper */}
      <div className="pointer-events-none absolute top-6 left-8 select-none">
        <div className="font-mono text-[10px] uppercase tracking-[0.35em] text-white/40">
          obsidian · tide
        </div>
      </div>

      {/* Top-right index */}
      <div className="pointer-events-none absolute top-6 right-8 select-none text-right">
        <div className="font-mono text-[10px] uppercase tracking-[0.35em] text-white/40">
          001 / shader
        </div>
      </div>

      {/* Centered display */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center select-none">
        <div className="text-center px-8">
          <div className="font-mono text-[10px] uppercase tracking-[0.5em] text-white/50 mb-6">
            stacks · desktop
          </div>
          <h1
            className="font-display text-[clamp(3rem,9vw,8.5rem)] leading-[0.95] tracking-tight text-white"
            style={{
              fontStyle: "italic",
              fontWeight: 300,
              textShadow: "0 2px 40px rgba(0,0,0,0.5)",
              mixBlendMode: "screen",
            }}
          >
            a quiet&nbsp;
            <span className="font-display" style={{ fontWeight: 400 }}>
              machine
            </span>
          </h1>
          <div className="mt-8 font-mono text-[11px] tracking-[0.2em] text-white/55">
            move the cursor — perturb the field
          </div>
        </div>
      </div>

      {/* Bottom-left source */}
      <div className="pointer-events-none absolute bottom-6 left-8 max-w-[60vw]">
        <div className="font-mono text-[9px] uppercase tracking-[0.35em] text-white/35 mb-1.5">
          source
        </div>
        <div className="font-mono text-[11px] text-white/70 truncate">
          {cwd ?? " "}
        </div>
      </div>

      {/* Bottom-right attribution */}
      <div className="absolute bottom-6 right-8 font-mono text-[10px] tracking-[0.3em] uppercase">
        <a
          href="https://tauri.app/"
          onClick={(e) => {
            e.preventDefault()
            openExternal("https://tauri.app/")
          }}
          className="text-white/45 hover:text-white transition-colors"
        >
          built · with · tauri
        </a>
      </div>

      {/* Top vignette gradient to anchor titlebar */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-24"
        style={{
          background:
            "linear-gradient(to bottom, rgba(0,0,0,0.55), rgba(0,0,0,0))",
        }}
      />
      {/* Bottom vignette gradient */}
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-32"
        style={{
          background:
            "linear-gradient(to top, rgba(0,0,0,0.55), rgba(0,0,0,0))",
        }}
      />
    </main>
  )
}
