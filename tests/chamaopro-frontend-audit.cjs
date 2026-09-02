const fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..'),preview=path.join(root,'fazja-preview');
const read=p=>fs.readFileSync(p,'utf8'),clean=v=>String(v||'').split('#')[0].split('?')[0].replace(/^\.\//,'');
const walk=d=>fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(d,e.name)):[path.join(d,e.name)]);
const rel=f=>path.relative(preview,f).split(path.sep).join('/');
const loader=read(path.join(root,'chamaopro','index.html')),html=read(path.join(preview,'index.html'));
function array(name){const m=loader.match(new RegExp(`const\\s+${name}\\s*=\\s*\\[([\\s\\S]*?)\\]`));return m?[...m[1].matchAll(/['"]([^'"]+)['"]/g)].map(x=>clean(x[1])):[]}
function htmlAssets(){return [...html.matchAll(/<(?:script|link)\b[^>]*(?:src|href)=["']\.\/([^"']+)["']/gi)].map(x=>clean(x[1])).filter(x=>/\.(js|css)$/i.test(x))}
function deps(file,src){const out=[];if(file.endsWith('.js')){for(const re of[/(?:import|export)\s+(?:[^'";]*?\s+from\s*)?["']([^"']+)["']/g,/import\s*\(\s*["']([^"']+)["']/g])for(const m of src.matchAll(re))out.push(m[1])}else for(const m of src.matchAll(/@import\s+(?:url\()?\s*["']([^"']+)["']/g))out.push(m[1]);return out}
function resolve(from,spec){if(!spec?.startsWith('.'))return null;const r=path.posix.normalize(path.posix.join(path.posix.dirname(from),clean(spec)));return r.startsWith('../')?null:r}
const roots=[...new Set([...array('styles'),...array('scripts'),...htmlAssets()])];
const all=walk(preview).filter(f=>/\.(js|css)$/i.test(f)).map(rel).sort(),allSet=new Set(all),active=new Set(),missing=new Set(),q=[...roots];
while(q.length){const cur=q.shift();if(!cur||active.has(cur))continue;if(!allSet.has(cur)){missing.add(cur);continue}active.add(cur);const src=read(path.join(preview,...cur.split('/')));for(const d of deps(cur,src)){const r=resolve(cur,d);if(r&&!active.has(r))q.push(r)}}
function newer(asset){const b=path.posix.basename(asset),m=b.match(/^(.*?)(\d+)(\.(?:js|css))$/i);if(!m)return null;const dir=path.posix.dirname(asset),v=+m[2];return[...active].filter(x=>{const n=path.posix.basename(x).match(/^(.*?)(\d+)(\.(?:js|css))$/i);return path.posix.dirname(x)===dir&&n&&n[1]===m[1]&&n[3].toLowerCase()===m[3].toLowerCase()&&+n[2]>v}).sort().pop()||null}
const size=a=>fs.statSync(path.join(preview,...a.split('/'))).size,candidates=all.filter(a=>!active.has(a));
console.log('CHAMA O PRO — AUDITORIA FRONTEND');console.log(`JS/CSS: ${all.length} | ativos: ${active.size} | candidatos: ${candidates.length}`);
console.log(`Bytes total: ${all.reduce((s,a)=>s+size(a),0)} | ativos: ${[...active].reduce((s,a)=>s+size(a),0)} | candidatos: ${candidates.reduce((s,a)=>s+size(a),0)}`);
console.log('\nENTRADAS DIRETAS');roots.sort().forEach(a=>console.log('+ '+a));
console.log('\nCANDIDATOS — NÃO APAGAR AUTOMATICAMENTE');candidates.forEach(a=>{const n=newer(a);console.log(`? ${a} | ${n?'substituído provável por '+n:'candidato a legado/órfão'} | ${size(a)} bytes`)});
if(missing.size){console.log('\nREFERÊNCIAS EM FALTA');[...missing].sort().forEach(a=>console.log('! '+a));process.exitCode=1}
