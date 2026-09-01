import { supabase as S } from './js/supabase.js';
import { getSession } from './js/auth.js';

const $ = (id) => document.getElementById(id);
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let session = null;
let adminRole = null;
let adminPanel = null;

async function ensureSession(){
  session = getSession();
  if(!session) session = (await S.auth.getSession()).data.session;
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
  [...node.children].filter(el=>el.classList?.contains('community-reply') || el.classList?.contains('social38-comment')).forEach(child=>parent.insertBefore(child,ref));
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
  if(!id || !confirm('Eliminar esta resposta?')) return;
  const {data,error}=await S.rpc('delete_professional_comment',{p_comment_id:id});
  if(error||!data){ toast('Não foi possível eliminar a resposta.'); return; }
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
    const until=data.restricted_until ? ` até ${new Date(data.restricted_until).toLocaleString('pt-PT',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})}` : '';
    el.innerHTML=`<strong>Conta restringida${until}</strong>${data.reason?` · ${esc(data.reason)}`:''}`;
    document.body.appendChild(el);
  }
  if(data.status==='blocked' && !data.admin_role){
    const el=document.createElement('div'); el.className='account-blocked-screen';
    el.innerHTML=`<div class="account-blocked-card"><div style="font-size:34px">⛔</div><h2>Conta bloqueada</h2><p>${data.reason?esc(data.reason):'Esta conta foi bloqueada pela moderação do Chama O Pro.'}</p><button class="btn dark" id="blockedLogout" type="button">Sair</button></div>`;
    document.body.appendChild(el);
    $('blockedLogout').onclick=()=>S.auth.signOut();
  }
}

function injectAdminTab(){
  if(!adminRole || $('adminTab')) return;
  const tabs=document.querySelector('#accountModal .account-tabs');
  const box=document.querySelector('#accountModal .box');
  if(!tabs||!box) return;
  const tab=document.createElement('button');
  tab.id='adminTab'; tab.type='button'; tab.className='account-tab'; tab.dataset.accountTab='admin'; tab.textContent='Admin';
  tabs.appendChild(tab);
  adminPanel=document.createElement('section');
  adminPanel.className='account-panel'; adminPanel.dataset.accountPanel='admin'; adminPanel.id='adminPanel';
  adminPanel.innerHTML='<div class="admin-empty">A carregar painel de administração…</div>';
  box.appendChild(adminPanel);
  tab.onclick=()=>{
    document.querySelectorAll('.account-tab').forEach(b=>b.classList.toggle('on',b===tab));
    document.querySelectorAll('.account-panel').forEach(p=>p.classList.toggle('on',p===adminPanel));
    renderAdminHome().catch(console.error);
  };
}

function userActions(u){
  const own=session?.user?.id===u.user_id;
  if(own) return '<span class="admin-tabs-note">Esta é a tua conta.</span>';
  const actions=[];
  if(u.moderation_status==='active'){
    actions.push(`<button class="warn" data-admin-restrict="${u.user_id}">Restringir 7 dias</button>`);
    actions.push(`<button class="danger" data-admin-block="${u.user_id}">Bloquear</button>`);
  } else {
    actions.push(`<button class="good" data-admin-activate="${u.user_id}">Reativar</button>`);
    if(u.moderation_status!=='blocked') actions.push(`<button class="danger" data-admin-block="${u.user_id}">Bloquear</button>`);
  }
  if(adminRole==='owner' && u.admin_role!=='owner'){
    if(u.admin_role==='admin'||u.admin_role==='moderator') actions.push(`<button data-admin-role="none" data-user-id="${u.user_id}">Retirar função admin</button>`);
    if(u.admin_role!=='moderator') actions.push(`<button data-admin-role="moderator" data-user-id="${u.user_id}">Tornar moderador</button>`);
    if(u.admin_role!=='admin') actions.push(`<button class="dark" data-admin-role="admin" data-user-id="${u.user_id}">Tornar admin</button>`);
  }
  return actions.join('');
}

