// The aiming overlay.
//
// Two states, and they answer different questions. Hip and third person get a
// centre dot and a bracket that snaps onto whoever is under the aim line. First
// person while aiming gets the scope: a black surround with a round window, a
// mil-dot ladder, and the range to the man in it.
//
// All DOM over the canvas. Upright hairlines that alias into nothing at 4x are
// the one thing a scope cannot afford, and CSS keeps them an exact single pixel
// at any resolution.

function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (key === 'class') node.className = value;
    else if (key === 'text') node.textContent = value;
    else if (value !== null && value !== undefined) node.setAttribute(key, value);
  }
  for (const child of [].concat(children)) if (child) node.appendChild(child);
  return node;
}

export function createReticle(root) {
  const wrap = el('div', { class: 'reticle hidden' });

  // ---- The scope ---------------------------------------------------------
  // The window is a circle with a vmax-wide shadow, which is the whole trick:
  // one element paints the black surround, so there is no mask to keep in sync.
  const window_ = el('div', { class: 'scope-window' }, [
    el('div', { class: 'scope-glass' }),
    el('div', { class: 'scope-hair scope-hair-h' }),
    el('div', { class: 'scope-hair scope-hair-v' }),
    el('div', { class: 'scope-mil scope-mil-v1' }),
    el('div', { class: 'scope-mil scope-mil-v2' }),
    el('div', { class: 'scope-mil scope-mil-v3' }),
    el('div', { class: 'scope-mil scope-mil-v4' }),
    el('div', { class: 'scope-mil scope-mil-h1' }),
    el('div', { class: 'scope-mil scope-mil-h2' }),
    el('div', { class: 'scope-center' }),
  ]);
  const zoomLabel = el('div', { class: 'scope-zoom', text: '×4' });
  const scope = el('div', { class: 'scope' }, [window_, zoomLabel]);

  // ---- Third-person crosshair -------------------------------------------
  const dot = el('div', { class: 'reticle-dot hidden' });

  // ---- Target bracket ----------------------------------------------------
  const range = el('span', { class: 'reticle-range', text: '' });
  const bracket = el('div', { class: 'reticle-bracket hidden' }, [
    el('span', { class: 'rb rb-tl' }),
    el('span', { class: 'rb rb-tr' }),
    el('span', { class: 'rb rb-bl' }),
    el('span', { class: 'rb rb-br' }),
    range,
  ]);

  wrap.append(scope, dot, bracket);
  root.appendChild(wrap);

  return {
    show() {
      wrap.classList.remove('hidden');
    },
    hide() {
      wrap.classList.add('hidden');
    },

    // True in third person, where there is no scope and a plain dot serves.
    setCrosshair(on) {
      dot.classList.toggle('hidden', !on);
    },

    // On only in first person while the scope is up. Third person keeps the dot
    // and the bracket and no glass, because the camera is behind the shoulder.
    setScope(on) {
      this.setScopeProgress(on ? 1 : 0);
    },

    // The raise runs continuously (driven by main.js every frame), so the glass
    // fades in with the rifle's rise to the eye instead of snapping on. The
    // class still gates pointer-hittable extras; opacity is inline so it never
    // fights a stylesheet transition for per-frame ownership.
    setScopeProgress(t) {
      scope.style.opacity = String(Math.max(0, Math.min(1, t)));
      scope.style.visibility = t <= 0.001 ? 'hidden' : 'visible';
      wrap.classList.toggle('reticle-scoping', t > 0.5);
    },

    setZoom(label) {
      zoomLabel.textContent = label;
    },

    // x / y in CSS pixels, already projected from the world. `hint` is an
    // optional nudge ("right-click") shown next to the range.
    setTarget({ x, y, distance, locked, size, hint }) {
      bracket.classList.remove('hidden');
      bracket.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`;
      bracket.style.setProperty('--bracket-size', `${size}px`);
      bracket.classList.toggle('reticle-locked', Boolean(locked));
      range.textContent = hint ? `${distance.toFixed(0)} m · ${hint}` : `${distance.toFixed(0)} m`;
    },

    clearTarget() {
      bracket.classList.add('hidden');
      bracket.classList.remove('reticle-locked');
    },
  };
}
