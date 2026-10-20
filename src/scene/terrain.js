// The shape of the ground.
//
// The first version was a flat 1200 m plane, which is the single biggest reason
// the world read as "tabletop with trees on it". This gives every map a rolling
// surface to lie on, at an amplitude that matches its character: a blizzard on a
// frozen lake should be flat and exposed, a ridge should have real relief.
//
// It's a closed-form function rather than a stored heightmap so that the ground
// mesh, the camera, the enemies, the trees and the bread all agree on where the
// surface is without any of them having to own the others' data.

// Three sine waves at different scales, summed and normalised so the result
// spans roughly -amp..+amp. Deterministic: the same (x, z, map) always gives the
// same height, which is what makes it safe to sample from several modules.
export function terrainHeight(x, z, map) {
  const t = map && map.terrain;
  const amp = t ? t.amp : 0;
  if (!amp) return 0;

  const s = (t.seed || 0) * 12.9898;
  // Two long waves give the map its shape; the shorter terms are what you
  // actually notice walking, because a 300 m rise is invisible at 100 m and a
  // 60 m hollow is not.
  const h =
    0.46 * Math.sin(x * 0.021 + s) * Math.cos(z * 0.017 - s) +
    0.26 * Math.sin(x * 0.045 - s * 1.7) * Math.sin(z * 0.038 + s) +
    0.12 * Math.cos((x + z) * 0.083 + s) +
    0.1 * Math.sin(x * 0.062 + s * 2.1) * Math.sin(z * 0.055 - s * 0.7) +
    0.06 * Math.cos(x * 0.11 - z * 0.09 + s * 3.3);

  return h * amp;
}

// The slope at a point, as a small vector, so props can tip to sit in the snow
// instead of standing at attention on a hill.
export function terrainNormal(x, z, map, epsilon = 1.5) {
  const hL = terrainHeight(x - epsilon, z, map);
  const hR = terrainHeight(x + epsilon, z, map);
  const hD = terrainHeight(x, z - epsilon, map);
  const hU = terrainHeight(x, z + epsilon, map);
  return { dHdx: (hR - hL) / (2 * epsilon), dHdz: (hU - hD) / (2 * epsilon) };
}
