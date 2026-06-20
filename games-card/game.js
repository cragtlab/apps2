const MAX_HAND = 7;
const MAX_ENERGY = 8;
const STARTING_HEALTH = 20;
const COMBAT_ANIMATION_MS = 360;
const COMBAT_PAUSE_MS = 170;
const SHARED_DECK_BLUEPRINT = [
  "dogmeat",
  "dogmeat",
  "piper",
  "piper",
  "nick",
  "nick",
  "curie",
  "curie",
  "boone",
  "boone",
  "soleSurvivor",
  "soleSurvivor",
  "danse",
  "danse",
  "hancock",
  "fawkes",
  "deathclaw",
  "stimpak",
  "stimpak",
  "vats",
  "vats",
  "nukaCola",
  "nukaCola",
  "radstorm",
  "miniNuke",
];

const GAME_THEMES = {
  fallout: {
    laneNames: ["Cracked Highway", "Market Square", "Vault Door"],
    cards: {
      dogmeat: {
        id: "dogmeat",
        name: "Dogmeat",
        type: "unit",
        cost: 1,
        attack: 1,
        health: 2,
        text: "Faithful scout. When this survives combat, your vault heals 1.",
        keywords: ["scout"],
      },
      piper: {
        id: "piper",
        name: "Piper Wright",
        type: "unit",
        cost: 2,
        attack: 1,
        health: 4,
        text: "Inspire: your other units gain +1 attack while Piper is in play.",
        keywords: ["inspire"],
      },
      nick: {
        id: "nick",
        name: "Nick Valentine",
        type: "unit",
        cost: 2,
        attack: 2,
        health: 3,
        text: "On play: draw 1 card.",
        keywords: ["drawOnPlay"],
      },
      curie: {
        id: "curie",
        name: "Curie",
        type: "unit",
        cost: 3,
        attack: 2,
        health: 4,
        text: "On play: heal your vault 3.",
        keywords: ["healOnPlay"],
      },
      boone: {
        id: "boone",
        name: "Boone",
        type: "unit",
        cost: 3,
        attack: 3,
        health: 2,
        text: "Sniper: attacks the weakest enemy unit in any lane first.",
        keywords: ["sniper"],
      },
      soleSurvivor: {
        id: "soleSurvivor",
        name: "Sole Survivor",
        type: "unit",
        cost: 4,
        attack: 4,
        health: 4,
        text: "If no enemy unit blocks this lane, deal +1 damage to the enemy vault.",
        keywords: ["vaultbreaker"],
      },
      danse: {
        id: "danse",
        name: "Paladin Danse",
        type: "unit",
        cost: 4,
        attack: 4,
        health: 5,
        text: "Power armor: ignore 1 damage the first time this is hit each turn.",
        keywords: ["armor1"],
      },
      hancock: {
        id: "hancock",
        name: "Hancock",
        type: "unit",
        cost: 4,
        attack: 3,
        health: 4,
        text: "On play: deal 1 damage to every other unit.",
        keywords: ["blastOnPlay"],
      },
      fawkes: {
        id: "fawkes",
        name: "Fawkes",
        type: "unit",
        cost: 5,
        attack: 5,
        health: 7,
        text: "Massive frontline bruiser with mutant-grade staying power.",
        keywords: [],
      },
      deathclaw: {
        id: "deathclaw",
        name: "Deathclaw",
        type: "unit",
        cost: 6,
        attack: 6,
        health: 6,
        text: "Frenzy: after this destroys a unit, hit the enemy vault for 2.",
        keywords: ["frenzy"],
      },
      stimpak: {
        id: "stimpak",
        name: "Stimpak",
        type: "event",
        cost: 2,
        text: "Heal your vault 4. Your most damaged ally heals 2.",
        effect: "stimpak",
      },
      vats: {
        id: "vats",
        name: "V.A.T.S. Burst",
        type: "event",
        cost: 2,
        text: "Your strongest unit gains +2 attack until end of turn and fights immediately.",
        effect: "vats",
      },
      nukaCola: {
        id: "nukaCola",
        name: "Nuka-Cola Quantum",
        type: "event",
        cost: 1,
        text: "Draw 1 card and restore 1 energy this turn.",
        effect: "nukaCola",
      },
      radstorm: {
        id: "radstorm",
        name: "Radstorm",
        type: "event",
        cost: 3,
        text: "Deal 2 damage to all units. Your vault heals 1 for each enemy KO'd.",
        effect: "radstorm",
      },
      miniNuke: {
        id: "miniNuke",
        name: "Mini Nuke",
        type: "event",
        cost: 5,
        text: "Deal 4 damage to all enemy units and 2 to the enemy vault.",
        effect: "miniNuke",
      },
    },
  },
  threeKingdoms: {
    laneNames: ["River Ford", "Central Pass", "Supply Camp"],
    cards: {
      dogmeat: {
        id: "dogmeat",
        name: "Zhao Yun",
        type: "unit",
        cost: 1,
        attack: 1,
        health: 2,
        text: "Swift vanguard. When this survives combat, your fort heals 1.",
        keywords: ["scout"],
      },
      piper: {
        id: "piper",
        name: "Liu Bei",
        type: "unit",
        cost: 2,
        attack: 1,
        health: 4,
        text: "Inspire: your other units gain +1 attack while Liu Bei is in play.",
        keywords: ["inspire"],
      },
      nick: {
        id: "nick",
        name: "Zhuge Liang",
        type: "unit",
        cost: 2,
        attack: 2,
        health: 3,
        text: "On play: draw 1 card.",
        keywords: ["drawOnPlay"],
      },
      curie: {
        id: "curie",
        name: "Hua Tuo",
        type: "unit",
        cost: 3,
        attack: 2,
        health: 4,
        text: "On play: heal your fort 3.",
        keywords: ["healOnPlay"],
      },
      boone: {
        id: "boone",
        name: "Huang Zhong",
        type: "unit",
        cost: 3,
        attack: 3,
        health: 2,
        text: "Sniper: attacks the weakest enemy unit in any lane first.",
        keywords: ["sniper"],
      },
      soleSurvivor: {
        id: "soleSurvivor",
        name: "Guan Yu",
        type: "unit",
        cost: 4,
        attack: 4,
        health: 4,
        text: "If no enemy unit blocks this lane, deal +1 damage to the enemy fort.",
        keywords: ["vaultbreaker"],
      },
      danse: {
        id: "danse",
        name: "Dian Wei",
        type: "unit",
        cost: 4,
        attack: 4,
        health: 5,
        text: "Iron guard: ignore 1 damage the first time this is hit each turn.",
        keywords: ["armor1"],
      },
      hancock: {
        id: "hancock",
        name: "Zhang Fei",
        type: "unit",
        cost: 4,
        attack: 3,
        health: 4,
        text: "On play: deal 1 damage to every other unit.",
        keywords: ["blastOnPlay"],
      },
      fawkes: {
        id: "fawkes",
        name: "Lu Bu",
        type: "unit",
        cost: 5,
        attack: 5,
        health: 7,
        text: "A brutal frontline champion with overwhelming force.",
        keywords: [],
      },
      deathclaw: {
        id: "deathclaw",
        name: "Ma Chao",
        type: "unit",
        cost: 6,
        attack: 6,
        health: 6,
        text: "Frenzy: after this destroys a unit, hit the enemy fort for 2.",
        keywords: ["frenzy"],
      },
      stimpak: {
        id: "stimpak",
        name: "Herbal Remedy",
        type: "event",
        cost: 2,
        text: "Heal your fort 4. Your most damaged ally heals 2.",
        effect: "stimpak",
      },
      vats: {
        id: "vats",
        name: "Arrow Volley",
        type: "event",
        cost: 2,
        text: "Your strongest unit gains +2 attack until end of turn and fights immediately.",
        effect: "vats",
      },
      nukaCola: {
        id: "nukaCola",
        name: "Supply Caravan",
        type: "event",
        cost: 1,
        text: "Draw 1 card and restore 1 energy this turn.",
        effect: "nukaCola",
      },
      radstorm: {
        id: "radstorm",
        name: "Fire Attack",
        type: "event",
        cost: 3,
        text: "Deal 2 damage to all units. Your fort heals 1 for each enemy KO'd.",
        effect: "radstorm",
      },
      miniNuke: {
        id: "miniNuke",
        name: "Trebuchet Barrage",
        type: "event",
        cost: 5,
        text: "Deal 4 damage to all enemy units and 2 to the enemy fort.",
        effect: "miniNuke",
      },
    },
  },
};

