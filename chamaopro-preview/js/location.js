const API='https://json.geoapi.pt';
const CACHE_KEY='chamaopro:pt-places:v1';
const CACHE_MS=30*24*60*60*1000;
let placesPromise=null;

const clean=(value='')=>String(value).trim();
export const normalizeLocation=(value='')=>clean(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\b(uniao das freguesias de|uniao de freguesias de|freguesia de|concelho de|municipio de)\b/g,' ').replace(/[^a-z0-9]+/g,' ').replace(/\s+/g,' ').trim();

function readCache(){
  try{
    const item=JSON.parse(localStorage.getItem(CACHE_KEY)||'null');
    if(item?.savedAt&&Date.now()-item.savedAt<CACHE_MS&&Array.isArray(item.data))return item.data;
  }catch{}
  return null;
}
function writeCache(data){try{localStorage.setItem(CACHE_KEY,JSON.stringify({savedAt:Date.now(),data}))}catch{}}

async function fetchJson(path){
  const response=await fetch(`${API}${path}`,{headers:{Accept:'application/json'}});
  if(!response.ok)throw new Error(`location api ${response.status}`);
  return response.json();
}

export async function loadPortugalPlaces(){
  if(placesPromise)return placesPromise;
  placesPromise=(async()=>{
    const cached=readCache();
    if(cached)return cached;
    const rows=await fetchJson('/municipios/freguesias');
    const list=[];
    for(const row of Array.isArray(rows)?rows:[]){
      const municipality=clean(row.nome||row.municipio);
      if(!municipality)continue;
      list.push({kind:'municipality',name:municipality,municipality,label:municipality});
      for(const parishName of row.freguesias||[]){
        const parish=clean(parishName);
        if(parish)list.push({kind:'parish',name:parish,parish,municipality,label:`${parish}, ${municipality}`});
      }
    }
    writeCache(list);
    return list;
  })().catch((error)=>{placesPromise=null;throw error});
  return placesPromise;
}

function levenshtein(a,b){
  if(a===b)return 0;if(!a.length)return b.length;if(!b.length)return a.length;
  const prev=Array.from({length:b.length+1},(_,i)=>i),cur=new Array(b.length+1);
  for(let i=1;i<=a.length;i++){
    cur[0]=i;
    for(let j=1;j<=b.length;j++)cur[j]=Math.min(cur[j-1]+1,prev[j]+1,prev[j-1]+(a[i-1]===b[j-1]?0:1));
    for(let j=0;j<=b.length;j++)prev[j]=cur[j];
  }
  return prev[b.length];
}

function score(input,entry){
  const q=normalizeLocation(input),name=normalizeLocation(entry.name),label=normalizeLocation(entry.label),municipality=normalizeLocation(entry.municipality);
  if(!q||!name)return 999;
  if(q===label||q===name)return 0;
  if(q===`${name} ${municipality}`||q===`${municipality} ${name}`)return .05;
  if(label.startsWith(q)||name.startsWith(q))return .4;
  if(label.includes(q)||q.includes(name))return .8;
  const d=levenshtein(q,name),ratio=d/Math.max(q.length,name.length,1);
  return 1+ratio;
}

function bestPlace(input,places){
  const ranked=places.map((entry)=>({entry,score:score(input,entry)})).sort((a,b)=>a.score-b.score);
  const best=ranked[0];
  if(!best)return null;
  const q=normalizeLocation(input),n=normalizeLocation(best.entry.name);
  const maxDistance=q.length<=5?1:q.length<=9?2:3;
  const distance=levenshtein(q,n);
  if(best.score<=.8||distance<=maxDistance)return best.entry;
  return null;
}

