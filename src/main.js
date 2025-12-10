import { StateMachine } from './stateMachine.js';
import { Pet } from './pet.js';
import { clear, drawPet, spawnConfetti, spawnBattleAnimation } from './render.js';

const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');

function resize(){
  // keep internal resolution fixed but scale to display size for crisp canvas
  const rect = canvas.getBoundingClientRect();
  canvas.width = 600;
  canvas.height = 400;
}

resize();

const pet = new Pet();
const sm = new StateMachine('idle');

// Guardrails: track last action time for training/action cooldowns
let lastTrainTime = 0;
const trainCooldown = 2000; // 2 seconds between training actions

const statsEl = document.getElementById('stats');
const logEl = document.getElementById('log');
const subtitleEl = document.getElementById('subtitle');
const evoFillEl = document.getElementById('evo-fill');
const evoLabelEl = document.getElementById('evo-label');
const evoSectionEl = document.querySelector('.evo');
const trainingStatsEl = document.getElementById('training-stats');
const battleSectionEl = document.getElementById('battle-section');
const battleInfoEl = document.getElementById('battle-info');
const battleHpsEl = document.getElementById('battle-hps');
const battleLogEl = document.getElementById('battle-log');
const srAnnouncer = document.getElementById('sr-announcer');
const battleBadgeEl = document.getElementById('battle-badge');
const victoryBannerEl = document.getElementById('victory-banner');
const defeatBannerEl = document.getElementById('defeat-banner');

function updateEvoUI(){
  if(!evoFillEl || !evoLabelEl || !evoSectionEl) return;
  const form = pet.form;

  // dead or final form (circle-plus) -> show appropriate message
  if(form === 'dead'){
    evoSectionEl.classList.remove('hidden');
    evoFillEl.style.width = '100%';
    evoLabelEl.textContent = 'No evolution (pet is dead)';
    return;
  }
  if(form === 'circle-plus'){
    evoSectionEl.classList.remove('hidden');
    evoFillEl.style.width = '100%';
    evoLabelEl.textContent = 'Maxed: no further evolution';
    return;
  }

  // if actively evolving, show evolve progress based on evolveStart/evolveDuration
  if(pet.evolving){
    evoSectionEl.classList.remove('hidden');
    const dur = (pet.evolveDuration || 1000) / 1000; // seconds
    const start = pet.evolveStart || Date.now();
    const elapsed = Math.max(0, (Date.now() - start) / 1000);
    const pct = Math.min(1, elapsed / dur);
    evoFillEl.style.width = `${pct * 100}%`;
    evoLabelEl.textContent = `Evolving: ${Math.round(elapsed)}s / ${Math.round(dur)}s`;
    return;
  }

  // not evolving: show accumulated timers depending on current form
  if(form === 'circle'){
    const got = (pet._wellness70Timer || 0);
    const required = 120; // seconds to reach triangle
    const pct = Math.min(1, got / required);
    evoSectionEl.classList.remove('hidden');
    evoFillEl.style.width = `${pct * 100}%`;
    evoLabelEl.textContent = `To Triangle: ${Math.round(got)}s / ${required}s`;
    return;
  }
  if(form === 'triangle'){
    const got = (pet._wellness60Timer || 0);
    const required = 300; // seconds to reach square
    const pct = Math.min(1, got / required);
    evoSectionEl.classList.remove('hidden');
    evoFillEl.style.width = `${pct * 100}%`;
    evoLabelEl.textContent = `To Square: ${Math.round(got)}s / ${required}s`;
    return;
  }

  if(form === 'square'){
    const got = (pet._wellness75Timer || 0);
    const required = 240; // seconds to reach the dotted circle-plus form
    const pct = Math.min(1, got / required);
    evoSectionEl.classList.remove('hidden');
    evoFillEl.style.width = `${pct * 100}%`;
    evoLabelEl.textContent = `To Ascended Circle: ${Math.round(got)}s / ${required}s`;
    return;
  }

  // default: hide
  evoSectionEl.classList.add('hidden');
}

// simple WebAudio refusal sound (synthesized) — context created on first user interaction
let audioCtx = null;
function ensureAudio(){
  if(!audioCtx){
    try{ audioCtx = new (window.AudioContext || window.webkitAudioContext)(); }catch(e){ audioCtx = null; }
  }
}

function playRefusalSound(type = ''){
  ensureAudio();
  if(!audioCtx) return;
  const now = audioCtx.currentTime;
  const o = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  // choose frequency based on type for slight variation
  const freqMap = { 'no-feed': 220, 'no-play': 260, 'no-sleep': 200, 'no-heal': 300 };
  o.type = 'sine';
  o.frequency.value = freqMap[type] || 240;
  g.gain.value = 0.0;
  o.connect(g); g.connect(audioCtx.destination);
  o.start(now);
  g.gain.linearRampToValueAtTime(0.12, now + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);
  o.stop(now + 0.36);
}

// Victory / defeat sounds
function playVictorySound(){
  ensureAudio(); if(!audioCtx) return;
  const now = audioCtx.currentTime;
  const freqs = [520, 660, 880];
  freqs.forEach((f,i)=>{
    const o = audioCtx.createOscillator(); const g = audioCtx.createGain();
    o.type = 'sine'; o.frequency.value = f;
    o.connect(g); g.connect(audioCtx.destination);
    const start = now + i * 0.06;
    o.start(start);
    g.gain.setValueAtTime(0.001, start);
    g.gain.linearRampToValueAtTime(0.14, start + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, start + 0.7);
    o.stop(start + 0.75);
  });
}