function userCard(u){
  const status=u.moderation_status||'active';
  return `<article class="admin-user"><div class="admin-user-top"><div><strong>${esc(u.display_name||'Utilizador')}</strong><span class="admin-meta">${esc(u.email||'')} ${u.professional_name?`· PRO: ${esc(u.professional_name)}`:''}</span><span class="admin-meta">Conta: ${esc(u.account_type||'client')}${u.admin_role?` · função: ${esc(u.admin_role)}`:''}</span></div><span class="admin-status ${status}">${status==='active'?'Ativa':status==='restricted'?'Restringida':'Bloqueada'}</span></div>${u.moderation_reason?`<span class="admin-meta">Motivo: ${esc(u.moderation_reason)}</span>`:''}<div class="admin-actions">${userActions(u)}</div></article>`;
}

async function searchUsers(query=''){
  const host=$('adminUsers'); if(!host) return;
  host.innerHTML='<div class="admin-empty">A pesquisar…</div>';
  const {data,error}=await S.rpc('admin_search_users',{p_query:query,p_limit:40});
  if(error){ host.innerHTML='<div class="admin-empty">Não foi possível pesquisar utilizadores.</div>'; return; }
  host.innerHTML=(data||[]).length ? data.map(userCard).join('') : '<div class="admin-empty">Nenhum utilizador encontrado.</div>';
}

async function loadContent(){
  const host=$('adminContent'); if(!host) return;
  const {data,error}=await S.rpc('admin_recent_public_content',{p_limit:50});
  if(error){host.innerHTML='<div class="admin-empty">Não foi possível carregar conteúdo.</div>';return;}
  host.innerHTML=(data||[]).length ? data.map(c=>`<article class="admin-content"><div class="admin-content-top"><div><strong>${c.content_kind==='review'?'Avaliação pública':'Comentário público'}</strong><span class="admin-meta">${esc(c.author_name)} → ${esc(c.professional_name||'profissional')} · ${new Date(c.created_at).toLocaleString('pt-PT')}</span></div>${c.rating?`<span>${'★'.repeat(Number(c.rating))}</span>`:''}</div><p>${esc(c.body||'')}</p><div class="admin-actions"><button class="danger" data-admin-delete-content="${c.content_id}" data-content-kind="${c.content_kind}">Eliminar conteúdo</button></div></article>`).join('') : '<div class="admin-empty">Não há conteúdo público recente.</div>';
}

async function loadAudit(){
  const host=$('adminAudit'); if(!host || !['owner','admin'].includes(adminRole)) return;
  const {data,error}=await S.rpc('admin_audit',{p_limit:40});
  if(error){host.innerHTML='<div class="admin-empty">Não foi possível carregar o histórico.</div>';return;}
  host.innerHTML=(data||[]).length ? data.map(a=>`<div class="admin-audit-item"><strong>${esc(a.action)}</strong><span class="admin-meta">${esc(a.admin_name)}${a.target_name?` → ${esc(a.target_name)}`:''} · ${new Date(a.created_at).toLocaleString('pt-PT')}</span></div>`).join('') : '<div class="admin-empty">Ainda não existem ações administrativas.</div>';
}

async function renderAdminHome(){
  if(!adminPanel) return;
  adminPanel.innerHTML=`<div class="admin-panel"><div class="admin-hero"><div><span class="admin-eyebrow">🛡️ CONTROLO DA PLATAFORMA</span><h3>Administração Chama O Pro</h3><span class="admin-meta">Moderação com permissões validadas no backend e registo de auditoria.</span></div><span class="admin-role">${esc(adminRole)}</span></div><section class="admin-section"><div class="admin-section-head"><h4>Utilizadores</h4></div><form id="adminSearchForm" class="admin-search"><input id="adminSearchInput" placeholder="Nome, email ou nome profissional"><button class="btn dark" type="submit">Pesquisar</button></form><div id="adminUsers" class="admin-list"></div></section><section class="admin-section"><div class="admin-section-head"><h4>Conteúdo público recente</h4><button class="btn ghost" id="adminRefreshContent" type="button">Atualizar</button></div><div id="adminContent" class="admin-list"></div></section>${['owner','admin'].includes(adminRole)?'<section class="admin-section"><div class="admin-section-head"><h4>Auditoria</h4></div><div id="adminAudit" class="admin-list"></div></section>':''}</div>`;
  $('adminSearchForm').onsubmit=e=>{e.preventDefault();searchUsers($('adminSearchInput').value.trim()).catch(console.error)};
  $('adminRefreshContent').onclick=()=>loadContent().catch(console.error);
  await Promise.all([searchUsers(''),loadContent(),loadAudit()]);
}

