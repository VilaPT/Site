import { supabase as S } from './js/supabase.js';
import { getSession } from './js/auth.js';

const $ = (id) => document.getElementById(id);
const districts = ['Aveiro','Beja','Braga','Bragança','Castelo Branco','Coimbra','Évora','Faro','Guarda','Leiria','Lisboa','Portalegre','Porto','Santarém','Setúbal','Viana do Castelo','Vila Real','Viseu','Açores','Madeira'];
let session = null;
let loading = false;

async function ensureSession(){
  session = getSession();
  if(!session) session = (await S.auth.getSession()).data.session;
  return session;
}

function ensureField(){
  if($('accountDistrict')) return $('accountDistrict');
  const city = $('accountAddressCity');
  const host = city?.closest('.field');
  if(!host) return null;
  const field = document.createElement('div');
  field.className = 'field';
  field.id = 'accountDistrictField';
  field.innerHTML = `<label for="accountDistrict">Distrito / Região</label><select id="accountDistrict"><option value="">Seleciona…</option>${districts.map(d=>`<option value="${d}">${d}</option>`).join('')}</select><small class="field-help">Usado para organização da plataforma. A tua morada e telefone continuam privados.</small>`;
  host.insertAdjacentElement('afterend', field);
  $('accountDistrict').addEventListener('change', saveDistrict);
  return $('accountDistrict');
}

async function loadDistrict(){
  if(loading || !await ensureSession()) return;
  const select = ensureField();
  if(!select) return;
  loading = true;
  const {data,error} = await S.from('profiles').select('district').eq('id',session.user.id).maybeSingle();
  loading = false;
  if(!error) select.value = data?.district || '';
}

async function saveDistrict(){
  if(!await ensureSession()) return;
  const select = ensureField();
  if(!select) return;
  const district = select.value || null;
  const {error} = await S.from('profiles').update({district,updated_at:new Date().toISOString()}).eq('id',session.user.id);
  if(error) console.error('Falha ao guardar distrito:',error);
}

function bind(){
  ensureField();
  document.addEventListener('click',e=>{
    if(e.target.closest?.('#navAccount,#accountCta,[data-account-tab="profile"]')) setTimeout(()=>loadDistrict().catch(console.error),120);
  });
  $('accountForm')?.addEventListener('submit',()=>setTimeout(()=>saveDistrict().catch(console.error),0));
  const modal = $('accountModal');
  if(modal) new MutationObserver(()=>{ if(modal.classList.contains('open')) loadDistrict().catch(()=>{}); }).observe(modal,{attributes:true,attributeFilter:['class']});
}

async function init(){
  bind();
  await ensureSession();
  if(session) await loadDistrict();
  S.auth.onAuthStateChange((_e,next)=>{session=next; if(next) setTimeout(()=>loadDistrict().catch(console.error),0);});
}
init().catch(console.error);