function playDefeatSound(){
  ensureAudio(); if(!audioCtx) return;
  const now = audioCtx.currentTime;
  const o = audioCtx.createOscillator(); const g = audioCtx.createGain();
  o.type = 'sawtooth'; o.frequency.value = 120;
  o.connect(g); g.connect(audioCtx.destination);
  o.start(now);
  g.gain.setValueAtTime(0.08, now);
  g.gain.exponentialRampToValueAtTime(0.0001, now + 1.2);
  o.stop(now + 1.25);
}

function announceSR(text, duration = 3000){
  try{
    if(!srAnnouncer) return;
    srAnnouncer.textContent = '';
    // small timeout to ensure screen readers notice the text change
    setTimeout(()=>{ srAnnouncer.textContent = text; }, 50);
    if(duration > 0){ setTimeout(()=>{ try{ srAnnouncer.textContent = ''; }catch(e){} }, duration); }
  }catch(e){}
}

// subtitle display
let subtitleTimeout = null;
function showSubtitle(text, duration = 900){
  if(!subtitleEl) return;
  subtitleEl.textContent = text;
  subtitleEl.classList.add('show');
  if(subtitleTimeout) clearTimeout(subtitleTimeout);
  subtitleTimeout = setTimeout(()=>{
    subtitleEl.classList.remove('show');
    subtitleTimeout = null;
  }, duration);
}

// Disable or enable interactive UI when pet is dead; keep Reset enabled
function updateDeadUI(){
  const interactiveIds = [
    'btn-play','btn-start-battle','btn-feed','btn-sleep','btn-heal','btn-freeze',
    'btn-train-strength','btn-train-speed','btn-train-defense','btn-train-intelligence',
    'btn-attack','btn-defend','btn-flee'
  ];
  const isDead = pet.form === 'dead';
  interactiveIds.forEach(id => {
    const el = document.getElementById(id);
    if(!el) return;
    if(isDead){
      el.setAttribute('disabled','disabled');
      el.classList.add('disabled');
    } else {
      el.removeAttribute('disabled');
      el.classList.remove('disabled');
    }
  });
}

// Map shake types to subtitle text
const shakeMessages = {
  'no-feed': "I am not hungry",
  'no-play': "I don't want to play",
  'no-sleep': "I can't sleep right now",
  'no-heal': "I am very healthy",
  'no-train': "I'm too tired to train"
};

// Listen for pet shake events
window.addEventListener('pet:shake', (e) => {
  const { type, durationMs } = e.detail || {};
  const message = shakeMessages[type] || "No thanks";
  playRefusalSound(type);
  showSubtitle(message, durationMs || 900);
});

// Listen for evolution events to celebrate
window.addEventListener('pet:evolve', (e) => {
  const { from, to, durationMs } = e.detail || {};
  const message = `Evolved into ${to.toUpperCase()}!`;
  showSubtitle(message, durationMs || 1500);
  // celebratory sound: quick triad
  ensureAudio();
  if(audioCtx){
    const now = audioCtx.currentTime;
    const freqs = [440, 660, 880];
    freqs.forEach((f, i)=>{
      const o = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      o.type = 'sawtooth'; o.frequency.value = f;
      o.connect(g); g.connect(audioCtx.destination);
      const start = now + i * 0.05;
      o.start(start);
      g.gain.setValueAtTime(0.001, start);
      g.gain.linearRampToValueAtTime(0.12, start + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, start + 0.5);
      o.stop(start + 0.55);
    });
  }
  // spawn confetti at canvas center using the current wellness-derived hue
  try{
    const hungerGood = 100 - pet.hunger;
    const wellness = (hungerGood * 0.5) + (pet.energy * 0.3) + (pet.health * 0.2);
    const hue = Math.round((wellness / 100) * 200);
    spawnConfetti(canvas.width/2, canvas.height/2, hue, 48);
  }catch(e){}
  try{ pet.saveState(); }catch(e){}
});

function updateStats(){
  // Compact HUD rendering (progress bars)
  const hunger = Math.round(Math.max(0, Math.min(100, pet.hunger)));
  const happiness = Math.round(Math.max(0, Math.min(100, pet.happiness)));
  const energy = Math.round(Math.max(0, Math.min(100, pet.energy)));
  const health = Math.round(Math.max(0, Math.min(100, pet.health)));
  statsEl.innerHTML = `
    <div class="compact-hud">
      <div class="stat-row"><div class="stat-label">State</div><div style="flex:1"> <b>${sm.get()}</b></div></div>
      <div class="stat-row"><div class="stat-label">Hunger</div><div class="stat-bar"><div class="stat-fill" style="width:${100 - hunger}%"></div></div><div class="stat-value">${100 - hunger}%</div></div>
      <div class="stat-row"><div class="stat-label">Happiness</div><div class="stat-bar"><div class="stat-fill" style="width:${happiness}%"></div></div><div class="stat-value">${happiness}%</div></div>
      <div class="stat-row"><div class="stat-label">Energy</div><div class="stat-bar"><div class="stat-fill" style="width:${energy}%"></div></div><div class="stat-value">${energy}%</div></div>
      <div class="stat-row"><div class="stat-label">Health</div><div class="stat-bar"><div class="stat-fill" style="width:${health}%"></div></div><div class="stat-value">${health}%</div></div>
      <div class="stat-row"><div class="stat-label">Age</div><div style="flex:1">${Math.floor(pet.age)}s ${pet.frozen ? '🥶' : ''}</div></div>
    </div>
  `;

  // render log content into the log panel (may be hidden via toggle)
  logEl.innerHTML = pet.log.map(l=>`<div>${l}</div>`).join('');

  // Ensure dead UI state is kept in sync
  updateDeadUI();
}

