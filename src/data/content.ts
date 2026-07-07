export const NAV_LINKS = [
  { label: 'Features', href: '#features' },
  { label: 'Applications', href: '#applications' },
  { label: 'How it works', href: '#how-it-works' },
  { label: 'About Us', href: '#about' },
] as const

export const USE_CASES = [
  { id: 'banking', image: '/assets/images/use-case-1.jpg', alt: 'Banking and fintech use case' },
  { id: 'brokerages', image: '/assets/images/use-case-2.jpg', alt: 'Brokerages use case' },
  { id: 'gaming', image: '/assets/images/use-case-3.jpg', alt: 'Gaming use case' },
  { id: 'capital', image: '/assets/images/use-case-4.jpg', alt: 'Capital markets use case' },
] as const

export const PREDICTION_TABS = [
  'Market shock',
  'New product',
  'Credit decision',
  'Player behavior',
] as const

export const STATS = [
  { value: '2.5x', label: 'more accurate than frontier LLMs' },
  { value: '1M+', label: 'scenarios validated' },
  { value: '24 hours', label: 'to first prediction' },
  { value: '2M+', label: 'individuals represented across proprietary behavioral dataset' },
] as const
