import styles from './BehaviorLayersDiagram.module.css'

const ASSET_BASE = '/assets/images/behavior-layers'

type LayerSide = 'left' | 'right'

type Layer = {
  id: string
  title: string
  description: string
  side: LayerSide
  plate: {
    left: number
    top: number
    variant: 'dark' | 'light'
    flip?: boolean
    textured?: boolean
  }
  label: {
    left: number
    top: number
  }
  connector: {
    left: number
    top: number
  }
}

const LAYERS: Layer[] = [
  {
    id: 'event',
    title: 'The Event',
    description: 'Stable psychometric profile. Who someone is, independent of the moment.',
    side: 'right',
    plate: { left: 330, top: 0.52, variant: 'dark', textured: true },
    label: { left: 811, top: 27.52 },
    connector: { left: 790.5, top: 51.52 },
  },
  {
    id: 'interpretation',
    title: 'Personal Interpretation',
    description: 'The actual situation — market conditions, life event, in-app moment.',
    side: 'left',
    plate: { left: 711, top: 72.52, variant: 'light', flip: true },
    label: { left: 0, top: 99.52 },
    connector: { left: 250, top: 123.52 },
  },
  {
    id: 'context',
    title: 'Personal Context',
    description:
      'How this specific person interprets this specific situation — the same event read differently by different people.',
    side: 'right',
    plate: { left: 330, top: 144.52, variant: 'dark' },
    label: { left: 811, top: 171.52 },
    connector: { left: 790.5, top: 195.52 },
  },
  {
    id: 'traits',
    title: 'Foundational Traits',
    description:
      'The predicted action. Not a simulation of what someone might do — a prediction of what they will.',
    side: 'left',
    plate: { left: 711, top: 216.52, variant: 'light', flip: true },
    label: { left: 0, top: 243.52 },
    connector: { left: 250, top: 267.52 },
  },
]

const DESIGN_WIDTH = 1042
const DESIGN_HEIGHT = 322.515625
const PLATE_WIDTH = 381
const PLATE_HEIGHT = 101
const LABEL_WIDTH = 231
const CONNECTOR_WIDTH = 59.5
const CONNECTOR_HEIGHT = 5.33

function toPercent(value: number, base: number) {
  return `${(value / base) * 100}%`
}

export function BehaviorLayersDiagram() {
  return (
    <div
      className={styles.root}
      role="img"
      aria-label="Diagram showing four stacked behavioral layers: The Event, Personal Interpretation, Personal Context, and Foundational Traits"
    >
      <div className={styles.plateStack} aria-hidden="true">
        <img src={`${ASSET_BASE}/plate-stack.svg`} alt="" className={styles.plateStackImage} />
      </div>

      {LAYERS.map((layer) => {
        const plateSrc =
          layer.plate.variant === 'dark' ? `${ASSET_BASE}/plate-dark.svg` : `${ASSET_BASE}/plate-light.svg`
        const connectorSrc =
          layer.side === 'right' ? `${ASSET_BASE}/connector-left.svg` : `${ASSET_BASE}/connector-right.svg`

        return (
          <div key={layer.id}>
            <div
              className={styles.plate}
              style={{
                left: toPercent(layer.plate.left, DESIGN_WIDTH),
                top: toPercent(layer.plate.top, DESIGN_HEIGHT),
                width: toPercent(PLATE_WIDTH, DESIGN_WIDTH),
                height: toPercent(PLATE_HEIGHT, DESIGN_HEIGHT),
              }}
              aria-hidden="true"
            >
              <img
                src={plateSrc}
                alt=""
                className={layer.plate.flip ? styles.plateImageFlipped : styles.plateImage}
              />
              {layer.plate.textured ? (
                <div className={styles.topTexture}>
                  <img src={`${ASSET_BASE}/plate-top-texture.png`} alt="" className={styles.topTextureImage} />
                  <div className={styles.topTextureGlowLeft} />
                  <div className={styles.topTextureGlowRight} />
                </div>
              ) : null}
            </div>

            <div
              className={layer.side === 'left' ? styles.labelLeft : styles.labelRight}
              style={{
                left: toPercent(layer.label.left, DESIGN_WIDTH),
                top: toPercent(layer.label.top, DESIGN_HEIGHT),
                width: toPercent(LABEL_WIDTH, DESIGN_WIDTH),
              }}
            >
              <p className={`${styles.labelTitle} gradientText`}>{layer.title}</p>
              <p className={styles.labelDescription}>{layer.description}</p>
            </div>

            <div
              className={styles.connector}
              style={{
                left: toPercent(layer.connector.left, DESIGN_WIDTH),
                top: toPercent(layer.connector.top, DESIGN_HEIGHT),
                width: toPercent(CONNECTOR_WIDTH, DESIGN_WIDTH),
                height: toPercent(CONNECTOR_HEIGHT, DESIGN_HEIGHT),
              }}
              aria-hidden="true"
            >
              <img src={connectorSrc} alt="" className={styles.connectorImage} />
            </div>
          </div>
        )
      })}
    </div>
  )
}