function updateTrainingUI(){
  if(!trainingStatsEl) return;
  const abilities = Object.entries(pet.training);
  trainingStatsEl.innerHTML = abilities.map(([name, data]) => {
    const xpPercent = (data.xp / 100) * 100;
    return `
      <div class="training-stat">
        <span>${name.charAt(0).toUpperCase() + name.slice(1)} Lvl ${data.level}</span>
        <div class="training-bar">
          <div class="training-fill" style="width:${xpPercent}%"></div>
        </div>
      </div>
    `;
  }).join('');
}

// Log toggle handler (legend now in FAQ modal)
let logVisible = true;
const logToggleBtn = document.getElementById('btn-toggle-log');
if(logToggleBtn){
  logToggleBtn.addEventListener('click', ()=>{
    logVisible = !logVisible;
    const logContainer = document.getElementById('log');
    if(!logContainer) return;
    logContainer.style.display = logVisible ? 'block' : 'none';
    logToggleBtn.textContent = logVisible ? 'Hide Log' : 'Show Log';
  });
}

// Training modal: open/close handlers
const trainingModal = document.getElementById('training-modal');
const btnOpenTraining = document.getElementById('btn-open-training');
const btnCloseTraining = document.getElementById('btn-close-training');
const modalOverlay = document.getElementById('training-modal-overlay');
// Modal accessibility helpers: focus trap + ESC to close; remembers opener focus
function modalShow(modal){
  if(!modal) return;
  modal.classList.add('show');
  modal.setAttribute('aria-hidden','false');
  modal.__lastFocused = document.activeElement;
  // find focusable elements
  const focusable = Array.from(modal.querySelectorAll('a[href],button:not([disabled]),textarea, input, select,[tabindex]:not([tabindex="-1"])'));
  if(focusable.length) focusable[0].focus();
  modal.__keyHandler = function(e){
    if(e.key === 'Escape'){
      modalHide(modal);
      return;
    }
    if(e.key === 'Tab'){
      if(focusable.length === 0){ e.preventDefault(); return; }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if(e.shiftKey){
        if(document.activeElement === first){ e.preventDefault(); last.focus(); }
      } else {
        if(document.activeElement === last){ e.preventDefault(); first.focus(); }
      }
    }
  };
  document.addEventListener('keydown', modal.__keyHandler);
}

function modalHide(modal){
  if(!modal) return;
  modal.classList.remove('show');
  modal.setAttribute('aria-hidden','true');
  if(modal.__keyHandler) document.removeEventListener('keydown', modal.__keyHandler);
  try{ if(modal.__lastFocused && modal.__lastFocused.focus) modal.__lastFocused.focus(); }catch(e){}
  delete modal.__keyHandler;
  delete modal.__lastFocused;
}

if(btnOpenTraining && trainingModal){
  btnOpenTraining.addEventListener('click', ()=>{
    modalShow(trainingModal);
    // ensure training UI is updated
    updateTrainingUI();
  });
}
if(btnCloseTraining && trainingModal){
  btnCloseTraining.addEventListener('click', ()=>{ modalHide(trainingModal); });
}
if(modalOverlay && trainingModal){
  modalOverlay.addEventListener('click', ()=>{ modalHide(trainingModal); });
}

// Legend/FAQ modal handlers
const legendModal = document.getElementById('legend-modal');
const btnOpenFaq = document.getElementById('btn-open-faq');
const btnCloseLegend = document.getElementById('btn-close-legend');
const legendOverlay = document.getElementById('legend-modal-overlay');
if(btnOpenFaq && legendModal){
  btnOpenFaq.addEventListener('click', ()=>{ modalShow(legendModal); });
}
if(btnCloseLegend && legendModal){
  btnCloseLegend.addEventListener('click', ()=>{ modalHide(legendModal); });
}
if(legendOverlay && legendModal){
  legendOverlay.addEventListener('click', ()=>{ modalHide(legendModal); });
}

const inventoryModal = document.getElementById('inventory-modal');
const btnOpenInventory = document.getElementById('btn-open-inventory');
const btnCloseInventory = document.getElementById('btn-close-inventory');
const inventoryOverlay = document.getElementById('inventory-modal-overlay');
const coinCountEl = document.getElementById('coin-count');
const inventoryItemsEl = document.getElementById('inventory-items');

function updateInventoryUI() {
  if(!inventoryItemsEl) return;
  if(coinCountEl) coinCountEl.textContent = pet.coins.toLocaleString();
  
  const items = Pet.getItemDefinitions();
  const hasItems = Object.entries(pet.inventory).some(([id, count]) => count > 0);
  
  if(!hasItems) {
    inventoryItemsEl.innerHTML = '<div style="color:#888;font-size:0.9rem;text-align:center;width:100%;">No items in inventory yet.</div>';
    return;
  }
  
  let html = '';
  Object.entries(pet.inventory).forEach(([itemId, count]) => {
    if(count <= 0) return;
    const item = items[itemId];
    if(!item) return;
    
    html += `
      <div style="border:1px solid #444;border-radius:8px;padding:12px;background:#1a1a1a;cursor:pointer;" onclick="window.useItemFromInventory('${itemId}')">
        <div style="font-size:2rem;text-align:center;margin-bottom:4px;">${item.emoji}</div>
        <div style="font-weight:bold;font-size:0.95rem;text-align:center;">${item.name}</div>
        <div style="font-size:0.85rem;color:#aaa;text-align:center;margin:4px 0;">×${count}</div>
        <div style="font-size:0.8rem;color:#888;text-align:center;margin-top:4px;">${item.description}</div>
        <button style="width:100%;margin-top:8px;padding:6px;background:#4a4;color:#fff;border:none;border-radius:4px;cursor:pointer;font-size:0.9rem;">Use Item</button>
      </div>
    `;
  });
  
  inventoryItemsEl.innerHTML = html;
}

