import { supabase as S } from './js/supabase.js';
import { getSession } from './js/auth.js';

const $ = (id) => document.getElementById(id);
const esc = (v) => String(v ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const districts = ['Aveiro','Beja','Braga','Bragança','Castelo Branco','Coimbra','Évora','Faro','Guarda','Leiria','Lisboa','Portalegre','Porto','Santarém','Setúbal','Viana do Castelo','Vila Real','Viseu','Açores','Madeira'];
const reasonLabels={spam:'Spam',abuse:'Assédio, ameaça ou ofensa',inappropriate:'Conteúdo impróprio',fraud:'Fraude ou tentativa de engano',other:'Outro'};
const typeLabels={professional_comment:'Comentário',professional_review:'Avaliação',user_message:'Mensagem entre utilizadores',service_message:'Mensagem de serviço',user:'Conta/perfil'};
let session=null;
let role=null;
let timer=null;
let lastDirectory=[];

async function ensureSession(){
  session=getSession();
  if(!session) session=(await S.auth.getSession()).data.session;
  return session;
}
function toast(text){const el=$('toast');if(!el)return;el.textContent=text;el.classList.add('on');setTimeout(()=>el.classList.remove('on'),2600);}
function initials(name){return String(name||'U').trim().split(/\s+/).slice(0,2).map(p=>p[0]||'').join('').toUpperCase()||'U';}
function accountLabel(type){return type==='both'?'Cliente + profissional':type==='professional'?'Profissional':'Cliente';}
function statusLabel(status){return status==='blocked'?'Bloqueada':status==='restricted'?'Restringida':'Ativa';}

async function syncRole(){
  if(!await ensureSession()){role=null;return null;}
  const {data,error}=await S.rpc('my_admin_role');
  role=error?null:(data||null);
  return role;
}

function ensureEntry(){
  if(role!=='owner') return null;
  const profilePanel=document.querySelector('#accountModal [data-account-panel="profile"]');
  if(!profilePanel) return null;
  let entry=$('ownerAdminEntry');
  if(!entry){
    entry=document.createElement('button');
    entry.id='ownerAdminEntry';
    entry.type='button';
    entry.className='owner-admin-entry';
    entry.innerHTML='<span class="owner-admin-entry-icon">🛡️</span><span class="owner-admin-entry-copy"><strong>Administração</strong><span>Utilizadores, distritos, denúncias e moderadores</span></span><span class="owner-admin-entry-arrow">›</span><span class="owner-admin-badge hidden" id="ownerAdminBadge">0</span>';
    profilePanel.insertBefore(entry,profilePanel.firstChild);
    entry.addEventListener('click',openConsole);
  }
  const oldTab=$('adminTab');
  if(oldTab) oldTab.classList.add('owner-admin-tab-hidden');
  return entry;
}

function ensureConsole(){
  const box=document.querySelector('#accountModal .box');
  if(!box) return null;
  let panel=$('ownerConsolePage');
  if(!panel){
    panel=document.createElement('section');
    panel.id='ownerConsolePage';
    panel.className='account-panel';
    panel.dataset.accountPanel='owner-console';
    box.appendChild(panel);
  }
  return panel;
}

async function pendingCount(){
  if(role!=='owner') return 0;
  const {data,error}=await S.rpc('moderation_pending_report_count');
  return error?0:Number(data||0);
}
async function refreshEntryBadge(){
  if(role!=='owner') return;
  ensureEntry();
  const n=await pendingCount();
  const badge=$('ownerAdminBadge');
  if(badge){badge.textContent=n>99?'99+':String(n);badge.classList.toggle('hidden',!n);}
}

async function openConsole(){
  if(await syncRole()!=='owner') return;
  const panel=ensureConsole(); if(!panel) return;
  document.querySelectorAll('#accountModal .account-tab').forEach(b=>b.classList.remove('on'));
  document.querySelectorAll('#accountModal .account-panel').forEach(p=>p.classList.remove('on'));
  panel.classList.add('on');
  await renderConsole();
  panel.scrollIntoView({block:'start'});
}

function backToAccount(){
  document.querySelector('#accountModal [data-account-tab="profile"]')?.click();
  setTimeout(()=>ensureEntry(),40);
}

function directoryOptions(){return `<option value="">Todos os distritos</option>${districts.map(d=>`<option value="${d}">${d}</option>`).join('')}<option value="__none__">Sem distrito</option>`;}

function userCard(u){
  const photo=u.avatar_url?`<img src="${esc(u.avatar_url)}" alt="Foto de ${esc(u.display_name||'utilizador')}">`:esc(initials(u.display_name));
  const reports=Number(u.reports_total||0), open=Number(u.reports_open||0);
  const reportsChip=reports?`<button class="owner-report-chip ${open?'':'no-open'}" type="button" data-owner-user-reports="${u.user_id}">🚩 ${reports} ${reports===1?'report':'reports'}${open?` · ${open} ${open===1?'pendente':'pendentes'}`:''}</button>`:'';
  const isSelf=session?.user?.id===u.user_id;
  const moderator=u.admin_role==='moderator';
  const status=u.moderation_status||'active';
  let actions='';
  if(!isSelf){
    if(status==='active') actions+=`<button class="warn" data-owner-restrict="${u.user_id}">Restringir 7 dias</button><button class="danger" data-owner-block="${u.user_id}">Bloquear</button>`;
    else actions+=`<button class="good" data-owner-activate="${u.user_id}">Reativar</button>`;
    actions+=moderator?`<button data-owner-role="none" data-user-id="${u.user_id}">Retirar moderador</button>`:`<button class="dark" data-owner-role="moderator" data-user-id="${u.user_id}">Tornar moderador</button>`;
  }
  return `<article class="owner-user-card" data-owner-user-card="${u.user_id}"><div class="owner-user-main"><span class="owner-user-avatar">${photo}</span><div class="owner-user-copy"><strong>${esc(u.display_name||'Utilizador')}${moderator?' · Moderador':''}</strong><span class="owner-user-meta">${esc(u.district||'Sem distrito')} · ${esc(accountLabel(u.account_type))}${u.professional_name?` · PRO: ${esc(u.professional_name)}`:''} · ${esc(statusLabel(status))}</span>${reportsChip}</div></div>${actions?`<div class="owner-user-actions">${actions}</div>`:''}<div class="owner-report-detail" id="ownerReports-${u.user_id}" hidden></div></article>`;
}

async function loadDirectory(){
  const host=$('ownerUserList'); if(!host) return;
  host.innerHTML='<div class="owner-console-empty">A carregar utilizadores…</div>';
  const district=$('ownerDistrictFilter')?.value||'';
  const query=$('ownerUserSearch')?.value.trim()||'';
  const rpcDistrict=district==='__none__'?'__none__':district;
  const {data,error}=await S.rpc('owner_user_directory',{p_district:rpcDistrict,p_query:query,p_limit:250});
  if(error){console.error(error);host.innerHTML='<div class="owner-console-empty">Não foi possível carregar os utilizadores.</div>';return;}
  lastDirectory=data||[];
  host.innerHTML=lastDirectory.length?lastDirectory.map(userCard).join(''):'<div class="owner-console-empty">Nenhum utilizador encontrado.</div>';
  const total=$('ownerUsersCount');if(total)total.textContent=String(lastDirectory.length);
  const mods=$('ownerModeratorsCount');if(mods)mods.textContent=String(lastDirectory.filter(u=>u.admin_role==='moderator').length);
}

async function showUserReports(userId){
  const host=$(`ownerReports-${userId}`); if(!host)return;
  if(!host.hidden){host.hidden=true;return;}
  host.hidden=false;host.innerHTML='<div class="owner-console-empty">A carregar reports…</div>';
  const {data,error}=await S.rpc('owner_user_reports',{p_user_id:userId,p_limit:50});
  if(error){host.innerHTML='<div class="owner-console-empty">Não foi possível carregar os reports.</div>';return;}
  const rows=data||[];
  host.innerHTML=rows.length?rows.map(r=>`<div class="owner-report-row"><strong>${esc(typeLabels[r.target_type]||'Report')} · ${esc(reasonLabels[r.reason]||r.reason)} · ${esc(r.status==='open'?'Pendente':r.status==='confirmed'?'Infração confirmada':'Sem infração')}</strong>${r.content_preview?`<p>${esc(r.content_preview)}</p>`:''}<small>Denunciado por ${esc(r.reporter_name||'Utilizador')} · ${new Date(r.created_at).toLocaleString('pt-PT')}${r.reviewed_at?` · revisto por ${esc(r.reviewed_by_name||'moderação')}`:''}</small></div>`).join(''):'<div class="owner-console-empty">Este utilizador não tem reports.</div>';
}

async function loadPendingReports(){
  const host=$('ownerPendingReports');if(!host)return;
  host.innerHTML='<div class="owner-console-empty">A carregar denúncias…</div>';
  const {data,error}=await S.rpc('moderation_report_queue',{p_status:'open',p_limit:50});
  if(error){console.error(error);host.innerHTML='<div class="owner-console-empty">Não foi possível carregar as denúncias.</div>';return;}
  const rows=data||[];
  host.innerHTML=rows.length?rows.map(r=>`<article class="owner-pending-report"><strong>${esc(typeLabels[r.target_type]||'Denúncia')} · ${esc(r.target_name||'Utilizador')}</strong><span class="owner-user-meta">${esc(reasonLabels[r.reason]||r.reason)} · denunciado por ${esc(r.reporter_name||'Utilizador')} · ${new Date(r.created_at).toLocaleString('pt-PT')}</span>${r.content_preview?`<p>${esc(r.content_preview)}</p>`:''}<div class="owner-pending-actions"><button class="confirm" data-owner-report-decision="confirmed" data-report-id="${r.report_id}">Confirmar infração</button><button data-owner-report-decision="dismissed" data-report-id="${r.report_id}">Sem infração</button></div></article>`).join(''):'<div class="owner-console-empty">Não existem denúncias pendentes.</div>';
  const count=$('ownerPendingCount');if(count)count.textContent=String(rows.length);
  await refreshEntryBadge();
}

async function reviewReport(id,decision){
  const note=prompt(decision==='confirmed'?'Nota da auditoria, opcional:':'Motivo para arquivar, opcional:');
  if(note===null)return;
  const {data,error}=await S.rpc('moderation_review_report',{p_report_id:id,p_decision:decision,p_note:note.trim()||null});
  if(error||!data){toast('Não foi possível concluir a auditoria.');return;}
  toast(decision==='confirmed'?'Infração confirmada':'Denúncia arquivada');
  await Promise.all([loadPendingReports(),loadDirectory()]);
}

async function setStatus(userId,status){
  const reason=status==='active'?null:prompt(status==='blocked'?'Motivo do bloqueio:':'Motivo da restrição:');
  if(status!=='active'&&reason===null)return;
  const until=status==='restricted'?new Date(Date.now()+7*86400000).toISOString():null;
  const {error}=await S.rpc('admin_set_user_status',{p_user_id:userId,p_status:status,p_reason:reason?.trim()||null,p_restricted_until:until});
  if(error){toast('Não foi possível alterar a conta.');return;}
  toast(status==='active'?'Conta reativada':status==='blocked'?'Conta bloqueada':'Conta restringida por 7 dias');
  await loadDirectory();
}

async function setModerator(userId,newRole){
  if(!confirm(newRole==='moderator'?'Nomear este utilizador como moderador de reports?':'Retirar a função de moderador?'))return;
  const {error}=await S.rpc('admin_set_role',{p_user_id:userId,p_role:newRole});
  if(error){toast('Não foi possível alterar a função.');return;}
  toast(newRole==='moderator'?'Moderador nomeado':'Função de moderador retirada');
  await loadDirectory();
}

async function renderConsole(){
  const panel=ensureConsole();if(!panel)return;
  panel.innerHTML=`<div class="owner-console"><div class="owner-console-top"><button class="owner-console-back" id="ownerConsoleBack" type="button">‹ Conta</button><div class="owner-console-title"><h3>🛡️ Administração</h3><span>Owner único da plataforma</span></div></div><div class="owner-console-summary"><div class="owner-summary-card"><strong id="ownerUsersCount">0</strong><span>Utilizadores visíveis</span></div><div class="owner-summary-card"><strong id="ownerPendingCount">0</strong><span>Reports pendentes</span></div><div class="owner-summary-card"><strong id="ownerModeratorsCount">0</strong><span>Moderadores</span></div></div><section class="owner-console-section"><h4>Utilizadores por distrito</h4><div class="owner-directory-tools"><select id="ownerDistrictFilter">${directoryOptions()}</select><input id="ownerUserSearch" placeholder="Pesquisar pelo nome"><button class="btn dark" id="ownerUserSearchBtn" type="button">Pesquisar</button></div><div class="owner-user-list" id="ownerUserList"></div></section><section class="owner-console-section"><h4>Denúncias pendentes</h4><div class="owner-pending-list" id="ownerPendingReports"></div></section></div>`;
  $('ownerConsoleBack').onclick=backToAccount;
  $('ownerUserSearchBtn').onclick=()=>loadDirectory().catch(console.error);
  $('ownerDistrictFilter').onchange=()=>loadDirectory().catch(console.error);
  $('ownerUserSearch').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();loadDirectory().catch(console.error);}});
  await Promise.all([loadDirectory(),loadPendingReports()]);
}

