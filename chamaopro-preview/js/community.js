import { supabase as S } from './supabase.js';
import { getSession } from './auth.js';
import { deviceAlert } from './alerts.js';

const $ = (id) => document.getElementById(id);
let session = null;
let currentPublicProfessionalId = null;
let currentChatThread = null;
let realtimeChannel = null;
let inboxTimer = null;
let renderingOwn = false;
let renderingPublic = false;

const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const escapeAttr = escapeHtml;
const initial = (name) => String(name || 'U').trim().charAt(0).toUpperCase() || 'U';
const verifiedMark = (ok) => ok ? '<span class="community-verified" title="Conta verificada" aria-label="Conta verificada">✓</span>' : '';
const avatar = (url, name, cls = 'community-avatar') => `<span class="${cls}">${url ? `<img src="${escapeAttr(url)}" alt="Fotografia de ${escapeAttr(name)}">` : escapeHtml(initial(name))}</span>`;

async function ensureSession() {
  session = getSession();
  if (!session) session = (await S.auth.getSession()).data.session;
  return session;
}

function showToast(message) {
  const el = $('toast');
  if (!el) return;
  el.textContent = message;
  el.classList.add('on');
  setTimeout(() => el.classList.remove('on'), 2800);
}

function openAuth() {
  $('authBtn')?.click();
}

function injectUi() {
  const tabs = document.querySelector('#accountModal .account-tabs');
  const accountBox = document.querySelector('#accountModal .box');
  if (tabs && accountBox && !$('communityMessagesTab')) {
    const tab = document.createElement('button');
    tab.id = 'communityMessagesTab';
    tab.className = 'account-tab';
    tab.type = 'button';
    tab.dataset.accountTab = 'messages';
    tab.textContent = 'Mensagens';
    tabs.appendChild(tab);

    const panel = document.createElement('section');
    panel.className = 'account-panel';
    panel.dataset.accountPanel = 'messages';
    panel.innerHTML = '<h3>Mensagens entre utilizadores</h3><p class="account-privacy-note">Entre utilizadores, a conversa só fica disponível depois de o destinatário aceitar o pedido. Antes disso, vê apenas quem enviou e a mensagem de apresentação.</p><div id="communityInbox" class="community-inbox"><div class="community-empty">A carregar…</div></div>';
    accountBox.appendChild(panel);

    tab.onclick = async () => {
      document.querySelectorAll('.account-tab').forEach((b) => b.classList.toggle('on', b === tab));
      document.querySelectorAll('.account-panel').forEach((p) => p.classList.toggle('on', p === panel));
      await renderInbox();
    };
  }

  if (!$('communityUserModal')) {
    document.body.insertAdjacentHTML('beforeend', `
      <div class="modal" id="communityUserModal"><div class="box">
        <button class="x" id="communityUserClose" type="button">×</button>
        <div id="communityUserBody" class="community-user-card"></div>
      </div></div>
      <div class="modal" id="communityChatModal"><div class="box wide">
        <button class="x" id="communityChatClose" type="button">×</button>
        <div id="communityChatHead" class="community-chat-head"></div>
        <div id="communityChatMessages" class="community-chat-messages"></div>
        <form id="communityChatForm" class="community-chat-form">
          <textarea id="communityChatText" rows="2" maxlength="2000" placeholder="Escreve uma mensagem…" required></textarea>
          <button type="submit">Enviar</button>
        </form>
        <div id="communityChatStatus" class="community-contact-status"></div>
      </div></div>`);
    $('communityUserClose').onclick = () => $('communityUserModal').classList.remove('open');
    $('communityChatClose').onclick = () => { $('communityChatModal').classList.remove('open'); currentChatThread = null; };
    $('communityChatForm').addEventListener('submit', sendChatMessage);
  }
}

function personButton(row) {
  return `<button class="community-person" type="button" data-community-user="${row.author_id}">${avatar(row.avatar_url,row.author_name)}<span>${escapeHtml(row.author_name)}${verifiedMark(Boolean(row.is_identity_verified))}</span>${row.is_professional ? '<span class="community-pro-label">PRO</span>' : ''}</button>`;
}

