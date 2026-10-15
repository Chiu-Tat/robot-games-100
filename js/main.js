const DWELL = 4.2;
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const heroCanvas = document.querySelector("#hero-canvas");
const viewerCanvas = document.querySelector("#viewer-canvas");
const viewer = document.querySelector("#viewer");
const grid = document.querySelector("#grid");
const empty = document.querySelector("#empty");
const filtersEl = document.querySelector("#filters");
const searchEl = document.querySelector("#search");
const resultCount = document.querySelector("#result-count");
const tourBar = document.querySelector("#tour-bar");

let heroIndex = 0;
let filterId = "all";
let query = "";
let touring = !reduceMotion;
let motionOn = !reduceMotion;
let heroTimer = 0;
let lastTime = 0;
let viewerId = null;

const phases = new WeakMap();
const visible = new Set();
let observer = null;

function pad(n) {
  return String(n).padStart(2, "0");
}

function fit(canvas) {
  const rect = canvas.getBoundingClientRect();
  const w = rect.width;
  const h = rect.height;
  if (w < 2 || h < 2) return null;
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  const pw = Math.round(w * ratio);
  const ph = Math.round(h * ratio);
  if (canvas.width !== pw || canvas.height !== ph) {
    canvas.width = pw;
    canvas.height = ph;
  }
  const ctx = canvas.getContext("2d");
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  return { ctx, w, h };
}

function paint(canvas, game, advance, dt) {
  if (!game) return;
  let phase = phases.get(canvas) ?? 0.12;
  if (advance && motionOn) phase = (phase + dt * game.speed) % 1;
  phases.set(canvas, phase);
  const fitted = fit(canvas);
  if (!fitted) return;
  renderFrame(fitted.ctx, fitted.w, fitted.h, game, phase);
}

function filtered() {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  return GAMES.filter((game) => {
    if (filterId !== "all" && game.category !== filterId) return false;
    if (!words.length) return true;
    const category = categoryById(game.category);
    const hay = [
      game.name,
      game.summary,
      game.motion,
      game.prop || "",
      game.play || "",
      game.keys || "",
      category.name,
      category.id,
      category.keys || "",
    ]
      .join(" ")
      .toLowerCase();
    return words.every((word) => hay.includes(word));
  });
}

function sequence() {
  const list = filtered();
  if (viewerId && list.some((game) => game.id === viewerId)) return list;
  return GAMES;
}

function showHero(index, reset) {
  heroIndex = (index + GAMES.length) % GAMES.length;
  heroTimer = 0;
  if (reset) phases.set(heroCanvas, 0);
  const game = GAMES[heroIndex];
  const category = categoryById(game.category);
  document.querySelector("#hero-index").textContent = pad(heroIndex + 1);
  document.querySelector("#hero-name").textContent = game.name;
  document.querySelector("#hero-summary").textContent = game.summary;
  document.querySelector(".now").style.setProperty("--tint", category.tint);
  paint(heroCanvas, game, false, 0);
}

function syncPlayLabel() {
  const button = document.querySelector("#hero-play");
  button.textContent = motionOn ? "Pause" : "Play";
  button.setAttribute("aria-pressed", motionOn ? "true" : "false");
}

function renderFilters() {
  filtersEl.innerHTML = "";
  const items = [{ id: "all", name: "All", tint: "#ffb020" }].concat(CATEGORIES);
  items.forEach((category) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "filter";
    button.textContent = category.name;
    button.style.setProperty("--tint", category.tint);
    button.dataset.id = category.id;
    button.addEventListener("click", () => {
      filterId = category.id;
      syncFilters();
      renderGrid();
    });
    filtersEl.appendChild(button);
  });
  syncFilters();
}

function syncFilters() {
  filtersEl.querySelectorAll(".filter").forEach((button) => {
    button.setAttribute("aria-pressed", button.dataset.id === filterId ? "true" : "false");
  });
}

function renderGrid() {
  const list = filtered();
  if (observer) observer.disconnect();
  visible.clear();
  grid.innerHTML = "";
  resultCount.textContent = list.length === 100 ? "100 games" : `${list.length} of 100`;
  empty.hidden = list.length > 0;

  list.forEach((game) => {
    const category = categoryById(game.category);
    const number = pad(GAMES.indexOf(game) + 1);
    const button = document.createElement("button");
    button.type = "button";
    button.className = "card";
    button.style.setProperty("--tint", category.tint);
    button.dataset.id = game.id;
    button.innerHTML = `
      <span class="card-stage"><canvas width="320" height="180" aria-hidden="true"></canvas></span>
      <span class="meta">
        <span class="idx">${number}</span>
        <span class="name"></span>
        <span class="cat"></span>
      </span>`;
    button.querySelector(".name").textContent = game.name;
    button.querySelector(".cat").textContent = category.name;
    button.addEventListener("click", () => openViewer(game.id));
    grid.appendChild(button);
    const canvas = button.querySelector("canvas");
    phases.set(canvas, Math.random());
    paint(canvas, game, false, 0);
  });

  observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        const canvas = entry.target.querySelector("canvas");
        if (!canvas) return;
        if (entry.isIntersecting) visible.add(canvas);
        else visible.delete(canvas);
      });
    },
    { rootMargin: "140px" }
  );
  grid.querySelectorAll(".card").forEach((card) => observer.observe(card));
}

