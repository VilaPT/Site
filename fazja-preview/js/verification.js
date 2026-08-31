import { supabase as S } from './supabase.js';

const HUMAN_VERSION = '3.3.6';
const HUMAN_MODULE = `https://cdn.jsdelivr.net/npm/@vladmandic/human@${HUMAN_VERSION}/dist/human.esm.js`;
const HUMAN_MODELS = `https://cdn.jsdelivr.net/npm/@vladmandic/human@${HUMAN_VERSION}/models/`;
const MATCH_THRESHOLD = 0.55;
const LIVE_THRESHOLD = 0.50;
const REAL_THRESHOLD = 0.50;

let human = null;
let currentSession = null;
let ownProfile = null;
let stream = null;
let running = false;
let onToast = () => {};
let accountObserver = null;
let cardsObserver = null;
let chatRequestId = null;

const $ = (id) => document.getElementById(id);

const badgeSvg = (verified, title = verified ? 'Conta verificada' : 'Conta não verificada') => `
  <span class="identity-badge ${verified ? 'verified' : ''}" title="${title}" aria-label="${title}">
    <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="m8.2 12.2 2.4 2.4 5.4-5.4"/></svg>
  </span>`;

function injectStyles() {
  if ($('identityVerificationStyles')) return;
  const style = document.createElement('style');
  style.id = 'identityVerificationStyles';
  style.textContent = `
    .identity-badge{display:inline-grid;place-items:center;width:20px;height:20px;vertical-align:-4px;margin-left:5px;color:#8b9698;flex:0 0 auto}.identity-badge svg{width:20px;height:20px;fill:transparent;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}.identity-badge.verified{color:var(--petrol)}.identity-badge.verified svg circle{fill:var(--petrol);stroke:var(--petrol)}.identity-badge.verified svg path{stroke:#fff;stroke-width:2.3}
    .identity-account-card{display:grid;grid-template-columns:auto 1fr;gap:14px;align-items:center;padding:16px;border:1px solid var(--line);border-radius:22px;background:#f8faf9;margin:4px 0 16px}.identity-avatar-wrap{position:relative;width:82px;height:82px}.identity-avatar{width:82px;height:82px;border-radius:26px;object-fit:cover;background:var(--soft);border:1px solid var(--mid);display:grid;place-items:center;color:var(--petrol);font-weight:950;font-size:24px;overflow:hidden}.identity-avatar img,.avatar img,.profile-avatar img{width:100%;height:100%;object-fit:cover}.identity-avatar-wrap .identity-badge{position:absolute;right:-4px;bottom:-4px;width:27px;height:27px;background:#fff;border-radius:50%;margin:0}.identity-avatar-wrap .identity-badge svg{width:27px;height:27px}.identity-card-main{min-width:0}.identity-card-title{display:flex;align-items:center;gap:2px;font-weight:900;font-size:16px}.identity-card-state{display:block;color:var(--muted);font-size:12px;margin:3px 0 10px;line-height:1.4}.identity-card-actions{display:flex;flex-wrap:wrap;gap:7px}.identity-card-actions .btn{padding:8px 11px;font-size:11px}.identity-photo-input{display:none}
    .identity-modal .box{width:min(620px,100%)}.identity-intro{color:var(--muted);font-size:13px;line-height:1.55;margin:4px 0 14px}.identity-camera{position:relative;background:#0f1719;border-radius:24px;overflow:hidden;aspect-ratio:4/3;display:grid;place-items:center}.identity-camera video{width:100%;height:100%;object-fit:cover;transform:scaleX(-1)}.identity-camera-guide{position:absolute;inset:10% 20%;border:2px solid rgba(255,255,255,.8);border-radius:48% 48% 44% 44%;box-shadow:0 0 0 999px rgba(0,0,0,.18);pointer-events:none}.identity-camera-state{position:absolute;left:12px;right:12px;bottom:12px;padding:10px 12px;background:rgba(7,61,68,.88);color:#fff;border-radius:14px;text-align:center;font-size:12px;font-weight:850;backdrop-filter:blur(8px)}.identity-progress{height:8px;background:#e7eceb;border-radius:999px;overflow:hidden;margin:12px 0}.identity-progress span{display:block;height:100%;width:0;background:var(--petrol);transition:width .2s}.identity-result{min-height:20px;font-size:13px;line-height:1.45}.identity-result.ok{color:var(--green)}.identity-result.err{color:var(--danger)}.identity-privacy{font-size:11px;color:var(--muted);line-height:1.45;margin-top:10px}.identity-modal-actions{display:flex;gap:8px;margin-top:12px}.identity-modal-actions .btn{flex:1}.identity-inline-status{display:inline-flex;align-items:center;gap:3px;font-size:11px;font-weight:850;color:var(--muted)}.identity-inline-status.verified{color:var(--petrol)}
    .avatar,.profile-avatar{overflow:hidden}.chat-identity-pill{display:inline-flex;align-items:center;gap:3px;margin-top:5px;padding:5px 8px;border-radius:999px;background:var(--soft);color:var(--petrol2);font-size:10px;font-weight:850}.chat-identity-pill .identity-badge{width:16px;height:16px;margin:0}.chat-identity-pill .identity-badge svg{width:16px;height:16px}
    @media(max-width:560px){.identity-account-card{grid-template-columns:1fr;text-align:center}.identity-avatar-wrap{margin:auto}.identity-card-title,.identity-card-actions{justify-content:center}.identity-modal-actions{flex-direction:column}.identity-camera-guide{inset:8% 16%}}
  `;
  document.head.appendChild(style);
}

