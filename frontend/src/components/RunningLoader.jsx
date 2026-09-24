import { useEffect, useRef } from 'react'
import lottie from 'lottie-web/build/player/lottie_light'
import timerAnimation from '../assets/timer-loader.json'

export default function RunningLoader({ label = 'Loading…' }) {
  const containerRef = useRef(null)

  useEffect(() => {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const anim = lottie.loadAnimation({
      container: containerRef.current,
      renderer: 'svg',
      loop: true,
      autoplay: !reduceMotion,
      animationData: timerAnimation,
    })
    if (reduceMotion) anim.goToAndStop(0, true)
    return () => anim.destroy()
  }, [])

  return (
    <div className="running-loader" role="status" aria-live="polite">
      <div ref={containerRef} className="running-loader-figure" aria-hidden="true" />
      {label && <p className="running-loader-label">{label}</p>}
    </div>
  )
}
