// Repara archivos con UTF-8 leído como Windows-1252 y reescrito como UTF-8.
// Reversa: cada carácter cp1252 → su byte original → decodificar como UTF-8.
import { readFileSync, writeFileSync } from 'node:fs'

// Caracteres especiales de cp1252 en 0x80–0x9F (el resto coincide con latin1)
const table = {
  0x80: 0x20AC, 0x82: 0x201A, 0x83: 0x0192, 0x84: 0x201E, 0x85: 0x2026,
  0x86: 0x2020, 0x87: 0x2021, 0x88: 0x02C6, 0x89: 0x2030, 0x8A: 0x0160,
  0x8B: 0x2039, 0x8C: 0x0152, 0x8E: 0x017D, 0x91: 0x2018, 0x92: 0x2019,
  0x93: 0x201C, 0x94: 0x201D, 0x95: 0x2022, 0x96: 0x2013, 0x97: 0x2014,
  0x98: 0x02DC, 0x99: 0x2122, 0x9A: 0x0161, 0x9B: 0x203A, 0x9C: 0x0153,
  0x9E: 0x017E, 0x9F: 0x0178,
}
const reverse = new Map()
for (const [byte, code] of Object.entries(table)) reverse.set(Number(code), Number(byte))

function cp1252Encode(str) {
  const out = Buffer.alloc(str.length)
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i)
    if (c <= 0xFF) out[i] = c
    else if (reverse.has(c)) out[i] = reverse.get(c)
    else return null // carácter que no vino de cp1252 → no es mojibake puro
  }
  return out
}

// Repara línea por línea: solo las líneas con marcas de mojibake se reversan;
// las líneas ya correctas (UTF-8 real) se dejan intactas.
for (const p of process.argv.slice(2)) {
  const s = readFileSync(p, 'utf8')
  if (!/[ÃÂâ]/.test(s)) { console.log(p, '-> sin mojibake, intacto'); continue }
  let fixedCount = 0
  let failed = 0
  const lines = s.split('\n').map((line) => {
    if (!/[ÃÂâ]/.test(line)) return line
    const bytes = cp1252Encode(line)
    if (!bytes) { failed++; return line }
    const fixed = bytes.toString('utf8')
    if (fixed.includes('�')) { failed++; return line }
    fixedCount++
    return fixed
  })
  writeFileSync(p, lines.join('\n'), 'utf8')
  console.log(p, `-> ${fixedCount} líneas reparadas, ${failed} no reversibles`)
}
