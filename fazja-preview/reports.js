import { supabase as S } from './js/supabase.js';
import { getSession } from './js/auth.js';

const $ = (id) => document.getElementById(id);
let session = null;
let currentTarget = null;
let observer = null;
let decorating = false;

async function ensureSession(){
  session = getSession();
  if(!session) session = (await S.auth.getSession()).data.session;
  return session;
}

function toast(text){
  const el = $('toast');
  if(!el) return;
  el.textContent = text;
  el.classList.add('on');
  setTimeout(()=>el.classList.remove('on'),2600);
}

function ensureModal(){
  let modal = $('reportModal');
  if(modal) return modal;
  modal = document.createElement('div');
  modal.id = 'reportModal';
  modal.className = 'report-modal';
  modal.innerHTML = `
    <div class="report-box" role="dialog" aria-modal="true" aria-labelledby="reportTitle">
      <button class="report-close" type="button" aria-label="Fechar">×</button>
      <span class="report-eyebrow">DENUNCIAR</span>
      <h2 id="reportTitle">Reportar conteúdo</h2>
      <p class="report-help">A denúncia será analisada pelo Owner ou por um moderador. O autor denunciado não vê quem enviou o report.</p>
      <form id="reportForm">
        <label>Motivo
          <select id="reportReason" required>
            <option value="">Seleciona um motivo</option>
            <option value="spam">Spam</option>
            <option value="abuse">Assédio, ameaça ou ofensa</option>
            <option value="inappropriate">Conteúdo impróprio</option>
            <option value="fraud">Fraude ou tentativa de engano</option>
            <option value="other">Outro</option>
          </select>
        </label>
        <label>Explica, se necessário
          <textarea id="reportDetails" maxlength="1200" rows="4" placeholder="Ajuda a moderação a perceber o problema."></textarea>
        </label>
        <div class="report-msg" id="reportMsg"></div>
        <button class="btn primary full" type="submit">Enviar denúncia</button>
      </form>
    </div>`;
  document.body.appendChild(modal);
  modal.querySelector('.report-close').onclick = closeModal;
  modal.addEventListener('click',e=>{ if(e.target===modal) closeModal(); });
  $('reportForm').addEventListener('submit',submitReport);
  return modal;
}

function closeModal(){
  $('reportModal')?.classList.remove('open');
  currentTarget = null;
  if($('reportMsg')) $('reportMsg').textContent='';
  if($('reportReason')) $('reportReason').value='';
  if($('reportDetails')) $('reportDetails').value='';
}

async function openReport(targetType,targetId){
  if(!targetType || !targetId) return;
  if(!await ensureSession()){
    $('authBtn')?.click();
    return;
  }
  currentTarget = { targetType,targetId };
  ensureModal().classList.add('open');
  setTimeout(()=>$('reportReason')?.focus(),20);
}

async function submitReport(event){
  event.preventDefault();
  if(!currentTarget || !await ensureSession()) return;
  const reason = $('reportReason')?.value;
  const details = $('reportDetails')?.value.trim() || null;
  const msg = $('reportMsg');
  if(!reason){ if(msg) msg.textContent='Seleciona um motivo.'; return; }
  const button = event.currentTarget.querySelector('button[type="submit"]');
  button.disabled=true; button.textContent='A enviar…';
  const {error} = await S.rpc('submit_report',{
    p_target_type:currentTarget.targetType,
    p_target_id:currentTarget.targetId,
    p_reason:reason,
    p_details:details,
  });
  button.disabled=false; button.textContent='Enviar denúncia';
  if(error){
    console.error(error);
    if(msg) msg.textContent = error.message?.includes('yourself') ? 'Não podes denunciar o teu próprio conteúdo.' : 'Não foi possível enviar a denúncia.';
    return;
  }
  closeModal();
  toast('Denúncia enviada à moderação');
}

function authorIdFor(node){
  return node?.querySelector?.('[data-community-user]')?.dataset.communityUser || null;
}

function addReportButton(host,type,id,own=false){
  if(!host || !id || own || host.querySelector(':scope > .cop-report-action, :scope > * > .cop-report-action')) return;
  const button = document.createElement('button');
  button.type='button';
  button.className='cop-report-action';
  button.dataset.reportTargetType=type;
  button.dataset.reportTargetId=id;
  button.textContent='Denunciar';

  if(host.classList.contains('social38-comment')){
    let actions = host.querySelector(':scope > .social38-comment-actions');
    if(!actions){ actions=document.createElement('div'); actions.className='social38-comment-actions'; host.appendChild(actions); }
    actions.appendChild(button);
  } else if(host.classList.contains('community-review') || host.classList.contains('community-reply')){
    let actions = host.querySelector(':scope > .social38-review-actions');
    if(!actions){ actions=document.createElement('div'); actions.className='social38-review-actions'; const body=host.querySelector(':scope > .community-body'); (body||host).insertAdjacentElement?.('afterend',actions) || host.appendChild(actions); }
    actions.appendChild(button);
  } else {
    host.appendChild(button);
  }
}

async function decorate(){
  if(decorating) return;
  decorating=true;
  await ensureSession();
  const uid=session?.user?.id;

  document.querySelectorAll('.social38-comment[data-profile-comment-id]').forEach(node=>{
    addReportButton(node,'professional_comment',node.dataset.profileCommentId,authorIdFor(node)===uid);
  });
  document.querySelectorAll('.community-review[data-review-id]').forEach(node=>{
    addReportButton(node,'professional_review',node.dataset.reviewId,authorIdFor(node)===uid);
  });
  document.querySelectorAll('.community-reply[data-reply-id]').forEach(node=>{
    addReportButton(node,'professional_comment',node.dataset.replyId,authorIdFor(node)===uid);
  });
  document.querySelectorAll('.community-chat-bubble[data-direct-message-id]').forEach(node=>{
    addReportButton(node,'user_message',node.dataset.directMessageId,node.classList.contains('mine'));
  });
  document.querySelectorAll('#chatMessages .chat-message[data-service-message-id]').forEach(node=>{
    const own=Boolean(node.querySelector('.social38-delete-message'));
    addReportButton(node,'service_message',node.dataset.serviceMessageId,own);
  });
  decorating=false;
}

function bind(){
  document.addEventListener('click',e=>{
    const button=e.target.closest?.('[data-report-target-type]');
    if(!button) return;
    e.preventDefault(); e.stopPropagation();
    openReport(button.dataset.reportTargetType,button.dataset.reportTargetId).catch(console.error);
  },true);
  observer = new MutationObserver(()=>setTimeout(()=>decorate().catch(console.error),30));
  observer.observe(document.body,{childList:true,subtree:true});
}

async function init(){
  ensureModal();
  bind();
  await ensureSession();
  await decorate();
  S.auth.onAuthStateChange((_event,next)=>{ session=next; setTimeout(()=>decorate().catch(()=>{}),0); });
}

init().catch(console.error);
