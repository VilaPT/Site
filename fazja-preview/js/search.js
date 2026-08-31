import { supabase as S } from './supabase.js';
import { escapeHtml, getOrCreateSessionId, normalizeText } from './utils.js';
import { formatDistance, resolvePortugalLocation } from './location.js?v=11';

const $ = (id) => document.getElementById(id);
let categories = [];
let skills = [];
let selectedSkill = null;
let lastQuery = '';
let lastCity = '';
let lastLocation = null;
let sessionProvider = () => null;
let requestHandler = () => {};

const icons = {
  casa:'<svg viewBox="0 0 24 24"><path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10v10h13V10"/><path d="M9.5 20v-6h5v6"/></svg>',
  automovel:'<svg viewBox="0 0 24 24"><path d="m5 16-1.2-4.2A2 2 0 0 1 5.7 9h12.6a2 2 0 0 1 1.9 2.8L19 16"/><path d="M5 16h14v3H5z"/><circle cx="7.5" cy="16" r="1"/><circle cx="16.5" cy="16" r="1"/><path d="m7 9 1.5-3h7L17 9"/></svg>',
  tecnologia:'<svg viewBox="0 0 24 24"><rect x="4" y="5" width="16" height="11" rx="2"/><path d="M8 20h8M12 16v4"/></svg>',
  'limpeza e apoio':'<svg viewBox="0 0 24 24"><path d="m14 4 6 6"/><path d="M16.5 6.5 8 15"/><path d="M5 14c3 0 5 2 5 5H4c0-2 .3-3.5 1-5Z"/></svg>',
  'beleza e bem-estar':'<svg viewBox="0 0 24 24"><circle cx="7" cy="7" r="2.5"/><circle cx="17" cy="7" r="2.5"/><path d="m9 9 8 8M15 9l-8 8"/></svg>',
  educacao:'<svg viewBox="0 0 24 24"><path d="m3 8 9-4 9 4-9 4-9-4Z"/><path d="M7 10.5V15c3 2 7 2 10 0v-4.5M21 8v6"/></svg>',
  eventos:'<svg viewBox="0 0 24 24"><path d="M12 3 9.5 8.5 4 11l5.5 2.5L12 19l2.5-5.5L20 11l-5.5-2.5L12 3Z"/></svg>',
  animais:'<svg viewBox="0 0 24 24"><circle cx="8" cy="7" r="2"/><circle cx="16" cy="7" r="2"/><circle cx="5" cy="12" r="2"/><circle cx="19" cy="12" r="2"/><path d="M8 18c0-3 2-5 4-5s4 2 4 5c0 2-1.5 3-4 3s-4-1-4-3Z"/></svg>',
  'negocios e profissionais':'<svg viewBox="0 0 24 24"><rect x="4" y="7" width="16" height="12" rx="2"/><path d="M9 7V5h6v2M4 12h16M10 12v2h4v-2"/></svg>',
  transportes:'<svg viewBox="0 0 24 24"><path d="M3 6h12v10H3zM15 10h3l3 3v3h-6z"/><circle cx="7" cy="18" r="2"/><circle cx="18" cy="18" r="2"/></svg>',
};

const keywords = [
  ['plumbing',['torneira','cano','fuga','autoclismo','entup']],
  ['electrician',['eletric','tomada','disjuntor','sem luz']],
  ['appliance-repair',['máquina de lavar','maquina de lavar','frigor','forno']],
  ['computer-repair',['computador','portátil','portatil','windows','wifi']],
  ['mechanic',['carro não pega','carro nao pega','motor','travões','travoes']],
  ['home-cleaning',['limpeza','limpar casa']],
  ['painting',['pintar','pintura']],
  ['furniture-assembly',['montar móvel','montar movel','ikea']],
  ['air-conditioning',['ar condicionado']],
  ['gardening',['jardim','jardineiro']],
  ['wordpress',['wordpress','woocommerce']],
  ['web-development',['website','site','programador web']],
  ['dog-walking',['passear cão','passear cao']],
  ['moving',['mudança','mudanca']],
];

const icon = (name) => icons[normalizeText(name)] || '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/><path d="M8 12h8M12 8v8"/></svg>';

function price(p) {
  if (p.price_unit === 'quote' || p.base_price == null) return 'Sob orçamento';
  const value = Number(p.base_price).toLocaleString('pt-PT', { style:'currency', currency:'EUR' });
  return p.price_unit === 'hour' ? `${value}/h` : p.price_unit === 'visit' ? `${value} deslocação` : `Desde ${value}`;
}

function rating(p) {
  const count = Number(p.rating_count || 0);
  return count ? `★ ${Number(p.rating_average || 0).toFixed(1)} (${count})` : 'Sem avaliações';
}

