/* Build 38: fonte única de notificações no backend, comentários repetíveis e eliminação segura. */
import { supabase as S } from './js/supabase.js';
import { getSession } from './js/auth.js';

const $ = (id) => document.getElementById(id);
const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const escapeAttr = escapeHtml;
const initial = (name) => String(name || 'U').trim().charAt(0).toUpperCase() || 'U';
let session = null;
let notificationChannel = null;
let socialChannel = null;
let notificationTimer = null;
let currentProfessionalId = null;
let currentDirectRequestId = null;
let currentServiceRequestId = null;
let serviceDecorating = false;
let notificationRefreshQueued = false;

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

function badgeText(count) {
  const n = Math.max(0, Number(count || 0));
  return n > 9 ? '9+' : String(n);
}

function renderBadge(targetId, count, extraClass = '') {
  const target = $(targetId);
  if (!target) return;
  const n = Math.max(0, Number(count || 0));
  const existing = [...target.querySelectorAll('.notification-badge')];
  if (!n) {
    existing.forEach((b) => b.remove());
    return;
  }
  let badge = existing[0] || document.createElement('span');
  existing.slice(1).forEach((b) => b.remove());
  badge.className = `notification-badge cop-root-badge ${extraClass}`.trim();
  badge.textContent = badgeText(n);
  badge.setAttribute('aria-label', `${n} ${n === 1 ? 'notificação não lida' : 'notificações não lidas'}`);
  const host = target.querySelector('.nav-icon') || target;
  if (badge.parentElement !== host) host.appendChild(badge);
}

async function refreshNotificationCounts() {
  notificationRefreshQueued = false;
  const s = await ensureSession();
  if (!s) {
    ['navRequests','navPro','navMessages','proCta'].forEach((id) => renderBadge(id, 0));
    $('navAccount')?.querySelectorAll('.community-message-badge').forEach((b) => b.remove());
    return;
  }
  const { data, error } = await S.rpc('notification_counts');
  if (error) {
    console.error('Falha ao ler notificações do backend:', error);
    return;
  }
  const counts = data || {};
  renderBadge('navRequests', counts.client_count || 0);
  renderBadge('navPro', counts.professional_count || 0);
  renderBadge('proCta', counts.professional_count || 0);
  renderBadge('navMessages', counts.messages_count || 0, 'cop-messages-badge');
  $('navAccount')?.querySelectorAll('.community-message-badge').forEach((b) => b.remove());
}

function queueNotificationRefresh() {
  if (notificationRefreshQueued) return;
  notificationRefreshQueued = true;
  setTimeout(() => refreshNotificationCounts().catch(console.error), 80);
}

function stopNotificationRealtime() {
  if (notificationChannel) S.removeChannel(notificationChannel);
  notificationChannel = null;
  if (notificationTimer) clearInterval(notificationTimer);
  notificationTimer = null;
}

async function startNotificationRealtime() {
  stopNotificationRealtime();
  if (!await ensureSession()) {
    await refreshNotificationCounts();
    return;
  }
  const uid = session.user.id;
  notificationChannel = S.channel(`notification-root-38-${uid}-${Date.now()}`)
    .on('postgres_changes', { event:'*', schema:'public', table:'service_notifications' }, queueNotificationRefresh)
    .on('postgres_changes', { event:'*', schema:'public', table:'user_messages' }, queueNotificationRefresh)
    .on('postgres_changes', { event:'*', schema:'public', table:'user_message_requests' }, queueNotificationRefresh)
    .subscribe();
  notificationTimer = setInterval(() => refreshNotificationCounts().catch(() => {}), 20000);
  await refreshNotificationCounts();
}

function personHtml(row) {
  const name = row.author_name || 'Utilizador';
  const image = row.avatar_url
    ? `<img src="${escapeAttr(row.avatar_url)}" alt="Fotografia de ${escapeAttr(name)}">`
    : escapeHtml(initial(name));
  return `<button class="community-person" type="button" data-community-user="${row.author_id}"><span class="community-avatar">${image}</span><span>${escapeHtml(name)}${row.is_identity_verified ? '<span class="community-verified" title="Conta verificada">✓</span>' : ''}</span>${row.is_professional ? '<span class="community-pro-label">PRO</span>' : ''}</button>`;
}

