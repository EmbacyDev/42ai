/**
 * The curve of a card.
 *
 * Cylindrical, not spherical: a card bends around the vertical axis only,
 * so the shell the cards sit on is a cylinder standing around the crystal
 * rather than a ball. Bending in y as well curled the top and bottom edges
 * toward the viewer, and since every card did it the field read as a bowl
 * tipped up at the rim. The horizontal bend is the one that carries the
 * wrap around the crystal, and it is untouched.
 *
 * One module because the geometry, the chips that sit on it and the
 * framing script all have to agree on the same surface; when the formula
 * lived in each of them they drifted.
 */
export function bendAt(x, _y, { radius, curvature }) {
  return (curvature * x * x) / (2 * radius)
}

/** The surface normal at a point, in the card's own space. */
export function bendNormal(x, _y, { radius, curvature }, target) {
  return target.set((-curvature * x) / radius, 0, 1).normalize()
}
