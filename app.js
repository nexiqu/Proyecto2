// City Chaos · Supabase con API HTTP nativa.
// Evita depender de constructores del bundle de supabase-js en producción.
const PROJECT_URL = String(import.meta.env.VITE_SUPABASE_URL || "").replace(/\/+$/, "");
const PUBLISHABLE_KEY = String(import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "");
const READY = PROJECT_URL.startsWith("https://") && PUBLISHABLE_KEY.length > 12;
const SIZE = 12;
const SESSION_KEY = "citychaos_supabase_session_v3_" + PROJECT_URL;
const TOOL_DATA = {
  house: { name: "Casita", icon: "🏠", verb: "construyó una casa" },
  building: { name: "Edificio", icon: "🏢", verb: "levantó un edificio" },
  road: { name: "Carretera", icon: "🛣️", verb: "colocó una carretera" },
  tree: { name: "Árbol", icon: "🌳", verb: "plantó un árbol" },
  park: { name: "Jardín", icon: "🌷", verb: "creó un jardín" },
  meteor: { name: "Meteorito", icon: "☄️", verb: "lanzó un meteorito" },
  erase: { name: "Eliminar", icon: "🧹", verb: "eliminó un objeto" }
};
const $ = id => document.getElementById(id);
const state = {
  room: cleanRoom(new URLSearchParams(location.search).get("sala") || "CIUDAD-01"),
  user: null, session: null, player: "Jugador", mode: "offline", tool: "house",
  cells: {}, activity: [], roomVersion: 0, loadVersion: 0,
  pollTimer: null, toastTimer: null, busy: false, refreshPromise: null
};
const grid = $("cityGrid");
const roomInput = $("roomInput");
const nameInput = $("nameInput");
roomInput.value = state.room;