function buildProfileCommentTree(rows, parentId = null, depth = 0, visited = new Set()) {
  return rows.filter((r) => (r.parent_id || null) === parentId).map((row) => {
    if (visited.has(row.comment_id) || depth > 25) return '';
    const next = new Set(visited); next.add(row.comment_id);
    const own = Boolean(session?.user?.id && row.author_id === session.user.id);
    const canReply = Boolean(session && !row.is_deleted);
    const actions = [
      canReply ? `<button class="social38-action" type="button" data-profile-comment-reply="${row.comment_id}">Responder</button>` : '',
      own && !row.is_deleted ? `<button class="social38-action delete" type="button" data-profile-comment-delete="${row.comment_id}">Eliminar</button>` : '',
    ].join('');
    return `<article class="social38-comment ${row.is_deleted ? 'deleted' : ''}" style="--comment-depth:${Math.min(depth,4)}" data-profile-comment-id="${row.comment_id}">
      <div class="social38-comment-head">${personHtml(row)}<span class="social38-comment-date">${new Date(row.created_at).toLocaleString('pt-PT',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})}</span></div>
      <div class="social38-comment-body">${escapeHtml(row.body || 'Comentário eliminado')}</div>
      ${actions ? `<div class="social38-comment-actions">${actions}</div>` : ''}
      ${buildProfileCommentTree(rows,row.comment_id,depth+1,next)}
    </article>`;
  }).join('');
}

function publicCommentPanel() {
  const reviews = $('publicProReviews');
  if (!reviews) return null;
  let panel = $('social38PublicComments');
  if (!panel) {
    panel = document.createElement('section');
    panel.id = 'social38PublicComments';
    panel.className = 'social38-profile-comments';
    const heading = reviews.previousElementSibling?.tagName === 'H3' ? reviews.previousElementSibling : reviews;
    reviews.parentElement?.insertBefore(panel, heading);
  }
  return panel;
}

function ownCommentPanel() {
  const ownReviews = document.querySelector('#accountProfessional .own-reviews');
  if (!ownReviews) return null;
  let panel = $('social38OwnComments');
  if (!panel) {
    panel = document.createElement('section');
    panel.id = 'social38OwnComments';
    panel.className = 'social38-profile-comments';
    const heading = ownReviews.previousElementSibling?.tagName === 'H3' ? ownReviews.previousElementSibling : ownReviews;
    ownReviews.parentElement?.insertBefore(panel, heading);
  }
  return panel;
}

async function renderProfileComments(professionalId, panel, ownMode = false) {
  if (!professionalId || !panel) return;
  await ensureSession();
  panel.dataset.professionalId = professionalId;
  const { data, error } = await S.rpc('public_professional_profile_comments', { p_professional_id: professionalId, p_limit: 30 });
  if (error) {
    console.error(error);
    panel.innerHTML = '<h3>Comentários</h3><div class="social38-empty">Não foi possível carregar os comentários.</div>';
    return;
  }
  const rows = data || [];
  const isSelf = session?.user?.id === professionalId;
  const composer = ownMode || isSelf
    ? '<p class="social38-sub">Aqui aparecem comentários públicos deixados no teu perfil. Podes responder aos utilizadores e eliminar as tuas próprias respostas.</p>'
    : session
      ? `<p class="social38-sub">Podes comentar este profissional mais do que uma vez. As avaliações com estrelas continuam ligadas apenas a serviços concluídos.</p><form class="social38-comment-form" data-profile-comment-form="${professionalId}"><textarea maxlength="1000" placeholder="Escreve um comentário sobre este profissional…" required></textarea><button type="submit">Publicar comentário</button></form>`
      : '<p class="social38-sub">Os comentários são públicos. Para comentar ou responder, entra na tua conta.</p><button class="social38-login-comment" type="button" data-social38-login>Entrar para comentar</button>';
  panel.innerHTML = `<h3>Comentários da comunidade</h3>${composer}<div class="social38-comments-list">${rows.length ? buildProfileCommentTree(rows) : '<div class="social38-empty">Ainda não existem comentários livres neste perfil.</div>'}</div>`;
}

