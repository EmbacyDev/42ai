import styles from './BehaviorLayersSection.module.css'

type BehaviorLayersSectionProps = {
  className?: string
}

export function BehaviorLayersSection({ className }: BehaviorLayersSectionProps) {
  return (
    <section
      className={className ? `${styles.section} ${className}` : styles.section}
      id="how-it-works"
      aria-labelledby="behavior-heading"
    >
      <div className={styles.header}>
        <h2 className={`${styles.title} gradientText`} id="behavior-heading">
          Behavior isn&apos;t one signal. It&apos;s four, stacked.
        </h2>
        <p className={`${styles.subtitle} gradientText`}>
          Every prediction is built from layers you can see, audit, and trust —
          individually and together.
        </p>
      </div>

      <div className={styles.diagram}>
        <img
          className={styles.diagramImage}
          src="/assets/images/behavior-layers.png"
          alt="Diagram showing four stacked behavioral layers: The Event, Personal Context, Personal Interpretation, and Foundational Traits"
          loading="lazy"
        />
      </div>
    </section>
  )
}
