import { supabase as S } from './supabase.js';
import { getSession, requireAuth } from './auth.js';
import { getSearchContext, resolveSkill } from './search.js?v=2';
import { openServiceChat } from './chat.js';

const $ = (id) => document.getElementById(id);
let targetProfessional = null;

function openModal(){ $('requestModal')?.classList.add('open') }
function closeModal(){ $('requestModal')?.classList.remove('open') }
function setMessage(text='',type=''){const e=$('reqMsg');if(!e)return;e.className=`msg${type?` ${type}`:''}`;e.textContent=text}

async function hasPrivateRequestData(){const s=getSession();if(!s)return false;const {data,error}=await S.from('profiles').select('phone,address_line1,postal_code,address_city').eq('id',s.user.id).maybeSingle();return !error&&Boolean(data?.phone&&data?.address_line1&&data?.postal_code&&data?.address_city)}

export function requestService(professional=null){targetProfessional=professional?.user_id?professional:null;if(!requireAuth('request','client'))return false;openRequest();return true}

export async function openRequest(){const c=getSearchContext(),title=$('requestModal')?.querySelector('h2');if(targetProfessional&&!await hasPrivateRequestData()){alert('Antes de pedires um serviço diretamente a um profissional, completa o telefone e a morada na tua Conta. Estes dados só serão partilhados com o profissional escolhido.');$('navAccount')?.click();return}if(title)title.textContent=targetProfessional?.public_name?`Pedir serviço a ${targetProfessional.public_name}`:'Guardar pedido';if($('reqDesc'))$('reqDesc').value=c.query||c.skill?.name||'';if($('reqCity'))$('reqCity').value=c.city||'';setMessage(targetProfessional?.public_name?`O pedido abre uma conversa privada com ${targetProfessional.public_name}. O teu telefone e morada ficam visíveis apenas para este profissional.`:'',targetProfessional?'ok':'');openModal()}

async function submitRequest(e){e.preventDefault();const s=getSession();if(!s){requestService(targetProfessional);return}if(targetProfessional&&!await hasPrivateRequestData()){setMessage('Completa primeiro o telefone e a morada na tua Conta.','err');return}const description=$('reqDesc')?.value.trim()||'',city=$('reqCity')?.value.trim()||'',c=getSearchContext(),skill=c.skill||resolveSkill(description);const {data,error}=await S.from('service_requests').insert({client_id:s.user.id,professional_id:targetProfessional?.user_id||null,skill_id:skill?.id||null,raw_query:c.query||description,description,city}).select('id').single();if(error){setMessage(error.message.includes('complete phone and address')?'Completa primeiro o telefone e a morada na tua Conta.':'Não foi possível enviar o pedido.','err');return}const name=targetProfessional?.public_name;setMessage(name?`Pedido enviado a ${name} ✓ A conversa vai abrir.`:'Pedido guardado ✓','ok');if(targetProfessional&&data?.id){const id=data.id;targetProfessional=null;setTimeout(async()=>{closeModal();await openServiceChat(id)},600);return}targetProfessional=null;setTimeout(closeModal,900)}

export function initRequests(){$('saveDemand')?.addEventListener('click',()=>requestService(null));$('requestForm')?.addEventListener('submit',submitRequest)}
