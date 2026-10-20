// The map preview panel, drawn on a canvas.
//
// All procedural, like everything visual in this game: sky from the map's own
// gradients, a seeded treeline silhouette, weather worked in per map type. The
// point is not photorealism — it is that the four deployments should be told
// apart at a glance and should read as *places* (a river line, a lake, a burnt
// farm district, open Lapland ridges), not as four swatches of different snow.
//
// Plain 2D canvas on purpose: this lives in the UI layer, which must not touch
// Three.js. Nothing here is exported to the game — it is a menu picture.

export function drawMapPreview(canvas, map) {
  if (!canvas || !map) return;
  const w = canvas.width;
  const h = canvas.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // Deterministic variable per map, so the same deployment always previews the
  // same — a menu picture that reshuffles on every look feels broken.
  let seed = [...String(map.id)].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
  const rand = () => {
    // mulberry32 — small, stable, uniform.
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const horizon = h * 0.52;
  const treeColor = map.id === 'village' ? '#5a4a3c' : '#2c3b33';
  const treeSnow = 'rgba(244, 248, 251, 0.85)';

  // ---- Sky ----
  const sky = ctx.createLinearGradient(0, 0, 0, horizon + h * 0.06);
  sky.addColorStop(0, map.sky.top);
  sky.addColorStop(0.62, map.sky.mid);
  sky.addColorStop(1, map.sky.low);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, horizon + h * 0.06);

  // Sun for the bright map: a hard white disc with a halo.
  if (map.weather === 'bright') {
    const sx = w * 0.72;
    const sy = h * 0.2;
    const halo = ctx.createRadialGradient(sx, sy, 2, sx, sy, h * 0.16);
    halo.addColorStop(0, 'rgba(255,255,255,0.95)');
    halo.addColorStop(0.15, 'rgba(255,250,235,0.6)');
    halo.addColorStop(1, 'rgba(255,250,235,0)');
    ctx.fillStyle = halo;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(sx, sy, h * 0.028, 0, Math.PI * 2);
    ctx.fill();
  }

  // ---- Weather haze over the horizon ----
  if (map.weather === 'fog') {
    ctx.fillStyle = 'rgba(213, 218, 222, 0.55)';
    ctx.fillRect(0, horizon - h * 0.14, w, h * 0.2);
  } else if (map.weather === 'blizzard') {
    const haze = ctx.createLinearGradient(0, 0, 0, horizon);
    haze.addColorStop(0, 'rgba(232, 238, 244, 0.25)');
    haze.addColorStop(1, 'rgba(238, 243, 247, 0.78)');
    ctx.fillStyle = haze;
    ctx.fillRect(0, 0, w, horizon);
  }

  // ---- Distant tree silhouettes (a rolling edge of forest) ----
  drawTreeline(ctx, w, horizon, h * 0.05, treeColor, treeSnow, rand, 0.42);
  drawTreeline(ctx, w, horizon + h * 0.01, h * 0.075, treeColor, treeSnow, rand, 0.6);

  // ---- Ground ----
  const ground = ctx.createLinearGradient(0, horizon, 0, h);
  ground.addColorStop(0, map.ground.base);
  ground.addColorStop(1, map.ground.tint);
  ctx.fillStyle = ground;
  ctx.fillRect(0, horizon + h * 0.02, w, h - horizon);

  // ---- Map-specific landmarks ----
  if (map.id === 'kollaa') {
    // The river: a white-washed ice channel cutting the frame.
    ctx.fillStyle = 'rgba(228, 240, 250, 0.9)';
    ctx.beginPath();
    ctx.moveTo(w * 0.34, horizon);
    ctx.bezierCurveTo(w * 0.52, horizon + h * 0.08, w * 0.56, h * 0.78, w * 0.4, h);
    ctx.lineTo(w * 0.52, h);
    ctx.bezierCurveTo(w * 0.66, h * 0.76, w * 0.62, horizon + h * 0.06, w * 0.46, horizon);
    ctx.closePath();
    ctx.fill();
    // A sagging blue line-marking hedge: the defence line posts.
    ctx.strokeStyle = 'rgba(72, 108, 158, 0.7)';
    ctx.lineWidth = Math.max(1, h * 0.006);
    ctx.setLineDash([w * 0.014, w * 0.012]);
    ctx.beginPath();
    ctx.moveTo(w * 0.16, h * 0.86);
    ctx.lineTo(w * 0.8, h * 0.66);
    ctx.stroke();
    ctx.setLineDash([]);
  } else if (map.id === 'lake') {
    // The frozen lake: a broad ice sheet with pressure-crack lines.
    ctx.fillStyle = 'rgba(214, 229, 240, 0.95)';
    ctx.beginPath();
    ctx.roundRect(w * 0.12, h * 0.6, w * 0.76, h * 0.3, h * 0.02);
    ctx.fill();
    ctx.strokeStyle = 'rgba(150, 175, 195, 0.5)';
    ctx.lineWidth = Math.max(1, h * 0.004);
    for (let i = 0; i < 7; i++) {
      const cx = w * rand();
      const cy = h * (0.62 + rand() * 0.26);
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      const n = 2 + Math.floor(rand() * 3);
      for (let k = 0; k < n; k++) {
        ctx.lineTo(cx + (rand() - 0.5) * w * 0.24, cy + (rand() - 0.5) * h * 0.16);
      }
      ctx.stroke();
    }
  } else if (map.id === 'village') {
    // Burnt farmsteads: charred gables and posts casting long shadows.
    for (let i = 0; i < 5; i++) {
      const bx = w * (0.1 + i * 0.18 + rand() * 0.04);
      const bh = h * (0.08 + rand() * 0.06);
      ctx.fillStyle = '#3d2f24';
      ctx.beginPath();
      ctx.moveTo(bx, h * 0.9);
      ctx.lineTo(bx, h * 0.9 - bh);
      ctx.lineTo(bx + w * 0.035, h * 0.9 - bh - h * 0.025);
      ctx.lineTo(bx + w * 0.07, h * 0.9 - bh);
      ctx.lineTo(bx + w * 0.07, h * 0.9);
      ctx.closePath();
      ctx.fill();
      // Snow drifted against the burned wall.
      ctx.fillStyle = 'rgba(244, 248, 251, 0.75)';
      ctx.fillRect(bx - w * 0.012, h * 0.9 - h * 0.02, w * 0.094, h * 0.02);
    }
  } else if (map.id === 'ridge') {
    // Open ridge: a couple of long white shoulders with exposed rock crests.
    for (const [x0, wdt, peak] of [[0.05, 0.5, 0.74], [0.45, 0.7, 0.64]]) {
      ctx.fillStyle = 'rgba(215, 230, 242, 0.8)';
      ctx.beginPath();
      ctx.moveTo(w * x0, h);
      ctx.quadraticCurveTo(w * (x0 + wdt / 2), h * peak, w * (x0 + wdt), h);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = 'rgba(120, 130, 140, 0.55)';
      ctx.beginPath();
      ctx.ellipse(w * (x0 + wdt * rand()), h * (peak + 0.06), w * 0.05, h * 0.012, 0.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // ---- Falling snow, heavier the windier the map ----
  const flakes = map.weather === 'blizzard' ? 160 : map.weather === 'fog' ? 40 : 22;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
  for (let i = 0; i < flakes; i++) {
    const a = Math.max(0.5, rand()) * 1.8;
    const fsize = Math.max(1, h * 0.004 * rand() * 2);
    const drift = map.weather === 'blizzard' ? w * 0.06 : w * 0.012;
    ctx.globalAlpha = 0.25 + rand() * 0.6;
    ctx.fillRect(rand() * w, rand() * h, fsize * a, fsize);
    ctx.fillRect(rand() * w + drift, rand() * h, fsize, fsize);
  }
  ctx.globalAlpha = 1;

  // ---- Blizzard banding: the wind as horizontal streaks ----
  if (map.weather === 'blizzard') {
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
    for (let i = 0; i < 18; i++) {
      ctx.lineWidth = Math.max(1, h * 0.003 * (0.5 + rand()));
      ctx.beginPath();
      const y0 = rand() * h;
      ctx.moveTo(rand() * w, y0);
      ctx.lineTo(rand() * w, y0 + (rand() - 0.5) * h * 0.06);
      ctx.stroke();
    }
  }

  // ---- A soft vignette so panel edges sit down ----
  const vig = ctx.createLinearGradient(0, 0, 0, h);
  vig.addColorStop(0, 'rgba(8, 12, 15, 0.16)');
  vig.addColorStop(0.5, 'rgba(8, 12, 15, 0)');
  vig.addColorStop(1, 'rgba(8, 12, 15, 0.4)');
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, w, h);
}

// One rolling edge of forest along a baseline. `tallness` in pixels; trees sit
// on a slow sine with jitter so the edge never looks like a comb.
function drawTreeline(ctx, w, baseline, tallness, color, snowColor, rand, density) {
  const step = w * (0.02 + rand() * 0.012) / Math.max(0.5, density);
  ctx.fillStyle = color;
  const zig = [];
  for (let x = -step; x <= w + step; x += step) {
    const height =
      tallness * (0.7 + 0.3 * Math.sin(x * 0.012) + (rand() - 0.5) * tallness * 0.7);
    zig.push({ x, height });
    ctx.beginPath();
    ctx.moveTo(x - step / 2, baseline);
    ctx.lineTo(x, baseline - height);
    ctx.lineTo(x + step / 2, baseline);
    ctx.closePath();
    // Snow caps only on the tallest thirds.
    if (height > tallness * 0.9) {
      ctx.fillStyle = snowColor;
      ctx.beginPath();
      ctx.moveTo(x - step * 0.22, baseline - height * 0.72);
      ctx.lineTo(x, baseline - height);
      ctx.lineTo(x + step * 0.22, baseline - height * 0.72);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = color;
    }
  }
  // Sink the sill so no gaps show at the baseline.
  ctx.fillRect(-step, baseline, w + step * 2, tallness * 0.5);
  return zig;
}