function injectModal() {
  if ($('identityModal')) return;
  document.body.insertAdjacentHTML('beforeend', `
    <div class="modal identity-modal" id="identityModal">
      <div class="box">
        <button class="x" id="identityClose" type="button">×</button>
        <h2>Verificar conta</h2>
        <p class="identity-intro">Vamos comparar a tua fotografia de perfil com uma verificação ao vivo. Olha para a câmara e segue os movimentos pedidos.</p>
        <div class="identity-camera"><video id="identityVideo" playsinline muted></video><div class="identity-camera-guide"></div><div class="identity-camera-state" id="identityCameraState">Pronto para começar</div></div>
        <div class="identity-progress"><span id="identityProgress"></span></div>
        <div class="identity-result" id="identityResult"></div>
        <p class="identity-privacy">No protótipo, a comparação facial é feita no teu dispositivo. O vídeo da verificação e o vetor biométrico não são guardados. A fotografia de perfil é pública. Ao alterares a fotografia, a verificação é retirada e pode ser feita novamente.</p>
        <div class="identity-modal-actions"><button class="btn ghost" id="identityCancel" type="button">Cancelar</button><button class="btn primary" id="identityStart" type="button">Começar verificação</button></div>
      </div>
    </div>`);
  $('identityClose').onclick = closeVerification;
  $('identityCancel').onclick = closeVerification;
  $('identityStart').onclick = startVerification;
}

async function loadHuman() {
  if (human) return human;
  const H = await import(HUMAN_MODULE);
  const HumanClass = H.Human || H.default?.Human || H.default;
  human = new HumanClass({
    backend: 'webgl',
    async: true,
    cacheSensitivity: 0.01,
    modelBasePath: HUMAN_MODELS,
    filter: { enabled: true, equalization: true, flip: false },
    face: {
      enabled: true,
      detector: { rotation: true, return: false, maxDetected: 2, minConfidence: 0.55 },
      mesh: { enabled: true },
      iris: { enabled: true },
      description: { enabled: true },
      emotion: { enabled: false },
      antispoof: { enabled: true },
      liveness: { enabled: true },
    },
    body: { enabled: false },
    hand: { enabled: false },
    object: { enabled: false },
    gesture: { enabled: true },
    segmentation: { enabled: false },
  });
  await human.load();
  await human.warmup().catch(() => {});
  return human;
}

function fileToImage(fileOrBlob) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(fileOrBlob);
    const image = new Image();
    image.onload = () => { URL.revokeObjectURL(url); resolve(image); };
    image.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Não foi possível abrir a imagem.')); };
    image.src = url;
  });
}

async function urlToImage(url) {
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) throw new Error('Não foi possível carregar a fotografia de perfil.');
  return fileToImage(await response.blob());
}

async function detectSingleFace(input) {
  const engine = await loadHuman();
  const result = await engine.detect(input);
  if (!result?.face?.length) throw new Error('Não foi detetado um rosto. Escolhe uma fotografia frontal e bem iluminada.');
  if (result.face.length !== 1) throw new Error('A fotografia deve ter apenas um rosto.');
  const face = result.face[0];
  if (Number(face.faceScore || face.score || 0) < 0.50) throw new Error('O rosto não está suficientemente nítido. Experimenta outra fotografia.');
  if (!face.embedding?.length) throw new Error('Não foi possível criar a referência facial. Experimenta outra fotografia.');
  return face;
}

