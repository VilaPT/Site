(function(){
  'use strict';

  const SUPABASE_SOURCES=[
    'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.112.4/dist/umd/supabase.min.js',
    'https://unpkg.com/@supabase/supabase-js@2.112.4/dist/umd/supabase.min.js'
  ];
  const SCRIPT_TIMEOUT_MS=3000;

  function hasSupabase(){
    return Boolean(window.supabase && typeof window.supabase.createClient==='function');
  }

  function loadClassicScript(src){
    return new Promise((resolve,reject)=>{
      let finished=false;
      const script=document.createElement('script');
      const timer=setTimeout(()=>finish(new Error('Timeout ao carregar '+src)),SCRIPT_TIMEOUT_MS);
      function finish(error){
        if(finished)return;
        finished=true;
        clearTimeout(timer);
        script.onload=null;
        script.onerror=null;
        if(error){
          try{script.remove()}catch(_){/* noop */}
          reject(error);
        }else{
          resolve();
        }
      }
      script.src=src;
      script.async=true;
      script.onload=()=>finish(null);
      script.onerror=()=>finish(new Error('Falha ao carregar '+src));
      document.head.appendChild(script);
    });
  }

  async function ensureSupabase(){
    if(hasSupabase())return;
    for(const src of SUPABASE_SOURCES){
      try{
        await loadClassicScript(src);
        if(hasSupabase())return;
      }catch(error){
        console.warn('[Chama O Pro] CDN indisponível:',src,error);
      }
    }
    throw new Error('Não foi possível carregar a ligação de dados.');
  }

  async function startModules(){
    await import('./app.js?v=15');
    await import('./account.js?v=15');
    await import('./js/community.js?v=15');
    await import('./navigation-messages.js?v=15');
    await import('./homepage-flow.js?v=15');
    await import('./business37.js?v=15');
    await import('./social38.js?v=15');
    await import('./professional-activity.js?v=15');
    await import('./reports.js?v=15');
    await import('./admin-control.js?v=15');
    await import('./district-profile.js?v=15');
    await import('./owner-console.js?v=15');
    await import('./owner-district-multi.js?v=15');
  }

  function reveal(){
    const started=window.__copBootStart||performance.now();
    const remaining=Math.max(0,850-(performance.now()-started));
    setTimeout(()=>document.body.classList.add('cop-ready'),remaining);
  }

  function showRecovery(error){
    console.error('[Chama O Pro] Falha no arranque',error);
    reveal();
    const box=document.createElement('div');
    box.id='copStartupRecovery';
    box.setAttribute('role','alert');
    box.style.cssText='position:fixed;left:50%;bottom:18px;z-index:2147483647;transform:translateX(-50%);width:min(520px,calc(100% - 28px));background:#142124;color:#fff;border-radius:18px;padding:14px 16px;box-shadow:0 18px 50px rgba(0,0,0,.28);font:600 14px/1.45 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif';
    box.innerHTML='<strong style="display:block;margin-bottom:4px">A ligação não arrancou corretamente.</strong><span style="display:block;opacity:.86;margin-bottom:10px">Podes tentar novamente. A página não ficará presa no loading.</span><button type="button" style="border:0;border-radius:999px;padding:10px 14px;font:inherit;font-weight:800;cursor:pointer">Tentar novamente</button>';
    const button=box.querySelector('button');
    if(button)button.addEventListener('click',()=>window.location.reload());
    document.body.appendChild(box);
  }

  (async function boot(){
    try{
      await ensureSupabase();
      await startModules();
      reveal();
    }catch(error){
      showRecovery(error);
    }
  })();
})();