function openViewer(id) {
  viewerId = id;
  const index = GAMES.findIndex((game) => game.id === id);
  if (index >= 0) showHero(index, true);
  phases.set(viewerCanvas, 0.08);
  fillViewer();
  if (!viewer.open) viewer.showModal();
  history.replaceState(null, "", `#${id}`);
}

function fillViewer() {
  const game = GAMES.find((item) => item.id === viewerId);
  if (!game) return;
  const category = categoryById(game.category);
  document.querySelector("#viewer-cat").textContent = `${pad(GAMES.indexOf(game) + 1)}  ·  ${category.name}`;
  document.querySelector("#viewer-name").textContent = game.name;
  document.querySelector("#viewer-summary").textContent = game.summary;
  paint(viewerCanvas, game, false, 0);
}

function stepViewer(delta) {
  const list = sequence();
  const index = Math.max(0, list.findIndex((game) => game.id === viewerId));
  const next = list[(index + delta + list.length) % list.length];
  openViewer(next.id);
}

function readHash() {
  const id = location.hash.replace(/^#/, "");
  const index = GAMES.findIndex((game) => game.id === id);
  if (index >= 0) heroIndex = index;
}

document.querySelector("#hero-prev").addEventListener("click", () => showHero(heroIndex - 1, true));
document.querySelector("#hero-next").addEventListener("click", () => showHero(heroIndex + 1, true));
document.querySelector("#hero-random").addEventListener("click", () => {
  showHero(Math.floor(Math.random() * GAMES.length), true);
});
document.querySelector("#hero-play").addEventListener("click", () => {
  motionOn = !motionOn;
  touring = motionOn;
  syncPlayLabel();
});
document.querySelector("#viewer-close").addEventListener("click", () => viewer.close());
document.querySelector("#viewer-prev").addEventListener("click", () => stepViewer(-1));
document.querySelector("#viewer-next").addEventListener("click", () => stepViewer(1));
viewer.addEventListener("click", (event) => {
  if (event.target === viewer) viewer.close();
});
viewer.addEventListener("close", () => {
  viewerId = null;
});

searchEl.addEventListener("input", () => {
  query = searchEl.value;
  renderGrid();
});

document.addEventListener("keydown", (event) => {
  const typing = event.target === searchEl;
  if (event.key === "/" && !typing) {
    event.preventDefault();
    searchEl.focus();
    return;
  }
  if (typing) return;
  if (event.key === "ArrowRight") {
    event.preventDefault();
    if (viewer.open) stepViewer(1);
    else showHero(heroIndex + 1, true);
  } else if (event.key === "ArrowLeft") {
    event.preventDefault();
    if (viewer.open) stepViewer(-1);
    else showHero(heroIndex - 1, true);
  }
});

function frame(now) {
  const dt = lastTime ? Math.min(0.05, (now - lastTime) / 1000) : 0;
  lastTime = now;
  if (touring && motionOn && !viewer.open) {
    heroTimer += dt;
    if (heroTimer >= DWELL) showHero(heroIndex + 1, true);
  }
  tourBar.style.transform = touring && motionOn ? `scaleX(${Math.min(1, heroTimer / DWELL)})` : "scaleX(0)";
  paint(heroCanvas, GAMES[heroIndex], true, dt);
  visible.forEach((canvas) => {
    const card = canvas.closest(".card");
    const game = GAMES.find((item) => item.id === card.dataset.id);
    paint(canvas, game, true, dt);
  });
  if (viewer.open && viewerId) {
    const game = GAMES.find((item) => item.id === viewerId);
    paint(viewerCanvas, game, true, dt);
  }
  requestAnimationFrame(frame);
}

const missing = GAMES.filter((game) => !MOTIONS[game.motion]);
if (GAMES.length !== 100 || missing.length) {
  console.error("Catalog problem", GAMES.length, missing.map((game) => game.id));
}

readHash();
renderFilters();
renderGrid();
showHero(heroIndex, false);
syncPlayLabel();
requestAnimationFrame(frame);