function cropFace(image, face) {
  const box = face.box || [0, 0, image.naturalWidth || image.width, image.naturalHeight || image.height];
  const [x, y, w, h] = box;
  const imageW = image.naturalWidth || image.width;
  const imageH = image.naturalHeight || image.height;
  const size = Math.min(Math.max(w, h) * 1.75, Math.min(imageW, imageH));
  const cx = x + w / 2;
  const cy = y + h / 2;
  const sx = Math.max(0, Math.min(imageW - size, cx - size / 2));
  const sy = Math.max(0, Math.min(imageH - size, cy - size / 2));
  const canvas = document.createElement('canvas');
  canvas.width = 512; canvas.height = 512;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(image, sx, sy, size, size, 0, 0, 512, 512);
  return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob), 'image/jpeg', 0.88));
}

async function loadOwnProfile() {
  if (!currentSession?.user?.id) { ownProfile = null; renderOwnIdentity(); return null; }
  const { data, error } = await S.from('profiles')
    .select('display_name,account_type,avatar_url,identity_verified_at,avatar_updated_at')
    .eq('id', currentSession.user.id)
    .maybeSingle();
  if (!error) ownProfile = data || null;
  renderOwnIdentity();
  enhanceProfessionalArea();
  return ownProfile;
}

function profileInitial() {
  return (ownProfile?.display_name || currentSession?.user?.email || 'C').charAt(0).toUpperCase();
}

function renderOwnIdentity() {
  const panel = document.querySelector('[data-account-panel="profile"]');
  if (!panel) return;
  let card = $('identityAccountCard');
  if (!currentSession) { card?.remove(); return; }
  if (!card) {
    card = document.createElement('section');
    card.id = 'identityAccountCard';
    card.className = 'identity-account-card';
    const form = $('accountForm');
    panel.insertBefore(card, form || panel.firstChild);
  }
  const verified = Boolean(ownProfile?.identity_verified_at);
  const avatar = ownProfile?.avatar_url
    ? `<img src="${escapeAttr(ownProfile.avatar_url)}" alt="Fotografia de perfil">`
    : `<span>${profileInitial()}</span>`;
  card.innerHTML = `
    <div class="identity-avatar-wrap"><div class="identity-avatar">${avatar}</div>${badgeSvg(verified)}</div>
    <div class="identity-card-main">
      <div class="identity-card-title">Fotografia e identidade ${badgeSvg(verified)}</div>
      <span class="identity-card-state">${verified ? 'Conta verificada. O rosto da fotografia correspondeu à verificação ao vivo.' : ownProfile?.avatar_url ? 'Fotografia pronta. Podes verificar gratuitamente a tua conta.' : 'Adiciona uma fotografia nítida do teu rosto para completares o perfil.'}</span>
      <div class="identity-card-actions">
        <label class="btn ghost" for="identityPhotoInput">${ownProfile?.avatar_url ? 'Alterar fotografia' : 'Adicionar fotografia'}</label>
        <input class="identity-photo-input" id="identityPhotoInput" type="file" accept="image/jpeg,image/png,image/webp" capture="user">
        <button class="btn primary" id="identityVerifyButton" type="button" ${ownProfile?.avatar_url ? '' : 'disabled'}>${verified ? 'Verificar novamente' : 'Verificar conta grátis'}</button>
      </div>
    </div>`;
  $('identityPhotoInput').onchange = handlePhotoChange;
  $('identityVerifyButton').onclick = openVerification;
}