async function mountPublicComments(professionalId = currentProfessionalId) {
  if (!professionalId) return;
  currentProfessionalId = professionalId;
  const panel = publicCommentPanel();
  if (panel) await renderProfileComments(professionalId, panel, false);
  decorateReviewDeleteButtons();
}

async function mountOwnComments() {
  const s = await ensureSession();
  if (!s) return;
  const panel = ownCommentPanel();
  if (panel) await renderProfileComments(s.user.id, panel, true);
  decorateReviewDeleteButtons();
}

function decorateReviewDeleteButtons() {
  const uid = session?.user?.id;
  if (!uid) return;
  document.querySelectorAll('.community-review[data-review-id]').forEach((article) => {
    const authorId = article.querySelector('.community-review-meta [data-community-user]')?.dataset.communityUser;
    const body = article.querySelector(':scope > .community-body');
    if (authorId !== uid || !body || body.textContent.trim() === 'Sem comentário escrito.' || article.querySelector(':scope > .social38-review-actions')) return;
    const actions = document.createElement('div');
    actions.className = 'social38-review-actions';
    actions.innerHTML = `<button class="social38-action delete" type="button" data-delete-review-comment="${article.dataset.reviewId}">Eliminar comentário</button>`;
    body.insertAdjacentElement('afterend', actions);
  });
  document.querySelectorAll('.community-reply[data-reply-id]').forEach((reply) => {
    const authorId = reply.querySelector('.community-reply-head [data-community-user]')?.dataset.communityUser;
    const body = reply.querySelector(':scope > .community-body');
    if (authorId !== uid || !body || body.textContent.trim() === 'Comentário eliminado' || reply.querySelector(':scope > .social38-review-actions')) return;
    const actions = document.createElement('div');
    actions.className = 'social38-review-actions';
    actions.innerHTML = `<button class="social38-action delete" type="button" data-delete-thread-comment="${reply.dataset.replyId}">Eliminar</button>`;
    body.insertAdjacentElement('afterend', actions);
  });
}

function openStandaloneReply(button) {
  document.querySelectorAll('.social38-inline-reply').forEach((f) => f.remove());
  const host = button.closest('.social38-comment');
  if (!host) return;
  const form = document.createElement('form');
  form.className = 'social38-inline-reply';
  form.dataset.parentComment = button.dataset.profileCommentReply;
  form.innerHTML = '<textarea maxlength="1000" placeholder="Escreve a tua resposta…" required></textarea><div class="row"><button class="cancel" type="button">Cancelar</button><button type="submit">Responder</button></div>';
  button.closest('.social38-comment-actions')?.insertAdjacentElement('afterend', form);
  form.querySelector('.cancel').onclick = () => form.remove();
  form.querySelector('textarea').focus();
}

async function submitRootComment(form) {
  if (!await ensureSession()) { $('authBtn')?.click(); return; }
  const professionalId = form.dataset.profileCommentForm;
  const textarea = form.querySelector('textarea');
  const body = textarea?.value.trim();
  if (!body) return;
  const button = form.querySelector('button[type="submit"]');
  button.disabled = true; button.textContent = 'A publicar…';
  const { error } = await S.rpc('add_professional_profile_comment', { p_professional_id: professionalId, p_body: body });
  button.disabled = false; button.textContent = 'Publicar comentário';
  if (error) {
    console.error(error);
    showToast(error.message?.includes('rate limit') ? 'Muitos comentários em pouco tempo. Tenta novamente mais tarde.' : 'Não foi possível publicar o comentário.');
    return;
  }
  textarea.value = '';
  showToast('Comentário publicado');
  if (professionalId === currentProfessionalId) await mountPublicComments(professionalId);
  if (session?.user?.id === professionalId) await mountOwnComments();
}

