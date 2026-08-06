import React, { useState } from 'react';
import { useAccessibility } from '../context/AccessibilityContext';
import { useLanguage } from '../context/LanguageContext';
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
    maxLevel: 3,
    icon: (
      <span className="a11y-text-aa" aria-hidden="true">
        <span className="aa-small">A</span>
        <span className="aa-big">A</span>
      </span>
    ),
  },
  { key: 'textSpacing',      maxLevel: 3, icon: <TextSpacingIcon /> },
  { key: 'lineHeight',       maxLevel: 3, icon: <LineHeightIcon /> },
  { key: 'dyslexiaFriendly',              icon: <DyslexiaIcon /> },
  { key: 'saturation',                    icon: <BsDroplet size={22} aria-hidden="true" /> },
  { key: 'invertColors',                  icon: <MdInvertColors size={24} aria-hidden="true" /> },
  { key: 'highlightLinks',                icon: <FaLink size={20} aria-hidden="true" /> },
  { key: 'bigCursor',                     icon: <FaMousePointer size={20} aria-hidden="true" /> },
  { key: 'pauseAnimation',                icon: <FaPause size={20} aria-hidden="true" /> },
  { key: 'hideImages',                    icon: <MdHideImage size={24} aria-hidden="true" /> },
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
  const { language } = useLanguage();

  const text = {
    en: {
      biggerText: 'Bigger Text',
      smallerText: 'Smaller Text',
      textSpacing: 'Text Spacing',
      lineHeight: 'Line Height',
      dyslexiaFriendly: 'Dyslexia Friendly',
      saturation: 'Saturation',
      invertColors: 'Invert Colors',
      highlightLinks: 'Highlight Links',
      bigCursor: 'Big Cursor',
      pauseAnimation: 'Pause Animation',
      hideImages: 'Hide Images',
      options: 'Accessibility options',
      reset: 'Reset All Settings'
    },
    gu: {
      biggerText: 'મોટું લખાણ',
      smallerText: 'નાનું લખાણ',
      textSpacing: 'લખાણ વચ્ચે જગ્યા',
      lineHeight: 'લાઇન ઊંચાઈ',
      dyslexiaFriendly: 'ડિસ્લેક્સીયા અનુકૂળ',
      saturation: 'રંગ સંતૃપ્તિ',
      invertColors: 'રંગ ઉલટાવો',
      highlightLinks: 'લિંક હાઈલાઈટ કરો',
      bigCursor: 'મોટો કર્સર',
      pauseAnimation: 'એનિમેશન બંધ કરો',
      hideImages: 'ઇમેજ છુપાવો',
      options: 'એક્સેસિબિલિટી વિકલ્પો',
      reset: 'બધા સેટિંગ્સ રીસેટ કરો'
    }
  };

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
        aria-label={text[language].options}
      >
        <div className="a11y-panel-header">
          <h2 className="a11y-panel-title">{text[language].options}</h2>
          <button
            className="a11y-close-btn"
            onClick={() => setOpen(false)}
            aria-label="Close accessibility panel"
          >
            <MdClose />
          </button>
        </div>

        <div className="a11y-options-grid">
          {OPTIONS.map(({ key, icon, maxLevel }) => {
            const val = settings[key];
            const isActive = typeof val === 'number' ? val > 0 : val === true;
            const level   = typeof val === 'number' ? val : 0;
            const label = text[language][key];
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
          aria-label={text[language].reset}
        >
          <MdRefresh size={18} aria-hidden="true" />
          {text[language].reset}
        </button>
      </div>
    </>
  );
}