window.useItemFromInventory = function(itemId) {
  const result = pet.useItem(itemId);
  if(result.success) {
    subtitleEl.textContent = result.message;
    updateInventoryUI();
    updateStats();
  } else {
    subtitleEl.textContent = 'Cannot use: ' + result.message;
  }
};

if(btnOpenInventory && inventoryModal){ 
  btnOpenInventory.addEventListener('click', ()=>{ 
    updateInventoryUI();
    modalShow(inventoryModal); 
  }); 
}
if(btnCloseInventory && inventoryModal){ btnCloseInventory.addEventListener('click', ()=>{ modalHide(inventoryModal); }); }
if(inventoryOverlay && inventoryModal){ inventoryOverlay.addEventListener('click', ()=>{ modalHide(inventoryModal); }); }

const shopModal = document.getElementById('shop-modal');
const btnOpenShop = document.getElementById('btn-open-shop');
const btnCloseShop = document.getElementById('btn-close-shop');
const shopOverlay = document.getElementById('shop-modal-overlay');
const shopItemsEl = document.getElementById('shop-items');
const shopCoinCountEl = document.getElementById('shop-coin-count');
let wasAlreadyFrozen = false;

function updateShopUI() {
  if(!shopItemsEl) return;
  if(shopCoinCountEl) shopCoinCountEl.textContent = pet.coins.toLocaleString();
  
  const items = Pet.getItemDefinitions();
  let html = '';
  
  Object.entries(items).forEach(([itemId, item]) => {
    const canAfford = pet.coins >= item.cost;
    const disabled = !canAfford ? ' disabled style="opacity:0.5;cursor:not-allowed;"' : '';
    
    html += `
      <div style="border:1px solid #444;border-radius:8px;padding:12px;background:#1a1a1a;text-align:center;">
        <div style="font-size:2rem;margin-bottom:4px;">${item.emoji}</div>
        <div style="font-weight:bold;font-size:0.95rem;margin-bottom:4px;">${item.name}</div>
        <div style="font-size:0.85rem;color:#aaa;margin-bottom:8px;min-height:2.4em;">${item.description}</div>
        <div style="font-size:1.1rem;color:#ffd700;margin-bottom:8px;font-weight:bold;">💰 ${item.cost}</div>
        <button class="shop-buy-btn" onclick="window.buyItem('${itemId}')"${disabled}>Buy</button>
      </div>
    `;
  });
  
  shopItemsEl.innerHTML = html;
}

window.buyItem = function(itemId) {
  const items = Pet.getItemDefinitions();
  const item = items[itemId];
  
  if(!item) {
    subtitleEl.textContent = 'Unknown item';
    return;
  }
  
  if(pet.coins < item.cost) {
    subtitleEl.textContent = 'Not enough coins!';
    return;
  }
  
  pet.coins -= item.cost;
  pet.inventory[itemId]++;
  pet.saveState();
  
  subtitleEl.textContent = `Purchased ${item.name}!`;
  updateShopUI();
  updateInventoryUI();
};

if(btnOpenShop && shopModal){ 
  btnOpenShop.addEventListener('click', ()=>{ 
    wasAlreadyFrozen = pet.frozen;
    if(!pet.frozen) pet.freeze();
    updateShopUI();
    modalShow(shopModal); 
  }); 
}
if(btnCloseShop && shopModal){ 
  btnCloseShop.addEventListener('click', ()=>{ 
    modalHide(shopModal);
    if(!wasAlreadyFrozen && pet.frozen) pet.unfreeze();
  }); 
}
if(shopOverlay && shopModal){ 
  shopOverlay.addEventListener('click', ()=>{ 
    modalHide(shopModal);
    if(!wasAlreadyFrozen && pet.frozen) pet.unfreeze();
  }); 
}

// Battle UI lives in the aside `#battle-section` below the canvas (no modal)

function updateBattleUI(){
  if(!pet.inBattle || !battleSectionEl) return;
  
  // ensure visible and accessible
  battleSectionEl.style.display = 'block';
  battleSectionEl.classList.add('show');
  battleSectionEl.setAttribute('aria-hidden','false');
  const enemy = pet.currentEnemy;
  
  const petHpPercent = (pet.health / 100) * 100;
  const enemyHpPercent = (enemy.hp / enemy.maxHp) * 100;
  
  // Single enemy header with all info
  battleInfoEl.innerHTML = `
    <div style="margin-bottom:8px;"><strong style="font-size:1.1rem;">${enemy.name}</strong> <span style="color:#aaa;">(Lvl ${enemy.level} ${enemy.type})</span></div>
  `;
  
  // Clean HP bars without redundant labels
  battleHpsEl.innerHTML = `
    <div class="battle-hp-bar">
      <div style="display:flex;justify-content:space-between;font-size:0.9rem;margin-bottom:2px;"><span>Your Pet</span><span>${Math.round(pet.health)}/100</span></div>
      <div class="battle-hp-fill" style="background:linear-gradient(90deg,#4caf50 ${petHpPercent}%,#333 ${petHpPercent}%)"></div>
    </div>
    <div class="battle-hp-bar" style="margin-top:8px;">
      <div style="display:flex;justify-content:space-between;font-size:0.9rem;margin-bottom:2px;"><span>${enemy.name}</span><span>${Math.round(enemy.hp)}/${enemy.maxHp}</span></div>
      <div class="battle-hp-fill" style="background:linear-gradient(90deg,#ff6b6b ${enemyHpPercent}%,#333 ${enemyHpPercent}%)"></div>
    </div>
  `;
  
  battleLogEl.innerHTML = pet.battleLog.map(log => `<div>${log}</div>`).join('');
  battleLogEl.scrollTop = battleLogEl.scrollHeight;
}

