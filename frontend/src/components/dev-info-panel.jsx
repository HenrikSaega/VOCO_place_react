import React, { useMemo } from 'react';
import '../styles/dev-info-panel.css';

function formatMs(value) {
  if (value === null || value === undefined) return 'N/A';
  return `${value} ms`;
}

export default function DevInfoPanel({
  isConnected,
  activeUsers,
  rttMs,
  pixelLatencyMs,
  board,
  backendBoardSize,
  onClose,
}) {
  const boardHeight = board.length;
  const boardWidth = board[0]?.length || 0;

  const { coloredPixels, whitePixels, dominantColor } = useMemo(() => {
    if (!boardHeight || !boardWidth) {
      return { coloredPixels: 0, whitePixels: 0, dominantColor: '#FFFFFF' };
    }

    let colored = 0;
    let white = 0;
    const colors = {};

    for (let y = 0; y < boardHeight; y += 1) {
      for (let x = 0; x < boardWidth; x += 1) {
        const color = board[y][x] || '#FFFFFF';
        colors[color] = (colors[color] || 0) + 1;

        if (color.toUpperCase() === '#FFFFFF') {
          white += 1;
        } else {
          colored += 1;
        }
      }
    }

    let mostUsedColor = '#FFFFFF';
    let maxCount = 0;
    Object.entries(colors).forEach(([color, count]) => {
      if (count > maxCount) {
        maxCount = count;
        mostUsedColor = color;
      }
    });

    return {
      coloredPixels: colored,
      whitePixels: white,
      dominantColor: mostUsedColor,
    };
  }, [board, boardHeight, boardWidth]);

  const totalPixels = boardHeight * boardWidth;

  return (
    <aside className="dev-panel" aria-label="Developer info panel">
      <div className="dev-panel__header">
        <h3>Dev Panel</h3>
        <button className="dev-panel__close" onClick={onClose} title="Hide panel (Ctrl+Shift+D)">
          Hide
        </button>
      </div>

      <div className="dev-panel__section">
        <p className="dev-panel__line">
          <span>Server</span>
          <strong className={isConnected ? 'ok' : 'bad'}>
            {isConnected ? 'Connected' : 'Disconnected'}
          </strong>
        </p>
        <p className="dev-panel__line">
          <span>Active users</span>
          <strong>{activeUsers ?? 'N/A'}</strong>
        </p>
        <p className="dev-panel__line">
          <span>Socket RTT</span>
          <strong>{formatMs(rttMs)}</strong>
        </p>
        <p className="dev-panel__line">
          <span>Pixel update latency</span>
          <strong>{formatMs(pixelLatencyMs)}</strong>
        </p>
      </div>

      <div className="dev-panel__section">
        <p className="dev-panel__line">
          <span>Canvas size</span>
          <strong>{boardWidth} x {boardHeight}</strong>
        </p>
        <p className="dev-panel__line">
          <span>Total pixels</span>
          <strong>{totalPixels || 0}</strong>
        </p>
        <p className="dev-panel__line">
          <span>Backend board size</span>
          <strong>{backendBoardSize ?? 'N/A'}</strong>
        </p>
        <p className="dev-panel__line">
          <span>Colored pixels</span>
          <strong>{coloredPixels}</strong>
        </p>
        <p className="dev-panel__line">
          <span>White pixels</span>
          <strong>{whitePixels}</strong>
        </p>
        <p className="dev-panel__line">
          <span>Top color</span>
          <strong>
            <span className="dev-panel__swatch" style={{ backgroundColor: dominantColor }} aria-hidden="true" />
            {dominantColor}
          </strong>
        </p>
      </div>

      <p className="dev-panel__hint">Toggle: Ctrl+Shift+D</p>
    </aside>
  );
}
