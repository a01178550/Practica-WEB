const POKEMON_API_URL = "https://pokeapi.co/api/v2/pokemon";

let battle = {
  pokemon1: null,
  pokemon2: null,
  turn: 1,
  currentAttacker: 1,
  finished: false
};

function normalizePokemonName(value) {
  return (value || "").trim().toLowerCase().replace(/\s+/g, "-");
}

function capitalize(s) {
  if (!s) return "";
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function niceText(s) {
  return capitalize((s || "").replaceAll("-", " "));
}

async function getPokemonData(pokemonNameOrId) {
  const name = normalizePokemonName(pokemonNameOrId);
  if (!name) return { error: "empty" };

  try {
    const url = `${POKEMON_API_URL}/${encodeURIComponent(name)}`;
    const response = await fetch(url);

    if (!response.ok) {
      return { error: "not_found", status: response.status };
    }

    const data = await response.json();
    return { data };
  } catch (err) {
    return { error: "network", detail: String(err) };
  }
}

function getStatValue(statsArray, statName) {
  const found = (statsArray || []).find(s => s.stat?.name === statName);
  return found ? found.base_stat : 50;
}

function buildBattlePokemon(data) {
  const hpBase = getStatValue(data.stats, "hp");

  return {
    id: data.id,
    name: niceText(data.name),
    image:
      data.sprites?.other?.["official-artwork"]?.front_default ||
      data.sprites?.front_default ||
      "",
    hpBase: hpBase,
    maxHp: hpBase,
    currentHp: hpBase,
    attack: getStatValue(data.stats, "attack"),
    defense: getStatValue(data.stats, "defense"),
    specialAttack: getStatValue(data.stats, "special-attack"),
    specialDefense: getStatValue(data.stats, "special-defense"),
    speed: getStatValue(data.stats, "speed"),
    turnsPlayed: 0,
    defenseBoostActive: false
  };
}

function setCenterMessage(title, message) {
  document.getElementById("turn-title").textContent = title;
  document.getElementById("turn-message").textContent = message;
}

function addHistory(text) {
  const history = document.getElementById("history");
  const item = document.createElement("div");
  item.className = "history-item";
  item.textContent = text;
  history.prepend(item);
}

function getLifePercent(pokemon) {
  return Math.max(0, (pokemon.currentHp / pokemon.maxHp) * 100);
}

function getLifeColorClass(percent) {
  if (percent > 50) return "green";
  if (percent > 20) return "yellow";
  return "red";
}

function updateSinglePokemonUI(prefix, pokemon) {
  document.getElementById(`${prefix}-name`).textContent = pokemon.name;
  document.getElementById(`${prefix}-image`).src = pokemon.image;
  document.getElementById(`${prefix}-image`).alt = pokemon.name;

  document.getElementById(`${prefix}-atk`).textContent = pokemon.attack;
  document.getElementById(`${prefix}-def`).textContent = pokemon.defense;
  document.getElementById(`${prefix}-spatk`).textContent = pokemon.specialAttack;
  document.getElementById(`${prefix}-spdef`).textContent = pokemon.specialDefense;
  document.getElementById(`${prefix}-speed`).textContent = pokemon.speed;

  const pct = getLifePercent(pokemon).toFixed(0);
  const lifeBar = document.getElementById(`${prefix}-life-bar`);
  const lifeText = document.getElementById(`${prefix}-life-text`);

  lifeBar.style.width = `${pct}%`;
  lifeText.textContent = `${pct}%`;

  if (pct > 50) {
    lifeBar.style.background = "linear-gradient(90deg, #33c759, #28a745)";
  } else if (pct > 20) {
    lifeBar.style.background = "linear-gradient(90deg, #facc15, #f59e0b)";
  } else {
    lifeBar.style.background = "linear-gradient(90deg, #ef4444, #dc2626)";
  }
}

function updateUI() {
  updateSinglePokemonUI("p1", battle.pokemon1);
  updateSinglePokemonUI("p2", battle.pokemon2);
}

function calculateDamage(attacker, defender, useSpecialAttack) {
  const attackValue = useSpecialAttack ? attacker.specialAttack : attacker.attack;
  let defenseValue = defender.defense;

  if (defender.defenseBoostActive) {
    defenseValue = defender.specialDefense;
  }

  const randomFactor = Math.floor(Math.random() * 8) + 3;
  let damage = attackValue - Math.floor(defenseValue / 2) + randomFactor;

  if (useSpecialAttack) {
    damage += 8;
  }

  if (damage < 5) damage = 5;
  return damage;
}

function randomChance(percent) {
  return Math.random() * 100 < percent;
}

function chooseAction(attacker) {
  const canUseSpecialAttack = attacker.turnsPlayed >= 3;
  const canUseSpecialDefense = attacker.turnsPlayed >= 2;

  let options = ["normal_attack"];

  if (canUseSpecialAttack) {
    options.push("special_attack");
  }

  if (canUseSpecialDefense) {
    options.push("special_defense");
  }

  const index = Math.floor(Math.random() * options.length);
  return options[index];
}

function performTurn() {
  if (battle.finished) return;

  const attacker = battle.currentAttacker === 1 ? battle.pokemon1 : battle.pokemon2;
  const defender = battle.currentAttacker === 1 ? battle.pokemon2 : battle.pokemon1;

  attacker.turnsPlayed += 1;

  const action = chooseAction(attacker);
  let turnText = "";

  defender.defenseBoostActive = false;

  if (action === "normal_attack") {
    const failed = randomChance(20);

    if (failed) {
      turnText = `Turno ${battle.turn}: ${attacker.name} intentó un ataque normal, pero falló.`;
    } else {
      const damage = calculateDamage(attacker, defender, false);
      defender.currentHp -= damage;
      if (defender.currentHp < 0) defender.currentHp = 0;

      turnText = `Turno ${battle.turn}: ${attacker.name} usó ataque normal, hizo ${damage} de daño y dejó a ${defender.name} con ${getLifePercent(defender).toFixed(0)}% de vida.`;
    }
  }

  if (action === "special_attack") {
    const failed = randomChance(25);

    if (failed) {
      turnText = `Turno ${battle.turn}: ${attacker.name} intentó su ataque especial, pero falló.`;
    } else {
      const damage = calculateDamage(attacker, defender, true);
      defender.currentHp -= damage;
      if (defender.currentHp < 0) defender.currentHp = 0;

      turnText = `Turno ${battle.turn}: ${attacker.name} usó ataque especial, hizo ${damage} de daño y dejó a ${defender.name} con ${getLifePercent(defender).toFixed(0)}% de vida.`;
    }
  }

  if (action === "special_defense") {
    const failed = randomChance(20);

    if (failed) {
      turnText = `Turno ${battle.turn}: ${attacker.name} intentó defensa especial, pero falló.`;
    } else {
      attacker.defenseBoostActive = true;
      turnText = `Turno ${battle.turn}: ${attacker.name} activó defensa especial. En el próximo golpe resistirá mejor el daño.`;
    }
  }

  setCenterMessage(`Turno de ${attacker.name}`, turnText);
  addHistory(turnText);
  updateUI();

  if (defender.currentHp <= 0) {
    endBattle(attacker);
    return;
  }

  battle.currentAttacker = battle.currentAttacker === 1 ? 2 : 1;
  battle.turn += 1;
}

function endBattle(winner) {
  battle.finished = true;

  setCenterMessage("¡La pelea terminó!", `${winner.name} ganó la batalla.`);
  addHistory(`Ganador final: ${winner.name}.`);

  document.getElementById("winner-section").classList.remove("hidden");
  document.getElementById("winner-image").src = winner.image;
  document.getElementById("winner-image").alt = winner.name;
  document.getElementById("winner-name").textContent = winner.name;

  document.getElementById("btn-next").disabled = true;
}

function restartBattle() {
  const names = JSON.parse(localStorage.getItem("battlePokemonNames"));

  if (!names || !names.pokemon1 || !names.pokemon2) {
    alert("No hay datos guardados para reiniciar la pelea.");
    return;
  }

  location.reload();
}

async function initBattle() {
  const saved = JSON.parse(localStorage.getItem("battlePokemonNames"));

  if (!saved || !saved.pokemon1 || !saved.pokemon2) {
    setCenterMessage(
      "Faltan Pokémon",
      "No se encontraron los 2 Pokémon seleccionados en localStorage."
    );
    document.getElementById("btn-next").disabled = true;
    return;
  }

  setCenterMessage("Cargando pelea...", "Consultando Pokémon en la API...");

  const [result1, result2] = await Promise.all([
    getPokemonData(saved.pokemon1),
    getPokemonData(saved.pokemon2)
  ]);

  if (result1.error || result2.error) {
    setCenterMessage(
      "Error",
      "No se pudieron cargar los Pokémon desde la API. Revisa los nombres guardados."
    );
    document.getElementById("btn-next").disabled = true;
    return;
  }

  battle.pokemon1 = buildBattlePokemon(result1.data);
  battle.pokemon2 = buildBattlePokemon(result2.data);

  battle.currentAttacker =
    battle.pokemon1.speed >= battle.pokemon2.speed ? 1 : 2;

  updateUI();

  setCenterMessage(
    "¡Pelea lista!",
    `Empieza ${battle.currentAttacker === 1 ? battle.pokemon1.name : battle.pokemon2.name} por tener mayor velocidad.`
  );

  addHistory(
    `La batalla inició entre ${battle.pokemon1.name} y ${battle.pokemon2.name}.`
  );
}

document.getElementById("btn-next").addEventListener("click", performTurn);
document.getElementById("btn-restart").addEventListener("click", restartBattle);

initBattle();

document.getElementById("btn-menu").addEventListener("click", () => {
  window.location.href = "menu.html";
});