function escapeAttr(value) {
  return String(value || '').replace(/[&<>'"]/g, (char) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[char]));
}

async function handlePhotoChange(event) {
  const file = event.target.files?.[0];
  event.target.value = '';
  if (!file || !currentSession) return;
  if (file.size > 5 * 1024 * 1024) { onToast('A fotografia não pode ultrapassar 5 MB.'); return; }
  try {
    onToast('A analisar o rosto da fotografia…');
    const image = await fileToImage(file);
    const face = await detectSingleFace(image);
    const blob = await cropFace(image, face);
    if (!blob) throw new Error('Não foi possível preparar a fotografia.');
    const path = `${currentSession.user.id}/profile.jpg`;
    const { error: uploadError } = await S.storage.from('profile-photos').upload(path, blob, {
      contentType: 'image/jpeg', cacheControl: '60', upsert: true,
    });
    if (uploadError) throw uploadError;
    const { data } = S.storage.from('profile-photos').getPublicUrl(path);
    const publicUrl = `${data.publicUrl}?v=${Date.now()}`;
    const { error: profileError } = await S.from('profiles')
      .update({ avatar_url: publicUrl, updated_at: new Date().toISOString() })
      .eq('id', currentSession.user.id);
    if (profileError) throw profileError;
    ownProfile = { ...(ownProfile || {}), avatar_url: publicUrl, identity_verified_at: null };
    renderOwnIdentity();
    enhanceAllProfessionalCards(true);
    onToast('Fotografia guardada. A verificação foi reiniciada.');
  } catch (error) {
    console.error(error);
    onToast(error?.message || 'Não foi possível guardar a fotografia.');
  }
}

function openVerification() {
  if (!currentSession || !ownProfile?.avatar_url) return;
  injectModal();
  $('identityResult').textContent = '';
  $('identityResult').className = 'identity-result';
  $('identityCameraState').textContent = 'Carrega em “Começar verificação”';
  $('identityProgress').style.width = '0%';
  $('identityStart').disabled = false;
  $('identityStart').textContent = 'Começar verificação';
  $('identityModal').classList.add('open');
}

function stopCamera() {
  running = false;
  if (stream) stream.getTracks().forEach((track) => track.stop());
  stream = null;
  const video = $('identityVideo');
  if (video) video.srcObject = null;
}

function closeVerification() {
  stopCamera();
  $('identityModal')?.classList.remove('open');
}

function sleep(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }

async function startVerification() {
  if (running || !ownProfile?.avatar_url) return;
  const state = $('identityCameraState');
  const resultEl = $('identityResult');
  const progress = $('identityProgress');
  const startBtn = $('identityStart');
  startBtn.disabled = true;
  resultEl.className = 'identity-result';
  resultEl.textContent = 'A preparar a verificação facial…';
  try {
    const engine = await loadHuman();
    const referenceImage = await urlToImage(ownProfile.avatar_url);
    const referenceFace = await detectSingleFace(referenceImage);
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user', width: { ideal: 720 }, height: { ideal: 720 } }, audio: false,
    });
    const video = $('identityVideo');
    video.srcObject = stream;
    await video.play();
    running = true;

    let stage = 0;
    let firstTurnSign = 0;
    let centeredFrames = 0;
    let liveSamples = [];
    let realSamples = [];
    let finalEmbedding = null;
    const startedAt = Date.now();

    while (running && Date.now() - startedAt < 40000) {
      const detection = await engine.detect(video);
      if (!running) break;
      const faces = detection?.face || [];
      if (faces.length !== 1) {
        state.textContent = faces.length > 1 ? 'Deve aparecer apenas uma pessoa na câmara.' : 'Posiciona o teu rosto dentro da moldura.';
        await sleep(120);
        continue;
      }
      const face = faces[0];
      const yaw = Number(face.rotation?.angle?.yaw || 0);
      if (Number.isFinite(face.live)) liveSamples.push(Number(face.live));
      if (Number.isFinite(face.real)) realSamples.push(Number(face.real));
      liveSamples = liveSamples.slice(-12); realSamples = realSamples.slice(-12);

      if (stage === 0) {
        progress.style.width = '18%';
        state.textContent = 'Olha de frente para a câmara.';
        if (Math.abs(yaw) < 0.14 && face.embedding?.length) centeredFrames += 1; else centeredFrames = 0;
        if (centeredFrames >= 3) { stage = 1; centeredFrames = 0; }
      } else if (stage === 1) {
        progress.style.width = '42%';
        state.textContent = 'Agora vira lentamente a cabeça para um lado.';
        if (Math.abs(yaw) > 0.24) { firstTurnSign = Math.sign(yaw) || 1; stage = 2; }
      } else if (stage === 2) {
        progress.style.width = '66%';
        state.textContent = 'Muito bem. Vira agora para o lado contrário.';
        if (yaw * firstTurnSign < -0.22) stage = 3;
      } else if (stage === 3) {
        progress.style.width = '84%';
        state.textContent = 'Volta a olhar de frente para a câmara.';
        if (Math.abs(yaw) < 0.12 && face.embedding?.length) {
          centeredFrames += 1;
          finalEmbedding = face.embedding;
        } else centeredFrames = 0;
        if (centeredFrames >= 3 && finalEmbedding) { stage = 4; break; }
      }
      await sleep(90);
    }

    if (stage < 4 || !finalEmbedding) throw new Error('Não foi possível concluir os movimentos a tempo. Tenta novamente com boa iluminação.');
    const similarity = Number(engine.match.similarity(referenceFace.embedding, finalEmbedding));
    const live = liveSamples.length ? liveSamples.reduce((a,b) => a+b,0) / liveSamples.length : 0;
    const real = realSamples.length ? realSamples.reduce((a,b) => a+b,0) / realSamples.length : 0;
    progress.style.width = '94%';
    state.textContent = 'A confirmar correspondência…';

    if (similarity < MATCH_THRESHOLD) throw new Error('O rosto ao vivo não corresponde suficientemente à fotografia de perfil.');
    if (live < LIVE_THRESHOLD || real < REAL_THRESHOLD) throw new Error('Não foi possível confirmar a presença de uma pessoa real. Tenta novamente sem filtros e com boa iluminação.');

    const { data: verified, error } = await S.rpc('confirm_identity_verification', {
      p_similarity: similarity,
      p_liveness: live,
      p_antispoof: real,
      p_challenge: 'center-turn-opposite-center',
    });
    if (error) throw error;
    if (!verified) throw new Error('A verificação não atingiu os níveis mínimos de segurança.');

    progress.style.width = '100%';
    state.textContent = 'Conta verificada ✓';
    resultEl.className = 'identity-result ok';
    resultEl.textContent = `Identidade confirmada. Correspondência facial: ${Math.round(similarity * 100)}%.`;
    ownProfile.identity_verified_at = new Date().toISOString();
    renderOwnIdentity();
    enhanceAllProfessionalCards(true);
    enhanceProfessionalArea();
    onToast('Conta verificada ✓');
    setTimeout(closeVerification, 1800);
  } catch (error) {
    console.error(error);
    stopCamera();
    resultEl.className = 'identity-result err';
    resultEl.textContent = error?.name === 'NotAllowedError' ? 'É necessário permitir o acesso à câmara para verificar a conta.' : error?.message || 'Não foi possível concluir a verificação.';
    state.textContent = 'Verificação não concluída';
    startBtn.disabled = false;
    startBtn.textContent = 'Tentar novamente';
  } finally {
    if (!running) stopCamera();
  }
}

