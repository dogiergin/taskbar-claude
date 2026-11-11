// Telling people who installed the mod that a newer version is out. Plugins
// from a third-party marketplace do not update on their own by default, so
// without this nobody would know.

/** This build's version: keep it equal to `.claude-plugin/plugin.json`. */
export const VERSION = '1.0.8'

/** Where the newest published manifest lives. */
export const LATEST_URL = 'https://raw.githubusercontent.com/dogiergin/taskbar-claude/main/.claude-plugin/plugin.json'

/** How often the same news is told again while it is not acted on. */
export const REMIND_MS = 24 * 60 * 60 * 1000

/** The version a manifest's text names, or null when it names none. */
export function versionIn(manifest: string): string | null {
  try {
    const v = (JSON.parse(manifest) as { version?: unknown }).version
    return typeof v === 'string' && /^\d+(\.\d+)*$/.test(v) ? v : null
  } catch {
    return null
  }
}

/** Whether version `a` is newer than `b`, part by part (1.0.10 > 1.0.9). */
export function isNewer(a: string, b: string): boolean {
  const pa = a.split('.').map(Number)
  const pb = b.split('.').map(Number)
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const x = pa[i] ?? 0
    const y = pb[i] ?? 0
    if (x !== y) return x > y
  }
  return false
}

/** Whether to tell about `latest` now: new news, or a day since it was told. */
export function shouldTell(latest: string, told: { version: string; at: number } | null, now: number): boolean {
  if (!isNewer(latest, VERSION)) return false
  return told === null || told.version !== latest || now - told.at >= REMIND_MS
}

/** The toast, in the band's language. */
export function updateNotice(latest: string, lang: 'tr' | 'en'): string {
  return lang === 'tr'
    ? `⚔ Task Bar Claude ${latest} çıktı (sende ${VERSION}). Güncellemek için: /plugin → Installed → taskbar-claude → Update now`
    : `⚔ Task Bar Claude ${latest} is out (you have ${VERSION}). To update: /plugin → Installed → taskbar-claude → Update now`
}
