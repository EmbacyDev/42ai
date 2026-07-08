export const NAV_LINKS = [
  { label: 'Features', href: '#features' },
  { label: 'Applications', href: '#applications' },
  { label: 'How it works', href: '#how-it-works' },
  { label: 'About Us', href: '#about' },
] as const

export const HERO = {
  title: 'Know what people will do next.',
  subtitle: 'Meet the Large Behavioral Model, AI trained on the drivers of human decisions.',
  cta: 'Request demo',
} as const

export const USE_CASES = [
  {
    id: 'banking',
    image: '/assets/images/use-case-1.jpg',
    alt: 'Banking and fintech use case',
    title: 'Banking',
    description: 'Know who repays and who defaults before your risk models do.',
  },
  {
    id: 'brokerages',
    image: '/assets/images/use-case-2.jpg',
    alt: 'Brokerages use case',
    title: 'Brokerages',
    description: 'Hedge only the clients who will actually sell.',
  },
  {
    id: 'gaming',
    image: '/assets/images/use-case-3.jpg',
    alt: 'Gaming use case',
    title: 'Gaming',
    description: 'Catch the player days before he churns.',
  },
  {
    id: 'capital',
    image: '/assets/images/use-case-4.jpg',
    alt: 'Capital markets use case',
    title: 'Capital Markets',
    description: 'Trade on behavioral signals that never show up in price data.',
  },
] as const

export const PREDICTION_TABS = [
  'Banking',
  'Brokerages',
  'Gaming',
  'Capital Markets',
] as const

export const PREDICTION_SCENARIOS = [
  {
    tab: 'Banking',
    interfaceImage: '/assets/images/prediction-interface-banking.png',
    event: 'Rates rise and a monthly payment jumps 23%.',
    question: 'Who pays, who restructures, who defaults?',
  },
  {
    tab: 'Brokerages',
    interfaceImage: '/assets/images/prediction-interface-brokerages.png',
    event: 'Volatility spikes across the book overnight.',
    question: 'Which clients need hedging and which can be left alone?',
  },
  {
    tab: 'Gaming',
    interfaceImage: '/assets/images/prediction-interface-gaming.png',
    event: 'A player hits a six loss streak in ranked',
    question: 'Keep playing, spend, or churn this week?',
  },
  {
    tab: 'Capital Markets',
    interfaceImage: '/assets/images/prediction-interface-capital-markets.png',
    event: '21 Oct 2025. Gold books its sharpest drop in a decade.',
    question: 'Who sells into the panic and who adds?',
  },
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
      'Plug in your data and ask about a single customer. The model understands who this person is and tells you what he will do next, fast enough to act on it.',
    cta: 'Explore the Product',
  },
  {
    id: 'world-model',
    image: '/assets/images/product-2.jpg',
    alt: 'Crowd in motion from above',
    title: 'World Model',
    description:
      'Describe a change and watch what happens. The same core simulates a whole population, so you see the reaction before the market does.',
    cta: 'Explore the Product',
  },
] as const

export const STATS = [
  { value: '2.5x', label: 'more accurate than frontier LLMs and classical ML' },
  { value: '2M+', label: 'individuals in a proprietary behavioral dataset' },
  { value: '1M+', label: 'scenarios validated with enterprise customers' },
  { value: '24 hours', label: 'from your data to the first prediction' },
] as const

export const CTA_BANNER = {
  title: 'Bring your data. See what it predicts.',
  subtitle: 'First results in 24 hours, on your own environment — not a generic demo.',
  primaryCta: 'Book a demo',
  secondaryCta: 'Talk to us',
} as const