async function getPublicIdentities(ids) {
  const clean = [...new Set(ids.filter(Boolean))];
  if (!clean.length) return new Map();
  const { data, error } = await S.rpc('public_professional_identities', { p_user_ids: clean });
  if (error) return new Map();
  return new Map((data || []).map((row) => [row.user_id, row]));
}

async function enhanceAllProfessionalCards(force = false) {
  const cards = [...document.querySelectorAll('#cards .pro-card')];
  const ids = cards.map((card) => card.querySelector('[data-professional]')?.dataset.professional).filter(Boolean);
  if (!ids.length) return;
  const identities = await getPublicIdentities(ids);
  cards.forEach((card) => {
    const id = card.querySelector('[data-professional]')?.dataset.professional;
    const identity = identities.get(id);
    if (!identity) return;
    if (!force && card.dataset.identityDecorated === `${identity.avatar_url || ''}|${identity.is_identity_verified}`) return;
    const avatar = card.querySelector('.avatar');
    if (avatar && identity.avatar_url) avatar.innerHTML = `<img src="${escapeAttr(identity.avatar_url)}" alt="Fotografia do profissional">`;
    const name = card.querySelector('h3');
    if (name) {
      name.querySelector('.identity-badge')?.remove();
      name.insertAdjacentHTML('beforeend', badgeSvg(Boolean(identity.is_identity_verified)));
    }
    card.dataset.identityDecorated = `${identity.avatar_url || ''}|${identity.is_identity_verified}`;
  });
}