const elements = {
  lanes: document.getElementById("lanes"),
  playerHand: document.getElementById("player-hand-cards"),
  log: document.getElementById("log"),
  cardDetail: document.getElementById("card-detail"),
  playerHealth: document.getElementById("player-health"),
  aiHealth: document.getElementById("ai-health"),
  playerEnergy: document.getElementById("player-energy"),
  aiEnergy: document.getElementById("ai-energy"),
  playerDeck: document.getElementById("player-deck"),
  aiDeck: document.getElementById("ai-deck"),
  playerHandCount: document.getElementById("player-hand"),
  aiHandCount: document.getElementById("ai-hand"),
  playerStatus: document.getElementById("player-status-text"),
  aiStatus: document.getElementById("ai-status-text"),
  selectedCard: document.getElementById("selected-card-label"),
  selectedActionBtn: document.getElementById("selected-action-btn"),
  endTurnBtn: document.getElementById("end-turn-btn"),
  restartBtn: document.getElementById("restart-btn"),
  themeSelect: document.getElementById("theme-select"),
  testModeBtn: document.getElementById("test-mode-btn"),
  enemyStrip: document.querySelector(".enemy-strip"),
  playerStrip: document.querySelector(".player-strip"),
};

let state = {};

function getThemeConfig(themeKey = state.themeKey ?? elements.themeSelect?.value ?? "fallout") {
  return GAME_THEMES[themeKey] ?? GAME_THEMES.fallout;
}

function getLaneNames() {
  return getThemeConfig().laneNames;
}

function getStrongholdName(themeKey = state.themeKey ?? elements.themeSelect?.value ?? "fallout") {
  return themeKey === "threeKingdoms" ? "fort" : "vault";
}

function createCardInstance(cardId, themeKey) {
  const template = getThemeConfig(themeKey).cards[cardId];
  const keywords = structuredClone(template.keywords ?? []);
  return {
    uid: `${cardId}-${Math.random().toString(36).slice(2, 10)}`,
    ...structuredClone(template),
    keywords,
    currentHealth: template.health ?? null,
    attackBuff: 0,
    shieldReady: keywords.includes("armor1"),
    exhausted: true,
  };
}

function shuffle(array) {
  const clone = [...array];
  for (let i = clone.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [clone[i], clone[j]] = [clone[j], clone[i]];
  }
  return clone;
}

function createPlayer(name, isAI, themeKey) {
  return {
    name,
    isAI,
    health: STARTING_HEALTH,
    maxEnergy: 0,
    energy: 0,
    deck: shuffle(SHARED_DECK_BLUEPRINT).map((cardId) => createCardInstance(cardId, themeKey)),
    hand: [],
    board: [null, null, null],
    temporaryAttackBuffs: {},
    playedCards: {},
  };
}

function clearAutoEndTimer() {
  if (state.autoEndTimer) {
    window.clearTimeout(state.autoEndTimer);
    state.autoEndTimer = null;
  }
}

function resetGame(themeKey = elements.themeSelect?.value ?? state.themeKey ?? "fallout") {
  clearAutoEndTimer();
  if (elements.themeSelect) {
    elements.themeSelect.value = themeKey;
  }
  state = {
    themeKey,
    turn: 1,
    phase: "player",
    selectedCardUid: null,
    gameOver: false,
    resolving: false,
    animation: null,
    autoEndTimer: null,
    testing: false,
    testReport: null,
    player: createPlayer("Commander", false, themeKey),
    ai: createPlayer("Enemy", true, themeKey),
    logEntries: [],
  };

  for (let i = 0; i < 4; i += 1) {
    drawCard(state.player);
    drawCard(state.ai);
  }

  startTurn(state.player);
  logMessage(`The battle begins. Your ${getStrongholdName()} moves first.`, "Turn 1");
  render();
}

function drawCard(player, amount = 1) {
  let drawn = 0;
  for (let i = 0; i < amount; i += 1) {
    if (!player.deck.length || player.hand.length >= MAX_HAND) {
      break;
    }
    player.hand.push(player.deck.shift());
    drawn += 1;
  }
  return drawn;
}

function startTurn(player) {
  const opponent = getOpponent(player);
  player.maxEnergy = Math.min(MAX_ENERGY, player.maxEnergy + 1);
  player.energy = player.maxEnergy;
  drawCard(player, 1);
  player.board.forEach((unit) => {
    if (!unit) {
      return;
    }
    unit.exhausted = false;
    if (unit.keywords.includes("armor1")) {
      unit.shieldReady = true;
    }
  });
  player.temporaryAttackBuffs = {};
  if (player.isAI) {
    elements.aiStatus.textContent = "Planning.";
    elements.playerStatus.textContent = "Enemy turn.";
  } else {
    elements.playerStatus.textContent = "Your move.";
    elements.aiStatus.textContent = "Waiting.";
  }
}

function getOpponent(player) {
  return player === state.player ? state.ai : state.player;
}

function getPlayerKey(player) {
  return player === state.player ? "player" : "ai";
}

function logMessage(text, turnLabel = `Turn ${state.turn}`) {
  state.logEntries.unshift({ turnLabel, text });
  state.logEntries = state.logEntries.slice(0, 10);
}

function totalAttack(unit, owner) {
  const laneIndex = owner.board.findIndex((candidate) => candidate?.uid === unit.uid);
  const piperBonus = owner.board.some(
    (candidate) => candidate && candidate.uid !== unit.uid && candidate.id === "piper"
  )
    ? 1
    : 0;
  const tempBuff = owner.temporaryAttackBuffs[unit.uid] ?? 0;
  const laneBonus = laneIndex === -1 ? 0 : 0;
  return unit.attack + unit.attackBuff + piperBonus + tempBuff + laneBonus;
}

