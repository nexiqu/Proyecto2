import { firebaseConfig } from "./firebase-config.js";

const SIZE = 12;
const TOOL_DATA = {
  house: { name: "Casita", icon: "🏠", verb: "construyó una casa" },
  building: { name: "Edificio", icon: "🏢", verb: "levantó un edificio" },
  road: { name: "Carretera", icon: "🛣️", verb: "construyó una carretera" },
  tree: { name: "Árbol", icon: "🌳", verb: "plantó un árbol" },
  park: { name: "Jardín", icon: "🌷", verb: "creó un jardín" },
  meteor: { name: "Meteorito", icon: "☄️", verb: "lanzó un meteorito" },
  erase: { name: "Eliminar", icon: "🧹", verb: "eliminó un objeto" }
};
const $ = (id) => document.getElementById(id);
const grid = $("cityGrid");
const roomInput = $("roomInput");
const nameInput = $("nameInput");
const roomParam = new URLSearchParams(location.search).get("sala");
const localId = Math.random().toString(36).slice(2, 10);
const storedName = localStorage.getItem("citychaos_name") || "Jugador";
const state = {
  room: cleanRoom(roomParam || "CIUDAD-01"),
  player: cleanName(storedName),
  tool: "house",
  mode: "local",
  world: null,
  cloud: null,
  unsubs: [],
  presenceRef: null,
  worldRef: null,
  lastSeenAction: null,
  worldLoaded: false,
  joining: false,
  toastTimer: null
};
roomInput.value = state.room;
nameInput.value = state.player;

function cleanRoom(value) {
  return (String(value || "").toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 24) || "CIUDAD-01");
}
function cleanName(value) {
  return (String(value || "").trim().replace(/[<>]/g, "").slice(0, 18) || "Jugador");
}
const tileKey = (row, col) => row + "-" + col;
const localKey = (room) => "citychaos_world_v1_" + room;

function seedWorld() {
  const cells = {};
  for (let col = 0; col < SIZE; col++) cells[tileKey(5, col)] = "road";
  for (let row = 1; row < SIZE - 1; row++) cells[tileKey(row, 5)] = "road";
  const placements = [
    [1,1,"house"],[1,2,"house"],[2,1,"tree"],[2,3,"building"],
    [3,1,"house"],[3,3,"park"],[3,7,"house"],[3,9,"building"],
    [2,8,"tree"],[1,10,"park"],[4,10,"tree"],
    [7,1,"tree"],[7,2,"house"],[7,4,"park"],[8,8,"house"],
    [8,9,"house"],[9,2,"building"],[9,3,"tree"],[9,7,"tree"],
    [10,9,"park"],[10,10,"house"],[7,10,"building"]
  ];
  for (const [row,col,type] of placements) cells[tileKey(row,col)] = type;
  return { cells, revision: 0, activity: [], lastAction: null };
}

