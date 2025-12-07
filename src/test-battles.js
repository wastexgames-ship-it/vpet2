/**
 * Test harness for battle system
 * Simulates battle outcomes and logs results
 */

import { Pet } from './pet.js';

export async function testVictory() {
  console.log('=== TEST: Victory Scenario ===');
  const pet = new Pet();
  pet.hunger = 30;
  pet.energy = 80;
  pet.health = 100;
  pet.happiness = 80;
  
  // Start a battle
  if (pet.startBattle()) {
    console.log(`Started battle against ${pet.currentEnemy.name}`);
    
    // Simulate multiple attacks until victory
    let rounds = 0;
    while (pet.inBattle && rounds < 20) {
      pet.attack();
      if (pet.inBattle) {
        console.log(`Round ${rounds + 1}: Pet HP=${pet.health}, Enemy HP=${pet.currentEnemy.hp}`);
      }
      rounds++;
    }
    
    if (!pet.inBattle) {
      console.log('✓ Battle ended');
      console.log(`  Final pet health: ${pet.health}`);
      console.log(`  XP gained: ${pet.battleLog.length > 0 ? 'yes' : 'no'}`);
    } else {
      console.warn('✗ Battle did not end after 20 rounds');
    }
  } else {
    console.warn('✗ Failed to start battle');
  }
}

export async function testDefeat() {
  console.log('=== TEST: Defeat Scenario ===');
  const pet = new Pet();
  pet.hunger = 80;  // very hungry
  pet.energy = 10;  // very tired
  pet.health = 20;  // low health
  pet.happiness = 20; // unhappy
  
  if (pet.startBattle()) {
    console.log(`Started battle against ${pet.currentEnemy.name}`);
    
    // Simulate mostly defending/fleeing (not attacking much)
    let rounds = 0;
    while (pet.inBattle && rounds < 30) {
      if (rounds % 2 === 0) {
        pet.defend();
      } else {
        pet.attack();
      }
      if (pet.inBattle) {
        console.log(`Round ${rounds + 1}: Pet HP=${pet.health}, Enemy HP=${pet.currentEnemy.hp}`);
      }
      rounds++;
    }
    
    if (!pet.inBattle) {
      console.log('✓ Battle ended');
      console.log(`  Final pet health: ${pet.health}`);
      if (pet.form === 'dead') {
        console.log('  ⚠ Pet died during battle');
      }
    } else {
      console.warn('✗ Battle did not end after 30 rounds');
    }
  } else {
    console.warn('✗ Failed to start battle');
  }
}

export async function testFlee() {
  console.log('=== TEST: Flee Scenario ===');
  const pet = new Pet();
  pet.hunger = 50;
  pet.energy = 60;
  pet.health = 80;
  pet.happiness = 70;
  
  if (pet.startBattle()) {
    console.log(`Started battle against ${pet.currentEnemy.name}`);
    console.log('Attempting to flee...');
    
    pet.flee();
    
    if (!pet.inBattle) {
      console.log('✓ Successfully fled the battle');
    } else {
      console.log('~ Flee attempt failed, still in battle');
      pet.flee();
    }
  } else {
    console.warn('✗ Failed to start battle');
  }
}

export async function testTraining() {
  console.log('=== TEST: Training System ===');
  const pet = new Pet();
  
  console.log(`Initial training state:`, pet.training);
  
  // Train strength multiple times
  for (let i = 0; i < 5; i++) {
    if (pet.trainAbility('strength')) {
      console.log(`✓ Strength training ${i + 1}: XP=${pet.training.strength.xp}, Level=${pet.training.strength.level}`);
    }
  }
  
  // Train other abilities once
  pet.trainAbility('speed');
  pet.trainAbility('defense');
  pet.trainAbility('intelligence');
  
  console.log('Final training state:', pet.training);
}

export async function testEvolution() {
  console.log('=== TEST: Evolution System ===');
  const pet = new Pet();
  
  console.log(`Starting form: ${pet.form}`);
  
  // Simulate wellness progression
  pet.hunger = 10;
  pet.energy = 95;
  pet.health = 95;
  
  // Simulate passage of time by calling tick
  for (let i = 0; i < 15; i++) {
    pet.tick('idle', 10); // 10 seconds per tick
    console.log(`Tick ${i + 1}: Form=${pet.form}, Wellness Timer (70%)=${pet._wellness70Timer}`);
    if (pet.evolving) {
      console.log(`  → Evolving! Start=${pet.evolveStart}, Duration=${pet.evolveDuration}`);
    }
  }
  
  console.log(`Final form: ${pet.form}`);
}

export async function runAllTests() {
  console.clear();
  console.log('%c=== vPet2 Battle System Test Suite ===', 'font-size:14px;font-weight:bold;color:#7dd3fc');
  
  try {
    await testVictory();
    console.log('');
    await testDefeat();
    console.log('');
    await testFlee();
    console.log('');
    await testTraining();
    console.log('');
    await testEvolution();
  } catch (e) {
    console.error('Test suite error:', e);
  }
  
  console.log('%c=== Tests Complete ===', 'font-size:12px;color:#7ef0c7');
}

// Auto-run tests if this module is loaded directly
if (import.meta.url === `file://${new URL(import.meta.url).pathname}`) {
  runAllTests();
}
