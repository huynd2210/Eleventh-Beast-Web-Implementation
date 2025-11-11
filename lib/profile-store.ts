import type { InquisitorProfile, RunRecord } from "@/types/profile"

export interface ProfileStoreState {
  activeProfileId: string | null
  profiles: InquisitorProfile[]
}

const STORAGE_KEY = "eleventh-beast-profiles"
const MAX_RUN_HISTORY = 50

const clone = <T>(value: T): T => {
  if (typeof globalThis === "object" && typeof globalThis.structuredClone === "function") {
    return globalThis.structuredClone(value)
  }
  return JSON.parse(JSON.stringify(value)) as T
}

const defaultState: ProfileStoreState = {
  activeProfileId: null,
  profiles: [],
}

let memoryState: ProfileStoreState = clone(defaultState)

function getStorage(): Storage | null {
  if (typeof window === "undefined") {
    return null
  }
  try {
    return window.localStorage
  } catch {
    return null
  }
}

function cloneProfile(profile: InquisitorProfile): InquisitorProfile {
  return {
    ...profile,
    stats: { ...profile.stats },
    runs: profile.runs.map((run) => ({
      ...run,
      verified_rumors: run.verified_rumors.map((vr) => ({ ...vr })),
      false_rumors: run.false_rumors.map((fr) => ({ ...fr })),
    })),
  }
}

export function normalizeRun(raw: any, fallbackResult: "victory" | "defeat"): RunRecord {
  return {
    id: typeof raw?.id === "string" ? raw.id : Date.now().toString(36),
    timestamp: typeof raw?.timestamp === "string" ? raw.timestamp : new Date().toISOString(),
    result: raw?.result === "defeat" ? "defeat" : fallbackResult,
    beast_name: typeof raw?.beast_name === "string" ? raw.beast_name : "Unknown Beast",
    seed: typeof raw?.seed === "number" ? raw.seed : undefined,
    rounds: Number.isFinite(raw?.rounds) ? Number(raw.rounds) : 0,
    days_elapsed: Number.isFinite(raw?.days_elapsed) ? Number(raw.days_elapsed) : 0,
    rumors_total: Number.isFinite(raw?.rumors_total) ? Number(raw.rumors_total) : 0,
    rumors_false: Number.isFinite(raw?.rumors_false) ? Number(raw.rumors_false) : 0,
    rumors_verified: Number.isFinite(raw?.rumors_verified) ? Number(raw.rumors_verified) : 0,
    verified_rumors: Array.isArray(raw?.verified_rumors)
      ? raw.verified_rumors.map((vr: any) => ({
          id: typeof vr?.id === "string" ? vr.id : Date.now().toString(36),
          category: vr?.category === "ward" || vr?.category === "weapon" ? vr.category : undefined,
          text: typeof vr?.text === "string" ? vr.text : "",
        }))
      : [],
    false_rumors: Array.isArray(raw?.false_rumors)
      ? raw.false_rumors.map((fr: any) => ({
          id: typeof fr?.id === "string" ? fr.id : Date.now().toString(36),
          note: typeof fr?.note === "string" ? fr.note : "",
        }))
      : [],
    journal: typeof raw?.journal === "string" ? raw.journal : "",
  }
}

export function normalizeProfile(raw: any): InquisitorProfile {
  const stats = raw?.stats ?? {}
  return {
    id: typeof raw?.id === "string" ? raw.id : Date.now().toString(36),
    inquisitor_name: typeof raw?.inquisitor_name === "string" ? raw.inquisitor_name : "Unknown Inquisitor",
    created_at: typeof raw?.created_at === "string" ? raw.created_at : new Date().toISOString(),
    updated_at: typeof raw?.updated_at === "string" ? raw.updated_at : new Date().toISOString(),
    stats: {
      games_played: Number.isFinite(stats.games_played) ? Number(stats.games_played) : 0,
      victories: Number.isFinite(stats.victories) ? Number(stats.victories) : 0,
      defeats: Number.isFinite(stats.defeats) ? Number(stats.defeats) : 0,
      win_rate: Number.isFinite(stats.win_rate) ? Number(stats.win_rate) : 0,
    },
    runs: Array.isArray(raw?.runs)
      ? raw.runs.map((run: any) => normalizeRun(run, run?.result === "defeat" ? "defeat" : "victory"))
      : [],
  }
}

export function sanitizeProfileData(raw: any): ProfileStoreState | null {
  if (!raw || typeof raw !== "object") {
    return null
  }

  const normalizedProfiles = Array.isArray(raw.profiles) ? raw.profiles.map((profile: any) => normalizeProfile(profile)) : null
  if (!normalizedProfiles) {
    return null
  }

  let activeProfileId: string | null = null
  if (typeof raw.activeProfileId === "string" && normalizedProfiles.some((profile) => profile.id === raw.activeProfileId)) {
    activeProfileId = raw.activeProfileId
  } else if (normalizedProfiles.length > 0) {
    activeProfileId = normalizedProfiles[0].id
  }

  return {
    activeProfileId,
    profiles: normalizedProfiles,
  }
}

