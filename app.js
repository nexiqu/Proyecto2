import { createClient } from "@supabase/supabase-js";

const SIZE = 12;
const URL = import.meta.env.VITE_SUPABASE_URL;
const KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const supabase = URL && KEY ? createClient(URL, KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false }
}) : null;

const TOOL_DATA = {
  house: { name: "Casita", icon: "🏠", verb: "construyó una casa" },
  building: { name: "Edificio", icon: "🏢", verb: "levantó un edificio" },
  road: { name: "Carretera", icon: "🛣️", verb: "colocó una carretera" },
  tree: { name: "Árbol", icon: "🌳", verb: "plantó un árbol" },
  park: { name: "Jardín", icon: "🌷", verb: "creó un jardín" },
  meteor: { name: "Meteorito", icon: "☄️", verb: "lanzó un meteorito" },
  erase: { name: "Eliminar", icon: "🧹", verb: "eliminó un objeto" }
};
const $ = (id) => document.getElementById(id);
const grid = $("cityGrid");
const roomInput = $("roomInput");
const nameInput = $("nameInput");
const state = {
  room: cleanRoom(new URLSearchParams(location.search).get("sala") || "CIUDAD-01"),
  user: null, tool: "house", mode: "offline", channel: null,
  cells: {}, activity: [], player: "Jugador",
  roomVersion: 0, requestVersion: 0, refreshTimer: null, toastTimer: null,
  authChangeVersion: 0
};
roomInput.value = state.room;

function cleanRoom(value) {
  return (String(value || "").toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 24) || "CIUDAD-01");
}
function cleanName(value) {
  return String(value || "").trim().replace(/[<>]/g, "").slice(0, 18) || "Jugador";
}
function tileKey(row, col) { return row + "-" + col; }
function showToast(message) {
  const toast = $("toast");
  clearTimeout(state.toastTimer);
  toast.textContent = message;
  toast.classList.add("show");
  state.toastTimer = setTimeout(() => toast.classList.remove("show"), 3100);
}
function status(mode, message) {
  $("connectionBadge").className = "connection-badge is-" + mode;
  $("connectionText").textContent = message;
}
function cloudHint(message, connected = false) {
  $("cloudHint").textContent = message;
  $("cloudHint").classList.toggle("connected", connected);
}
function saveMessage(message) { $("saveMessage").textContent = message; }

