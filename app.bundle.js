// Single-file bundle for file:// usage (no modules needed)
(() => {
  // --- stateMachine.js ---
class StateMachine {
  constructor(initial = 'idle'){
    this.state = initial;
    this.listeners = new Set();
  }

  onChange(fn){
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  set(state){
    if(this.state === state) return;
    const prev = this.state;
    this.state = state;
    for(const l of this.listeners) l(this.state, prev);
  }

  get(){ return this.state }
}

  // --- pet.js ---
class Pet {
  constructor(){
    this.hunger = 50; // 0..100 (100 = very hungry)
    this.happiness = 70; // 0..100
    this.energy = 80; // 0..100
    this.health = 100; // 0..100
    this.age = 0; // seconds
    this.lastTick = Date.now();
    this.log = [];
    this.shakeUntil = 0; // ms timestamp until which pet is shaking head
    this.shakeType = '';
    this.form = 'circle'; // circle -> triangle -> square -> dead
    // evolution timers (seconds of continuous wellness at threshold)
    // cumulative timers (seconds) used for evolution — these accumulate across ticks
    this._wellness70Timer = 0;
    this._wellness60Timer = 0;
    this._wellness75Timer = 0;
    this._wellness75Timer = 0; // used for the post-square loop-back evolution
    this.evolving = false;
    this.evolveFrom = null;
    this.evolveTo = null;
    this.evolveStart = 0;
    this.evolveDuration = 0;
    // happiness drain tracking
    this.lastActionTime = Date.now(); // track neglect
    this.lastActionState = 'idle'; // track repeated actions
    this.lastActionCount = 0; // how many times action repeated
    this.evolutionStartTime = 0; // track evolution stress period
    // freeze state
    this.frozen = false; // if true, pet is frozen and no stats change
    this.freezeTime = 0; // timestamp when pet was frozen
    // training stats (levels start at 0 for new users; 0..10 levels)
    this.training = {
      strength: { level: 0, xp: 0 }, // affects attack power
      speed: { level: 0, xp: 0 },    // affects hit chance, evasion
      defense: { level: 0, xp: 0 },  // reduces damage taken
      intelligence: { level: 0, xp: 0 } // affects special moves
    };
    // coins and inventory system
    this.coins = 0;
    this.inventory = {
      treat: 0,
      energyDrink: 0,
      medicine: 0,
      rareCandy: 0,
      happinessPotion: 0,
      trainingPowder: 0,
      battleStimulant: 0,
      focusTea: 0,
      evolutionAccelerator: 0,
      statBoostKit: 0,
      passiveIncome: 0,
      petSkin: 0,
      nameChange: 0,
      battleEffectPack: 0,
      xpBoostOrb: 0,
      coinMultiplier: 0,
      quickRevive: 0
    };
    // active item effects
    this.passiveIncomeActive = false;
    this.trainingPowderActive = false;
    this.trainingPowderExpiry = 0;
    this.xpBoostActive = false;
    this.xpBoostExpiry = 0;
    this.coinMultiplierActive = false;
    this.statBoostKitPurchased = false;
    // battle state
    this.inBattle = false;
    this.currentEnemy = null;
    this.battleLog = [];
    this.lastBattleTime = 0;
    this.nextBattleTime = Date.now() + this.randomBattleDelay(); // random time until next possible encounter
    // try to load persisted state
    this.loadState();
  }

  saveState(){
    try{
      const data = {
        hunger: this.hunger,
        happiness: this.happiness,
        energy: this.energy,
        health: this.health,
        age: this.age,
        form: this.form,
        _wellness70Timer: this._wellness70Timer,
        _wellness60Timer: this._wellness60Timer,
        _wellness75Timer: this._wellness75Timer,
        frozen: this.frozen,
        freezeTime: this.freezeTime,
        training: this.training,
        coins: this.coins,
        inventory: this.inventory,
        passiveIncomeActive: this.passiveIncomeActive,
        trainingPowderActive: this.trainingPowderActive,
        trainingPowderExpiry: this.trainingPowderExpiry,
        xpBoostActive: this.xpBoostActive,
        xpBoostExpiry: this.xpBoostExpiry,
        coinMultiplierActive: this.coinMultiplierActive,
        statBoostKitPurchased: this.statBoostKitPurchased
      };
      localStorage.setItem('vpet2.pet', JSON.stringify(data));
    }catch(e){ /* ignore */ }
  }

  loadState(){
    try{
      const raw = localStorage.getItem('vpet2.pet');
      if(!raw) return;
      const data = JSON.parse(raw);
      if(typeof data.hunger === 'number') this.hunger = data.hunger;
      if(typeof data.happiness === 'number') this.happiness = data.happiness;
      if(typeof data.energy === 'number') this.energy = data.energy;
      if(typeof data.health === 'number') this.health = data.health;
      if(typeof data.age === 'number') this.age = data.age;
      if(typeof data.form === 'string') this.form = data.form;
      if(typeof data._wellness70Timer === 'number') this._wellness70Timer = data._wellness70Timer;
      if(typeof data._wellness60Timer === 'number') this._wellness60Timer = data._wellness60Timer;
      if(typeof data._wellness75Timer === 'number') this._wellness75Timer = data._wellness75Timer;
      if(typeof data.frozen === 'boolean') this.frozen = data.frozen;
      if(typeof data.freezeTime === 'number') this.freezeTime = data.freezeTime;
      if(data.training && typeof data.training === 'object') this.training = data.training;
      if(typeof data.coins === 'number') this.coins = data.coins;
      if(data.inventory && typeof data.inventory === 'object') this.inventory = data.inventory;
      if(typeof data.passiveIncomeActive === 'boolean') this.passiveIncomeActive = data.passiveIncomeActive;
      if(typeof data.trainingPowderActive === 'boolean') this.trainingPowderActive = data.trainingPowderActive;
      if(typeof data.trainingPowderExpiry === 'number') this.trainingPowderExpiry = data.trainingPowderExpiry;
      if(typeof data.xpBoostActive === 'boolean') this.xpBoostActive = data.xpBoostActive;
      if(typeof data.xpBoostExpiry === 'number') this.xpBoostExpiry = data.xpBoostExpiry;
      if(typeof data.coinMultiplierActive === 'boolean') this.coinMultiplierActive = data.coinMultiplierActive;
      if(typeof data.statBoostKitPurchased === 'boolean') this.statBoostKitPurchased = data.statBoostKitPurchased;
    }catch(e){ /* ignore parse errors */ }
  }

  tick(state, dt){
    // dt in seconds

    // if frozen, skip all changes including age
    if(this.frozen) return;

    this.age += dt;

    // if already dead, nothing changes
    if(this.form === 'dead') return;

    // if evolving, check completion
    if(this.evolving){
      const now = Date.now();
      const elapsed = (now - this.evolveStart) / 1000;
      if(elapsed >= this.evolveDuration){
        this.form = this.evolveTo;
        this.evolving = false;
        this.evolveFrom = null;
        this.evolveTo = null;
        this.evolveStart = 0;
        this.evolveDuration = 0;
        this.action(`Evolved into ${this.form}`);
        try{ this.saveState(); }catch(e){}
      }
      // continue ticking stats while evolving
    }

    // base changes (per second) — slowed further
    this.hunger += 0.05 * dt; // gets hungrier very slowly
    this.energy -= 0.03 * dt;

    // state modifiers (per second)
    if(state === 'playing'){
      this.happiness += 0.5 * dt;
      this.energy -= 0.06 * dt;
      this.hunger += 0.02 * dt;
    } else if(state === 'feeding'){
      this.hunger -= 0.3 * dt;
      this.happiness += 0.15 * dt;
    } else if(state === 'sleeping'){
      this.energy += 0.25 * dt;
      this.hunger += 0.02 * dt;
    } else if(state === 'sick'){
      this.health -= 0.2 * dt;
      this.happiness -= 0.1 * dt;
    }

    // === Happiness Drain Mechanics ===
    // 1. Hunger penalty: happiness declines when very hungry
    if(this.hunger > 85){
      const hungerIntensity = (this.hunger - 85) / 15; // 0..1
      this.happiness -= 0.08 * hungerIntensity * dt;
    }

    // 2. Loneliness/neglect: happiness drifts down if no interaction for 60+ seconds
    const timeSinceAction = (Date.now() - this.lastActionTime) / 1000; // seconds
    if(timeSinceAction > 60){
      const neglectIntensity = Math.min(1, (timeSinceAction - 60) / 120); // ramps from 0 to 1 over 2 minutes
      this.happiness -= 0.04 * neglectIntensity * dt;
    }

    // 3. Low energy: happiness declines when very tired
    if(this.energy < 15){
      const tiredIntensity = (15 - this.energy) / 15; // 0..1
      this.happiness -= 0.06 * tiredIntensity * dt;
    }

    // 4. Boredom: happiness slowly declines in idle state
    if(state === 'idle'){
      this.happiness -= 0.02 * dt;
    }

    // 5. Failed actions: handled in main.js when refusal triggers
    // (we'll track this via lastActionState in the action() method)

    // 6. Repeated same action: diminishing returns cause frustration
    // This is tracked when the player keeps using same action repeatedly
    // (implementation via action counter in main.js)

    // 7. Age-based decline: as pet gets older, baseline happiness slowly declines
    const ageDecay = Math.min(0.015, this.age / 3000); // very slow, maxes at 0.015
    this.happiness -= ageDecay * dt;

    // 8. Evolution/transformation stress: during evolution, happiness slightly drops
    if(this.evolving){
      const stressDrain = 0.05 * dt;
      this.happiness -= stressDrain;
    }

    // 9. Death anticipation: as wellness approaches critical, happiness accelerates downward
    const hungerGoodTemp = 100 - this.hunger;
    const wellnessTemp = (hungerGoodTemp * 0.5) + (this.energy * 0.3) + (this.health * 0.2);
    if(wellnessTemp < 30){
      const deathAnxiety = (30 - wellnessTemp) / 30; // 0..1 as wellness approaches 0
      this.happiness -= 0.15 * deathAnxiety * dt;
    }

    // 10. (Bonus) Positive feedback: small natural recovery if well cared for
    if(this.health > 50 && this.hunger < 40 && this.energy > 40) this.happiness += 0.2 * dt;

    // clamp all values to 0..100
    this.hunger = Math.min(100, Math.max(0, this.hunger));
    this.happiness = Math.min(100, Math.max(0, this.happiness));
    this.energy = Math.min(100, Math.max(0, this.energy));
    this.health = Math.min(100, Math.max(0, this.health));

    // if very hungry or exhausted, affect health very slowly
    if(this.hunger > 90 || this.energy < 10) this.health -= 0.04 * dt;
    this.health = Math.min(100, Math.max(0, this.health));

    // compute wellness for evolution/death checks
    const hungerGood = 100 - this.hunger;
    const wellness = (hungerGood * 0.5) + (this.energy * 0.3) + (this.health * 0.2);

    // death if wellness reaches 0
    if(wellness <= 0){
      this.form = 'dead';
      this.action('Pet has died');
      try{ this.saveState(); }catch(e){}
      return;
    }

    // evolution: circle -> triangle if wellness >= 70 for 2 minutes (120s)
    if(this.form === 'circle' && !this.evolving){
      if(wellness >= 70){
        this._wellness70Timer += dt;
        if(this._wellness70Timer >= 120){
          this._wellness70Timer = 0;
          this.startEvolution('triangle', 4000);
        }
      } else {
        this._wellness70Timer = 0;
      }
    }

    // evolution: triangle -> square if wellness >= 60 for 5 minutes (300s)
    if(this.form === 'triangle' && !this.evolving){
      if(wellness >= 60){
        this._wellness60Timer += dt;
        if(this._wellness60Timer >= 300){
          this._wellness60Timer = 0;
          this.startEvolution('square', 6000);
        }
      } else {
        this._wellness60Timer = 0;
      }
    }

    // evolution: square -> circle-plus (larger, dotted) if wellness stays high (>=70) for 4 minutes (240s)
    if(this.form === 'square' && !this.evolving){
      if(wellness >= 70){
        this._wellness75Timer += dt;
        if(this._wellness75Timer >= 240){
          this._wellness75Timer = 0;
          this.startEvolution('circle-plus', 7000);
        }
      } else {
        this._wellness75Timer = 0;
      }
    }

    // Random battle encounters: schedule next encounter using random delay
    if(!this.inBattle && state !== 'sick' && state !== 'dead'){
      const now = Date.now();
      if(!this.nextBattleTime) this.nextBattleTime = now + this.randomBattleDelay();
      if(now >= this.nextBattleTime){
        // 40% chance to spawn an encounter when the timer fires
        if(Math.random() < 0.4){
          this.startBattle();
        }
        // schedule next attempt
        this.nextBattleTime = now + this.randomBattleDelay();
      }
    }
  }

  
  randomBattleDelay(){
    // Return a random delay in milliseconds between 2-5 minutes
    const minMinutes = 2;
    const maxMinutes = 5;
    const randomMinutes = minMinutes + Math.random() * (maxMinutes - minMinutes);
    return randomMinutes * 60 * 1000;
  }

  startEvolution(toForm, durationMs = 2000){
    if(this.evolving || this.form === 'dead' || this.form === toForm) return;
    this.evolving = true;
    this.evolveFrom = this.form;
    this.evolveTo = toForm;
    this.evolveStart = Date.now();
    this.evolveDuration = durationMs / 1000; // store seconds
    try{
      const ev = new CustomEvent('pet:evolve', { detail: { from: this.evolveFrom, to: this.evolveTo, durationMs } });
      window.dispatchEvent(ev);
    }catch(e){}
    try{ this.saveState(); }catch(e){}
  }

  action(actionName){
    const now = new Date().toLocaleTimeString();
    this.log.unshift(`[${now}] ${actionName}`);
    if(this.log.length>10) this.log.length = 10;
  }

  recordAction(actionState){
    // Track player interactions to measure neglect and repeated actions
    this.lastActionTime = Date.now();
    
    // Track repeated actions for diminishing returns
    if(actionState === this.lastActionState){
      this.lastActionCount++;
    } else {
      this.lastActionCount = 1;
      this.lastActionState = actionState;
    }
    
    // If player repeats same action 4+ times, they get frustrated (handled in main.js)
  }

  triggerShake(type = 'no', durationMs = 800){
    this.shakeType = type;
    this.shakeUntil = Date.now() + durationMs;
    this.action(`Refused: ${type}`);
    try{
      // dispatch a global event so UI/audio can react
      const ev = new CustomEvent('pet:shake', { detail: { type, durationMs } });
      window.dispatchEvent(ev);
    }catch(e){ /* ignore in non-browser environments */ }
  }

  isShaking(){
    return Date.now() < this.shakeUntil;
  }

  reset(){
    // Reset pet to initial state with devolution animation
    this.hunger = 50;
    this.happiness = 70;
    this.energy = 80;
    this.health = 100;
    this.age = 0;
    this._wellness70Timer = 0;
    this._wellness60Timer = 0;
    // Reset training levels and XP to zero (user requested)
    this.training = {
      strength: { level: 0, xp: 0 },
      speed: { level: 0, xp: 0 },
      defense: { level: 0, xp: 0 },
      intelligence: { level: 0, xp: 0 }
    };
    this.coins = 0;
    
    // Reset inventory - clear all items
    this.inventory = {
      treat: 0,
      energyDrink: 0,
      medicine: 0,
      rareCandy: 0,
      happinessPotion: 0,
      trainingPowder: 0,
      battleStimulant: 0,
      focusTea: 0,
      evolutionAccelerator: 0,
      statBoostKit: 0,
      passiveIncome: 0,
      petSkin: 0,
      nameChange: 0,
      battleEffectPack: 0,
      xpBoostOrb: 0,
      coinMultiplier: 0,
      quickRevive: 0
    };
    
    // Reset active item effects
    this.passiveIncomeActive = false;
    this.trainingPowderActive = false;
    this.trainingPowderExpiry = 0;
    this.xpBoostActive = false;
    this.xpBoostExpiry = 0;
    this.coinMultiplierActive = false;
    this.statBoostKitPurchased = false;
    
    // End battle if in progress (without victory or defeat)
    const wasInBattle = this.inBattle;
    if(this.inBattle){
      this.inBattle = false;
      this.currentEnemy = null;
      this.battleLog = [];
      try{
        const ev = new CustomEvent('pet:battleend', { detail: { won: null, log: [] } });
        window.dispatchEvent(ev);
      }catch(e){}
    }
    
    // Clean up evolution state
    this.evolving = false;
    this.evolveFrom = null;
    this.evolveTo = null;
    this.evolveStart = 0;
    this.evolveDuration = 0;

    // If dead, revive directly to circle form; otherwise de-evolve to circle visually
    const wasDead = this.form === 'dead';
    if(wasDead){
      this.form = 'circle';
      // dispatch revived event so UI/graphics can animate
      try{ window.dispatchEvent(new CustomEvent('pet:revived')); }catch(e){}
      try{ this.saveState(); }catch(e){}
    } else if(this.form !== 'circle'){
      this.startEvolution('circle', 1500);
    } else {
      // already circle, just save
      try{ this.saveState(); }catch(e){}
    }

    this.action('Reset to beginning');
  }

  freeze(){
    // Freeze the pet: stop all stat changes until unfrozen
    if(!this.frozen){
      this.frozen = true;
      this.freezeTime = Date.now();
      this.action('Pet frozen in time');
      this.saveState();
    }
  }

  unfreeze(){
    // Unfreeze the pet: resume normal stat changes
    if(this.frozen){
      this.frozen = false;
      this.freezeTime = 0;
      this.action('Pet unfrozen!');
      this.saveState();
    }
  }

  trainAbility(abilityName){
    // Train a specific ability: costs energy, builds XP
    // Do not allow training while frozen
    if(this.frozen){
      this.triggerShake('frozen', 800);
      return false;
    }
    if(!this.training[abilityName]) return false;
    
    // training costs 15 energy
    if(this.energy < 15){
      this.triggerShake('no-play', 800); // too tired
      return false;
    }
    
    this.energy = Math.max(0, this.energy - 15);
    
    const training = this.training[abilityName];
    training.xp += 20; // 20 XP per training session
    const xpNeeded = 100 + (training.level * 50); // Linear scaling: 100 + (level × 50)
    
    // check for level up
    if(training.xp >= xpNeeded && training.level < 10){
      training.level++;
      training.xp = 0;
      this.action(`Training ${abilityName} leveled up to ${training.level}!`);
      this.happiness = Math.min(100, this.happiness + 5);
      try{
        const ev = new CustomEvent('pet:levelup', { detail: { ability: abilityName, level: training.level } });
        window.dispatchEvent(ev);
      }catch(e){}
    } else {
      this.action(`Trained ${abilityName} (+20 XP)`);
    }
    
    this.recordAction('training');
    this.saveState();
    return true;
  }

  generateEnemy(){
    // Generate a random enemy based on pet's training level average
    const avgLevel = (this.training.strength.level + this.training.speed.level + 
                     this.training.defense.level + this.training.intelligence.level) / 4;
    
    const difficultyRoll = Math.random();
    let type = 'normal';
    let levelVariance = 0;
    
    if(difficultyRoll < 0.5) type = 'weak';
    else if(difficultyRoll < 0.85) type = 'normal';
    else if(difficultyRoll < 0.98) type = 'strong';
    else type = 'boss';
    
    const difficultyMult = { weak: 0.6, normal: 1.0, strong: 1.4, boss: 2.0 };
    const enemyLevel = Math.max(1, Math.round(avgLevel * difficultyMult[type] + (Math.random() - 0.5) * 2));
    
    this.currentEnemy = {
      type: type,
      level: enemyLevel,
      hp: Math.round(40 + enemyLevel * 8),
      maxHp: Math.round(40 + enemyLevel * 8),
      strength: Math.round(5 + enemyLevel * 2),
      speed: Math.round(5 + enemyLevel * 1.5),
      defense: Math.round(3 + enemyLevel * 1),
      name: ['Slime', 'Goblin', 'Orc', 'Drake', 'Hydra'][Math.floor(Math.random() * 5)]
    };
    
    return this.currentEnemy;
  }

  startBattle(){
    // Initiate battle with generated enemy
    if(this.inBattle || this.form === 'dead' || this.frozen) return false;
    
    this.generateEnemy();
    this.inBattle = true;
    this.battleLog = [];
    this.action(`Battle started with ${this.currentEnemy.name} (Lvl ${this.currentEnemy.level})!`);
    
    try{
      const ev = new CustomEvent('pet:battlestart', { detail: { enemy: this.currentEnemy } });
      window.dispatchEvent(ev);
    }catch(e){}
    
    return true;
  }

  attack(moveType = 'attack'){
    // Execute attack in battle
    if(!this.inBattle || !this.currentEnemy) return { success: false };
    
    // Calculate pet attack power based on stats and training
    const baseDamage = 5 + this.training.strength.level * 3;
    const speedBonus = this.training.speed.level * 0.5;
    const hungerPenalty = this.hunger > 50 ? this.hunger - 50 : 0;
    const energyBonus = this.energy > 50 ? (this.energy - 50) * 0.1 : 0;
    
    let damage = baseDamage + energyBonus - hungerPenalty * 0.2 + (Math.random() - 0.5) * 3;
    damage = Math.max(1, Math.round(damage));
    
    // Hit chance based on speed
    const hitChance = Math.min(0.95, 0.5 + this.training.speed.level * 0.05);
    const isHit = Math.random() < hitChance;
    
    let logMsg = '';
    if(isHit){
      this.currentEnemy.hp = Math.max(0, this.currentEnemy.hp - damage);
      logMsg = `Hit! Dealt ${damage} damage.`;
      this.happiness = Math.min(100, this.happiness + 2);
      this.battleLog.push(logMsg);
    } else {
      logMsg = 'Miss!';
      this.battleLog.push(logMsg);
    }
    
    // Enemy counter-attack (happens whether hit or miss)
    if(this.currentEnemy.hp > 0){
      const enemyDamage = Math.max(0, 
        this.currentEnemy.strength - this.training.defense.level * 0.5 + (Math.random() - 0.5) * 2
      );
      const actualDamage = Math.max(0, Math.round(enemyDamage - this.training.defense.level * 0.3));
      this.health = Math.max(0, this.health - actualDamage);
      this.battleLog.push(`${this.currentEnemy.name} countered for ${actualDamage} damage!`);
    }
    
    // Check battle end
    if(this.currentEnemy.hp <= 0){
      this.endBattle(true);
    } else if(this.health <= 0){
      this.endBattle(false);
    }

    // Dispatch a battle action event for UI/animations
    try{
      const ev = new CustomEvent('pet:battleaction', { detail: { type: 'attack', hit: isHit, damage: isHit ? damage : 0, enemy: this.currentEnemy } });
      window.dispatchEvent(ev);
    }catch(e){}

    return { success: true, hit: isHit, damage: isHit ? damage : 0, log: logMsg };
  }

  defend(){
    // Reduce damage next turn
    if(!this.inBattle || !this.currentEnemy) return { success: false };
    
    this.battleLog.push('Defending!');
    
    // Enemy attacks, but defense reduces damage
    const rawDamage = Math.max(0, 
      this.currentEnemy.strength - this.training.defense.level + (Math.random() - 0.5) * 2
    );
    const defenseBonus = this.training.defense.level * 0.7; // stronger defense multiplier
    const actualDamage = Math.max(0, Math.round(rawDamage - defenseBonus));
    
    this.health = Math.max(0, this.health - actualDamage);
    this.battleLog.push(`${this.currentEnemy.name} attacked! Defense reduced damage to ${actualDamage}.`);
    
    if(this.health <= 0){
      this.endBattle(false);
    }
    
    try{
      const ev = new CustomEvent('pet:battleaction', { detail: { type: 'defend', damage: actualDamage, enemy: this.currentEnemy } });
      window.dispatchEvent(ev);
    }catch(e){}

    return { success: true, damage: actualDamage };
  }

  flee(){
    // Attempt to escape battle
    if(!this.inBattle || !this.currentEnemy) return false;
    
    const fleeChance = 0.6 + this.training.speed.level * 0.03; // speed helps escape
    const escaped = Math.random() < fleeChance;
    
    if(escaped){
      this.energy = Math.max(0, this.energy - 5);
      this.battleLog.push('Escaped!');
      this.action('Fled from battle');
      this.endBattle(null); // null = fled
      try{
        const ev = new CustomEvent('pet:battleaction', { detail: { type: 'flee', escaped: true, enemy: this.currentEnemy } });
        window.dispatchEvent(ev);
      }catch(e){}
    } else {
      this.battleLog.push('Failed to escape!');
      // Enemy gets a free attack
      const enemyDamage = Math.round(this.currentEnemy.strength * 0.8 + (Math.random() - 0.5) * 2);
      this.health = Math.max(0, this.health - enemyDamage);
      this.battleLog.push(`${this.currentEnemy.name} hit for ${enemyDamage} while fleeing!`);
      try{
        const ev = new CustomEvent('pet:battleaction', { detail: { type: 'flee-failed', damage: enemyDamage, enemy: this.currentEnemy } });
        window.dispatchEvent(ev);
      }catch(e){}

      if(this.health <= 0){
        this.endBattle(false);
      }
    }
    
    return escaped;
  }

  endBattle(won){
    // won: true = victory, false = defeat, null = fled
    if(!this.inBattle) return;
    
    if(won === true){
      // Victory rewards
      const xpGain = Math.round(20 + this.currentEnemy.level * 5);
      const xpMultiplier = this.getXpMultiplier();
      const coinDrop = Math.round(10 + this.currentEnemy.level * 8 + Math.random() * 10);
      const coinMultiplier = this.getCoinMultiplier();
      const happinessGain = 8;
      const healthCost = Math.max(5, Math.round(this.currentEnemy.level * 2)); // damage taken
      
      // Distribute XP among trained abilities
      Object.keys(this.training).forEach(ability => {
        this.training[ability].xp += Math.round((xpGain / 4) * xpMultiplier);
        // Auto-level up if XP threshold reached
        const t = this.training[ability];
        const xpNeeded = 100 + (t.level * 50);
        while(t.xp >= xpNeeded && t.level < 10){
          t.level++;
          t.xp -= xpNeeded;
        }
      });
      
      this.happiness = Math.min(100, this.happiness + happinessGain);
      this.health = Math.max(0, this.health - healthCost);
      this.coins += Math.round(coinDrop * coinMultiplier);
      
      this.action(`Defeated ${this.currentEnemy.name}! +${xpGain * xpMultiplier} XP, +${Math.round(coinDrop * coinMultiplier)} coins`);
      this.battleLog.push(`Victory! Gained ${xpGain * xpMultiplier} XP and ${Math.round(coinDrop * coinMultiplier)} coins`);
    } else if(won === false){
      // Defeat penalties
      this.happiness = Math.max(0, this.happiness - 10);
      this.health = Math.max(0, this.health - 5);
      this.action(`Defeated by ${this.currentEnemy.name}...`);
      this.battleLog.push('Defeat! Lost 10 happiness');
    } else {
      // Fled (neutral)
      this.action('Fled from battle');
    }
    
    this.inBattle = false;
    this.lastBattleTime = Date.now();
    this.currentEnemy = null;
    // If health dropped to zero as part of the battle, trigger death
    if(this.health <= 0){
      this.die();
    }
    
    try{
      const ev = new CustomEvent('pet:battleend', { detail: { won, log: this.battleLog } });
      window.dispatchEvent(ev);
    }catch(e){}
    
    this.saveState();
  }

  die(){
    if(this.form === 'dead') return;
    this.form = 'dead';
    this.inBattle = false;
    this.evolving = false;
    this.battleLog = [];
    this.action('Pet has died');
    try{
      const ev = new CustomEvent('pet:died', { detail: {} });
      window.dispatchEvent(ev);
    }catch(e){}
    try{ this.saveState(); }catch(e){}
  }

  // ===== ITEM SYSTEM =====
  static getItemDefinitions() {
    return {
      // Consumables
      treat: { name: 'Treat', emoji: '🍖', cost: 50, type: 'consumable', description: 'Reduces hunger by 20' },
      energyDrink: { name: 'Energy Drink', emoji: '⚡', cost: 80, type: 'consumable', description: 'Restores 30 energy' },
      medicine: { name: 'Medicine', emoji: '💊', cost: 100, type: 'consumable', description: 'Restores 40 health' },
      rareCandy: { name: 'Rare Candy', emoji: '✨', cost: 150, type: 'consumable', description: 'Gains 20 XP in random skill' },
      happinessPotion: { name: 'Happiness Potion', emoji: '💜', cost: 120, type: 'consumable', description: 'Boosts happiness by 25' },
      // Stat Boosters
      trainingPowder: { name: 'Training Powder', emoji: '💪', cost: 200, type: 'booster', duration: 60, description: 'Double XP for 60 seconds' },
      battleStimulant: { name: 'Battle Stimulant', emoji: '🔥', cost: 180, type: 'booster', duration: 45, description: 'Boost battle damage for 45s' },
      focusTea: { name: 'Focus Tea', emoji: '🍵', cost: 160, type: 'booster', duration: 30, description: 'Increase accuracy for 30s' },
      xpBoostOrb: { name: 'XP Boost Orb', emoji: '🌟', cost: 220, type: 'booster', duration: 120, description: 'Triple XP for 120 seconds' },
      // Permanent Upgrades
      statBoostKit: { name: 'Stat Boost Kit', emoji: '📈', cost: 300, type: 'upgrade', description: 'Permanently boost all stats by 10%' },
      evolutionAccelerator: { name: 'Evolution Accelerator', emoji: '🚀', cost: 250, type: 'upgrade', description: 'Reduce evolution time by 30%' },
      passiveIncome: { name: 'Piggy Bank', emoji: '🏦', cost: 500, type: 'upgrade', description: 'Gain 1 coin every 5 seconds' },
      coinMultiplier: { name: 'Coin Multiplier', emoji: '💰', cost: 400, type: 'upgrade', description: 'Double coins from battles' },
      // Cosmetics (non-functional)
      petSkin: { name: 'Custom Skin', emoji: '🎨', cost: 200, type: 'cosmetic', description: 'Customize pet appearance' },
      nameChange: { name: 'Name Change', emoji: '📝', cost: 100, type: 'cosmetic', description: 'Rename your pet' },
      battleEffectPack: { name: 'Battle FX Pack', emoji: '✨', cost: 150, type: 'cosmetic', description: 'Add visual effects to battles' },
      // Strategic
      quickRevive: { name: 'Quick Revive', emoji: '💉', cost: 350, type: 'strategic', description: 'Revive pet at 50% health when KO\'d' }
    };
  }

  useItem(itemId) {
    if (!this.inventory[itemId] || this.inventory[itemId] <= 0) {
      return { success: false, message: 'Item not available' };
    }

    const definitions = Pet.getItemDefinitions();
    const item = definitions[itemId];
    if (!item) {
      return { success: false, message: 'Unknown item' };
    }

    let message = '';
    switch (itemId) {
      case 'treat':
        this.hunger = Math.max(0, this.hunger - 20);
        message = 'Pet enjoyed the treat!';
        break;
      case 'energyDrink':
        this.energy = Math.min(100, this.energy + 30);
        message = 'Pet feels energized!';
        break;
      case 'medicine':
        this.health = Math.min(100, this.health + 40);
        message = 'Pet is feeling better!';
        break;
      case 'rareCandy':
        const skills = Object.keys(this.training);
        const randomSkill = skills[Math.floor(Math.random() * skills.length)];
        this.training[randomSkill].xp += 20;
        message = `${randomSkill} gained 20 XP!`;
        break;
      case 'happinessPotion':
        this.happiness = Math.min(100, this.happiness + 25);
        message = 'Pet is very happy!';
        break;
      case 'trainingPowder':
        this.trainingPowderActive = true;
        this.trainingPowderExpiry = Date.now() + 60000;
        message = 'Training powder activated! 2x XP for 60 seconds';
        break;
      case 'xpBoostOrb':
        this.xpBoostActive = true;
        this.xpBoostExpiry = Date.now() + 120000;
        message = 'XP Boost activated! 3x XP for 120 seconds';
        break;
      case 'battleStimulant':
        // Applied during battle - just mark it active
        message = 'Battle damage boosted!';
        break;
      case 'focusTea':
        message = 'Focus increased!';
        break;
      case 'statBoostKit':
        if (this.statBoostKitPurchased) {
          return { success: false, message: 'Already purchased this upgrade' };
        }
        this.statBoostKitPurchased = true;
        message = 'All stats permanently boosted by 10%!';
        break;
      case 'evolutionAccelerator':
        // Applied to evolution timers
        message = 'Evolution time reduced!';
        break;
      case 'passiveIncome':
        if (this.passiveIncomeActive) {
          return { success: false, message: 'Piggy Bank already active' };
        }
        this.passiveIncomeActive = true;
        message = 'Passive income activated! Earn 1 coin every 5 seconds';
        break;
      case 'coinMultiplier':
        if (this.coinMultiplierActive) {
          return { success: false, message: 'Coin Multiplier already active' };
        }
        this.coinMultiplierActive = true;
        message = 'Coin multiplier activated! Battle rewards doubled';
        break;
      case 'quickRevive':
        // Applied during battle
        message = 'Quick Revive ready!';
        break;
      case 'petSkin':
      case 'nameChange':
      case 'battleEffectPack':
        message = `${item.name} applied!`;
        break;
      default:
        return { success: false, message: 'Unknown item type' };
    }

    this.inventory[itemId]--;
    this.saveState();
    return { success: true, message };
  }

  // Passive income tick
  tickPassiveIncome() {
    if (this.passiveIncomeActive && !this.frozen) {
      this.coins += 1;
    }
  }

  // Check and reset expired boosters
  checkExpiredBoosters() {
    const now = Date.now();
    if (this.trainingPowderActive && now > this.trainingPowderExpiry) {
      this.trainingPowderActive = false;
    }
    if (this.xpBoostActive && now > this.xpBoostExpiry) {
      this.xpBoostActive = false;
    }
  }

  // Get XP multiplier based on active boosters
  getXpMultiplier() {
    this.checkExpiredBoosters();
    let multiplier = 1;
    if (this.trainingPowderActive) multiplier *= 2;
    if (this.xpBoostActive) multiplier *= 3;
    return multiplier;
  }

  // Get coin multiplier based on active boosters
  getCoinMultiplier() {
    if (this.coinMultiplierActive) return 2;
    return 1;
  }
}



  // --- render.js ---
function clear(ctx, w, h){
  ctx.clearRect(0,0,w,h);
}

// --- Confetti particle system for evolution celebration (module scope) ---
const confetti = [];

function spawnConfetti(cx, cy, hue = 200, count = 30){
  for(let i=0;i<count;i++){
    confetti.push({
      x: cx + (Math.random()-0.5) * 20,
      y: cy + (Math.random()-0.5) * 20,
      vx: (Math.random() - 0.5) * 200,
      vy: - (80 + Math.random()*160),
      rot: Math.random() * Math.PI * 2,
      vro: (Math.random()-0.5) * 10,
      life: 1.5 + Math.random() * 1.2,
      age: 0,
      color: `hsl(${(hue + Math.random()*80 - 40 + i*7) % 360} 85% 60%)`
    });
  }
}

function updateConfetti(ctx, cx, cy, t){
  const dt = 1/60;
  for(let i = confetti.length - 1; i >= 0; i--){
    const p = confetti[i];
    p.age += dt;
    if(p.age > p.life){ confetti.splice(i,1); continue; }
    p.vy += 300 * dt; // gravity
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.rot += p.vro * dt;
    const alpha = 1 - (p.age / p.life);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(p.x - cx, p.y - cy);
    ctx.rotate(p.rot);
    ctx.fillStyle = p.color;
    ctx.fillRect(-4, -2, 8, 4);
    ctx.restore();
  }
}

// drawPet now accepts `state` and `t` (seconds) so it can animate and change expressions
function _baseDrawPet(ctx, x, y, size, pet, state = 'idle', t = 0){
  ctx.save();

  // small bobbing when idle / playful
  const bob = Math.sin(t * 2.5) * (state === 'playing' ? 8 : 4);
  const scale = state === 'playing' ? 1 + Math.sin(t * 10) * 0.02 : 1;

  ctx.translate(x, y + bob);
  // apply head-shake rotation if pet is shaking
  const nowMs = Date.now();
  if(pet.shakeUntil && pet.shakeUntil > nowMs){
    // shake using a fast sinusoid; amplitude 0.25 rad (~14deg)
    const shakeT = (pet.shakeUntil - nowMs) / 1000; // remaining seconds
    const shakeAngle = Math.sin((nowMs % 200) / 200 * Math.PI * 8) * 0.25;
    ctx.rotate(shakeAngle);
  }
  ctx.scale(scale, scale);

  // compute a combined wellness score from hunger, energy, and health
  const hungerGood = 100 - pet.hunger;
  const wellness = (hungerGood * 0.5) + (pet.energy * 0.3) + (pet.health * 0.2);
  const hue = Math.round((wellness / 100) * 200);

  // draw shape depending on pet.form, with evolving morph animation if active
  if(pet.evolving){
    const elapsed = (nowMs - pet.evolveStart) / 1000;
    const p = Math.min(1, Math.max(0, elapsed / pet.evolveDuration));
    // draw from-shape faded
    ctx.save(); ctx.globalAlpha = 1 - p;
    drawShape(ctx, pet.evolveFrom || pet.form, size, hue);
    ctx.restore();

    // draw to-shape fading in, with a little pop scale
    const pop = 1 + Math.sin(p * Math.PI) * 0.12;
    ctx.save(); ctx.globalAlpha = p; ctx.scale(pop, pop);
    drawShape(ctx, pet.evolveTo, size, hue);
    ctx.restore();

    // celebratory starburst
    // update and draw confetti particles
    updateConfetti(ctx, x, y, t);
  } else {
    drawShape(ctx, pet.form, size, hue);
  }

  function drawShape(ctx, shape, size, hue){
    if(shape === 'triangle'){
      const triSize = size * 1.15;
      ctx.fillStyle = `hsl(${hue} 65% 55%)`;
      ctx.beginPath();
      ctx.moveTo(0, -triSize);
      ctx.lineTo(triSize * 0.9, triSize * 0.6);
      ctx.lineTo(-triSize * 0.9, triSize * 0.6);
      ctx.closePath();
      ctx.fill();
    } else if(shape === 'square'){
      const sqSize = size * 1.35;
      ctx.fillStyle = `hsl(${hue} 65% 55%)`;
      ctx.beginPath();
      ctx.rect(-sqSize, -sqSize, sqSize * 2, sqSize * 2);
      ctx.fill();
    } else if(shape === 'circle-plus'){
      const r = size * 1.55;
      const pulse = 0.1 + Math.sin(t * 2.6) * 0.08;
      ctx.save();
      // outer glow uses a radial gradient with animated radius
      const g = ctx.createRadialGradient(0, 0, r * 0.7, 0, 0, r * (1.4 + pulse));
      g.addColorStop(0, `hsla(${hue} 80% 65% / 0.22)`);
      g.addColorStop(1, `hsla(${hue} 80% 65% / 0)`);
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(0, 0, r * (1.4 + pulse), 0, Math.PI*2); ctx.fill();

      ctx.strokeStyle = `hsl(${hue} 70% 35%)`;
      ctx.lineWidth = Math.max(4, size * 0.16 + pulse * size * 0.2);
      if(ctx.setLineDash){ ctx.setLineDash([10, 8]); }
      ctx.beginPath(); ctx.arc(0, 0, r * (1 + pulse * 0.4), 0, Math.PI*2); ctx.stroke();
      if(ctx.setLineDash){ ctx.setLineDash([]); }

      ctx.fillStyle = `hsla(${hue} 70% 55% / ${0.2 + pulse * 0.25})`;
      ctx.beginPath(); ctx.arc(0, 0, r * (1 + pulse * 0.2), 0, Math.PI*2); ctx.fill();
      ctx.restore();
    } else if(shape === 'dead'){
      ctx.fillStyle = '#444';
      ctx.beginPath(); ctx.arc(0, 0, size, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.arc(0, 0, size, 0, Math.PI*2); ctx.fill();
    } else {
      ctx.fillStyle = `hsl(${hue} 65% 55%)`;
      ctx.beginPath(); ctx.arc(0, 0, size, 0, Math.PI*2); ctx.fill();
    }
  }

  

  // Eye positions
  const eyeY = -size * 0.12;
  const eyeXOff = size * 0.32;
  const eyeR = size * 0.12;

  // blinking logic: occasional blink using a smooth threshold
  const blinkValue = Math.sin(t * 3 + (pet.age % 5));
  const isBlink = blinkValue > 0.98 || state === 'sleeping';

  // sick state: X eyes
  if(state === 'sick' || pet.form === 'dead'){
    ctx.strokeStyle = '#081';
    ctx.lineWidth = 3;
    // left X
    ctx.beginPath(); ctx.moveTo(-eyeXOff - eyeR*0.6, eyeY - eyeR*0.6); ctx.lineTo(-eyeXOff + eyeR*0.6, eyeY + eyeR*0.6); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-eyeXOff + eyeR*0.6, eyeY - eyeR*0.6); ctx.lineTo(-eyeXOff - eyeR*0.6, eyeY + eyeR*0.6); ctx.stroke();
    // right X
    ctx.beginPath(); ctx.moveTo(eyeXOff - eyeR*0.6, eyeY - eyeR*0.6); ctx.lineTo(eyeXOff + eyeR*0.6, eyeY + eyeR*0.6); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(eyeXOff + eyeR*0.6, eyeY - eyeR*0.6); ctx.lineTo(eyeXOff - eyeR*0.6, eyeY + eyeR*0.6); ctx.stroke();
  } else if(isBlink){
    // draw sleepy lines for blink/closed
    ctx.strokeStyle = '#012';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(-eyeXOff - eyeR, eyeY); ctx.lineTo(-eyeXOff + eyeR, eyeY); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(eyeXOff - eyeR, eyeY); ctx.lineTo(eyeXOff + eyeR, eyeY); ctx.stroke();
  } else {
    // normal eyes — pupils move a bit when playing
    const pupilOffset = (state === 'playing') ? Math.sin(t * 6) * 2 : 0;
    ctx.fillStyle = '#031';
    // left white + pupil
    ctx.beginPath(); ctx.arc(-eyeXOff, eyeY, eyeR, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(-eyeXOff, eyeY, eyeR*0.6, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#012'; ctx.beginPath(); ctx.arc(-eyeXOff + pupilOffset, eyeY, eyeR*0.28, 0, Math.PI*2); ctx.fill();
    // right
    ctx.fillStyle = '#031'; ctx.beginPath(); ctx.arc(eyeXOff, eyeY, eyeR, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(eyeXOff, eyeY, eyeR*0.6, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#012'; ctx.beginPath(); ctx.arc(eyeXOff + pupilOffset, eyeY, eyeR*0.28, 0, Math.PI*2); ctx.fill();
  }

  // mouth, changes with happiness and state
  const happy = pet.happiness / 100;
  ctx.strokeStyle = 'rgba(0,0,0,0.85)';
  ctx.lineWidth = Math.max(2, size * 0.04);
  if(state === 'sleeping'){
    // small straight line
    ctx.beginPath(); ctx.moveTo(-size*0.18, size*0.25); ctx.lineTo(size*0.18, size*0.25); ctx.stroke();
  } else if(state === 'feeding'){
    // open little O to indicate yum
    ctx.fillStyle = '#2a2a2a'; ctx.beginPath(); ctx.ellipse(0, size*0.22, size*0.14, size*0.18, 0, 0, Math.PI*2); ctx.fill();
  } else {
    // smile or frown based on happiness
    const smileHeight = size * (0.18 + (happy - 0.5) * 0.3);
    ctx.beginPath();
    ctx.moveTo(-size*0.35, size*0.15);
    ctx.quadraticCurveTo(0, size*0.15 + smileHeight, size*0.35, size*0.15);
    ctx.stroke();
  }

  ctx.restore();
}

function drawHUD(ctx, w, h, pet, state){
  // reserved: HUD overlays can be drawn here in future
}

// --- Simple battle animation system ---
const battleAnims = [];

function spawnBattleAnimation(type, opts = {}){
  // opts: {xOff, yOff, dir, hue}
  battleAnims.push({ type, t: 0, life: 0.6, xOff: opts.xOff || 0, yOff: opts.yOff || 0, dir: opts.dir || 1, hue: opts.hue || 0 });
}

function updateBattleAnims(ctx, cx, cy, t){
  const dt = 1/60;
  for(let i = battleAnims.length - 1; i >= 0; i--){
    const a = battleAnims[i];
    a.t += dt;
    if(a.t > a.life){ battleAnims.splice(i,1); continue; }
    const p = a.t / a.life;
    ctx.save();
    ctx.translate(cx + a.xOff, cy + a.yOff);
    if(a.type === 'slash'){
      // draw a quick angled slash
      ctx.globalAlpha = 1 - p;
      ctx.rotate(-0.4 * a.dir + Math.sin(a.t*30) * 0.05);
      ctx.fillStyle = `hsl(${a.hue} 90% 60%)`;
      ctx.fillRect(0, -6, 80 * (1 - p), 12);
    } else if(a.type === 'hit'){
      // small red impact burst
      ctx.globalAlpha = 1 - p;
      ctx.fillStyle = `hsl(${a.hue} 90% 50%)`;
      const r = 6 + p * 18;
      ctx.beginPath(); ctx.arc(20 * a.dir, 0, r, 0, Math.PI*2); ctx.fill();
    } else if(a.type === 'enemy-appear'){
      // pulse circle where enemy will appear (to the right)
      ctx.globalAlpha = 1 - p;
      ctx.strokeStyle = `hsl(${a.hue} 80% 50%)`;
      ctx.lineWidth = 3;
      const r = 10 + p * 30;
      ctx.beginPath(); ctx.arc(140 * a.dir, 0, r, 0, Math.PI*2); ctx.stroke();
    } else if(a.type === 'death'){
      // death overlay/pulse
      const alpha = Math.min(1, p * 1.2);
      ctx.globalAlpha = alpha * 0.9;
      ctx.fillStyle = `rgba(10,10,10,${0.7 * alpha})`;
      ctx.beginPath(); ctx.arc(0, 0, 40 + p * 200, 0, Math.PI*2); ctx.fill();
      // draw two X eyes over center
      ctx.globalAlpha = 1;
      ctx.strokeStyle = '#111'; ctx.lineWidth = 6;
      const ox = 0; const oy = -10;
      ctx.beginPath(); ctx.moveTo(ox-18, oy-18); ctx.lineTo(ox+18, oy+18); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(ox+18, oy-18); ctx.lineTo(ox-18, oy+18); ctx.stroke();
    }
    ctx.restore();
  }
}

// integrate battle anim drawing into the normal drawPet pipeline
function drawPet(ctx, x, y, size, pet, state = 'idle', t = 0){
  _baseDrawPet(ctx, x, y, size, pet, state, t);
  // draw battle animations on top
  updateBattleAnims(ctx, x, y, t);
}

  // --- main.js ---




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


})();

