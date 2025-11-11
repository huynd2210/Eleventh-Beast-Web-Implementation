"use client"

import { useState } from "react"
import { GameSetup } from "@/components/game-setup"
import { GameDashboard } from "@/components/game-dashboard"
import type { InquisitorProfile } from "@/types/profile"

export default function Home() {
  const [gameState, setGameState] = useState<{
    hasStarted: boolean
    gameData: any
    gameLog: any[]
    sessionId?: string
  }>({
    hasStarted: false,
    gameData: null,
    gameLog: [],
  })
  const [activeProfile, setActiveProfile] = useState<InquisitorProfile | null>(null)
  const [setupOptions, setSetupOptions] = useState<{
    initialStep?: "intro" | "name" | "beast"
    forceProfileChange?: boolean
    clearProfile?: boolean
  }>({})

  const resetToSetup = (options: { initialStep?: "intro" | "name" | "beast"; forceProfileChange?: boolean; clearProfile?: boolean } = {}) => {
    setGameState({
      hasStarted: false,
      gameData: null,
      gameLog: [],
      sessionId: undefined,
    })
    if (options.clearProfile) {
      setActiveProfile(null)
    }
    setSetupOptions(options)
  }

  const handleStartGame = ({ apiResponse, profile }: { apiResponse: any; profile: InquisitorProfile }) => {
    setGameState({
      hasStarted: true,
      gameData: apiResponse.game_data,
      gameLog: apiResponse.game_log || [],
      sessionId: apiResponse.game_data?.session_id,
    })
    setActiveProfile(profile)
    setSetupOptions({})
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      {!gameState.hasStarted ? (
        <GameSetup
          onStartGame={handleStartGame}
          initialStep={setupOptions.initialStep}
          forceProfileChange={setupOptions.forceProfileChange}
        />
      ) : (
        <GameDashboard
          gameData={gameState.gameData}
          setGameData={(data) => {
            const apiResponse = data as any
            if (apiResponse && typeof apiResponse === "object" && "game_data" in apiResponse) {
              setGameState({
                hasStarted: true,
                gameData: apiResponse.game_data,
                gameLog: apiResponse.game_log || [],
                sessionId: apiResponse.game_data?.session_id,
              })
            } else {
              setGameState((prev) => ({
                hasStarted: true,
                gameData: data,
                gameLog: prev.gameLog,
                sessionId: prev.sessionId,
              }))
            }
          }}
          onSessionExpired={() => {
            resetToSetup({ initialStep: "intro" })
          }}
          onPlayAgain={() => resetToSetup({ initialStep: "beast" })}
          onChangeProfile={() => resetToSetup({ initialStep: "intro", forceProfileChange: true, clearProfile: true })}
          gameLog={gameState.gameLog}
          setGameLog={(log) =>
            setGameState((prev) => ({
              ...prev,
              gameLog: log,
            }))
          }
          profile={activeProfile}
          onProfileUpdated={setActiveProfile}
        />
      )}
    </main>
  )
}