async function submitStandaloneReply(form) {
  if (!await ensureSession()) { $('authBtn')?.click(); return; }
  const parentId = form.dataset.parentComment;
  const body = form.querySelector('textarea')?.value.trim();
  if (!body) return;
  const button = form.querySelector('button[type="submit"]');
  button.disabled = true; button.textContent = 'A responder…';
  const { error } = await S.rpc('reply_professional_profile_comment', { p_parent_id: parentId, p_body: body });
  if (error) {
    button.disabled = false; button.textContent = 'Responder';
    showToast(error.message?.includes('rate limit') ? 'Muitas respostas em pouco tempo.' : 'Não foi possível responder.');
    return;
  }
  const panel = form.closest('.social38-profile-comments');
  const professionalId = panel?.dataset.professionalId;
  form.remove();
  if (panel && professionalId) await renderProfileComments(professionalId, panel, panel.id === 'social38OwnComments');
}

async function deleteProfileComment(commentId, element) {
  if (!commentId || !await ensureSession() || !confirm('Eliminar este comentário?')) return;
  const { data, error } = await S.rpc('delete_professional_comment', { p_comment_id: commentId });
  if (error || !data) { showToast('Não foi possível eliminar o comentário.'); return; }
  const panel = element?.closest('.social38-profile-comments');
  const professionalId = panel?.dataset.professionalId;
  if (panel && professionalId) await renderProfileComments(professionalId, panel, panel.id === 'social38OwnComments');
  decorateReviewDeleteButtons();
  showToast('Comentário eliminado');
}

async function deleteReviewReply(commentId, button) {
  if (!commentId || !await ensureSession() || !confirm('Eliminar esta resposta?')) return;
  const { data, error } = await S.rpc('delete_professional_comment', { p_comment_id: commentId });
  if (error || !data) { showToast('Não foi possível eliminar a resposta.'); return; }
  const reply = button.closest('.community-reply');
  if (reply) {
    const body = reply.querySelector(':scope > .community-body');
    if (body) body.textContent = 'Comentário eliminado';
    reply.querySelector(':scope > .social38-review-actions')?.remove();
  }
  showToast('Resposta eliminada');
}

async function deleteReviewText(reviewId, button) {
  if (!reviewId || !await ensureSession() || !confirm('Eliminar o texto deste comentário? A avaliação em estrelas mantém-se.')) return;
  const { data, error } = await S.rpc('delete_professional_review_comment', { p_review_id: reviewId });
  if (error || !data) { showToast('Não foi possível eliminar o comentário.'); return; }
  const article = button.closest('.community-review');
  if (article) {
    const body = article.querySelector(':scope > .community-body');
    if (body) body.innerHTML = '<em>Sem comentário escrito.</em>';
    article.querySelector(':scope > .social38-review-actions')?.remove();
  }
  showToast('Comentário eliminado');
}

function directBubbleHtml(message) {
  const mine = message.sender_id === session?.user?.id;
  return `<div class="community-chat-bubble ${mine ? 'mine' : ''}" data-direct-message-id="${message.message_id}"><small>${escapeHtml(message.sender_name)} · ${new Date(message.created_at).toLocaleString('pt-PT',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})}</small><p>${escapeHtml(message.body)}</p>${mine ? `<button class="social38-delete-message" type="button" data-delete-direct-message="${message.message_id}">Eliminar</button>` : ''}</div>`;
}

async function inferDirectRequestId() {
  if (currentDirectRequestId) return currentDirectRequestId;
  if (!await ensureSession()) return null;
  const { data, error } = await S.rpc('my_user_message_threads');
  if (error) return null;
  const accepted = (data || []).filter((t) => t.status === 'accepted');
  if (accepted.length === 1) currentDirectRequestId = accepted[0].request_id;
  else {
    const head = $('communityChatHead')?.textContent || '';
    const match = accepted.find((t) => head.includes(t.other_name || ''));
    if (match) currentDirectRequestId = match.request_id;
  }
  return currentDirectRequestId;
}