function geoPair(data){
  const centers=data?.geojson?.properties?.centros||data?.geojson?.properties?.Centros||null;
  const pair=centers?.centro||centers?.centroide||centers?.centroDeMassa||centers?.centroMedio||null;
  if(Array.isArray(pair)&&pair.length>=2){
    const lon=Number(pair[0]),lat=Number(pair[1]);
    if(Number.isFinite(lat)&&Number.isFinite(lon))return{lat,lon};
  }
  const bbox=data?.geojson?.bbox;
  if(Array.isArray(bbox)&&bbox.length>=4){
    const lon=(Number(bbox[0])+Number(bbox[2]))/2,lat=(Number(bbox[1])+Number(bbox[3]))/2;
    if(Number.isFinite(lat)&&Number.isFinite(lon))return{lat,lon};
  }
  return null;
}

function postalPair(data){
  const pair=data?.centro||data?.centroide||data?.centroDeMassa;
  if(Array.isArray(pair)&&pair.length>=2){
    const lat=Number(pair[0]),lon=Number(pair[1]);
    if(Number.isFinite(lat)&&Number.isFinite(lon))return{lat,lon};
  }
  return null;
}

async function resolvePostalCode(value){
  const cp=(clean(value).match(/\b\d{4}(?:-?\d{3})?\b/)||[])[0];
  if(!cp)return null;
  const normalized=cp.length===7?`${cp.slice(0,4)}-${cp.slice(4)}`:cp;
  const data=await fetchJson(`/cp/${encodeURIComponent(normalized)}`);
  const coords=postalPair(data);
  if(!coords)return null;
  const municipality=clean(data.Concelho||data.concelho||data.Municipio||data.municipio);
  const locality=clean(data.Localidade||data.localidade||data['Designação Postal']||data.descrpostal);
  const district=clean(data.Distrito||data.distrito);
  return{...coords,label:locality||municipality||normalized,municipality:municipality||null,parish:null,district:district||null,source:'postal_code',postalCode:normalized};
}

async function resolveAdministrativePlace(entry){
  const path=entry.kind==='parish'
    ?`/municipio/${encodeURIComponent(entry.municipality)}/freguesia/${encodeURIComponent(entry.parish)}`
    :`/municipio/${encodeURIComponent(entry.municipality)}`;
  const data=await fetchJson(path);
  const coords=geoPair(data);
  if(!coords)return null;
  const props=data?.geojson?.properties||{};
  const district=clean(props.Distrito||data.distrito||data.Distrito);
  return{...coords,label:entry.label,municipality:entry.municipality,parish:entry.parish||null,district:district||null,source:entry.kind};
}

async function directMunicipalityFallback(input){
  try{
    const data=await fetchJson(`/municipio/${encodeURIComponent(clean(input))}`);
    const coords=geoPair(data);
    if(!coords)return null;
    const municipality=clean(data.nome||data.localidade||input);
    const district=clean(data.distrito||data.Distrito||data?.geojson?.properties?.Distrito);
    return{...coords,label:municipality,municipality,parish:null,district:district||null,source:'municipality'};
  }catch{return null}
}

export async function resolvePortugalLocation(value){
  const input=clean(value);
  if(!input)return null;
  if(/\b\d{4}(?:-?\d{3})?\b/.test(input)){
    try{const cp=await resolvePostalCode(input);if(cp)return cp}catch{}
  }
  try{
    const places=await loadPortugalPlaces();
    const match=bestPlace(input,places);
    if(match){
      const resolved=await resolveAdministrativePlace(match);
      if(resolved)return resolved;
    }
  }catch{}
  return directMunicipalityFallback(input);
}

export async function initPortugalPlacesDatalist(id='portugalPlaces'){
  const list=document.getElementById(id);
  if(!list||list.dataset.ready==='1')return;
  try{
    const places=await loadPortugalPlaces();
    const fragment=document.createDocumentFragment();
    for(const place of places){
      const option=document.createElement('option');
      option.value=place.label;
      fragment.appendChild(option);
    }
    list.replaceChildren(fragment);
    list.dataset.ready='1';
  }catch{}
}

export function formatDistance(km){
  const value=Number(km);
  if(!Number.isFinite(value))return'';
  if(value<1)return`${Math.max(100,Math.round(value*1000/100)*100)} m`;
  return`${value<10?value.toFixed(1):Math.round(value)} km`;
}
