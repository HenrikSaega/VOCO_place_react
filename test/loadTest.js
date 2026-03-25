/**
 * voco-place Koormustestija
 * ─────────────────────────
 * Käivitus:  node loadTest.js
 * Valikud (vaikimisi):
 *   --users=20       simuleeritud kasutajate arv
 *   --duration=30    katse kestus sekundites
 *   --server=http://localhost:3000
 *   --connect-wait=10 ühenduse ootamine sekundites
 *   --ramp-up=5      mitu sekundit hajutada kasutajate käivitamine
 */

const { io } = require("socket.io-client");

// ── Konfiguratsioon ──────────────────────────────────────────────
function parseArgs(argv) {
  const parsed = {};

  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (!token.startsWith("--")) {
      continue;
    }

    const raw = token.slice(2);
    const eqIndex = raw.indexOf("=");
    if (eqIndex !== -1) {
      parsed[raw.slice(0, eqIndex)] = raw.slice(eqIndex + 1);
      continue;
    }

    const next = argv[i + 1];
    if (next && !next.startsWith("--")) {
      parsed[raw] = next;
      i++;
      continue;
    }

    parsed[raw] = true;
  }

  return parsed;
}

const args = parseArgs(process.argv.slice(2));

const SERVER_URL = args.server || "http://localhost:3000";
const NUM_USERS  = parseInt(args.users    || "20");
const DURATION_S = parseInt(args.duration || "30");
const DURATION_MS = DURATION_S * 1000;
const BOARD_SIZE  = 1000;
const CONNECT_WAIT_MS = parseInt(args["connect-wait"] || "10") * 1000;
const RAMP_UP_MS = parseInt(args["ramp-up"] || "5") * 1000;

function bytesToMb(bytes) {
  return bytes / (1024 * 1024);
}

// Simuleeritud kasutajate värvipalett
const COLORS = [
  "#FF0000", "#FF6600", "#FF9900", "#FFCC00", "#FFFF00",
  "#99CC00", "#00CC00", "#00CC99", "#0099FF", "#0033FF",
  "#6600CC", "#CC00CC", "#FF0099", "#FF6699", "#8B4513",
  "#D2691E", "#A0522D", "#696969", "#2F4F4F", "#000000",
];

// ── Abifunktsioonid ──────────────────────────────────────────────
function rInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function rColor() {
  return COLORS[rInt(0, COLORS.length - 1)];
}

function avg(arr) {
  return arr.length ? (arr.reduce((a, b) => a + b, 0) / arr.length) : 0;
}

// ── Globaalne olek ───────────────────────────────────────────────
const userStats = [];
const drawnPixels = new Map(); // key:"x,y" -> {x,y} – kõik maalitud pikslid
let totalDrawn = 0;
const performanceSamples = {
  cpuPercent: [],
  rssMb: [],
  heapUsedMb: [],
  heapTotalMb: [],
};

function samplePerformance(previousCpuUsage, previousHrTime) {
  const currentCpuUsage = process.cpuUsage();
  const currentHrTime = process.hrtime.bigint();
  const memory = process.memoryUsage();

  const cpuDeltaMicros =
    (currentCpuUsage.user - previousCpuUsage.user) +
    (currentCpuUsage.system - previousCpuUsage.system);
  const elapsedMicros = Number(currentHrTime - previousHrTime) / 1000;
  const cpuPercent = elapsedMicros > 0 ? (cpuDeltaMicros / elapsedMicros) * 100 : 0;

  performanceSamples.cpuPercent.push(cpuPercent);
  performanceSamples.rssMb.push(bytesToMb(memory.rss));
  performanceSamples.heapUsedMb.push(bytesToMb(memory.heapUsed));
  performanceSamples.heapTotalMb.push(bytesToMb(memory.heapTotal));

  return { currentCpuUsage, currentHrTime };
}

// ── Ühe kasutaja simulatsioon ────────────────────────────────────
function simulateUser(userId) {
  return new Promise((resolve) => {
    const stat = {
      userId,
      connected: false,
      pixelsDrawn: 0,
      roundTripTimes: [],
      errors: 0,
      pendingTimestamps: new Map(), // pixelId -> timestamp
    };
    userStats.push(stat);

    const socket = io(SERVER_URL, {
      transports: ["websocket"],
      reconnection: false,
      timeout: 5000,
    });

    socket.on("connect", () => {
      stat.connected = true;
    });

    socket.on("connect_error", () => {
      stat.errors++;
    });

    // Mõõdame latentsust: saadame sündmuse ja mõõdame, millal server selle
    // tagasi peegeldab (pixelUpdated sündmuse kaudu)
    let pixelCounter = 0;
    socket.on("pixelUpdated", ({ x, y }) => {
      const key = `${x},${y}`;
      const ts = stat.pendingTimestamps.get(key);
      if (ts !== undefined) {
        stat.roundTripTimes.push(Date.now() - ts);
        stat.pendingTimestamps.delete(key);
      }
    });

    let running = true;

    async function drawLoop() {
      // Oota ühendust piisavalt kaua, et suur tahvel jõuaks kliendini
      const waitEnd = Date.now() + CONNECT_WAIT_MS;
      while (!stat.connected && Date.now() < waitEnd) {
        await sleep(100);
      }

      while (running) {
        if (socket.connected) {
          // Iga kasutaja joonistab juhusliku piksli
          const x     = rInt(0, BOARD_SIZE - 1);
          const y     = rInt(0, BOARD_SIZE - 1);
          const color = rColor();
          const key   = `${x},${y}`;

          stat.pendingTimestamps.set(key, Date.now());
          socket.emit("drawPixel", { x, y, color });

          stat.pixelsDrawn++;
          totalDrawn++;

          // Salvesta puhastuse jaoks
          drawnPixels.set(key, { x, y });
        }

        // Iga kasutaja joonistab 0.5–2.5s vahel (realistlik tempo)
        await sleep(rInt(500, 2500));
      }
    }

    drawLoop();

    // Lõpeta kasutaja pärast DURATION_MS millissekundit
    setTimeout(() => {
      running = false;
      setTimeout(() => {
        socket.disconnect();
        resolve(stat);
      }, 300);
    }, DURATION_MS);
  });
}