function hideBattleUI(){
  if(battleSectionEl){
    battleSectionEl.classList.remove('show');
    battleSectionEl.setAttribute('aria-hidden','true');
    // allow transition to complete before removing from layout
    setTimeout(()=>{ if(battleSectionEl) battleSectionEl.style.display = 'none'; }, 260);
  }
}


let last = performance.now();
let statAccumulator = 0; // milliseconds
let passiveIncomeAccumulator = 0; // for 5-second passive income ticks
function loop(now){
  const frameElapsed = now - last;
  last = now;

  // accumulate time for stat updates. We'll apply tick() only every 10 seconds
  statAccumulator += frameElapsed;
  if(statAccumulator >= 10000){
    const dtSeconds = statAccumulator / 1000;
    pet.tick(sm.get(), dtSeconds);
    try{ pet.saveState(); }catch(e){}
    statAccumulator = 0;
  }

  // Passive income tick every 5 seconds
  passiveIncomeAccumulator += frameElapsed;
  if(passiveIncomeAccumulator >= 5000){
    pet.tickPassiveIncome();
    passiveIncomeAccumulator = 0;
  }

  // render each frame, pass real time for smooth animation
  clear(ctx, canvas.width, canvas.height);
  const t = now / 1000;
  drawPet(ctx, canvas.width/2, canvas.height/2, 80, pet, sm.get(), t);

  updateStats();
  updateEvoUI();
  updateFreezeUI();
  updateTrainingUI();
  if(pet.inBattle) updateBattleUI();
  requestAnimationFrame(loop);
}

requestAnimationFrame(loop);

// Controls
document.getElementById('btn-play').addEventListener('click', ()=>{
  // block actions if pet is dead
  if(pet.form === 'dead'){
    showSubtitle('Pet has died');
    return;
  }
  // if happiness is already full, shake head 'no'
    // block during battle
    if(pet.inBattle){
      showSubtitle('Pet is in battle!');
      return;
    }
    if(pet.happiness >= 100){
    pet.triggerShake('no-play', 800);
    pet.happiness = Math.max(0, pet.happiness - 2); // failure penalty
    updateStats();
    try{ pet.saveState(); }catch(e){}
    return;
  }
  // if energy too low, shake head 'no'
  if(pet.energy <= 10){
    pet.triggerShake('no-play', 800);
    pet.happiness = Math.max(0, pet.happiness - 2); // failure penalty
    updateStats();
    try{ pet.saveState(); }catch(e){}
    return;
  }
  // Track action for neglect and repeated action mechanics
  pet.recordAction('playing');
  
  // Repeated action frustration: if same action 4+ times, pet gets frustrated
  if(pet.lastActionCount >= 4){
    pet.happiness = Math.max(0, pet.happiness - 5);
    showSubtitle('Pet is bored of playing!', 1000);
    pet.action('Pet got bored (repeated playing)');
  }
  
  // Immediate positive effect: boost happiness, cost energy
  pet.happiness = Math.min(100, pet.happiness + 12);
  pet.energy = Math.max(0, pet.energy - 15);
  pet.action('Played with pet (+12 happiness, -15 energy)');
  // show playful animation/state for a short time
  sm.set('playing');
  // revert to idle after 6s
  setTimeout(()=>{ if(sm.get() === 'playing') sm.set('idle'); }, 6000);
  updateStats();
  try{ pet.saveState(); }catch(e){}
});
document.getElementById('btn-feed').addEventListener('click', ()=>{
  if(pet.form === 'dead'){
    showSubtitle('Pet has died');
    return;
  }
  // if already full (hunger == 0), shake head
    // block during battle
    if(pet.inBattle){
      showSubtitle('Pet is in battle!');
      return;
    }
    if(pet.hunger <= 0){
    pet.triggerShake('no-feed', 800);
    pet.happiness = Math.max(0, pet.happiness - 2); // failure penalty
    updateStats();
    try{ pet.saveState(); }catch(e){}
    return;
  }
  // Track action for neglect and repeated action mechanics
  pet.recordAction('feeding');
  
  // Repeated action frustration
  if(pet.lastActionCount >= 4){
    pet.happiness = Math.max(0, pet.happiness - 5);
    showSubtitle('Pet is tired of eating!', 1000);
    pet.action('Pet got bored (repeated feeding)');
  }
  
  // Immediate positive effect: reduce hunger, improve happiness, and restore a bit of energy
  pet.hunger = Math.max(0, pet.hunger - 20);
  pet.happiness = Math.min(100, pet.happiness + 6);
  pet.energy = Math.min(100, pet.energy + 8);
  pet.action('Fed pet (-20 hunger, +6 happiness, +8 energy)');
  sm.set('feeding');
  setTimeout(()=>{ if(sm.get() === 'feeding') sm.set('idle'); }, 3000);
  updateStats();
  try{ pet.saveState(); }catch(e){}
});
document.getElementById('btn-sleep').addEventListener('click', ()=>{
  if(pet.form === 'dead'){
    showSubtitle('Pet has died');
    return;
  }
  // if energy is already full, shake head
    // block during battle
    if(pet.inBattle){
      showSubtitle('Pet is in battle!');
      return;
    }
    if(pet.energy >= 100){
    pet.triggerShake('no-sleep', 800);
    pet.happiness = Math.max(0, pet.happiness - 2); // failure penalty
    updateStats();
    try{ pet.saveState(); }catch(e){}
    return;
  }
  // Track action for neglect and repeated action mechanics
  pet.recordAction('sleeping');
  
  // Repeated action frustration
  if(pet.lastActionCount >= 4){
    pet.happiness = Math.max(0, pet.happiness - 5);
    showSubtitle('Pet is not tired!', 1000);
    pet.action('Pet got frustrated (repeated sleeping)');
  }
  
  // Guardrail: sleeping too often costs happiness (soft penalty)
  if(pet.lastActionCount >= 2){
    pet.happiness = Math.max(0, pet.happiness - 3);
    pet.action('Pet got annoyed by constant napping (-3 happiness)');
  }
  
  // Immediate positive effect: restore some energy right away
  pet.energy = Math.min(100, pet.energy + 20);
  pet.action('Pet slept (+20 energy)');
  sm.set('sleeping');
  setTimeout(()=>{ if(sm.get() === 'sleeping') sm.set('idle'); }, 8000);
  updateStats();
  try{ pet.saveState(); }catch(e){}
});
document.getElementById('btn-heal').addEventListener('click', ()=>{
  if(pet.form === 'dead'){
    showSubtitle('Pet has died');
    return;
  }
  // if already full health, shake head
  if(pet.health >= 100){
    pet.triggerShake('no-heal', 800);
    pet.happiness = Math.max(0, pet.happiness - 2); // failure penalty
    updateStats();
    try{ pet.saveState(); }catch(e){}
    return;
  }
  // Track action for neglect and repeated action mechanics
  pet.recordAction('healing');
  
  // Repeated action frustration
  if(pet.lastActionCount >= 4){
    pet.happiness = Math.max(0, pet.happiness - 5);
    showSubtitle('Pet is feeling fine!', 1000);
    pet.action('Pet got frustrated (repeated healing)');
  }
  
  sm.set('idle');
  pet.health = Math.min(100, pet.health + 25);
  pet.action('Healed a bit (+25 health)');
  updateStats();
  try{ pet.saveState(); }catch(e){}
});

