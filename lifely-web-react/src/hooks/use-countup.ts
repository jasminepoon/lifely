import { useState, useEffect, useRef } from 'react'

interface UseCountupOptions {
  start?: number
  end: number
  duration?: number
  delay?: number
  easing?: (t: number) => number
}

// Ease out cubic
const defaultEasing = (t: number) => 1 - Math.pow(1 - t, 3)

export function useCountup({
  start = 0,
  end,
  duration = 2000,
  delay = 0,
  easing = defaultEasing,
}: UseCountupOptions) {
  const [value, setValue] = useState(start)
  const [isCounting, setIsCounting] = useState(false)
  const startTimeRef = useRef<number>(0)
  const animationRef = useRef<number>(0)

  useEffect(() => {
    const timeout = setTimeout(() => {
      setIsCounting(true)
      startTimeRef.current = performance.now()

      const animate = (now: number) => {
        const elapsed = now - startTimeRef.current
        const progress = Math.min(elapsed / duration, 1)
        const easedProgress = easing(progress)
        const currentValue = start + (end - start) * easedProgress

        setValue(Math.round(currentValue))

        if (progress < 1) {
          animationRef.current = requestAnimationFrame(animate)
        } else {
          setIsCounting(false)
        }
      }

      animationRef.current = requestAnimationFrame(animate)
    }, delay)

    return () => {
      clearTimeout(timeout)
      cancelAnimationFrame(animationRef.current)
    }
  }, [start, end, duration, delay, easing])

  return { value, isCounting }
}
