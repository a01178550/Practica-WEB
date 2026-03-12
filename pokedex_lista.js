const API = "https://pokeapi.co/api/v2";
const PAGE_SIZE = 24;

let allPokemon = [];        // [{ id, name }]
let filteredPokemon = [];   // subset según filtros
let renderIndex = 0;

const detailsCache = new Map(); // id -> { sprite, types }

// ---------- UI ----------
function setStatus(text, kind = "") {
  const el = document.getElementById("statusList");
  if (!el) return;
  el.className = "status" + (kind ? ` ${kind}` : "");
  el.textContent = text;
}

function normalizeName(s) {
  return (s || "").trim().toLowerCase();
}

function pad3(n) {
  return String(n).padStart(3, "0");
}

function niceText(s) {
  return (s || "").replaceAll("-", " ");
}

function capitalize(s) {
  if (!s) return "";
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ---------- API ----------
async function fetchJson(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`HTTP ${r.status} -> ${url}`);
  return await r.json();
}

async function loadTypes() {
  const data = await fetchJson(`${API}/type`);
  const select = document.getElementById("filterType");
  select.innerHTML = `<option value="">(Todos)</option>`;

  const types = (data.results || [])
    .map(t => t.name)
    .filter(t => t !== "unknown" && t !== "shadow");

  for (const t of types) {
    const opt = document.createElement("option");
    opt.value = t;
    opt.textContent = capitalize(niceText(t));
    select.appendChild(opt);
  }
}

async function loadAllPokemonNames() {
  // trae lista completa (solo name/url)
  const data = await fetchJson(`${API}/pokemon?limit=2000&offset=0`);

  allPokemon = (data.results || [])
    .map(p => {
      const parts = p.url.split("/").filter(Boolean);
      const id = Number(parts[parts.length - 1]);
      return { id, name: p.name };
    })
    .filter(p => Number.isFinite(p.id))
    .sort((a, b) => a.id - b.id);
}

async function getPokemonIdsByType(typeName) {
  const data = await fetchJson(`${API}/type/${encodeURIComponent(typeName)}`);
  const set = new Set();

  for (const item of data.pokemon || []) {
    const url = item.pokemon?.url || "";
    const parts = url.split("/").filter(Boolean);
    const id = Number(parts[parts.length - 1]);
    if (Number.isFinite(id)) set.add(id);
  }
  return set;
}

async function getPokemonDetails(id) {
  if (detailsCache.has(id)) return detailsCache.get(id);

  const data = await fetchJson(`${API}/pokemon/${id}`);

  const sprite =
    data.sprites?.other?.["official-artwork"]?.front_default ||
    data.sprites?.front_default ||
    "";

  const types = (data.types || []).map(t => t.type.name);

  const payload = { sprite, types };
  detailsCache.set(id, payload);
  return payload;
}

// ---------- Render ----------
function clearGrid() {
  const grid = document.getElementById("grid");
  grid.innerHTML = "";
}

function renderCardBasic(p) {
  const el = document.createElement("div");
  el.className = "dex-card";
  el.setAttribute("role", "button");
  el.tabIndex = 0;

  // click manda a detalles
  el.addEventListener("click", () => {
    window.location.href = `pokedex.html?id=${p.id}`;
  });

  // Enter también
  el.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      window.location.href = `pokedex.html?id=${p.id}`;
    }
  });

  el.innerHTML = `
    <div class="dex-top">
      <div class="dex-name">${capitalize(niceText(p.name))}</div>
      <div class="dex-id">#${pad3(p.id)}</div>
    </div>
    <div class="dex-imgwrap">
      <div class="dex-skeleton"></div>
    </div>
    <div class="dex-types"></div>
  `;

  return el;
}

async function hydrateCard(cardEl, id) {
  try {
    const d = await getPokemonDetails(id);
    const imgWrap = cardEl.querySelector(".dex-imgwrap");
    const typesEl = cardEl.querySelector(".dex-types");

    imgWrap.innerHTML = d.sprite
      ? `<img class="dex-img" src="${d.sprite}" alt="pokemon ${id}" />`
      : `<div class="dex-skeleton"></div>`;

    typesEl.innerHTML = (d.types || [])
      .map(t => `<span class="badge">${capitalize(niceText(t))}</span>`)
      .join("");
  } catch (e) {
    // si falla, dejamos skeleton
  }
}

async function renderNextPage() {
  const grid = document.getElementById("grid");
  const slice = filteredPokemon.slice(renderIndex, renderIndex + PAGE_SIZE);
  if (slice.length === 0) return;

  const cards = slice.map(p => {
    const c = renderCardBasic(p);
    grid.appendChild(c);
    return { el: c, id: p.id };
  });

  renderIndex += slice.length;

  await Promise.all(cards.map(c => hydrateCard(c.el, c.id)));
  updateLoadMoreButton();
}

function updateLoadMoreButton() {
  const btn = document.getElementById("btnLoadMore");
  const remaining = filteredPokemon.length - renderIndex;

  if (remaining <= 0) {
    btn.disabled = true;
    btn.textContent = "No hay más";
  } else {
    btn.disabled = false;
    btn.textContent = `Cargar más (${remaining} restantes)`;
  }
}

// ---------- Filters ----------
async function applyFilters() {
  const nameValue = normalizeName(document.getElementById("filterName").value);
  const idRaw = document.getElementById("filterId").value;
  const typeValue = document.getElementById("filterType").value;

  setStatus("Aplicando filtros...");

  let list = allPokemon;

  if (nameValue) {
    list = list.filter(p => p.name.includes(nameValue));
  }

  const idValue = Number(idRaw);
  if (idRaw && Number.isFinite(idValue)) {
    list = list.filter(p => p.id === idValue);
  }

  if (typeValue) {
    const idsSet = await getPokemonIdsByType(typeValue);
    list = list.filter(p => idsSet.has(p.id));
  }

  filteredPokemon = list;
  renderIndex = 0;
  clearGrid();

  if (filteredPokemon.length === 0) {
    setStatus("No hay resultados con esos filtros ", "error");
    updateLoadMoreButton();
    return;
  }

  setStatus(`Resultados: ${filteredPokemon.length} Pokémon`);
  await renderNextPage();
}

function clearFilters() {
  document.getElementById("filterName").value = "";
  document.getElementById("filterId").value = "";
  document.getElementById("filterType").value = "";
}

// ---------- Init ----------
async function initPokedexList() {
  try {
    setStatus("Cargando tipos y Pokédex...");

    await loadTypes();
    await loadAllPokemonNames();

    filteredPokemon = allPokemon;
    renderIndex = 0;

    setStatus(`Pokédex lista: ${filteredPokemon.length} Pokémon`);
    clearGrid();
    await renderNextPage();
    updateLoadMoreButton();

    document.getElementById("btnApply").addEventListener("click", applyFilters);

    document.getElementById("btnClear").addEventListener("click", async () => {
      clearFilters();
      filteredPokemon = allPokemon;
      renderIndex = 0;
      clearGrid();
      setStatus(`Pokédex lista: ${filteredPokemon.length} Pokémon`);
      await renderNextPage();
      updateLoadMoreButton();
    });

    document.getElementById("btnLoadMore").addEventListener("click", renderNextPage);

    document.getElementById("filterName").addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); applyFilters(); }
    });
    document.getElementById("filterId").addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); applyFilters(); }
    });

  } catch (err) {
    console.error(err);
    setStatus("Error cargando la Pokédex. Usa Live Server (VSCode).", "error");
  }
}