// v4: how the liquid inside the crystal sloshes when the gem is turned by
// hand. Written every frame by PageCrystal.jsx (drag velocity → spring),
// read by the crystal's colour shader in Glass.jsx.
// x, y: where the mass has been thrown (crystal-local, ~-0.5..0.5);
// energy: 0..1, how hard it is bubbling right now.
export const crystalSlosh = { x: 0, y: 0, energy: 0 }
