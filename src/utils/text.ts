const HTML_ENTITIES: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&nbsp;': ' ',
  '&#x200B;': '',
}

export function decodeHtmlEntities(text: string): string {
  let result = text
  for (const [entity, char] of Object.entries(HTML_ENTITIES)) {
    result = result.replaceAll(entity, char)
  }
  return result
}

export function stripHtml(text: string): string {
  return text
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

export function cleanText(text: string): string {
  return decodeHtmlEntities(stripHtml(text))
    .replace(/\[deleted\]/gi, '')
    .replace(/\[removed\]/gi, '')
    .replace(/https?:\/\/\S+/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

export function truncateText(text: string, maxLength: number = 8000): string {
  if (text.length <= maxLength) return text
  return text.slice(0, maxLength) + '...'
}

export function prepareForEmbedding(
  title: string,
  body: string,
  comments: string[] = []
): string {
  const parts: string[] = []

  if (title) {
    parts.push(`Title: ${cleanText(title)}`)
  }

  if (body) {
    const cleanBody = cleanText(body)
    if (cleanBody) {
      parts.push(`Content: ${cleanBody}`)
    }
  }

  if (comments.length > 0) {
    const topComments = comments
      .slice(0, 5)
      .map(c => cleanText(c))
      .filter(c => c.length > 10)
    if (topComments.length > 0) {
      parts.push(`Discussion: ${topComments.join(' | ')}`)
    }
  }

  return truncateText(parts.join('\n\n'))
}
