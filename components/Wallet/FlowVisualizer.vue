<template>
  <div class="flow-visualizer">
    <canvas ref="canvasRef" class="particles-canvas"></canvas>
    <slot />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch } from 'vue'
import { useWalletStore } from '~/stores/wallet'

const canvasRef = ref<HTMLCanvasElement | null>(null)
const walletStore = useWalletStore()

let animationFrameId: number
let particles: Array<{ x: number, y: number, vx: number, vy: number, color: string, life: number }> = []

const colors = ['#4A90E2', '#F5A623', '#7ED321', '#F8E71C']

const resizeCanvas = () => {
  if (canvasRef.value) {
    const parent = canvasRef.value.parentElement
    if (parent) {
      canvasRef.value.width = parent.clientWidth
      canvasRef.value.height = parent.clientHeight
    }
  }
}

const animate = () => {
  if (!canvasRef.value) return
  const ctx = canvasRef.value.getContext('2d')
  if (!ctx) return
  
  const width = canvasRef.value.width
  const height = canvasRef.value.height

  ctx.clearRect(0, 0, width, height)
  
  // Velocity modifier from store
  const speed = walletStore.flowVelocity * 5

  // Spawn new particles
  if (Math.random() < walletStore.flowVelocity) {
    particles.push({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * speed,
      vy: (Math.random() - 0.5) * speed,
      color: colors[Math.floor(Math.random() * colors.length)],
      life: 1.0
    })
  }

  // Update & Draw
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i]
    p.x += p.vx
    p.y += p.vy
    p.life -= 0.01

    if (p.life <= 0 || p.x < 0 || p.x > width || p.y < 0 || p.y > height) {
      particles.splice(i, 1)
      continue
    }

    ctx.beginPath()
    ctx.arc(p.x, p.y, 2, 0, Math.PI * 2)
    ctx.fillStyle = p.color
    ctx.globalAlpha = p.life * 0.5 // subtle background flow
    ctx.fill()
  }
  ctx.globalAlpha = 1.0

  animationFrameId = requestAnimationFrame(animate)
}

onMounted(() => {
  window.addEventListener('resize', resizeCanvas)
  resizeCanvas()
  animate()
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', resizeCanvas)
  cancelAnimationFrame(animationFrameId)
})
</script>

<style scoped>
.flow-visualizer {
  position: relative;
  width: 100%;
  height: 100%;
}
.particles-canvas {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 0; /* Behind other content */
}
</style>
