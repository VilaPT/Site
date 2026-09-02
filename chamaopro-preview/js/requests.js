import { supabase as S } from './supabase.js';
import { getSession, requireAuth } from './auth.js';
import { getSearchContext, resolveSkill } from './search.js';
import { openServiceChat } from './chat.js';
import { normalizeLocation, resolvePortugalLocation } from './location.js';

const $ = (id) => document.getElementById(id);
let targetProfessional = null;
function openModal(){ $('requestModal')?.classList.add('open') }
function closeModal(){ $('requestModal')?.classList.remove('open') }
function setMessage(text='',type=''){const e=$('reqMsg');if(!e)return;e.className=`msg${type?` ${type}`:''}`;e.textContent=text}
async function hasPrivateRequestData(){const s=getSession();if(!s)return false;const {data,error}=await S.from('profiles').select('phone,address_line1,postal_code,address_city').eq('id',s.user.id).maybeSingle();return !error&&Boolean(data?.phone&&data?.address_line1&&data?.postal_code&&data?.address_city)}
export function requestService(professional=null){targetProfessional=professional?.user_id?professional:null;if(!requireAuth('request','client'))return false;openRequest();return true}
export async function openRequest(){const c=getSearchContext(),title=$('requestModal')?.querySelector('h2');if(targetProfessional&&!await hasPrivateRequestData()){alert('Antes de pedires um serviço diretamente a um profissional, completa o telefone e a morada na tua Conta. Estes dados só serão partilhados com o profissional escolhido.');$('navAccount')?.click();return}if(title)title.textContent=targetProfessional?.public_name?`Pedir serviço a ${targetProfessional.public_name}`:'Guardar pedido';if($('reqDesc'))$('reqDesc').value=c.query||c.skill?.name||'';if($('reqCity'))$('reqCity').value=c.location?.label||c.city||'';setMessage(targetProfessional?.public_name?`O pedido abre uma conversa privada com ${targetProfessional.public_name}. O teu telefone e morada ficam visíveis apenas para este profissional.`:'',targetProfessional?'ok':'');openModal()}

async function submitRequest(e){
  e.preventDefault();
  const s=getSession();
  if(!s){requestService(targetProfessional);return}
  const description=$('reqDesc')?.value.trim()||'';
  let city=$('reqCity')?.value.trim()||'';
  const c=getSearchContext(),skill=c.skill||resolveSkill(description);
  if(!city){setMessage('Indica a localidade do serviço.','err');return}

  setMessage('A reconhecer a localidade…');
  let location=c.location&&normalizeLocation(c.location.label)===normalizeLocation(city)?c.location:null;
  if(!location)location=await resolvePortugalLocation(city);
  if(!location){setMessage('Não consegui reconhecer essa localidade. Experimenta a freguesia, o concelho ou o código postal.','err');return}
  city=location.label;
  $('reqCity').value=city;

  let requestId=null,error=null;
  if(targetProfessional){
    const r=await S.rpc('create_targeted_service_request_v2',{
      p_professional_id:targetProfessional.user_id,
      p_skill_id:skill?.id||null,
      p_raw_query:c.query||description,
      p_description:description,
      p_city:city,
      p_location_lat:location.lat,
      p_location_lon:location.lon,
      p_location_label:location.label,
      p_municipality:location.municipality,
      p_parish:location.parish,
    });
    requestId=r.data;error=r.error;
  }else{
    const r=await S.from('service_requests').insert({
      client_id:s.user.id,
      professional_id:null,
      skill_id:skill?.id||null,
      raw_query:c.query||description,
      description,
      city,
      district:location.district||null,
      location_lat:location.lat,
      location_lon:location.lon,
      location_label:location.label,
      municipality:location.municipality,
      parish:location.parish,
    }).select('id').single();
    requestId=r.data?.id||null;error=r.error;
  }
  if(error){const m=String(error.message||'');setMessage(m.includes('complete phone and address')?'Completa primeiro o telefone e a morada na tua Conta.':m.includes('professional unavailable')?'Este profissional já não está disponível para receber pedidos.':'Não foi possível enviar o pedido.','err');return}
  const name=targetProfessional?.public_name;
  setMessage(name?`Pedido enviado a ${name} ✓ A conversa vai abrir.`:`Pedido guardado ✓ Localização: ${location.label}`,'ok');
  if(targetProfessional&&requestId){targetProfessional=null;setTimeout(async()=>{closeModal();await openServiceChat(requestId)},500);return}
  targetProfessional=null;setTimeout(closeModal,800);
}
export function initRequests(){$('saveDemand')?.addEventListener('click',()=>requestService(null));$('requestForm')?.addEventListener('submit',submitRequest)}