function healPlayer(player, amount) {
  const oldHealth = player.health;
  player.health = Math.min(STARTING_HEALTH, player.health + amount);
  return player.health - oldHealth;
}

function damageUnit(target, amount, context = {}) {
  if (!target || amount <= 0) {
    return { died: false, damageApplied: 0 };
  }

  let actualDamage = amount;
  if (target.keywords.includes("armor1") && target.shieldReady) {
    actualDamage = Math.max(0, actualDamage - 1);
    target.shieldReady = false;
  }

  target.currentHealth -= actualDamage;
  const died = target.currentHealth <= 0;
  if (died) {
    removeUnitByUid(target.uid);
    if (context.attacker?.keywords.includes("frenzy")) {
      const enemy = getOpponent(context.owner);
      enemy.health -= 2;
      logMessage(`${context.attacker.name} tears through the wreckage and deals 2 to ${enemy.name}'s ${getStrongholdName()}.`);
    }
  }

  return { died, damageApplied: actualDamage };
}

function removeUnitByUid(uid) {
  [state.player, state.ai].forEach((player) => {
    const index = player.board.findIndex((unit) => unit?.uid === uid);
    if (index !== -1) {
      player.board[index] = null;
    }
  });
}

function playCard(player, cardUid, laneIndex = null, options = {}) {
  const allowDuringResolve = options.allowDuringResolve ?? player.isAI;
  if (state.gameOver || (state.resolving && !allowDuringResolve)) {
    return false;
  }

  const cardIndex = player.hand.findIndex((card) => card.uid === cardUid);
  const card = player.hand[cardIndex];
  if (!card || card.cost > player.energy) {
    return false;
  }

  if (card.type === "unit" && (laneIndex === null || player.board[laneIndex])) {
    return false;
  }

  player.energy -= card.cost;
  player.hand.splice(cardIndex, 1);

  if (card.type === "unit") {
    player.board[laneIndex] = card;
    logMessage(`${player.name} deploys ${card.name} to ${getLaneNames()[laneIndex]}.`);
    resolveOnPlayUnitEffects(player, laneIndex);
  } else {
    resolveEventCard(player, card);
  }

  state.selectedCardUid = null;
  checkGameOver();
  render();
  return true;
}

function resolveOnPlayUnitEffects(player, laneIndex) {
  const unit = player.board[laneIndex];
  if (!unit) {
    return;
  }

  if (unit.keywords.includes("drawOnPlay")) {
    const drawn = drawCard(player, 1);
    if (drawn) {
      logMessage(`${unit.name} digs up intel. ${player.name} draws a card.`);
    }
  }

  if (unit.keywords.includes("healOnPlay")) {
    const healed = healPlayer(player, 3);
    logMessage(`${unit.name} patches the ${getStrongholdName()} for ${healed} HP.`);
  }

  if (unit.keywords.includes("blastOnPlay")) {
    let hits = 0;
    [state.player, state.ai].forEach((side) => {
      side.board.forEach((otherUnit) => {
        if (!otherUnit || otherUnit.uid === unit.uid) {
          return;
        }
        damageUnit(otherUnit, 1, { owner: side });
        hits += 1;
      });
    });
    logMessage(`${unit.name} stirs the crowd and pings ${hits} units for 1.`);
  }
}

function resolveEventCard(player, card) {
  const opponent = getOpponent(player);
  logMessage(`${player.name} plays ${card.name}.`);

  if (card.effect === "stimpak") {
    const healed = healPlayer(player, 4);
    const damagedAllies = player.board.filter((unit) => unit && unit.currentHealth < unit.health);
    if (damagedAllies.length) {
      damagedAllies.sort((a, b) => (a.currentHealth - a.health) - (b.currentHealth - b.health));
      const ally = damagedAllies[0];
      ally.currentHealth = Math.min(ally.health, ally.currentHealth + 2);
      logMessage(`${card.name} restores ${healed} ${getStrongholdName()} HP and patches ${ally.name} for 2.`);
    } else {
      logMessage(`${card.name} restores ${healed} ${getStrongholdName()} HP.`);
    }
  }

  if (card.effect === "vats") {
    const unit = [...player.board].filter(Boolean).sort((a, b) => totalAttack(b, player) - totalAttack(a, player))[0];
    if (unit) {
      player.temporaryAttackBuffs[unit.uid] = (player.temporaryAttackBuffs[unit.uid] ?? 0) + 2;
      unit.exhausted = false;
      logMessage(`${unit.name} locks on with V.A.T.S. and gains +2 attack this turn.`);
      resolveUnitAttack(player, unit, true);
    } else {
      logMessage(`${card.name} fizzles because ${player.name} has no unit to target.`);
    }
  }

  if (card.effect === "nukaCola") {
    drawCard(player, 1);
    player.energy = Math.min(player.maxEnergy, player.energy + 1);
    logMessage(`${player.name} cracks open a Quantum, draws 1, and recovers 1 energy.`);
  }

  if (card.effect === "radstorm") {
    let enemyKos = 0;
    [state.player, state.ai].forEach((side) => {
      side.board.forEach((unit) => {
        if (!unit) {
          return;
        }
        const result = damageUnit(unit, 2, { owner: side });
        if (result.died && side !== player) {
          enemyKos += 1;
        }
      });
    });
    const healed = healPlayer(player, enemyKos);
    logMessage(`${card.name} rolls across the map. ${enemyKos} enemy units drop and ${player.name} heals ${healed}.`);
  }

  if (card.effect === "miniNuke") {
    opponent.health -= 2;
    opponent.board.forEach((unit) => {
      if (!unit) {
        return;
      }
      damageUnit(unit, 4, { owner: opponent });
    });
    logMessage(`${card.name} detonates for 2 ${getStrongholdName()} damage and 4 to every enemy unit.`);
  }
}

function findSniperTarget(opponent) {
  const units = opponent.board
    .map((unit, laneIndex) => ({ unit, laneIndex }))
    .filter(({ unit }) => Boolean(unit))
    .sort((a, b) => {
      const healthDiff = a.unit.currentHealth - b.unit.currentHealth;
      if (healthDiff !== 0) {
        return healthDiff;
      }
      return a.unit.cost - b.unit.cost;
    });
  return units[0] ?? null;
}

function getAttackTargetInfo(owner, unit) {
  const opponent = getOpponent(owner);
  const laneIndex = owner.board.findIndex((candidate) => candidate?.uid === unit.uid);
  let targetInfo = laneIndex >= 0 ? { type: "unit", unit: opponent.board[laneIndex], laneIndex } : null;

  if (unit.keywords.includes("sniper")) {
    const sniperTarget = findSniperTarget(opponent);
    if (sniperTarget) {
      targetInfo = { type: "unit", unit: sniperTarget.unit, laneIndex: sniperTarget.laneIndex };
    }
  }

  if (targetInfo?.unit) {
    return targetInfo;
  }

  return { type: "vault", playerKey: getPlayerKey(opponent), laneIndex };
}

