import { type Workspace } from './domain'
import { makeWorkspace } from './seed'

// The CSV roster uses its own namespace so prior demo records keep their original identities.
export const WORKSPACE_KEY = 'skillrelay.workspace.csv.v1'
export function readWorkspace(): Workspace {
  try {
    const raw = localStorage.getItem(WORKSPACE_KEY)
    if (raw) {
      const state: Workspace = JSON.parse(raw)
      if (Array.isArray(state.assignments) && Array.isArray(state.blocks) && Number.isFinite(state.now) && state.policy?.timezone === 'Asia/Seoul') return state
    }
  } catch {
    // A fresh fixture remains usable after a corrupt or unavailable persisted snapshot.
  }
  return makeWorkspace()
}

export async function transact<T>(apply: (latest: Workspace) => { state: Workspace; result: T }) {
  const save = () => {
    const latest = readWorkspace()
    const { state, result } = apply(latest)
    if (state !== latest) localStorage.setItem(WORKSPACE_KEY, JSON.stringify(state))
    return { state, result }
  }
  return navigator.locks ? navigator.locks.request(WORKSPACE_KEY, save) : save()
}

export function getPref(key: string, fallback: string) {
  try { return localStorage.getItem('skillrelay.' + key) || fallback } catch { return fallback }
}
export function setPref(key: string, value: string) {
  try { localStorage.setItem('skillrelay.' + key, value) } catch { /* Preferences are optional. */ }
}
