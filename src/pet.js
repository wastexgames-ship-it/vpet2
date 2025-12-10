export class Pet {
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