async function setUserStatus(userId,status){
  const reason=status==='active' ? null : prompt(status==='blocked'?'Motivo do bloqueio:':'Motivo da restrição:')?.trim();
  if(status!=='active' && reason===undefined) return;
  const until=status==='restricted' ? new Date(Date.now()+7*86400000).toISOString() : null;
  const {error}=await S.rpc('admin_set_user_status',{p_user_id:userId,p_status:status,p_reason:reason||null,p_restricted_until:until});
  if(error){toast(error.message?.includes('owner')?'Não podes moderar o Owner.':'Não foi possível alterar a conta.');return;}
  toast(status==='active'?'Conta reativada':status==='blocked'?'Conta bloqueada':'Conta restringida por 7 dias');
  await searchUsers($('adminSearchInput')?.value.trim()||''); await loadAudit();
}

async function setRole(userId,role){
  if(!confirm(role==='none'?'Retirar esta função administrativa?':`Dar função ${role} a esta conta?`)) return;
  const {error}=await S.rpc('admin_set_role',{p_user_id:userId,p_role:role});
  if(error){toast('Não foi possível alterar a função administrativa.');return;}
  toast('Função administrativa atualizada'); await searchUsers($('adminSearchInput')?.value.trim()||''); await loadAudit();
}

async function deleteContent(button){
  if(!confirm('Eliminar este conteúdo público?')) return;
  const {error}=await S.rpc('admin_delete_public_content',{p_kind:button.dataset.contentKind,p_id:button.dataset.adminDeleteContent});
  if(error){toast('Não foi possível eliminar o conteúdo.');return;}
  toast('Conteúdo eliminado'); await loadContent(); await loadAudit();
}

function bindGlobal(){
  document.addEventListener('click',e=>{
    const del=e.target.closest?.('[data-delete-thread-comment]');
    if(del){e.preventDefault();e.stopImmediatePropagation();deleteThreadComment(del).catch(console.error);return;}
    const r=e.target.closest?.('[data-admin-restrict]'); if(r){setUserStatus(r.dataset.adminRestrict,'restricted').catch(console.error);return;}
    const b=e.target.closest?.('[data-admin-block]'); if(b){setUserStatus(b.dataset.adminBlock,'blocked').catch(console.error);return;}
    const a=e.target.closest?.('[data-admin-activate]'); if(a){setUserStatus(a.dataset.adminActivate,'active').catch(console.error);return;}
    const role=e.target.closest?.('[data-admin-role]'); if(role){setRole(role.dataset.userId,role.dataset.adminRole).catch(console.error);return;}
    const content=e.target.closest?.('[data-admin-delete-content]'); if(content){deleteContent(content).catch(console.error);return;}
  },true);
  new MutationObserver(cleanDeletedPlaceholders).observe(document.body,{childList:true,subtree:true});
}

async function init(){
  bindGlobal();
  await ensureSession();
  cleanDeletedPlaceholders();
  await loadAccountState();
  if(session){
    const {data}=await S.rpc('my_admin_role'); adminRole=data||null; injectAdminTab();
  }
  S.auth.onAuthStateChange((_e,next)=>{session=next;setTimeout(async()=>{await loadAccountState();if(next){const {data}=await S.rpc('my_admin_role');adminRole=data||null;injectAdminTab();}},0)});
}
init().catch(console.error);
