import { useSyncExternalStore } from 'react'

/** Installing Tearsheet as an app (Malik, 2026-11-04: the desktop should feel like an app). Chrome and Edge offer `beforeinstallprompt` once, early, so it
 *  is caught here at import, before React mounts; Safari never fires it (its way is File › Add to Dock) and Firefox cannot install a web app. Once the app
 *  runs in its own window (`display-mode: standalone`) there is nothing to offer. */
type InstallPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> }

let deferred: InstallPrompt | null = null
const listeners = new Set<() => void>()
const changed = () => listeners.forEach(l => l())

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferred = e as InstallPrompt; changed() })
  window.addEventListener('appinstalled', () => { deferred = null; changed() })
}

export type Install = 'prompt' | 'safari' | 'none'

const standalone = () => typeof window !== 'undefined' && (window.matchMedia?.('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true)
const safari = () => typeof navigator !== 'undefined' && /Safari\//.test(navigator.userAgent) && !/Chrome\/|Chromium\/|Edg\//.test(navigator.userAgent)

/** How this browser installs the app: its own prompt, Safari's menu, or not at all (already installed, or a browser that cannot). */
export function installKind(): Install {
  if (standalone()) return 'none'
  if (deferred) return 'prompt'
  return safari() ? 'safari' : 'none'
}

export function useInstall(): { kind: Install; install: () => Promise<void> } {
  const kind = useSyncExternalStore(l => { listeners.add(l); return () => listeners.delete(l) }, installKind, () => 'none' as Install)
  const install = async () => {
    if (!deferred) return
    const p = deferred
    deferred = null; changed()   // a prompt can be shown once
    await p.prompt()
  }
  return { kind, install }
}