function resolveUnitAttack(owner, unit, immediate = false) {
  if (!unit || state.gameOver) {
    return;
  }

  if (!immediate && unit.exhausted) {
    return;
  }

  const opponent = getOpponent(owner);
  const unitAttack = totalAttack(unit, owner);
  const targetInfo = getAttackTargetInfo(owner, unit);

  if (targetInfo.type === "unit" && targetInfo.unit) {
    const defender = targetInfo.unit;
    const defenderAttack = totalAttack(defender, opponent);
    const dealt = damageUnit(defender, unitAttack, { attacker: unit, owner });
    const returned = damageUnit(unit, defenderAttack, { attacker: defender, owner: opponent });
    logMessage(
      `${unit.name} hits ${defender.name} for ${dealt.damageApplied}. ${defender.name} returns ${returned.damageApplied}.`
    );
  } else {
    const bonus = unit.keywords.includes("vaultbreaker") ? 1 : 0;
    const totalDamage = unitAttack + bonus;
    opponent.health -= totalDamage;
    logMessage(`${unit.name} breaks through and slams the ${getStrongholdName()} for ${totalDamage}.`);
  }

  const survivedCombat = owner.board.some((candidate) => candidate?.uid === unit.uid);
  if (unit.id === "dogmeat" && survivedCombat) {
    const healed = healPlayer(owner, 1);
    if (healed) {
      logMessage(`${unit.name} finds supplies and heals ${owner.name}'s ${getStrongholdName()} for 1.`);
    }
  }

  unit.exhausted = true;
  checkGameOver();
}

function setCombatAnimation(animation) {
  state.animation = animation;
  render();
}

function clearCombatAnimation() {
  state.animation = null;
  render();
}

function resolveCombatPhase(player, onComplete = () => {}) {
  const units = [...player.board].filter(Boolean);
  let index = 0;

  const next = () => {
    if (state.gameOver || index >= units.length) {
      player.temporaryAttackBuffs = {};
      clearCombatAnimation();
      onComplete();
      return;
    }

    const unit = units[index];
    index += 1;
    if (!player.board.some((candidate) => candidate?.uid === unit.uid)) {
      next();
      return;
    }

    const targetInfo = getAttackTargetInfo(player, unit);
    setCombatAnimation({
      attackerUid: unit.uid,
      targetUid: targetInfo.type === "unit" ? targetInfo.unit?.uid ?? null : null,
      targetPlayerKey: targetInfo.type === "vault" ? targetInfo.playerKey : null,
    });

    window.setTimeout(() => {
      if (player.board.some((candidate) => candidate?.uid === unit.uid)) {
        resolveUnitAttack(player, unit);
      }
      render();
      window.setTimeout(next, COMBAT_PAUSE_MS);
    }, COMBAT_ANIMATION_MS);
  };

  next();
}

function endPlayerTurn() {
  if (state.phase !== "player" || state.gameOver || state.resolving) {
    return;
  }

  clearAutoEndTimer();
  state.resolving = true;
  elements.playerStatus.textContent = "Attacking.";
  resolveCombatPhase(state.player, () => {
    if (checkGameOver()) {
      state.resolving = false;
      render();
      return;
    }

    state.phase = "ai";
    render();
    window.setTimeout(runAiTurn, 420);
  });
}

function evaluateCardPlay(card, player) {
  const opponent = getOpponent(player);
  if (card.type === "unit") {
    const openLanes = player.board
      .map((unit, laneIndex) => ({ unit, laneIndex }))
      .filter(({ unit }) => !unit);
    if (!openLanes.length) {
      return null;
    }

    let bestLane = openLanes[0].laneIndex;
    let bestScore = -Infinity;
    openLanes.forEach(({ laneIndex }) => {
      const enemyUnit = opponent.board[laneIndex];
      let score = card.attack + card.health - card.cost;
      if (!enemyUnit) {
        score += 2;
      } else {
        score += card.attack - enemyUnit.currentHealth;
      }
      if (card.keywords.includes("healOnPlay") && player.health <= 12) {
        score += 3;
      }
      if (card.keywords.includes("drawOnPlay")) {
        score += 1.5;
      }
      if (card.id === "soleSurvivor" && !enemyUnit) {
        score += 2;
      }
      if (score > bestScore) {
        bestScore = score;
        bestLane = laneIndex;
      }
    });
    return { laneIndex: bestLane, score: bestScore };
  }

  let score = 0;
  if (card.effect === "miniNuke") {
    const enemyUnits = opponent.board.filter(Boolean).length;
    score = enemyUnits * 2.6 + (STARTING_HEALTH - opponent.health > 0 ? 1 : 0);
  }
  if (card.effect === "radstorm") {
    const enemyUnits = opponent.board.filter(Boolean).length;
    const ownUnits = player.board.filter(Boolean).length;
    score = enemyUnits * 1.8 - ownUnits * 0.9;
  }
  if (card.effect === "stimpak") {
    score = (STARTING_HEALTH - player.health) * 0.9;
  }
  if (card.effect === "vats") {
    score = player.board.filter(Boolean).length ? 3.2 : -5;
  }
  if (card.effect === "nukaCola") {
    score = player.hand.length < MAX_HAND ? 1.7 : 0.5;
  }
  return { laneIndex: null, score };
}

function runAiTurn() {
  if (state.gameOver) {
    state.resolving = false;
    render();
    return;
  }

  clearAutoEndTimer();
  startTurn(state.ai);
  logMessage("Enemy turn.");
  render();

  let safetyCounter = 0;
  while (safetyCounter < 10) {
    safetyCounter += 1;
    const options = state.ai.hand
      .filter((card) => card.cost <= state.ai.energy)
      .map((card) => ({ card, play: evaluateCardPlay(card, state.ai) }))
      .filter(({ play }) => play && play.score > 0.4)
      .sort((a, b) => b.play.score - a.play.score);

    if (!options.length) {
      break;
    }

    const best = options[0];
    playCard(state.ai, best.card.uid, best.play.laneIndex, { allowDuringResolve: true });
    if (state.gameOver) {
      break;
    }
  }

  if (!state.gameOver) {
    elements.aiStatus.textContent = "Attacking.";
    resolveCombatPhase(state.ai, () => {
      if (!checkGameOver()) {
        state.turn += 1;
        state.phase = "player";
        startTurn(state.player);
        elements.playerStatus.textContent = "Your move.";
      }

      state.resolving = false;
      render();
    });
    return;
  }

  state.resolving = false;
  render();
}

