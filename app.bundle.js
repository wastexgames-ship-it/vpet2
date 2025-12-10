// Single-file bundle for file:// usage (no modules needed)
(() => {
  // --- stateMachine.js ---
  class StateMachine {
    constructor(initial = 'idle'){
      this.state = initial;
      this.listeners = new Set();
    }
    onChange(fn){ this.listeners.add(fn); return () => this.listeners.delete(fn); }
    set(state){ if(this.state === state) return; const prev = this.state; this.state = state; for(const l of this.listeners) l(this.state, prev); }
    get(){ return this.state; }
  }

  // --- pet.js ---
  class Pet {
    constructor(){
      this.hunger = 50;
      this.happiness = 70;
      this.energy = 80;
      this.health = 100;
      this.age = 0;
      this.lastTick = Date.now();
      this.log = [];
      this.shakeUntil = 0;
      this.shakeType = '';
      this.form = 'circle';
      this._wellness70Timer = 0;
      this._wellness60Timer = 0;
      this._wellness75Timer = 0;
      this.evolving = false;
      this.evolveFrom = null;
      this.evolveTo = null;
      this.evolveStart = 0;
      this.evolveDuration = 0;
      this.lastActionTime = Date.now();
      this.lastActionState = 'idle';
      this.lastActionCount = 0;
      this.evolutionStartTime = 0;
      this.frozen = false;
      this.freezeTime = 0;
      this.training = {
        strength: { level: 0, xp: 0 },
        speed: { level: 0, xp: 0 },
        defense: { level: 0, xp: 0 },
        intelligence: { level: 0, xp: 0 }
      };
      this.inBattle = false;
      this.currentEnemy = null;
      this.battleLog = [];
      this.lastBattleTime = 0;
      this.nextBattleTime = Date.now() + this.randomBattleDelay();
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
          training: this.training
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
      }catch(e){ /* ignore parse errors */ }
    }

    tick(state, dt){
      if(this.frozen) return;
      this.age += dt;
      if(this.form === 'dead') return;

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
      }

      this.hunger += 0.05 * dt;
      this.energy -= 0.03 * dt;
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

      if(this.hunger > 85){
        const hungerIntensity = (this.hunger - 85) / 15;
        this.happiness -= 0.08 * hungerIntensity * dt;
      }

      const timeSinceAction = (Date.now() - this.lastActionTime) / 1000;
      if(timeSinceAction > 60){
        const neglectIntensity = Math.min(1, (timeSinceAction - 60) / 120);
        this.happiness -= 0.04 * neglectIntensity * dt;
      }

      if(this.energy < 15){
        const tiredIntensity = (15 - this.energy) / 15;
        this.happiness -= 0.06 * tiredIntensity * dt;
      }

      if(state === 'idle'){
        this.happiness -= 0.02 * dt;
      }

      const ageDecay = Math.min(0.015, this.age / 3000);
      this.happiness -= ageDecay * dt;

      if(this.evolving){
        this.happiness -= 0.05 * dt;
      }

      const hungerGoodTemp = 100 - this.hunger;
      const wellnessTemp = (hungerGoodTemp * 0.5) + (this.energy * 0.3) + (this.health * 0.2);
      if(wellnessTemp < 30){
        const deathAnxiety = (30 - wellnessTemp) / 30;
        this.happiness -= 0.15 * deathAnxiety * dt;
      }

      if(this.health > 50 && this.hunger < 40 && this.energy > 40) this.happiness += 0.2 * dt;

      this.hunger = Math.min(100, Math.max(0, this.hunger));
      this.happiness = Math.min(100, Math.max(0, this.happiness));
      this.energy = Math.min(100, Math.max(0, this.energy));
      this.health = Math.min(100, Math.max(0, this.health));

      if(this.hunger > 90 || this.energy < 10) this.health -= 0.04 * dt;
      this.health = Math.min(100, Math.max(0, this.health));

      const hungerGood = 100 - this.hunger;
      const wellness = (hungerGood * 0.5) + (this.energy * 0.3) + (this.health * 0.2);

      if(wellness <= 0){
        this.form = 'dead';
        this.action('Pet has died');
        try{ this.saveState(); }catch(e){}
        return;
      }

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

      if(!this.inBattle && state !== 'sick' && state !== 'dead'){
        const now = Date.now();
        if(!this.nextBattleTime) this.nextBattleTime = now + this.randomBattleDelay();
        if(now >= this.nextBattleTime){
          if(Math.random() < 0.4){
            this.startBattle();
          }
          this.nextBattleTime = now + this.randomBattleDelay();
        }
      }
    }

    randomBattleDelay(){
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
      this.evolveDuration = durationMs / 1000;
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
      this.lastActionTime = Date.now();
      if(actionState === this.lastActionState){
        this.lastActionCount++;
      } else {
        this.lastActionCount = 1;
        this.lastActionState = actionState;
      }
    }

    triggerShake(type = 'no', durationMs = 800){
      this.shakeType = type;
      this.shakeUntil = Date.now() + durationMs;
      this.action(`Refused: ${type}`);
      try{ const ev = new CustomEvent('pet:shake', { detail: { type, durationMs } }); window.dispatchEvent(ev); }catch(e){}
    }

    isShaking(){
      return Date.now() < this.shakeUntil;
    }

    reset(){
      this.hunger = 50;
      this.happiness = 70;
      this.energy = 80;
      this.health = 100;
      this.age = 0;
      this._wellness70Timer = 0;
      this._wellness60Timer = 0;
      this._wellness75Timer = 0;
      this.training = {
        strength: { level: 0, xp: 0 },
        speed: { level: 0, xp: 0 },
        defense: { level: 0, xp: 0 },
        intelligence: { level: 0, xp: 0 }
      };
      this.evolving = false;
      this.evolveFrom = null;
      this.evolveTo = null;
      this.evolveStart = 0;
      this.evolveDuration = 0;
      const wasDead = this.form === 'dead';
      if(wasDead){
        this.form = 'circle';
        try{ window.dispatchEvent(new CustomEvent('pet:revived')); }catch(e){}
        try{ this.saveState(); }catch(e){}
      } else if(this.form !== 'circle'){
        this.startEvolution('circle', 1500);
      } else {
        try{ this.saveState(); }catch(e){}
      }
      this.action('Reset to beginning');
    }

    freeze(){
      if(!this.frozen){
        this.frozen = true;
        this.freezeTime = Date.now();
        this.action('Pet frozen in time');
        this.saveState();
      }
    }

    unfreeze(){
      if(this.frozen){
        this.frozen = false;
        this.freezeTime = 0;
        this.action('Pet unfrozen!');
        this.saveState();
      }
    }

    trainAbility(abilityName){
      if(this.frozen){
        this.triggerShake('frozen', 800);
        return false;
      }
      if(!this.training[abilityName]) return false;
      if(this.energy < 15){
        this.triggerShake('no-play', 800);
        return false;
      }
      this.energy = Math.max(0, this.energy - 15);
      const training = this.training[abilityName];
      training.xp += 20;
      const xpNeeded = 100;
      if(training.xp >= xpNeeded && training.level < 10){
        training.level++;
        training.xp = 0;
        this.action(`Training ${abilityName} leveled up to ${training.level}!`);
        this.happiness = Math.min(100, this.happiness + 5);
        try{ const ev = new CustomEvent('pet:levelup', { detail: { ability: abilityName, level: training.level } }); window.dispatchEvent(ev); }catch(e){}
      } else {
        this.action(`Trained ${abilityName} (+20 XP)`);
      }
      this.recordAction('training');
      this.saveState();
      return true;
    }

    generateEnemy(){
      const avgLevel = (this.training.strength.level + this.training.speed.level + this.training.defense.level + this.training.intelligence.level) / 4;
      const difficultyRoll = Math.random();
      let type = 'normal';
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
      if(this.inBattle || this.form === 'dead' || this.frozen) return false;
      this.generateEnemy();
      this.inBattle = true;
      this.battleLog = [];
      this.action(`Battle started with ${this.currentEnemy.name} (Lvl ${this.currentEnemy.level})!`);
      try{ const ev = new CustomEvent('pet:battlestart', { detail: { enemy: this.currentEnemy } }); window.dispatchEvent(ev); }catch(e){}
      return true;
    }

    attack(moveType = 'attack'){
      if(!this.inBattle || !this.currentEnemy) return { success: false };
      const baseDamage = 5 + this.training.strength.level * 3;
      const speedBonus = this.training.speed.level * 0.5;
      const hungerPenalty = this.hunger > 50 ? this.hunger - 50 : 0;
      const energyBonus = this.energy > 50 ? (this.energy - 50) * 0.1 : 0;
      let damage = baseDamage + energyBonus - hungerPenalty * 0.2 + (Math.random() - 0.5) * 3;
      damage = Math.max(1, Math.round(damage));
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
      if(this.currentEnemy.hp > 0){
        const enemyDamage = Math.max(0, this.currentEnemy.strength - this.training.defense.level * 0.5 + (Math.random() - 0.5) * 2);
        const actualDamage = Math.max(0, Math.round(enemyDamage - this.training.defense.level * 0.3));
        this.health = Math.max(0, this.health - actualDamage);
        this.battleLog.push(`${this.currentEnemy.name} countered for ${actualDamage} damage!`);
      }
      if(this.currentEnemy.hp <= 0){
        this.endBattle(true);
      } else if(this.health <= 0){
        this.endBattle(false);
      }
      try{ const ev = new CustomEvent('pet:battleaction', { detail: { type: 'attack', hit: isHit, damage: isHit ? damage : 0, enemy: this.currentEnemy } }); window.dispatchEvent(ev); }catch(e){}
      return { success: true, hit: isHit, damage: isHit ? damage : 0, log: logMsg };
    }

    defend(){
      if(!this.inBattle || !this.currentEnemy) return { success: false };
      this.battleLog.push('Defending!');
      const rawDamage = Math.max(0, this.currentEnemy.strength - this.training.defense.level + (Math.random() - 0.5) * 2);
      const defenseBonus = this.training.defense.level * 0.7;
      const actualDamage = Math.max(0, Math.round(rawDamage - defenseBonus));
      this.health = Math.max(0, this.health - actualDamage);
      this.battleLog.push(`${this.currentEnemy.name} attacked! Defense reduced damage to ${actualDamage}.`);
      if(this.health <= 0){ this.endBattle(false); }
      try{ const ev = new CustomEvent('pet:battleaction', { detail: { type: 'defend', damage: actualDamage, enemy: this.currentEnemy } }); window.dispatchEvent(ev); }catch(e){}
      return { success: true, damage: actualDamage };
    }

    flee(){
      if(!this.inBattle || !this.currentEnemy) return false;
      const fleeChance = 0.6 + this.training.speed.level * 0.03;
      const escaped = Math.random() < fleeChance;
      if(escaped){
        this.energy = Math.max(0, this.energy - 5);
        this.battleLog.push('Escaped!');
        this.action('Fled from battle');
        this.endBattle(null);
        try{ const ev = new CustomEvent('pet:battleaction', { detail: { type: 'flee', escaped: true, enemy: this.currentEnemy } }); window.dispatchEvent(ev); }catch(e){}
      } else {
        this.battleLog.push('Failed to escape!');
        const enemyDamage = Math.round(this.currentEnemy.strength * 0.8 + (Math.random() - 0.5) * 2);
        this.health = Math.max(0, this.health - enemyDamage);
        this.battleLog.push(`${this.currentEnemy.name} hit for ${enemyDamage} while fleeing!`);
        try{ const ev = new CustomEvent('pet:battleaction', { detail: { type: 'flee-failed', escaped: false, enemy: this.currentEnemy } }); window.dispatchEvent(ev); }catch(e){}
        if(this.health <= 0){ this.endBattle(false); }
      }
      return escaped;
    }

    endBattle(won = null){
      if(!this.inBattle) return;
      this.inBattle = false;
      const enemy = this.currentEnemy;
      this.currentEnemy = null;
      if(won === true){
        this.happiness = Math.min(100, this.happiness + 8);
        this.energy = Math.max(0, this.energy - 10);
      } else if(won === false){
        this.health = Math.max(0, this.health - 10);
        this.happiness = Math.max(0, this.happiness - 6);
      }
      this.action(won === null ? 'Battle fled' : won ? 'Battle won!' : 'Battle lost');
      try{ const ev = new CustomEvent('pet:battleend', { detail: { won, enemy } }); window.dispatchEvent(ev); }catch(e){}
    }
  }

  // --- render.js ---
  function clear(ctx, w, h){ ctx.clearRect(0,0,w,h); }
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
      p.vy += 300 * dt;
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

  function _baseDrawPet(ctx, x, y, size, pet, state = 'idle', t = 0){
    ctx.save();
    const bob = Math.sin(t * 2.5) * (state === 'playing' ? 8 : 4);
    const scale = state === 'playing' ? 1 + Math.sin(t * 10) * 0.02 : 1;
    ctx.translate(x, y + bob);
    const nowMs = Date.now();
    if(pet.shakeUntil && pet.shakeUntil > nowMs){
      const shakeAngle = Math.sin((nowMs % 200) / 200 * Math.PI * 8) * 0.25;
      ctx.rotate(shakeAngle);
    }
    ctx.scale(scale, scale);
    const hungerGood = 100 - pet.hunger;
    const wellness = (hungerGood * 0.5) + (pet.energy * 0.3) + (pet.health * 0.2);
    const hue = Math.round((wellness / 100) * 200);
    if(pet.evolving){
      const elapsed = (nowMs - pet.evolveStart) / 1000;
      const p = Math.min(1, Math.max(0, elapsed / pet.evolveDuration));
      ctx.save(); ctx.globalAlpha = 1 - p; drawShape(ctx, pet.evolveFrom || pet.form, size, hue); ctx.restore();
      const pop = 1 + Math.sin(p * Math.PI) * 0.12;
      ctx.save(); ctx.globalAlpha = p; ctx.scale(pop, pop); drawShape(ctx, pet.evolveTo, size, hue); ctx.restore();
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
    const eyeY = -size * 0.12;
    const eyeXOff = size * 0.32;
    const eyeR = size * 0.12;
    const blinkValue = Math.sin(t * 3 + (pet.age % 5));
    const isBlink = blinkValue > 0.98 || state === 'sleeping';
    if(state === 'sick' || pet.form === 'dead'){
      ctx.strokeStyle = '#081'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(-eyeXOff - eyeR*0.6, eyeY - eyeR*0.6); ctx.lineTo(-eyeXOff + eyeR*0.6, eyeY + eyeR*0.6); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-eyeXOff + eyeR*0.6, eyeY - eyeR*0.6); ctx.lineTo(-eyeXOff - eyeR*0.6, eyeY + eyeR*0.6); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(eyeXOff - eyeR*0.6, eyeY - eyeR*0.6); ctx.lineTo(eyeXOff + eyeR*0.6, eyeY + eyeR*0.6); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(eyeXOff + eyeR*0.6, eyeY - eyeR*0.6); ctx.lineTo(eyeXOff - eyeR*0.6, eyeY + eyeR*0.6); ctx.stroke();
    } else if(isBlink){
      ctx.strokeStyle = '#012'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(-eyeXOff - eyeR, eyeY); ctx.lineTo(-eyeXOff + eyeR, eyeY); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(eyeXOff - eyeR, eyeY); ctx.lineTo(eyeXOff + eyeR, eyeY); ctx.stroke();
    } else {
      const pupilOffset = (state === 'playing') ? Math.sin(t * 6) * 2 : 0;
      ctx.fillStyle = '#031'; ctx.beginPath(); ctx.arc(-eyeXOff, eyeY, eyeR, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(-eyeXOff, eyeY, eyeR*0.6, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#012'; ctx.beginPath(); ctx.arc(-eyeXOff + pupilOffset, eyeY, eyeR*0.28, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#031'; ctx.beginPath(); ctx.arc(eyeXOff, eyeY, eyeR, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(eyeXOff, eyeY, eyeR*0.6, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#012'; ctx.beginPath(); ctx.arc(eyeXOff + pupilOffset, eyeY, eyeR*0.28, 0, Math.PI*2); ctx.fill();
    }
    const happy = pet.happiness / 100;
    ctx.strokeStyle = 'rgba(0,0,0,0.85)';
    ctx.lineWidth = Math.max(2, size * 0.04);
    if(state === 'sleeping'){
      ctx.beginPath(); ctx.moveTo(-size*0.18, size*0.25); ctx.lineTo(size*0.18, size*0.25); ctx.stroke();
    } else if(state === 'feeding'){
      ctx.fillStyle = '#2a2a2a'; ctx.beginPath(); ctx.ellipse(0, size*0.22, size*0.14, size*0.18, 0, 0, Math.PI*2); ctx.fill();
    } else {
      const smileHeight = size * (0.18 + (happy - 0.5) * 0.3);
      ctx.beginPath();
      ctx.moveTo(-size*0.35, size*0.15);
      ctx.quadraticCurveTo(0, size*0.15 + smileHeight, size*0.35, size*0.15);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawHUD(ctx, w, h, pet, state){ /* reserved */ }

  const battleAnims = [];
  function spawnBattleAnimation(type, opts = {}){
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
        ctx.globalAlpha = 1 - p;
        ctx.rotate(-0.4 * a.dir + Math.sin(a.t*30) * 0.05);
        ctx.fillStyle = `hsl(${a.hue} 90% 60%)`;
        ctx.fillRect(0, -6, 80 * (1 - p), 12);
      } else if(a.type === 'hit'){
        ctx.globalAlpha = 1 - p;
        ctx.fillStyle = `hsl(${a.hue} 90% 50%)`;
        const r = 6 + p * 18;
        ctx.beginPath(); ctx.arc(20 * a.dir, 0, r, 0, Math.PI*2); ctx.fill();
      } else if(a.type === 'enemy-appear'){
        ctx.globalAlpha = 1 - p;
        ctx.strokeStyle = `hsl(${a.hue} 80% 50%)`;
        ctx.lineWidth = 3;
        const r = 10 + p * 30;
        ctx.beginPath(); ctx.arc(140 * a.dir, 0, r, 0, Math.PI*2); ctx.stroke();
      } else if(a.type === 'death'){
        const alpha = Math.min(1, p * 1.2);
        ctx.globalAlpha = alpha * 0.9;
        ctx.fillStyle = `rgba(10,10,10,${0.7 * alpha})`;
        ctx.beginPath(); ctx.arc(0, 0, 40 + p * 200, 0, Math.PI*2); ctx.fill();
        ctx.globalAlpha = 1;
        ctx.strokeStyle = '#111'; ctx.lineWidth = 6;
        const ox = 0; const oy = -10;
        ctx.beginPath(); ctx.moveTo(ox-18, oy-18); ctx.lineTo(ox+18, oy+18); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(ox+18, oy-18); ctx.lineTo(ox-18, oy+18); ctx.stroke();
      }
      ctx.restore();
    }
  }
  function drawPet(ctx, x, y, size, pet, state = 'idle', t = 0){
    _baseDrawPet(ctx, x, y, size, pet, state, t);
    updateBattleAnims(ctx, x, y, t);
  }

  // --- main.js (adapted to non-module) ---
  const canvas = document.getElementById('game-canvas');
  const ctx = canvas.getContext('2d');
  function resize(){ const rect = canvas.getBoundingClientRect(); canvas.width = 600; canvas.height = 400; }
  resize();

  const pet = new Pet();
  const sm = new StateMachine('idle');
  let lastTrainTime = 0;
  const trainCooldown = 2000;

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
    if(pet.evolving){
      evoSectionEl.classList.remove('hidden');
      const dur = (pet.evolveDuration || 1000) / 1000;
      const start = pet.evolveStart || Date.now();
      const elapsed = Math.max(0, (Date.now() - start) / 1000);
      const pct = Math.min(1, elapsed / dur);
      evoFillEl.style.width = `${pct * 100}%`;
      evoLabelEl.textContent = `Evolving: ${Math.round(elapsed)}s / ${Math.round(dur)}s`;
      return;
    }
    if(form === 'circle'){
      const got = (pet._wellness70Timer || 0);
      const required = 120;
      const pct = Math.min(1, got / required);
      evoSectionEl.classList.remove('hidden');
      evoFillEl.style.width = `${pct * 100}%`;
      evoLabelEl.textContent = `To Triangle: ${Math.round(got)}s / ${required}s`;
      return;
    }
    if(form === 'triangle'){
      const got = (pet._wellness60Timer || 0);
      const required = 300;
      const pct = Math.min(1, got / required);
      evoSectionEl.classList.remove('hidden');
      evoFillEl.style.width = `${pct * 100}%`;
      evoLabelEl.textContent = `To Square: ${Math.round(got)}s / ${required}s`;
      return;
    }
    if(form === 'square'){
      const got = (pet._wellness75Timer || 0);
      const required = 240;
      const pct = Math.min(1, got / required);
      evoSectionEl.classList.remove('hidden');
      evoFillEl.style.width = `${pct * 100}%`;
      evoLabelEl.textContent = `To Ascended Circle: ${Math.round(got)}s / ${required}s`;
      return;
    }
    evoSectionEl.classList.add('hidden');
  }

  let audioCtx = null;
  function ensureAudio(){ if(!audioCtx){ try{ audioCtx = new (window.AudioContext || window.webkitAudioContext)(); }catch(e){ audioCtx = null; } } }
  function playRefusalSound(type = ''){
    ensureAudio(); if(!audioCtx) return; const now = audioCtx.currentTime; const o = audioCtx.createOscillator(); const g = audioCtx.createGain();
    const freqMap = { 'no-feed': 220, 'no-play': 260, 'no-sleep': 200, 'no-heal': 300 };
    o.type = 'sine'; o.frequency.value = freqMap[type] || 240; g.gain.value = 0.0; o.connect(g); g.connect(audioCtx.destination);
    o.start(now); g.gain.linearRampToValueAtTime(0.12, now + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, now + 0.35); o.stop(now + 0.36);
  }
  function playVictorySound(){
    ensureAudio(); if(!audioCtx) return; const now = audioCtx.currentTime; const freqs = [520, 660, 880];
    freqs.forEach((f,i)=>{ const o = audioCtx.createOscillator(); const g = audioCtx.createGain(); o.type = 'sine'; o.frequency.value = f; o.connect(g); g.connect(audioCtx.destination); const start = now + i * 0.06; o.start(start); g.gain.setValueAtTime(0.001, start); g.gain.linearRampToValueAtTime(0.14, start + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, start + 0.7); o.stop(start + 0.75); });
  }
  function playDefeatSound(){
    ensureAudio(); if(!audioCtx) return; const now = audioCtx.currentTime; const o = audioCtx.createOscillator(); const g = audioCtx.createGain(); o.type = 'sawtooth'; o.frequency.value = 120; o.connect(g); g.connect(audioCtx.destination); o.start(now); g.gain.setValueAtTime(0.08, now); g.gain.exponentialRampToValueAtTime(0.0001, now + 1.2); o.stop(now + 1.25);
  }
  function announceSR(text, duration = 3000){ try{ if(!srAnnouncer) return; srAnnouncer.textContent = ''; setTimeout(()=>{ srAnnouncer.textContent = text; }, 50); if(duration > 0){ setTimeout(()=>{ try{ srAnnouncer.textContent = ''; }catch(e){} }, duration); } }catch(e){} }
  let subtitleTimeout = null;
  function showSubtitle(text, duration = 900){ if(!subtitleEl) return; subtitleEl.textContent = text; subtitleEl.classList.add('show'); if(subtitleTimeout) clearTimeout(subtitleTimeout); subtitleTimeout = setTimeout(()=>{ subtitleEl.classList.remove('show'); subtitleTimeout = null; }, duration); }

  function updateDeadUI(){
    const interactiveIds = [ 'btn-play','btn-start-battle','btn-feed','btn-sleep','btn-heal','btn-freeze', 'btn-train-strength','btn-train-speed','btn-train-defense','btn-train-intelligence', 'btn-attack','btn-defend','btn-flee' ];
    const isDead = pet.form === 'dead';
    interactiveIds.forEach(id => {
      const el = document.getElementById(id);
      if(!el) return;
      if(isDead){ el.setAttribute('disabled','disabled'); el.classList.add('disabled'); } else { el.removeAttribute('disabled'); el.classList.remove('disabled'); }
    });
  }

  const shakeMessages = {
    'no-feed': "I am not hungry",
    'no-play': "I don't want to play",
    'no-sleep': "I can't sleep right now",
    'no-heal': "I am very healthy",
    'no-train': "I'm too tired to train"
  };

  window.addEventListener('pet:shake', (e) => {
    const { type, durationMs } = e.detail || {};
    const message = shakeMessages[type] || "No thanks";
    playRefusalSound(type);
    showSubtitle(message, durationMs || 900);
  });

  window.addEventListener('pet:evolve', (e) => {
    const { from, to, durationMs } = e.detail || {};
    const message = `Evolved into ${to.toUpperCase()}!`;
    showSubtitle(message, durationMs || 1500);
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
    try{
      const hungerGood = 100 - pet.hunger;
      const wellness = (hungerGood * 0.5) + (pet.energy * 0.3) + (pet.health * 0.2);
      const hue = Math.round((wellness / 100) * 200);
      spawnConfetti(canvas.width/2, canvas.height/2, hue, 48);
    }catch(e){}
    try{ pet.saveState(); }catch(e){}
  });

  function updateStats(){
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
    logEl.innerHTML = pet.log.map(l=>`<div>${l}</div>`).join('');
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

  const trainingModal = document.getElementById('training-modal');
  const btnOpenTraining = document.getElementById('btn-open-training');
  const btnCloseTraining = document.getElementById('btn-close-training');
  const modalOverlay = document.getElementById('training-modal-overlay');
  function modalShow(modal){
    if(!modal) return;
    modal.classList.add('show');
    modal.setAttribute('aria-hidden','false');
    modal.__lastFocused = document.activeElement;
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
  if(btnOpenTraining && trainingModal){ btnOpenTraining.addEventListener('click', ()=>{ modalShow(trainingModal); updateTrainingUI(); }); }
  if(btnCloseTraining && trainingModal){ btnCloseTraining.addEventListener('click', ()=>{ modalHide(trainingModal); }); }
  if(modalOverlay && trainingModal){ modalOverlay.addEventListener('click', ()=>{ modalHide(trainingModal); }); }

  const legendModal = document.getElementById('legend-modal');
  const btnOpenFaq = document.getElementById('btn-open-faq');
  const btnCloseLegend = document.getElementById('btn-close-legend');
  const legendOverlay = document.getElementById('legend-modal-overlay');
  if(btnOpenFaq && legendModal){ btnOpenFaq.addEventListener('click', ()=>{ modalShow(legendModal); }); }
  if(btnCloseLegend && legendModal){ btnCloseLegend.addEventListener('click', ()=>{ modalHide(legendModal); }); }
  if(legendOverlay && legendModal){ legendOverlay.addEventListener('click', ()=>{ modalHide(legendModal); }); }

  function updateBattleUI(){
    if(!pet.inBattle || !battleSectionEl) return;
    battleSectionEl.style.display = 'block';
    battleSectionEl.classList.add('show');
    battleSectionEl.setAttribute('aria-hidden','false');
    const enemy = pet.currentEnemy;
    battleInfoEl.innerHTML = `<strong>${enemy.name}</strong> (Lvl ${enemy.level}, Type: ${enemy.type})`;
    const petHpPercent = (pet.health / 100) * 100;
    const enemyHpPercent = (enemy.hp / enemy.maxHp) * 100;
    battleHpsEl.innerHTML = `
      <div class="battle-hp-bar">
        <div>Your Pet: ${Math.round(pet.health)}/${100}</div>
        <div class="battle-hp-fill" style="background:linear-gradient(90deg,#4caf50 ${petHpPercent}%,#333 ${petHpPercent}%)"></div>
      </div>
      <div class="battle-hp-bar">
        <div>${enemy.name}: ${Math.round(enemy.hp)}/${enemy.maxHp}</div>
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
      setTimeout(()=>{ if(battleSectionEl) battleSectionEl.style.display = 'none'; }, 260);
    }
  }

  let last = performance.now();
  let statAccumulator = 0;
  function loop(now){
    const frameElapsed = now - last; last = now; statAccumulator += frameElapsed;
    if(statAccumulator >= 10000){
      const dtSeconds = statAccumulator / 1000;
      pet.tick(sm.get(), dtSeconds);
      try{ pet.saveState(); }catch(e){}
      statAccumulator = 0;
    }
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

  document.getElementById('btn-play').addEventListener('click', ()=>{
    if(pet.form === 'dead'){ showSubtitle('Pet has died'); return; }
    if(pet.inBattle){ showSubtitle('Pet is in battle!'); return; }
    if(pet.happiness >= 100){ pet.triggerShake('no-play', 800); pet.happiness = Math.max(0, pet.happiness - 2); updateStats(); try{ pet.saveState(); }catch(e){}; return; }
    if(pet.energy <= 10){ pet.triggerShake('no-play', 800); pet.happiness = Math.max(0, pet.happiness - 2); updateStats(); try{ pet.saveState(); }catch(e){}; return; }
    pet.recordAction('playing');
    if(pet.lastActionCount >= 4){ pet.happiness = Math.max(0, pet.happiness - 5); showSubtitle('Pet is bored of playing!', 1000); pet.action('Pet got bored (repeated playing)'); }
    pet.happiness = Math.min(100, pet.happiness + 12);
    pet.energy = Math.max(0, pet.energy - 15);
    pet.action('Played with pet (+12 happiness, -15 energy)');
    sm.set('playing');
    setTimeout(()=>{ if(sm.get() === 'playing') sm.set('idle'); }, 6000);
    updateStats();
    try{ pet.saveState(); }catch(e){}
  });

  document.getElementById('btn-feed').addEventListener('click', ()=>{
    if(pet.form === 'dead'){ showSubtitle('Pet has died'); return; }
    if(pet.inBattle){ showSubtitle('Pet is in battle!'); return; }
    if(pet.hunger <= 0){ pet.triggerShake('no-feed', 800); pet.happiness = Math.max(0, pet.happiness - 2); updateStats(); try{ pet.saveState(); }catch(e){}; return; }
    pet.recordAction('feeding');
    if(pet.lastActionCount >= 4){ pet.happiness = Math.max(0, pet.happiness - 5); showSubtitle('Pet is tired of eating!', 1000); pet.action('Pet got bored (repeated feeding)'); }
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
    if(pet.form === 'dead'){ showSubtitle('Pet has died'); return; }
    if(pet.inBattle){ showSubtitle('Pet is in battle!'); return; }
    if(pet.energy >= 100){ pet.triggerShake('no-sleep', 800); pet.happiness = Math.max(0, pet.happiness - 2); updateStats(); try{ pet.saveState(); }catch(e){}; return; }
    pet.recordAction('sleeping');
    if(pet.lastActionCount >= 4){ pet.happiness = Math.max(0, pet.happiness - 5); showSubtitle('Pet is not tired!', 1000); pet.action('Pet got frustrated (repeated sleeping)'); }
    if(pet.lastActionCount >= 2){ pet.happiness = Math.max(0, pet.happiness - 3); pet.action('Pet got annoyed by constant napping (-3 happiness)'); }
    pet.energy = Math.min(100, pet.energy + 20);
    pet.action('Pet slept (+20 energy)');
    sm.set('sleeping');
    setTimeout(()=>{ if(sm.get() === 'sleeping') sm.set('idle'); }, 8000);
    updateStats();
    try{ pet.saveState(); }catch(e){}
  });

  document.getElementById('btn-heal').addEventListener('click', ()=>{
    if(pet.form === 'dead'){ showSubtitle('Pet has died'); return; }
    if(pet.health >= 100){ pet.triggerShake('no-heal', 800); pet.happiness = Math.max(0, pet.happiness - 2); updateStats(); try{ pet.saveState(); }catch(e){}; return; }
    pet.recordAction('healing');
    if(pet.lastActionCount >= 4){ pet.happiness = Math.max(0, pet.happiness - 5); showSubtitle('Pet is feeling fine!', 1000); pet.action('Pet got frustrated (repeated healing)'); }
    sm.set('idle');
    pet.health = Math.min(100, pet.health + 25);
    pet.action('Healed a bit (+25 health)');
    updateStats();
    try{ pet.saveState(); }catch(e){}
  });

  document.getElementById('btn-reset').addEventListener('click', ()=>{
    const confirmReset = window.confirm('Reset pet to the beginning? This cannot be undone.');
    if(!confirmReset) return;
    pet.reset();
    sm.set('idle');
    updateStats();
    updateEvoUI();
    updateFreezeUI();
    hideBattleUI();
  });

  document.getElementById('btn-freeze').addEventListener('click', ()=>{
    const freezeBtn = document.getElementById('btn-freeze');
    if(pet.form === 'dead'){ showSubtitle('Pet has died'); return; }
    if(pet.frozen){ pet.unfreeze(); freezeBtn.textContent = 'Freeze'; freezeBtn.classList.remove('frozen'); }
    else { pet.freeze(); freezeBtn.textContent = 'Unfreeze'; freezeBtn.classList.add('frozen'); }
    updateStats();
  });

  document.getElementById('btn-train-strength').addEventListener('click', ()=>{
    if(pet.form === 'dead'){ showSubtitle('Pet has died'); return; }
    if(pet.inBattle){ showSubtitle('Pet is in battle!'); return; }
    if(pet.energy < 15){ pet.triggerShake('no-train', 800); pet.happiness = Math.max(0, pet.happiness - 2); updateStats(); try{ pet.saveState(); }catch(e){}; return; }
    const now = Date.now(); if(now - lastTrainTime < trainCooldown){ showSubtitle('Pet needs a breather!', 800); return; } lastTrainTime = now;
    pet.energy = Math.max(0, pet.energy - 15);
    if(pet.trainAbility('strength')){ pet.action('Trained strength (-15 energy)'); updateStats(); try{ pet.saveState(); }catch(e){} }
  });
  document.getElementById('btn-train-speed').addEventListener('click', ()=>{
    if(pet.form === 'dead'){ showSubtitle('Pet has died'); return; }
    if(pet.inBattle){ showSubtitle('Pet is in battle!'); return; }
    if(pet.energy < 15){ pet.triggerShake('no-train', 800); pet.happiness = Math.max(0, pet.happiness - 2); updateStats(); try{ pet.saveState(); }catch(e){}; return; }
    const now = Date.now(); if(now - lastTrainTime < trainCooldown){ showSubtitle('Pet needs a breather!', 800); return; } lastTrainTime = now;
    pet.energy = Math.max(0, pet.energy - 15);
    if(pet.trainAbility('speed')){ pet.action('Trained speed (-15 energy)'); updateStats(); try{ pet.saveState(); }catch(e){} }
  });
  document.getElementById('btn-train-defense').addEventListener('click', ()=>{
    if(pet.form === 'dead'){ showSubtitle('Pet has died'); return; }
    if(pet.inBattle){ showSubtitle('Pet is in battle!'); return; }
    if(pet.energy < 15){ pet.triggerShake('no-train', 800); pet.happiness = Math.max(0, pet.happiness - 2); updateStats(); try{ pet.saveState(); }catch(e){}; return; }
    const now = Date.now(); if(now - lastTrainTime < trainCooldown){ showSubtitle('Pet needs a breather!', 800); return; } lastTrainTime = now;
    pet.energy = Math.max(0, pet.energy - 15);
    if(pet.trainAbility('defense')){ pet.action('Trained defense (-15 energy)'); updateStats(); try{ pet.saveState(); }catch(e){} }
  });
  document.getElementById('btn-train-intelligence').addEventListener('click', ()=>{
    if(pet.form === 'dead'){ showSubtitle('Pet has died'); return; }
    if(pet.inBattle){ showSubtitle('Pet is in battle!'); return; }
    if(pet.energy < 15){ pet.triggerShake('no-train', 800); pet.happiness = Math.max(0, pet.happiness - 2); updateStats(); try{ pet.saveState(); }catch(e){}; return; }
    const now = Date.now(); if(now - lastTrainTime < trainCooldown){ showSubtitle('Pet needs a breather!', 800); return; } lastTrainTime = now;
    pet.energy = Math.max(0, pet.energy - 15);
    if(pet.trainAbility('intelligence')){ pet.action('Trained intelligence (-15 energy)'); updateStats(); try{ pet.saveState(); }catch(e){} }
  });

  document.getElementById('btn-attack').addEventListener('click', ()=>{
    if(pet.form === 'dead'){ showSubtitle('Pet has died'); return; }
    pet.attack();
    updateBattleUI();
    updateStats();
    if(!pet.inBattle) hideBattleUI();
    try{ pet.saveState(); }catch(e){}
  });
  document.getElementById('btn-defend').addEventListener('click', ()=>{
    if(pet.form === 'dead'){ showSubtitle('Pet has died'); return; }
    pet.defend();
    updateBattleUI();
    updateStats();
    if(!pet.inBattle) hideBattleUI();
    try{ pet.saveState(); }catch(e){}
  });
  document.getElementById('btn-flee').addEventListener('click', ()=>{
    if(pet.form === 'dead'){ showSubtitle('Pet has died'); return; }
    pet.flee();
    updateBattleUI();
    updateStats();
    if(!pet.inBattle) hideBattleUI();
    try{ pet.saveState(); }catch(e){}
  });

  const startBattleBtn = document.getElementById('btn-start-battle');
  if(startBattleBtn){
    startBattleBtn.addEventListener('click', ()=>{
      if(pet.form === 'dead'){ showSubtitle('Pet has died'); return; }
      if(pet.inBattle){ showSubtitle('Already in battle!'); return; }
      if(pet.startBattle()){
        spawnBattleAnimation('enemy-appear', { xOff: 0, yOff: 0, dir: 1, hue: 20 });
        updateBattleUI();
        try{ pet.saveState(); }catch(e){}
      } else {
        showSubtitle('Cannot start battle now');
      }
    });
  }

  window.addEventListener('pet:battlestart', (e) => {
    if(battleSectionEl){ battleSectionEl.classList.add('show'); battleSectionEl.style.display = 'block'; battleSectionEl.setAttribute('aria-hidden','false'); }
    showSubtitle(`${e.detail.enemy.name} appeared!`, 1500);
    updateBattleUI();
    try{ const atk = document.getElementById('btn-attack'); if(atk) atk.focus(); }catch(e){}
  });

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
        try{ spawnConfetti(canvas.width/2, canvas.height/2, 140, 80); }catch(e){}
        hpFills.forEach(h=>h.classList.add('hp-flash-victory'));
        try{ if(battleBadgeEl){ battleBadgeEl.textContent = 'VICTORY'; battleBadgeEl.classList.add('show','victory'); } }catch(e){}
        try{ if(victoryBannerEl){ victoryBannerEl.textContent = '🎉 VICTORY! 🎉'; victoryBannerEl.classList.add('show'); } }catch(e){}
      } else if(won === false){
        if(battleSectionEl) battleSectionEl.classList.add('defeat');
        showSubtitle('Defeat...', 1500);
        announceSR('Defeat. You lost the battle.', 3500);
        playDefeatSound();
        hpFills.forEach(h=>h.classList.add('hp-flash-defeat'));
        try{ if(battleBadgeEl){ battleBadgeEl.textContent = 'DEFEAT'; battleBadgeEl.classList.add('show','defeat'); } }catch(e){}
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
    }, 3200);
  });

  window.addEventListener('pet:died', (e) => {
    try{ if(subtitleEl) subtitleEl.setAttribute('aria-live','assertive'); }catch(e){}
    showSubtitle('Your pet has died', 4000);
    try{ spawnBattleAnimation('death', { xOff:0, yOff:0, hue:0 }); }catch(e){}
    hideBattleUI();
    updateStats();
    setTimeout(()=>{ try{ if(subtitleEl) subtitleEl.setAttribute('aria-live','polite'); }catch(e){} }, 4200);
  });

  window.addEventListener('pet:revived', (e) => {
    showSubtitle('Pet has been revived', 2000);
    try{ spawnBattleAnimation('enemy-appear', { xOff:0, yOff:0, hue:160 }); }catch(e){}
    updateStats();
    updateEvoUI();
  });

  window.addEventListener('pet:levelup', (e) => { showSubtitle(`${e.detail.ability} reached level ${e.detail.level}!`, 1500); });

  function updateFreezeUI(){
    const freezeBtn = document.getElementById('btn-freeze');
    if(!freezeBtn) return;
    if(pet.frozen){ freezeBtn.textContent = 'Unfreeze'; freezeBtn.classList.add('frozen'); }
    else { freezeBtn.textContent = 'Freeze'; freezeBtn.classList.remove('frozen'); }
  }

  setInterval(()=>{ if(!pet.frozen && pet.health < 40) sm.set('sick'); }, 2000);
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
