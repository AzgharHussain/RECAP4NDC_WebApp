import React, { createContext, useContext, useState, useEffect } from 'react';

const AccessibilityContext = createContext(null);

// Stepped features: each click advances one level; at max it wraps back to 0
const STEPPED_MAX = { biggerText: 4, smallerText: 3, textSpacing: 3, lineHeight: 3 };

export const defaultSettings = {
  biggerText: 0,       // 0 = off, 1–4 increasing levels
  smallerText: 0,      // 0 = off, 1–3 decreasing levels
  textSpacing: 0,      // 0 = off, 1–3 increasing spacing
  lineHeight: 0,       // 0 = off, 1–3 increasing line-height
  dyslexiaFriendly: false,
  saturation: false,
  invertColors: false,
  highlightLinks: false,
  bigCursor: false,
  pauseAnimation: false,
  hideImages: false,
};

export function AccessibilityProvider({ children }) {
  const [settings, setSettings] = useState(() => {
    try {
      const saved = localStorage.getItem('recap-a11y');
      return saved ? { ...defaultSettings, ...JSON.parse(saved) } : { ...defaultSettings };
    } catch {
      return { ...defaultSettings };
    }
  });

  useEffect(() => {
    try { localStorage.setItem('recap-a11y', JSON.stringify(settings)); } catch { /* ignore */ }
  }, [settings]);

  const toggle = (key) => {
    setSettings(prev => {
      const next = { ...prev };
      if (key in STEPPED_MAX) {
        next[key] = prev[key] >= STEPPED_MAX[key] ? 0 : prev[key] + 1;
        if (key === 'biggerText'  && next[key] > 0) next.smallerText = 0;
        if (key === 'smallerText' && next[key] > 0) next.biggerText  = 0;
      } else {
        next[key] = !prev[key];
      }
      return next;
    });
  };

  const reset = () => {
    setSettings({ ...defaultSettings });
  };

  return (
    <AccessibilityContext.Provider value={{ settings, toggle, reset }}>
      {children}
    </AccessibilityContext.Provider>
  );
}

export const useAccessibility = () => useContext(AccessibilityContext);

/**
 * Wrap ALL page content (Routes/Suspense) in this component.
 * Filters (saturation, invert) are applied HERE, not on body/html,
 * so that the AccessibilityWidget — which lives OUTSIDE this wrapper —
 * keeps correct position:fixed behaviour and is never color-filtered.
 */
export function A11yPageWrapper({ children }) {
  const { settings } = useAccessibility();

  const filterParts = [
    settings.saturation   && 'grayscale(100%)',
    settings.invertColors && 'invert(100%) hue-rotate(180deg)',
  ].filter(Boolean);

  const classes = [
    settings.biggerText  > 0  && `a11y-bigger-${settings.biggerText}`,
    settings.smallerText > 0  && `a11y-smaller-${settings.smallerText}`,
    settings.textSpacing > 0  && `a11y-spacing-${settings.textSpacing}`,
    settings.lineHeight  > 0  && `a11y-lh-${settings.lineHeight}`,
    settings.dyslexiaFriendly && 'a11y-dyslexia',
    settings.highlightLinks   && 'a11y-hl-links',
    settings.pauseAnimation   && 'a11y-pause',
    settings.hideImages       && 'a11y-hide-img',
    settings.bigCursor        && 'a11y-big-cursor',
  ].filter(Boolean).join(' ');

  return (
    <div
      id="a11y-page-wrapper"
      className={classes || undefined}
      style={filterParts.length ? { filter: filterParts.join(' ') } : undefined}
    >
      {children}
    </div>
  );
}
