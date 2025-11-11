"use client"

import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { gameAPI } from "@/lib/game-api"
import type { InquisitorProfile } from "@/types/profile"
import { toast } from "@/hooks/use-toast"
import {
  addProfile as addProfileToStore,
  deleteProfileById,
  exportProfiles as exportProfileState,
  importProfiles as importProfileState,
  loadProfiles as loadProfileState,
  setActiveProfile as setActiveProfileInStore,
  updateRunJournal as updateRunJournalInStore,
} from "@/lib/profile-store"

interface GameSetupProps {
  onStartGame: (payload: { apiResponse: any; profile: InquisitorProfile }) => void
  initialStep?: "intro" | "name" | "beast"
  forceProfileChange?: boolean
}

const BEAST_ADJECTIVES = ["Black", "Marsh", "Moon", "Blood", "Wild", "Bone", "Grave", "Spider"]
const BEAST_CREATURES = ["Wolf", "Grim", "Hag", "Goat", "Worm", "Barghest", "Fiend", "Banshee"]
const BEAST_LOCATIONS = [
  "Westminster",
  "Hogesdon",
  "Moorgate",
  "Lambton",
  "Blackfriars",
  "Sockburn",
  "Southwark",
  "Whitechapel",
]

type SetupStep = "intro" | "name" | "beast" | "profiles"

function rollBeastName(): string {
  const adj = BEAST_ADJECTIVES[Math.floor(Math.random() * BEAST_ADJECTIVES.length)]
  const creature = BEAST_CREATURES[Math.floor(Math.random() * BEAST_CREATURES.length)]
  const location = BEAST_LOCATIONS[Math.floor(Math.random() * BEAST_LOCATIONS.length)]
  return `The ${adj} ${creature} of ${location}`
}

