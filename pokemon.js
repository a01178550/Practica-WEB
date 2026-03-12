const POKEMON_API_URL = "https://pokeapi.co/api/v2/pokemon";

function normalizePokemonName(value) {
  return (value || "").trim().toLowerCase().replace(/\s+/g, "-");
}

function setStatus(text, kind = "") {
  const el = document.getElementById("status");
  if (!el) return;
  el.className = "status" + (kind ? ` ${kind}` : "");
  el.textContent = text;
}

async function getPokemonData(pokemonNameOrId) {
  const name = normalizePokemonName(pokemonNameOrId);
  if (!name) return { error: "empty" };

  try {
    const url = `${POKEMON_API_URL}/${encodeURIComponent(name)}`;
    const response = await fetch(url);
    if (!response.ok) return { error: "not_found", status: response.status };
    const data = await response.json();
    return { data };
  } catch (err) {
    return { error: "network", detail: String(err) };
  }
}

function capitalize(s) {
  if (!s) return "";
  return s.charAt(0).toUpperCase() + s.slice(1);
}
function niceText(s) {
  return capitalize((s || "").replaceAll("-", " "));
}
function pad3(n) {
  return String(n).padStart(3, "0");
}

function formatStatName(n) {
  const map = {
    hp: "HP",
    attack: "ATK",
    defense: "DEF",
    "special-attack": "SP.ATK",
    "special-defense": "SP.DEF",
    speed: "SPD",
  };
  return map[n] || niceText(n);
}

function statPct(v) {
  const max = 200;
  const pct = Math.max(0, Math.min(100, (Number(v) / max) * 100));
  return pct.toFixed(0);
}

function typeClass(t) {
  return `type-chip type-${(t || "").toLowerCase()}`;
}

function renderPokemon(pokemonData) {
  const container = document.getElementById("pokemon-container");
  if (!container) return;

  const name = niceText(pokemonData.name);
  const id = pokemonData.id;

  const img =
    pokemonData.sprites?.other?.["official-artwork"]?.front_default ||
    pokemonData.sprites?.front_default ||
    "";

  const heightM = (pokemonData.height / 10).toFixed(1);
  const weightKg = (pokemonData.weight / 10).toFixed(1);
  const baseExp = pokemonData.base_experience ?? "-";

  const types = (pokemonData.types || []).map(t => t.type.name);
  const abilities = (pokemonData.abilities || []).map(a => niceText(a.ability.name));

  const stats = (pokemonData.stats || []).map(s => ({
    name: s.stat?.name || "",
    value: s.base_stat ?? 0,
  }));

  // Más moves para que se vea mejor (y en chips)
  const moves = (pokemonData.moves || [])
    .map(m => niceText(m.move?.name || ""))
    .filter(Boolean)
    .slice(0, 24);

  const cry = pokemonData.cries?.latest || pokemonData.cries?.legacy || "";

  container.innerHTML = `
    <div class="poke-detail">
      <div class="poke-hero">
        <div class="poke-imgbox">
          ${img ? `<img src="${img}" alt="${name}" />` : `<div class="dex-skeleton"></div>`}
        </div>

        <div>
          <div class="poke-title">
            <h3>${name}</h3>
            <span class="poke-id">#${pad3(id)}</span>
          </div>

          <div class="poke-sub">
            Datos del Pokémon desde la PokéAPI. (Demo)
          </div>

          <div class="type-row">
            ${(types || []).map(t => `<span class="${typeClass(t)}">${niceText(t)}</span>`).join("")}
          </div>
        </div>
      </div>

      <div class="poke-body">
        <div class="poke-panel">
          <h4>Datos</h4>

          <div class="data-grid">
            <div class="data-item">
              <div class="k">Altura</div>
              <div class="v">${heightM} m</div>
            </div>
            <div class="data-item">
              <div class="k">Peso</div>
              <div class="v">${weightKg} kg</div>
            </div>
            <div class="data-item">
              <div class="k">Exp. base</div>
              <div class="v">${baseExp}</div>
            </div>
          </div>

          <div style="margin-top:14px;">
            <h4>Habilidades</h4>
            <div class="ability-row">
              ${(abilities.length ? abilities : ["-"]).map(a => `<span class="pill">${a}</span>`).join("")}
            </div>
          </div>

          <div style="margin-top:14px;">
            <h4>Sonido</h4>
            ${
              cry
                ? `<audio controls style="width:100%; margin-top:8px;">
                     <source src="${cry}" type="audio/ogg">
                     Tu navegador no soporta audio.
                   </audio>`
                : `<div class="muted">No disponible</div>`
            }
          </div>
        </div>

        <div class="poke-panel">
          <h4>Stats</h4>

          <div class="stats-list">
            ${stats.map(s => `
              <div class="stat-line">
                <div class="stat-name">${formatStatName(s.name)}</div>
                <div class="stat-val">${s.value}</div>
                <div class="bar"><span style="width:${statPct(s.value)}%"></span></div>
              </div>
            `).join("")}
          </div>

          <div style="margin-top:16px;">
            <h4>Movimientos</h4>
            <div class="moves-wrap">
              ${(moves.length ? moves : ["-"]).map(m => `<span class="move-chip">${m}</span>`).join("")}
            </div>
          </div>
        </div>
      </div>

      <div class="poke-actions">
        <button type="button" class="btn-secondary" onclick="location.href='pokedex_lista.html'">
          Volver a la lista
        </button>
      </div>
    </div>
  `;
}

async function searchPokemon() {
  const input = document.getElementById("pokemonName");
  const name = input ? input.value : "";

  if (!name.trim()) {
    setStatus("Escribe un nombre primero (ej: pikachu).", "error");
    const c = document.getElementById("pokemon-container");
    if (c) c.innerHTML = "";
    return;
  }

  setStatus("Buscando Pokémon...");

  const result = await getPokemonData(name);

  if (result.error === "empty") {
    setStatus("Escribe un nombre válido.", "error");
    return;
  }
  if (result.error === "not_found") {
    setStatus("No se encontró. Prueba: pikachu, ditto, charizard...", "error");
    const c = document.getElementById("pokemon-container");
    if (c) c.innerHTML = "";
    return;
  }
  if (result.error === "network") {
    setStatus("Error de red/bloqueo al consultar la API. Usa Live Server.", "error");
    const c = document.getElementById("pokemon-container");
    if (c) c.innerHTML = "";
    console.error("Network error:", result.detail);
    return;
  }

  const id = result.data?.id;
  if (id) {
    window.history.replaceState({}, "", `pokedex.html?id=${id}`);
    document.body.classList.add("detail-mode");
  }

  setStatus("Se encontró ");
  renderPokemon(result.data);
}

function initPokemonPage(defaultPokemon = "ditto") {
  const input = document.getElementById("pokemonName");
  const btn = document.getElementById("btnSearch");

  if (!input || !btn || !document.getElementById("pokemon-container") || !document.getElementById("status")) {
    console.error("Faltan IDs en el HTML. Deben existir: pokemonName, btnSearch, pokemon-container, status");
    return;
  }

  btn.addEventListener("click", searchPokemon);

  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      searchPokemon();
    }
  });

  input.value = defaultPokemon;
  searchPokemon();
}