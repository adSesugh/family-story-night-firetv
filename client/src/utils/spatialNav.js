/**
 * spatialNav.js — Spatial Focus Navigation Engine for Fire TV / D-pad input.
 *
 * On Fire TV's Silk browser (and other TV/gamepad environments), pressing
 * D-pad arrow keys does NOT automatically move browser focus between elements
 * the way Tab does on desktop. This module provides a spatial navigation
 * engine that finds the nearest focusable element in the pressed direction
 * and calls .focus() on it, producing visible focus highlights.
 *
 * Usage:
 *   import { moveFocus, getFocusableElements } from './spatialNav';
 *   // In a keydown handler:
 *   moveFocus('up' | 'down' | 'left' | 'right');
 */

/**
 * CSS selector for all elements that should be navigable via d-pad.
 */
const FOCUSABLE_SELECTOR = [
  "a[href]:not([tabindex='-1'])",
  "button:not([disabled]):not([tabindex='-1'])",
  "input:not([disabled]):not([tabindex='-1'])",
  "select:not([disabled]):not([tabindex='-1'])",
  "textarea:not([disabled]):not([tabindex='-1'])",
  "[tabindex]:not([tabindex='-1'])",
  "[data-focusable]",
].join(", ");

/**
 * Return all currently visible, non-hidden focusable elements in the DOM.
 * @returns {HTMLElement[]}
 */
export function getFocusableElements(container) {
  let root = container;
  if (!root) {
    const openDialog = document.querySelector('[role="dialog"][aria-modal="true"], dialog[open]');
    root = openDialog || document;
  }
  const all = Array.from(root.querySelectorAll(FOCUSABLE_SELECTOR));
  return all.filter((el) => {
    if (el.getAttribute("tabindex") === "-1" && !el.hasAttribute("data-focusable")) return false;
    const isJSDOM = typeof navigator !== "undefined" && navigator.userAgent && navigator.userAgent.includes("jsdom");
    if (!isJSDOM && !el.offsetParent && el.tagName !== "BODY") return false; // hidden via display:none
    const style = window.getComputedStyle(el);
    if (style.visibility === "hidden" || style.display === "none") return false;
    if (el.getAttribute("aria-hidden") === "true") return false;
    // Skip elements inside aria-hidden containers
    let parent = el.parentElement;
    while (parent && parent !== root) {
      if (parent.getAttribute("aria-hidden") === "true") return false;
      parent = parent.parentElement;
    }
    return true;
  });
}

/**
 * Get the bounding rect center point of an element.
 * @param {HTMLElement} el
 * @returns {{ x: number, y: number, rect: DOMRect }}
 */
function getCenter(el) {
  const rect = el.getBoundingClientRect();
  return {
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2,
    rect,
  };
}

/**
 * Determine if a candidate element is "in front" of the current element
 * for the given direction, using a directional cone test.
 *
 * @param {{ x: number, y: number }} from - Current element center
 * @param {{ x: number, y: number }} to   - Candidate element center
 * @param {'up'|'down'|'left'|'right'} dir
 * @returns {boolean}
 */
function isInDirection(from, to, dir) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;

  // Primary axis must be dominant (45-degree cone)
  switch (dir) {
    case "up":    return dy < -2 && Math.abs(dy) >= Math.abs(dx) * 0.5;
    case "down":  return dy > 2  && Math.abs(dy) >= Math.abs(dx) * 0.5;
    case "left":  return dx < -2 && Math.abs(dx) >= Math.abs(dy) * 0.5;
    case "right": return dx > 2  && Math.abs(dx) >= Math.abs(dy) * 0.5;
    default:      return false;
  }
}

/**
 * Score a candidate element relative to current; lower is better.
 * Weights proximity on the primary axis more heavily than secondary.
 *
 * @param {{ x: number, y: number }} from
 * @param {{ x: number, y: number }} to
 * @param {'up'|'down'|'left'|'right'} dir
 * @returns {number}
 */
function score(from, to, dir) {
  const dx = Math.abs(to.x - from.x);
  const dy = Math.abs(to.y - from.y);

  // Primary axis distance vs secondary axis distance — penalize off-axis
  if (dir === "up" || dir === "down") {
    return dy + dx * 2;
  }
  return dx + dy * 2;
}

