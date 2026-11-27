import {useEffect, useState} from 'react'
export function useTimer() {
  const [end, setEnd] = useState(0)
  const [remaining, setRemaining] = useState(0)
  useEffect(() => {
    if (!end) { setRemaining(0); return }
    const tick = () => setRemaining(Math.max(0,Math.ceil((end - Date.now()) / 1000)))
    tick()
    const timer = window.setInterval(tick,250)
    return () => window.clearInterval(timer)
  },[end])
  return {remaining, start:(seconds:number) => setEnd(Date.now() + seconds * 1000), stop:() => setEnd(0)}
}
