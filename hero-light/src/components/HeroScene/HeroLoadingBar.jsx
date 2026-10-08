/**
 * Sits just under the crystal while the six portrait photos are still
 * loading (see HeroScene.jsx / mountHeroScene.js). `hidden` is set true
 * the instant they're all in — the CSS transition on
 * `.hero-loading-bar--hidden` is what actually fades it out, so it stays
 * mounted for that transition instead of vanishing on the same frame the
 * photos start their own entrance.
 */
export default function HeroLoadingBar({ progress, hidden }) {
  return (
    <div
      className={`hero-loading-bar${hidden ? ' hero-loading-bar--hidden' : ''}`}
      role="progressbar"
      aria-valuenow={Math.round(progress * 100)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label="Loading"
    >
      <div
        className="hero-loading-bar__fill"
        style={{ transform: `scaleX(${Math.max(progress, 0.04)})` }}
      />
    </div>
  )
}