// ── Puhastus: kõik pikslid → valge ──────────────────────────────
async function cleanup() {
  const count = drawnPixels.size;
  console.log(`\n🧹 Puhastan tahvlit – ${count} unikaalset pikslit...`);

  if (count === 0) {
    console.log("   (midagi ei maailitud)");
    return;
  }

  const socket = io(SERVER_URL, { transports: ["websocket"], reconnection: false });
  await new Promise((res, rej) => {
    socket.on("connect", res);
    socket.on("connect_error", rej);
    setTimeout(rej, 5000);
  }).catch(() => {
    console.error("❌ Ei saanud serveriga ühendust puhastuse jaoks!");
    return;
  });

  let i = 0;
  for (const { x, y } of drawnPixels.values()) {
    socket.emit("drawPixel", { x, y, color: "#FFFFFF" });
    i++;
    // Throttle: iga 200 piksli järel väike paus, et server ei upuks
    if (i % 200 === 0) await sleep(100);
  }

  await sleep(600); // anna serverile aega töödelda
  socket.disconnect();
  console.log(`✅ ${i} pikslit värviti valgeks!`);
}

// ── Aruanne ──────────────────────────────────────────────────────
function printReport() {
  const connected   = userStats.filter((s) => s.connected).length;
  const totalPixels = userStats.reduce((sum, s) => sum + s.pixelsDrawn, 0);
  const totalErrors = userStats.reduce((sum, s) => sum + s.errors, 0);
  const allRTT      = userStats.flatMap((s) => s.roundTripTimes);

  const avgRTT = avg(allRTT).toFixed(1);
  const maxRTT = allRTT.length ? Math.max(...allRTT) : 0;
  const minRTT = allRTT.length ? Math.min(...allRTT) : 0;
  const throughput = (totalPixels / DURATION_S).toFixed(2);
  const uniquePixels = drawnPixels.size;
  const avgCpu = avg(performanceSamples.cpuPercent).toFixed(1);
  const maxCpu = performanceSamples.cpuPercent.length ? Math.max(...performanceSamples.cpuPercent).toFixed(1) : "0.0";
  const avgRss = avg(performanceSamples.rssMb).toFixed(1);
  const maxRss = performanceSamples.rssMb.length ? Math.max(...performanceSamples.rssMb).toFixed(1) : "0.0";
  const avgHeapUsed = avg(performanceSamples.heapUsedMb).toFixed(1);
  const maxHeapUsed = performanceSamples.heapUsedMb.length ? Math.max(...performanceSamples.heapUsedMb).toFixed(1) : "0.0";
  const avgHeapTotal = avg(performanceSamples.heapTotalMb).toFixed(1);
  const maxHeapTotal = performanceSamples.heapTotalMb.length ? Math.max(...performanceSamples.heapTotalMb).toFixed(1) : "0.0";

  const W = 54;
  const line = "═".repeat(W);
  const thin = "─".repeat(W);

  console.log("\n╔" + line + "╗");
  console.log("║" + "   VOCO-PLACE KOORMUSTESTI TULEMUSED".padStart((W + 36) / 2).padEnd(W) + "║");
  console.log("╠" + line + "╣");
  row("⏱  Kestus",         `${DURATION_S}s`);
  row("🎯 Server",          SERVER_URL);
  console.log("╠" + thin + "╣");
  row("👥 Simuleeritud kasutajaid",  `${NUM_USERS}`);
  row("✅ Ühendus loodud",           `${connected} / ${NUM_USERS}`);
  row("❌ Ühenduse vead",            `${totalErrors}`);
  console.log("╠" + thin + "╣");
  row("🎨 Kokku saadetud piksleid",  `${totalPixels}`);
  row("📦 Unikaalseid piksleid",     `${uniquePixels}`);
  row("⚡ Läbilaskevõime",           `${throughput} pk/s`);
  console.log("╠" + thin + "╣");
  row("📶 RTT keskmine",  `${avgRTT} ms`);
  row("📶 RTT minimaalne", `${minRTT} ms`);
  row("📶 RTT maksimaalne", `${maxRTT} ms`);
  row("📶 RTT mõõtmisi",   `${allRTT.length}`);
  console.log("╠" + thin + "╣");
  row("🧠 RAM avg (RSS)", `${avgRss} MB`);
  row("🧠 RAM max (RSS)", `${maxRss} MB`);
  row("🧠 Heap avg", `${avgHeapUsed} / ${avgHeapTotal} MB`);
  row("🧠 Heap max", `${maxHeapUsed} / ${maxHeapTotal} MB`);
  row("🔥 CPU avg", `${avgCpu}%`);
  row("🔥 CPU max", `${maxCpu}%`);
  console.log("╠" + line + "╣");
  console.log("║" + "  Kasutaja statistika".padEnd(W) + "║");
  console.log("╠" + thin + "╣");

  const sorted = [...userStats].sort((a, b) => b.pixelsDrawn - a.pixelsDrawn);
  const topUsers = sorted.slice(0, Math.min(NUM_USERS, 25));
  topUsers.forEach((s) => {
    const bar = "█".repeat(Math.round((s.pixelsDrawn / (totalPixels / NUM_USERS || 1)) * 5));
    const rtt = s.roundTripTimes.length ? `RTT: ${avg(s.roundTripTimes).toFixed(0)}ms` : "RTT: –";
    const line2 = ` Kasutaja ${String(s.userId).padStart(2)}: ${String(s.pixelsDrawn).padStart(4)} pk  ${bar.padEnd(10)} ${rtt}`;
    console.log("║" + line2.padEnd(W) + "║");
  });

  if (sorted.length > topUsers.length) {
    const noDrawUsers = sorted.filter((s) => s.pixelsDrawn === 0).length;
    const summary = ` + veel ${sorted.length - topUsers.length} kasutajat, neist ${noDrawUsers} ilma tegevuseta`;
    console.log("║" + summary.padEnd(W) + "║");
  }

  console.log("╚" + line + "╝\n");

  function row(label, value) {
    const content = ` ${label}: ${value}`;
    console.log("║" + content.padEnd(W) + "║");
  }
}