function checkGameOver() {
  if (state.player.health <= 0 || state.ai.health <= 0) {
    state.gameOver = true;
    state.player.health = Math.max(0, state.player.health);
    state.ai.health = Math.max(0, state.ai.health);
    const result =
      state.player.health === state.ai.health
        ? `Both ${getStrongholdName()}s collapse. It's a draw.`
        : state.player.health > state.ai.health
          ? `You hold the line. Your ${getStrongholdName()} survives.`
          : `The enemy breaches your ${getStrongholdName()}. Run it back.`;
    logMessage(result, "Final");
    elements.playerStatus.textContent = result;
    elements.aiStatus.textContent = result;
    return true;
  }
  return false;
}

function describeTags(unit) {
  const tags = [];
  if (unit.keywords.includes("sniper")) {
    tags.push("Sniper");
  }
  if (unit.keywords.includes("armor1")) {
    tags.push(unit.shieldReady ? "Armor Ready" : "Armor Spent");
  }
  if (unit.keywords.includes("vaultbreaker")) {
    tags.push(getStrongholdName() === "fort" ? "Fortbreaker" : "Vaultbreaker");
  }
  if (unit.keywords.includes("frenzy")) {
    tags.push("Frenzy");
  }
  if (unit.id === "piper") {
    tags.push("Inspire");
  }
  if (unit.id === "dogmeat") {
    tags.push("Scavenge");
  }
  return tags.join(" | ");
}

function getSelectedCard() {
  return state.player.hand.find((card) => card.uid === state.selectedCardUid) ?? null;
}

function canPlayerAct() {
  return state.phase === "player" && !state.gameOver && !state.resolving && !state.testing;
}

function hasOpenLane(player) {
  return player.board.some((unit) => !unit);
}

function hasPlayableCard(player) {
  const openLane = hasOpenLane(player);
  return player.hand.some((card) => {
    if (card.cost > player.energy) {
      return false;
    }
    if (card.type === "event") {
      return true;
    }
    return openLane;
  });
}

function queueAutoEndIfNeeded() {
  if (state.testing) {
    clearAutoEndTimer();
    return;
  }

  if (!canPlayerAct()) {
    clearAutoEndTimer();
    return;
  }

  if (hasPlayableCard(state.player)) {
    clearAutoEndTimer();
    return;
  }

  if (state.autoEndTimer) {
    return;
  }

  elements.playerStatus.textContent = "No plays. Auto ending.";
  state.autoEndTimer = window.setTimeout(() => {
    state.autoEndTimer = null;
    if (canPlayerAct() && !hasPlayableCard(state.player)) {
      endPlayerTurn();
    }
  }, 700);
}

function incrementCount(counter, cardId, amount = 1) {
  counter[cardId] = (counter[cardId] ?? 0) + amount;
}

function getOpponentSim(sim, player) {
  return player === sim.player ? sim.ai : sim.player;
}

function getPlayerKeySim(sim, player) {
  return player === sim.player ? "player" : "ai";
}

function startTurnSim(player) {
  player.maxEnergy = Math.min(MAX_ENERGY, player.maxEnergy + 1);
  player.energy = player.maxEnergy;
  drawCard(player, 1);
  player.board.forEach((unit) => {
    if (!unit) {
      return;
    }
    unit.exhausted = false;
    if (unit.keywords.includes("armor1")) {
      unit.shieldReady = true;
    }
  });
  player.temporaryAttackBuffs = {};
}

function removeUnitByUidSim(sim, uid) {
  [sim.player, sim.ai].forEach((player) => {
    const index = player.board.findIndex((unit) => unit?.uid === uid);
    if (index !== -1) {
      player.board[index] = null;
    }
  });
}

function damageUnitSim(sim, target, amount, context = {}) {
  if (!target || amount <= 0) {
    return { died: false, damageApplied: 0 };
  }

  let actualDamage = amount;
  if (target.keywords.includes("armor1") && target.shieldReady) {
    actualDamage = Math.max(0, actualDamage - 1);
    target.shieldReady = false;
  }

  target.currentHealth -= actualDamage;
  const died = target.currentHealth <= 0;
  if (died) {
    removeUnitByUidSim(sim, target.uid);
    if (context.attacker?.keywords.includes("frenzy")) {
      const enemy = getOpponentSim(sim, context.owner);
      enemy.health -= 2;
    }
  }

  return { died, damageApplied: actualDamage };
}

function getAttackTargetInfoSim(sim, owner, unit) {
  const opponent = getOpponentSim(sim, owner);
  const laneIndex = owner.board.findIndex((candidate) => candidate?.uid === unit.uid);
  let targetInfo = laneIndex >= 0 ? { type: "unit", unit: opponent.board[laneIndex], laneIndex } : null;

  if (unit.keywords.includes("sniper")) {
    const sniperTarget = findSniperTarget(opponent);
    if (sniperTarget) {
      targetInfo = { type: "unit", unit: sniperTarget.unit, laneIndex: sniperTarget.laneIndex };
    }
  }

  if (targetInfo?.unit) {
    return targetInfo;
  }

  return { type: "vault", playerKey: getPlayerKeySim(sim, opponent), laneIndex };
}

function resolveUnitAttackSim(sim, owner, unit, immediate = false) {
  if (!unit) {
    return;
  }

  if (!immediate && unit.exhausted) {
    return;
  }

  const opponent = getOpponentSim(sim, owner);
  const unitAttack = totalAttack(unit, owner);
  const targetInfo = getAttackTargetInfoSim(sim, owner, unit);

  if (targetInfo.type === "unit" && targetInfo.unit) {
    const defender = targetInfo.unit;
    const defenderAttack = totalAttack(defender, opponent);
    damageUnitSim(sim, defender, unitAttack, { attacker: unit, owner });
    damageUnitSim(sim, unit, defenderAttack, { attacker: defender, owner: opponent });
  } else {
    const bonus = unit.keywords.includes("vaultbreaker") ? 1 : 0;
    opponent.health -= unitAttack + bonus;
  }

  const survivedCombat = owner.board.some((candidate) => candidate?.uid === unit.uid);
  if (unit.id === "dogmeat" && survivedCombat) {
    healPlayer(owner, 1);
  }

  unit.exhausted = true;
}

function resolveOnPlayUnitEffectsSim(sim, player, laneIndex) {
  const unit = player.board[laneIndex];
  if (!unit) {
    return;
  }

  if (unit.keywords.includes("drawOnPlay")) {
    drawCard(player, 1);
  }

  if (unit.keywords.includes("healOnPlay")) {
    healPlayer(player, 3);
  }

  if (unit.keywords.includes("blastOnPlay")) {
    [sim.player, sim.ai].forEach((side) => {
      side.board.forEach((otherUnit) => {
        if (!otherUnit || otherUnit.uid === unit.uid) {
          return;
        }
        damageUnitSim(sim, otherUnit, 1, { owner: side });
      });
    });
  }
}