function cleanRoom(value) {
  return String(value || "").toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 24) || "CIUDAD-01";
}
function cleanName(value) {
  return String(value || "").trim().replace(/[<>]/g, "").slice(0, 18) || "Jugador";
}
function tileKey(row, col) { return row + "-" + col; }
function status(mode, message) {
  $("connectionBadge").className = "connection-badge is-" + mode;
  $("connectionText").textContent = message;
}
function saveMessage(message) { $("saveMessage").textContent = message; }
function cloudHint(message, connected = false) {
  $("cloudHint").textContent = message;
  $("cloudHint").classList.toggle("connected", connected);
}
function showToast(message) {
  const node = $("toast");
  clearTimeout(state.toastTimer);
  node.textContent = message;
  node.classList.add("show");
  state.toastTimer = setTimeout(() => node.classList.remove("show"), 3300);
}
function errorMessage(err) {
  return err instanceof Error ? err.message : String(err || "Error desconocido");
}
function userLabel() {
  return cleanName(state.user?.email?.split("@")[0] || "Jugador");
}
function readSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed?.access_token && parsed?.refresh_token && parsed?.user?.id ? parsed : null;
  } catch { return null; }
}
function saveSession(session) {
  state.session = session;
  if (session) {
    try { localStorage.setItem(SESSION_KEY, JSON.stringify(session)); }
    catch (e) { console.warn("No fue posible almacenar la sesión:", e); }
  } else {
    localStorage.removeItem(SESSION_KEY);
  }
}
async function http(path, { method = "GET", body, token, headers = {} } = {}) {
  if (!READY) throw new Error("Faltan las dos variables públicas de Supabase en Vercel.");
  const res = await fetch(PROJECT_URL + path, {
    method, cache: "no-store",
    headers: {
      apikey: PUBLISHABLE_KEY,
      ...(token ? { Authorization: "Bearer " + token } : {}),
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...headers
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {})
  });
  const text = await res.text();
  let value = null;
  if (text) {
    try { value = JSON.parse(text); } catch { value = { message: text.slice(0, 300) }; }
  }
  if (!res.ok) {
    const message = value?.msg || value?.message || value?.error_description || value?.error ||
      "HTTP " + res.status;
    const error = new Error(message);
    error.status = res.status;
    throw error;
  }
  return value;
}
async function refreshSession() {
  if (!state.session?.refresh_token) throw new Error("Tu sesión expiró. Inicia sesión nuevamente.");
  if (!state.refreshPromise) {
    const refreshToken = state.session.refresh_token;
    state.refreshPromise = http("/auth/v1/token?grant_type=refresh_token", {
      method: "POST", body: { refresh_token: refreshToken }
    }).then(data => {
      if (!data?.access_token || !data?.user) throw new Error("Supabase no pudo renovar la sesión.");
      saveSession({
        ...data,
        expires_at: Math.floor(Date.now() / 1000) + Number(data.expires_in || 3600)
      });
      state.user = data.user;
      return state.session;
    }).finally(() => { state.refreshPromise = null; });
  }
  return state.refreshPromise;
}
async function validToken() {
  if (!state.session?.access_token) throw new Error("Inicia sesión para utilizar la ciudad.");
  if (Number(state.session.expires_at || 0) * 1000 < Date.now() + 30000) {
    await refreshSession();
  }
  return state.session.access_token;
}
async function request(path, options = {}) {
  let token = await validToken();
  try {
    return await http(path, { ...options, token });
  } catch (error) {
    if (error.status !== 401) throw error;
    await refreshSession();
    token = await validToken();
    return http(path, { ...options, token });
  }
}
function updateAuthUI(message) {
  const loggedIn = Boolean(state.user);
  $("authSignedOut").hidden = loggedIn;
  $("authSignedIn").hidden = !loggedIn;
  $("userEmailLabel").textContent = state.user?.email || "";
  $("authStatus").textContent = message || (loggedIn
    ? "✓ Sesión activa: " + state.user.email
    : READY ? "Usa una cuenta creada en Authentication → Users."
      : "Faltan VITE_SUPABASE_URL y VITE_SUPABASE_PUBLISHABLE_KEY.");
  $("loginButton").disabled = !READY;
}
function initGrid() {
  const fragment = document.createDocumentFragment();
  for (let row = 0; row < SIZE; row++) {
    for (let col = 0; col < SIZE; col++) {
      const tile = document.createElement("button");
      tile.type = "button";
      tile.className = "tile";
      tile.dataset.row = String(row);
      tile.dataset.col = String(col);
      tile.dataset.type = "empty";
      const art = document.createElement("span");
      art.className = "tile-art";
      art.setAttribute("aria-hidden", "true");
      tile.append(art);
      fragment.append(tile);
    }
  }
  grid.replaceChildren(fragment);
}
function renderGrid() {
  const cells = state.cells;
  for (const tile of grid.children) {
    const row = Number(tile.dataset.row), col = Number(tile.dataset.col);
    const type = cells[tileKey(row, col)] || "empty";
    tile.dataset.type = type;
    tile.querySelector(".tile-art").textContent = type === "road" ? "" : TOOL_DATA[type]?.icon || "";
    const horizontal = cells[tileKey(row, col-1)] === "road" || cells[tileKey(row,col+1)] === "road";
    const vertical = cells[tileKey(row-1,col)] === "road" || cells[tileKey(row+1,col)] === "road";
    tile.classList.toggle("road-horizontal", Boolean(horizontal && !vertical));
    tile.setAttribute("aria-label", "Fila " + (row+1) + ", columna " + (col+1) + ": " +
      (TOOL_DATA[type]?.name || "vacía"));
  }
  const types = Object.values(cells);
  $("buildingsCount").textContent = types.filter(x => x === "house" || x === "building").length;
  $("roadsCount").textContent = types.filter(x => x === "road").length;
  $("natureCount").textContent = types.filter(x => x === "tree" || x === "park").length;
  $("spaceCount").textContent = Math.round(100 * types.length / (SIZE * SIZE)) + "%";
}
function renderPlayers() {
  const host = $("playersList");
  host.replaceChildren();
  $("playerCount").textContent = state.user ? "1" : "0";
  if (!state.user) return;
  const row = document.createElement("div");
  row.className = "player";
  const avatar = document.createElement("span");
  avatar.className = "player-avatar avatar-a";
  avatar.textContent = "☺";
  const info = document.createElement("span");
  const name = document.createElement("strong");
  name.textContent = state.player + " (tú)";
  const subtitle = document.createElement("small");
  subtitle.textContent = "Los cambios de otros jugadores aparecen en el mapa";
  info.append(name, subtitle);
  row.append(avatar, info);
  host.append(row);
}
function renderActivity() {
  const host = $("activityList");
  host.replaceChildren();
  if (!state.activity.length) {
    const empty = document.createElement("p");
    empty.className = "empty-activity";
    empty.textContent = "Las acciones de esta sesión aparecerán aquí.";
    host.append(empty);
    return;
  }
  for (const action of state.activity.slice(0,7)) {
    const row = document.createElement("div");
    row.className = "activity-item";
    const symbol = document.createElement("span");
    symbol.className = "activity-icon";
    symbol.textContent = TOOL_DATA[action.tool]?.icon || "✳";
    const content = document.createElement("div");
    content.className = "activity-text";
    const label = document.createElement("strong");
    label.textContent = action.player + " " + TOOL_DATA[action.tool].verb;
    const timing = document.createElement("small");
    timing.textContent = new Date(action.time).toLocaleTimeString("es-EC", {
      hour: "2-digit", minute: "2-digit"
    });
    content.append(label, timing);
    row.append(symbol, content);
    host.append(row);
  }
}
function selectTool(tool) {
  if (!TOOL_DATA[tool]) return;
  state.tool = tool;
  document.querySelectorAll("[data-tool]").forEach(button => {
    const selected = button.dataset.tool === tool;
    button.classList.toggle("selected", selected);
    button.setAttribute("aria-pressed", String(selected));
  });
  $("currentToolLabel").textContent = TOOL_DATA[tool].icon + " Seleccionado: " + TOOL_DATA[tool].name;
  $("mapSubtitle").textContent = tool === "meteor" ? "Lanza un meteorito en una zona de 3 × 3" :
    tool === "erase" ? "Toca una casilla para eliminar el objeto" :
      "Coloca " + TOOL_DATA[tool].name + " sobre una casilla";
  clearPreview();
}
function clearPreview() {
  for (const tile of grid.children) tile.classList.remove("preview-impact");
}
function previewImpact(row,col) {
  if (state.tool !== "meteor") return;
  for (const tile of grid.children) {
    tile.classList.toggle("preview-impact", Math.max(
      Math.abs(Number(tile.dataset.row) - row),
      Math.abs(Number(tile.dataset.col) - col)
    ) <= 1);
  }
}
function animateMeteor(row,col) {
  if (!Number.isInteger(row) || !Number.isInteger(col)) return;
  const targets = [];
  for (let dr=-1;dr<=1;dr++) for (let dc=-1;dc<=1;dc++) {
    const tile = grid.querySelector('[data-row="' + (row+dr) + '"][data-col="' + (col+dc) + '"]');
    if (tile) {
      tile.classList.remove("impact");
      void tile.offsetWidth;
      tile.classList.add("impact");
      targets.push(tile);
    }
  }
  const center = grid.querySelector('[data-row="' + row + '"][data-col="' + col + '"]');
  if (!center) return;
  const rect = grid.getBoundingClientRect();
  const centerRect = center.getBoundingClientRect();
  const impact = document.createElement("span");
  impact.className = "impact-burst";
  impact.textContent = "☄️";
  impact.style.left = centerRect.left - rect.left + centerRect.width/2 + grid.offsetLeft + "px";
  impact.style.top = centerRect.top - rect.top + centerRect.height/2 + grid.offsetTop + "px";
  $("impactFx").append(impact);
  setTimeout(() => {
    impact.remove();
    targets.forEach(tile => tile.classList.remove("impact"));
  }, 900);
}
function updateUrl() {
  const url = new URL(location.href);
  url.searchParams.set("sala", state.room);
  history.replaceState(null, "", url);
}
function copyLink() {
  const url = new URL(location.href);
  url.searchParams.set("sala", state.room);
  navigator.clipboard.writeText(url.href)
    .then(() => showToast("Enlace de la sala copiado."))
    .catch(() => window.prompt("Copia este enlace:", url.href));
}
function stopPolling() {
  if (state.pollTimer) clearInterval(state.pollTimer);
  state.pollTimer = null;
  state.roomVersion += 1;
  state.loadVersion += 1;
}
async function loadWorld(room = state.room, version = state.roomVersion) {
  if (!state.user || room !== state.room || version !== state.roomVersion) return false;
  const requestId = ++state.loadVersion;
  const params = new URLSearchParams({
    room_id: "eq." + room,
    select: "row_index,col_index,object_type",
    limit: "200"
  });
  try {
    const rows = await request("/rest/v1/city_tiles?" + params);
    if (version !== state.roomVersion || requestId !== state.loadVersion) return false;
    const next = {};
    for (const item of rows || []) {
      if (Number.isInteger(item.row_index) && item.row_index >= 0 && item.row_index < SIZE &&
        Number.isInteger(item.col_index) && item.col_index >= 0 && item.col_index < SIZE &&
        ["house","building","road","tree","park"].includes(item.object_type)) {
        next[tileKey(item.row_index,item.col_index)] = item.object_type;
      }
    }
    state.cells = next;
    renderGrid();
    saveMessage("✓ Ciudad guardada en Supabase");
    return true;
  } catch (error) {
    if (version !== state.roomVersion) return false;
    console.error("No se pudo cargar city_tiles:",error);
    saveMessage("✕ Error al consultar la ciudad");
    if (error.status === 401) {
      status("error", "Sesión expirada");
      updateAuthUI("La sesión expiró. Cierra sesión y vuelve a entrar.");
    } else {
      status("error", "Error de datos");
      cloudHint("Error de Supabase: " + errorMessage(error));
    }
    return false;
  }
}
async function joinRoom(value) {
  stopPolling();
  const version = state.roomVersion;
  state.room = cleanRoom(value);
  roomInput.value = state.room;
  updateUrl();
  state.cells = {};
  state.activity = [];
  renderGrid();
  renderActivity();
  renderPlayers();
  if (!state.user) {
    status("local", "Inicia sesión");
    saveMessage("○ Inicia sesión para guardar");
    cloudHint("Inicia sesión para construir y compartir esta ciudad.");
    return;
  }
  status("connecting", "Conectando ciudad…");
  cloudHint("Cargando mapa guardado de Supabase…");
  saveMessage("◌ Consultando ciudad…");
  const ok = await loadWorld(state.room, version);
  if (!ok || version !== state.roomVersion) return;
  state.mode = "online";
  status("online", "Ciudad conectada");
  cloudHint("Ciudad en línea. Los cambios se guardan en Supabase y aparecen sin refrescar en otros dispositivos.",true);
  // Sincronización frecuente entre dispositivos sin depender de un WebSocket.
  state.pollTimer = setInterval(() => {
    if (version === state.roomVersion && state.user && !state.busy &&
        document.visibilityState !== "hidden") {
      void loadWorld(state.room, version);
    }
  }, 800);
}
async function handleTile(row, col) {
  if (!state.user) return showToast("Inicia sesión para construir y destruir.");
  if (state.mode !== "online") return showToast("Aún no se pudo conectar la ciudad. Revisa el mensaje a la derecha.");
  if (state.busy) return;
  state.busy = true;
  const version = state.roomVersion;
  const room = state.room;
  const tool = state.tool;
  saveMessage("◌ Guardando cambios…");
  try {
    const params = new URLSearchParams();
    if (tool === "meteor" || tool === "erase") {
      params.set("room_id", "eq." + room);
      if (tool === "meteor") {
        params.set("row_index", "gte." + Math.max(0, row-1));
        params.append("row_index", "lte." + Math.min(SIZE-1, row+1));
        params.set("col_index", "gte." + Math.max(0, col-1));
        params.append("col_index", "lte." + Math.min(SIZE-1, col+1));
      } else {
        params.set("row_index", "eq." + row);
        params.set("col_index", "eq." + col);
      }
      await request("/rest/v1/city_tiles?" + params, { method: "DELETE" });
    } else {
      params.set("on_conflict", "room_id,row_index,col_index");
      await request("/rest/v1/city_tiles?" + params, {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
        body: {
          room_id: room, row_index: row, col_index: col,
          object_type: tool, updated_at: new Date().toISOString()
        }
      });
    }
    if (version !== state.roomVersion) return;
    if (tool === "meteor") animateMeteor(row, col);
    const action = {
      tool, player: state.player, time: Date.now()
    };
    state.activity.unshift(action);
    state.activity = state.activity.slice(0,7);
    renderActivity();
    const loaded = await loadWorld(room,version);
    if (loaded) {
      saveMessage("✓ Construcción y destrucción guardadas");
      if (tool === "meteor") showToast("☄️ ¡Meteorito! Ciudad actualizada para todos.");
    }
  } catch (error) {
    console.error("No se pudo guardar la acción:", error);
    saveMessage("✕ No se guardó la acción");
    showToast("Supabase: " + errorMessage(error));
  } finally {
    state.busy = false;
  }
}
async function signIn(event) {
  event.preventDefault();
  if (!READY) return showToast("Faltan las variables públicas de Supabase.");
  const email = $("emailInput").value.trim();
  const password = $("passwordInput").value;
  const button = $("loginButton");
  button.disabled = true;
  updateAuthUI("Comprobando correo y contraseña…");
  try {
    const response = await http("/auth/v1/token?grant_type=password", {
      method: "POST", body: { email, password }
    });
    if (!response?.user?.id || !response.access_token || !response.refresh_token) {
      throw new Error("Supabase no devolvió una sesión completa.");
    }
    saveSession({
      ...response,
      expires_at: Math.floor(Date.now()/1000) + Number(response.expires_in || 3600)
    });
    state.user = response.user;
    state.player = cleanName(localStorage.getItem("citychaos_name_" + state.user.id) || userLabel());
    nameInput.value = state.player;
    $("passwordInput").value = "";
    updateAuthUI();
    renderPlayers();
    await joinRoom(state.room);
    if (state.mode === "online") showToast("¡Sesión iniciada! Ya puedes construir.");
    else showToast("Sesión iniciada; revisa el estado de conexión de la ciudad.");
  } catch (error) {
    const message = errorMessage(error);
    updateAuthUI("No fue posible iniciar sesión: " + message);
    showToast("Error: " + message);
  } finally {
    button.disabled = false;
  }
}
async function signOut() {
  const token = state.session?.access_token;
  stopPolling();
  saveSession(null);
  state.user = null;
  state.player = "Jugador";
  state.mode = "offline";
  state.cells = {};
  state.activity = [];
  renderGrid();
  renderActivity();
  renderPlayers();
  updateAuthUI();
  status("local", "Inicia sesión");
  cloudHint("Utiliza una de las cuentas de prueba para entrar a la misma ciudad.");
  saveMessage("○ Inicia sesión para guardar");
  if (token) {
    try { await http("/auth/v1/logout", { method: "POST", token }); }
    catch (error) { console.warn("El cierre remoto no se confirmó:",error); }
  }
  showToast("Sesión cerrada.");
}
function savePlayerName() {
  state.player = cleanName(nameInput.value);
  nameInput.value = state.player;
  if (state.user) localStorage.setItem("citychaos_name_" + state.user.id, state.player);
  renderPlayers();
  showToast("Nombre guardado: " + state.player);
}
async function restoreSession() {
  status("connecting", "Comprobando sesión…");
  if (!READY) {
    status("error", "Falta configuración");
    cloudHint("Configura VITE_SUPABASE_URL y VITE_SUPABASE_PUBLISHABLE_KEY en Production y redepliega.");
    saveMessage("✕ Falta configuración de Supabase");
    updateAuthUI();
    return;
  }
  const stored = readSession();
  if (!stored) {
    status("local", "Inicia sesión");
    cloudHint("Entra con uno de los dos usuarios de Supabase Authentication.");
    updateAuthUI();
    return;
  }
  state.session = stored;
  try {
    const token = await validToken();
    const user = await http("/auth/v1/user", { token });
    if (!user?.id) throw new Error("La sesión ya no es válida.");
    state.user = user;
    state.player = cleanName(localStorage.getItem("citychaos_name_" + user.id) || userLabel());
    nameInput.value = state.player;
    updateAuthUI();
    renderPlayers();
    await joinRoom(state.room);
  } catch (error) {
    console.warn("No se pudo recuperar la sesión anterior:",error);
    state.user = null;
    saveSession(null);
    state.mode = "offline";
    status("local", "Inicia sesión");
    updateAuthUI("La sesión anterior caducó. Inicia sesión nuevamente.");
    cloudHint("Introduce una de las dos cuentas de prueba para recuperar la ciudad.");
  }
}
function setupEvents() {
  document.querySelectorAll("[data-tool]").forEach(button =>
    button.addEventListener("click", () => selectTool(button.dataset.tool))
  );
  grid.addEventListener("click", event => {
    const tile = event.target.closest(".tile");
    if (tile) void handleTile(Number(tile.dataset.row), Number(tile.dataset.col));
  });
  grid.addEventListener("pointerover", event => {
    const tile = event.target.closest(".tile");
    if (tile) previewImpact(Number(tile.dataset.row), Number(tile.dataset.col));
  });
  grid.addEventListener("pointerleave", clearPreview);
  $("joinRoomButton").addEventListener("click", () => { void joinRoom(roomInput.value); });
  roomInput.addEventListener("keydown", event => {
    if (event.key === "Enter") void joinRoom(roomInput.value);
  });
  $("newRoomButton").addEventListener("click", () =>
    void joinRoom("CITY-" + Math.random().toString(36).slice(2,8).toUpperCase())
  );
  $("copyLinkButton").addEventListener("click", copyLink);
  $("shareTopButton").addEventListener("click", copyLink);
  $("saveNameButton").addEventListener("click", savePlayerName);
  nameInput.addEventListener("keydown", event => {
    if (event.key === "Enter") savePlayerName();
  });
  $("loginForm").addEventListener("submit", signIn);
  $("logoutButton").addEventListener("click", () => { void signOut(); });
  const dialog = $("helpDialog");
  $("helpButton").addEventListener("click", () => dialog.showModal());
  $("closeHelpButton").addEventListener("click", () => dialog.close());
  $("gotItButton").addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", event => {
    if (event.target === dialog) dialog.close();
  });
  document.addEventListener("keydown", event => {
    if (event.altKey || event.ctrlKey || event.metaKey ||
      ["INPUT","TEXTAREA"].includes(document.activeElement.tagName) || dialog.open) return;
    const options = {1:"house",2:"building",3:"road",4:"tree",5:"park",6:"meteor",7:"erase"};
    if (options[event.key]) selectTool(options[event.key]);
  });
}
initGrid();
renderGrid();
renderActivity();
renderPlayers();
selectTool("house");
setupEvents();
updateUrl();
updateAuthUI();
void restoreSession();
