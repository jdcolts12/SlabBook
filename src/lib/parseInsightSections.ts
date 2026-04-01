export type InsightSection = {
  title: string
  body: string
}

export type InsightContentFlags = {
  usedWebSearch: boolean
  qualityVerify: boolean
}

/**
 * Removes HTML machine tags appended by the insights API and returns clean markdown for display.
 */
export function stripInsightMachineMetadata (raw: string): { displayContent: string; flags: InsightContentFlags } {
  const flags: InsightContentFlags = { usedWebSearch: false, qualityVerify: false }
  let body = raw
  if (body.includes('<!--slabbook:flags:websearch-->')) {
    flags.usedWebSearch = true
    body = body.replace(/\n*<!--slabbook:flags:websearch-->\n*/g, '\n')
  }
  if (body.includes('<!--slabbook:flags:verify-->')) {
    flags.qualityVerify = true
    body = body.replace(/\n*<!--slabbook:flags:verify-->\n*/g, '\n')
  }
  return { displayContent: body.trim(), flags }
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
