import {createRoot} from 'react-dom/client'
import {App} from './App'
import {watchUpdates} from './services/updates'
import './styles.css'

const scope=new URL(import.meta.env.BASE_URL,window.location.href)
const updates=watchUpdates(new URL('sw.js',scope).href,scope.href,import.meta.env.PROD)
createRoot(document.getElementById('root')!).render(<App updates={updates}/>)