function persistState(state: ProfileStoreState): ProfileStoreState {
  const storage = getStorage()
  const sanitized = sanitizeProfileData(state) ?? clone(defaultState)
  memoryState = clone(sanitized)
  if (storage) {
    storage.setItem(STORAGE_KEY, JSON.stringify(sanitized))
  }
  return sanitized
}

export function loadProfiles(): ProfileStoreState {
  const storage = getStorage()
  if (!storage) {
    return clone(memoryState)
  }

  const raw = storage.getItem(STORAGE_KEY)
  if (!raw) {
    memoryState = clone(defaultState)
    return clone(defaultState)
  }

  try {
    const parsed = JSON.parse(raw)
    const sanitized = sanitizeProfileData(parsed) ?? clone(defaultState)
    memoryState = clone(sanitized)
    return sanitized
  } catch {
    memoryState = clone(defaultState)
    return clone(defaultState)
  }
}

export function createProfileRecord(inquisitorName: string): InquisitorProfile {
  const timestampId = Date.now().toString(36)
  const now = new Date().toISOString()
  return {
    id: timestampId,
    inquisitor_name: inquisitorName,
    created_at: now,
    updated_at: now,
    stats: {
      games_played: 0,
      victories: 0,
      defeats: 0,
      win_rate: 0,
    },
    runs: [],
  }
}

export function updateWinRate(profile: InquisitorProfile) {
  const { victories, games_played } = profile.stats
  profile.stats.win_rate = games_played > 0 ? Math.round((victories / games_played) * 100) : 0
}

export function addProfile(inquisitorName: string): { state: ProfileStoreState; profile: InquisitorProfile } {
  const current = loadProfiles()
  const profile = createProfileRecord(inquisitorName)
  const nextState: ProfileStoreState = {
    activeProfileId: profile.id,
    profiles: [profile, ...current.profiles],
  }
  const persisted = persistState(nextState)
  return { state: persisted, profile: clone(profile) }
}

export function setActiveProfile(profileId: string): { state: ProfileStoreState; profile: InquisitorProfile | null } {
  const current = loadProfiles()
  if (!current.profiles.some((profile) => profile.id === profileId)) {
    return { state: current, profile: null }
  }
  const nextState: ProfileStoreState = {
    activeProfileId: profileId,
    profiles: current.profiles.map((profile) =>
      profile.id === profileId ? { ...profile, updated_at: new Date().toISOString() } : profile,
    ),
  }
  const persisted = persistState(nextState)
  return { state: persisted, profile: getActiveProfile(persisted) }
}

export function deleteProfileById(profileId: string): { state: ProfileStoreState; removed: boolean } {
  const current = loadProfiles()
  const remaining = current.profiles.filter((profile) => profile.id !== profileId)
  if (remaining.length === current.profiles.length) {
    return { state: current, removed: false }
  }

  const nextActive =
    current.activeProfileId === profileId ? remaining[0]?.id ?? null : current.activeProfileId

  const nextState: ProfileStoreState = {
    activeProfileId: nextActive,
    profiles: remaining,
  }

  const persisted = persistState(nextState)
  return { state: persisted, removed: true }
}

export function updateRunJournal(
  profileId: string,
  runId: string,
  journal: string,
): { state: ProfileStoreState; profile: InquisitorProfile | null } {
  const current = loadProfiles()
  const profiles = current.profiles.map((profile) => {
    if (profile.id !== profileId) {
      return profile
    }
    const updatedRuns = profile.runs.map((run) =>
      run.id === runId ? { ...run, journal } : run,
    )
    return {
      ...profile,
      runs: updatedRuns,
      updated_at: new Date().toISOString(),
    }
  })

  const nextState: ProfileStoreState = {
    activeProfileId: current.activeProfileId,
    profiles,
  }

  const persisted = persistState(nextState)
  return { state: persisted, profile: getActiveProfile(persisted) }
}

export function recordRunResult(
  profileId: string,
  result: "victory" | "defeat",
  run: RunRecord,
): { state: ProfileStoreState; profile: InquisitorProfile | null } {
  const current = loadProfiles()
  const profiles = current.profiles.map((profile) => {
    if (profile.id !== profileId) {
      return profile
    }
    const stats = { ...profile.stats }
    stats.games_played += 1
    if (result === "victory") {
      stats.victories += 1
    } else {
      stats.defeats += 1
    }
    const updatedProfile: InquisitorProfile = {
      ...profile,
      stats,
      runs: [run, ...profile.runs].slice(0, MAX_RUN_HISTORY),
      updated_at: new Date().toISOString(),
    }
    updateWinRate(updatedProfile)
    return updatedProfile
  })

  const nextState: ProfileStoreState = {
    activeProfileId: current.activeProfileId,
    profiles,
  }

  const persisted = persistState(nextState)
  return { state: persisted, profile: getActiveProfile(persisted) }
}

export function exportProfiles(): ProfileStoreState {
  return clone(loadProfiles())
}

export function importProfiles(raw: any): ProfileStoreState | null {
  const sanitized = sanitizeProfileData(raw)
  if (!sanitized) {
    return null
  }
  return persistState(sanitized)
}

export function getActiveProfile(state: ProfileStoreState): InquisitorProfile | null {
  if (!state.activeProfileId) {
    return null
  }
  const profile = state.profiles.find((item) => item.id === state.activeProfileId)
  return profile ? cloneProfile(profile) : null
}

