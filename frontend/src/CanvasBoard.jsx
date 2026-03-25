import React, { useEffect, useRef, useState } from 'react';

const BOARD_SIZE = 1000;
const PIXEL_SIZE = 1; // 1px canvas-piksel, CSS transform skaleerib

// Hex värvi teisendamine RGB komponentideks
function hexToRgb(hex) {
  const h = hex || '#FFFFFF';
  return [
    parseInt(h.slice(1, 3), 16),
    parseInt(h.slice(3, 5), 16),
    parseInt(h.slice(5, 7), 16),
  ];
}
const COOLDOWN_SECONDS = 3;

// Värvid, mida näidata modaalis
const COLORS = ["#FF0000", "#00FF00", "#0000FF", "#FFFF00", "#000000", "#FFFFFF"];

export default function CanvasBoard({ socket, board, isConnected }) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const imageDataRef = useRef(null); // Vahemälus ImageData kiireks joonistamiseks
  
  // Kaamera ja hiire olekud hoiame useRef-is, et mitte käivitada re-renderdusi
  const camera = useRef({ scale: 1, targetScale: 1, panX: 0, targetPanX: 0, panY: 0, targetPanY: 0 });
  const mouse = useRef({ isDragging: false, isClick: false, startDragX: 0, startDragY: 0 });
  const hover = useRef({ x: null, y: null });
  
  // Reacti state UI jaoks (modal ja cooldown)
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedPixel, setSelectedPixel] = useState({ x: null, y: null });
  const [cooldown, setCooldown] = useState(0);

  // 0. BOARD MUUTUMISEL UUENDAME IMAGEDATA PUHVRIT (mitte kogu frameloop)
  useEffect(() => {
    if (board.length === 0) return;
    if (!imageDataRef.current) {
      imageDataRef.current = new ImageData(BOARD_SIZE, BOARD_SIZE);
    }
    const data = imageDataRef.current.data;
    board.forEach((row, y) => {
      row.forEach((color, x) => {
        const [r, g, b] = hexToRgb(color);
        const idx = (y * BOARD_SIZE + x) * 4;
        data[idx]     = r;
        data[idx + 1] = g;
        data[idx + 2] = b;
        data[idx + 3] = 255;
      });
    });
  }, [board]);

  // 1. KAAMERA ANIMATSIOON JA LAUA JOONISTAMINE
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animationFrameId;

    const renderLoop = () => {
      const cam = camera.current;
      
      // Kaamera sujuv liikumine (lerp)
      cam.scale += (cam.targetScale - cam.scale) * 0.15;
      cam.panX += (cam.targetPanX - cam.panX) * 0.15;
      cam.panY += (cam.targetPanY - cam.panY) * 0.15;

      // Joonistame laua ImageData puhvrist (üks GPU-call kogu kaadri jaoks)
      if (imageDataRef.current) {
        ctx.putImageData(imageDataRef.current, 0, 0);
      }

      // Joonistame hover efekti (1px täide, CSS zoom skaleerib)
      const { x: hX, y: hY } = hover.current;
      if (hX !== null && hY !== null && !modalOpen) {
        ctx.fillStyle = cooldown > 0 ? "rgba(231, 76, 60, 0.7)" : "rgba(0, 0, 0, 0.5)";
        ctx.fillRect(hX, hY, 1, 1);
      }

      // Rakendame CSS transformatsiooni lõuendile (nagu su algses koodis)
      canvas.style.transform = `translate(${cam.panX}px, ${cam.panY}px) scale(${cam.scale})`;
      
      animationFrameId = requestAnimationFrame(renderLoop);
    };

    renderLoop();
    return () => cancelAnimationFrame(animationFrameId);
  }, [board, cooldown, modalOpen]); // Renderdame uuesti, kui need muutuvad

  // 2. HIIRE SÜNDMUSED
  const handleMouseDown = (e) => {
    if (e.target !== canvasRef.current && e.target !== containerRef.current) return;
    mouse.current.isDragging = true;
    mouse.current.isClick = true;
    mouse.current.startDragX = e.clientX - camera.current.targetPanX;
    mouse.current.startDragY = e.clientY - camera.current.targetPanY;
  };

  const handleMouseMove = (e) => {
    if (mouse.current.isDragging) {
      mouse.current.isClick = false;
      camera.current.targetPanX = e.clientX - mouse.current.startDragX;
      camera.current.targetPanY = e.clientY - mouse.current.startDragY;
      return;
    }

    if (modalOpen || e.target !== canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const x = Math.floor((e.clientX - rect.left) / (PIXEL_SIZE * camera.current.scale));
    const y = Math.floor((e.clientY - rect.top) / (PIXEL_SIZE * camera.current.scale));

    if (x >= 0 && x < BOARD_SIZE && y >= 0 && y < BOARD_SIZE) {
      hover.current = { x, y };
    } else {
      hover.current = { x: null, y: null };
    }
  };

  const handleMouseUp = (e) => {
    mouse.current.isDragging = false;
    
    if (mouse.current.isClick && e.target === canvasRef.current) {
      if (cooldown > 0) return;
      
      const rect = canvasRef.current.getBoundingClientRect();
      const x = Math.floor((e.clientX - rect.left) / (PIXEL_SIZE * camera.current.scale));
      const y = Math.floor((e.clientY - rect.top) / (PIXEL_SIZE * camera.current.scale));
      
      if (x >= 0 && x < BOARD_SIZE && y >= 0 && y < BOARD_SIZE) {
        setSelectedPixel({ x, y });
        setModalOpen(true);
      }
    }
  };

  // 3. SUUMIMINE
  const handleWheel = (e) => {
    e.preventDefault();
    const cam = camera.current;
    let oldTargetScale = cam.targetScale;

    if (e.deltaY < 0) {
      cam.targetScale *= 1.25;
    } else {
      cam.targetScale /= 1.25;
    }

    cam.targetScale = Math.max(0.1, Math.min(cam.targetScale, 20));
    cam.targetPanX = e.clientX - (e.clientX - cam.targetPanX) * (cam.targetScale / oldTargetScale);
    cam.targetPanY = e.clientY - (e.clientY - cam.targetPanY) * (cam.targetScale / oldTargetScale);
  };

  // 4. KESKENDAMINE (Recenter)
  const centerCamera = () => {
    const canvasWidth = BOARD_SIZE * PIXEL_SIZE;
    const canvasHeight = BOARD_SIZE * PIXEL_SIZE;
    const cam = camera.current;
    
    cam.targetScale = (window.innerHeight * 0.8) / canvasHeight;
    cam.targetPanX = window.innerWidth / 2 - (canvasWidth * cam.targetScale) / 2;
    cam.targetPanY = window.innerHeight / 2 - (canvasHeight * cam.targetScale) / 2;
  };

  // Keskendame kaamera automaatselt, kui komponent esimest korda laetakse
  useEffect(() => {
    centerCamera();
  }, []);

  // 5. VÄRVI VALIMINE JA COOLDOWN
  const handleColorSelect = (color) => {
    setModalOpen(false);
    if (selectedPixel.x !== null && selectedPixel.y !== null) {
      socket.emit("drawPixel", { x: selectedPixel.x, y: selectedPixel.y, color });
      startCooldown();
    }
  };

  const startCooldown = () => {
    setCooldown(COOLDOWN_SECONDS);
  };

  useEffect(() => {
    if (cooldown > 0) {
      const timer = setTimeout(() => setCooldown(cooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [cooldown]);

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden' }}>
      
      {/* UI Paneel */}
      <div style={{ position: 'absolute', top: 10, left: 10, zIndex: 100, backgroundColor: 'white', padding: '10px', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
        <h2 style={{ margin: '0 0 10px 0' }}>Place</h2>
        <p style={{ color: isConnected ? 'green' : 'red', margin: '0 0 10px 0' }}>
          {isConnected ? "🟢 Server Ühendatud" : "🔴 Ühendus puudub"}
        </p>
        <p style={{ fontWeight: 'bold', color: cooldown > 0 ? '#e74c3c' : '#2ecc71', margin: '0 0 10px 0' }}>
          {cooldown > 0 ? `Oota ${cooldown} s...` : "Saad värvida!"}
        </p>
        <button onClick={centerCamera} style={{ padding: '5px 10px', cursor: 'pointer' }}>Keskenda Vaade</button>
      </div>

      {/* Värvivaliku Modal */}
      {modalOpen && (
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 200, backgroundColor: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 10px 25px rgba(0,0,0,0.2)' }}>
          <h3>Vali värv pikslile ({selectedPixel.x}, {selectedPixel.y})</h3>
          <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
            {COLORS.map(c => (
              <div 
                key={c} 
                onClick={() => handleColorSelect(c)}
                style={{ width: 30, height: 30, backgroundColor: c, border: '1px solid black', cursor: 'pointer' }}
              />
            ))}
          </div>
          <button onClick={() => setModalOpen(false)} style={{ padding: '5px 10px' }}>Tühista</button>
        </div>
      )}

      {/* Lõuendi Konteiner (Viewport) */}
      <div 
        ref={containerRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onWheel={handleWheel}
        style={{ width: '100%', height: '100%', cursor: mouse.current.isDragging ? 'grabbing' : 'crosshair' }}
      >
        <canvas
          ref={canvasRef}
          width={BOARD_SIZE * PIXEL_SIZE}
          height={BOARD_SIZE * PIXEL_SIZE}
          style={{ transformOrigin: '0 0', imageRendering: 'pixelated' }}
        />
      </div>
    </div>
  );
}