document.getElementById('btn-reset').addEventListener('click', ()=>{
  const confirm = window.confirm('Reset pet to the beginning? This cannot be undone.');
  if(!confirm) return;
  pet.reset();
  sm.set('idle');
  updateStats();
  updateEvoUI();
  updateFreezeUI();
  hideBattleUI();
});

document.getElementById('btn-freeze').addEventListener('click', ()=>{
  const freezeBtn = document.getElementById('btn-freeze');
  if(pet.form === 'dead'){
    showSubtitle('Pet has died');
    return;
  }
  if(pet.inBattle){
    showSubtitle('Cannot freeze during battle!');
    return;
  }
  if(pet.frozen){
    // unfreeze
    pet.unfreeze();
    freezeBtn.textContent = 'Freeze';
    freezeBtn.classList.remove('frozen');
  } else {
    // freeze
    pet.freeze();
    freezeBtn.textContent = 'Unfreeze';
    freezeBtn.classList.add('frozen');
  }
  updateStats();
});

// Training buttons
document.getElementById('btn-train-strength').addEventListener('click', ()=>{
    if(pet.form === 'dead'){
      showSubtitle('Pet has died');
      return;
    }
    if(pet.inBattle){
      showSubtitle('Pet is in battle!');
      return;
    }
    // Guardrail: training requires energy (costs 15 energy per training action)
    if(pet.energy < 15){
      pet.triggerShake('no-train', 800);
      pet.happiness = Math.max(0, pet.happiness - 2);
      updateStats();
      try{ pet.saveState(); }catch(e){}
      return;
    }
    // Guardrail: cooldown between rapid training
    const now = Date.now();
    if(now - lastTrainTime < trainCooldown){
      showSubtitle('Pet needs a breather!', 800);
      return;
    }
    lastTrainTime = now;
    
    // Apply energy cost before training
    pet.energy = Math.max(0, pet.energy - 15);
    if(pet.trainAbility('strength')){
      pet.action('Trained strength (-15 energy)');
      updateStats();
      try{ pet.saveState(); }catch(e){}
    }
});
document.getElementById('btn-train-speed').addEventListener('click', ()=>{
    if(pet.form === 'dead'){
      showSubtitle('Pet has died');
      return;
    }
    if(pet.inBattle){
      showSubtitle('Pet is in battle!');
      return;
    }
    // Guardrail: training requires energy
    if(pet.energy < 15){
      pet.triggerShake('no-train', 800);
      pet.happiness = Math.max(0, pet.happiness - 2);
      updateStats();
      try{ pet.saveState(); }catch(e){}
      return;
    }
    // Guardrail: cooldown between rapid training
    const now = Date.now();
    if(now - lastTrainTime < trainCooldown){
      showSubtitle('Pet needs a breather!', 800);
      return;
    }
    lastTrainTime = now;
    
    pet.energy = Math.max(0, pet.energy - 15);
    if(pet.trainAbility('speed')){
      pet.action('Trained speed (-15 energy)');
      updateStats();
      try{ pet.saveState(); }catch(e){}
    }
});
document.getElementById('btn-train-defense').addEventListener('click', ()=>{
    if(pet.form === 'dead'){
      showSubtitle('Pet has died');
      return;
    }
    if(pet.inBattle){
      showSubtitle('Pet is in battle!');
      return;
    }
    // Guardrail: training requires energy
    if(pet.energy < 15){
      pet.triggerShake('no-train', 800);
      pet.happiness = Math.max(0, pet.happiness - 2);
      updateStats();
      try{ pet.saveState(); }catch(e){}
      return;
    }
    // Guardrail: cooldown between rapid training
    const now = Date.now();
    if(now - lastTrainTime < trainCooldown){
      showSubtitle('Pet needs a breather!', 800);
      return;
    }
    lastTrainTime = now;
    
    pet.energy = Math.max(0, pet.energy - 15);
    if(pet.trainAbility('defense')){
      pet.action('Trained defense (-15 energy)');
      updateStats();
      try{ pet.saveState(); }catch(e){}
    }
});
document.getElementById('btn-train-intelligence').addEventListener('click', ()=>{
    if(pet.form === 'dead'){
      showSubtitle('Pet has died');
      return;
    }
    if(pet.inBattle){
      showSubtitle('Pet is in battle!');
      return;
    }
    // Guardrail: training requires energy
    if(pet.energy < 15){
      pet.triggerShake('no-train', 800);
      pet.happiness = Math.max(0, pet.happiness - 2);
      updateStats();
      try{ pet.saveState(); }catch(e){}
      return;
    }
    // Guardrail: cooldown between rapid training
    const now = Date.now();
    if(now - lastTrainTime < trainCooldown){
      showSubtitle('Pet needs a breather!', 800);
      return;
    }
    lastTrainTime = now;
    
    pet.energy = Math.max(0, pet.energy - 15);
    if(pet.trainAbility('intelligence')){
      pet.action('Trained intelligence (-15 energy)');
      updateStats();
      try{ pet.saveState(); }catch(e){}
    }
});