function buildReplyTree(replies, reviewId, parentId = null, depth = 1, visited = new Set()) {
  if (depth > 25) return '';
  return replies
    .filter((r) => r.review_id === reviewId && (r.parent_id || null) === parentId)
    .map((reply) => {
      if (visited.has(reply.reply_id)) return '';
      const nextVisited = new Set(visited); nextVisited.add(reply.reply_id);
      return `<div class="community-reply" style="--depth:${Math.min(depth,4)}" data-reply-id="${reply.reply_id}">
        <div class="community-reply-head">${personButton(reply)}<span class="community-date">${new Date(reply.created_at).toLocaleString('pt-PT',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})}</span></div>
        <div class="community-body">${escapeHtml(reply.body || '')}</div>
        <button class="community-reply-action" type="button" data-community-reply data-review-id="${reviewId}" data-parent-id="${reply.reply_id}">Responder</button>
        ${buildReplyTree(replies,reviewId,reply.reply_id,depth+1,nextVisited)}
      </div>`;
    }).join('');
}

async function renderReviewThreads(professionalId, container, mode = 'public') {
  if (!professionalId || !container) return;
  if (mode === 'public') renderingPublic = true; else renderingOwn = true;
  container.dataset.communityFor = professionalId;
  container.innerHTML = '<div class="profile-review-empty">A carregar comentários…</div>';
  try {
    const { data, error } = await S.rpc('public_professional_review_threads', { p_professional_id: professionalId, p_limit: 30 });
    if (error) throw error;
    const rows = data || [];
    const reviews = rows.filter((r) => r.kind === 'review');
    const replies = rows.filter((r) => r.kind === 'reply');
    if (!reviews.length) {
      container.innerHTML = '<div class="profile-review-empty community-thread-list" data-community-thread-root="1">Este profissional ainda não tem avaliações.</div>';
      return;
    }
    container.innerHTML = `<div class="community-thread-list" data-community-thread-root="1">${reviews.map((review) => `
      <article class="community-review" data-review-id="${review.review_id}">
        <div class="community-review-meta"><div>${personButton(review)}</div><span class="community-date">${new Date(review.created_at).toLocaleDateString('pt-PT')}</span></div>
        <div class="community-stars">${'★'.repeat(Number(review.rating || 0))}${'☆'.repeat(Math.max(0,5-Number(review.rating || 0)))}</div>
        <div class="community-body">${review.body ? escapeHtml(review.body) : '<em>Sem comentário escrito.</em>'}</div>
        <button class="community-root-reply" type="button" data-community-reply data-review-id="${review.review_id}" data-parent-id="">Responder</button>
        <div class="community-replies">${buildReplyTree(replies,review.review_id)}</div>
      </article>`).join('')}</div>`;
  } catch (error) {
    console.error(error);
    container.innerHTML = '<div class="profile-review-empty" data-community-thread-root="1">Não foi possível carregar os comentários.</div>';
  } finally {
    if (mode === 'public') renderingPublic = false; else renderingOwn = false;
  }
}

async function refreshReviewViews(professionalId) {
  const publicContainer = $('publicProReviews');
  if (publicContainer && currentPublicProfessionalId === professionalId) await renderReviewThreads(professionalId, publicContainer, 'public');
  const own = document.querySelector('#accountProfessional .own-reviews');
  if (own && session?.user?.id === professionalId) await renderReviewThreads(professionalId, own, 'own');
}

