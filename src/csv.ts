const csvField = (value: string | number) => {
  const text = String(value)
  const safe = typeof value === 'string' && /^[\s\uFEFF]*[=+\-@]/.test(text) ? "'" + text : text
  return '"' + safe.replaceAll('"', '""') + '"'
}
export const toCsv = (rows: (string | number)[][]) => '\uFEFF' + rows.map((row) => row.map(csvField).join(',')).join('\r\n') + '\r\n'

export function parseCsv(text: string) {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false
  let closed = false
  const pushField = () => { row.push(field.trim()); field = ''; closed = false }
  const pushRow = () => { pushField(); if (row.some(Boolean)) rows.push(row); row = [] }
  const input = text.replace(/^\uFEFF/, '')
  for (let i = 0; i < input.length; i++) {
    const char = input[i]
    if (quoted) {
      if (char === '"' && input[i + 1] === '"') { field += '"'; i++ }
      else if (char === '"') { quoted = false; closed = true }
      else field += char
    } else if (char === ',') pushField()
    else if (char === '\r' || char === '\n') {
      pushRow()
      if (char === '\r' && input[i + 1] === '\n') i++
    } else if (char === '"' && !field && !closed) quoted = true
    else if (closed || char === '"') throw new Error('Unexpected text after a CSV quote.')
    else field += char
  }
  if (quoted) throw new Error('An open quote is missing its closing quote.')
  if (field || row.length || closed) pushRow()
  return rows
}
