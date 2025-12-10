# Shop & Inventory System Implementation

## Overview
A complete shop and inventory system has been added to vPet2, allowing players to earn coins through battles, purchase items from a shop, and use items to gain various benefits.

## Features Implemented

### 1. **Inventory System**
- Pet now has an inventory object tracking quantities of 17 different item types
- Inventory persists to localStorage
- Accessible via "Inventory" button in the UI
- Shows all owned items with:
  - Item emoji/icon
  - Item name
  - Quantity owned
  - Item description
  - "Use Item" button

### 2. **Shop System**
- 17 purchasable items across 5 categories
- Shop is accessed via "Shop" button
- Auto-freezes pet when shop is open (preserves manual freeze state)
- Grid layout displaying all items with:
  - Item emoji/icon
  - Item name
  - Description
  - Cost in coins
  - "Buy" button (disabled if player can't afford)
- Real-time coin display

### 3. **Coin Economy**
- Coins earned from battle victories
- Formula: `10 + (enemyLevel × 8) + random(0-10)` base
- Doubled when Coin Multiplier item is active
- Displayed in both shop and inventory modals
- Persisted to localStorage

### 4. **Item Categories & Types**

#### A. Consumables (Used Once)
1. **Treat** (🍖) - Cost: 50 coins
   - Reduces hunger by 20
   
2. **Energy Drink** (⚡) - Cost: 80 coins
   - Restores 30 energy
   
3. **Medicine** (💊) - Cost: 100 coins
   - Restores 40 health
   
4. **Rare Candy** (✨) - Cost: 150 coins
   - Gains 20 XP in random skill
   
5. **Happiness Potion** (💜) - Cost: 120 coins
   - Boosts happiness by 25

#### B. Stat Boosters (Temporary Effects)
1. **Training Powder** (💪) - Cost: 200 coins
   - Double XP for 60 seconds
   - Expires after duration
   
2. **XP Boost Orb** (🌟) - Cost: 220 coins
   - Triple XP for 120 seconds
   - Expires after duration
   
3. **Battle Stimulant** (🔥) - Cost: 180 coins
   - Boost battle damage for 45 seconds
   
4. **Focus Tea** (🍵) - Cost: 160 coins
   - Increase accuracy for 30 seconds

#### C. Permanent Upgrades (One-Time Purchase)
1. **Stat Boost Kit** (📈) - Cost: 300 coins
   - Permanently boost all stats by 10%
   - Can only be purchased once
   
2. **Evolution Accelerator** (🚀) - Cost: 250 coins
   - Reduce evolution time by 30%
   
3. **Piggy Bank** (🏦) - Cost: 500 coins
   - Passive income: gain 1 coin every 5 seconds
   - Persists even when frozen
   
4. **Coin Multiplier** (💰) - Cost: 400 coins
   - Double coins from battle victories

#### D. Cosmetics (Non-Functional)
1. **Custom Skin** (🎨) - Cost: 200 coins
   - Customize pet appearance (placeholder)
   
2. **Name Change** (📝) - Cost: 100 coins
   - Rename your pet (placeholder)
   
3. **Battle FX Pack** (✨) - Cost: 150 coins
   - Add visual effects to battles (placeholder)

#### E. Strategic Items
1. **Quick Revive** (💉) - Cost: 350 coins
   - Revive pet at 50% health when KO'd (placeholder for battle system integration)

### 5. **Item Usage System**
- Consumable items reduce quantity by 1 when used
- Temporary boosters activate effects and expire based on timer
- Permanent upgrades can only be purchased once
- Item effects update pet stats and persist to localStorage
- Error handling prevents using items when unavailable or conditions aren't met

### 6. **XP Multiplier Integration**
- Training Powder: 2× XP
- XP Boost Orb: 3× XP
- Can be stacked (e.g., both active = 6× XP)
- Applied to skill training in battles
- Displays multiplied XP in battle log and action messages

### 7. **Coin Multiplier Integration**
- Coin Multiplier item: 2× coins from battle victories
- Applied to battle victory coin drops
- Multiplied amount shown in messages

### 8. **Passive Income System**
- Piggy Bank item: generates 1 coin every 5 seconds
- Ticks every 5 seconds in main game loop
- Stops when pet is frozen
- Persists across browser sessions via localStorage

## Technical Implementation

### Pet Class (src/pet.js)
- **New Properties:**
  - `inventory`: Object tracking item quantities
  - `coins`: Number of coins owned
  - `passiveIncomeActive`: Boolean flag for piggy bank
  - `trainingPowderActive`, `trainingPowderExpiry`: Temporary XP boost
  - `xpBoostActive`, `xpBoostExpiry`: Temporary XP boost
  - `coinMultiplierActive`: Boolean flag for coin multiplier
  - `statBoostKitPurchased`: Boolean flag for stat kit

- **New Methods:**
  - `static getItemDefinitions()`: Returns all item data
  - `useItem(itemId)`: Applies item effects, deducts from inventory
  - `tickPassiveIncome()`: Called every 5 seconds to add coins
  - `checkExpiredBoosters()`: Clears expired temporary effects
  - `getXpMultiplier()`: Returns current XP multiplier (1-6×)
  - `getCoinMultiplier()`: Returns current coin multiplier (1-2×)

- **Updated Methods:**
  - `saveState()` / `loadState()`: Persist all item-related data
  - `endBattle()`: Apply XP and coin multipliers to rewards

### Main UI (src/main.js)
- **New Functions:**
  - `updateInventoryUI()`: Renders owned items with use buttons
  - `updateShopUI()`: Renders all purchasable items with affordability
  - `window.useItemFromInventory()`: Global handler for using items
  - `window.buyItem()`: Global handler for purchasing items

- **Updated Game Loop:**
  - Added `passiveIncomeAccumulator` for 5-second passive income ticks

### HTML (index.html)
- **Inventory Modal:** 
  - Displays coin count
  - Grid/list of owned items with descriptions
  - "Use Item" buttons for each owned item

- **Shop Modal:**
  - Displays player's coin count
  - 2-column grid of all 17 purchasable items
  - Shows item cost and affordability status
  - Auto-freezes pet while open

### Styling (styles.css)
- **New Styles:**
  - `.shop-buy-btn`: Green button with hover effects
  - Shop/inventory grid layouts
  - Item card styling with emoji display

### Bundle (app.bundle.js)
- Single-file bundle created from all source files
- Removes ES6 module syntax for file:// compatibility
- Includes all item system code and UI handlers

## Data Persistence
All inventory and coin data persists to localStorage:
- `vpet2.pet` localStorage key includes:
  - `coins`: Current coin count
  - `inventory`: Object with item quantities
  - `passiveIncomeActive`: Piggy Bank status
  - `trainingPowderActive` / `trainingPowderExpiry`: XP boost status
  - `xpBoostActive` / `xpBoostExpiry`: Triple XP status
  - `coinMultiplierActive`: Coin multiplier status
  - `statBoostKitPurchased`: Stat kit purchased flag

## Game Balance

### Earning Coins
- Base battle victory: 10 + (level × 8) + random(0-10) coins
- With Coin Multiplier: × 2
- With Piggy Bank: +1 coin every 5 seconds (passive)
- Early game: ~30-60 coins per victory
- Late game: ~80-150 coins per victory

### Item Costs
- Budget items (consumables): 50-150 coins
- Mid-tier boosters: 160-220 coins
- Expensive upgrades: 250-500 coins
- Cosmetics: 100-200 coins

### Time to Earn
- Treat (50 coins): ~1-2 battles
- Piggy Bank (500 coins): ~5-10 battles or 8 minutes passive
- XP Boost Orb (220 coins): ~3-4 battles

## Testing Checklist
- [ ] Battle enemies and earn coins
- [ ] Open shop modal (pet freezes automatically)
- [ ] View all 17 items in shop
- [ ] Verify affordability disables buttons
- [ ] Purchase an item (coins deduct)
- [ ] Open inventory (see purchased item)
- [ ] Use a consumable item (quantity decreases)
- [ ] Verify item effects (hunger/energy/happiness changes)
- [ ] Test temporary boosters (Training Powder, XP Boost Orb)
- [ ] Test passive income (Piggy Bank)
- [ ] Close shop (pet unfreezes if not manually frozen)
- [ ] Restart game and verify coins/inventory persist
- [ ] Test XP multiplier in battle training
- [ ] Test coin multiplier in battle rewards
- [ ] Verify error messages for unavailable items

## Future Enhancements
- Item descriptions with more flavor text
- Animated item use effects
- Item rarity/quality tiers
- Daily deals or discounts
- Item crafting/combination system
- Limited-time event items
- NPC traders with unique items
- Item selling/trading functionality
- Quest rewards offering items