async function renderDirectChatFromBackend() {
  if (!$('communityChatModal')?.classList.contains('open')) return;
  const requestId = await inferDirectRequestId();
  if (!requestId || !await ensureSession()) return;
  await S.rpc('mark_user_message_thread_read', { p_request_id: requestId });
  const [{ data:threads }, { data:messages, error }] = await Promise.all([
    S.rpc('my_user_message_threads'),
    S.rpc('user_message_history', { p_request_id: requestId }),
  ]);
  if (error) return;
  const thread = (threads || []).find((t) => t.request_id === requestId);
  const box = $('communityChatMessages');
  if (!box || !thread) return;
  box.innerHTML = `<div class="community-chat-intro">Pedido inicial: “${escapeHtml(thread.intro_message || '')}”</div>${(messages || []).map(directBubbleHtml).join('')}`;
  box.scrollTop = box.scrollHeight;
  queueNotificationRefresh();
  syncDirectThreadPreview(thread, messages || []);
}

function syncDirectThreadPreview(thread, messages) {
  const card = document.querySelector(`.community-message-card[data-message-thread="${thread.request_id}"] .community-message-preview`);
  if (!card) return;
  const last = messages[messages.length - 1];
  card.textContent = last?.body || thread.intro_message || '';
}

async function deleteDirectMessage(messageId, button) {
  if (!messageId || !await ensureSession() || !confirm('Eliminar esta mensagem?')) return;
  const { error } = await S.from('user_messages').delete().eq('id', messageId).eq('sender_id', session.user.id);
  if (error) { console.error(error); showToast('Não foi possível eliminar a mensagem.'); return; }
  button.closest('.community-chat-bubble')?.remove();
  queueNotificationRefresh();
  setTimeout(() => renderDirectChatFromBackend().catch(console.error), 80);
}

function serviceStamp(value) {
  return value ? new Date(value).toLocaleString('pt-PT',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}) : '';
}

async function inferServiceRequestId() {
  if (currentServiceRequestId) return currentServiceRequestId;
  if (!await ensureSession()) return null;
  const title = $('chatTitle')?.textContent || '';
  if (!title) return null;
  const uid = session.user.id;
  const { data, error } = await S.from('service_requests')
    .select('id,description,created_at')
    .or(`client_id.eq.${uid},professional_id.eq.${uid}`)
    .order('created_at',{ascending:false})
    .limit(40);
  if (error) return null;
  const match = (data || []).find((r) => `${r.description || 'Pedido de serviço'} · ${serviceStamp(r.created_at)}` === title);
  if (match) currentServiceRequestId = match.id;
  return currentServiceRequestId;
}

async function decorateServiceMessages() {
  if (serviceDecorating || !$('chatModal')?.classList.contains('open')) return;
  const requestId = await inferServiceRequestId();
  if (!requestId || !await ensureSession()) return;
  const untagged = [...document.querySelectorAll('#chatMessages .chat-message:not([data-service-message-id])')];
  if (!untagged.length) return;
  serviceDecorating = true;
  try {
    const { data, error } = await S.from('service_messages').select('id,sender_id,kind,created_at').eq('request_id',requestId).eq('kind','message').order('created_at');
    if (error) return;
    const bubbles = [...document.querySelectorAll('#chatMessages .chat-message')];
    (data || []).forEach((message,index) => {
      const bubble = bubbles[index];
      if (!bubble) return;
      bubble.dataset.serviceMessageId = message.id;
      if (message.sender_id === session.user.id && !bubble.querySelector('.social38-delete-message')) {
        bubble.insertAdjacentHTML('beforeend', `<button class="social38-delete-message" type="button" data-delete-service-message="${message.id}">Eliminar</button>`);
      }
    });
  } finally {
    serviceDecorating = false;
  }
}

async function reconcileServiceMessages() {
  const requestId = await inferServiceRequestId();
  if (!requestId || !$('chatModal')?.classList.contains('open')) return;
  const { data, error } = await S.from('service_messages').select('id').eq('request_id',requestId).eq('kind','message');
  if (error) return;
  const ids = new Set((data || []).map((m) => m.id));
  document.querySelectorAll('#chatMessages .chat-message[data-service-message-id]').forEach((bubble) => {
    if (!ids.has(bubble.dataset.serviceMessageId)) bubble.remove();
  });
  await decorateServiceMessages();
}

