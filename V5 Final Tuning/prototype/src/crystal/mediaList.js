// Only the unused photo-material path reads this. Glass.jsx imports it
// unconditionally, so the helper stays next to the crystal.
export function parseMediaList(value) {
  if (!value) return []
  try {
    const parsed = JSON.parse(value)
    if (!Array.isArray(parsed)) return []
    return parsed.map((item) => (typeof item === 'string' ? { url: item, kind: 'image' } : item))
  } catch {
    return []
  }
}
