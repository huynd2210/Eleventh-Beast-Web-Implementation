"use client"
import { Card } from "@/components/ui/card"

// Define the 8 locations from the map image
export const LOCATIONS = [
  { id: "I", name: "The Royal Exchange", x: 50, y: 20 },
  { id: "II", name: "All-Hallows-The-Great", x: 30, y: 40 },
  { id: "III", name: "Billingsgate Dock", x: 70, y: 35 },
  { id: "IV", name: "London Bridge", x: 60, y: 55 },
  { id: "V", name: "St. Thomas' Hospital", x: 40, y: 65 },
  { id: "VI", name: "Coxes Wharf", x: 75, y: 70 },
  { id: "VII", name: "Marshalsea Prison", x: 35, y: 85 },
  { id: "VIII", name: "Burying Ground", x: 55, y: 90 },
]

// Graph connections based on your map image
export const LOCATION_CONNECTIONS: Record<string, string[]> = {
  I: ["II", "III"],
  II: ["I", "IV"],
  III: ["I", "IV"],
  IV: ["II", "III", "V"],
  V: ["IV", "VI", "VIII", "VII"],
  VI: ["V"],
  VII: ["V", "VIII"],
  VIII: ["V", "VII"],
}

interface LondonMapProps {
  playerLocation: string
  beastLocation: string | null
  rumorsTokens?: Record<string, boolean>
  onPlayerMove: (locationId: string) => Promise<void>
  canMove: boolean
  actionsRemaining?: number
  onActionUsed?: () => void
  addToLog?: (message: string) => void
  gameData?: any
  setGameData?: (data: any) => void
  locations?: any[]
  locationConnections?: Record<string, string[]>
}

export function LondonMap({
  playerLocation,
  beastLocation,
  rumorsTokens = {},
  onPlayerMove,
  canMove,
  actionsRemaining = 2,
  onActionUsed,
  addToLog,
  gameData,
  setGameData,
  locations = LOCATIONS,
  locationConnections = LOCATION_CONNECTIONS,
}: LondonMapProps) {
  const playerLoc = locations.find((l: any) => l.id === playerLocation)
  const beastLoc = beastLocation ? locations.find((l: any) => l.id === beastLocation) : null
  const connectedLocations = locationConnections[playerLocation] || []

  const handleMoveAction = async (targetLocationId: string) => {
    const targetLocation = locations.find((l: any) => l.id === targetLocationId)
    if (!targetLocation) return

    if (!canMove || actionsRemaining <= 0) return

    // Use the onPlayerMove callback to handle the move via API
    if (onPlayerMove) {
      await onPlayerMove(targetLocationId)
    }

    // Call onActionUsed after the move is complete to use up an action
    if (onActionUsed) {
      onActionUsed()
    }
  }

  return (
    <Card className="border-amber-900/50 bg-slate-900/50 p-6">
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-bold text-amber-100 mb-2">1746 London</h3>
          <p className="text-amber-200/60 text-xs mb-4">
            A map of the treacherous streets of London. Navigate to track and confront the Beast.
          </p>
        </div>

        {/* Interactive Map - SVG Graph Visualization */}
        <div className="bg-slate-800/30 border border-amber-900/30 rounded p-6 overflow-x-auto">
          <svg width="100%" height="420" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet">
            {/* Draw connection lines */}
            {Object.entries(locationConnections).map(([fromId, toIds]) => {
              const fromLoc = locations.find((l: any) => l.id === fromId)
              return toIds.map((toId) => {
                if (fromId > toId) return null // Avoid duplicate lines
                const toLoc = locations.find((l: any) => l.id === toId)
                if (!fromLoc || !toLoc) return null
                return (
                  <line
                    key={`${fromId}-${toId}`}
                    x1={fromLoc.x}
                    y1={fromLoc.y}
                    x2={toLoc.x}
                    y2={toLoc.y}
                    stroke="rgba(217, 119, 6, 0.3)"
                    strokeWidth="1.5"
                  />
                )
              })
            })}

            {/* Draw location nodes */}
            {locations.map((loc: any) => {
              const isPlayer = loc.id === playerLocation
              const isBeast = loc.id === beastLocation
              const hasRumorToken = rumorsTokens[loc.id]
              const isConnected = connectedLocations.includes(loc.id)
              const canSelect =
                canMove && actionsRemaining > 0 && isConnected && loc.id !== playerLocation

              return (
                <g
                  key={loc.id}
                  className={canSelect ? "cursor-pointer transition-opacity hover:opacity-85" : ""}
                  onClick={() => {
                    if (canSelect) {
                      handleMoveAction(loc.id)
                    }
                  }}
                  role={canSelect ? "button" : undefined}
                  aria-label={canSelect ? `Move to ${loc.name}` : undefined}
                >
                  <circle
                    cx={loc.x}
                    cy={loc.y}
                    r="4"
                    fill={isBeast ? "#dc2626" : isPlayer ? "#b45309" : canSelect ? "#d97706" : "#1e293b"}
                    stroke={isBeast ? "#991b1b" : isPlayer ? "#78350f" : canSelect ? "#d1a054" : "#334155"}
                    strokeWidth={canSelect ? "1.5" : "1"}
                    filter={canSelect ? "drop-shadow(0px 0px 1px rgba(209,160,84,0.25))" : undefined}
                    opacity={canSelect || isPlayer || isBeast ? 0.95 : 0.8}
                  />

                  {hasRumorToken && (
                    <g>
                      <circle cx={loc.x + 3} cy={loc.y - 3} r="1.5" fill="#9333ea" stroke="#7e22ce" strokeWidth="0.5" />
                    </g>
                  )}

                  <text
                    x={loc.x}
                    y={loc.y - 6}
                    fontSize="4"
                    textAnchor="middle"
                    fill="#d4af37"
                    fontWeight="bold"
                    style={{ pointerEvents: "none", userSelect: "none" }}
                  >
                    {loc.id}
                  </text>
                </g>
              )
            })}
          </svg>
        </div>

        {/* Location Information */}
        <div className="grid md:grid-cols-2 gap-4">
          {playerLoc && (
            <div className="bg-amber-950/30 border border-amber-900/50 rounded p-4">
              <p className="text-amber-200/60 text-xs uppercase tracking-widest mb-2">Your Location</p>
              <p className="text-amber-100 font-semibold">{playerLoc.name}</p>
              <p className="text-amber-200/60 text-xs mt-2">(Location {playerLoc.id})</p>
            </div>
          )}
          {beastLoc && (
            <div className="bg-red-950/30 border border-red-900/50 rounded p-4">
              <p className="text-red-200/60 text-xs uppercase tracking-widest mb-2">Beast Location</p>
              <p className="text-red-100 font-semibold">{beastLoc.name}</p>
              <p className="text-red-200/60 text-xs mt-2">(Location {beastLoc.id})</p>
            </div>
          )}
        </div>

        {/* Legend */}
        <div className="bg-slate-800/20 border border-amber-900/20 rounded p-3 text-xs text-amber-200/60 space-y-2">
          <p className="font-semibold text-amber-200">Map Legend:</p>
          <p>🟡 Your location • 🔴 Beast location • 🟣 Rumor token • Lines represent routes</p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1">
            {locations.map((loc: any) => (
              <div key={loc.id} className="flex items-center gap-2 text-amber-200/70">
                <span className="font-mono text-amber-100">{loc.id}</span>
                <span>{loc.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Card>
  )
}
