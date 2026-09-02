import { supabase as S } from './js/supabase.js';
import { getSession } from './js/auth.js';

const $ = (id) => document.getElementById(id);
const esc = (v) => String(v ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let session=null;
let adminRole=null;
let controlPanel=null;
let reportStatus='open';

const reasonLabels={
  spam:'Spam',
  abuse:'Assédio, ameaça ou ofensa',
  inappropriate:'Conteúdo impróprio',
  fraud:'Fraude ou tentativa de engano',
  other:'Outro',
};
const typeLabels={
  professional_comment:'Comentário',
  professional_review:'Avaliação',
  user_message:'Mensagem entre utilizadores',
  service_message:'Mensagem de serviço',
  user:'Conta/perfil',
};

async function ensureSession(){
  session=getSession();
  if(!session) session=(await S.auth.getSession()).data.session;
  return session;
}

function toast(text){
  const el=$('toast'); if(!el) return;
  el.textContent=text; el.classList.add('on'); setTimeout(()=>el.classList.remove('on'),2600);
}

function promoteChildrenAndRemove(node){
  if(!node?.parentElement) return;
  const parent=node.parentElement;
  const ref=node.nextSibling;
  [...node.children].filter(el=>el.classList?.contains('community-reply')||el.classList?.contains('social38-comment')).forEach(child=>parent.insertBefore(child,ref));
  node.remove();
}

function cleanDeletedPlaceholders(){
  document.querySelectorAll('.community-reply,.social38-comment').forEach(node=>{
    const body=node.querySelector(':scope > .community-body,:scope > .social38-comment-body');
    if(body?.textContent.trim()==='Comentário eliminado') promoteChildrenAndRemove(node);
  });
}

async function deleteThreadComment(button){
  const id=button.dataset.deleteThreadComment;
  if(!id||!confirm('Eliminar esta resposta?')) return;
  const {data,error}=await S.rpc('delete_professional_comment',{p_comment_id:id});
  if(error||!data){toast('Não foi possível eliminar a resposta.');return;}
  promoteChildrenAndRemove(button.closest('.community-reply'));
  toast('Resposta eliminada');
}

async function loadAccountState(){
  if(!await ensureSession()) return;
  const {data,error}=await S.rpc('my_account_state');
  if(error||!data) return;
  document.querySelectorAll('.account-moderation-banner,.account-blocked-screen').forEach(el=>el.remove());
  if(data.status==='restricted'){
    const el=document.createElement('div'); el.className='account-moderation-banner';
    const until=data.restricted_until?` até ${new Date(data.restricted_until).toLocaleString('pt-PT',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})}`:'';
    el.innerHTML=`<strong>Conta restringida${until}</strong>${data.reason?` · ${esc(data.reason)}`:''}`;
    document.body.appendChild(el);
  }
  if(data.status==='blocked'&&data.admin_role!=='owner'){
    const el=document.createElement('div'); el.className='account-blocked-screen';
    el.innerHTML=`<div class="account-blocked-card"><div style="font-size:34px">⛔</div><h2>Conta bloqueada</h2><p>${data.reason?esc(data.reason):'Esta conta foi bloqueada pela administração do Chama O Pro.'}</p><button class="btn dark" id="blockedLogout" type="button">Sair</button></div>`;
    document.body.appendChild(el);
    $('blockedLogout').onclick=()=>S.auth.signOut();
  }
}

function roleName(){ return adminRole==='owner'?'Owner':'Moderador'; }

function injectControlTab(){
  if(!adminRole) return;
  const tabs=document.querySelector('#accountModal .account-tabs');
  const box=document.querySelector('#accountModal .box');
  if(!tabs||!box) return;
  let tab=$('adminTab');
  if(!tab){
    tab=document.createElement('button');
    tab.id='adminTab'; tab.type='button'; tab.className='account-tab'; tab.dataset.accountTab='admin';
    tabs.appendChild(tab);
  }
  tab.textContent=adminRole==='owner'?'Admin':'Moderação';
  if(!controlPanel){
    controlPanel=$('adminPanel');
    if(!controlPanel){
      controlPanel=document.createElement('section');
      controlPanel.className='account-panel'; controlPanel.dataset.accountPanel='admin'; controlPanel.id='adminPanel';
      box.appendChild(controlPanel);
    }
  }
  tab.onclick=()=>{
    document.querySelectorAll('.account-tab').forEach(b=>b.classList.toggle('on',b===tab));
    document.querySelectorAll('.account-panel').forEach(p=>p.classList.toggle('on',p===controlPanel));
    renderControlHome().catch(console.error);
  };
}

function reportCard(r){
  const state=r.status||'open';
  const statusLabel=state==='open'?'Pendente':state==='confirmed'?'Infração confirmada':'Sem infração';
  const preview=r.content_preview||'Conteúdo já não disponível.';
  const reviewed=r.reviewed_at?`Revisto por ${esc(r.reviewed_by_name||'moderação')} · ${new Date(r.reviewed_at).toLocaleString('pt-PT')}`:'';
  const openActions=state==='open'?`<button class="confirm" data-report-decision="confirmed" data-report-id="${r.report_id}">Confirmar infração</button><button class="dismiss" data-report-decision="dismissed" data-report-id="${r.report_id}">Sem infração</button>`:'';
  const ownerActions=adminRole==='owner'&&state==='confirmed'&&r.target_user_id?`<button class="owner-action" data-report-restrict-user="${r.target_user_id}">Restringir 7 dias</button><button class="owner-action" data-report-block-user="${r.target_user_id}">Bloquear conta</button>`:'';
  return `<article class="admin-report is-${state}">
    <div class="admin-report-top"><div><strong>${esc(typeLabels[r.target_type]||'Denúncia')} · ${esc(r.target_name||'Utilizador')}</strong><span class="admin-report-meta">Denunciado por ${esc(r.reporter_name||'Utilizador')} · ${new Date(r.created_at).toLocaleString('pt-PT')}</span></div><span class="admin-report-status ${state}">${statusLabel}</span></div>
    <span class="admin-report-reason">${esc(reasonLabels[r.reason]||r.reason)}</span>
    <p class="admin-report-preview">${esc(preview)}</p>
    ${r.details?`<span class="admin-report-meta">Nota do utilizador: ${esc(r.details)}</span>`:''}
    ${reviewed?`<span class="admin-report-meta">${reviewed}${r.resolution_note?` · ${esc(r.resolution_note)}`:''}</span>`:''}
    ${(openActions||ownerActions)?`<div class="admin-report-actions">${openActions}${ownerActions}</div>`:''}
  </article>`;
}

async function loadReports(status=reportStatus){
  reportStatus=status;
  document.querySelectorAll('.admin-report-filter').forEach(b=>b.classList.toggle('on',b.dataset.reportFilter===status));
  const host=$('adminReports'); if(!host) return;
  host.innerHTML='<div class="admin-empty">A carregar denúncias…</div>';
  const {data,error}=await S.rpc('moderation_report_queue',{p_status:status,p_limit:60});
  if(error){console.error(error);host.innerHTML='<div class="admin-empty">Não foi possível carregar as denúncias.</div>';return;}
  host.innerHTML=(data||[]).length?(data||[]).map(reportCard).join(''):'<div class="admin-empty">Não há denúncias nesta categoria.</div>';
}

async function reviewReport(reportId,decision){
  const note=prompt(decision==='confirmed'?'Nota da auditoria, opcional:':'Motivo para arquivar, opcional:') ?? null;
  if(note===null) return;
  const {data,error}=await S.rpc('moderation_review_report',{p_report_id:reportId,p_decision:decision,p_note:note.trim()||null});
  if(error||!data){toast('Não foi possível concluir a auditoria.');return;}
  toast(decision==='confirmed'?'Infração confirmada':'Denúncia arquivada sem infração');
  await loadReports(reportStatus);
  if(adminRole==='owner') await loadAudit();
}

function userActions(u){
  const own=session?.user?.id===u.user_id;
  if(own) return '<span class="admin-tabs-note">Esta é a tua conta Owner.</span>';
  const actions=[];
  if(u.moderation_status==='active'){
    actions.push(`<button class="warn" data-admin-restrict="${u.user_id}">Restringir 7 dias</button>`);
    actions.push(`<button class="danger" data-admin-block="${u.user_id}">Bloquear</button>`);
  }else{
    actions.push(`<button class="good" data-admin-activate="${u.user_id}">Reativar</button>`);
    if(u.moderation_status!=='blocked') actions.push(`<button class="danger" data-admin-block="${u.user_id}">Bloquear</button>`);
  }
  if(u.admin_role==='moderator') actions.push(`<button data-admin-role="none" data-user-id="${u.user_id}">Retirar moderador</button>`);
  else if(!u.admin_role) actions.push(`<button class="dark" data-admin-role="moderator" data-user-id="${u.user_id}">Tornar moderador</button>`);
  return actions.join('');
}

function userCard(u){
  const status=u.moderation_status||'active';
  const role=u.admin_role==='owner'?'Owner':u.admin_role==='moderator'?'Moderador':null;
  return `<article class="admin-user"><div class="admin-user-top"><div><strong>${esc(u.display_name||'Utilizador')}</strong><span class="admin-meta">${esc(u.email||'')}${u.professional_name?` · PRO: ${esc(u.professional_name)}`:''}</span><span class="admin-meta">Conta: ${esc(u.account_type||'client')}${role?` · função: ${role}`:''}</span></div><span class="admin-status ${status}">${status==='active'?'Ativa':status==='restricted'?'Restringida':'Bloqueada'}</span></div>${u.moderation_reason?`<span class="admin-meta">Motivo: ${esc(u.moderation_reason)}</span>`:''}<div class="admin-actions">${userActions(u)}</div></article>`;
}

async function searchUsers(query=''){
  if(adminRole!=='owner') return;
  const host=$('adminUsers'); if(!host) return;
  host.innerHTML='<div class="admin-empty">A pesquisar…</div>';
  const {data,error}=await S.rpc('admin_search_users',{p_query:query,p_limit:40});
  if(error){host.innerHTML='<div class="admin-empty">Não foi possível pesquisar utilizadores.</div>';return;}
  host.innerHTML=(data||[]).length?data.map(userCard).join(''):'<div class="admin-empty">Nenhum utilizador encontrado.</div>';
}

async function loadContent(){
  if(adminRole!=='owner') return;
  const host=$('adminContent'); if(!host) return;
  const {data,error}=await S.rpc('admin_recent_public_content',{p_limit:50});
  if(error){host.innerHTML='<div class="admin-empty">Não foi possível carregar conteúdo.</div>';return;}
  host.innerHTML=(data||[]).length?data.map(c=>`<article class="admin-content"><div class="admin-content-top"><div><strong>${c.content_kind==='review'?'Avaliação pública':'Comentário público'}</strong><span class="admin-meta">${esc(c.author_name)} → ${esc(c.professional_name||'profissional')} · ${new Date(c.created_at).toLocaleString('pt-PT')}</span></div>${c.rating?`<span>${'★'.repeat(Number(c.rating))}</span>`:''}</div><p>${esc(c.body||'')}</p><div class="admin-actions"><button class="danger" data-admin-delete-content="${c.content_id}" data-content-kind="${c.content_kind}">Eliminar conteúdo</button></div></article>`).join(''):'<div class="admin-empty">Não há conteúdo público recente.</div>';
}

async function loadAudit(){
  if(adminRole!=='owner') return;
  const host=$('adminAudit'); if(!host) return;
  const {data,error}=await S.rpc('admin_audit',{p_limit:50});
  if(error){host.innerHTML='<div class="admin-empty">Não foi possível carregar o histórico.</div>';return;}
  host.innerHTML=(data||[]).length?data.map(a=>`<div class="admin-audit-item"><strong>${esc(a.action)}</strong><span class="admin-meta">${esc(a.admin_name)}${a.target_name?` → ${esc(a.target_name)}`:''} · ${new Date(a.created_at).toLocaleString('pt-PT')}</span></div>`).join(''):'<div class="admin-empty">Ainda não existem ações administrativas.</div>';
}

function reportsSection(){
  return `<section class="admin-section"><div class="admin-section-head"><h4>Denúncias dos utilizadores</h4><button class="btn ghost" id="adminRefreshReports" type="button">Atualizar</button></div><div class="admin-report-filters"><button class="admin-report-filter on" data-report-filter="open">Pendentes</button><button class="admin-report-filter" data-report-filter="confirmed">Confirmadas</button><button class="admin-report-filter" data-report-filter="dismissed">Sem infração</button><button class="admin-report-filter" data-report-filter="all">Todas</button></div><div id="adminReports" class="admin-list"></div></section>`;
}

async function renderControlHome(){
  if(!controlPanel) return;
  if(adminRole==='moderator'){
    controlPanel.innerHTML=`<div class="admin-panel"><div class="admin-hero"><div><span class="admin-eyebrow">🛡️ MODERAÇÃO</span><h3>Auditoria de denúncias</h3><span class="admin-meta">Função limitada à análise de reports enviados pelos utilizadores.</span></div><span class="admin-role">Moderador</span></div><div class="moderation-scope-note">Um moderador pode confirmar ou arquivar denúncias. Não pode bloquear contas, restringir utilizadores, apagar conteúdo arbitrariamente nem nomear outros moderadores.</div>${reportsSection()}</div>`;
    $('adminRefreshReports').onclick=()=>loadReports(reportStatus).catch(console.error);
    await loadReports('open');
    return;
  }

  controlPanel.innerHTML=`<div class="admin-panel"><div class="admin-hero"><div><span class="admin-eyebrow">🛡️ OWNER</span><h3>Administração Chama O Pro</h3><span class="admin-meta">Única conta administrativa da plataforma. Só o Owner aplica sanções e nomeia moderadores.</span></div><span class="admin-role">Owner</span></div>${reportsSection()}<section class="admin-section"><div class="admin-section-head"><h4>Utilizadores e moderadores</h4></div><form id="adminSearchForm" class="admin-search"><input id="adminSearchInput" placeholder="Nome, email ou nome profissional"><button class="btn dark" type="submit">Pesquisar</button></form><div id="adminUsers" class="admin-list"></div></section><section class="admin-section"><div class="admin-section-head"><h4>Conteúdo público recente</h4><button class="btn ghost" id="adminRefreshContent" type="button">Atualizar</button></div><div id="adminContent" class="admin-list"></div></section><section class="admin-section"><div class="admin-section-head"><h4>Auditoria administrativa</h4></div><div id="adminAudit" class="admin-list"></div></section></div>`;
  $('adminRefreshReports').onclick=()=>loadReports(reportStatus).catch(console.error);
  $('adminSearchForm').onsubmit=e=>{e.preventDefault();searchUsers($('adminSearchInput').value.trim()).catch(console.error);};
  $('adminRefreshContent').onclick=()=>loadContent().catch(console.error);
  await Promise.all([loadReports('open'),searchUsers(''),loadContent(),loadAudit()]);
}

async function setUserStatus(userId,status){
  if(adminRole!=='owner') return;
  const reason=status==='active'?null:prompt(status==='blocked'?'Motivo do bloqueio:':'Motivo da restrição:');
  if(status!=='active'&&reason===null) return;
  const until=status==='restricted'?new Date(Date.now()+7*86400000).toISOString():null;
  const {error}=await S.rpc('admin_set_user_status',{p_user_id:userId,p_status:status,p_reason:reason?.trim()||null,p_restricted_until:until});
  if(error){toast('Não foi possível alterar a conta.');return;}
  toast(status==='active'?'Conta reativada':status==='blocked'?'Conta bloqueada':'Conta restringida por 7 dias');
  if($('adminUsers')) await searchUsers($('adminSearchInput')?.value.trim()||'');
  await loadAudit();
  if($('adminReports')) await loadReports(reportStatus);
}

async function setRole(userId,role){
  if(adminRole!=='owner'||!['moderator','none'].includes(role)) return;
  if(!confirm(role==='none'?'Retirar a função de moderador desta conta?':'Nomear esta conta como moderador de denúncias?')) return;
  const {error}=await S.rpc('admin_set_role',{p_user_id:userId,p_role:role});
  if(error){toast('Não foi possível alterar a função de moderador.');return;}
  toast(role==='moderator'?'Moderador nomeado':'Função de moderador retirada');
  await searchUsers($('adminSearchInput')?.value.trim()||'');
  await loadAudit();
}

async function deleteContent(button){
  if(adminRole!=='owner'||!confirm('Eliminar este conteúdo público?')) return;
  const {error}=await S.rpc('admin_delete_public_content',{p_kind:button.dataset.contentKind,p_id:button.dataset.adminDeleteContent});
  if(error){toast('Não foi possível eliminar o conteúdo.');return;}
  toast('Conteúdo eliminado');
  await Promise.all([loadContent(),loadAudit(),loadReports(reportStatus)]);
}

function bindGlobal(){
  document.addEventListener('click',e=>{
    const del=e.target.closest?.('[data-delete-thread-comment]');
    if(del){e.preventDefault();e.stopImmediatePropagation();deleteThreadComment(del).catch(console.error);return;}
    const filter=e.target.closest?.('[data-report-filter]'); if(filter){loadReports(filter.dataset.reportFilter).catch(console.error);return;}
    const decision=e.target.closest?.('[data-report-decision]'); if(decision){reviewReport(decision.dataset.reportId,decision.dataset.reportDecision).catch(console.error);return;}
    const reportRestrict=e.target.closest?.('[data-report-restrict-user]'); if(reportRestrict){setUserStatus(reportRestrict.dataset.reportRestrictUser,'restricted').catch(console.error);return;}
    const reportBlock=e.target.closest?.('[data-report-block-user]'); if(reportBlock){setUserStatus(reportBlock.dataset.reportBlockUser,'blocked').catch(console.error);return;}
    const r=e.target.closest?.('[data-admin-restrict]'); if(r){setUserStatus(r.dataset.adminRestrict,'restricted').catch(console.error);return;}
    const b=e.target.closest?.('[data-admin-block]'); if(b){setUserStatus(b.dataset.adminBlock,'blocked').catch(console.error);return;}
    const a=e.target.closest?.('[data-admin-activate]'); if(a){setUserStatus(a.dataset.adminActivate,'active').catch(console.error);return;}
    const role=e.target.closest?.('[data-admin-role]'); if(role){setRole(role.dataset.userId,role.dataset.adminRole).catch(console.error);return;}
    const content=e.target.closest?.('[data-admin-delete-content]'); if(content){deleteContent(content).catch(console.error);return;}
  },true);
  new MutationObserver(cleanDeletedPlaceholders).observe(document.body,{childList:true,subtree:true});
}

async function syncRole(){
  if(!session){adminRole=null;return;}
  const {data}=await S.rpc('my_admin_role');
  adminRole=data||null;
  injectControlTab();
}

async function init(){
  bindGlobal();
  await ensureSession();
  cleanDeletedPlaceholders();
  await loadAccountState();
  await syncRole();
  S.auth.onAuthStateChange((_event,next)=>{
    session=next;
    setTimeout(async()=>{await loadAccountState();await syncRole();},0);
  });
}

init().catch(console.error);
