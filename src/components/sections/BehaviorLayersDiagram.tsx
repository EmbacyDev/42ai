import styles from './BehaviorLayersDiagram.module.css'

const ASSET_BASE = '/assets/images/behavior-layers'

type LabelBlockProps = {
  title: string
  description: string
}

function LabelBlock({ title, description }: LabelBlockProps) {
  return (
    <div className={styles.labelBlock}>
      <p className={`${styles.labelTitle} gradientText`}>{title}</p>
      <p className={styles.labelDescription}>{description}</p>
    </div>
  )
}

function Connector({ mirrored = false }: { mirrored?: boolean }) {
  return (
    <div className={mirrored ? `${styles.connector} ${styles.connectorMirrored}` : styles.connector} aria-hidden="true">
      <img src={`${ASSET_BASE}/connector-right.svg`} alt="" className={styles.connectorImage} />
    </div>
  )
}

export function BehaviorLayersDiagram() {
  return (
    <div
      className={styles.root}
      role="img"
      aria-label="Diagram showing four stacked behavioral layers: The Event, Personal Interpretation, Personal Context, and Foundational Traits"
    >
      <div className={styles.sideColumn}>
        <div className={styles.sideSpacer} aria-hidden="true" />
        <LabelBlock
          title="Personal Interpretation"
          description="How this specific person interprets this specific situation — the same event read differently by different people."
        />
        <div className={styles.sideSpacer} aria-hidden="true" />
        <LabelBlock
          title="Foundational Traits"
          description="A stable psychometric profile. Who someone is, independent of the moment."
        />
      </div>

      <div className={styles.connectorColumn}>
        <div className={styles.sideSpacer} aria-hidden="true" />
        <Connector />
        <div className={styles.sideSpacer} aria-hidden="true" />
        <Connector />
      </div>

      <div className={styles.centerColumn}>
        <img
          src={`${ASSET_BASE}/stack.png`}
          alt=""
          className={styles.stackImage}
          aria-hidden="true"
        />
      </div>

      <div className={styles.connectorColumn}>
        <Connector mirrored />
        <div className={styles.sideSpacer} aria-hidden="true" />
        <Connector mirrored />
        <div className={styles.sideSpacer} aria-hidden="true" />
      </div>

      <div className={styles.sideColumn}>
        <LabelBlock
          title="The Event"
          description="The actual situation. Market conditions, a life event, an in app moment."
        />
        <div className={styles.sideSpacer} aria-hidden="true" />
        <LabelBlock
          title="Personal Context"
          description="Experience and environment shape how behavior is expressed. Context influences outcomes."
        />
        <div className={styles.sideSpacer} aria-hidden="true" />
      </div>
    </div>
  )
}