export function GameSetup({ onStartGame, initialStep, forceProfileChange = false }: GameSetupProps) {
  const [profiles, setProfiles] = useState<InquisitorProfile[]>([])
  const [activeProfileId, setActiveProfileId] = useState<string | null>(null)
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null)
  const [inspectedProfileId, setInspectedProfileId] = useState<string | null>(null)
  const [profileToDelete, setProfileToDelete] = useState<InquisitorProfile | null>(null)

  const selectedProfile = useMemo(
    () => (selectedProfileId ? profiles.find((profile) => profile.id === selectedProfileId) ?? null : null),
    [profiles, selectedProfileId],
  )
  const inspectedProfile = useMemo(
    () => (inspectedProfileId ? profiles.find((profile) => profile.id === inspectedProfileId) ?? null : null),
    [profiles, inspectedProfileId],
  )

  const [inquisitorName, setInquisitorName] = useState("")
  const [beastName, setBeastName] = useState(rollBeastName())
  const [step, setStep] = useState<SetupStep>(initialStep ?? "intro")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [seedValue, setSeedValue] = useState("")
  const [profileLoading, setProfileLoading] = useState(true)
  const [isChangingProfile, setIsChangingProfile] = useState(forceProfileChange)
  const [journalDrafts, setJournalDrafts] = useState<Record<string, string>>({})
  const [journalSaving, setJournalSaving] = useState<Record<string, boolean>>({})
  const [isExportingProfiles, setIsExportingProfiles] = useState(false)
  const [isImportingProfiles, setIsImportingProfiles] = useState(false)

  const initialisedRef = useRef(false)
  const importInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    initialisedRef.current = false
  }, [initialStep, forceProfileChange])

  useEffect(() => {
    if (profiles.length === 0) {
      setInspectedProfileId(null)
      return
    }

    setInspectedProfileId((prev) => {
      if (prev && profiles.some((profile) => profile.id === prev)) {
        return prev
      }
      return profiles[0].id
    })
  }, [profiles])

  useEffect(() => {
    if (!inspectedProfile) {
      setJournalDrafts({})
      setJournalSaving({})
      return
    }

    const drafts: Record<string, string> = {}
    inspectedProfile.runs?.forEach((run) => {
      drafts[run.id] = run.journal ?? ''
    })
    setJournalDrafts(drafts)
  }, [inspectedProfile])

  useEffect(() => {
    const state = loadProfileState()
    setProfiles(state.profiles)
    setActiveProfileId(state.activeProfileId)
    if (state.activeProfileId) {
      const active = state.profiles.find((profile) => profile.id === state.activeProfileId)
      if (active) {
        setSelectedProfileId(active.id)
        setInquisitorName(active.inquisitor_name)
        setInspectedProfileId((prev) => prev ?? active.id)
      }
    }
    setProfileLoading(false)
  }, [])

  useEffect(() => {
    if (profileLoading || initialisedRef.current) {
      return
    }

    if (step === "profiles") {
      if (profiles.length > 0) {
        setInspectedProfileId((prev) => {
          if (prev && profiles.some((profile) => profile.id === prev)) {
            return prev
          }
          return profiles[0].id
        })
      }
      initialisedRef.current = true
      return
    }

    if (forceProfileChange) {
      setSelectedProfileId(null)
      setInquisitorName("")
      setIsChangingProfile(true)
      setStep("intro")
      initialisedRef.current = true
      return
    }

    if (initialStep === "profiles") {
      setStep("profiles")
      setIsChangingProfile(false)
      initialisedRef.current = true
      return
    }

    const activeProfile =
      (selectedProfileId && profiles.find((profile) => profile.id === selectedProfileId)) ||
      (activeProfileId && profiles.find((profile) => profile.id === activeProfileId)) ||
      profiles[0] ||
      null

    if (initialStep === "beast") {
      if (activeProfile) {
        setSelectedProfileId(activeProfile.id)
        setInquisitorName(activeProfile.inquisitor_name)
        setIsChangingProfile(false)
        setStep("beast")
      } else {
        setIsChangingProfile(true)
        setStep("name")
      }
      initialisedRef.current = true
      return
    }

    if (initialStep === "name") {
      setSelectedProfileId(null)
      setInquisitorName("")
      setIsChangingProfile(true)
      setStep("name")
      initialisedRef.current = true
      return
    }

    if (activeProfile) {
      setSelectedProfileId(activeProfile.id)
      setInquisitorName(activeProfile.inquisitor_name)
      setIsChangingProfile(false)
      setStep("beast")
    } else {
      setStep("intro")
    }

    initialisedRef.current = true
  }, [profileLoading, profiles, activeProfileId, selectedProfileId, initialStep, forceProfileChange, step])

  const handleRollBeast = () => {
    setBeastName(rollBeastName())
    setError(null)
  }

  const handleRandomSeed = () => {
    const randomSeed = Math.floor(Math.random() * 1_000_000_000)
    setSeedValue(String(randomSeed))
    setError(null)
  }

  const handleViewProfiles = () => {
    setIsChangingProfile(false)
    setStep("profiles")
    if (profiles.length > 0) {
      setInspectedProfileId(profiles[0].id)
    }
  }

  const setActiveProfile = (profileId: string) => {
    const { state, profile } = setActiveProfileInStore(profileId)
    setProfiles(state.profiles)
    setActiveProfileId(state.activeProfileId)
    if (profile) {
      setSelectedProfileId(profile.id)
      setInquisitorName(profile.inquisitor_name)
    }
    return profile
  }

  const createProfile = (name: string) => {
    const { state, profile } = addProfileToStore(name)
    setProfiles(state.profiles)
    setActiveProfileId(state.activeProfileId)
    setSelectedProfileId(profile.id)
    setInspectedProfileId(profile.id)
    setInquisitorName(profile.inquisitor_name)
    return profile
  }

  const deleteProfile = (profile: InquisitorProfile) => {
    const { state, removed } = deleteProfileById(profile.id)
    if (!removed) {
      setError("Failed to delete profile")
      return false
    }

    setProfiles(state.profiles)
    setActiveProfileId(state.activeProfileId)
    const activeProfile =
      state.activeProfileId != null
        ? state.profiles.find((item) => item.id === state.activeProfileId) ?? null
        : state.profiles[0] ?? null

    setSelectedProfileId(activeProfile?.id ?? null)
    setInquisitorName(activeProfile?.inquisitor_name ?? "")
    setInspectedProfileId((prev) => {
      if (prev && state.profiles.some((item) => item.id === prev)) {
        return prev
      }
      return activeProfile?.id ?? state.profiles[0]?.id ?? null
    })
    setProfileToDelete(null)
    return true
  }

  const handleExportProfiles = async () => {
    try {
      setIsExportingProfiles(true)
      const exportData = exportProfileState()
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" })
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement("a")
      anchor.href = url
      anchor.download = `eleventh-beast-profiles-${new Date().toISOString().split("T")[0]}.json`
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      URL.revokeObjectURL(url)
      toast({
        title: "Profiles exported",
        description: "Download complete.",
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to export profiles")
    } finally {
      setIsExportingProfiles(false)
    }
  }

  const handleImportProfiles = async (file: File) => {
    try {
      setIsImportingProfiles(true)
      const text = await file.text()
      const parsed = JSON.parse(text)
      const state = importProfileState(parsed)
      if (!state) {
        setError("Failed to import profiles")
        return
      }
      setProfiles(state.profiles)
      setActiveProfileId(state.activeProfileId)

      if (state.profiles.length === 0) {
        setSelectedProfileId(null)
        setInspectedProfileId(null)
        setInquisitorName("")
        toast({
          title: "Import completed",
          description: "No profiles were found in the file.",
        })
        return
      }

      const nextActive =
        state.activeProfileId != null
          ? state.profiles.find((profile) => profile.id === state.activeProfileId) ?? state.profiles[0]
          : state.profiles[0]

      setSelectedProfileId(nextActive?.id ?? null)
      setInspectedProfileId(nextActive?.id ?? null)
      setInquisitorName(nextActive?.inquisitor_name ?? "")
      toast({
        title: "Profiles imported",
        description: `${state.profiles.length} inquisitor${state.profiles.length === 1 ? "" : "s"} restored.`,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to import profiles")
    } finally {
      setIsImportingProfiles(false)
      if (importInputRef.current) {
        importInputRef.current.value = ""
      }
    }
  }

  const handleRunJournalChange = (runId: string, value: string) => {
    setJournalDrafts((prev) => ({ ...prev, [runId]: value }))
  }

  const handleRunJournalSave = async (runId: string) => {
    if (!inspectedProfile) {
      return
    }

    const journal = journalDrafts[runId] ?? ''
    setJournalSaving((prev) => ({ ...prev, [runId]: true }))

    try {
      const { state } = updateRunJournalInStore(inspectedProfile.id, runId, journal)
      setProfiles(state.profiles)
      setActiveProfileId(state.activeProfileId)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save journal entry.")
    } finally {
      setJournalSaving((prev) => ({ ...prev, [runId]: false }))
    }
  }

  const handleImportFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      handleImportProfiles(file)
    }
  }

  const handleChangeProfile = () => {
    setSelectedProfileId(null)
    setInquisitorName("")
    setIsChangingProfile(true)
    setStep("intro")
  }

  const handleSelectProfile = (profile: InquisitorProfile, autoAdvance = true) => {
    setSelectedProfileId(profile.id)
    setInquisitorName(profile.inquisitor_name)
    setIsChangingProfile(false)

    if (profile.id !== activeProfileId) {
      const updated = setActiveProfile(profile.id)
      if (updated) {
        profile = updated
      }
    }

    if (autoAdvance) {
      setStep("beast")
    }
  }

  const handleStart = async () => {
    const trimmedInquisitorName = inquisitorName.trim()
    const trimmedBeastName = beastName.trim()

    if (!trimmedInquisitorName || !trimmedBeastName) {
      setError("Please provide both names")
      return
    }

    setIsLoading(true)
    setError(null)

    let parsedSeed: number | undefined
    if (seedValue.trim()) {
      const seedNumber = Number(seedValue.trim())
      if (!Number.isFinite(seedNumber) || !Number.isInteger(seedNumber)) {
        setError("Seed must be a whole number")
        setIsLoading(false)
        return
      }
      parsedSeed = seedNumber
    }

    let profileToUse = selectedProfile

    try {
      if (!profileToUse || isChangingProfile) {
        profileToUse = createProfile(trimmedInquisitorName)
        if (!profileToUse) {
          return
        }
        setIsChangingProfile(false)
      } else {
        const updated = setActiveProfile(profileToUse.id)
        if (updated) {
          profileToUse = updated
        }
      }

      const response = await gameAPI.createGame({
        beast_name: trimmedBeastName,
        inquisitor_name: trimmedInquisitorName,
        seed: parsedSeed,
      })

      if (response.success && response.game_data && profileToUse) {
        onStartGame({ apiResponse: response, profile: profileToUse })
      } else {
        setError(response.message || "Failed to create game")
      }
    } catch (err) {
      console.error("Failed to create game:", err)
      setError(err instanceof Error ? err.message : "Failed to connect to game server")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl border-amber-900/50 bg-slate-900/50 backdrop-blur">
        <div className="p-8 md:p-12 space-y-8">
          {step === "intro" && (
            <div className="space-y-6">
              <div className="text-center space-y-4">
                <div className="text-5xl md:text-6xl font-bold text-amber-100 tracking-wider">ELEVENTH BEAST</div>
                <div className="text-amber-200/60 text-lg italic">A Solo Monster Hunting Game</div>
              </div>

              <div className="space-y-4 text-amber-100/80 text-center">
                <p className="text-sm leading-relaxed">
                  The year is 1746. You are a Crown Inquisitor of Salomon's House, a secret order of daemon hunters
                  appointed by the King.
                </p>
                <p className="text-sm leading-relaxed">
                  The ELEVENTH BEAST approaches. Investigate rumors. Learn its secrets. Prepare for the hunt.
                </p>
              </div>

              <div className="border-t border-amber-900/30 pt-6 space-y-4">
                {profileLoading ? (
                  <div className="text-center text-sm text-amber-200/60">Loading profiles...</div>
                ) : profiles.length > 0 ? (
                  <>
                    <p className="text-amber-200/70 text-xs uppercase tracking-widest text-center">
                      Choose your inquisitor
                    </p>
                    <div className="grid sm:grid-cols-2 gap-3">
                      {profiles.map((profile) => {
                        const isSelected = selectedProfileId === profile.id
                        return (
                          <div
                            key={profile.id}
                            role="button"
                            tabIndex={0}
                            onClick={() => handleSelectProfile(profile)}
                            onKeyDown={(event) => {
                              if (event.key === "Enter" || event.key === " ") {
                                event.preventDefault()
                                handleSelectProfile(profile)
                              }
                            }}
                            className={`text-left border rounded-md p-3 transition focus:outline-none focus:ring-2 focus:ring-amber-500/60 ${
                              isSelected ? "border-amber-500 bg-amber-900/20" : "border-amber-900/30 bg-transparent"
                            }`}
                          >
                            <p className="text-amber-100 font-semibold">{profile.inquisitor_name}</p>
                            <p className="text-amber-200/50 text-xs mt-1">
                              Games: {profile.stats.games_played} • Wins: {profile.stats.victories} • Losses: {profile.stats.defeats}
                            </p>
                            <p className="text-amber-200/50 text-xs">Win Rate: {profile.stats.win_rate}%</p>
                          </div>
                        )
                      })}
                    </div>
                    <div className="flex flex-col sm:flex-row gap-2">
                      {selectedProfile && !isChangingProfile && (
                        <Button
                          onClick={() => setStep("beast")}
                          className="flex-1 bg-amber-900 hover:bg-amber-800 text-amber-50 font-semibold py-2"
                        >
                          Continue as {selectedProfile.inquisitor_name}
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        onClick={() => {
                          setIsChangingProfile(true)
                          setSelectedProfileId(null)
                          setInquisitorName("")
                          setStep("name")
                        }}
                        className="flex-1 border-amber-900/50 text-amber-100 hover:bg-amber-900/20"
                      >
                        Create New Profile
                      </Button>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={handleViewProfiles}
                      className="w-full text-amber-200 hover:text-amber-100 hover:bg-amber-900/10"
                    >
                      View Profiles
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      onClick={() => {
                        setIsChangingProfile(true)
                        setStep("name")
                      }}
                      className="w-full bg-amber-900 hover:bg-amber-800 text-amber-50 font-semibold py-2"
                    >
                      Begin Investigation
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={handleViewProfiles}
                      className="w-full text-amber-200 hover:text-amber-100 hover:bg-amber-900/10"
                    >
                      View Profiles
                    </Button>
                  </>
                )}
              </div>
            </div>
          )}

          {step === "profiles" && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <h2 className="text-3xl font-bold text-amber-100">Inquisitor Profiles</h2>
                  <p className="text-amber-200/60 text-sm">Review your saved inquisitors and past hunts.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setIsChangingProfile(false)
                      setStep("intro")
                    }}
                    className="border-amber-900/50 text-amber-100 hover:bg-amber-900/20"
                  >
                    Back
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setIsChangingProfile(true)
                      setSelectedProfileId(null)
                      setInquisitorName("")
                      setStep("name")
                    }}
                    className="border-amber-900/50 text-amber-100 hover:bg-amber-900/20"
                  >
                    Create New Profile
                  </Button>
                </div>
              </div>

              {profileLoading ? (
                <Card className="border-amber-900/50 bg-slate-900/40 p-6 text-amber-200/70 text-sm">
                  Loading profiles...
                </Card>
              ) : profiles.length === 0 ? (
                <Card className="border-amber-900/50 bg-slate-900/40 p-6 text-amber-200/70 text-sm space-y-4">
                  <p>No inquisitors recorded yet. Create one to begin your hunts.</p>
                  <Button
                    onClick={() => {
                      setIsChangingProfile(true)
                      setSelectedProfileId(null)
                      setInquisitorName("")
                      setStep("name")
                    }}
                    className="w-full bg-amber-900 hover:bg-amber-800 text-amber-50 font-semibold"
                  >
                    Create First Profile
                  </Button>
                </Card>
              ) : (
                <div className="grid lg:grid-cols-[1.1fr,2fr] gap-6">
                  <Card className="border-amber-900/50 bg-slate-900/40 p-4 space-y-3">
                    <p className="text-xs uppercase tracking-widest text-amber-200/60">Inquisitors</p>
                    <div className="space-y-2">
                      {profiles.map((profileItem) => {
                        const isInspected = inspectedProfileId === profileItem.id
                        const isActive = activeProfileId === profileItem.id
                        return (
                          <div
                            key={profileItem.id}
                            role="button"
                            tabIndex={0}
                            onClick={() => setInspectedProfileId(profileItem.id)}
                            onKeyDown={(event) => {
                              if (event.key === "Enter" || event.key === " ") {
                                event.preventDefault()
                                setInspectedProfileId(profileItem.id)
                              }
                            }}
                            className={`w-full text-left border rounded-md p-3 transition focus:outline-none focus:ring-2 focus:ring-amber-500/60 ${
                              isInspected ? "border-amber-500 bg-amber-900/20" : "border-amber-900/30 bg-transparent"
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <p className="text-amber-100 font-semibold">{profileItem.inquisitor_name}</p>
                                <p className="text-amber-200/50 text-xs">
                                  Games: {profileItem.stats.games_played} • Wins: {profileItem.stats.victories} • Losses: {profileItem.stats.defeats}
                                </p>
                                <p className="text-amber-200/50 text-xs">Win Rate: {profileItem.stats.win_rate}%</p>
                              </div>
                              <div className="flex flex-col items-end gap-1">
                                {isActive && (
                                  <span className="text-xs uppercase tracking-widest text-amber-400">Active</span>
                                )}
                                {!isActive && (
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={(event) => {
                                      event.stopPropagation()
                                      setProfileToDelete(profileItem)
                                    }}
                                    className="text-red-300 hover:text-red-200 hover:bg-red-900/20"
                                  >
                                    Delete
                                  </Button>
                                )}
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </Card>

                  <Card className="border-amber-900/50 bg-slate-900/50 p-6 space-y-4">
                    {inspectedProfile ? (
                      <>
                        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                          <div>
                            <h3 className="text-lg font-bold text-amber-100">{inspectedProfile.inquisitor_name}</h3>
                            <p className="text-amber-200/60 text-xs">Created {new Date(inspectedProfile.created_at).toLocaleString()}</p>
                            <p className="text-amber-200/60 text-xs">Updated {new Date(inspectedProfile.updated_at).toLocaleString()}</p>
                          </div>
                          <div className="grid grid-cols-2 gap-3 text-center">
                            <div className="bg-slate-900/40 border border-amber-900/40 rounded p-3">
                              <p className="text-xs uppercase tracking-widest text-amber-200/60">Games</p>
                              <p className="text-amber-100 font-semibold text-lg">{inspectedProfile.stats.games_played}</p>
                            </div>
                            <div className="bg-slate-900/40 border border-amber-900/40 rounded p-3">
                              <p className="text-xs uppercase tracking-widest text-amber-200/60">Win Rate</p>
                              <p className="text-amber-100 font-semibold text-lg">{inspectedProfile.stats.win_rate}%</p>
                            </div>
                            <div className="bg-slate-900/40 border border-amber-900/40 rounded p-3">
                              <p className="text-xs uppercase tracking-widest text-amber-200/60">Victories</p>
                              <p className="text-amber-100 font-semibold text-lg">{inspectedProfile.stats.victories}</p>
                            </div>
                            <div className="bg-slate-900/40 border border-amber-900/40 rounded p-3">
                              <p className="text-xs uppercase tracking-widest text-amber-200/60">Defeats</p>
                              <p className="text-amber-100 font-semibold text-lg">{inspectedProfile.stats.defeats}</p>
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-2 justify-end">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={handleExportProfiles}
                            disabled={isExportingProfiles}
                            className="border-amber-900/50 text-amber-100 hover:bg-amber-900/20"
                          >
                            {isExportingProfiles ? "Exporting..." : "Export Profiles"}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => importInputRef.current?.click()}
                            disabled={isImportingProfiles}
                            className="border-amber-900/50 text-amber-100 hover:bg-amber-900/20"
                          >
                            {isImportingProfiles ? "Importing..." : "Import Profiles"}
                          </Button>
                        </div>

                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <h4 className="text-sm font-semibold text-amber-100 uppercase tracking-widest">Run History</h4>
                            <span className="text-amber-200/60 text-xs">{inspectedProfile.runs.length} hunt{inspectedProfile.runs.length === 1 ? "" : "s"}</span>
                          </div>

                          {inspectedProfile.runs.length === 0 ? (
                            <p className="text-amber-200/60 text-sm">No hunts recorded yet.</p>
                          ) : (
                            <div className="space-y-3">
                              {inspectedProfile.runs.map((run) => (
                                <div
                                  key={run.id}
                                  className={`border rounded-lg p-4 text-sm ${
                                    run.result === "victory" ? "border-green-900/60 bg-green-950/20" : "border-red-900/60 bg-red-950/20"
                                  }`}
                                >
                                  <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                                    <div>
                                      <p className="text-amber-200/60 text-xs">{new Date(run.timestamp).toLocaleString()}</p>
                                      <p className="text-amber-100 font-semibold text-base">{run.beast_name}</p>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-3 text-amber-200/70 text-xs uppercase tracking-widest">
                                      <span className={`px-2 py-1 rounded ${run.result === "victory" ? "bg-green-900/60 text-green-100" : "bg-red-900/60 text-red-100"}`}>
                                        {run.result === "victory" ? "Victory" : "Defeat"}
                                      </span>
                                      <span>Days {run.days_elapsed}</span>
                                      <span>Rounds {run.rounds}</span>
                                      {typeof run.seed === "number" && <span>Seed {run.seed}</span>}
                                    </div>
                                  </div>

                                  <div className="grid md:grid-cols-3 gap-3 text-xs text-amber-200/70 mt-3">
                                    <div className="bg-slate-900/40 border border-amber-900/40 rounded p-2 text-center">
                                      <p className="text-[10px] uppercase tracking-widest">Rumors</p>
                                      <p className="text-amber-100 font-semibold text-base">{run.rumors_total}</p>
                                    </div>
                                    <div className="bg-slate-900/40 border border-amber-900/40 rounded p-2 text-center">
                                      <p className="text-[10px] uppercase tracking-widest">Verified</p>
                                      <p className="text-amber-100 font-semibold text-base">{run.rumors_verified}</p>
                                    </div>
                                    <div className="bg-slate-900/40 border border-amber-900/40 rounded p-2 text-center">
                                      <p className="text-[10px] uppercase tracking-widest">False</p>
                                      <p className="text-amber-100 font-semibold text-base">{run.rumors_false}</p>
                                    </div>
                                  </div>

                                  <div className="mt-3 grid md:grid-cols-2 gap-3">
                                    <div>
                                      <p className="text-[10px] uppercase tracking-widest text-amber-200/50 mb-1">Verified Rumors</p>
                                      {run.verified_rumors.length === 0 ? (
                                        <p className="text-amber-200/60 text-xs">No verified rumors recorded.</p>
                                      ) : (
                                        <ul className="space-y-2 text-amber-100 text-xs">
                                          {run.verified_rumors.map((secret) => (
                                            <li key={secret.id} className="border border-amber-900/40 rounded p-2 bg-slate-900/40">
                                              <p className="text-[10px] uppercase tracking-widest text-amber-200/50 mb-1">
                                                {secret.category ? secret.category.toUpperCase() : "Unknown"}
                                              </p>
                                              <p className="leading-snug">{secret.text}</p>
                                            </li>
                                          ))}
                                        </ul>
                                      )}
                                    </div>
                                    <div>
                                      <p className="text-[10px] uppercase tracking-widest text-amber-200/50 mb-1">False Rumors</p>
                                      {run.false_rumors.length === 0 ? (
                                        <p className="text-amber-200/60 text-xs">No false rumors recorded.</p>
                                      ) : (
                                        <ul className="space-y-2 text-amber-100 text-xs">
                                          {run.false_rumors.map((rumor) => (
                                            <li key={rumor.id} className="border border-red-900/40 rounded p-2 bg-red-950/20">
                                              <p className="leading-snug">{rumor.note}</p>
                                            </li>
                                          ))}
                                        </ul>
                                      )}
                                    </div>
                                  </div>

                                  <div className="mt-3 space-y-2">
                                    <p className="text-[10px] uppercase tracking-widest text-amber-200/50">Journal Entry</p>
                                    <Textarea
                                      value={journalDrafts[run.id] ?? ''}
                                      onChange={(event) => handleRunJournalChange(run.id, event.target.value)}
                                      placeholder="Record your notes, omens, and reflections from this hunt..."
                                      rows={4}
                                    />
                                    <div className="flex justify-end">
                                      <Button
                                        size="sm"
                                        onClick={() => handleRunJournalSave(run.id)}
                                        disabled={journalSaving[run.id] || (journalDrafts[run.id] ?? '') === (run.journal ?? '')}
                                        className="bg-amber-900 hover:bg-amber-800 text-amber-50"
                                      >
                                        {journalSaving[run.id] ? "Saving..." : "Save Journal"}
                                      </Button>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <Button
                            onClick={() => handleSelectProfile(inspectedProfile)}
                            className="bg-amber-900 hover:bg-amber-800 text-amber-50 font-semibold"
                          >
                            Hunt as {inspectedProfile.inquisitor_name}
                          </Button>
                          <Button
                            variant="destructive"
                            onClick={() => setProfileToDelete(inspectedProfile)}
                            className="bg-red-900 hover:bg-red-800 text-red-50"
                          >
                            {activeProfileId === inspectedProfile.id ? "Delete (Active)" : "Delete Profile"}
                          </Button>
                        </div>
                      </>
                    ) : (
                      <p className="text-amber-200/60 text-sm">Select a profile to inspect its history.</p>
                    )}
                  </Card>
                </div>
              )}
            </div>
          )}

          {profileToDelete && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-6">
              <div className="max-w-md w-full space-y-4 rounded-lg border border-red-900/40 bg-slate-950/90 p-6 shadow-lg">
                <h3 className="text-xl font-bold text-red-200">Delete Inquisitor?</h3>
                <p className="text-red-100/70 text-sm">
                  This will permanently remove <span className="font-semibold text-red-100">{profileToDelete.inquisitor_name}</span> and all recorded hunts.
                  {activeProfileId === profileToDelete.id && " It is currently active and will be unset."}
                  This action cannot be undone.
                </p>
                <div className="space-y-2 text-xs text-red-200/60">
                  <p>• Games played: {profileToDelete.stats.games_played}</p>
                  <p>• Victories: {profileToDelete.stats.victories}</p>
                  <p>• Defeats: {profileToDelete.stats.defeats}</p>
                </div>
                {profiles.length <= 1 && (
                  <div className="rounded border border-red-900/50 bg-red-950/30 p-3 text-xs text-red-200/80">
                    Warning: this is your last profile. You will need to create a new inquisitor to play again.
                  </div>
                )}
                <div className="flex flex-wrap gap-2 justify-end">
                  <Button
                    variant="outline"
                    onClick={() => setProfileToDelete(null)}
                    className="border-amber-900/50 text-amber-100 hover:bg-amber-900/20"
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="destructive"
                    disabled={isLoading}
                    onClick={() => {
                      if (profileToDelete) {
                        setIsLoading(true)
                        deleteProfile(profileToDelete)
                        setIsLoading(false)
                      }
                    }}
                    className="bg-red-900 hover:bg-red-800 text-red-50"
                  >
                    Delete Profile
                  </Button>
                </div>
              </div>
            </div>
          )}

          {step === "name" && (
            <div className="space-y-6">
              <div className="text-center">
                <h2 className="text-3xl font-bold text-amber-100 mb-2">Your Name</h2>
                <p className="text-amber-200/60 text-sm">Record yourself as an Inquisitor</p>
              </div>

              <div className="space-y-2">
                <label className="block text-amber-200 text-sm font-medium">Inquisitor Name</label>
                <Input
                  type="text"
                  placeholder="Enter your name..."
                  value={inquisitorName}
                  onChange={(e) => setInquisitorName(e.target.value)}
                  className="bg-slate-800/50 border-amber-900/50 text-amber-50 placeholder:text-amber-900/50"
                />
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={() => {
                    setStep("intro")
                    setIsChangingProfile(false)
                    if (selectedProfile) {
                      setInquisitorName(selectedProfile.inquisitor_name)
                    }
                  }}
                  variant="outline"
                  className="flex-1 border-amber-900/50 text-amber-100 hover:bg-amber-900/20"
                >
                  Back
                </Button>
                <Button
                  onClick={() => setStep("beast")}
                  disabled={!inquisitorName.trim()}
                  className="flex-1 bg-amber-900 hover:bg-amber-800 text-amber-50 font-semibold"
                >
                  Continue
                </Button>
              </div>
            </div>
          )}

          {step === "beast" && (
            <div className="space-y-6">
              {selectedProfile && !isChangingProfile && (
                <div className="flex items-center justify-between bg-slate-800/40 border border-amber-900/40 rounded-lg p-4">
                  <div className="text-left">
                    <p className="text-xs uppercase tracking-widest text-amber-200/60">Inquisitor</p>
                    <p className="text-amber-100 font-semibold text-sm">{selectedProfile.inquisitor_name}</p>
                    <p className="text-amber-200/50 text-xs mt-1">
                      Games: {selectedProfile.stats.games_played} • Wins: {selectedProfile.stats.victories} • Losses: {selectedProfile.stats.defeats} • Win Rate: {selectedProfile.stats.win_rate}%
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleChangeProfile}
                    className="border-amber-900/50 text-amber-100 hover:bg-amber-900/20"
                    disabled={isLoading}
                  >
                    Change Profile
                  </Button>
                </div>
              )}

              <div className="text-center">
                <h2 className="text-3xl font-bold text-amber-100 mb-2">The Beast Emerges</h2>
                <p className="text-amber-200/60 text-sm">Discover what threatens London</p>
              </div>

              <div className="space-y-4">
                <div className="bg-slate-800/30 border border-amber-900/50 rounded-lg p-6 text-center">
                  <p className="text-amber-200/60 text-sm uppercase tracking-widest mb-2">The Beast is</p>
                  <p className="text-3xl font-bold text-amber-100 mb-4">{beastName}</p>
                  <button
                    onClick={handleRollBeast}
                    className="text-amber-600 hover:text-amber-500 text-xs uppercase tracking-widest"
                  >
                    Re-roll
                  </button>
                </div>

                <div className="bg-slate-800/30 border border-amber-900/50 rounded-lg p-6 space-y-4">
                  <div>
                    <label className="block text-amber-200 text-sm font-medium mb-2">Seed (Optional)</label>
                    <Input
                      type="number"
                      placeholder="Enter a numeric seed or leave blank"
                      value={seedValue}
                      onChange={(e) => setSeedValue(e.target.value)}
                      className="bg-slate-800/50 border-amber-900/50 text-amber-50 placeholder:text-amber-900/50"
                    />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleRandomSeed}
                      className="border-amber-900/50 text-amber-100 hover:bg-amber-900/20"
                    >
                      Randomize Seed
                    </Button>
                    {seedValue && (
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => setSeedValue("")}
                        className="text-amber-400 hover:text-amber-300 hover:bg-amber-900/10"
                      >
                        Clear Seed
                      </Button>
                    )}
                  </div>
                </div>

                {error && (
                  <div className="bg-red-950/30 border border-red-900/50 rounded p-3">
                    <p className="text-red-200 text-sm">{error}</p>
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                {selectedProfile && !isChangingProfile ? (
                  <Button
                    onClick={handleChangeProfile}
                    variant="outline"
                    className="flex-1 border-amber-900/50 text-amber-100 hover:bg-amber-900/20"
                    disabled={isLoading}
                  >
                    Change Profile
                  </Button>
                ) : (
                  <Button
                    onClick={() => setStep("name")}
                    variant="outline"
                    className="flex-1 border-amber-900/50 text-amber-100 hover:bg-amber-900/20"
                    disabled={isLoading}
                  >
                    Back
                  </Button>
                )}
                <Button
                  onClick={handleStart}
                  disabled={!beastName.trim() || isLoading}
                  className="flex-1 bg-amber-900 hover:bg-amber-800 text-amber-50 font-semibold"
                >
                  {isLoading ? "Creating Game..." : "Hunt the Beast"}
                </Button>
              </div>
            </div>
          )}
        </div>
      </Card>

      <input
        ref={importInputRef}
        type="file"
        accept="application/json"
        className="hidden"
        onChange={handleImportFileChange}
      />
    </div>
  )
}