// Battle buttons
document.getElementById('btn-attack').addEventListener('click', ()=>{
  if(pet.form === 'dead'){
    showSubtitle('Pet has died');
    return;
  }
  pet.attack();
  updateBattleUI();
  updateStats();
  if(!pet.inBattle) hideBattleUI();
  try{ pet.saveState(); }catch(e){}
});
document.getElementById('btn-defend').addEventListener('click', ()=>{
  if(pet.form === 'dead'){
    showSubtitle('Pet has died');
    return;
  }
  pet.defend();
  updateBattleUI();
  updateStats();
  if(!pet.inBattle) hideBattleUI();
  try{ pet.saveState(); }catch(e){}
});
document.getElementById('btn-flee').addEventListener('click', ()=>{
  if(pet.form === 'dead'){
    showSubtitle('Pet has died');
    return;
  }
  pet.flee();
  updateBattleUI();
  updateStats();
  if(!pet.inBattle) hideBattleUI();
  try{ pet.saveState(); }catch(e){}
});

// Start battle button (user-triggered)
const startBattleBtn = document.getElementById('btn-start-battle');
if(startBattleBtn){
  startBattleBtn.addEventListener('click', ()=>{
    if(pet.form === 'dead'){ showSubtitle('Pet has died'); return; }
    if(pet.inBattle){ showSubtitle('Already in battle!'); return; }
    if(pet.startBattle()){
      // spawn an appearance animation
      spawnBattleAnimation('enemy-appear', { xOff: 0, yOff: 0, dir: 1, hue: 20 });
      updateBattleUI();
      try{ pet.saveState(); }catch(e){}
    } else {
      showSubtitle('Cannot start battle now');
    }
  });
}

// Listen for battle events
window.addEventListener('pet:battlestart', (e) => {
  // reveal battle panel (accessible) and focus the first action
  if(battleSectionEl){
    battleSectionEl.classList.add('show');
    battleSectionEl.style.display = 'block';
    battleSectionEl.setAttribute('aria-hidden','false');
  }
  showSubtitle(`${e.detail.enemy.name} appeared!`, 1500);
  updateBattleUI();
  try{ const atk = document.getElementById('btn-attack'); if(atk) atk.focus(); }catch(e){}
});

// Play small animations when battle actions happen
window.addEventListener('pet:battleaction', (e) => {
  const d = e.detail || {};
  if(d.type === 'attack'){
    spawnBattleAnimation('slash', { xOff: 0, yOff: 0, dir: 1, hue: 30 });
    if(!d.hit) spawnBattleAnimation('hit', { xOff: 80, yOff: 0, dir: 1, hue: 0 });
    else spawnBattleAnimation('hit', { xOff: 80, yOff: 0, dir: 1, hue: 120 });
  } else if(d.type === 'defend'){
    spawnBattleAnimation('hit', { xOff: 80, yOff: 0, dir: 1, hue: 40 });
  } else if(d.type === 'flee' || d.type === 'flee-failed'){
    spawnBattleAnimation('slash', { xOff: 0, yOff: 0, dir: 1, hue: 10 });
  }
  updateBattleUI();
  updateStats();
});

window.addEventListener('pet:battleend', (e) => {
  const won = e.detail && e.detail.won;
  try{
    const hpFills = battleSectionEl ? Array.from(battleSectionEl.querySelectorAll('.battle-hp-fill')) : [];
    if(won === true){
      if(battleSectionEl) battleSectionEl.classList.add('victory');
      showSubtitle('Victory!', 1500);
      announceSR('Victory! You won the battle.', 3500);
      playVictorySound();
      try{ spawnConfetti(canvas.width/2, canvas.height/2, 140, 80); }catch(e){} // increased from 64 to 80
      hpFills.forEach(h=>h.classList.add('hp-flash-victory'));
      try{ if(battleBadgeEl){ battleBadgeEl.textContent = 'VICTORY'; battleBadgeEl.classList.add('show','victory'); } }catch(e){}
      // show victory banner with longer duration
      try{ if(victoryBannerEl){ victoryBannerEl.textContent = '🎉 VICTORY! 🎉'; victoryBannerEl.classList.add('show'); } }catch(e){}
    } else if(won === false){
      if(battleSectionEl) battleSectionEl.classList.add('defeat');
      showSubtitle('Defeat...', 1500);
      announceSR('Defeat. You lost the battle.', 3500);
      playDefeatSound();
      hpFills.forEach(h=>h.classList.add('hp-flash-defeat'));
      try{ if(battleBadgeEl){ battleBadgeEl.textContent = 'DEFEAT'; battleBadgeEl.classList.add('show','defeat'); } }catch(e){}
      // show defeat banner
      try{ if(defeatBannerEl){ defeatBannerEl.textContent = '💔 DEFEAT 💔'; defeatBannerEl.classList.add('show'); } }catch(e){}
    } else {
      showSubtitle('Escaped!', 1200);
      announceSR('You escaped the battle.', 2500);
    }
  }catch(e){}

  setTimeout(() => {
    try{ hideBattleUI(); }catch(e){}
    try{ const hpFills = battleSectionEl ? Array.from(battleSectionEl.querySelectorAll('.battle-hp-fill')) : []; hpFills.forEach(h=>{ h.classList.remove('hp-flash-victory','hp-flash-defeat'); }); }catch(e){}
    try{ if(battleBadgeEl) battleBadgeEl.classList.remove('show','victory','defeat'); }catch(e){}
    try{ if(battleSectionEl) battleSectionEl.classList.remove('victory','defeat'); }catch(e){}
    try{ if(victoryBannerEl) victoryBannerEl.classList.remove('show'); }catch(e){}
    try{ if(defeatBannerEl) defeatBannerEl.classList.remove('show'); }catch(e){}
  }, 3200); // increased from 2600 to 3200 to let banner display longer
});