async function deleteServiceMessage(messageId, button) {
  if (!messageId || !await ensureSession() || !confirm('Eliminar esta mensagem?')) return;
  const { error } = await S.from('service_messages').delete().eq('id',messageId).eq('sender_id',session.user.id).eq('kind','message');
  if (error) { console.error(error); showToast('Não foi possível eliminar a mensagem.'); return; }
  button.closest('.chat-message')?.remove();
  queueNotificationRefresh();
  showToast('Mensagem eliminada');
}

function observeChatModals() {
  const direct = $('communityChatModal');
  if (direct && !direct.dataset.social38Observed) {
    direct.dataset.social38Observed = '1';
    new MutationObserver(() => {
      if (direct.classList.contains('open')) setTimeout(() => renderDirectChatFromBackend().catch(console.error),120);
      else currentDirectRequestId = null;
    }).observe(direct,{attributes:true,attributeFilter:['class']});
  }
  const service = $('chatModal');
  if (service && !service.dataset.social38Observed) {
    service.dataset.social38Observed = '1';
    new MutationObserver(() => {
      if (service.classList.contains('open')) setTimeout(() => decorateServiceMessages().catch(console.error),140);
      else currentServiceRequestId = null;
    }).observe(service,{attributes:true,attributeFilter:['class']});
  }
  const serviceMessages = $('chatMessages');
  if (serviceMessages && !serviceMessages.dataset.social38Observed) {
    serviceMessages.dataset.social38Observed = '1';
    new MutationObserver(() => {
      if (!serviceDecorating && serviceMessages.querySelector('.chat-message:not([data-service-message-id])')) setTimeout(() => decorateServiceMessages().catch(console.error),60);
    }).observe(serviceMessages,{childList:true,subtree:true});
  }
}

async function startSocialRealtime() {
  if (socialChannel) S.removeChannel(socialChannel);
  socialChannel = null;
  if (!await ensureSession()) return;
  const uid = session.user.id;
  socialChannel = S.channel(`social-actions-38-${uid}-${Date.now()}`)
    .on('postgres_changes',{event:'*',schema:'public',table:'professional_comments'},(payload)=>{
      if (currentProfessionalId) mountPublicComments(currentProfessionalId).catch(()=>{});
      mountOwnComments().catch(()=>{});
      if (payload.eventType === 'UPDATE' && payload.new?.id) {
        const reply = document.querySelector(`.community-reply[data-reply-id="${payload.new.id}"]`);
        if (reply && payload.new.deleted_at) {
          const body = reply.querySelector(':scope > .community-body'); if (body) body.textContent = 'Comentário eliminado';
          reply.querySelector(':scope > .social38-review-actions')?.remove();
        }
      }
      setTimeout(decorateReviewDeleteButtons,80);
    })
    .on('postgres_changes',{event:'*',schema:'public',table:'professional_reviews'},(payload)=>{
      if (payload.eventType === 'UPDATE' && payload.new?.id && payload.new.comment == null) {
        const article = document.querySelector(`.community-review[data-review-id="${payload.new.id}"]`);
        const body = article?.querySelector(':scope > .community-body');
        if (body) body.innerHTML = '<em>Sem comentário escrito.</em>';
        article?.querySelector(':scope > .social38-review-actions')?.remove();
      }
      setTimeout(decorateReviewDeleteButtons,80);
    })
    .on('postgres_changes',{event:'*',schema:'public',table:'user_messages'},()=>{
      if ($('communityChatModal')?.classList.contains('open')) renderDirectChatFromBackend().catch(()=>{});
    })
    .on('postgres_changes',{event:'*',schema:'public',table:'service_messages'},()=>{
      if ($('chatModal')?.classList.contains('open')) reconcileServiceMessages().catch(()=>{});
    })
    .subscribe();
}