function initGrid() {
  grid.textContent = "";
  const fragment = document.createDocumentFragment();
  for (let row = 0; row < SIZE; row++) {
    for (let col = 0; col < SIZE; col++) {
      const cell = document.createElement("button");
      cell.type = "button";
      cell.className = "tile";
      cell.dataset.row = String(row);
      cell.dataset.col = String(col);
      cell.dataset.type = "empty";
      cell.setAttribute("aria-label", "Fila " + (row + 1) + ", columna " + (col + 1) + ": vacía");
      const icon = document.createElement("span");
      icon.className = "tile-art";
      icon.setAttribute("aria-hidden", "true");
      cell.append(icon);
      fragment.append(cell);
    }
  }
  grid.append(fragment);
}
function renderGrid() {
  const cells = state.cells;
  for (const tile of grid.children) {
    const row = Number(tile.dataset.row);
    const col = Number(tile.dataset.col);
    const type = cells[tileKey(row, col)] || "empty";
    tile.dataset.type = type;
    tile.querySelector(".tile-art").textContent = type === "road" ? "" : (TOOL_DATA[type]?.icon || "");
    const horizontal = cells[tileKey(row,col-1)] === "road" || cells[tileKey(row,col+1)] === "road";
    const vertical = cells[tileKey(row-1,col)] === "road" || cells[tileKey(row+1,col)] === "road";
    tile.classList.toggle("road-horizontal", Boolean(horizontal && !vertical));
    tile.setAttribute("aria-label", "Fila " + (row + 1) + ", columna " + (col + 1) + ": " + (TOOL_DATA[type]?.name || "vacía"));
  }
  const values = Object.values(cells);
  $("buildingsCount").textContent = values.filter(v => v === "house" || v === "building").length;
  $("roadsCount").textContent = values.filter(v => v === "road").length;
  $("natureCount").textContent = values.filter(v => v === "tree" || v === "park").length;
  $("spaceCount").textContent = Math.round((values.length / (SIZE * SIZE)) * 100) + "%";
}
function renderActivity() {
  const host = $("activityList");
  host.textContent = "";
  if (!state.activity.length) {
    const p = document.createElement("p");
    p.className = "empty-activity";
    p.textContent = "Las acciones de esta sesión aparecerán aquí.";
    host.append(p);
    return;
  }
  for (const entry of state.activity.slice(0, 7)) {
    const item = document.createElement("div");
    item.className = "activity-item";
    const icon = document.createElement("span");
    icon.className = "activity-icon";
    icon.textContent = TOOL_DATA[entry.tool]?.icon || "✳";
    const body = document.createElement("div");
    body.className = "activity-text";
    const label = document.createElement("strong");
    label.textContent = cleanName(entry.player) + " " + (TOOL_DATA[entry.tool]?.verb || "modificó la ciudad");
    const time = document.createElement("small");
    time.textContent = new Date(entry.time).toLocaleTimeString("es-EC",{hour:"2-digit",minute:"2-digit"});
    body.append(label,time);
    item.append(icon,body);
    host.append(item);
  }
}
function logAction(action) {
  if (!action || !TOOL_DATA[action.tool]) return;
  if (state.activity.some(a => a.id === action.id)) return;
  state.activity.unshift(action);
  state.activity = state.activity.slice(0, 7);
  renderActivity();
}
function playerFromAccount(user) {
  return cleanName(localStorage.getItem("citychaos_name_" + user.id) || user.email?.split("@")[0] || "Jugador");
}
function renderPlayers() {
  const host = $("playersList");
  host.textContent = "";
  let players = [];
  if (state.channel && state.user) {
    for (const presences of Object.values(state.channel.presenceState())) {
      for (const entry of presences) players.push({
        uid: entry.uid, name: cleanName(entry.name), self: entry.uid === state.user.id
      });
    }
  }
  if (!players.length && state.user) players = [{ uid: state.user.id, name: state.player, self: true }];
  const dedup = new Map(players.map(p => [p.uid, p]));
  players = [...dedup.values()];
  $("playerCount").textContent = String(players.length);
  for (let index = 0; index < players.length; index++) {
    const person = players[index];
    const node = document.createElement("div");
    node.className = "player";
    const avatar = document.createElement("span");
    avatar.className = "player-avatar avatar-" + ["a","b","c"][index%3];
    avatar.textContent = ["☺","✿","✦"][index%3];
    const description = document.createElement("span");
    const name = document.createElement("strong");
    name.textContent = person.name + (person.self ? " (tú)" : "");
    const sub = document.createElement("small");
    sub.textContent = state.mode === "online" ? "Conectado" : "Esperando conexión";
    description.append(name,sub);
    const dot = document.createElement("span");
    dot.className = "player-status";
    dot.textContent = "●";
    node.append(avatar,description,dot);
    host.append(node);
  }
}
function selectTool(tool) {
  if (!TOOL_DATA[tool]) return;
  state.tool = tool;
  document.querySelectorAll(".tool").forEach(button => {
    const active = button.dataset.tool === tool;
    button.classList.toggle("selected", active);
    button.setAttribute("aria-pressed", String(active));
  });
  $("currentToolLabel").textContent = TOOL_DATA[tool].icon + " Seleccionado: " + TOOL_DATA[tool].name;
  $("mapSubtitle").textContent = tool === "meteor" ? "Toca el mapa para lanzar un meteorito" :
    tool === "erase" ? "Toca una casilla para despejarla" : "Coloca " + TOOL_DATA[tool].name + " sobre una casilla";
  clearPreview();
}
function clearPreview() {
  for (const tile of grid.children) tile.classList.remove("preview-impact");
}
function previewImpact(row,col) {
  if (state.tool !== "meteor") return;
  for (const tile of grid.children) {
    const distance = Math.max(Math.abs(Number(tile.dataset.row) - row), Math.abs(Number(tile.dataset.col) - col));
    tile.classList.toggle("preview-impact", distance <= 1);
  }
}
function animateMeteor(row,col) {
  if (!Number.isInteger(row) || !Number.isInteger(col)) return;
  const targets = [];
  for (let dr=-1;dr<=1;dr++) {
    for (let dc=-1;dc<=1;dc++) {
      const tile = grid.querySelector('[data-row="'+(row+dr)+'"][data-col="'+(col+dc)+'"]');
      if (tile) {
        tile.classList.remove("impact");
        void tile.offsetWidth;
        tile.classList.add("impact");
        targets.push(tile);
      }
    }
  }
  const center = grid.querySelector('[data-row="'+row+'"][data-col="'+col+'"]');
  if (!center) return;
  const rect = grid.getBoundingClientRect();
  const centerRect = center.getBoundingClientRect();
  const burst = document.createElement("span");
  burst.className = "impact-burst";
  burst.textContent = "☄️";
  burst.style.left = (centerRect.left - rect.left + centerRect.width/2 + grid.offsetLeft) + "px";
  burst.style.top = (centerRect.top - rect.top + centerRect.height/2 + grid.offsetTop) + "px";
  $("impactFx").append(burst);
  setTimeout(() => {
    burst.remove();
    targets.forEach(tile => tile.classList.remove("impact"));
  }, 900);
}
function updateUrl() {
  const url = new URL(window.location.href);
  url.searchParams.set("sala", state.room);
  history.replaceState(null, "", url);
}
async function copyRoomLink() {
  const url = new URL(window.location.href);
  url.searchParams.set("sala",state.room);
  try {
    await navigator.clipboard.writeText(url.href);
    showToast("¡Enlace copiado! Envíalo a la otra persona.");
  } catch {
    window.prompt("Copia este enlace:",url.href);
  }
}
async function loadWorld(room=state.room,version=state.roomVersion) {
  if (!supabase || !state.user || version !== state.roomVersion) return;
  const request = ++state.requestVersion;
  const { data,error } = await supabase.from("city_tiles")
    .select("row_index,col_index,object_type")
    .eq("room_id",room)
    .limit(500);
  if (version !== state.roomVersion || request !== state.requestVersion) return;
  if (error) {
    console.error("Error leyendo ciudad:", error);
    saveMessage("✕ No se pudo leer la ciudad");
    showToast("No se pudo cargar la ciudad: " + error.message);
    return;
  }
  const cells = {};
  for (const item of data || []) {
    if (item.row_index >= 0 && item.row_index < SIZE &&
        item.col_index >= 0 && item.col_index < SIZE &&
        ["house","building","road","tree","park"].includes(item.object_type)) {
      cells[tileKey(item.row_index,item.col_index)] = item.object_type;
    }
  }
  state.cells = cells;
  renderGrid();
  saveMessage("✓ Ciudad guardada en Supabase");
}
function scheduleRefresh() {
  clearTimeout(state.refreshTimer);
  const version = state.roomVersion;
  state.refreshTimer = setTimeout(() => { void loadWorld(state.room,version); }, 130);
}
async function closeRoom() {
  state.roomVersion += 1;
  state.requestVersion += 1;
  clearTimeout(state.refreshTimer);
  if (state.channel && supabase) {
    const old = state.channel;
    state.channel = null;
    await supabase.removeChannel(old);
  }
}
async function joinRoom(rawRoom) {
  const room = cleanRoom(rawRoom);
  await closeRoom();
  state.room = room;
  roomInput.value = room;
  updateUrl();
  state.cells = {};
  state.activity = [];
  renderGrid();
  renderActivity();
  renderPlayers();
  if (!supabase || !state.user) {
    status("local", "Inicia sesión");
    cloudHint("Inicia sesión con uno de los usuarios de prueba para entrar a la ciudad compartida.");
    saveMessage("○ Inicia sesión para guardar");
    return;
  }
  state.mode = "connecting";
  status("connecting", "Conectando…");
  saveMessage("◌ Cargando ciudad…");
  const version = state.roomVersion;
  const channel = supabase.channel("city-" + room, {
    config: { presence: { key: state.user.id } }
  });
  state.channel = channel;
  channel.on("presence", { event:"sync" }, () => {
    if (version === state.roomVersion) renderPlayers();
  });
  channel.on("broadcast", { event:"city_changed" }, ({ payload }) => {
    if (version !== state.roomVersion || payload?.room !== room) return;
    logAction(payload);
    if (payload.tool === "meteor") animateMeteor(Number(payload.row),Number(payload.col));
    scheduleRefresh();
  });
  channel.on("postgres_changes", {
    event:"*", schema:"public",table:"city_tiles"
  }, payload => {
    if (version !== state.roomVersion) return;
    // DELETE puede no incluir todas las columnas según RLS;
    // releer el mapa completo garantiza que ambos vean destrucciones.
    if (payload.eventType === "DELETE" ||
        payload.new?.room_id === room || payload.old?.room_id === room) {
      scheduleRefresh();
    }
  });
  channel.subscribe(async (subscriptionStatus) => {
    if (version !== state.roomVersion || state.channel !== channel) return;
    if (subscriptionStatus === "SUBSCRIBED") {
      state.mode = "online";
      status("online", "En tiempo real");
      cloudHint("Conectado a Supabase. Comparte esta sala: los dos jugadores verán los cambios automáticamente.",true);
      const tracked = await channel.track({uid:state.user.id,name:state.player,joined_at:new Date().toISOString()});
      if (tracked !== "ok") console.warn("No se pudo compartir la presencia:",tracked);
      void loadWorld(room,version);
    } else if (subscriptionStatus === "CHANNEL_ERROR" || subscriptionStatus === "TIMED_OUT") {
      state.mode = "connecting";
      status("error", "Reconectando…");
      cloudHint("Hay un problema de conexión en tiempo real. Revisa internet y la publicación Realtime de city_tiles.");
      void loadWorld(room,version);
    } else if (subscriptionStatus === "CLOSED") {
      state.mode = "offline";
      status("error","Desconectado");
    }
  });
}
async function handleTile(row,col) {
  if (!state.user) return showToast("Primero inicia sesión con una cuenta de prueba.");
  if (state.mode !== "online") return showToast("La conexión aún no está lista; inténtalo de nuevo.");
  const room = state.room;
  const version = state.roomVersion;
  const tool = state.tool;
  saveMessage("◌ Guardando cambios…");
  try {
    let result;
    if (tool === "meteor") {
      result = await supabase.from("city_tiles").delete()
        .eq("room_id",room)
        .gte("row_index",Math.max(0,row-1))
        .lte("row_index",Math.min(SIZE-1,row+1))
        .gte("col_index",Math.max(0,col-1))
        .lte("col_index",Math.min(SIZE-1,col+1));
    } else if (tool === "erase") {
      result = await supabase.from("city_tiles").delete()
        .eq("room_id",room).eq("row_index",row).eq("col_index",col);
    } else {
      result = await supabase.from("city_tiles").upsert({
        room_id:room,row_index:row,col_index:col,object_type:tool,updated_at:new Date().toISOString()
      },{onConflict:"room_id,row_index,col_index"});
    }
    if (result.error) throw result.error;
    if (version !== state.roomVersion) return;
    const action = {
      id:crypto.randomUUID(),room,tool,row,col,player:state.player,time:Date.now()
    };
    logAction(action);
    if (tool === "meteor") animateMeteor(row,col);
    await loadWorld(room,version);
    // Broadcast mejora la respuesta del otro jugador; postgres_changes
    // sigue siendo la fuente independiente de sincronización.
    if (state.channel) {
      void state.channel.send({type:"broadcast",event:"city_changed",payload:action});
    }
  } catch (err) {
    console.error("No se pudo guardar:",err);
    saveMessage("✕ Error al guardar");
    showToast("No se pudo guardar: " + (err?.message || "revisa la conexión"));
  }
}
function updateAuthUI() {
  const loggedIn = Boolean(state.user);
  $("authSignedOut").hidden = loggedIn;
  $("authSignedIn").hidden = !loggedIn;
  $("userEmailLabel").textContent = state.user?.email || "";
  $("authStatus").textContent = loggedIn ? "✓ Cuenta conectada" :
    supabase ? "Entra con una cuenta creada en Authentication → Users." :
    "Faltan VITE_SUPABASE_URL y VITE_SUPABASE_PUBLISHABLE_KEY en Vercel.";
  $("loginButton").disabled = !supabase;
}
async function processSession(session) {
  const user = session?.user || null;
  if (state.user?.id === user?.id) return;
  const version = ++state.authChangeVersion;
  await closeRoom();
  if (version !== state.authChangeVersion) return;
  state.user = user;
  state.player = user ? playerFromAccount(user) : "Jugador";
  nameInput.value = state.player;
  updateAuthUI();
  if (user) {
    await joinRoom(state.room);
  } else {
    state.mode = "offline";
    state.cells = {};
    state.activity = [];
    renderGrid();
    renderActivity();
    renderPlayers();
    status("local","Inicia sesión");
    cloudHint("Inicia sesión con una de las dos cuentas de prueba. Tu ciudad se guardará en Supabase.");
    saveMessage("○ Inicia sesión para guardar");
  }
}
async function signIn(event) {
  event.preventDefault();
  if (!supabase) return showToast("Faltan las variables de Supabase en Vercel.");
  const email = $("emailInput").value.trim();
  const password = $("passwordInput").value;
  $("loginButton").disabled = true;
  $("authStatus").textContent = "Verificando cuenta…";
  try {
    const {error} = await supabase.auth.signInWithPassword({email,password});
    if (error) throw error;
    $("passwordInput").value = "";
    showToast("¡Sesión iniciada! Entrando a tu ciudad.");
  } catch (err) {
    $("authStatus").textContent = "No se pudo entrar: " + (err?.message || "revisa tus datos");
    showToast("Revisa el correo, contraseña y confirmación del usuario.");
  } finally {
    $("loginButton").disabled = false;
  }
}
async function logout() {
  if (!supabase) return;
  const {error} = await supabase.auth.signOut();
  if (error) showToast("No se pudo cerrar sesión: " + error.message);
  else showToast("Sesión cerrada.");
}
async function savePlayerName() {
  state.player = cleanName(nameInput.value);
  nameInput.value = state.player;
  if (state.user) {
    localStorage.setItem("citychaos_name_" + state.user.id,state.player);
    if (state.channel && state.mode === "online") {
      const result = await state.channel.track({
        uid:state.user.id,name:state.player,joined_at:new Date().toISOString()
      });
      if (result !== "ok") showToast("Nombre guardado en tu navegador; presencia no actualizada.");
    }
  }
  renderPlayers();
  showToast("Nombre guardado: " + state.player);
}
function setupEvents() {
  document.querySelectorAll("[data-tool]").forEach(button => {
    button.addEventListener("click", () => selectTool(button.dataset.tool));
  });
  grid.addEventListener("click",event => {
    const tile = event.target.closest(".tile");
    if (tile) void handleTile(Number(tile.dataset.row),Number(tile.dataset.col));
  });
  grid.addEventListener("pointerover",event => {
    const tile = event.target.closest(".tile");
    if (tile) previewImpact(Number(tile.dataset.row),Number(tile.dataset.col));
  });
  grid.addEventListener("pointerleave",clearPreview);
  $("joinRoomButton").addEventListener("click",() => { void joinRoom(roomInput.value); });
  roomInput.addEventListener("keydown",event => { if (event.key === "Enter") void joinRoom(roomInput.value); });
  $("newRoomButton").addEventListener("click",() => { void joinRoom("CITY-" + Math.random().toString(36).slice(2,8).toUpperCase()); });
  $("copyLinkButton").addEventListener("click",copyRoomLink);
  $("shareTopButton").addEventListener("click",copyRoomLink);
  $("saveNameButton").addEventListener("click",() => { void savePlayerName(); });
  nameInput.addEventListener("keydown",event => { if (event.key === "Enter") void savePlayerName(); });
  $("loginForm").addEventListener("submit",signIn);
  $("logoutButton").addEventListener("click",logout);
  const dialog = $("helpDialog");
  $("helpButton").addEventListener("click",() => dialog.showModal());
  $("closeHelpButton").addEventListener("click",() => dialog.close());
  $("gotItButton").addEventListener("click",() => dialog.close());
  dialog.addEventListener("click",event => { if (event.target === dialog) dialog.close(); });
  document.addEventListener("keydown",event => {
    if (event.altKey || event.ctrlKey || event.metaKey ||
        ["INPUT","TEXTAREA"].includes(document.activeElement.tagName) || dialog.open) return;
    const tools = {1:"house",2:"building",3:"road",4:"tree",5:"park",6:"meteor",7:"erase"};
    if (tools[event.key]) selectTool(tools[event.key]);
  });
}

initGrid();
setupEvents();
selectTool("house");
renderGrid();
renderActivity();
updateUrl();
updateAuthUI();
if (supabase) {
  supabase.auth.onAuthStateChange((_event,session) => {
    // La llamada diferida evita reentrar en Supabase dentro del callback de Auth.
    setTimeout(() => { void processSession(session); },0);
  });
  status("connecting","Comprobando sesión…");
} else {
  status("error","Falta configuración");
  cloudHint("Configura las dos variables VITE_SUPABASE_* en Vercel y vuelve a desplegar.");
  saveMessage("✕ Supabase no está configurado");
}