function openReplyComposer(button) {
  document.querySelectorAll('.community-reply-form').forEach((f) => f.remove());
  const reviewId = button.dataset.reviewId;
  const parentId = button.dataset.parentId || null;
  const host = button.closest('.community-reply') || button.closest('.community-review');
  if (!host) return;
  const form = document.createElement('form');
  form.className = 'community-reply-form';
  form.innerHTML = `<textarea maxlength="1000" placeholder="Escreve a tua resposta…" required></textarea><div class="community-reply-actions"><button class="cancel" type="button">Cancelar</button><button class="send" type="submit">Responder</button></div>`;
  button.insertAdjacentElement('afterend',form);
  form.querySelector('.cancel').onclick = () => form.remove();
  form.onsubmit = async (event) => {
    event.preventDefault();
    if (!await ensureSession()) { form.remove(); openAuth(); return; }
    const body = form.querySelector('textarea').value.trim();
    if (!body) return;
    const send = form.querySelector('.send'); send.disabled = true; send.textContent = 'A enviar…';
    const { error } = await S.rpc('add_professional_review_reply', { p_review_id: reviewId, p_parent_id: parentId, p_body: body });
    if (error) {
      console.error(error); send.disabled = false; send.textContent = 'Responder'; showToast(error.message?.includes('rate limit') ? 'Muitas respostas em pouco tempo. Tenta novamente mais tarde.' : 'Não foi possível publicar a resposta.'); return;
    }
    form.remove();
    const professionalId = host.closest('[data-community-for]')?.dataset.communityFor || currentPublicProfessionalId || session?.user?.id;
    await refreshReviewViews(professionalId);
  };
  form.querySelector('textarea').focus();
}

async function openUserProfile(userId) {
  if (!userId) return;
  injectUi();
  const body = $('communityUserBody');
  body.innerHTML = '<div class="community-empty">A carregar perfil…</div>';
  $('communityUserModal').classList.add('open');
  const { data, error } = await S.rpc('public_user_profile', { p_user_id: userId });
  const profile = data?.[0];
  if (error || !profile) { body.innerHTML = '<div class="community-empty">Não foi possível abrir este perfil.</div>'; return; }
  await ensureSession();
  const isSelf = session?.user?.id === userId;
  body.innerHTML = `
    <div class="community-user-avatar">${profile.avatar_url ? `<img src="${escapeAttr(profile.avatar_url)}" alt="Fotografia de perfil">` : escapeHtml(initial(profile.display_name))}</div>
    <h2 class="community-user-name">${escapeHtml(profile.display_name)} ${verifiedMark(Boolean(profile.is_identity_verified))}</h2>
    <div class="community-user-sub">${profile.is_identity_verified ? 'Identidade verificada' : 'Identidade ainda não verificada'}${profile.has_public_professional_profile ? ' · Também tem perfil profissional' : ''}</div>
    ${isSelf ? '<div class="account-privacy-note">Este é o teu perfil público.</div>' : !session ? '<button class="btn primary full" id="communityNeedLogin" type="button">Entrar para enviar mensagem</button>' : `<div class="community-contact-box"><strong>Enviar pedido de mensagem</strong><p class="community-user-sub">A outra pessoa vê quem és e esta mensagem. A conversa só abre se aceitar.</p><textarea id="communityIntro" maxlength="500" placeholder="Olá, gostava de falar contigo…"></textarea><button class="btn primary full" id="communityRequestMessage" type="button">Enviar pedido</button><div id="communityRequestStatus" class="community-contact-status"></div></div>`}
  `;
  $('communityNeedLogin')?.addEventListener('click', () => { $('communityUserModal').classList.remove('open'); openAuth(); });
  $('communityRequestMessage')?.addEventListener('click', () => requestMessage(userId, profile.display_name));
}