// When pet dies, show message, play death animation, and restrict UI
window.addEventListener('pet:died', (e) => {
  // make the death message assertive for screen readers
  try{ if(subtitleEl) subtitleEl.setAttribute('aria-live','assertive'); }catch(e){}
  showSubtitle('Your pet has died', 4000);
  try{ spawnBattleAnimation('death', { xOff:0, yOff:0, hue:0 }); }catch(e){}
  // hide battle UI and ensure no interactive UI remains besides reset
  hideBattleUI();
  updateStats();
  // restore subtitle politeness after message finishes
  setTimeout(()=>{ try{ if(subtitleEl) subtitleEl.setAttribute('aria-live','polite'); }catch(e){} }, 4200);
});

// When pet is revived (Reset from dead), play a short revive animation and message
window.addEventListener('pet:revived', (e) => {
  showSubtitle('Pet has been revived', 2000);
  try{ spawnBattleAnimation('enemy-appear', { xOff:0, yOff:0, hue:160 }); }catch(e){}
  // ensure UI state refresh (re-enable buttons)
  updateStats();
  updateEvoUI();
});

window.addEventListener('pet:levelup', (e) => {
  showSubtitle(`${e.detail.ability} reached level ${e.detail.level}!`, 1500);
});

function updateFreezeUI(){
  const freezeBtn = document.getElementById('btn-freeze');
  if(!freezeBtn) return;
  if(pet.frozen){
    freezeBtn.textContent = 'Unfreeze';
    freezeBtn.classList.add('frozen');
  } else {
    freezeBtn.textContent = 'Freeze';
    freezeBtn.classList.remove('frozen');
  }
}

// simple auto-state: if health low, become sick
setInterval(()=>{
  if(!pet.frozen && pet.health < 40) sm.set('sick');
}, 2000);

window.addEventListener('resize', resize);

// --- DEBUG MODE ---
let debugMode = false;
const btnToggleDebug = document.getElementById('btn-toggle-debug');
const debugPanel = document.getElementById('debug-panel');
if(btnToggleDebug && debugPanel){
  btnToggleDebug.addEventListener('click', ()=>{
    debugMode = !debugMode;
    debugPanel.style.display = debugMode ? 'block' : 'none';
    btnToggleDebug.textContent = debugMode ? 'Hide DEBUG MODE' : 'Toggle DEBUG MODE';
  });
}

const evolutionPath = ['circle', 'triangle', 'square', 'circle-plus'];
const btnDebugDevolve = document.getElementById('btn-debug-devolve');
if(btnDebugDevolve){
  btnDebugDevolve.addEventListener('click', ()=>{
    if(pet.form === 'dead'){ showSubtitle('Cannot devolve dead pet'); return; }
    const idx = evolutionPath.indexOf(pet.form);
    if(idx > 0){
      const targetForm = evolutionPath[idx - 1];
      pet.startEvolution(targetForm, 1500);
      updateStats();
      updateEvoUI();
    } else {
      showSubtitle('Already at base form');
    }
  });
}

const btnDebugEvolve = document.getElementById('btn-debug-evolve');
if(btnDebugEvolve){
  btnDebugEvolve.addEventListener('click', ()=>{
    if(pet.form === 'dead'){ showSubtitle('Cannot evolve dead pet'); return; }
    const idx = evolutionPath.indexOf(pet.form);
    if(idx >= 0 && idx < evolutionPath.length - 1){
      const targetForm = evolutionPath[idx + 1];
      pet.startEvolution(targetForm, 1500);
      updateStats();
      updateEvoUI();
    } else {
      showSubtitle('Already at max evolution');
    }
  });
}

const btnDebugTrainingDown = document.getElementById('btn-debug-training-down');
if(btnDebugTrainingDown){
  btnDebugTrainingDown.addEventListener('click', ()=>{
    Object.keys(pet.training).forEach(key => {
      if(pet.training[key].level > 0){
        pet.training[key].level--;
        pet.training[key].xp = 0;
      }
    });
    pet.action('DEBUG: Training levels -1');
    updateTrainingUI();
    updateStats();
    try{ pet.saveState(); }catch(e){}
  });
}

const btnDebugTrainingUp = document.getElementById('btn-debug-training-up');
if(btnDebugTrainingUp){
  btnDebugTrainingUp.addEventListener('click', ()=>{
    Object.keys(pet.training).forEach(key => {
      if(pet.training[key].level < 10){
        pet.training[key].level++;
        pet.training[key].xp = 0;
      }
    });
    pet.action('DEBUG: Training levels +1');
    updateTrainingUI();
    updateStats();
    try{ pet.saveState(); }catch(e){}
  });
}