/**
 * Move browser focus in the given direction relative to the currently focused element.
 * If nothing is focused, focuses the first focusable element.
 *
 * @param {'up'|'down'|'left'|'right'} direction
 * @returns {boolean} true if focus was moved, false otherwise
 */
export function moveFocus(direction) {
  const focusable = getFocusableElements();
  if (focusable.length === 0) return false;

  const current = document.activeElement;

  // If nothing meaningful is focused, start at the first element
  if (!current || current === document.body || !focusable.includes(current)) {
    const target = focusable[0];
    if (document.querySelectorAll) {
      document.querySelectorAll("[data-dpad-focused]").forEach((el) => el.removeAttribute("data-dpad-focused"));
    }
    target.setAttribute("data-dpad-focused", "true");
    target.focus({ preventScroll: false });
    target.scrollIntoView?.({ behavior: "smooth", block: "nearest", inline: "nearest" });
    return true;
  }

  // Special route: When moving down or left from the Settings Back button,
  // ensure we navigate directly to the settings tabs instead of jumping down into content columns.
  const isSettingsBack = current?.dataset?.testid === "settings-back-btn" || current?.getAttribute?.("data-testid") === "settings-back-btn";
  if (isSettingsBack && (direction === "down" || direction === "left")) {
    const activeTab = focusable.find(
      (el) => el.getAttribute("role") === "tab" && el.getAttribute("aria-selected") === "true"
    );
    const anyTab = focusable.find((el) => el.getAttribute("role") === "tab");
    const target = (direction === "left" ? (focusable.find((el) => el.id === "settings-tab-parent") || activeTab) : activeTab) || anyTab;
    if (target) {
      if (document.querySelectorAll) {
        document.querySelectorAll("[data-dpad-focused]").forEach((el) => el.removeAttribute("data-dpad-focused"));
      }
      target.setAttribute("data-dpad-focused", "true");
      target.focus({ preventScroll: false });
      if (typeof target.click === "function") {
        try { target.click(); } catch (_) {}
      }
      target.scrollIntoView?.({ behavior: "smooth", block: "nearest", inline: "nearest" });
      return true;
    }
  }

  // Special route: When moving up from Settings tabs, or right from Parent Controls tab, route to Back button.
  const isSettingsTab = current?.getAttribute?.("role") === "tab" && current?.id?.startsWith("settings-tab-");
  if (isSettingsTab) {
    if (direction === "up" || (direction === "right" && current?.id === "settings-tab-parent")) {
      const backBtn = focusable.find(
        (el) => el.dataset?.testid === "settings-back-btn" || el.getAttribute?.("data-testid") === "settings-back-btn"
      );
      if (backBtn) {
        if (document.querySelectorAll) {
          document.querySelectorAll("[data-dpad-focused]").forEach((el) => el.removeAttribute("data-dpad-focused"));
        }
        backBtn.setAttribute("data-dpad-focused", "true");
        backBtn.focus({ preventScroll: false });
        backBtn.scrollIntoView?.({ behavior: "smooth", block: "nearest", inline: "nearest" });
        return true;
      }
    }
  }

  // Special route: If moving up from inside a settings panel, prefer landing on the active tab rather than skipping past it to Back button
  if (direction === "up" && current?.closest?.('[role="tabpanel"][id^="settings-panel-"]')) {
    const activeTab = focusable.find(
      (el) => el.getAttribute("role") === "tab" && el.getAttribute("aria-selected") === "true"
    );
    if (activeTab) {
      const fromCenter = getCenter(current);
      let bestAbove = null;
      let bestScoreAbove = Infinity;
      for (const candidate of focusable) {
        if (candidate === current) continue;
        const toCenter = getCenter(candidate);
        if (isInDirection(fromCenter, toCenter, "up")) {
          const s = score(fromCenter, toCenter, "up");
          if (s < bestScoreAbove) {
            bestScoreAbove = s;
            bestAbove = candidate;
          }
        }
      }
      // If there are no other panel elements above or the element above is outside the panel (e.g. back button), focus active tab
      const isAboveOutsidePanel = !bestAbove || !bestAbove.closest?.('[role="tabpanel"][id^="settings-panel-"]');
      if (isAboveOutsidePanel) {
        if (document.querySelectorAll) {
          document.querySelectorAll("[data-dpad-focused]").forEach((el) => el.removeAttribute("data-dpad-focused"));
        }
        activeTab.setAttribute("data-dpad-focused", "true");
        activeTab.focus({ preventScroll: false });
        activeTab.scrollIntoView?.({ behavior: "smooth", block: "nearest", inline: "nearest" });
        return true;
      }
    }
  }

  const fromCenter = getCenter(current);
  let best = null;
  let bestScore = Infinity;

  // Pass 1: Strict 45-degree cone test
  for (const candidate of focusable) {
    if (candidate === current) continue;
    const toCenter = getCenter(candidate);
    if (!isInDirection(fromCenter, toCenter, direction)) continue;
    const s = score(fromCenter, toCenter, direction);
    if (s < bestScore) {
      bestScore = s;
      best = candidate;
    }
  }

  // Pass 2: Fallback to half-plane if strict cone found nothing
  // (Prevents D-pad from freezing when candidates are off-axis or diagonally across wide grids)
  if (!best) {
    for (const candidate of focusable) {
      if (candidate === current) continue;
      const toCenter = getCenter(candidate);
      const dx = toCenter.x - fromCenter.x;
      const dy = toCenter.y - fromCenter.y;
      let inHalfPlane = false;
      if (direction === "up" && dy < -4) inHalfPlane = true;
      else if (direction === "down" && dy > 4) inHalfPlane = true;
      else if (direction === "left" && dx < -4) inHalfPlane = true;
      else if (direction === "right" && dx > 4) inHalfPlane = true;

      if (!inHalfPlane) continue;

      // Heavy off-axis penalty in fallback pass
      const s = score(fromCenter, toCenter, direction) + 500;
      if (s < bestScore) {
        bestScore = s;
        best = candidate;
      }
    }
  }

  if (best) {
    if (document.querySelectorAll) {
      document.querySelectorAll("[data-dpad-focused]").forEach((el) => el.removeAttribute("data-dpad-focused"));
    }
    best.setAttribute("data-dpad-focused", "true");
    best.focus({ preventScroll: false });
    if (best.getAttribute("role") === "tab" || best.dataset?.testid?.startsWith("category-tab-")) {
      try {
        best.click();
      } catch (_) {}
    }
    // Scroll into view smoothly so the focused element is visible
    best.scrollIntoView?.({ behavior: "smooth", block: "nearest", inline: "nearest" });
    return true;
  }

  return false;
}