function bind(){
  document.addEventListener('click',e=>{
    const reports=e.target.closest?.('[data-owner-user-reports]');if(reports){showUserReports(reports.dataset.ownerUserReports).catch(console.error);return;}
    const restrict=e.target.closest?.('[data-owner-restrict]');if(restrict){setStatus(restrict.dataset.ownerRestrict,'restricted').catch(console.error);return;}
    const block=e.target.closest?.('[data-owner-block]');if(block){setStatus(block.dataset.ownerBlock,'blocked').catch(console.error);return;}
    const active=e.target.closest?.('[data-owner-activate]');if(active){setStatus(active.dataset.ownerActivate,'active').catch(console.error);return;}
    const mod=e.target.closest?.('[data-owner-role]');if(mod){setModerator(mod.dataset.userId,mod.dataset.ownerRole).catch(console.error);return;}
    const decision=e.target.closest?.('[data-owner-report-decision]');if(decision){reviewReport(decision.dataset.reportId,decision.dataset.ownerReportDecision).catch(console.error);return;}
    if(e.target.closest?.('#navAccount,#accountCta,[data-account-tab="profile"]')) setTimeout(()=>{ensureEntry();refreshEntryBadge().catch(()=>{});},120);
  });
  const account=$('accountModal');
  if(account) new MutationObserver(()=>{if(account.classList.contains('open')){ensureEntry();refreshEntryBadge().catch(()=>{});}}).observe(account,{attributes:true,attributeFilter:['class']});
  new MutationObserver(()=>{if(role==='owner'){ensureEntry();const old=$('adminTab');if(old)old.classList.add('owner-admin-tab-hidden');}}).observe(document.body,{childList:true,subtree:true});
}

async function init(){
  bind();
  await syncRole();
  if(role==='owner'){
    ensureEntry();
    await refreshEntryBadge();
    timer=setInterval(()=>refreshEntryBadge().catch(()=>{}),20000);
  }
  S.auth.onAuthStateChange((_e,next)=>{session=next;clearInterval(timer);timer=null;setTimeout(async()=>{await syncRole();if(role==='owner'){ensureEntry();await refreshEntryBadge();timer=setInterval(()=>refreshEntryBadge().catch(()=>{}),20000);}},0);});
}
init().catch(console.error);
