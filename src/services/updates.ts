type Listener=()=>void

export function watchUpdates(url:string,scope:string,enabled:boolean) {
  let registration:ServiceWorkerRegistration|undefined
  let requested:ServiceWorker|undefined
  let waiting=false
  let timeout:number|undefined
  let previousController=navigator.serviceWorker?.controller
  const listeners=new Set<Listener>()
  const notify=(value:boolean)=>{
    waiting=value
    listeners.forEach(listener=>listener())
  }

  if (enabled && 'serviceWorker' in navigator) {
    const workers=navigator.serviceWorker
    workers.addEventListener('controllerchange',()=>{
      const current=workers.controller
      if (requested && current!==previousController &&
          (current===requested || requested.state==='activated')) {
        requested=undefined
        window.clearTimeout(timeout)
        window.location.reload()
      } else {
        previousController=current
        // Another tab may have activated the update. Offer a local reload without forcing one.
        if (current && !registration?.waiting && waiting) notify(true)
      }
    })
    void workers.register(url,{scope,updateViaCache:'none'}).then(registered=>{
      registration=registered
      const status=()=>{if (registered.waiting && workers.controller) notify(true)}
      const watch=()=>{
        const worker=registered.installing
        worker?.addEventListener('statechange',()=>{if (worker.state==='installed') status()})
      }
      registered.addEventListener('updatefound',watch)
      watch()
      status()
      window.addEventListener('online',()=>void registered.update().catch(()=>{}))
      document.addEventListener('visibilitychange',()=>{
        if (document.visibilityState==='visible') void registered.update().catch(()=>{})
      })
    }).catch(()=>{})
  }
  return {
    subscribe(listener:Listener) {listeners.add(listener);return ()=>{listeners.delete(listener)}},
    getSnapshot:()=>waiting,
    apply(onFailure:()=>void) {
      const worker=registration?.waiting
      if (!worker) {if (waiting) window.location.reload(); else onFailure();return}
      if (requested) return
      requested=worker
      previousController=navigator.serviceWorker.controller
      timeout=window.setTimeout(()=>{requested=undefined;onFailure()},10000)
      worker.postMessage({type:'SKIP_WAITING'})
    },
  }
}