/**
 * Focus the first focusable element in the document (or container).
 * Call this when a new screen mounts to ensure something is always focused.
 *
 * @param {HTMLElement|null} [container=document] - Optional container to search within
 */
export function focusFirst(container) {
  let root = container;
  if (!root) {
    const openDialog = document.querySelector('[role="dialog"][aria-modal="true"], dialog[open]');
    root = openDialog || document;
  }
  const focusable = getFocusableElements(root);
  if (focusable.length > 0) {
    // If there is an active tab or selected element, prefer focusing it first
    const selectedItem = focusable.find(
      (el) =>
        (el.getAttribute("role") === "tab" && el.getAttribute("aria-selected") === "true") ||
        el.getAttribute("aria-pressed") === "true" ||
        el.getAttribute("aria-selected") === "true"
    );
    const target = selectedItem || focusable[0];
    if (document.querySelectorAll) {
      document.querySelectorAll("[data-dpad-focused]").forEach((el) => el.removeAttribute("data-dpad-focused"));
    }
    target.setAttribute("data-dpad-focused", "true");
    target.focus({ preventScroll: false });
    target.scrollIntoView?.({ behavior: "smooth", block: "nearest", inline: "nearest" });
    return target;
  }
  return null;
}

if (typeof window !== "undefined") {
  window.addEventListener("focusin", (e) => {
    if (document.querySelectorAll) {
      document.querySelectorAll("[data-dpad-focused]").forEach((el) => {
        if (el !== e.target) {
          el.removeAttribute("data-dpad-focused");
        }
      });
    }
  });
}
