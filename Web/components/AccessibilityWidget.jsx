import React, { useState } from 'react';
import { useAccessibility } from '../context/AccessibilityContext';
import { MdClose, MdInvertColors, MdHideImage, MdRefresh } from 'react-icons/md';
import { FaUniversalAccess, FaLink, FaMousePointer, FaPause } from 'react-icons/fa';
import { BsDroplet } from 'react-icons/bs';
import './AccessibilityWidget.css';

const TextSpacingIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="1.35em" height="1.35em" aria-hidden="true">
    <path d="M3 12h18" strokeLinecap="round" />
    <path d="M8 8l-5 4 5 4M16 8l5 4-5 4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const LineHeightIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="1.35em" height="1.35em" aria-hidden="true">
    <line x1="4" y1="4"  x2="20" y2="4"  strokeLinecap="round" />
    <line x1="4" y1="9"  x2="20" y2="9"  strokeLinecap="round" />
    <line x1="4" y1="16" x2="20" y2="16" strokeLinecap="round" />
    <line x1="4" y1="21" x2="20" y2="21" strokeLinecap="round" />
  </svg>
);

const DyslexiaIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="1.35em" height="1.35em" aria-hidden="true">
    <line x1="12" y1="3" x2="12" y2="21" strokeLinecap="round" />
    <line x1="5"  y1="3" x2="19" y2="3"  strokeLinecap="round" />
    <path d="M9 21h6" strokeLinecap="round" />
  </svg>
);

// maxLevel = number of steps before wrapping back to 0 (undefined = simple toggle)
const OPTIONS = [
  {
    key: 'biggerText',
    label: 'Bigger Text',
    maxLevel: 4,
    icon: (
      <span className="a11y-text-aa" aria-hidden="true">
        <span className="aa-big">A</span>
        <span className="aa-small">A</span>
      </span>
    ),
  },
  {
    key: 'smallerText',
    label: 'Smaller Text',
    maxLevel: 3,
    icon: (
      <span className="a11y-text-aa" aria-hidden="true">
        <span className="aa-small">A</span>
        <span className="aa-big">A</span>
      </span>
    ),
  },
  { key: 'textSpacing',      label: 'Text Spacing',      maxLevel: 3, icon: <TextSpacingIcon /> },
  { key: 'lineHeight',       label: 'Line Height',        maxLevel: 3, icon: <LineHeightIcon /> },
  { key: 'dyslexiaFriendly', label: 'Dyslexia Friendly',              icon: <DyslexiaIcon /> },
  { key: 'saturation',       label: 'Saturation',                     icon: <BsDroplet size={22} aria-hidden="true" /> },
  { key: 'invertColors',     label: 'Invert Colors',                  icon: <MdInvertColors size={24} aria-hidden="true" /> },
  { key: 'highlightLinks',   label: 'Highlight Links',                icon: <FaLink size={20} aria-hidden="true" /> },
  { key: 'bigCursor',        label: 'Big Cursor',                     icon: <FaMousePointer size={20} aria-hidden="true" /> },
  { key: 'pauseAnimation',   label: 'Pause Animation',                icon: <FaPause size={20} aria-hidden="true" /> },
  { key: 'hideImages',       label: 'Hide Images',                    icon: <MdHideImage size={24} aria-hidden="true" /> },
];

function LevelDots({ level, max }) {
  return (
    <span className="a11y-level-dots" aria-hidden="true">
      {Array.from({ length: max }, (_, i) => (
        <span
          key={i}
          className={`a11y-dot${i < level ? ' a11y-dot-filled' : ''}`}
        />
      ))}
    </span>
  );
}

export default function AccessibilityWidget() {
  const [open, setOpen] = useState(false);
  const { settings, toggle, reset } = useAccessibility();

  // count stepped features (level > 0) and boolean features (=== true)
  const activeCount = Object.entries(settings).filter(([, v]) =>
    typeof v === 'number' ? v > 0 : v === true
  ).length;

  return (
    <>
      {/* Floating trigger button */}
      <button
        className="a11y-trigger-btn"
        onClick={() => setOpen(prev => !prev)}
        aria-label="Open accessibility options"
        aria-expanded={open}
        title="Accessibility Options"
      >
        <FaUniversalAccess />
        {activeCount > 0 && (
          <span className="a11y-badge" aria-label={`${activeCount} accessibility options active`}>
            {activeCount}
          </span>
        )}
      </button>

      {/* Click-outside backdrop */}
      {open && <div className="a11y-backdrop" onClick={() => setOpen(false)} aria-hidden="true" />}

      {/* Panel */}
      <div
        className={`a11y-panel${open ? ' a11y-panel--open' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label="Accessibility Options"
      >
        <div className="a11y-panel-header">
          <h2 className="a11y-panel-title">Accessibility options</h2>
          <button
            className="a11y-close-btn"
            onClick={() => setOpen(false)}
            aria-label="Close accessibility panel"
          >
            <MdClose />
          </button>
        </div>

        <div className="a11y-options-grid">
          {OPTIONS.map(({ key, label, icon, maxLevel }) => {
            const val = settings[key];
            const isActive = typeof val === 'number' ? val > 0 : val === true;
            const level   = typeof val === 'number' ? val : 0;
            return (
              <button
                key={key}
                className={`a11y-option-btn${isActive ? ' active' : ''}`}
                onClick={() => toggle(key)}
                aria-pressed={isActive}
                aria-label={`${label}${maxLevel ? ` (level ${level} of ${maxLevel})` : (isActive ? ' — on' : ' — off')}`}
              >
                <span className="a11y-option-icon">{icon}</span>
                <span className="a11y-option-label">{label}</span>
                {maxLevel && <LevelDots level={level} max={maxLevel} />}
              </button>
            );
          })}
        </div>

        <button
          className="a11y-reset-btn"
          onClick={reset}
          aria-label="Reset all accessibility settings"
        >
          <MdRefresh size={18} aria-hidden="true" />
          Reset All Settings
        </button>
      </div>
    </>
  );
}
