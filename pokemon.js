const POKEMON_API_URL = "https://pokeapi.co/api/v2/pokemon";

function normalizePokemonName(value) {
  return (value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-");
}

function setStatus(text, kind = "") {
  const el = document.getElementById("status");
  if (!el) return;
  el.className = "status" + (kind ? ` ${kind}` : "");
  el.textContent = text;
}

async function getPokemonData(pokemonName) {
  const name = normalizePokemonName(pokemonName);
  if (!name) return { error: "empty" };

  try {
    const url = `${POKEMON_API_URL}/${encodeURIComponent(name)}`;
    const response = await fetch(url);

    if (!response.ok) {
      // 404 si no existe
      return { error: "not_found", status: response.status };
    }

    const data = await response.json();
    return { data };
  } catch (err) {
    // Problema de red / bloqueo / CORS / offline
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

  const types = (pokemonData.types || []).map(t => t.type.name);
  const abilities = (pokemonData.abilities || [])
    .map(a => niceText(a.ability.name))
    .join(", ");

  container.innerHTML = `
    <div class="pokemon-card">
      <div class="pokemon-title">
        <h3>${name}</h3>
        <span>#${String(id).padStart(3, "0")}</span>
      </div>

      ${img ? `<img class="pokemon-img" src="${img}" alt="${name}" />` : ""}

      <div class="badges">
        ${types.map(t => `<span class="badge">Tipo: ${niceText(t)}</span>`).join("")}
      </div>

      <div class="stats">
        <div class="stat">
          <div class="k">Altura</div>
          <div class="v">${heightM} m</div>
        </div>
        <div class="stat">
          <div class="k">Peso</div>
          <div class="v">${weightKg} kg</div>
        </div>
        <div class="stat">
          <div class="k">Habilidades</div>
          <div class="v">${abilities || "-"}</div>
        </div>
      </div>
    </div>
  `;
}

async function searchPokemon() {
  const input = document.getElementById("pokemonName");
  const name = input ? input.value : "";

  if (!name.trim()) {
    setStatus("Escribe un nombre primero (ej: pikachu).", "error");
    document.getElementById("pokemon-container").innerHTML = "";
    return;
  }

  setStatus("Buscando Pokémon...");

  const result = await getPokemonData(name);

  if (result.error === "empty") {
    setStatus("Escribe un nombre válido.", "error");
    return;
  }

  if (result.error === "not_found") {
    setStatus("No se encontró. Prueba: pikachu, ditto, charizard, bulbasaur...", "error");
    document.getElementById("pokemon-container").innerHTML = "";
    return;
  }

  if (result.error === "network") {
    setStatus("Error de red/bloqueo al consultar la API. Usa Live Server en VSCode.", "error");
    document.getElementById("pokemon-container").innerHTML = "";
    console.error("Network error:", result.detail);
    return;
  }

  setStatus("Se encontró");
  renderPokemon(result.data);
}

function initPokemonPage(defaultPokemon = "ditto") {
  const input = document.getElementById("pokemonName");
  const btn = document.getElementById("btnSearch");

  // Seguridad: si faltan elementos, avisamos
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