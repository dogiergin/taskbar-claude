// Which language to draw the band in: the one the person writes to Claude in.

export type Lang = 'tr' | 'en'

const TURKISH_LETTERS = /[ğüşıöçĞÜŞİÖÇ]/g
const TURKISH_WORDS = new Set([
  've', 'bir', 'bu', 'şu', 'için', 'ile', 'da', 'de', 'mi', 'mı', 'mu', 'mü', 'ne', 'nasıl', 'neden', 'gibi',
  'daha', 'çok', 'ama', 'yap', 'yapalım', 'ekle', 'olsun', 'şimdi', 'sonra', 'bunu', 'şunu', 'değil', 'var', 'yok',
  'evet', 'hayır', 'tamam', 'lütfen', 'kaldır', 'düzelt', 'yani', 'ben', 'sen', 'biz', 'onu', 'burada', 'orada',
])
const ENGLISH_WORDS = new Set([
  'the', 'and', 'is', 'are', 'you', 'please', 'can', 'what', 'how', 'why', 'with', 'this', 'that', 'it', 'to',
  'of', 'in', 'for', 'add', 'make', 'fix', 'remove', 'should', 'would', 'could', 'not', 'yes', 'no', 'now', 'then',
  'i', 'we', 'my', 'do', 'does', 'have', 'there', 'here', 'want', 'use', 'like',
])

/**
 * The language a prompt is written in, or null when it is too short or too
 * mixed to tell (a code paste, a command, a file path).
 */
export function detectLang(text: string): Lang | null {
  const words = text.toLocaleLowerCase('tr-TR').match(/[a-zğüşıöçâîû']+/g) ?? []
  let tr = (text.match(TURKISH_LETTERS) ?? []).length
  let en = 0
  for (const w of words) {
    if (TURKISH_WORDS.has(w)) tr += 2
    if (ENGLISH_WORDS.has(w.replace(/ı/g, 'i'))) en += 2
  }
  if (tr + en < 3) return null
  if (tr >= en * 1.5) return 'tr'
  if (en >= tr * 1.5) return 'en'
  return null
}

/** A language from Claude Code's own `language` setting, when it names one. */
export function langFromSetting(value: unknown): Lang | null {
  if (typeof value !== 'string') return null
  const v = value.toLowerCase()
  if (/^(tr|tur|türk|turk)/.test(v)) return 'tr'
  if (/^(en|eng|ing)/.test(v)) return 'en'
  return null
}
