export const sceneConfig = {
  background: '#f7f7f6',
  // Portraits live on this canvas; the crystal shader is a separate one
  // with its own pixel ratio. Cap at the screen's density so the
  // photographs stay as sharp as the DOM type beside them.
  dprCap: 2,
  /** The Figma frame the portrait placement is read from. */
  design: {
    width: 1440,
    height: 800,
  },
  /**
   * A wide lens up close, not a long lens far away. Both frame the same
   * area — `tan(fov/2) * z` is equal — but at fov 30 from 9 units a card
   * 0.8 wide barely trapezoids, so a turned card reads as a flat rectangle
   * someone rotated on screen. At fov 52 from 4.94 the near edge of a
   * turned card is visibly larger than its far edge, and the depth between
   * the front and back of the shell separates properly.
   */
  camera: {
    fov: 52,
    near: 0.1,
    far: 40,
    position: [0, 0, 4.94],
    lookAt: [0, 0, 0],
    designAspect: 1440 / 800,
  },
  parallax: {
    maxDegrees: 3.2,
    smoothing: 4.2,
  },
  /**
   * How far the portrait field is pushed out from the macet.
   *
   * Every card's Figma position is scaled away from the pivot — the
   * crystal's own centre in design pixels — before it is placed. Card sizes
   * are untouched, so the composition covers more of the frame at the same
   * scale rather than simply being zoomed.
   *
   * Both numbers are against a wall. Horizontally the macet already nearly
   * fills the frame, and image-06 — the outermost card, and the nearest to
   * camera, so the largest on screen — runs off the left edge past 1.09.
   * Vertically the copy block at y 514 is the floor. `scripts/checkFraming`
   * prints every card's projected bounds against both limits.
   */
  composition: {
    pivot: [720, 336.9],
    // 1.09 was the old ceiling — image-06 (the outermost, nearest-camera
    // card) ran off the left edge past it. Raised together with
    // sphere.radius below, which is what actually let it go higher: at the
    // old radius (3.75), anything past ~1.10 pinned image-06 to the
    // crystal's plane instead of the sphere (see the sphere.radius
    // comment) — `scripts/checkFraming.mjs` is how this was checked, run
    // it again if either number moves further. Trimmed back from 1.11 to
    // 1.10 when sphere.center dropped (below) — the lower shell pushes
    // image-06 further toward that same edge, so this gives it a little
    // room back.
    // The v2 macet already places the six cards at the frame. Spreading
    // them further pushes the outer photographs off the 1440 edge.
    spreadX: 1,
    spreadY: 1,
    /**
     * How much of the macet's in-plane tilt each card keeps.
     *
     * At zero the cards carry no screen-space roll at all. The macet tilts
     * them outward-edge-up on both sides, and read as a set that is a
     * smile: it made the whole field look like a bowl tipped toward the
     * viewer rather than a shell standing around the crystal. The per-card
     * values stay in `portraits.js`, so this restores them.
     */
    roll: 1,
  },
  /**
   * The crystal sits a little above the centre of the portrait shell rather
   * than exactly on it — `sphere.center` below stays where the macet puts
   * it, so lifting this does not disturb the card placement.
   */
  crystal: {
    // Figma frame 318:35295 is 260×250 at (590, 176). Its centre is
    // (720, 301) in the 1440×800 hero, which is this world Y at the
    // design camera. PageCrystal projects that same design point.
    position: [0, 0.596, 0],
    radius: 0.78,
    designCenter: [720, 301],
  },
  /**
   * Headline block from Figma node 318:35287: 868×248 at (286, 478).
   */
  copy: {
    designTop: 478,
    designWidth: 868,
  },
  /**
   * The invisible sphere the portraits live on, centered on the crystal.
   * Cards sit on its far half and face inward, so the field reads as the
   * inside of a shell wrapped around the crystal, with the crystal itself
   * the nearest thing to the camera.
   *
   * `radius` has a hard floor: the outermost card (image-06) already sits
   * that far from the crystal at the crystal's own plane, and moving it
   * back onto the far half only increases the distance. Below the floor a
   * card cannot reach the sphere and `placement.js` warns. The floor scales
   * with `composition.spreadX`, which is why this grew along with it.
   * Larger radius flattens the shell, smaller tightens it — but the turn is
   * better controlled with `wrap` per card.
   */
  sphere: {
    // Was [0, 0.38, 0]. The camera sits at y=0 and looks dead level (no
    // pitch — see camera.lookAt) — the higher this sits above that, the
    // more the whole shell is inherently viewed from below, independent
    // of any per-card correction (see levelToCamera). Dropped to 0.15,
    // as low as it goes without the correction below needing an
    // impractically large multiplier — measured with a one-off script
    // (sampled each card's projected top/bottom row curvature, the way
    // `scripts/checkFraming.mjs` samples bounds) sweeping both this and
    // levelToCamera together: symmetry stays excellent (top:bottom
    // within ~5%) all the way down to ~0.12, then degrades fast and
    // needs a levelToCamera past 50 to fight back, which is a much less
    // stable correction than a genuinely lower shell.
    center: [0, 0.15, 0],
    // The right-hand cards in hero 318:35283 sit near the frame edge.
    // Below ~4.03, image-03 cannot reach the far half and pins to the
    // crystal's plane. 4.2 clears that and leaves the on-screen boxes put.
    radius: 4.2,
    /**
     * Toward-the-crystal pitch. Left at zero — that is the rotation that
     * yanked the top edges up. The photos face the camera vertically
     * instead, via `levelToCamera`.
     */
    verticalTurn: 0,
    /**
     * How much of the shell's look-up to cancel. The sphere sits above
     * the camera's look-at, so at 0 the field is seen from below and the
     * photos look yanked up at the edges. 1 is the geometric elevation
     * (the angle from the camera straight to sphere.center); the yawed
     * cards still read as tipped from that angle, so this runs higher and
     * the shell faces us. Same amount on every card.
     *
     * Positive values correct the "seen from below" look toward flat/level
     * (0 is the untouched below-eye-line view, ~1 is roughly level). A
     * small negative value instead tips the cards past level the other
     * way, top edge toward the camera — the deliberate small forward lean
     * asked for here, not the top/bottom-symmetry correction this dial was
     * originally added for.
     */
    levelToCamera: -3,
  },
}
