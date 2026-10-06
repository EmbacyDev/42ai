import { labels as defaultLabels } from './labels.js'

function LabelBody({ label }) {
  if (label.kind === 'state') {
    return (
      <>
        <p className="hero-label__title">
          {label.title.map((line) => (
            <span key={line}>{line}</span>
          ))}
        </p>
        <span className="hero-label__tag">{label.tag}</span>
      </>
    )
  }

  if (label.kind === 'metric') {
    return (
      <>
        <p className="hero-label__value">
          {label.value}
          <span className="hero-label__unit">{label.unit}</span>
        </p>
        <p className="hero-label__title">
          {label.title.map((line) => (
            <span key={line}>{line}</span>
          ))}
        </p>
      </>
    )
  }

  return (
    <>
      <img
        className="hero-label__icon"
        src={label.icon.src}
        alt=""
        width={label.icon.width}
        height={label.icon.height}
      />
      <p className="hero-label__title">
        {label.title.map((line) => (
          <span key={line}>{line}</span>
        ))}
      </p>
    </>
  )
}

export default function HeroLabels({ labels = defaultLabels }) {
  return (
    <div className="hero-labels">
      {/* The CSS3D camera. `chipLayer.js` writes the view matrix here and
          each chip's world matrix on the boxes inside it. */}
      <div className="hero-labels__stage">
        {labels.map((label) => (
          <div
            key={label.id}
            className={`hero-label hero-label--${label.kind}`}
            data-label-id={label.id}
            style={{
              width: label.box.width,
              height: label.box.height,
              padding: label.padding,
              gap: label.gap,
            }}
          >
            <LabelBody label={label} />
          </div>
        ))}
      </div>
    </div>
  )
}
