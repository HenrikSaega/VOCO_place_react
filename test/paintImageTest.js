/**
 * voco-place Pilditöötluse Test
 * ────────────────────────────
 * Käivitus: npm run test:paint
 *          node paintImageTest.js
 *          node paintImageTest.js --image=./myimage.png
 * 
 * Tellib tegelikke PNG/JPG pilte (Jimp kaudu) või genereerib demo-pildi.
 * Test loob simuleeritud kasutajad, kes joonistada pildi piksli kaupa.
 * 
 * Valikud:
 *   --image=./path/to/image.png  (pildi tee - toetatud: PNG, JPG, GIF, BMP jne)
 *   --users=10                    (kasutajate arv, vaikimisi 5)
 *   --size=20                     (pildi suurus NxN pikselit, vaikimisi 20)
 *   --server=http://localhost:3000
 *   --pixel-delay=50              (viivitus millisekudes, vaikimisi 50ms)
 * 
 * Näited:
 *   node paintImageTest.js --image=./mona.png --users=3
 *   node paintImageTest.js --image=./art.jpg --size=25 --pixel-delay=30
 *   node paintImageTest.js                     # genereerib demo-pildi
 */

const { io } = require("socket.io-client");
const fs = require("fs");
const path = require("path");
const { Jimp } = require("jimp");

// Tegelik pildi laadimine ja teisendamine pikslite massiiviks
async function loadImageAsPixelArray(filePath, targetWidth, targetHeight) {
  if (!fs.existsSync(filePath)) {
    console.log(`📸 Pilti ei leitud: ${filePath}`);
    console.log(`   Kasutame demo pilti...\n`);
    return generateDemoImage(targetWidth, targetHeight);
  }

  try {
    console.log(`📸 Laadin pilti: ${filePath}`);
    
    const image = await Jimp.read(filePath);
    console.log(`   Originaal suurus: ${image.width}x${image.height}`);
    
    // Muuda suurust
    image.resize({ w: targetWidth, h: targetHeight, fit: "contain" });
    console.log(`   Uus suurus: ${image.width}x${image.height}`);
    
    // Loe pikslid
    const pixels = [];
    for (let y = 0; y < image.height; y++) {
      const row = [];
      for (let x = 0; x < image.width; x++) {
        const pixelColor = intToRGBA(image.getPixelColor(x, y));
        const hex = rgbaToHex(pixelColor.r, pixelColor.g, pixelColor.b);
        row.push(hex);
      }
      pixels.push(row);
    }
    
    console.log(`✅ Pilt laetud: ${image.width}x${image.height}`);
    return pixels;
  } catch (error) {
    console.error(`❌ Viga pildi lugemisel: ${error.message}`);
    console.log(`   Kasutame demo pilti...\n`);
    return generateDemoImage(targetWidth, targetHeight);
  }
}

// Demo pildi genereerimine (kui pilti ei leidu)
function generateDemoImage(width, height) {
  const pixels = [];
  for (let y = 0; y < height; y++) {
    const row = [];
    for (let x = 0; x < width; x++) {
      const hue = ((x + y) / (width + height)) * 360;
      const color = hsToHex(hue, 100, 50);
      row.push(color);
    }
    pixels.push(row);
  }
  console.log(`⚠️  Demo pilt genereeritud: ${width}x${height}\n`);
  return pixels;
}

// RGBA -> HEX
function rgbaToHex(r, g, b) {
  return `#${[r, g, b]
    .map(x => x.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase()}`;
}

// Extract RGBA from integer color value
function intToRGBA(pixel) {
  return {
    r: (pixel >>> 24) & 255,
    g: (pixel >>> 16) & 255,
    b: (pixel >>> 8) & 255,
    a: pixel & 255,
  };
}

function hsToHex(h, s, l) {
  l /= 100;
  const a = (s / 100) * Math.min(l, 1 - l);

  const f = (n) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color)
      .toString(16)
      .padStart(2, "0");
  };

  return `#${f(0)}${f(8)}${f(4)}`.toUpperCase();
}

function parseArgs(argv) {
  const parsed = {};
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (!token.startsWith("--")) continue;

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
    } else {
      parsed[raw] = true;
    }
  }
  return parsed;
}

const args = parseArgs(process.argv.slice(2));