// ── Utiliit ──────────────────────────────────────────────────────
function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// ── Peafunktsioon ────────────────────────────────────────────────
async function main() {
  const totalRunMs = DURATION_MS + RAMP_UP_MS;
  const totalRunS = Math.ceil(totalRunMs / 1000);

  console.log("╔══════════════════════════════════════╗");
  console.log("║    VOCO-PLACE KOORMUSTESTIJA 🚀      ║");
  console.log("╚══════════════════════════════════════╝");
  console.log(`\n▶ Server:    ${SERVER_URL}`);
  console.log(`▶ Kasutajad: ${NUM_USERS}`);
  console.log(`▶ Kestus:    ${DURATION_S}s`);
  console.log(`▶ Connect:   ${CONNECT_WAIT_MS / 1000}s`);
  console.log(`▶ Ramp-up:   ${RAMP_UP_MS / 1000}s`);
  console.log(`▶ Kokku:     ~${totalRunS}s`);
  console.log("\nKäivitan simulatsiooni...\n");

  // Progress-riba
  const startTime = Date.now();
  let previousCpuUsage = process.cpuUsage();
  let previousHrTime = process.hrtime.bigint();
  const ticker = setInterval(() => {
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    const pct     = Math.max(0, Math.min(20, Math.round((elapsed / totalRunS) * 20)));
    const bar     = "█".repeat(pct) + "░".repeat(20 - pct);
    ({ currentCpuUsage: previousCpuUsage, currentHrTime: previousHrTime } = samplePerformance(previousCpuUsage, previousHrTime));
    process.stdout.write(
      `\r  [${bar}] ${elapsed}s / ${totalRunS}s  |  piksleid: ${totalDrawn}`
    );
  }, 500);

  // Käivita kasutajad hajutatult, et server ei peaks kõigile korraga 1000x1000 lauda saatma
  const launchDelayMs = NUM_USERS > 1 ? Math.floor(RAMP_UP_MS / (NUM_USERS - 1)) : 0;
  await Promise.all(
    Array.from({ length: NUM_USERS }, (_, i) => new Promise((resolve) => {
      setTimeout(() => {
        simulateUser(i + 1).then(resolve);
      }, i * launchDelayMs);
    }))
  );

  clearInterval(ticker);
  ({ currentCpuUsage: previousCpuUsage, currentHrTime: previousHrTime } = samplePerformance(previousCpuUsage, previousHrTime));
  process.stdout.write("\r" + " ".repeat(70) + "\r"); // Puhasta progress-rida

  printReport();
  await cleanup();
}

main().catch((err) => {
  console.error("Viga testi käivitamisel:", err.message);
  console.error("Kontrolli, et backend server töötab pordil 3000!");
  process.exit(1);
});
