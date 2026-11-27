import {useEffect} from 'react'

export function useKeyboard() {
  useEffect(()=>{
    const viewport=window.visualViewport
    if (!viewport) return
    const sync=()=>{
      const field=document.activeElement
      const editing=field instanceof HTMLTextAreaElement || (field instanceof HTMLInputElement &&
        ['text','number','search','email','url','tel','password'].includes(field.type))
      const open=editing && Math.abs(viewport.scale-1)<0.01 &&
        document.documentElement.clientHeight-viewport.height>140
      document.documentElement.classList.toggle('keyboard-open',open)
      if (open && field instanceof HTMLElement) {
        const rect=field.getBoundingClientRect()
        if (rect.bottom>viewport.height+viewport.offsetTop-12) field.scrollIntoView({block:'center'})
      }
    }
    viewport.addEventListener('resize',sync)
    document.addEventListener('focusin',sync)
    document.addEventListener('focusout',sync)
    return ()=>{
      viewport.removeEventListener('resize',sync)
      document.removeEventListener('focusin',sync)
      document.removeEventListener('focusout',sync)
      document.documentElement.classList.remove('keyboard-open')
    }
  },[])
}
