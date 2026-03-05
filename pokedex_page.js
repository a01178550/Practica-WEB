/**
 * pokedex_page.js
 * ----------------
 * Pokédex en UNA sola página:
 * - Vista LISTA: filtros + grid con "Cargar más"
 * - Vista DETALLE: renderizado al entrar con ?id=25
 *
 * Requiere que pokedex.html tenga estos IDs:
 * listView, detailView, filterName, filterId, filterType,
 * btnApply, btnClear, btnLoadMore, statusList, grid, pokemon-container
 */

const API = "https://pokeapi.co/api/v2";
const PAGE_SIZE = 24;

// Lista general (solo id + name)
let allPokemon = [];      // [{ id, name }]
let filteredPokemon = []; // lista ya filtrada
let renderIndex = 0;      // cuántos ya renderizamos

// Cache de detalles para no pedir lo mismo muchas veces
const detailsCache = new Map(); // id -> { sprite, types }

// ----------------------
// Helpers de UI / texto
// ----------------------

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

function showListView() {
  const list = document.getElementById("listView");
  const detail = document.getElementById("detailView");
  if (list) list.style.display = "block";
  if (detail) detail.style.display = "none";
}

function showDetailView() {
  const list = document.getElementById("listView");
  const detail = document.getElementById("detailView");
  if (list) list.style.display = "none";
  if (detail) detail.style.display = "block";
}

// ----------------------
// API helpers
// ----------------------

async function fetchJson(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`HTTP ${r.status} -> ${url}`);
  return await r.json();
}

/**
 * Carga tipos para el select (#filterType)
 */
