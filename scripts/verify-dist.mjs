import assert from 'node:assert/strict'
import {readdir,readFile} from 'node:fs/promises'
import {resolve} from 'node:path'

const dist=resolve('dist')
const required=['index.html','manifest.webmanifest','sw.js','icon.svg','icon-180.png','icon-192.png','icon-512.png','icon-maskable-512.png']
const root=await readdir(dist,{withFileTypes:true})
const allowedRoot=new Set([...required,'assets','.nojekyll'])
for (const entry of root) {
  assert(!entry.isSymbolicLink(),'成果物にシンボリックリンクがあります。')
  if (!allowedRoot.has(entry.name)) assert(entry.isFile() && /^workbox-[a-f0-9]+\.js$/.test(entry.name),'成果物のルートに想定外のファイルがあります。')
  else assert(entry.name==='assets' ? entry.isDirectory() : entry.isFile(),'成果物の種類が無効です。')
}
for (const name of required) assert(root.some(entry=>entry.name===name),'不足している成果物 '+name)
const assets=await readdir(resolve(dist,'assets'),{withFileTypes:true})
assert(assets.length>=2)
for (const entry of assets) assert(entry.isFile() && /^[a-z0-9_-]+-[a-z0-9_-]{8,}\.(js|css)$/i.test(entry.name),'想定外のアセットがあります。')

const basePath='/' + (process.env.PAGES_BASE_PATH ?? 'iron-compass').split('/').filter(Boolean).map(part=>part+'/').join('')
const url=new URL(basePath,'https://example.invalid')
const html=await readFile(resolve(dist,'index.html'),'utf8')
for (const [,href] of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
  const target=new URL(href,url)
  assert(target.href.startsWith(url.href),'HTMLに配信範囲外を指すパスがあります。')
  const path=target.pathname.slice(url.pathname.length)
  await readFile(resolve(dist,path))
}
assert(html.includes('rel="apple-touch-icon"') && html.includes('viewport-fit=cover'))
const manifest=JSON.parse(await readFile(resolve(dist,'manifest.webmanifest'),'utf8'))
assert.equal(manifest.display,'standalone')
for (const path of [manifest.start_url,manifest.scope]) assert.equal(new URL(path,url).href,url.href)
for (const [name,size] of [['icon-180.png',180],['icon-192.png',192],['icon-512.png',512],['icon-maskable-512.png',512]]) {
  const bytes=await readFile(resolve(dist,name))
  assert.equal(bytes.subarray(1,4).toString(),'PNG')
  assert.equal(bytes.readUInt32BE(16),size)
  assert.equal(bytes.readUInt32BE(20),size)
  if (size!==180) assert(manifest.icons.some(icon=>icon.src===name && icon.sizes===size+'x'+size &&
    icon.purpose===(name.includes('maskable') ? 'maskable' : 'any')))
}
const worker=await readFile(resolve(dist,'sw.js'),'utf8')
assert(worker.includes('SKIP_WAITING') && worker.includes('index.html') && worker.includes('manifest.webmanifest'),'更新またはオフラインの設定が不足しています。')
const inspected=[...root.filter(entry=>entry.isFile() && /\.(?:html|webmanifest|js|svg)$/.test(entry.name)).map(entry=>entry.name),
  ...assets.map(entry=>'assets/'+entry.name)]
for (const path of inspected) {
  const content=await readFile(resolve(dist,path),'utf8')
  assert(!/[A-Z]:[/\\]Users[/\\]|\/home\/[^/]+\/|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|\b(?:ghp_|github_pat_|sk-proj-)[A-Za-z0-9_-]{20,}/i.test(content),'配布物にローカルパスまたは認証情報の疑いがあります。')
}
console.log('PASS: 配布物の許可リスト、配信パス、マニフェスト、アイコン、更新・オフライン設定')