async function enhancePublicModal(id) {
  const identities = await getPublicIdentities([id]);
  const identity = identities.get(id);
  if (!identity) return;
  const avatar = document.querySelector('#publicProModal .profile-avatar');
  if (avatar && identity.avatar_url) avatar.innerHTML = `<img src="${escapeAttr(identity.avatar_url)}" alt="Fotografia do profissional">`;
  const name = $('publicProName');
  if (name) {
    name.querySelector('.identity-badge')?.remove();
    name.insertAdjacentHTML('beforeend', badgeSvg(Boolean(identity.is_identity_verified)));
  }
  let status = $('publicProIdentityStatus');
  if (!status) {
    status = document.createElement('div');
    status.id = 'publicProIdentityStatus';
    $('publicProRating')?.insertAdjacentElement('afterend', status);
  }
  status.className = `identity-inline-status ${identity.is_identity_verified ? 'verified' : ''}`;
  status.innerHTML = `${badgeSvg(Boolean(identity.is_identity_verified))}${identity.is_identity_verified ? 'Identidade verificada' : 'Identidade ainda não verificada'}`;
}

function enhanceProfessionalArea() {
  const area = $('accountProfessional');
  if (!area || !currentSession || !ownProfile) return;
  const firstName = area.querySelector('.account-item strong');
  if (!firstName) return;
  firstName.querySelector('.identity-badge')?.remove();
  firstName.insertAdjacentHTML('beforeend', badgeSvg(Boolean(ownProfile.identity_verified_at)));
  const firstItem = firstName.closest('.account-item');
  if (firstItem && ownProfile.avatar_url && !firstItem.querySelector('.identity-pro-photo')) {
    const img = document.createElement('img');
    img.className = 'identity-pro-photo';
    img.src = ownProfile.avatar_url;
    img.alt = 'Fotografia de perfil';
    img.style.cssText = 'width:48px;height:48px;border-radius:16px;object-fit:cover;float:right;margin-left:10px;';
    firstItem.prepend(img);
  }
}

async function enhanceChatIdentity(requestId) {
  if (!requestId || !currentSession) return;
  const { data, error } = await S.rpc('request_participant_identities', { p_request_id: requestId });
  if (error) return;
  const other = (data || []).find((row) => row.user_id !== currentSession.user.id);
  if (!other) return;
  const head = document.querySelector('#chatModal .chat-head > div');
  if (!head) return;
  head.querySelector('.chat-identity-pill')?.remove();
  const role = other.participant_role === 'professional' ? 'Profissional' : 'Cliente';
  head.insertAdjacentHTML('beforeend', `<div class="chat-identity-pill">${badgeSvg(Boolean(other.is_identity_verified))}${role} ${other.is_identity_verified ? 'verificado' : 'não verificado'}</div>`);
}

function bindEnhancers() {
  const cards = $('cards');
  if (cards && !cardsObserver) {
    cardsObserver = new MutationObserver(() => enhanceAllProfessionalCards().catch(() => {}));
    cardsObserver.observe(cards, { childList: true, subtree: true });
  }
  const professionalArea = $('accountProfessional');
  if (professionalArea && !accountObserver) {
    accountObserver = new MutationObserver(() => enhanceProfessionalArea());
    accountObserver.observe(professionalArea, { childList: true, subtree: true });
  }
  document.addEventListener('click', (event) => {
    const view = event.target.closest?.('.view-pro[data-professional]');
    if (view) setTimeout(() => enhancePublicModal(view.dataset.professional).catch(() => {}), 0);
    const chat = event.target.closest?.('[data-chat-request]');
    if (chat) {
      chatRequestId = chat.dataset.chatRequest;
      setTimeout(() => enhanceChatIdentity(chatRequestId).catch(() => {}), 250);
    }
    if (event.target.closest?.('#navAccount,#accountCta')) setTimeout(() => loadOwnProfile().catch(() => {}), 100);
    if (event.target.closest?.('#navPro,#proCta')) setTimeout(() => { loadOwnProfile().then(enhanceProfessionalArea).catch(() => {}); }, 150);
  });
}

export async function initIdentityVerification({ getSession = () => null, toast = () => {} } = {}) {
  onToast = toast;
  injectStyles();
  injectModal();
  bindEnhancers();
  currentSession = getSession() || (await S.auth.getSession()).data.session;
  await loadOwnProfile();
  await enhanceAllProfessionalCards();
  S.auth.onAuthStateChange((_event, nextSession) => {
    currentSession = nextSession;
    ownProfile = null;
    if (!nextSession) {
      renderOwnIdentity();
      closeVerification();
      return;
    }
    queueMicrotask(() => loadOwnProfile().catch(() => {}));
  });
}