async function requestMessage(recipientId, recipientName) {
  if (!await ensureSession()) { openAuth(); return; }
  const intro = $('communityIntro')?.value.trim();
  const statusEl = $('communityRequestStatus');
  if (!intro) { if (statusEl) statusEl.textContent = 'Escreve uma pequena mensagem de apresentação.'; return; }
  const btn = $('communityRequestMessage'); if (btn) { btn.disabled = true; btn.textContent = 'A enviar…'; }
  const { data, error } = await S.rpc('request_user_message', { p_recipient_id: recipientId, p_intro_message: intro });
  if (btn) { btn.disabled = false; btn.textContent = 'Enviar pedido'; }
  if (error) { console.error(error); if (statusEl) statusEl.textContent = 'Não foi possível enviar o pedido.'; return; }
  const result = data?.[0];
  if (!result) return;
  if (result.status === 'accepted') {
    $('communityUserModal').classList.remove('open');
    await renderInbox();
    const threads = await loadThreads();
    const thread = threads.find((t) => t.request_id === result.request_id);
    if (thread) openUserChat(thread);
    return;
  }
  if (result.direction === 'incoming') {
    if (statusEl) statusEl.textContent = `${recipientName} já te enviou um pedido. Podes aceitá-lo na secção Mensagens.`;
  } else {
    if (statusEl) statusEl.textContent = 'Pedido enviado. A conversa fica disponível quando a outra pessoa aceitar.';
    showToast('Pedido de mensagem enviado');
  }
  renderInbox().catch(() => {});
}

async function loadThreads() {
  if (!await ensureSession()) return [];
  const { data, error } = await S.rpc('my_user_message_threads');
  if (error) { console.error(error); return []; }
  return data || [];
}

function setMessageBadge(count) {
  for (const id of ['communityMessagesTab','navAccount']) {
    const el = $(id); if (!el) continue;
    let badge = el.querySelector('.community-message-badge');
    if (!count) { badge?.remove(); continue; }
    if (!badge) { badge = document.createElement('span'); badge.className = 'notification-badge community-message-badge'; el.appendChild(badge); }
    badge.textContent = count > 9 ? '9+' : String(count);
  }
}

async function renderInbox() {
  injectUi();
  const inbox = $('communityInbox'); if (!inbox) return;
  if (!await ensureSession()) { inbox.innerHTML = '<div class="community-empty">Entra na tua conta para veres as mensagens.</div>'; setMessageBadge(0); return; }
  const threads = await loadThreads();
  const pendingIncoming = threads.filter((t) => t.status === 'pending' && t.direction === 'incoming').length;
  setMessageBadge(pendingIncoming);
  if (!threads.length) { inbox.innerHTML = '<div class="community-empty">Ainda não tens pedidos de mensagem nem conversas.</div>'; return; }
  inbox.innerHTML = threads.map((t) => {
    const pendingIn = t.status === 'pending' && t.direction === 'incoming';
    const pendingOut = t.status === 'pending' && t.direction === 'outgoing';
    const accepted = t.status === 'accepted';
    const state = accepted ? 'Conversa aceite' : pendingIn ? 'Novo pedido' : pendingOut ? 'A aguardar aceitação' : t.status === 'rejected' ? 'Pedido recusado' : 'Pedido terminado';
    const preview = accepted ? (t.last_message || t.intro_message) : t.intro_message;
    return `<article class="community-message-card ${pendingIn ? 'pending-in' : ''}" data-message-thread="${t.request_id}">
      <div class="community-message-top"><button class="community-person" type="button" data-community-user="${t.other_user_id}">${avatar(t.other_avatar_url,t.other_name)}<span>${escapeHtml(t.other_name)}${verifiedMark(Boolean(t.other_is_verified))}</span></button><span class="community-message-state">${escapeHtml(state)}</span></div>
      <div class="community-message-preview">${escapeHtml(preview || '')}</div>
      <div class="community-message-actions">
        ${pendingIn ? `<button class="accept" type="button" data-message-accept="${t.request_id}">Aceitar</button><button class="reject" type="button" data-message-reject="${t.request_id}">Recusar</button>` : ''}
        ${accepted ? `<button class="open" type="button" data-message-open="${t.request_id}">Abrir conversa</button>` : ''}
        ${pendingOut ? '<button class="muted" type="button" disabled>Pedido enviado</button>' : ''}
        ${t.status === 'rejected' ? `<button class="muted" type="button" data-community-user="${t.other_user_id}">Ver perfil</button>` : ''}
      </div>
    </article>`;
  }).join('');
  inbox.querySelectorAll('[data-message-accept]').forEach((b) => b.onclick = () => respondRequest(b.dataset.messageAccept,true));
  inbox.querySelectorAll('[data-message-reject]').forEach((b) => b.onclick = () => respondRequest(b.dataset.messageReject,false));
  inbox.querySelectorAll('[data-message-open]').forEach((b) => b.onclick = () => { const t=threads.find((x)=>x.request_id===b.dataset.messageOpen); if(t) openUserChat(t); });
}

