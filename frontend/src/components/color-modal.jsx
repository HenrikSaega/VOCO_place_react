import React from 'react';
import '../styles/color-modal.css';

const COLORS = ["#FF0000", "#00FF00", "#0000FF", "#FFFF00", "#000000", "#FFFFFF"];

export default function ColorModal({ isOpen, selectedPixel, onColorSelect, onClose }) {
  if (!isOpen) return null;

  return (
    <div className="color-modal-overlay" onClick={onClose}>
      <div className="color-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="color-modal-header">
        </div>

        <div className="color-modal-colors">
          {COLORS.map(color => (
            <button
              key={color}
              className="color-swatch"
              style={{ backgroundColor: color }}
              onClick={() => onColorSelect(color)}
              title={color}
              aria-label={`Vali värv ${color}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
