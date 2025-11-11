"use client"

import { useEffect, useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { gameAPI } from "@/lib/game-api"

interface ActionsPanelProps {
  gameData: any
  gamePhase: "beast-approaches" | "take-actions" | "hunt" | "game-ended"
  setGameData: (data: any) => void
  addToLog: (message: string) => void
  onActionsComplete: () => void
  onHuntTriggered: () => void
  actionsRemaining: number
  onCompleteAction: () => void
  onSessionExpired: (message?: string) => void
}

export function ActionsPanel({
  gameData,
  gamePhase,
  setGameData,
  addToLog,
  onActionsComplete,
  onHuntTriggered,
  actionsRemaining,
  onCompleteAction,
  onSessionExpired,
}: ActionsPanelProps) {
  const [selectedTab, setSelectedTab] = useState("investigate")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isHuntPhase = gamePhase === "hunt"
  const canTakeStandardActions = gamePhase === "take-actions"
  const beastHere = gameData.beast_location === gameData.player_location
  const canHuntNow = isHuntPhase ? beastHere : canTakeStandardActions && beastHere

  useEffect(() => {
    if (isHuntPhase) {
      setSelectedTab("hunt")
    } else if (selectedTab === "hunt" && canTakeStandardActions) {
      setSelectedTab("investigate")
    }
    // intentionally not including selectedTab in deps to avoid loops
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHuntPhase, canTakeStandardActions])

  if (!gameData.session_id) {
    return (
      <Card className="border-amber-900/50 bg-slate-900/50 p-6">
        <p className="text-amber-200/60 text-sm">Game session not found. Please refresh the page.</p>
      </Card>
    )
  }

  const currentLocationName = "Current Location"
  const isAtAllHallows = gameData.player_location === "II"

  const performInvestigate = async () => {
    if (!canTakeStandardActions) {
      setError("You cannot investigate right now.")
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const response = await gameAPI.investigate(gameData.session_id)

      if (response.success && response.game_data) {
        setGameData(response)
        if (response.game_log) {
          response.game_log.forEach((log: any) => {
            if (!gameData.game_log?.find((l: any) => l.id === log.id)) {
              addToLog(log.message)
            }
          })
        }
        onCompleteAction()
      } else {
        setError(response.message || "Investigation failed")
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to investigate"
      if (message.toLowerCase().includes("session not found")) {
        onSessionExpired(message)
      } else {
        setError(message)
      }
    } finally {
      setIsLoading(false)
    }
  }

  const performVerify = async () => {
    if (!canTakeStandardActions) {
      setError("You cannot verify rumors right now.")
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const response = await gameAPI.verifyRumors(gameData.session_id)

      if (response.success && response.game_data) {
        setGameData(response)
        if (response.game_log) {
          response.game_log.forEach((log: any) => {
            if (!gameData.game_log?.find((l: any) => l.id === log.id)) {
              addToLog(log.message)
            }
          })
        }
        onCompleteAction()
      } else {
        setError(response.message || "Verification failed")
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to verify rumors"
      if (message.toLowerCase().includes("session not found")) {
        onSessionExpired(message)
      } else {
        setError(message)
      }
    } finally {
      setIsLoading(false)
    }
  }

  const performHunt = async () => {
    if (!canHuntNow) {
      setError("You can only hunt when the Beast shares your location.")
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const response = await gameAPI.huntBeast(gameData.session_id)

      if (response.success && response.game_data) {
        setGameData(response)
        if (response.game_log) {
          response.game_log.forEach((log: any) => {
            if (!gameData.game_log?.find((l: any) => l.id === log.id)) {
              addToLog(log.message)
            }
          })
        }

        if (response.dice_rolls) {
          addToLog(`Hunt dice rolls: [${response.dice_rolls.join(", ")}], lowest: ${response.lowest_roll}`)
        }

        if (!isHuntPhase) {
          onCompleteAction()
        }
        onHuntTriggered()
      } else {
        setError(response.message || "Hunt failed")
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to hunt beast"
      if (message.toLowerCase().includes("session not found")) {
        onSessionExpired(message)
      } else {
        setError(message)
      }
    } finally {
      setIsLoading(false)
    }
  }

  const unverifiedRumors = gameData.investigation?.rumors?.filter((r: any) => !r.verified) || []

  return (
    <Card className="border-amber-900/50 bg-slate-900/50 p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-amber-100 mb-2">
          {isHuntPhase ? "HUNT THE BEAST" : "II. TAKE ACTIONS"}
        </h2>
        {isHuntPhase ? (
          <p className="text-amber-200/60 text-sm mb-4">
            A surprise hunt has been triggered! Engage the Beast immediately. Investigation and verification actions are
            unavailable until the encounter ends.
          </p>
        ) : (
          <p className="text-amber-200/60 text-sm mb-4">
            Choose any two (2) actions from the following list. You may take the actions in any order, and may take the same
            action twice.
          </p>
        )}
        {!isHuntPhase && (
          <div className="flex items-center gap-4">
            <div className="inline-block bg-amber-900/30 border border-amber-900/50 px-4 py-2 rounded">
              <span className="text-amber-200/60 text-sm">Actions Remaining:</span>
              <span className="text-amber-100 font-bold text-lg ml-2">{actionsRemaining}</span>
            </div>
          </div>
        )}
      </div>

      {!isHuntPhase && actionsRemaining === 0 && (
        <div className="mb-6 p-4 bg-amber-950/30 border border-amber-900/50 rounded">
          <p className="text-amber-200/60 text-sm">All actions have been used for this turn. The day will end automatically...</p>
        </div>
      )}

      {error && (
        <div className="mb-6 p-4 bg-red-950/30 border border-red-900/50 rounded">
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

      <Tabs value={selectedTab} onValueChange={setSelectedTab} className="w-full">
        <TabsList className="w-full justify-start border-b border-amber-900/20 bg-transparent p-0 rounded-none gap-2">
          <TabsTrigger
            value="investigate"
            disabled={!canTakeStandardActions}
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-amber-600 data-[state=active]:bg-transparent"
          >
            Investigate
          </TabsTrigger>
          <TabsTrigger
            value="verify"
            disabled={!canTakeStandardActions}
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-amber-600 data-[state=active]:bg-transparent"
          >
            Verify
          </TabsTrigger>
          <TabsTrigger
            value="hunt"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-amber-600 data-[state=active]:bg-transparent"
          >
            Hunt
          </TabsTrigger>
        </TabsList>

        <TabsContent value="investigate" className="mt-6">
          <div className="space-y-4">
            <div className="bg-slate-800/30 border border-amber-900/30 rounded p-4">
              <p className="text-amber-200/60 text-sm mb-3">
                Remove one (1) Rumor Token from your location, and discover an Unverified Rumor about the BEAST.
              </p>
              <p className="text-amber-100 font-semibold mb-2">
                Current Location: {currentLocationName} (Location {gameData.player_location})
              </p>

              {gameData.rumors_tokens?.[gameData.player_location] ? (
                <p className="text-green-200 text-sm">✓ Rumor Token available here</p>
              ) : (
                <p className="text-red-200 text-sm">✗ No Rumor Token at this location</p>
              )}
            </div>

            <Button
              onClick={performInvestigate}
              disabled={
                !canTakeStandardActions ||
                actionsRemaining === 0 ||
                !gameData.rumors_tokens?.[gameData.player_location] ||
                isLoading
              }
              className="w-full bg-green-900 hover:bg-green-800 text-green-50 font-semibold disabled:opacity-50"
            >
              {isLoading ? "Investigating..." : "Investigate & Draw Rumor"}
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="verify" className="mt-6">
          <div className="space-y-4">
            <div className="bg-slate-800/30 border border-amber-900/30 rounded p-4">
              <p className="text-amber-200/60 text-sm mb-3">
                Roll 1d6 for each Unverified Rumor. On 5-6, mark as false rumor. Otherwise, mark as Learned Secret.
              </p>
              <p className="text-amber-100 font-semibold mb-2">Location: All-Hallows-The-Great (Location II)</p>

              {isAtAllHallows ? (
                <p className="text-green-200 text-sm">✓ You are at All-Hallows-The-Great</p>
              ) : (
                <p className="text-red-200 text-sm">✗ You must be at All-Hallows-The-Great to verify rumors</p>
              )}
            </div>

            <div className="bg-slate-800/30 border border-amber-900/30 rounded p-4">
              <p className="text-amber-200/60 text-xs uppercase tracking-widest mb-2">Unverified Rumors Available</p>
              <p className="text-amber-100 font-bold text-lg">{unverifiedRumors.length}</p>
            </div>

            <Button
              onClick={performVerify}
              disabled={
                !canTakeStandardActions ||
                actionsRemaining === 0 ||
                !isAtAllHallows ||
                unverifiedRumors.length === 0 ||
                isLoading
              }
              className="w-full bg-blue-900 hover:bg-blue-800 text-blue-50 font-semibold disabled:opacity-50"
            >
              {isLoading ? "Verifying..." : "Verify Rumors"}
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="hunt" className="mt-6">
          <div className="space-y-4">
            <div className="bg-slate-800/30 border border-amber-900/30 rounded p-4">
              <p className="text-amber-200/60 text-sm mb-3">
                If you are in the same location as the BEAST, you may perform a hunt and engage in combat.
              </p>
              <p className="text-amber-100 font-semibold mb-2">
                Your Location: {currentLocationName} (Location {gameData.player_location})
              </p>
              <p className="text-amber-100 font-semibold">
                Beast Location: {gameData.beast_location ? `Location ${gameData.beast_location}` : "Unknown"}
              </p>

              {beastHere ? (
                <p className="text-red-200 text-sm mt-2">⚠ The Beast is here!</p>
              ) : (
                <p className="text-amber-200/60 text-sm mt-2">The Beast is not at your location</p>
              )}
            </div>

            <Button
              onClick={performHunt}
              disabled={!canHuntNow || isLoading}
              className="w-full bg-red-900 hover:bg-red-800 text-red-50 font-semibold disabled:opacity-50"
            >
              {isLoading ? "Hunting..." : "Engage the Beast!"}
            </Button>
          </div>
        </TabsContent>
      </Tabs>
    </Card>
  )
}