async function respondRequest(requestId, accept) {
  const { data, error } = await S.rpc('respond_user_message_request', { p_request_id: requestId, p_accept: accept });
  if (error || !data) { showToast('Não foi possível atualizar o pedido.'); return; }
  showToast(accept ? 'Pedido aceite. Já podem conversar.' : 'Pedido recusado.');
  await renderInbox();
  if (accept) {
    const threads = await loadThreads();
    const thread = threads.find((t) => t.request_id === requestId);
    if (thread) openUserChat(thread);
  }
}

async function openUserChat(thread) {
  if (!thread || thread.status !== 'accepted') return;
  currentChatThread = thread;
  injectUi();
  $('communityChatHead').innerHTML = `${avatar(thread.other_avatar_url,thread.other_name)}<div><strong>${escapeHtml(thread.other_name)} ${verifiedMark(Boolean(thread.other_is_verified))}</strong><small style="display:block;color:var(--muted);margin-top:3px">Conversa aceite entre utilizadores</small></div>`;
  $('communityChatModal').classList.add('open');
  await renderChatHistory();
}

async function renderChatHistory() {
  if (!currentChatThread) return;
  const box = $('communityChatMessages');
  const { data, error } = await S.rpc('user_message_history', { p_request_id: currentChatThread.request_id });
  if (error) { box.innerHTML = '<div class="community-empty">Não foi possível carregar a conversa.</div>'; return; }
  const rows = data || [];
  box.innerHTML = `<div class="community-chat-intro">Pedido inicial: “${escapeHtml(currentChatThread.intro_message || '')}”</div>${rows.map((m) => `<div class="community-chat-bubble ${m.sender_id === session?.user?.id ? 'mine' : ''}"><small>${escapeHtml(m.sender_name)} · ${new Date(m.created_at).toLocaleString('pt-PT',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})}</small><p>${escapeHtml(m.body)}</p></div>`).join('')}`;
  box.scrollTop = box.scrollHeight;
}

async function sendChatMessage(event) {
  event.preventDefault();
  if (!currentChatThread || !await ensureSession()) return;
  const input = $('communityChatText'); const text = input.value.trim(); if (!text) return;
  const status = $('communityChatStatus'); status.textContent = 'A enviar…';
  const { error } = await S.rpc('send_user_message', { p_request_id: currentChatThread.request_id, p_body: text });
  if (error) { console.error(error); status.textContent = error.message?.includes('rate limit') ? 'Estás a enviar mensagens demasiado depressa.' : 'Não foi possível enviar.'; return; }
  input.value = ''; status.textContent = '';
  await renderChatHistory();
  renderInbox().catch(() => {});
}

function installReviewObservers() {
  const publicContainer = $('publicProReviews');
  if (publicContainer && !publicContainer.dataset.communityObserved) {
    publicContainer.dataset.communityObserved = '1';
    const obs = new MutationObserver(() => {
      if (!currentPublicProfessionalId || renderingPublic) return;
      if (publicContainer.querySelector('[data-community-thread-root]') && publicContainer.dataset.communityFor === currentPublicProfessionalId) return;
      setTimeout(() => renderReviewThreads(currentPublicProfessionalId,publicContainer,'public'),0);
    });
    obs.observe(publicContainer,{childList:true,subtree:true});
  }

  const professionalArea = $('accountProfessional');
  if (professionalArea && !professionalArea.dataset.communityObserved) {
    professionalArea.dataset.communityObserved = '1';
    const obs = new MutationObserver(async () => {
      if (renderingOwn) return;
      const own = professionalArea.querySelector('.own-reviews');
      if (!own) return;
      await ensureSession();
      if (!session) return;
      if (own.querySelector('[data-community-thread-root]') && own.dataset.communityFor === session.user.id) return;
      setTimeout(() => renderReviewThreads(session.user.id,own,'own'),0);
    });
    obs.observe(professionalArea,{childList:true,subtree:true});
  }
}

