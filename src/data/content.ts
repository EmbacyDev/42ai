export const NAV_LINKS = [
  { label: 'Features', href: '#features' },
  { label: 'Applications', href: '#applications' },
  { label: 'How it works', href: '#how-it-works' },
  { label: 'About Us', href: '#about' },
] as const

export const HERO = {
  title: 'Know what people will do next.',
  subtitle: 'Not personas. Not averages. The specific person, in the specific moment.',
  cta: 'Request demo',
} as const

export const USE_CASES = [
  {
    id: 'banking',
    image: '/assets/images/use-case-1.jpg',
    alt: 'Banking and fintech use case',
    title: 'Banking & Fintech',
    description: 'Know how someone will handle money — before they do.',
  },
  {
    id: 'brokerages',
    image: '/assets/images/use-case-2.jpg',
    alt: 'Brokerages use case',
    title: 'Brokerages',
    description: 'Better LTV. Sharper risk.',
  },
  {
    id: 'gaming',
    image: '/assets/images/use-case-3.jpg',
    alt: 'Gaming use case',
    title: 'Gaming',
    description: 'Cold start solved. Churn predicted. Whales identified.',
  },
  {
    id: 'capital',
    image: '/assets/images/use-case-4.jpg',
    alt: 'Capital markets use case',
    title: 'Capital Markets',
    description: 'Alpha signals from behavioral drivers.',
  },
] as const

export const PREDICTION_TABS = [
  'Market shock',
  'New product',
  'Credit decision',
  'Player behavior',
] as const

export const LANDSCAPE = {
  title: "There's a model behind this.",
  subtitle:
    'Not another LLM wrapper. A behavioral model trained to understand the drivers behind human decisions — built from the ground up.',
  cta: 'Explore the technology',
} as const

export const PRODUCTS = [
  {
    id: 'lbm',
    image: '/assets/images/product-1.jpg',
    alt: 'Person using a smartphone against a blue sky',
    title: 'Large Behavioral Model',
    description:
      'Give it an event. Get what a specific person will do next. Connects into your existing data. No new pipeline. Ask about one customer — get a decision-ready answer, in real time.',
    cta: 'Explore the Product',
  },
  {
    id: 'world-model',
    image: '/assets/images/product-2.jpg',
    alt: 'Crowd in motion from above',
    title: 'World Model',
    description:
      'Give it a change. Watch how the system reacts. A simulated environment on the same core. Model how a population responds to a shock — before you make it.',
    cta: 'Explore the Product',
  },
] as const

export const STATS = [
  { value: '2.5x', label: 'more accurate than frontier LLMs' },
  { value: '1M+', label: 'scenarios validated' },
  { value: '24 hours', label: 'to first prediction' },
  { value: '2M+', label: 'individuals represented across proprietary behavioral dataset' },
] as const

export const CTA_BANNER = {
  title: 'Bring your data. See what it predicts.',
  subtitle: 'First results in 24 hours, on your own environment — not a generic demo.',
  primaryCta: 'Book a demo',
  secondaryCta: 'Talk to us',
} as const
