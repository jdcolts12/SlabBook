export type InsightSection = {
  title: string
  body: string
}

/**
 * Splits Claude markdown (## headers) into sections for the insights panel.
 */
export function parseInsightSections (content: string): InsightSection[] {
  const trimmed = content.trim()
  if (!trimmed) return []

  if (!trimmed.includes('##')) {
    return [{ title: 'Insights', body: trimmed }]
  }

  const blocks = trimmed.split(/^##\s+/m).filter((b) => b.length > 0)
  const sections: InsightSection[] = []

  for (const block of blocks) {
    const nl = block.indexOf('\n')
    if (nl === -1) {
      sections.push({ title: block.trim(), body: '' })
    } else {
      const title = block.slice(0, nl).trim()
      const body = block.slice(nl + 1).trim()
      sections.push({ title, body })
    }
  }

  return sections
}