async function startRealtime() {
  if (realtimeChannel) { S.removeChannel(realtimeChannel); realtimeChannel=null; }
  if (inboxTimer) { clearInterval(inboxTimer); inboxTimer=null; }
  if (!await ensureSession()) { setMessageBadge(0); return; }
  const uid = session.user.id;
  realtimeChannel = S.channel(`community-${uid}-${Date.now()}`)
    .on('postgres_changes',{event:'INSERT',schema:'public',table:'user_message_requests'},(payload)=>{
      if (payload.new?.recipient_id === uid) deviceAlert('Novo pedido de mensagem','Vê quem te quer contactar na secção Mensagens.',`user-request-${payload.new.id}`).catch(()=>{});
      renderInbox().catch(()=>{});
    })
    .on('postgres_changes',{event:'UPDATE',schema:'public',table:'user_message_requests'},(payload)=>{
      if (payload.new?.sender_id === uid && payload.new?.status === 'accepted' && payload.old?.status !== 'accepted') deviceAlert('Pedido de mensagem aceite','Já podes iniciar a conversa.',`user-request-accepted-${payload.new.id}`).catch(()=>{});
      renderInbox().catch(()=>{});
    })
    .on('postgres_changes',{event:'INSERT',schema:'public',table:'user_messages'},(payload)=>{
      if (payload.new?.sender_id !== uid) deviceAlert('Nova mensagem','Recebeste uma nova mensagem no Chama O Pro.',`user-message-${payload.new?.id}`).catch(()=>{});
      if (currentChatThread?.request_id === payload.new?.request_id) renderChatHistory().catch(()=>{});
      renderInbox().catch(()=>{});
    })
    .on('postgres_changes',{event:'INSERT',schema:'public',table:'professional_comments',filter:`professional_id=eq.${uid}`},(payload)=>{
      if (payload.new?.author_id !== uid) deviceAlert('Nova resposta numa avaliação','Alguém respondeu a um comentário no teu perfil profissional.',`review-reply-${payload.new?.id}`).catch(()=>{});
      refreshReviewViews(uid).catch(()=>{});
    })
    .subscribe();
  inboxTimer = setInterval(() => renderInbox().catch(()=>{}),15000);
  renderInbox().catch(()=>{});
}

function bindGlobalCommunityClicks() {
  document.addEventListener('click',(event)=>{
    const user = event.target.closest?.('[data-community-user]');
    if (user && !event.target.closest?.('[data-message-accept],[data-message-reject],[data-message-open]')) { openUserProfile(user.dataset.communityUser).catch(console.error); return; }
    const reply = event.target.closest?.('[data-community-reply]');
    if (reply) { ensureSession().then((s)=> s ? openReplyComposer(reply) : openAuth()); return; }
    const view = event.target.closest?.('.view-pro[data-professional]');
    if (view) {
      currentPublicProfessionalId = view.dataset.professional;
      const container = $('publicProReviews');
      if (container) {
        container.dataset.communityFor = currentPublicProfessionalId;
        setTimeout(()=>renderReviewThreads(currentPublicProfessionalId,container,'public'),80);
      }
    }
    if (event.target.closest?.('#navPro,#proCta,[data-account-tab="professional"]')) {
      setTimeout(async()=>{
        await ensureSession();
        const own=document.querySelector('#accountProfessional .own-reviews');
        if(own&&session) renderReviewThreads(session.user.id,own,'own');
      },350);
    }
  });
}

async function initCommunity() {
  injectUi();
  installReviewObservers();
  bindGlobalCommunityClicks();
  session = getSession() || (await S.auth.getSession()).data.session;
  await startRealtime();
  S.auth.onAuthStateChange((_event,nextSession)=>{
    session=nextSession;
    queueMicrotask(()=>startRealtime().catch(()=>{}));
  });
}

initCommunity().catch(console.error);