async function loadTypes() {
  const data = await fetchJson(`${API}/type`);
  const select = document.getElementById("filterType");
  if (!select) return;

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

/**
 * Carga el listado completo de pokémon (id + nombre).
 * NOTA: aquí NO traemos sprites para no hacer 2000 requests.
 */
async function loadAllPokemonNames() {
  const data = await fetchJson(`${API}/pokemon?limit=2000&offset=0`);

  allPokemon = (data.results || [])
    .map(p => {
      const parts = p.url.split("/").filter(Boolean);
      const id = Number(parts[parts.length - 1]);
      return { id, name: p.name };
    })
    .filter(p => Number.isFinite(p.id))
    .sort((a, b) => a.id - b.id);

  filteredPokemon = allPokemon;
}

/**
 * Devuelve un Set de IDs que pertenecen a un tipo (ej: "fire").
 */
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

/**
 * Trae detalles básicos para una card (sprite + tipos) y lo cachea.
 */
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

// ----------------------
// Render LISTA
// ----------------------

function clearGrid() {
  const grid = document.getElementById("grid");
  if (grid) grid.innerHTML = "";
}

/**
 * Renderiza una card "vacía" (skeleton) que luego se hidrata con sprite/tipos.
 */
function renderCardBasic(p) {
  const el = document.createElement("div");
  el.className = "dex-card";
  el.setAttribute("role", "button");
  el.tabIndex = 0;

  // Click -> detalle en la misma pokedex.html?id=...
  el.addEventListener("click", () => {
    window.location.href = `pokedex.html?id=${p.id}`;
  });

  el.addEventListener("keydown", (e) => {
    if (e.key === "Enter") window.location.href = `pokedex.html?id=${p.id}`;
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

/**
 * "Hidrata" una card: trae sprite + tipos y los inserta.
 */
async function hydrateCard(cardEl, id) {
  try {
    const d = await getPokemonDetails(id);
    const imgWrap = cardEl.querySelector(".dex-imgwrap");
    const typesEl = cardEl.querySelector(".dex-types");

    if (imgWrap) {
      imgWrap.innerHTML = d.sprite
        ? `<img class="dex-img" src="${d.sprite}" alt="pokemon ${id}" />`
        : `<div class="dex-skeleton"></div>`;
    }

    if (typesEl) {
      typesEl.innerHTML = (d.types || [])
        .map(t => `<span class="badge">${capitalize(niceText(t))}</span>`)
        .join("");
    }
  } catch {
    // si falla, dejamos skeleton
  }
}

/**
 * Renderiza la siguiente "página" (24 cards por defecto).
 */
async function renderNextPage() {
  const grid = document.getElementById("grid");
  if (!grid) return;

  const slice = filteredPokemon.slice(renderIndex, renderIndex + PAGE_SIZE);
  if (slice.length === 0) return;

  const cards = slice.map(p => {
    const c = renderCardBasic(p);
    grid.appendChild(c);
    return { el: c, id: p.id };
  });

  renderIndex += slice.length;

  // Hidrata sprites/tipos en paralelo
  await Promise.all(cards.map(c => hydrateCard(c.el, c.id)));
  updateLoadMoreButton();
}

function updateLoadMoreButton() {
  const btn = document.getElementById("btnLoadMore");
  if (!btn) return;

  const remaining = filteredPokemon.length - renderIndex;

  if (remaining <= 0) {
    btn.disabled = true;
    btn.textContent = "No hay más";
  } else {
    btn.disabled = false;
    btn.textContent = `Cargar más (${remaining} restantes)`;
  }
}

// ----------------------
// Filtros
// ----------------------

function clearFilters() {
  const name = document.getElementById("filterName");
  const id = document.getElementById("filterId");
  const type = document.getElementById("filterType");

  if (name) name.value = "";
  if (id) id.value = "";
  if (type) type.selectedIndex = 0;
}

/**
 * Aplica filtros (nombre, id exacto, tipo) y vuelve a renderizar desde 0.
 */
async function applyFilters() {
  const nameValue = normalizeName(document.getElementById("filterName")?.value);
  const idRaw = document.getElementById("filterId")?.value || "";
  const typeValue = document.getElementById("filterType")?.value || "";

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
    setStatus("No hay resultados con esos filtros.", "error");
    updateLoadMoreButton();
    return;
  }

  setStatus(`Resultados: ${filteredPokemon.length} Pokémon`);
  await renderNextPage();
}

// ----------------------
// Render DETALLE
// ----------------------

async function renderDetailById(id) {
  const container = document.getElementById("pokemon-container");
  if (!container) return;

  container.innerHTML = `<div class="status">Cargando Pokémon...</div>`;

  try {
    const data = await fetchJson(`${API}/pokemon/${id}`);

    const name = capitalize(niceText(data.name));
    const img =
      data.sprites?.other?.["official-artwork"]?.front_default ||
      data.sprites?.front_default ||
      "";

    const types = (data.types || []).map(t => t.type.name);
    const abilities = (data.abilities || []).map(a => capitalize(niceText(a.ability.name)));

    const heightM = (data.height / 10).toFixed(1);
    const weightKg = (data.weight / 10).toFixed(1);
    const baseExp = data.base_experience ?? "-";

    const stats = (data.stats || []).map(s => ({
      name: s.stat?.name || "",
      value: s.base_stat ?? 0,
    }));

    const moves = (data.moves || [])
      .map(m => capitalize(niceText(m.move?.name || "")))
      .filter(Boolean)
      .slice(0, 24);

    container.innerHTML = `
      <div class="poke-detail">
        <div class="poke-hero">
          <div class="poke-imgbox">
            ${img ? `<img src="${img}" alt="${name}">` : `<div class="dex-skeleton"></div>`}
          </div>

          <div>
            <div class="poke-title">
              <h3>${name}</h3>
              <span class="poke-id">#${pad3(data.id)}</span>
            </div>

            <div class="poke-sub">Detalle del Pokémon (Demo)</div>

            <div class="type-row">
              ${types.map(t => `<span class="type-chip type-${t}">${capitalize(niceText(t))}</span>`).join("")}
            </div>
          </div>
        </div>

        <div class="poke-body">
          <div class="poke-panel">
            <h4>Datos</h4>
            <div class="data-grid">
              <div class="data-item"><div class="k">Altura</div><div class="v">${heightM} m</div></div>
              <div class="data-item"><div class="k">Peso</div><div class="v">${weightKg} kg</div></div>
              <div class="data-item"><div class="k">Exp. base</div><div class="v">${baseExp}</div></div>
            </div>

            <div style="margin-top:14px;">
              <h4>Habilidades</h4>
              <div class="ability-row">
                ${abilities.map(a => `<span class="pill">${a}</span>`).join("")}
              </div>
            </div>

            <div style="margin-top:14px;">
              <button class="btn-secondary" type="button" onclick="location.href='pokedex.html'">
                Volver a la lista
              </button>
            </div>
          </div>

          <div class="poke-panel">
            <h4>Stats</h4>
            <div class="stats-list">
              ${stats.map(s => `
                <div class="stat-line">
                  <div class="stat-name">${niceText(s.name)}</div>
                  <div class="stat-val">${s.value}</div>
                  <div class="bar"><span style="width:${Math.min(100, (s.value/200)*100)}%"></span></div>
                </div>
              `).join("")}
            </div>

            <div style="margin-top:16px;">
              <h4>Movimientos</h4>
              <div class="moves-wrap">
                ${moves.map(m => `<span class="move-chip">${m}</span>`).join("")}
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  } catch (e) {
    container.innerHTML = `<div class="status error">Error cargando el Pokémon </div>`;
  }
}

// ----------------------
// Init
// ----------------------

async function initList() {
  setStatus("Cargando tipos y Pokédex...");

  await loadTypes();
  await loadAllPokemonNames();

  setStatus(`Pokédex: ${filteredPokemon.length} Pokémon`);

  clearGrid();
  renderIndex = 0;

  await renderNextPage();
  updateLoadMoreButton();

  // Eventos
  document.getElementById("btnApply")?.addEventListener("click", applyFilters);

  document.getElementById("btnClear")?.addEventListener("click", async () => {
    clearFilters();
    filteredPokemon = allPokemon;
    renderIndex = 0;
    clearGrid();
    setStatus(`Pokédex: ${filteredPokemon.length} Pokémon`);
    await renderNextPage();
    updateLoadMoreButton();
  });

  document.getElementById("btnLoadMore")?.addEventListener("click", renderNextPage);

  document.getElementById("filterName")?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") { e.preventDefault(); applyFilters(); }
  });

  document.getElementById("filterId")?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") { e.preventDefault(); applyFilters(); }
  });
}

/**
 * Entry point de la página:
 * - Si hay ?id=xxx -> muestra detalle
 * - Si no -> muestra lista
 */
async function initPokedexPage() {
  const params = new URLSearchParams(window.location.search);
  const idFromUrl = params.get("id");

  if (idFromUrl) {
    showDetailView();
    await renderDetailById(idFromUrl);
  } else {
    showListView();
    await initList();
  }
}