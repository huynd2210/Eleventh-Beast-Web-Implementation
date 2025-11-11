"use client"

import { useEffect, useRef, useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { GameLog } from "./game-log"
import { LondonMap, LOCATIONS as DEFAULT_LOCATIONS, LOCATION_CONNECTIONS as DEFAULT_LOCATION_CONNECTIONS } from "./london-map"
import { ActionsPanel } from "./actions-panel"
import { gameAPI } from "@/lib/game-api"
import type { InquisitorProfile, RunRecord } from "@/types/profile"

interface GameData {
  beast_name: string
  inquisitor_name: string
  current_day: number
  current_month: string
  current_year: number
  player_location: string
  investigation: {
    rumors: Array<{
      id: string
      location: string
      note: string
      verified: boolean
      category?: "ward" | "weapon"
      is_false?: boolean
      is_learned?: boolean
    }>
    secrets: Array<{ id: string; secret: string; category?: "ward" | "weapon" }>
    notes: Array<{ id: string; note: string }>
  }
  wards: Array<{ id: string; name: string }>
  weapons: Array<{ id: string; name: string }>
  health: number
  knowledge: number
  beast_location?: string
  beast_distance?: number
  rumors_tokens?: Record<string, boolean>
  seed: number
  session_id?: string
  game_ended: boolean
  victorious: boolean
  game_phase: "beast-approaches" | "take-actions" | "hunt" | "game-ended"
  actions_remaining: number
  current_round: number
  start_time: number
  days_elapsed: number
  investigations_completed: number
  equipment_collected: number
  wounds: number
}

interface GameDashboardProps {
  gameData: GameData
  setGameData: (data: any) => void
  gameLog?: Array<{ id: string; message: string; timestamp: number }>
  setGameLog?: (log: Array<{ id: string; message: string; timestamp: number }>) => void
  onSessionExpired: () => void
  onPlayAgain: () => void
  onChangeProfile: () => void
  profile: InquisitorProfile | null
  onProfileUpdated: (profile: InquisitorProfile) => void
}

export function GameDashboard({
  gameData,
  setGameData,
  gameLog = [],
  setGameLog,
  onSessionExpired,
  onPlayAgain,
  onChangeProfile,
  profile,
  onProfileUpdated,
}: GameDashboardProps) {
  const [selectedTab, setSelectedTab] = useState("overview")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [locations, setLocations] = useState<any[]>(DEFAULT_LOCATIONS)
  const [locationConnections, setLocationConnections] = useState<Record<string, string[]>>(DEFAULT_LOCATION_CONNECTIONS)
  const [profileStats, setProfileStats] = useState(profile?.stats ?? null)
  const outcomeRecordedRef = useRef(false)

  const buildRunSummary = (result: "victory" | "defeat"): RunRecord => {
    const makeId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
    const rumors = gameData.investigation?.rumors ?? []
    const falseRumors = rumors.filter((rumor) => rumor?.is_false)
    const secrets = gameData.investigation?.secrets ?? []

    return {
      id: makeId(),
      timestamp: new Date().toISOString(),
      result,
      beast_name: gameData.beast_name,
      seed: typeof gameData.seed === "number" ? gameData.seed : undefined,
      rounds: gameData.current_round ?? 0,
      days_elapsed: gameData.days_elapsed ?? 0,
      rumors_total: rumors.length,
      rumors_false: falseRumors.length,
      rumors_verified: secrets.length,
      verified_rumors: secrets.map((secret) => ({
        id: secret.id ?? makeId(),
        category: secret.category === "ward" || secret.category === "weapon" ? secret.category : undefined,
        text: secret.secret ?? "",
      })),
      false_rumors: falseRumors.map((rumor) => ({
        id: rumor.id ?? makeId(),
        note: rumor.note ?? "",
      })),
    }
  }

  useEffect(() => {
    setProfileStats(profile?.stats ?? null)
  }, [profile])

  const currentProfileStats = profileStats ?? profile?.stats ?? null
  const unverifiedRumorsCount = (gameData.investigation?.rumors ?? []).filter((rumor) => !rumor.verified && !rumor.is_false).length

  useEffect(() => {
    if (!profile) {
      outcomeRecordedRef.current = false
      return
    }

    if (gameData.game_ended) {
      if (!outcomeRecordedRef.current) {
        const result = gameData.victorious ? "victory" : "defeat"
        const runSummary = buildRunSummary(result)
        ;(async () => {
          try {
            const response = await fetch("/api/profile", {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ profileId: profile.id, result, run: runSummary }),
            })
            if (response.ok) {
              const data = await response.json()
              if (data?.profile) {
                const updated = data.profile as InquisitorProfile
                onProfileUpdated(updated)
                setProfileStats(updated.stats)
              }
            }
          } catch (err) {
            console.error("Failed to record profile outcome", err)
          }
        })()
        outcomeRecordedRef.current = true
      }
    } else {
      outcomeRecordedRef.current = false
    }
  }, [gameData.game_ended, gameData.victorious, gameData.current_round, gameData.days_elapsed, gameData.investigation, gameData.beast_name, gameData.seed, profile, onProfileUpdated])

  const handleSessionExpired = (message?: string) => {
    setError(message ?? "Game session expired. Please start a new hunt.")
    onSessionExpired()
  }

  const handleApiError = (err: unknown, fallbackMessage: string) => {
    const message = err instanceof Error ? err.message : fallbackMessage
    if (message.toLowerCase().includes("session not found")) {
      handleSessionExpired(message)
      return
    }
    setError(message)
  }

  const loadGameData = async () => {
    if (!gameData.session_id) return
    
    try {
      setIsLoading(true)
      const response = await gameAPI.getGameState(gameData.session_id)
      
      if (response.success && response.game_data) {
        setGameData(response)
        if (setGameLog && response.game_log) {
          setGameLog(response.game_log)
        }
      } else if (!response.success) {
        handleApiError(new Error(response.message || "Failed to load game data"), "Failed to load game data")
      }
    } catch (err) {
      handleApiError(err, "Failed to load game data")
    } finally {
      setIsLoading(false)
    }
  }

  const loadLocations = async () => {
    try {
      const response = await gameAPI.getLocations()
      if (response.success) {
        setLocations(response.locations || [])
        setLocationConnections(response.location_connections || {})
      }
    } catch (err) {
      console.error("Failed to load locations:", err)
    }
  }

  const addToLog = (message: string) => {
    if (!setGameLog || !gameData.session_id) return
    
    const newLogEntry = {
      id: Date.now().toString(),
      message: `[Round ${gameData.current_round}] ${message}`,
      timestamp: Date.now(),
    }
    setGameLog([...gameLog, newLogEntry])
  }

  const movePlayer = async (locationId: string) => {
    if (!gameData.session_id) return
    
    try {
      setIsLoading(true)
      const response = await gameAPI.movePlayer(gameData.session_id, locationId)
      
      if (response.success && response.game_data) {
        setGameData(response)
        if (setGameLog && response.game_log) {
          setGameLog(response.game_log)
        }
      } else {
        handleApiError(new Error(response.message || "Failed to move player"), "Failed to move player")
      }
    } catch (err) {
      handleApiError(err, "Failed to move player")
    } finally {
      setIsLoading(false)
    }
  }

  const handleActionsComplete = async () => {
    if (!gameData.session_id) return
    
    try {
      setIsLoading(true)
      const response = await gameAPI.completeAction(gameData.session_id)
      
      if (response.success && response.game_data) {
        setGameData(response)
        if (setGameLog && response.game_log) {
          setGameLog(response.game_log)
        }
      } else if (!response.success) {
        handleApiError(new Error(response.message || "Failed to complete action"), "Failed to complete action")
      }
    } catch (err) {
      handleApiError(err, "Failed to complete action")
    } finally {
      setIsLoading(false)
    }
  }

  const completeAction = async () => {
    if (!gameData.session_id) return
    
    try {
      const response = await gameAPI.completeAction(gameData.session_id)
      
      if (response.success && response.game_data) {
        setGameData(response)
        if (setGameLog && response.game_log) {
          setGameLog(response.game_log)
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to complete action")
    }
  }

  const handleHuntTriggered = () => {
    setSelectedTab("overview")
  }

  const calculateStats = () => {
    const duration = Math.floor((Date.now() - gameData.start_time) / 60000) // minutes
    const hours = Math.floor(duration / 60)
    const minutes = duration % 60
    return {
      playtime: hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`,
    }
  }

  const stats = calculateStats()
  const maxHealth = Math.max(gameData.health + gameData.wounds, 3)
  const currentLocationName = locations.find((l) => l.id === gameData.player_location)?.name || "Unknown"

  if (gameData.game_ended) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 p-4 md:p-8 flex items-center justify-center">
        <Card className="max-w-2xl border-amber-900/50 bg-slate-900/50 backdrop-blur p-8 md:p-12 space-y-6">
          {profile && (
            <div className="bg-slate-800/30 border border-amber-900/40 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-widest text-amber-200/60">Inquisitor</p>
                  <p className="text-amber-100 font-semibold text-sm">{profile.inquisitor_name}</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onChangeProfile}
                  className="border-amber-900/50 text-amber-100 hover:bg-amber-900/20"
                >
                  Change Profile
                </Button>
              </div>
              {currentProfileStats && (
                <div className="grid grid-cols-2 gap-3 mt-4 text-sm text-amber-200/70">
                  <div>
                    <p className="text-xs uppercase tracking-widest text-amber-200/50">Games Played</p>
                    <p className="text-amber-100 font-semibold">{currentProfileStats.games_played}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-widest text-amber-200/50">Win Rate</p>
                    <p className="text-amber-100 font-semibold">{currentProfileStats.win_rate}%</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-widest text-amber-200/50">Victories</p>
                    <p className="text-amber-100 font-semibold">{currentProfileStats.victories}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-widest text-amber-200/50">Defeats</p>
                    <p className="text-amber-100 font-semibold">{currentProfileStats.defeats}</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {gameData.victorious ? (
            <>
              <h1 className="text-5xl md:text-6xl font-bold text-green-100 mb-4 tracking-wider text-center">VICTORY</h1>
              <p className="text-green-200 text-lg mb-6 text-center">
                {gameData.inquisitor_name} has defeated {gameData.beast_name}!
              </p>
              <p className="text-green-200/60 mb-8 text-center">
                The evil has been vanquished. London is safe. Your legend as an Inquisitor is secured.
              </p>

              {/* Victory Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
                <div className="bg-green-950/30 border border-green-900/50 rounded p-3 text-center">
                  <p className="text-green-200/60 text-xs uppercase">Days Spent</p>
                  <p className="text-green-100 font-bold text-lg">{gameData.days_elapsed}</p>
                </div>
                <div className="bg-green-950/30 border border-green-900/50 rounded p-3 text-center">
                  <p className="text-green-200/60 text-xs uppercase">Secrets Learned</p>
                  <p className="text-green-100 font-bold text-lg">{gameData.investigation.secrets.length}</p>
                </div>
                <div className="bg-green-950/30 border border-green-900/50 rounded p-3 text-center">
                  <p className="text-green-200/60 text-xs uppercase">Playtime</p>
                  <p className="text-green-100 font-bold text-lg">{stats.playtime}</p>
                </div>
              </div>
            </>
          ) : (
            <>
              <h1 className="text-5xl md:text-6xl font-bold text-red-100 mb-4 tracking-wider text-center">DEFEAT</h1>
              <p className="text-red-200 text-lg mb-6 text-center">
                {gameData.inquisitor_name} has fallen to {gameData.beast_name}.
              </p>
              <p className="text-red-200/60 mb-8 text-center">
                The hunt has ended in tragedy. Perhaps another Inquisitor will have better fortune.
              </p>

              {/* Defeat Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
                <div className="bg-red-950/30 border border-red-900/50 rounded p-3 text-center">
                  <p className="text-red-200/60 text-xs uppercase">Days Fought</p>
                  <p className="text-red-100 font-bold text-lg">{gameData.days_elapsed}</p>
                </div>
                <div className="bg-red-950/30 border border-red-900/50 rounded p-3 text-center">
                  <p className="text-red-200/60 text-xs uppercase">Secrets Learned</p>
                  <p className="text-red-100 font-bold text-lg">{gameData.investigation.secrets.length}</p>
                </div>
                <div className="bg-red-950/30 border border-red-900/50 rounded p-3 text-center">
                  <p className="text-red-200/60 text-xs uppercase">Playtime</p>
                  <p className="text-red-100 font-bold text-lg">{stats.playtime}</p>
                </div>
              </div>
            </>
          )}

          <div className="flex flex-col sm:flex-row justify-center gap-3 mt-6">
            <Button
              onClick={onPlayAgain}
              className="bg-amber-900 hover:bg-amber-800 text-amber-50 font-semibold px-6 py-3"
            >
              Play Again
            </Button>
          </div>

          {setGameLog && <GameLog logs={gameLog} />}
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8 space-y-2">
          <h1 className="text-4xl md:text-5xl font-bold text-amber-100 tracking-wider">{gameData.beast_name}</h1>
          <div className="flex flex-wrap gap-4 text-amber-200/60 text-sm">
            <span>Inquisitor: {gameData.inquisitor_name}</span>
            <span>•</span>
            <span>
              {gameData.current_month} {gameData.current_day}, {gameData.current_year}
            </span>
            <span>•</span>
            <span>
              Location: {currentLocationName} (Location {gameData.player_location})
            </span>
            <span>•</span>
            <span className="text-amber-300/80">
              Round: {gameData.current_round}
            </span>
            <span>•</span>
            <span className="font-mono text-amber-300/60" title="Random Seed (for debugging)">
              Seed: {gameData.seed}
            </span>
          </div>
        </div>

        {/* Status Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <Card className="border-amber-900/50 bg-slate-900/50 p-4">
            <div className="text-amber-200/60 text-xs uppercase tracking-widest mb-2">Unverified Rumors</div>
            <div className="text-2xl font-bold text-amber-100">{unverifiedRumorsCount}</div>
            <div className="text-amber-200/40 text-xs mt-1">Clues awaiting confirmation</div>
          </Card>
          <Card className="border-amber-900/50 bg-slate-900/50 p-4">
            <div className="text-amber-200/60 text-xs uppercase tracking-widest mb-2">Health</div>
            <div className="text-2xl font-bold text-amber-100">
              {gameData.health}/{maxHealth}
            </div>
            <div className="text-amber-200/40 text-xs mt-1">
              Wounds: {gameData.wounds}/{maxHealth}
            </div>
          </Card>

          <Card className="border-amber-900/50 bg-slate-900/50 p-4">
            <div className="text-amber-200/60 text-xs uppercase tracking-widest mb-2">Wards</div>
            <div className="text-2xl font-bold text-amber-100">{gameData.wards.length}</div>
          </Card>

          <Card className="border-amber-900/50 bg-slate-900/50 p-4">
            <div className="text-amber-200/60 text-xs uppercase tracking-widest mb-2">Weapons</div>
            <div className="text-2xl font-bold text-amber-100">{gameData.weapons.length}</div>
          </Card>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mb-4 p-4 bg-red-950/30 border border-red-900/50 rounded">
            <p className="text-red-200 text-sm">{error}</p>
            <Button
              onClick={() => setError(null)}
              variant="outline"
              size="sm"
              className="mt-2 border-red-900/50 text-red-100 hover:bg-red-900/20"
            >
              Dismiss
            </Button>
          </div>
        )}

        {/* Main Content */}
        <Tabs value={selectedTab} onValueChange={setSelectedTab}>
          <TabsList className="w-full justify-start border-b border-amber-900/20 bg-transparent p-0 rounded-none overflow-x-auto">
            <TabsTrigger
              value="overview"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-amber-600 data-[state=active]:bg-transparent"
            >
              Overview
            </TabsTrigger>
            <TabsTrigger
              value="stats"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-amber-600 data-[state=active]:bg-transparent"
            >
              Statistics
            </TabsTrigger>
            <TabsTrigger
              value="profile"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-amber-600 data-[state=active]:bg-transparent"
            >
              Profile
            </TabsTrigger>
          </TabsList>

        <TabsContent value="overview" className="mt-6 space-y-6">
            <div className="grid gap-6 lg:grid-cols-2">
              <div className="space-y-6">
                {gameData.game_phase === "beast-approaches" && (
                  <Card className="border-amber-900/50 bg-slate-900/50 p-6">
                    <h2 className="text-xl font-bold text-amber-100 mb-4">I. THE BEAST APPROACHES</h2>
                    <p className="text-amber-200/60 text-sm mb-4">
                      The automatic phase has resolved. Check the game log for details. Moving to actions...
                    </p>
                  </Card>
                )}

                {(gameData.game_phase === "take-actions" || gameData.game_phase === "hunt") && (
                  <ActionsPanel
                    gameData={gameData}
                    gamePhase={gameData.game_phase}
                    setGameData={setGameData}
                    addToLog={addToLog}
                    onActionsComplete={handleActionsComplete}
                    onHuntTriggered={handleHuntTriggered}
                    onCompleteAction={completeAction}
                    actionsRemaining={gameData.actions_remaining}
                    onSessionExpired={handleSessionExpired}
                    locations={locations}
                  />
                )}

                <div className="grid md:grid-cols-1 gap-4">
                  <Card className="border-amber-900/50 bg-slate-900/50 p-4">
                    <p className="text-amber-200/60 text-xs uppercase mb-2">Beast Distance</p>
                    <div className="text-2xl font-bold text-amber-100">
                      {gameData.beast_distance !== null ? gameData.beast_distance : "Unknown"}
                    </div>
                    <p className="text-amber-200/60 text-xs mt-1">locations away</p>
                  </Card>
                </div>
              </div>

              <div className="space-y-6">
                <LondonMap
                  playerLocation={gameData.player_location}
                  beastLocation={gameData.beast_location || null}
                  rumorsTokens={gameData.rumors_tokens}
                  onPlayerMove={movePlayer}
                  canMove={gameData.game_phase === "take-actions"}
                  actionsRemaining={gameData.actions_remaining}
                  onActionUsed={completeAction}
                  addToLog={addToLog}
                  gameData={gameData}
                  setGameData={setGameData}
                  locations={locations}
                  locationConnections={locationConnections}
                />
              </div>
            </div>

            {setGameLog && <GameLog logs={gameLog} />}
          </TabsContent>

          <TabsContent value="stats" className="mt-6 space-y-6">
            <div className="grid md:grid-cols-1 gap-6">
              <Card className="border-amber-900/50 bg-slate-900/50 p-6">
                <h3 className="text-lg font-bold text-amber-100 mb-4">Investigation Statistics</h3>
                <div className="space-y-3 text-amber-100 text-sm">
                  <div className="flex justify-between">
                    <span className="text-amber-200/60">Rumors Recorded:</span>
                    <span className="font-semibold">{gameData.investigation.rumors.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-amber-200/60">Verified:</span>
                    <span className="font-semibold">{gameData.investigation.secrets.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-amber-200/60">False Leads:</span>
                    <span className="font-semibold">{gameData.investigation.rumors.filter((rumor) => rumor.is_false).length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-amber-200/60">Wards Collected:</span>
                    <span className="font-semibold">{gameData.wards.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-amber-200/60">Weapons Collected:</span>
                    <span className="font-semibold">{gameData.weapons.length}</span>
                  </div>
                </div>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="profile" className="mt-6 space-y-6">
            {!profile ? (
              <Card className="border-amber-900/50 bg-slate-900/40 p-6 text-amber-200/70 text-sm">
                No inquisitor profile is active. Start a hunt to create one.
              </Card>
            ) : (
              <div className="space-y-6">
                <Card className="border-amber-900/50 bg-slate-900/50 p-6">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
                    <div>
                      <h3 className="text-lg font-bold text-amber-100">{profile.inquisitor_name}</h3>
                      <p className="text-amber-200/60 text-xs">Inquisitor Profile</p>
                    </div>
                    <div className="text-amber-200/60 text-xs">
                      <p>Created: {new Date(profile.created_at).toLocaleString()}</p>
                      <p>Updated: {new Date(profile.updated_at).toLocaleString()}</p>
                    </div>
                  </div>

                  <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    <div className="bg-slate-800/30 border border-amber-900/40 rounded p-3 text-center">
                      <p className="text-xs uppercase tracking-widest text-amber-200/60">Games Played</p>
                      <p className="text-amber-100 font-semibold text-xl">{currentProfileStats?.games_played ?? profile.stats.games_played}</p>
                    </div>
                    <div className="bg-slate-800/30 border border-amber-900/40 rounded p-3 text-center">
                      <p className="text-xs uppercase tracking-widest text-amber-200/60">Victories</p>
                      <p className="text-amber-100 font-semibold text-xl">{currentProfileStats?.victories ?? profile.stats.victories}</p>
                    </div>
                    <div className="bg-slate-800/30 border border-amber-900/40 rounded p-3 text-center">
                      <p className="text-xs uppercase tracking-widest text-amber-200/60">Defeats</p>
                      <p className="text-amber-100 font-semibold text-xl">{currentProfileStats?.defeats ?? profile.stats.defeats}</p>
                    </div>
                    <div className="bg-slate-800/30 border border-amber-900/40 rounded p-3 text-center">
                      <p className="text-xs uppercase tracking-widest text-amber-200/60">Win Rate</p>
                      <p className="text-amber-100 font-semibold text-xl">{currentProfileStats?.win_rate ?? profile.stats.win_rate}%</p>
                    </div>
                  </div>
                </Card>

                <Card className="border-amber-900/50 bg-slate-900/50 p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold text-amber-100">Run History</h3>
                    <span className="text-amber-200/60 text-xs">{profile.runs.length} recorded hunt{profile.runs.length === 1 ? "" : "s"}</span>
                  </div>

                  {profile.runs.length === 0 ? (
                    <p className="text-amber-200/60 text-sm">No hunts recorded yet. Defeat or slay a beast to log a run.</p>
                  ) : (
                    <div className="space-y-4">
                      {profile.runs.map((run) => (
                        <div
                          key={run.id}
                          className={`border rounded-lg p-4 transition-colors ${
                            run.result === "victory" ? "border-green-900/60 bg-green-950/20" : "border-red-900/60 bg-red-950/20"
                          }`}
                        >
                          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                            <div>
                              <p className="text-sm text-amber-200/60">{new Date(run.timestamp).toLocaleString()}</p>
                              <p className="text-amber-100 font-semibold text-lg">{run.beast_name}</p>
                            </div>
                            <div className="flex items-center gap-3 text-sm text-amber-200/70">
                              <span className={`px-2 py-1 rounded text-xs font-semibold uppercase ${run.result === "victory" ? "bg-green-900/60 text-green-100" : "bg-red-900/60 text-red-100"}`}>
                                {run.result === "victory" ? "Victory" : "Defeat"}
                              </span>
                              <span>Days: <span className="text-amber-100 font-semibold">{run.days_elapsed}</span></span>
                              <span>Rounds: <span className="text-amber-100 font-semibold">{run.rounds}</span></span>
                            </div>
                          </div>

                          <div className="grid md:grid-cols-3 gap-3 text-sm text-amber-200/70 mt-4">
                            <div className="bg-slate-900/40 border border-amber-900/40 rounded p-3">
                              <p className="text-xs uppercase tracking-widest">Rumors</p>
                              <p className="text-amber-100 font-semibold">{run.rumors_total}</p>
                            </div>
                            <div className="bg-slate-900/40 border border-amber-900/40 rounded p-3">
                              <p className="text-xs uppercase tracking-widest">Verified</p>
                              <p className="text-amber-100 font-semibold">{run.rumors_verified}</p>
                            </div>
                            <div className="bg-slate-900/40 border border-amber-900/40 rounded p-3">
                              <p className="text-xs uppercase tracking-widest">False Leads</p>
                              <p className="text-amber-100 font-semibold">{run.rumors_false}</p>
                            </div>
                          </div>

                          <div className="mt-4 grid md:grid-cols-2 gap-4">
                            <div>
                              <p className="text-xs uppercase tracking-widest text-amber-200/50 mb-2">Verified Rumors</p>
                              {run.verified_rumors.length === 0 ? (
                                <p className="text-amber-200/60 text-xs">No verified rumors recorded.</p>
                              ) : (
                                <ul className="space-y-2 text-sm text-amber-100">
                                  {run.verified_rumors.map((secret) => (
                                    <li key={secret.id} className="border border-amber-900/40 rounded p-2 bg-slate-900/40">
                                      <p className="text-xs uppercase tracking-widest text-amber-200/50 mb-1">
                                        {secret.category ? secret.category.toUpperCase() : "Unknown"}
                                      </p>
                                      <p className="leading-snug">{secret.text}</p>
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </div>
                            <div>
                              <p className="text-xs uppercase tracking-widest text-amber-200/50 mb-2">False Rumors</p>
                              {run.false_rumors.length === 0 ? (
                                <p className="text-amber-200/60 text-xs">No false rumors recorded.</p>
                              ) : (
                                <ul className="space-y-2 text-sm text-amber-100">
                                  {run.false_rumors.map((rumor) => (
                                    <li key={rumor.id} className="border border-red-900/40 rounded p-2 bg-red-950/20">
                                      <p className="leading-snug">{rumor.note}</p>
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