function getLocalWorld() {
  try {
    const value = localStorage.getItem(localKey(state.room));
    if (value) {
      const parsed = JSON.parse(value);
      if (parsed && typeof parsed.cells === "object") return parsed;
    }
  } catch (err) { console.warn("No se pudo leer el guardado local:", err); }
  return seedWorld();
}
function saveLocalWorld(world) {
  try {
    localStorage.setItem(localKey(state.room), JSON.stringify(world));
    return true;
  } catch (err) {
    console.warn("No se pudo guardar el mapa:", err);
    showToast("El navegador no permitió guardar el mapa.");
    return false;
  }
}
function showToast(message) {
  const toast = $("toast");
  clearTimeout(state.toastTimer);
  toast.textContent = message;
  toast.classList.add("show");
  state.toastTimer = setTimeout(() => toast.classList.remove("show"), 2500);
}
function setStatus(mode, message) {
  $("connectionBadge").className = "connection-badge is-" + mode;
  $("connectionText").textContent = message;
}
function updateCloudHint(message, online = false) {
  const hint = $("cloudHint");
  hint.textContent = message;
  hint.classList.toggle("connected", online);
}
function setLocalMode(reason) {
  state.mode = "local";
  state.worldLoaded = false;
  state.lastSeenAction = null;
  setStatus("local", "Demo local");
  updateCloudHint(reason || "Demo local: la ciudad se guarda en este navegador. Configura Firebase para jugar entre dispositivos.");
  setWorld(getLocalWorld());
  renderPlayers([{ name: state.player, self: true }]);
}
function updateUrl(room) {
  const url = new URL(window.location.href);
  url.searchParams.set("sala", room);
  history.replaceState(null, "", url);
}
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
      cell.setAttribute("aria-label", "Casilla " + (row + 1) + ", " + (col + 1) + ": vacía");
      const art = document.createElement("span");
      art.className = "tile-art";
      art.setAttribute("aria-hidden", "true");
      cell.append(art);
      fragment.append(cell);
    }
  }
  grid.append(fragment);
}
function getWorldCells() {
  const cells = state.world?.cells;
  return cells && typeof cells === "object" ? cells : {};
}
function refreshTiles() {
  const cells = getWorldCells();
  for (const tile of grid.children) {
    const row = Number(tile.dataset.row);
    const col = Number(tile.dataset.col);
    const type = cells[tileKey(row,col)] || "empty";
    tile.dataset.type = TOOL_DATA[type] && type !== "meteor" && type !== "erase" ? type : "empty";
    const icon = tile.querySelector(".tile-art");
    icon.textContent = type === "road" ? "" : TOOL_DATA[type]?.icon || "";
    const horizontal = Boolean(cells[tileKey(row, col - 1)] === "road" || cells[tileKey(row, col + 1)] === "road");
    const vertical = Boolean(cells[tileKey(row - 1, col)] === "road" || cells[tileKey(row + 1, col)] === "road");
    tile.classList.toggle("road-horizontal", horizontal && !vertical);
    tile.setAttribute("aria-label", "Fila " + (row + 1) + ", columna " + (col + 1) + ": " + (TOOL_DATA[type]?.name || "vacía"));
  }
}
function renderStats() {
  const values = Object.values(getWorldCells()).filter(Boolean);
  $("buildingsCount").textContent = values.filter((v) => v === "house" || v === "building").length;
  $("roadsCount").textContent = values.filter((v) => v === "road").length;
  $("natureCount").textContent = values.filter((v) => v === "tree" || v === "park").length;
  $("spaceCount").textContent = Math.round(values.length / (SIZE * SIZE) * 100) + "%";
}
function renderActivity() {
  const host = $("activityList");
  host.textContent = "";
  const items = Array.isArray(state.world?.activity) ? state.world.activity.slice(0, 7) : [];
  if (!items.length) {
    const placeholder = document.createElement("p");
    placeholder.className = "empty-activity";
    placeholder.textContent = "Empieza a construir para ver las acciones de los jugadores aquí.";
    host.append(placeholder);
    return;
  }
  for (const action of items) {
    const row = document.createElement("div");
    row.className = "activity-item";
    const icon = document.createElement("span");
    icon.className = "activity-icon";
    icon.textContent = TOOL_DATA[action.tool]?.icon || "✳";
    const message = document.createElement("div");
    message.className = "activity-text";
    const title = document.createElement("strong");
    title.textContent = cleanName(action.player) + " " + (TOOL_DATA[action.tool]?.verb || "modificó el mapa");
    const subtitle = document.createElement("small");
    const time = Number(action.time);
    const when = Number.isFinite(time) && time > 0 ? new Date(time).toLocaleTimeString("es-EC", {hour:"2-digit", minute:"2-digit"}) : "Recientemente";
    subtitle.textContent = when + " · " + (Number(action.count) || 0) + " casilla(s)";
    message.append(title, subtitle);
    row.append(icon, message);
    host.append(row);
  }
}
function setWorld(world) {
  state.world = world || seedWorld();
  refreshTiles();
  renderStats();
  renderActivity();
  const action = state.world.lastAction;
  if (!state.worldLoaded) {
    state.worldLoaded = true;
  } else if (action && action.id !== state.lastSeenAction) {
    if (action.tool === "meteor") animateMeteor(Number(action.row), Number(action.col));
  }
  state.lastSeenAction = action?.id || null;
}
function renderPlayers(players) {
  const host = $("playersList");
  host.textContent = "";
  $("playerCount").textContent = String(players.length);
  for (let i = 0; i < players.length; i++) {
    const person = players[i];
    const row = document.createElement("div");
    row.className = "player";
    const avatar = document.createElement("span");
    avatar.className = "player-avatar avatar-" + ["a","b","c"][i % 3];
    avatar.textContent = ["☺","✿","✦"][i % 3];
    const info = document.createElement("span");
    const title = document.createElement("strong");
    title.textContent = cleanName(person.name) + (person.self ? " (tú)" : "");
    const sub = document.createElement("small");
    sub.textContent = state.mode === "online" ? "Conectado ahora" : "Jugando en local";
    info.append(title, sub);
    const dot = document.createElement("span");
    dot.className = "player-status";
    dot.textContent = "●";
    row.append(avatar, info, dot);
    host.append(row);
  }
}
function mutateWorld(world, tool, row, col) {
  const prev = world && typeof world === "object" ? world : seedWorld();
  const cells = { ...(prev.cells || {}) };
  let count = 0;
  const put = (r, c, type) => {
    if (r < 0 || c < 0 || r >= SIZE || c >= SIZE) return;
    const key = tileKey(r, c);
    const before = cells[key] || null;
    if (before === type) return;
    if (type === null) delete cells[key]; else cells[key] = type;
    count += 1;
  };
  if (tool === "meteor") {
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) put(row + dr, col + dc, null);
    }
  } else if (tool === "erase") {
    put(row,col,null);
  } else {
    put(row,col,tool);
  }
  if (count === 0) return null;
  const action = {
    id: Date.now().toString(36) + "-" + localId + "-" + Math.random().toString(36).slice(2,6),
    player: state.player,
    tool, row, col, count,
    time: Date.now()
  };
  return {
    cells,
    revision: (Number(prev.revision) || 0) + 1,
    lastAction: action,
    activity: [action, ...(Array.isArray(prev.activity) ? prev.activity : [])].slice(0, 7)
  };
}
async function handleTile(row, col) {
  if (state.mode === "connecting") return showToast("Conectando con la ciudad compartida…");
  if (state.mode === "offline") return showToast("La conexión está interrumpida. Vuelve a conectarte.");
  const tool = state.tool;
  if (state.mode === "online" && state.cloud && state.worldRef) {
    try {
      const result = await state.cloud.runTransaction(state.worldRef, (current) => mutateWorld(current, tool, row, col), { applyLocally: false });
      if (!result.committed) showToast("No había nada que cambiar en esa zona.");
    } catch (err) {
      console.error("Error al guardar acción:", err);
      showToast("No se pudo guardar en Firebase. Revisa la conexión y los permisos.");
    }
    return;
  }
  const next = mutateWorld(state.world, tool, row, col);
  if (!next) return showToast("No había nada que cambiar en esa zona.");
  if (saveLocalWorld(next)) {
    setWorld(next);
    if (tool === "meteor") showToast("☄️ ¡Meteorito! La ciudad acaba de cambiar.");
  }
}
function animateMeteor(row, col) {
  if (!Number.isFinite(row) || !Number.isFinite(col)) return;
  const targets = [];
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      const tile = grid.querySelector('[data-row="' + (row+dr) + '"][data-col="' + (col+dc) + '"]');
      if (tile) {
        tile.classList.remove("impact");
        void tile.offsetWidth;
        tile.classList.add("impact");
        targets.push(tile);
      }
    }
  }
  const center = grid.querySelector('[data-row="' + row + '"][data-col="' + col + '"]');
  if (!center) return;
  const fx = $("impactFx");
  const sceneRect = $("cityGrid").getBoundingClientRect();
  const centerRect = center.getBoundingClientRect();
  const impact = document.createElement("span");
  impact.className = "impact-burst";
  impact.textContent = "☄️";
  impact.style.left = (centerRect.left - sceneRect.left + centerRect.width / 2 + grid.offsetLeft) + "px";
  impact.style.top = (centerRect.top - sceneRect.top + centerRect.height / 2 + grid.offsetTop) + "px";
  fx.append(impact);
  setTimeout(() => { impact.remove(); targets.forEach((tile) => tile.classList.remove("impact")); }, 900);
}
function previewImpact(row, col) {
  for (const tile of grid.children) {
    const dr = Math.abs(Number(tile.dataset.row) - row);
    const dc = Math.abs(Number(tile.dataset.col) - col);
    tile.classList.toggle("preview-impact", state.tool === "meteor" && dr <= 1 && dc <= 1);
  }
}
function clearPreview() {
  for (const tile of grid.children) tile.classList.remove("preview-impact");
}
function selectTool(tool) {
  if (!TOOL_DATA[tool]) return;
  state.tool = tool;
  document.querySelectorAll(".tool").forEach((button) => {
    const selected = button.dataset.tool === tool;
    button.classList.toggle("selected", selected);
    button.setAttribute("aria-pressed", String(selected));
  });
  $("currentToolLabel").textContent = TOOL_DATA[tool].icon + " Seleccionado: " + TOOL_DATA[tool].name;
  $("mapSubtitle").textContent = tool === "meteor" ? "Elige dónde impactará el meteorito" : tool === "erase" ? "Toca una casilla para despejarla" : "Haz clic en el mapa para colocar: " + TOOL_DATA[tool].name;
  clearPreview();
}
function leaveRoom() {
  state.unsubs.forEach((unsub) => { try { unsub(); } catch (err) { console.warn(err); } });
  state.unsubs = [];
  if (state.presenceRef && state.cloud) {
    state.cloud.remove(state.presenceRef).catch(() => {});
  }
  state.presenceRef = null;
  state.worldRef = null;
  state.worldLoaded = false;
  state.lastSeenAction = null;
}
async function joinRoom(inputValue) {
  const room = cleanRoom(inputValue);
  if (state.joining) return;
  state.joining = true;
  leaveRoom();
  state.room = room;
  roomInput.value = room;
  updateUrl(room);
  if (!state.cloud) {
    setLocalMode();
    showToast("Entraste a la sala " + room + " en modo local.");
    state.joining = false;
    return;
  }
  state.mode = "connecting";
  setStatus("connecting", "Conectando…");
  const c = state.cloud;
  const base = "rooms/" + room;
  const worldRef = c.ref(c.db, base + "/world");
  const presenceRef = c.ref(c.db, base + "/presence/" + c.uid);
  state.worldRef = worldRef;
  state.presenceRef = presenceRef;
  try {
    await c.runTransaction(worldRef, (value) => value || seedWorld(), { applyLocally:false });
    if (state.room !== room) return;
    const unsubscribeWorld = c.onValue(worldRef, (snapshot) => {
      setWorld(snapshot.val() || seedWorld());
    }, (err) => {
      console.error("Lectura de la ciudad denegada:", err);
      setStatus("error", "Error de permisos");
      showToast("Firebase denegó la lectura. Revisa las reglas de la base de datos.");
    });
    const unsubscribePlayers = c.onValue(c.ref(c.db,base + "/presence"), (snapshot) => {
      const raw = snapshot.val() || {};
      const players = Object.entries(raw).map(([uid, data]) => ({ name: data?.name || "Jugador", self: uid === c.uid }));
      renderPlayers(players);
    });
    const unsubscribeConnected = c.onValue(c.ref(c.db, ".info/connected"), async (snapshot) => {
      if (state.room !== room) return;
      if (snapshot.val() === true) {
        try {
          await c.onDisconnect(presenceRef).remove();
          await c.set(presenceRef, { name: state.player, joined: c.serverTimestamp() });
          if (state.room !== room) return;
          state.mode = "online";
          setStatus("online", "En tiempo real");
          updateCloudHint("Conectado a Firebase. Comparte el enlace: otros jugadores verán la ciudad y sus cambios en vivo.", true);
          $("saveMessage").textContent = "✓ Guardado en la nube";
        } catch (err) {
          console.error("Error en presencia:", err);
          state.mode = "offline";
          setStatus("error", "Error de Firebase");
          updateCloudHint("No se pudo entrar. Verifica las reglas de Firebase y que Anonymous Authentication esté activado.");
        }
      } else {
        state.mode = "offline";
        setStatus("connecting", "Reconectando…");
        updateCloudHint("Se perdió la conexión. Los cambios se reanudarán al volver a conectarte.");
      }
    });
    state.unsubs = [unsubscribeWorld, unsubscribePlayers, unsubscribeConnected];
  } catch (err) {
    console.error("No se pudo unir a la sala:", err);
    leaveRoom();
    setLocalMode("No se pudo conectar a Firebase. Revisa los ajustes, el inicio de sesión anónimo y las reglas. La demo local sigue disponible.");
    showToast("No se pudo conectar a Firebase; abrimos la demo local.");
  } finally {
    state.joining = false;
  }
}
async function initializeFirebase() {
  const necessary = ["apiKey","authDomain","databaseURL","projectId","appId"];
  if (!necessary.every((key) => typeof firebaseConfig[key] === "string" && firebaseConfig[key].trim())) {
    setLocalMode();
    $("saveMessage").textContent = "◉ Guardado en este navegador";
    return;
  }
  state.mode = "connecting";
  setStatus("connecting", "Iniciando Firebase…");
  updateCloudHint("Conectando a la base de datos compartida…");
  try {
    const version = "11.10.0";
    const [{ initializeApp }, authModule, databaseModule] = await Promise.all([
      import("https://www.gstatic.com/firebasejs/" + version + "/firebase-app.js"),
      import("https://www.gstatic.com/firebasejs/" + version + "/firebase-auth.js"),
      import("https://www.gstatic.com/firebasejs/" + version + "/firebase-database.js")
    ]);
    const app = initializeApp(firebaseConfig);
    const auth = authModule.getAuth(app);
    const user = (await authModule.signInAnonymously(auth)).user;
    const db = databaseModule.getDatabase(app);
    state.cloud = {
      ...databaseModule, db, uid: user.uid
    };
    await joinRoom(state.room);
  } catch (err) {
    console.error("No se pudo iniciar Firebase:", err);
    state.cloud = null;
    setLocalMode("Firebase no se pudo iniciar. Verifica la configuración, Realtime Database y Anonymous Authentication. Esta demo solo guarda datos localmente.");
    $("saveMessage").textContent = "◉ Guardado en este navegador";
    showToast("No se pudo iniciar Firebase. Revisa la consola para más detalles.");
  }
}
function savePlayerName() {
  state.player = cleanName(nameInput.value);
  nameInput.value = state.player;
  localStorage.setItem("citychaos_name", state.player);
  if (state.mode === "online" && state.presenceRef && state.cloud) {
    state.cloud.set(state.presenceRef, { name: state.player, joined: state.cloud.serverTimestamp() })
      .catch(() => showToast("No se pudo actualizar el nombre."));
  } else {
    renderPlayers([{ name:state.player, self:true }]);
  }
  showToast("Nombre guardado: " + state.player);
}
async function copyRoomLink() {
  const url = new URL(window.location.href);
  url.searchParams.set("sala", state.room);
  try {
    await navigator.clipboard.writeText(url.href);
    showToast(state.mode === "online" ? "¡Enlace copiado! Envíalo al otro jugador." : "Enlace copiado; para sincronizar entre dispositivos, activa Firebase.");
  } catch {
    window.prompt("Copia este enlace para compartir:", url.href);
  }
}
function setupEvents() {
  document.querySelectorAll("[data-tool]").forEach((button) => button.addEventListener("click", () => selectTool(button.dataset.tool)));
  grid.addEventListener("click", (event) => {
    const tile = event.target.closest(".tile");
    if (tile) handleTile(Number(tile.dataset.row), Number(tile.dataset.col));
  });
  grid.addEventListener("pointerover", (event) => {
    const tile = event.target.closest(".tile");
    if (tile && state.tool === "meteor") previewImpact(Number(tile.dataset.row), Number(tile.dataset.col));
  });
  grid.addEventListener("pointerleave", clearPreview);
  $("joinRoomButton").addEventListener("click", () => joinRoom(roomInput.value));
  roomInput.addEventListener("keydown", (event) => { if (event.key === "Enter") joinRoom(roomInput.value); });
  $("newRoomButton").addEventListener("click", () => joinRoom("CITY-" + Math.random().toString(36).slice(2,7).toUpperCase()));
  $("saveNameButton").addEventListener("click", savePlayerName);
  nameInput.addEventListener("keydown", (event) => { if (event.key === "Enter") savePlayerName(); });
  $("copyLinkButton").addEventListener("click", copyRoomLink);
  $("shareTopButton").addEventListener("click", copyRoomLink);
  const dialog = $("helpDialog");
  $("helpButton").addEventListener("click", () => dialog.showModal());
  $("closeHelpButton").addEventListener("click", () => dialog.close());
  $("gotItButton").addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", (event) => { if (event.target === dialog) dialog.close(); });
  document.addEventListener("keydown", (event) => {
    if (event.altKey || event.ctrlKey || event.metaKey || ["INPUT","TEXTAREA"].includes(document.activeElement.tagName) || dialog.open) return;
    const keys = {1:"house",2:"building",3:"road",4:"tree",5:"park",6:"meteor",7:"erase"};
    if (keys[event.key]) selectTool(keys[event.key]);
  });
}
initGrid();
setupEvents();
selectTool("house");
updateUrl(state.room);
initializeFirebase();