function resolveEventCardSim(sim, player, card) {
  const opponent = getOpponentSim(sim, player);

  if (card.effect === "stimpak") {
    healPlayer(player, 4);
    const damagedAllies = player.board.filter((unit) => unit && unit.currentHealth < unit.health);
    if (damagedAllies.length) {
      damagedAllies.sort((a, b) => (a.currentHealth - a.health) - (b.currentHealth - b.health));
      const ally = damagedAllies[0];
      ally.currentHealth = Math.min(ally.health, ally.currentHealth + 2);
    }
  }

  if (card.effect === "vats") {
    const unit = [...player.board].filter(Boolean).sort((a, b) => totalAttack(b, player) - totalAttack(a, player))[0];
    if (unit) {
      player.temporaryAttackBuffs[unit.uid] = (player.temporaryAttackBuffs[unit.uid] ?? 0) + 2;
      unit.exhausted = false;
      resolveUnitAttackSim(sim, player, unit, true);
    }
  }

  if (card.effect === "nukaCola") {
    drawCard(player, 1);
    player.energy = Math.min(player.maxEnergy, player.energy + 1);
  }

  if (card.effect === "radstorm") {
    let enemyKos = 0;
    [sim.player, sim.ai].forEach((side) => {
      side.board.forEach((unit) => {
        if (!unit) {
          return;
        }
        const result = damageUnitSim(sim, unit, 2, { owner: side });
        if (result.died && side !== player) {
          enemyKos += 1;
        }
      });
    });
    healPlayer(player, enemyKos);
  }

  if (card.effect === "miniNuke") {
    opponent.health -= 2;
    opponent.board.forEach((unit) => {
      if (!unit) {
        return;
      }
      damageUnitSim(sim, unit, 4, { owner: opponent });
    });
  }
}

function playCardSim(sim, player, cardUid, laneIndex = null) {
  const cardIndex = player.hand.findIndex((card) => card.uid === cardUid);
  const card = player.hand[cardIndex];
  if (!card || card.cost > player.energy) {
    return false;
  }

  if (card.type === "unit" && (laneIndex === null || player.board[laneIndex])) {
    return false;
  }

  player.energy -= card.cost;
  player.hand.splice(cardIndex, 1);
  incrementCount(player.playedCards, card.id);

  if (card.type === "unit") {
    player.board[laneIndex] = card;
    resolveOnPlayUnitEffectsSim(sim, player, laneIndex);
  } else {
    resolveEventCardSim(sim, player, card);
  }

  return true;
}

function evaluateCardPlaySim(sim, card, player) {
  const opponent = getOpponentSim(sim, player);
  if (card.type === "unit") {
    const openLanes = player.board
      .map((unit, laneIndex) => ({ unit, laneIndex }))
      .filter(({ unit }) => !unit);
    if (!openLanes.length) {
      return null;
    }

    let bestLane = openLanes[0].laneIndex;
    let bestScore = -Infinity;
    openLanes.forEach(({ laneIndex }) => {
      const enemyUnit = opponent.board[laneIndex];
      let score = card.attack + card.health - card.cost;
      if (!enemyUnit) {
        score += 2;
      } else {
        score += card.attack - enemyUnit.currentHealth;
      }
      if (card.keywords.includes("healOnPlay") && player.health <= 12) {
        score += 3;
      }
      if (card.keywords.includes("drawOnPlay")) {
        score += 1.5;
      }
      if (card.id === "soleSurvivor" && !enemyUnit) {
        score += 2;
      }
      if (score > bestScore) {
        bestScore = score;
        bestLane = laneIndex;
      }
    });
    return { laneIndex: bestLane, score: bestScore };
  }

  let score = 0;
  if (card.effect === "miniNuke") {
    const enemyUnits = opponent.board.filter(Boolean).length;
    score = enemyUnits * 2.6 + (STARTING_HEALTH - opponent.health > 0 ? 1 : 0);
  }
  if (card.effect === "radstorm") {
    const enemyUnits = opponent.board.filter(Boolean).length;
    const ownUnits = player.board.filter(Boolean).length;
    score = enemyUnits * 1.8 - ownUnits * 0.9;
  }
  if (card.effect === "stimpak") {
    score = (STARTING_HEALTH - player.health) * 0.9;
  }
  if (card.effect === "vats") {
    score = player.board.filter(Boolean).length ? 3.2 : -5;
  }
  if (card.effect === "nukaCola") {
    score = player.hand.length < MAX_HAND ? 1.7 : 0.5;
  }
  return { laneIndex: null, score };
}

function resolveCombatPhaseSim(sim, player) {
  const units = [...player.board].filter(Boolean);
  units.forEach((unit) => {
    if (player.board.some((candidate) => candidate?.uid === unit.uid)) {
      resolveUnitAttackSim(sim, player, unit);
    }
  });
  player.temporaryAttackBuffs = {};
}

function checkGameOverSim(sim) {
  if (sim.player.health <= 0 || sim.ai.health <= 0) {
    sim.player.health = Math.max(0, sim.player.health);
    sim.ai.health = Math.max(0, sim.ai.health);
    if (sim.player.health === sim.ai.health) {
      return "draw";
    }
    return sim.player.health > sim.ai.health ? "player" : "ai";
  }
  return null;
}

function runAiTurnSim(sim, player) {
  let safetyCounter = 0;
  while (safetyCounter < 10) {
    safetyCounter += 1;
    const options = player.hand
      .filter((card) => card.cost <= player.energy)
      .map((card) => ({ card, play: evaluateCardPlaySim(sim, card, player) }))
      .filter(({ play }) => play && play.score > 0.4)
      .sort((a, b) => b.play.score - a.play.score);

    if (!options.length) {
      break;
    }

    const best = options[0];
    playCardSim(sim, player, best.card.uid, best.play.laneIndex);
    if (checkGameOverSim(sim)) {
      return;
    }
  }

  resolveCombatPhaseSim(sim, player);
}

function simulateGame(themeKey) {
  const sim = {
    themeKey,
    turn: 1,
    phase: "player",
    player: createPlayer("Commander", false, themeKey),
    ai: createPlayer("Enemy", true, themeKey),
  };

  for (let i = 0; i < 4; i += 1) {
    drawCard(sim.player);
    drawCard(sim.ai);
  }

  startTurnSim(sim.player);
  const turnLimit = 60;

  while (sim.turn <= turnLimit) {
    const current = sim.phase === "player" ? sim.player : sim.ai;
    runAiTurnSim(sim, current);
    const winner = checkGameOverSim(sim);
    if (winner) {
      return {
        winner,
        winnerCards: winner === "player" ? sim.player.playedCards : sim.ai.playedCards,
        loserCards: winner === "player" ? sim.ai.playedCards : sim.player.playedCards,
      };
    }

    if (sim.phase === "player") {
      sim.phase = "ai";
      startTurnSim(sim.ai);
    } else {
      sim.turn += 1;
      sim.phase = "player";
      startTurnSim(sim.player);
    }
  }

  const healthWinner =
    sim.player.health === sim.ai.health ? "draw" : sim.player.health > sim.ai.health ? "player" : "ai";

  return {
    winner: healthWinner,
    winnerCards: healthWinner === "player" ? sim.player.playedCards : sim.ai.playedCards,
    loserCards: healthWinner === "player" ? sim.ai.playedCards : sim.player.playedCards,
  };
}

