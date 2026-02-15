// --------------------
// Settings you can change
// --------------------
const CENTER = [29.5845, -81.2079]; // Palm Coast area
const START_ZOOM = 9;

// Slow the animation to avoid 429.
// If you crank zoom up and speed down, you WILL hit rate limits.
let FRAME_DELAY_MS = 1200;
let RADAR_OPACITY = 0.70;

// --------------------
// Globals
// --------------------
let map;
let radarLayer;
let frames = [];     // array of frame timestamps
let frameIndex = 0;
let timer = null;

// UI
const elStatus = document.getElementById("status");
const btnPlay = document.getElementById("btnPlay");
const btnPause = document.getElementById("btnPause");
const elSpeed = document.getElementById("speed");
const elOpacity = document.getElementById("opacity");

function setStatus(msg) {
  elStatus.textContent = msg;
}

async function fetchFrames() {
  // This endpoint is usually accessible without a key
  const res = await fetch("https://api.rainviewer.com/public/weather-maps.json", {
    cache: "no-store"
  });

  if (!res.ok) throw new Error(`RainViewer JSON failed: ${res.status}`);

  const data = await res.json();

  // Prefer past frames for animation
  const past = data?.radar?.past ?? [];
  frames = past.map(f => f.time).filter(Boolean);

  if (!frames.length) throw new Error("No radar frames returned from RainViewer");
}

function makeTileUrl(time) {
  // Matches your logs: tilecache.rainviewer.com/v2/radar/{time}/256/{z}/{x}/{y}/4/1_1.webp
  return `https://tilecache.rainviewer.com/v2/radar/${time}/256/{z}/{x}/{y}/4/1_1.webp`;
}

function formatFrameTime(unixSeconds) {
  const d = new Date(unixSeconds * 1000);
  return d.toLocaleString();
}

function initMap() {
  map = L.map("map", { preferCanvas: true }).setView(CENTER, START_ZOOM);

  // Base map
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "&copy; OpenStreetMap contributors"
  }).addTo(map);

  // ONE radar layer created once.
  radarLayer = L.tileLayer(makeTileUrl(frames[frameIndex]), {
    opacity: RADAR_OPACITY,
    zIndex: 999,
    updateWhenIdle: true,
    updateWhenZooming: false,
    keepBuffer: 1,
    crossOrigin: true
  }).addTo(map);

  setStatus(`Frame: ${formatFrameTime(frames[frameIndex])}`);
}

function showFrame(i) {
  if (!frames.length || !radarLayer) return;

  frameIndex = (i + frames.length) % frames.length;

  // IMPORTANT: do not addLayer repeatedly. Only update the URL.
  radarLayer.setUrl(makeTileUrl(frames[frameIndex]), true);

  setStatus(`Frame: ${formatFrameTime(frames[frameIndex])}`);
}

function play() {
  // Prevent multiple intervals
  if (timer) return;

  timer = setInterval(() => {
    showFrame(frameIndex + 1);
  }, FRAME_DELAY_MS);
}

function pause() {
  if (!timer) return;
  clearInterval(timer);
  timer = null;
}

function wireUI() {
  btnPlay.addEventListener("click", () => play());
  btnPause.addEventListener("click", () => pause());

  elSpeed.addEventListener("change", () => {
    FRAME_DELAY_MS = parseInt(elSpeed.value, 10);
    // restart timer to apply speed change
    const wasPlaying = !!timer;
    pause();
    if (wasPlaying) play();
  });

  elOpacity.addEventListener("input", () => {
    RADAR_OPACITY = parseFloat(elOpacity.value);
    if (radarLayer) radarLayer.setOpacity(RADAR_OPACITY);
  });

  // Pause when tab not visible (reduces rate limiting)
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) pause();
    else play();
  });
}

(async function boot() {
  try {
    wireUI();
    setStatus("Loading frames…");
    await fetchFrames();
    initMap();
    play();
  } catch (err) {
    console.error(err);
    setStatus(`Error: ${err.message}`);
  }
})();
