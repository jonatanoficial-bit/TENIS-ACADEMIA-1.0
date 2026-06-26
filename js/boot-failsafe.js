(function(){
  'use strict';
  var VERSION = '4.8.2';
  var BUILD = '20260626-124500';
  var LABEL = 'v4.8.2 • 26/06/2026 • 12:45:00';
  var STORAGE_KEY = 'vale_tennis_manager_save';
  var BACKUP_KEY = 'vale_tennis_manager_save_backup';
  var LEGACY_KEYS = ['ace_academy_save_v040','ace-manager-save'];
  var AVATARS = [
    'assets/branding/players/player_blond.png',
    'assets/branding/players/player_latino.png',
    'assets/branding/players/player_asian.png',
    'assets/branding/players/player_black.png',
    'assets/branding/players/player_brunette.png'
  ];
  function q(id){ return document.getElementById(id); }
  function qa(sel, root){ return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function setText(id, value){ var el=q(id); if(el) el.textContent=value; }
  function safeParse(raw){ try { return raw ? JSON.parse(raw) : null; } catch(e){ return null; } }
  function readSave(){
    var raw = null;
    try { raw = localStorage.getItem(STORAGE_KEY); } catch(e){}
    if(!raw){
      for(var i=0;i<LEGACY_KEYS.length;i++){
        try { raw = localStorage.getItem(LEGACY_KEYS[i]); } catch(e){}
        if(raw) break;
      }
    }
    return safeParse(raw);
  }
  function hasPlayableSave(save){
    return !!(save && save.flags && save.flags.ownerSetupComplete && save.academy && save.academy.owner && save.academy.owner.name && save.academy.name && Array.isArray(save.roster) && save.roster.length && Array.isArray(save.ranking) && save.ranking.length && Array.isArray(save.calendar) && save.calendar.length);
  }
  function selectedAvatar(){
    var active = document.querySelector('#ownerAvatarChoices [data-owner-avatar].active, #ownerAvatarChoices [data-owner-avatar][aria-pressed="true"]');
    return (active && active.getAttribute('data-owner-avatar')) || AVATARS[1];
  }
  function renderAvatars(){
    var host = q('ownerAvatarChoices');
    if(!host) return;
    if(host.children.length && host.querySelector('[data-owner-avatar]')) return;
    host.innerHTML = AVATARS.map(function(src, idx){
      return '<button class="choice-avatar '+(idx===1?'active':'')+'" type="button" data-owner-avatar="'+src+'" aria-pressed="'+(idx===1?'true':'false')+'"><img class="avatar-img" src="'+src+'" alt="Avatar '+(idx+1)+'" loading="eager"><span>Avatar '+(idx+1)+'</span></button>';
    }).join('');
  }
  function selectAvatar(btn){
    qa('#ownerAvatarChoices [data-owner-avatar]').forEach(function(el){ el.classList.remove('active'); el.setAttribute('aria-pressed','false'); });
    btn.classList.add('active'); btn.setAttribute('aria-pressed','true');
    updatePreview();
  }
  function updatePreview(){
    var host=q('careerPreview'); if(!host) return;
    var name=((q('ownerNameInput')||{}).value || 'Treinador').trim();
    var academy=((q('academyNameInput')||{}).value || 'Sua academia').trim();
    var city=((q('academyCityInput')||{}).value || 'Cidade').trim();
    var country=((q('ownerCountryInput')||{}).value || 'BRA').trim().toUpperCase();
    host.innerHTML='<strong>'+escapeHtml(academy)+'</strong><span>'+escapeHtml(name)+' • '+escapeHtml(city)+' • '+escapeHtml(country)+'</span>';
  }
  function escapeHtml(v){ return String(v||'').replace(/[&<>"]/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]; }); }
  function fillDefaults(){
    if(q('ownerCountryInput') && !q('ownerCountryInput').value) q('ownerCountryInput').value='BRA';
    if(q('ownerAgeInput') && !q('ownerAgeInput').value) q('ownerAgeInput').value='36';
    if(q('academyCityInput') && !q('academyCityInput').value) q('academyCityInput').value='São Paulo';
    if(q('academyLogoInput') && !q('academyLogoInput').value) q('academyLogoInput').value='VTA';
  }
  function hideLock(){ var lock=q('onboardingRuntimeLock'); if(lock) lock.classList.add('hidden'); }
  function openSetup(reason){
    hideLock();
    var modal=q('ownerSetupModal');
    if(!modal) return false;
    fillDefaults(); renderAvatars(); updatePreview();
    modal.style.display='flex';
    modal.classList.remove('hidden');
    modal.setAttribute('aria-hidden','false');
    document.body.classList.add('setup-open','setup-focus-mode','forced-onboarding-active');
    var alert=q('forcedSetupAlert');
    if(alert) alert.textContent='Crie sua carreira: escolha avatar, nome do treinador, país, cidade e nome da academia. Depois toque em Criar carreira e entrar.';
    var text=q('runtimeLockText');
    if(text) text.textContent='A carreira ainda não foi criada neste navegador. Complete o cadastro inicial para liberar o jogo.';
    setTimeout(function(){ try { (q('ownerNameInput') || q('academyNameInput')).focus({preventScroll:true}); } catch(e){} }, 60);
    return true;
  }
  function validate(){
    var errors=[];
    var owner=((q('ownerNameInput')||{}).value || '').trim();
    var academy=((q('academyNameInput')||{}).value || '').trim();
    var city=((q('academyCityInput')||{}).value || '').trim();
    var country=((q('ownerCountryInput')||{}).value || '').trim().toUpperCase();
    if(owner.length<2) errors.push('Informe o nome do treinador.');
    if(academy.length<3) errors.push('Informe o nome da academia.');
    if(city.length<2) errors.push('Informe a cidade-sede.');
    if(country.length<2) errors.push('Informe o país com 2 ou 3 letras.');
    if(!selectedAvatar()) errors.push('Escolha um avatar.');
    var box=q('setupValidation');
    if(box){ box.innerHTML=errors.map(function(e){ return '<span>• '+escapeHtml(e)+'</span>'; }).join(''); box.classList.toggle('hidden', !errors.length); }
    return errors;
  }
  function starterState(){
    var owner=((q('ownerNameInput')||{}).value || 'Treinador Vale').trim();
    var academy=((q('academyNameInput')||{}).value || 'Vale Tennis Academy').trim();
    var city=((q('academyCityInput')||{}).value || 'São Paulo').trim();
    var country=((q('ownerCountryInput')||{}).value || 'BRA').trim().toUpperCase().replace(/[^A-Z]/g,'').slice(0,3) || 'BRA';
    var logo=((q('academyLogoInput')||{}).value || 'VTA').trim().toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,3) || 'VTA';
    var avatar=selectedAvatar();
    var roster=[
      {id:'vale-starter-1',name:'Lucas Andrade',country:'BRA',countryCode:'BRA',age:19,rank:162,rankingPoints:320,points:320,overall:66,potential:82,style:'All court',preferredSurface:'hard',serve:66,return:64,forehand:68,backhand:63,stamina:70,mental:68,focus:68,morale:72,fatigue:8,injuries:0,health:100,injuredWeeks:0,salary:3450,isUser:true,avatar:avatar,lastResult:'Sem jogos'},
      {id:'vale-starter-2',name:'Mateus Silva',country:'BRA',countryCode:'BRA',age:22,rank:214,rankingPoints:210,points:210,overall:63,potential:76,style:'Defensivo',preferredSurface:'clay',serve:60,return:66,forehand:64,backhand:65,stamina:74,mental:66,focus:66,morale:72,fatigue:8,injuries:0,health:100,injuredWeeks:0,salary:3375,isUser:true,avatar:AVATARS[4],lastResult:'Sem jogos'}
    ];
    var ranking=[
      {id:'rank-1',rank:1,name:'Carlos Rivera',country:'ESP',countryCode:'ESP',points:9000,rankingPoints:9000,overall:94,age:23,style:'All court',preferredSurface:'clay',isUser:false},
      {id:'rank-2',rank:2,name:'Jannik Rossi',country:'ITA',countryCode:'ITA',points:8600,rankingPoints:8600,overall:93,age:24,style:'Agressivo',preferredSurface:'hard',isUser:false},
      {id:'rank-3',rank:3,name:'Daniil Petrov',country:'RUS',countryCode:'RUS',points:8100,rankingPoints:8100,overall:92,age:27,style:'Defensivo',preferredSurface:'hard',isUser:false},
      {id:'rank-user-1',rank:162,name:'Lucas Andrade',country:'BRA',points:320,rankingPoints:320,overall:66,age:19,style:'All court',preferredSurface:'hard',isUser:true,playerId:'vale-starter-1'},
      {id:'rank-user-2',rank:214,name:'Mateus Silva',country:'BRA',points:210,rankingPoints:210,overall:63,age:22,style:'Defensivo',preferredSurface:'clay',isUser:true,playerId:'vale-starter-2'}
    ];
    var calendar=[
      {id:'brisbane-250',week:1,name:'Brisbane Open',tier:'ATP 250',category:'ATP250',surface:'hard',prize:22000,prizePool:700000,minRank:220,drawSize:32,inviteSlots:2,city:'Brisbane',country:'AUS',prestige:45,winnerPoints:250,kind:'tour'},
      {id:'australian-open',week:3,name:'Australian Open',tier:'Grand Slam',category:'GRAND_SLAM',surface:'hard',prize:120000,prizePool:50000000,minRank:128,drawSize:128,inviteSlots:8,city:'Melbourne',country:'AUS',prestige:98,winnerPoints:2000,kind:'major'},
      {id:'rio-open',week:8,name:'Rio Open',tier:'ATP 500',category:'ATP500',surface:'clay',prize:42000,prizePool:2100000,minRank:180,drawSize:32,inviteSlots:2,city:'Rio de Janeiro',country:'BRA',prestige:68,winnerPoints:500,kind:'tour'},
      {id:'indian-wells',week:11,name:'Indian Wells Masters',tier:'Masters 1000',category:'ATP1000',surface:'hard',prize:88000,prizePool:9600000,minRank:140,drawSize:96,inviteSlots:4,city:'Indian Wells',country:'USA',prestige:90,winnerPoints:1000,kind:'masters'}
    ];
    return {
      version:VERSION,
      meta:{schemaVersion:47,version:VERSION,build:BUILD,builtAt:'2026-06-26T12:45:00-03:00',createdAt:new Date().toISOString(),source:'boot-failsafe-v4.8.2'},
      academy:{name:academy,city:city,country:country,season:2026,week:1,reputation:18,sponsor:22000,money:250000,cash:250000,weeklyCosts:14500,bankruptcyWarnings:0,facilities:{training:1,medical:1,finance:1,scouting:1,courtsHard:1,courtsClay:0,courtsGrass:0,gym:1,dormitory:0,analytics:0,marketing:0,maintenance:1},owner:{name:owner,country:country,avatar:avatar,logo:logo,age:Number((q('ownerAgeInput')||{}).value || 36),gender:(q('ownerGenderInput')||{}).value || 'masculino',background:(q('ownerBackgroundInput')||{}).value || 'ex-jogador',specialty:(q('ownerSpecialtyInput')||{}).value || 'tecnica'},careerProfile:{ownerName:owner,academyName:academy,city:city,country:country,philosophy:(q('academyPhilosophyInput')||{}).value || 'equilibrada',difficulty:(q('careerDifficultyInput')||{}).value || 'normal',currency:(q('careerCurrencyInput')||{}).value || 'BRL',avatar:avatar,createdInBuild:BUILD}},
      roster:roster, ranking:ranking, calendar:calendar, marketTalents:[], staffMarket:[], staff:{Tecnico:null,'Preparador Fisico':null,Fisioterapeuta:null,Psicologo:null,Nutricionista:null,Analista:null,Scouting:null,Financeiro:null}, match:null, activeTournament:null,
      logs:['Carreira criada pelo início blindado v4.8.2.'], summary:['Semana 1 iniciada. Configure treino, calendário e primeira partida.'], inbox:[{title:'Bem-vindo, '+owner,body:'A '+academy+' iniciou sua trajetória internacional em '+city+'.',week:1}], sponsorOffers:[], objectives:{current:'Entrar no Top 120'},
      worldTour:{weeklyResults:[],rankingHistory:[],lastSimulatedWeek:0,lastSimulatedSeason:2026}, trainingLab:{cycle:'balanced',autoApply:true,lastProcessedWeek:0,lastReport:[],plans:{}}, tournamentDraws:{}, tournamentLife:{championHistory:[],drawAudit:[],lastViewedDraw:null}, flags:{ownerSetupComplete:true,safeMode:false}, tournamentIdentity:{spotlightHistory:[],lastViewedEvent:null}, broadcast:{presentationMode:'pro',replayArchive:[],lastAudit:null}, playerCareer:{weeklyEvents:[],conversations:[],promises:[],lastProcessedToken:null}, tacticalIntelligence:{plan:{serveTarget:'body',rallyPlan:'balanced',attackPattern:'weakness',returnPlan:'secondServePressure',riskMode:'balanced'},history:[],lastAppliedWeek:0,analyst:'Plano equilibrado ativo.'}, visualAcademy:{activeScene:'office',lastViewedScene:'office',environmentAudit:[],premiumMode:true}, newsroom:{items:[],pressQuestions:[],sentiment:62,reputationPulse:0,lastProcessedToken:null,lastInterviewWeek:0}, mobileUX:{mode:'auto',compact:false,oneHand:false,matchFocus:true,reduceMotion:false,lastViewport:null,auditLog:[]}, commercialCareer:{ledger:[],activeSponsors:[],sponsorPipeline:[],investorOffers:[],travelBudgetMode:'balanced',riskScore:24,cashflowTrend:0,lastProcessedToken:null,boardConfidence:64}, generationalCareer:{seasonHistory:[],retirementLog:[],hallOfFame:[],prospects:[],records:{},legacyScore:0,lastProcessedSeason:null,simulationAudit:[]}, mandatoryCareerGate:{locked:false,firstRunGatePassed:true}, forcedOnboardingGate:{hardLock:false,firstRunConfirmed:true}, careerCreationUX:{score:100,setupAttempts:1,avatarTouchCount:1,saveButtonChecks:[],auditLog:[{title:'Carreira criada',result:'OK',note:owner+' • '+academy,at:new Date().toISOString(),build:BUILD}],lastSelectedAvatar:avatar,firstRunVerified:true,buttonGuardActive:true}, startScreenV2:{score:100,visits:1,lastReason:'carreira criada',dismissedForBuild:BUILD,auditLog:[],flags:{premiumLanding:true,careerCreator20:true,blockDashboardUntilValid:true,continueRequiresValidCareer:true,guidedRecovery:true}}, ui:{currentTab:'dashboard',lastStableTab:'dashboard'}
    };
  }
  function saveCareer(){
    if(window.__valeTennisBootReady && window.__valeTennisRealSaveOwnerSetup) return false;
    var errors=validate();
    if(errors.length) return false;
    var state=starterState();
    try {
      var prev=localStorage.getItem(STORAGE_KEY);
      if(prev) localStorage.setItem(BACKUP_KEY, prev);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      localStorage.setItem('vale_tennis_last_seen_build', BUILD);
      localStorage.setItem('vale_tennis_last_seen_version', VERSION);
    } catch(e){ alert('Não consegui salvar no navegador: '+(e.message||e)); return false; }
    setText('moneyLabel','$250,000'); setText('reputationLabel','18'); setText('sponsorLabel','$22,000'); setText('rosterCountLabel','2'); setText('statusText','Carreira criada. Recarregando jogo completo...');
    var modal=q('ownerSetupModal'); if(modal){ modal.classList.add('hidden'); modal.setAttribute('aria-hidden','true'); modal.style.display='none'; }
    document.body.classList.remove('setup-open','setup-focus-mode','forced-onboarding-active');
    try { location.replace('index.html?fresh=1&start=1&failsafe='+encodeURIComponent(BUILD)+'#dashboard'); } catch(e){ location.reload(); }
    return true;
  }
  function repair(){
    try {
      var prev=localStorage.getItem(STORAGE_KEY); if(prev) localStorage.setItem(BACKUP_KEY, prev);
      [STORAGE_KEY].concat(LEGACY_KEYS).forEach(function(k){ localStorage.removeItem(k); });
    } catch(e){}
    openSetup('reparar base');
    return true;
  }
  function cleanReload(){
    var tasks=[];
    try { if('caches' in window) tasks.push(caches.keys().then(function(keys){ return Promise.all(keys.filter(function(k){ return /^vale-tennis-/.test(k); }).map(function(k){ return caches.delete(k); })); })); } catch(e){}
    try { if(navigator.serviceWorker) tasks.push(navigator.serviceWorker.getRegistrations().then(function(regs){ return Promise.all(regs.map(function(r){ return r.unregister(); })); })); } catch(e){}
    Promise.allSettled(tasks).then(function(){ location.replace('index.html?fresh=1&hardreset=1&v='+encodeURIComponent(BUILD)+'#setup'); });
  }
  function fallbackSwitch(tab){
    if(window.__valeTennisBootReady) return;
    if(!tab) return;
    qa('.tab-panel').forEach(function(p){ p.classList.remove('active'); });
    var panel=q('tab-'+tab); if(panel) panel.classList.add('active');
    qa('.tab-btn,.dock-btn').forEach(function(b){ b.classList.toggle('active', b.getAttribute('data-tab')===tab); });
  }
  function bootWatchdog(){
    var save=readSave();
    if(window.__valeTennisBootReady) { hideLock(); return; }
    renderAvatars(); fillDefaults(); updatePreview();
    if(!hasPlayableSave(save)) openSetup('primeiro acesso');
    else {
      hideLock();
      setText('statusText','Save encontrado. Se o painel não responder, limpe o cache e recarregue.');
    }
  }
  window.__valeTennisFailSafeOpenSetup = openSetup;
  window.__valeTennisFailSafeRepair = repair;
  window.__valeTennisFailSafeCleanReload = cleanReload;
  window.__valeTennisFailSafeBootWatchdog = bootWatchdog;
  window.forceOnboardingLauncher = window.forceOnboardingLauncher || openSetup;
  window.forceRepairInvalidCareer = window.forceRepairInvalidCareer || repair;
  window.runOnboardingRuntimeProof = window.runOnboardingRuntimeProof || openSetup;
  window.hardResetFirstRun = window.hardResetFirstRun || repair;
  window.clearCachesThenFreshStart = window.clearCachesThenFreshStart || cleanReload;
  window.addEventListener('error', function(event){
    if(event && event.target && event.target.tagName === 'SCRIPT') setTimeout(function(){ openSetup('script não carregou'); }, 50);
  }, true);
  document.addEventListener('input', function(ev){ if(ev.target && ev.target.closest && ev.target.closest('#ownerSetupModal')) updatePreview(); }, true);
  document.addEventListener('click', function(ev){
    var btn = ev.target && ev.target.closest ? ev.target.closest('button,a') : null;
    if(!btn) return;
    if(btn.matches('#ownerAvatarChoices [data-owner-avatar]')) { ev.preventDefault(); selectAvatar(btn); return; }
    var id=btn.id || '';
    var tab=btn.getAttribute('data-tab');
    var txt=(btn.textContent || '').trim().toLowerCase();
    if(!window.__valeTennisBootReady && (id==='saveOwnerSetupBtn')) { ev.preventDefault(); ev.stopImmediatePropagation(); saveCareer(); return; }
    if(!window.__valeTennisBootReady && (id==='repairStartBtn' || id==='recoverCareerBtn' || id==='resetBtn' || txt.indexOf('reparar')>=0 || txt.indexOf('resetar')>=0)) { ev.preventDefault(); ev.stopImmediatePropagation(); repair(); return; }
    if(!window.__valeTennisBootReady && (id==='openSetupBtn' || id==='openSetupBannerBtn' || id==='forceSetupModalBtn' || id==='criticalOpenSetupBtn' || tab==='startscreen' || tab==='setupverify' || txt.indexOf('abrir criação')>=0 || txt.indexOf('criar carreira')>=0)) { ev.preventDefault(); ev.stopImmediatePropagation(); openSetup('botão de criação'); return; }
    if(!window.__valeTennisBootReady && tab) { fallbackSwitch(tab); }
  }, true);
  window.addEventListener('DOMContentLoaded', function(){ renderAvatars(); fillDefaults(); updatePreview(); setTimeout(bootWatchdog, 900); });
  window.addEventListener('load', function(){ setTimeout(bootWatchdog, 1600); setTimeout(bootWatchdog, 3200); });
})();