function bindGlobalEvents() {
  document.addEventListener('click',(event)=>{
    const view = event.target.closest?.('.view-pro[data-professional]');
    if (view) {
      currentProfessionalId = view.dataset.professional;
      setTimeout(() => mountPublicComments(currentProfessionalId).catch(console.error),180);
    }
    const serviceChat = event.target.closest?.('[data-chat-request]');
    if (serviceChat?.dataset.chatRequest) currentServiceRequestId = serviceChat.dataset.chatRequest;
    const directOpen = event.target.closest?.('[data-message-open]');
    if (directOpen?.dataset.messageOpen) currentDirectRequestId = directOpen.dataset.messageOpen;
    const directAccept = event.target.closest?.('[data-message-accept]');
    if (directAccept?.dataset.messageAccept) currentDirectRequestId = directAccept.dataset.messageAccept;

    const standaloneReply = event.target.closest?.('[data-profile-comment-reply]');
    if (standaloneReply) { openStandaloneReply(standaloneReply); return; }
    const deleteProfile = event.target.closest?.('[data-profile-comment-delete]');
    if (deleteProfile) { deleteProfileComment(deleteProfile.dataset.profileCommentDelete, deleteProfile).catch(console.error); return; }
    const deleteReply = event.target.closest?.('[data-delete-thread-comment]');
    if (deleteReply) { deleteReviewReply(deleteReply.dataset.deleteThreadComment, deleteReply).catch(console.error); return; }
    const deleteReview = event.target.closest?.('[data-delete-review-comment]');
    if (deleteReview) { deleteReviewText(deleteReview.dataset.deleteReviewComment, deleteReview).catch(console.error); return; }
    const deleteDirect = event.target.closest?.('[data-delete-direct-message]');
    if (deleteDirect) { deleteDirectMessage(deleteDirect.dataset.deleteDirectMessage, deleteDirect).catch(console.error); return; }
    const deleteService = event.target.closest?.('[data-delete-service-message]');
    if (deleteService) { deleteServiceMessage(deleteService.dataset.deleteServiceMessage, deleteService).catch(console.error); return; }
    if (event.target.closest?.('[data-social38-login]')) { $('authBtn')?.click(); return; }

    if (event.target.closest?.('#navPro,#proCta,[data-account-tab="professional"]')) {
      setTimeout(() => mountOwnComments().catch(()=>{}),450);
    }
    setTimeout(decorateReviewDeleteButtons,120);
  },true);

  document.addEventListener('submit',(event)=>{
    const rootForm = event.target.closest?.('[data-profile-comment-form]');
    if (rootForm) { event.preventDefault(); submitRootComment(rootForm).catch(console.error); return; }
    const replyForm = event.target.closest?.('.social38-inline-reply[data-parent-comment]');
    if (replyForm) { event.preventDefault(); submitStandaloneReply(replyForm).catch(console.error); return; }
    if (event.target.id === 'communityChatForm') setTimeout(() => renderDirectChatFromBackend().catch(()=>{}),300);
  },true);

  document.addEventListener('cop:notifications-refresh',queueNotificationRefresh);
  document.addEventListener('visibilitychange',()=>{ if (!document.hidden) queueNotificationRefresh(); });
}

function observeProfessionalArea() {
  const area = $('accountProfessional');
  if (!area || area.dataset.social38Observed) return;
  area.dataset.social38Observed = '1';
  let timer = null;
  new MutationObserver(()=>{
    clearTimeout(timer);
    timer = setTimeout(()=>{
      mountOwnComments().catch(()=>{});
      decorateReviewDeleteButtons();
    },120);
  }).observe(area,{childList:true,subtree:true});
}

async function initSocial38() {
  await ensureSession();
  bindGlobalEvents();
  observeChatModals();
  observeProfessionalArea();
  await startNotificationRealtime();
  await startSocialRealtime();
  setTimeout(decorateReviewDeleteButtons,300);
  S.auth.onAuthStateChange((_event,nextSession)=>{
    session = nextSession;
    queueMicrotask(async()=>{
      await startNotificationRealtime();
      await startSocialRealtime();
      if (currentProfessionalId) mountPublicComments(currentProfessionalId).catch(()=>{});
      mountOwnComments().catch(()=>{});
    });
  });
}

initSocial38().catch(console.error);
