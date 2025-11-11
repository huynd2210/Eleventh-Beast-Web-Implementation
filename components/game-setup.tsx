"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import { gameAPI } from "@/lib/game-api"
import { InquisitorProfile } from "@/types/profile"

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

type SetupStep = "intro" | "name" | "beast"

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

  const selectedProfile = useMemo(
    () => (selectedProfileId ? profiles.find((profile) => profile.id === selectedProfileId) ?? null : null),
    [profiles, selectedProfileId],
  )

  const [inquisitorName, setInquisitorName] = useState("")
  const [beastName, setBeastName] = useState(rollBeastName())
  const [step, setStep] = useState<SetupStep>(initialStep ?? "intro")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [seedValue, setSeedValue] = useState("")
  const [profileLoading, setProfileLoading] = useState(true)
  const [isChangingProfile, setIsChangingProfile] = useState(forceProfileChange)

  const initialisedRef = useRef(false)

  useEffect(() => {
    initialisedRef.current = false
  }, [initialStep, forceProfileChange])

  const updateProfilesState = (data: { profiles?: InquisitorProfile[]; activeProfileId?: string | null; profile?: InquisitorProfile | null }) => {
    if (Array.isArray(data.profiles)) {
      setProfiles(data.profiles)
    }
    if (typeof data.activeProfileId === "string" || data.activeProfileId === null) {
      setActiveProfileId(data.activeProfileId)
    }
    if (data.profile) {
      setSelectedProfileId(data.profile.id)
      setInquisitorName(data.profile.inquisitor_name)
    }
  }

  useEffect(() => {
    const loadProfiles = async () => {
      try {
        const response = await fetch("/api/profile")
        if (!response.ok) return
        const data = await response.json()
        updateProfilesState(data)
      } catch (err) {
        console.error("Failed to load profiles:", err)
      } finally {
        setProfileLoading(false)
      }
    }

    loadProfiles()
  }, [])

  useEffect(() => {
    if (profileLoading || initialisedRef.current) {
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
  }, [profileLoading, profiles, activeProfileId, selectedProfileId, initialStep, forceProfileChange])

  const handleRollBeast = () => {
    setBeastName(rollBeastName())
    setError(null)
  }

  const handleRandomSeed = () => {
    const randomSeed = Math.floor(Math.random() * 1_000_000_000)
    setSeedValue(String(randomSeed))
    setError(null)
  }

  const setActiveProfile = async (profileId: string) => {
    try {
      const response = await fetch("/api/profile", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ profileId, setActive: true }),
      })

      if (!response.ok) {
        console.error("Failed to update active profile")
        return null
      }

      const data = await response.json()
      updateProfilesState(data)
      return data.profile as InquisitorProfile
    } catch (err) {
      console.error("Failed to update active profile", err)
      return null
    }
  }

  const createProfile = async (name: string) => {
    try {
      const response = await fetch("/api/profile", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ inquisitor_name: name, setActive: true }),
      })

      if (!response.ok) {
        const data = await response.json().catch(() => null)
        setError(data?.message || "Failed to create profile")
        return null
      }

      const data = await response.json()
      updateProfilesState(data)
      return data.profile as InquisitorProfile
    } catch (err) {
      console.error("Failed to create profile", err)
      setError("Failed to create profile")
      return null
    }
  }

  const handleChangeProfile = () => {
    setSelectedProfileId(null)
    setInquisitorName("")
    setIsChangingProfile(true)
    setStep("intro")
  }

  const handleSelectProfile = async (profile: InquisitorProfile) => {
    setSelectedProfileId(profile.id)
    setInquisitorName(profile.inquisitor_name)
    setIsChangingProfile(false)
    setStep("beast")

    if (profile.id !== activeProfileId) {
      await setActiveProfile(profile.id)
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
        profileToUse = await createProfile(trimmedInquisitorName)
        if (!profileToUse) {
          return
        }
        setIsChangingProfile(false)
      } else {
        const updated = await setActiveProfile(profileToUse.id)
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
                          <button
                            key={profile.id}
                            onClick={() => handleSelectProfile(profile)}
                            className={`text-left border rounded-md p-3 transition focus:outline-none focus:ring-2 focus:ring-amber-500/60 ${
                              isSelected ? "border-amber-500 bg-amber-900/20" : "border-amber-900/30 bg-transparent"
                            }`}
                          >
                            <p className="text-amber-100 font-semibold">{profile.inquisitor_name}</p>
                            <p className="text-amber-200/50 text-xs mt-1">
                              Games: {profile.stats.games_played} • Wins: {profile.stats.victories} • Losses: {profile.stats.defeats}
                            </p>
                            <p className="text-amber-200/50 text-xs">Win Rate: {profile.stats.win_rate}%</p>
                          </button>
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
                  </>
                ) : (
                  <Button
                    onClick={() => {
                      setIsChangingProfile(true)
                      setStep("name")
                    }}
                    className="w-full bg-amber-900 hover:bg-amber-800 text-amber-50 font-semibold py-2"
                  >
                    Begin Investigation
                  </Button>
                )}
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
    </div>
  )
}