function stars(value) {
  const n = Math.max(1, Math.min(5, Number(value || 0)));
  return `${'★'.repeat(n)}${'☆'.repeat(5 - n)}`;
}

export function resolveSkill(text) {
  const normalized = normalizeText(text);
  for (const [slug, terms] of keywords) {
    if (terms.some((term) => normalized.includes(normalizeText(term)))) return skills.find((s) => s.slug === slug) || null;
  }
  return skills.find((s) => normalized.includes(normalizeText(s.name))) || selectedSkill || null;
}

function renderCategories() {
  $('categoryGrid').innerHTML = categories.map((c) => `<button class="category-card" data-cat="${c.id}"><span class="cat-icon">${icon(c.name)}</span><span class="cat-name">${escapeHtml(c.name)}</span><span class="cat-arrow">↗</span></button>`).join('');
  document.querySelectorAll('[data-cat]').forEach((button) => { button.onclick = () => selectCategory(Number(button.dataset.cat)); });
}

function selectCategory(id) {
  selectedSkill = null;
  document.querySelectorAll('[data-cat]').forEach((button) => button.classList.toggle('active', Number(button.dataset.cat) === id));
  const category = categories.find((item) => item.id === id);
  const categorySkills = skills.filter((item) => item.category_id === id);
  $('servicesTitle').textContent = category?.name || 'Serviços';
  $('serviceChips').innerHTML = categorySkills.map((s) => `<button class="service-chip" data-skill="${s.id}">${escapeHtml(s.name)}</button>`).join('');
  $('servicesPanel').classList.remove('hidden');
  document.querySelectorAll('[data-skill]').forEach((button) => { button.onclick = () => pickSkill(Number(button.dataset.skill)); });
  $('servicesPanel').scrollIntoView({ behavior:'smooth', block:'nearest' });
}

function pickSkill(id) {
  selectedSkill = skills.find((item) => item.id === id) || null;
  document.querySelectorAll('[data-skill]').forEach((button) => button.classList.toggle('active', Number(button.dataset.skill) === id));
  if (selectedSkill) {
    $('problem').value = selectedSkill.name;
    $('problem').focus();
  }
}

async function logSearch(resultCount) {
  const session = sessionProvider();
  await S.from('search_events').insert({
    session_id: getOrCreateSessionId(),
    user_id: session?.user?.id || null,
    query: lastQuery || selectedSkill?.name || 'Pesquisa',
    resolved_skill_id: selectedSkill?.id || null,
    city: lastLocation?.label || lastCity || null,
    result_count: resultCount,
  });
}

async function searchProfessionals() {
  if (lastLocation?.lat != null && lastLocation?.lon != null) {
    const result = await S.rpc('search_nearby_professionals', {
      p_skill_id: selectedSkill.id,
      p_lat: lastLocation.lat,
      p_lon: lastLocation.lon,
      p_limit: 100,
    });
    if (result.error) throw result.error;
    return result.data || [];
  }

  const links = await S.from('professional_skills').select('professional_id').eq('skill_id', selectedSkill.id);
  if (links.error) throw links.error;
  const ids = [...new Set((links.data || []).map((item) => item.professional_id))];
  if (!ids.length) return [];
  let query = S.from('professional_profiles')
    .select('user_id,public_name,headline,bio,city,district,municipality,parish,service_radius_km,base_price,price_unit,is_available,verification_status,rating_average,rating_count')
    .in('user_id', ids)
    .eq('is_public', true);
  if (lastCity) query = query.ilike('city', `%${lastCity}%`);
  const result = await query.order('is_available', { ascending:false }).order('rating_average', { ascending:false }).order('rating_count', { ascending:false });
  if (result.error) throw result.error;
  return result.data || [];
}

function professionalZone(p) {
  return p.parish && p.municipality ? `${p.parish}, ${p.municipality}` : p.city || p.municipality || 'Zona por indicar';
}

async function openPublicProfessionalProfile(p) {
  if (!p) return;
  $('publicProName').textContent = p.public_name || 'Profissional Chama O Pro';
  $('publicProHeadline').textContent = p.headline || selectedSkill?.name || 'Profissional';
  $('publicProMeta').textContent = `${professionalZone(p)}${formatDistance(p.distance_km) ? ` · ${formatDistance(p.distance_km)} de ti` : ''}`;
  $('publicProBio').textContent = p.bio || 'Este profissional ainda não adicionou uma apresentação.';
  $('publicProRating').textContent = rating(p);
  $('publicProReviews').innerHTML = '<div class="profile-review-empty">A carregar avaliações…</div>';
  $('publicProRequest').onclick = () => {
    $('publicProModal')?.classList.remove('open');
    requestHandler(p);
  };
  $('publicProModal')?.classList.add('open');

  const { data, error } = await S.rpc('public_professional_reviews', { p_professional_id: p.user_id, p_limit: 20 });
  if (error) {
    $('publicProReviews').innerHTML = '<div class="profile-review-empty">Não foi possível carregar as avaliações.</div>';
    return;
  }
  const rows = data || [];
  $('publicProReviews').innerHTML = rows.length ? rows.map((review) => `
    <article class="profile-review">
      <div class="profile-review-head"><strong>${stars(review.rating)}</strong><span>${new Date(review.created_at).toLocaleDateString('pt-PT')}</span></div>
      <p>${review.comment ? escapeHtml(review.comment) : '<em>Sem comentário.</em>'}</p>
    </article>
  `).join('') : '<div class="profile-review-empty">Este profissional ainda não tem avaliações.</div>';
}