function formatTopCardList(counter, themeKey, limit = 5) {
  return Object.entries(counter)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([cardId, count]) => `${getThemeConfig(themeKey).cards[cardId].name} ${count}`);
}

function getSkewLeaders(winnerCounts, loserCounts, themeKey, direction = "strong", limit = 5) {
  return Object.keys(getThemeConfig(themeKey).cards)
    .map((cardId) => {
      const wins = winnerCounts[cardId] ?? 0;
      const losses = loserCounts[cardId] ?? 0;
      const total = wins + losses;
      return {
        cardId,
        wins,
        losses,
        total,
        share: total ? wins / total : 0,
      };
    })
    .filter((entry) => entry.total >= 20)
    .sort((a, b) => (direction === "strong" ? b.share - a.share : a.share - b.share))
    .slice(0, limit)
    .map((entry) => {
      const name = getThemeConfig(themeKey).cards[entry.cardId].name;
      return `${name} ${Math.round(entry.share * 100)}% win share`;
    });
}

function createTestReport(themeKey, rounds, results) {
  const themeLabel = themeKey === "threeKingdoms" ? "Three Kingdoms" : "Fallout";
  const winnerTop = formatTopCardList(results.winnerCounts, themeKey);
  const loserTop = formatTopCardList(results.loserCounts, themeKey);
  const strongTop = getSkewLeaders(results.winnerCounts, results.loserCounts, themeKey, "strong");
  const weakTop = getSkewLeaders(results.winnerCounts, results.loserCounts, themeKey, "weak");
  const copyText = [
    `Balance Test - ${themeLabel}`,
    `${rounds} AI rounds`,
    `Wins: You-side ${results.wins.player} | Enemy-side ${results.wins.ai} | Draws ${results.wins.draw}`,
    `Top 5 winner cards: ${winnerTop.join(" | ") || "n/a"}`,
    `Bottom 5 loser cards: ${loserTop.join(" | ") || "n/a"}`,
    `Top 5 strong skew: ${strongTop.join(" | ") || "n/a"}`,
    `Bottom 5 weak skew: ${weakTop.join(" | ") || "n/a"}`,
  ].join("\n");

  return {
    html: `
      <div class="detail-name">Balance Test</div>
      <span class="detail-type">${themeLabel} | ${rounds} AI rounds</span>
      <p class="report-line">Wins: You-side ${results.wins.player} | Enemy-side ${results.wins.ai} | Draws ${results.wins.draw}</p>
      <div class="report-line">Top 5 winner cards: ${winnerTop.join(" | ") || "n/a"}</div>
      <div class="report-line">Bottom 5 loser cards: ${loserTop.join(" | ") || "n/a"}</div>
      <div class="report-line">Top 5 strong skew: ${strongTop.join(" | ") || "n/a"}</div>
      <div class="report-line">Bottom 5 weak skew: ${weakTop.join(" | ") || "n/a"}</div>
    `,
    copyText,
    logEntries: [
      { turnLabel: "Test", text: `${rounds} AI rounds complete for ${themeLabel}.` },
      { turnLabel: "Wins", text: `You-side ${results.wins.player} | Enemy-side ${results.wins.ai} | Draws ${results.wins.draw}` },
      { turnLabel: "Top 5", text: winnerTop.join(" | ") || "No winner-side plays recorded." },
      { turnLabel: "Bot 5", text: loserTop.join(" | ") || "No loser-side plays recorded." },
      { turnLabel: "Skew+", text: strongTop.join(" | ") || "No strong skew found." },
      { turnLabel: "Skew-", text: weakTop.join(" | ") || "No weak skew found." },
    ],
  };
}

function runBalanceTest(rounds = 1000, themeKey = state.themeKey) {
  const winnerCounts = {};
  const loserCounts = {};
  const wins = { player: 0, ai: 0, draw: 0 };

  for (let round = 0; round < rounds; round += 1) {
    const result = simulateGame(themeKey);
    wins[result.winner] += 1;
    if (result.winner === "draw") {
      continue;
    }
    Object.entries(result.winnerCards).forEach(([cardId, count]) => incrementCount(winnerCounts, cardId, count));
    Object.entries(result.loserCards).forEach(([cardId, count]) => incrementCount(loserCounts, cardId, count));
  }

  return createTestReport(themeKey, rounds, { winnerCounts, loserCounts, wins });
}

function boardCardMarkup(card, owner) {
  const attack = card.type === "unit" ? totalAttack(card, owner) : null;
  const tagText = card.type === "unit" ? describeTags(card) : "";
  return `
    <article class="board-card ${card.type === "event" ? "event" : ""}">
      <div class="board-top">
        <div>
          <div class="board-name">${card.name}</div>
          <span class="board-type">${card.type}</span>
        </div>
        <div class="cost-badge">${card.cost}</div>
      </div>
      ${
        card.type === "unit"
          ? `<div class="board-stats">
              <div class="stat-pill attack">ATK ${attack}</div>
              <div class="stat-pill health">HP ${card.currentHealth}/${card.health}</div>
            </div>
            <div class="board-effect">${card.text}</div>
            <div class="board-tags">${tagText || "Frontline"}</div>`
          : `<div class="board-effect">${card.text}</div>`
      }
    </article>
  `;
}

function miniCardMarkup(card) {
  return `
    <article class="mini-card ${card.type === "event" ? "event" : ""}">
      <div class="mini-meta">
        <div>
          <div class="mini-name">${card.name}</div>
          <span class="mini-type">${card.type}</span>
        </div>
        <div class="mini-cost">${card.cost}</div>
      </div>
      ${
        card.type === "unit"
          ? `<div class="mini-stats">
              <div class="mini-pill attack">${card.attack}</div>
              <div class="mini-pill health">${card.health}</div>
            </div>`
          : `<div class="mini-stats">
              <div class="mini-pill">EVENT</div>
            </div>`
      }
    </article>
  `;
}

function detailMarkup(card) {
  const tagText = card.type === "unit" ? describeTags(card) : "";
  return `
    <div class="detail-name">${card.name}</div>
    <span class="detail-type">${card.type} | cost ${card.cost}</span>
    <p class="detail-text">${card.text}</p>
    ${
      card.type === "unit"
        ? `<div class="detail-stats">
            <div class="stat-pill attack">ATK ${card.attack}</div>
            <div class="stat-pill health">HP ${card.health}</div>
          </div>
          <div class="detail-tags">${tagText || "No tags"}</div>`
        : ""
    }
  `;
}

