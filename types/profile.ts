export interface ProfileStats {
  games_played: number
  victories: number
  defeats: number
  win_rate: number
}

export interface RunRecord {
  id: string
  timestamp: string
  result: "victory" | "defeat"
  beast_name: string
  seed?: number
  rounds: number
  days_elapsed: number
  rumors_total: number
  rumors_false: number
  rumors_verified: number
  verified_rumors: Array<{
    id: string
    category?: "ward" | "weapon"
    text: string
  }>
  false_rumors: Array<{
    id: string
    note: string
  }>
}

export interface InquisitorProfile {
  id: string
  inquisitor_name: string
  stats: ProfileStats
  runs: RunRecord[]
  created_at: string
  updated_at: string
}

