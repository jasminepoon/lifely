import { useEffect, useRef } from 'react'

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  size: number
  opacity: number
  color: string
}

const COLORS = ['#00D4FF', '#00FF88', '#FF6B6B', '#FFD93D']

export function useParticles(canvasRef: React.RefObject<HTMLCanvasElement | null>) {
  const particlesRef = useRef<Particle[]>([])
  const animationRef = useRef<number>(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Set canvas size
    const resize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }
    resize()
    window.addEventListener('resize', resize)

    // Initialize particles
    const particleCount = Math.min(50, Math.floor(window.innerWidth / 30))
    particlesRef.current = Array.from({ length: particleCount }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      vx: (Math.random() - 0.5) * 0.5,
      vy: (Math.random() - 0.5) * 0.5,
      size: Math.random() * 3 + 1,
      opacity: Math.random() * 0.5 + 0.1,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
    }))

    // Animation loop
    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      particlesRef.current.forEach((p) => {
        // Update position
        p.x += p.vx
        p.y += p.vy

        // Wrap around edges
        if (p.x < 0) p.x = canvas.width
        if (p.x > canvas.width) p.x = 0
        if (p.y < 0) p.y = canvas.height
        if (p.y > canvas.height) p.y = 0

        // Draw particle
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
        ctx.fillStyle = p.color
        ctx.globalAlpha = p.opacity
        ctx.fill()
      })

      // Draw connections
      ctx.globalAlpha = 0.1
      ctx.strokeStyle = '#00D4FF'
      ctx.lineWidth = 0.5
      particlesRef.current.forEach((p1, i) => {
        particlesRef.current.slice(i + 1).forEach((p2) => {
          const dx = p1.x - p2.x
          const dy = p1.y - p2.y
          const dist = Math.sqrt(dx * dx + dy * dy)
          if (dist < 150) {
            ctx.beginPath()
            ctx.moveTo(p1.x, p1.y)
            ctx.lineTo(p2.x, p2.y)
            ctx.globalAlpha = 0.1 * (1 - dist / 150)
            ctx.stroke()
          }
        })
      })

      animationRef.current = requestAnimationFrame(animate)
    }

    animate()

    return () => {
      window.removeEventListener('resize', resize)
      cancelAnimationFrame(animationRef.current)
    }
  }, [canvasRef])
}

export function ParticlesBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  useParticles(canvasRef)

  return (
    <canvas
      ref={canvasRef}
      className="particles-bg"
      aria-hidden="true"
    />
  )
}