function renderProfessionals(professionals) {
  if (!professionals.length) {
    $('empty').classList.remove('hidden');
    return;
  }

  $('cards').innerHTML = professionals.map((p) => {
    const zone = professionalZone(p);
    const distance = formatDistance(p.distance_km);
    return `<article class="pro-card">
      <div class="pro-top"><div class="avatar">${escapeHtml((p.public_name || 'C').charAt(0).toUpperCase())}</div><div><h3>${escapeHtml(p.public_name || 'Profissional Chama O Pro')}</h3><div class="meta">${escapeHtml(p.headline || selectedSkill.name)} · ${escapeHtml(zone)}</div></div></div>
      <div class="badges">${distance ? `<span class="badge distance-badge">⌖ ${escapeHtml(distance)} de ti</span>` : ''}<span class="badge ${p.is_available ? 'on' : ''}">${p.is_available ? '● Disponível agora' : 'A combinar'}</span><span class="badge rating-badge">${rating(p)}</span><span class="badge">${p.verification_status === 'verified' ? '✓ Verificado' : 'Novo na plataforma'}</span></div>
      <p class="bio">${escapeHtml(p.bio || 'Sem apresentação ainda.')}</p>
      <div class="pro-foot"><strong>${price(p)}</strong><div class="pro-card-actions"><button class="btn ghost view-pro" type="button" data-professional="${p.user_id}">Ver perfil</button><button class="btn primary ask" type="button" data-professional="${p.user_id}">Pedir serviço</button></div></div>
    </article>`;
  }).join('');

  document.querySelectorAll('.ask').forEach((button) => {
    button.onclick = () => requestHandler(professionals.find((p) => p.user_id === button.dataset.professional) || null);
  });
  document.querySelectorAll('.view-pro').forEach((button) => {
    button.onclick = () => openPublicProfessionalProfile(professionals.find((p) => p.user_id === button.dataset.professional) || null);
  });
}

async function handleSearch(event) {
  event.preventDefault();
  lastQuery = $('problem').value.trim();
  lastCity = $('city').value.trim();
  selectedSkill = resolveSkill(lastQuery);
  lastLocation = null;
  $('results').classList.remove('hidden');
  $('cards').innerHTML = '';
  $('empty').classList.add('hidden');

  if (!selectedSkill) {
    $('matchText').textContent = 'Escolhe uma categoria ou descreve melhor o que precisas';
    $('empty').classList.remove('hidden');
    await logSearch(0);
    return;
  }

  if (lastCity) {
    $('matchText').textContent = `${selectedSkill.name} · a reconhecer ${lastCity}…`;
    lastLocation = await resolvePortugalLocation(lastCity);
    if (lastLocation) {
      lastCity = lastLocation.label;
      $('city').value = lastLocation.label;
    }
  }

  $('matchText').textContent = lastLocation ? `${selectedSkill.name} · mais perto de ${lastLocation.label}` : selectedSkill.name;
  try {
    const professionals = await searchProfessionals();
    await logSearch(professionals.length);
    renderProfessionals(professionals);
  } catch (error) {
    console.error(error);
    $('empty').classList.remove('hidden');
  }
  $('results').scrollIntoView({ behavior:'smooth', block:'start' });
}

export async function initSearch({ getSession = () => null, onRequest = () => {} } = {}) {
  sessionProvider = getSession;
  requestHandler = onRequest;
  const [categoryResult, skillResult] = await Promise.all([
    S.from('service_categories').select('id,name,sort_order').order('sort_order'),
    S.from('skills').select('id,category_id,slug,name').order('name'),
  ]);
  if (categoryResult.error || skillResult.error) throw new Error('Falha ao carregar serviços');
  categories = categoryResult.data || [];
  skills = skillResult.data || [];
  renderCategories();
  $('searchForm').onsubmit = handleSearch;
  $('publicProClose')?.addEventListener('click', () => $('publicProModal')?.classList.remove('open'));
  return { categories:[...categories], skills:[...skills] };
}

export function getSearchContext() {
  return { query:lastQuery, city:lastCity, skill:selectedSkill, location:lastLocation };
}
