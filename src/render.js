export function clear(ctx, w, h){
  ctx.clearRect(0,0,w,h);
}

// --- Confetti particle system for evolution celebration (module scope) ---
const confetti = [];

export function spawnConfetti(cx, cy, hue = 200, count = 30){
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
      ctx.fillStyle = `hsl(${hue} 65% 55%)`;
      ctx.beginPath();
      ctx.moveTo(0, -size);
      ctx.lineTo(size * 0.9, size * 0.6);
      ctx.lineTo(-size * 0.9, size * 0.6);
      ctx.closePath();
      ctx.fill();
    } else if(shape === 'square'){
      ctx.fillStyle = `hsl(${hue} 65% 55%)`;
      ctx.beginPath();
      ctx.rect(-size, -size, size * 2, size * 2);
      ctx.fill();
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

export function drawHUD(ctx, w, h, pet, state){
  // reserved: HUD overlays can be drawn here in future
}

// --- Simple battle animation system ---
const battleAnims = [];

export function spawnBattleAnimation(type, opts = {}){
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
export function drawPet(ctx, x, y, size, pet, state = 'idle', t = 0){
  _baseDrawPet(ctx, x, y, size, pet, state, t);
  // draw battle animations on top
  updateBattleAnims(ctx, x, y, t);
}