const IMAGE_PATH = args.image || "./test-image.png";
const SERVER_URL = args.server || "http://localhost:3000";
const NUM_USERS = parseInt(args.users || "5", 10);
const PIXEL_DELAY_MS = parseInt(args["pixel-delay"] || "50", 10);
const IMAGE_SIZE = parseInt(args["size"] || "20", 10); // Pildi mõõtmed (NxN)
const BOARD_SIZE = 100;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function paintPixels(socket, pixels, startX = 0, startY = 0) {
  let pixelsDrawn = 0;
  const errors = [];

  for (let y = 0; y < pixels.length; y++) {
    for (let x = 0; x < pixels[y].length; x++) {
      const globalX = startX + x;
      const globalY = startY + y;
      const color = pixels[y][x];

      if (globalX >= 0 && globalX < BOARD_SIZE && globalY >= 0 && globalY < BOARD_SIZE) {
        try {
          socket.emit("drawPixel", {
            x: globalX,
            y: globalY,
            color,
          });
          pixelsDrawn++;
        } catch (err) {
          errors.push({ x: globalX, y: globalY, error: err.message });
        }
      }

      await sleep(PIXEL_DELAY_MS);
    }
  }

  return { pixelsDrawn, errors };
}

async function simulateUser(userId, pixels) {
  return new Promise((resolve) => {
    const stat = {
      userId,
      connected: false,
      pixelsDrawn: 0,
      errors: 0,
      startTime: Date.now(),
    };

    const socket = io(SERVER_URL, {
      transports: ["websocket"],
      reconnection: false,
    });

    socket.on("connect", () => {
      stat.connected = true;
      console.log(`👤 Kasutaja ${userId} ühendatud`);
    });

    socket.on("connect_error", (err) => {
      stat.errors++;
      console.error(`❌ Kasutaja ${userId} viga:`, err.message);
    });

    (async () => {
      // Oodame ühendust
      let connected = false;
      for (let i = 0; i < 10; i++) {
        if (socket.connected) {
          connected = true;
          break;
        }
        await sleep(100);
      }

      if (!connected) {
        console.error(`❌ Kasutaja ${userId} ei saanud ühendust`);
        socket.disconnect();
        resolve(stat);
        return;
      }

      // Joonista piksid
      const offsetX = (userId % 5) * 20; // Jaota pildid lauale
      const offsetY = Math.floor(userId / 5) * 20;

      const result = await paintPixels(socket, pixels, offsetX, offsetY);
      stat.pixelsDrawn = result.pixelsDrawn;
      stat.errors += result.errors.length;

      console.log(`✅ Kasutaja ${userId} joonistas ${result.pixelsDrawn} pikslit`);

      socket.disconnect();
      stat.endTime = Date.now();
      resolve(stat);
    })();
  });
}

async function runTest() {
  console.log("🎨 voco-place Pilditöötluse Test");
  console.log("================================\n");

  try {
    // Laadi pilt
    const pixels = await loadImageAsPixelArray(IMAGE_PATH, IMAGE_SIZE, IMAGE_SIZE);

    console.log(`\n👥 Käivitan ${NUM_USERS} kasutajat...`);
    console.log(`⏱️  Viivitus pikslite vahel: ${PIXEL_DELAY_MS}ms`);
    console.log(`📐 Pildi suurus: ${IMAGE_SIZE}x${IMAGE_SIZE}\n`);

    const startTime = Date.now();

    // Simuleer kasutajaid
    const promises = [];
    for (let i = 0; i < NUM_USERS; i++) {
      promises.push(simulateUser(i, pixels));
    }

    const userResults = await Promise.all(promises);
    const totalTime = Date.now() - startTime;

    // Tulemused
    console.log("\n📊 TULEMUSED:");
    console.log("=============");

    let totalPixels = 0;
    let totalErrors = 0;

    userResults.forEach((stat) => {
      totalPixels += stat.pixelsDrawn;
      totalErrors += stat.errors;
    });

    console.log(`✅ Kokku joonistatud pikslit: ${totalPixels}`);
    console.log(`❌ Vead: ${totalErrors}`);
    console.log(`⏱️  Koguvõtted: ${(totalTime / 1000).toFixed(2)}s`);
    console.log(`🐎 Kiirus: ${(totalPixels / (totalTime / 1000)).toFixed(0)} px/s`);

    console.log(
      `\n✨ Test lõpetatud! Joonistatud pildid peavad olema nähtavad canvasil.`
    );
  } catch (error) {
    console.error("❌ Test ebaõnnestus:", error.message);
    process.exit(1);
  }
}

runTest();