function renderLanes() {
  const selectedCard = getSelectedCard();
  const animation = state.animation;
  elements.lanes.innerHTML = getLaneNames().map((laneName, laneIndex) => {
    const playerUnit = state.player.board[laneIndex];
    const aiUnit = state.ai.board[laneIndex];
    const canDropHere =
      canPlayerAct() &&
      selectedCard &&
      selectedCard.type === "unit" &&
      !state.player.board[laneIndex] &&
      selectedCard.cost <= state.player.energy;
    const enemyActiveClass = [
      aiUnit?.uid === animation?.attackerUid ? "is-attacker" : "",
      aiUnit?.uid === animation?.targetUid ? "is-target" : "",
    ]
      .filter(Boolean)
      .join(" ");
    const playerActiveClass = [
      playerUnit?.uid === animation?.attackerUid ? "is-attacker" : "",
      playerUnit?.uid === animation?.targetUid ? "is-target" : "",
      canDropHere ? "deployable" : "",
      !playerUnit && !canDropHere ? "disabled" : "",
    ]
      .filter(Boolean)
      .join(" ");

    return `
      <div class="lane-column">
        <div class="lane-name">${laneName}</div>
        <div class="arena-slot enemy ${enemyActiveClass}">
          ${aiUnit ? boardCardMarkup(aiUnit, state.ai) : '<div class="slot-empty">Empty</div>'}
        </div>
        ${
          canDropHere
            ? `<button type="button" class="arena-slot player ${playerActiveClass}" data-lane="${laneIndex}">
                ${playerUnit ? boardCardMarkup(playerUnit, state.player) : '<div class="slot-empty">Deploy</div>'}
              </button>`
            : `<div class="arena-slot player ${playerActiveClass}">
                ${playerUnit ? boardCardMarkup(playerUnit, state.player) : '<div class="slot-empty">Open</div>'}
              </div>`
        }
      </div>
    `;
  }).join("");

  elements.lanes.querySelectorAll(".arena-slot.deployable").forEach((button) => {
    button.addEventListener("click", () => {
      playCard(state.player, state.selectedCardUid, Number(button.dataset.lane));
    });
  });
}

function renderHand() {
  elements.playerHand.innerHTML = state.player.hand
    .map((card, index) => {
      const isSelected = state.selectedCardUid === card.uid;
      const playable = card.cost <= state.player.energy;
      return `
        <button
          type="button"
          class="hand-card-button ${isSelected ? "selected" : ""} ${playable ? "" : "unplayable"}"
          data-card="${card.uid}"
          style="z-index:${isSelected ? 20 : index + 1}"
          ${!canPlayerAct() ? "disabled" : ""}
        >
          ${miniCardMarkup(card)}
        </button>
      `;
    })
    .join("");

  elements.playerHand.querySelectorAll(".hand-card-button").forEach((button) => {
    button.addEventListener("click", () => {
      const card = state.player.hand.find((item) => item.uid === button.dataset.card);
      if (!card) {
        return;
      }
      state.selectedCardUid = state.selectedCardUid === card.uid ? null : card.uid;
      if (state.selectedCardUid) {
        elements.playerStatus.textContent = card.type === "event" ? "Ready event." : "Pick a lane.";
      } else {
        elements.playerStatus.textContent = "Select a card.";
      }
      render();
    });
  });
}

function renderDetail() {
  const selectedCard = getSelectedCard();
  elements.selectedCard.textContent = selectedCard ? selectedCard.name : "None";

  if (!selectedCard) {
    if (state.testReport) {
      elements.cardDetail.className = "detail-card";
      elements.cardDetail.innerHTML = state.testReport.html;
      elements.selectedActionBtn.disabled = true;
      elements.selectedActionBtn.textContent = state.testing ? "Testing..." : "Report Ready";
      return;
    }
    elements.cardDetail.className = "detail-card empty";
    elements.cardDetail.textContent = "Pick a card from your hand.";
    elements.selectedActionBtn.disabled = true;
    elements.selectedActionBtn.textContent = "Choose Card";
    return;
  }

  elements.cardDetail.className = "detail-card";
  elements.cardDetail.innerHTML = detailMarkup(selectedCard);

  const enoughEnergy = selectedCard.cost <= state.player.energy;
  const openLanes = state.player.board.filter((unit) => !unit).length;

  if (!canPlayerAct()) {
    elements.selectedActionBtn.disabled = true;
    elements.selectedActionBtn.textContent = "Wait";
    return;
  }

  if (!enoughEnergy) {
    elements.selectedActionBtn.disabled = true;
    elements.selectedActionBtn.textContent = "Need Energy";
    return;
  }

  if (selectedCard.type === "event") {
    elements.selectedActionBtn.disabled = false;
    elements.selectedActionBtn.textContent = "Play Card";
    return;
  }

  elements.selectedActionBtn.disabled = true;
  elements.selectedActionBtn.textContent = openLanes ? "Pick Lane" : "No Slot";
}

function renderLog() {
  elements.log.innerHTML = state.logEntries
    .map(
      (entry) => `
      <div class="log-entry">
        <div class="log-turn">${entry.turnLabel}</div>
        <div>${entry.text}</div>
      </div>
    `
    )
    .join("");
}

function renderStats() {
  elements.playerHealth.textContent = state.player.health;
  elements.aiHealth.textContent = state.ai.health;
  elements.playerEnergy.textContent = `${state.player.energy} / ${state.player.maxEnergy}`;
  elements.aiEnergy.textContent = `${state.ai.energy} / ${state.ai.maxEnergy}`;
  elements.playerDeck.textContent = state.player.deck.length;
  elements.aiDeck.textContent = state.ai.deck.length;
  elements.playerHandCount.textContent = state.player.hand.length;
  elements.aiHandCount.textContent = state.ai.hand.length;
  elements.endTurnBtn.disabled = state.phase !== "player" || state.gameOver || state.resolving || state.testing;
  elements.testModeBtn.disabled = state.resolving || state.testing;
  elements.enemyStrip.classList.toggle("is-target-vault", state.animation?.targetPlayerKey === "ai");
  elements.playerStrip.classList.toggle("is-target-vault", state.animation?.targetPlayerKey === "player");
}

function render() {
  renderStats();
  renderLanes();
  renderHand();
  renderDetail();
  renderLog();
  queueAutoEndIfNeeded();
}

elements.endTurnBtn.addEventListener("click", endPlayerTurn);
elements.restartBtn.addEventListener("click", () => resetGame(elements.themeSelect.value));
elements.themeSelect.addEventListener("change", () => resetGame(elements.themeSelect.value));
elements.testModeBtn.addEventListener("click", () => {
  if (state.resolving || state.testing) {
    return;
  }

  clearAutoEndTimer();
  state.testing = true;
  state.testReport = null;
  state.selectedCardUid = null;
  elements.playerStatus.textContent = "Running 1000 AI tests.";
  elements.aiStatus.textContent = "Testing.";
  render();

  const themeKey = state.themeKey;
  window.setTimeout(() => {
    const report = runBalanceTest(1000, themeKey);
    state.testing = false;
    state.testReport = report;
    state.logEntries = report.logEntries;
    elements.playerStatus.textContent = "Test complete.";
    elements.aiStatus.textContent = "Results ready.";
    render();
    window.prompt("Copy balance report", report.copyText);
  }, 30);
});
elements.selectedActionBtn.addEventListener("click", () => {
  const selectedCard = getSelectedCard();
  if (!selectedCard || selectedCard.type !== "event") {
    return;
  }
  playCard(state.player, selectedCard.uid, null);
});

resetGame();
