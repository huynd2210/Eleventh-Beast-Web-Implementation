export interface ProfileStats {
  games_played: number
  victories: number
  defeats: number
  win_rate: number
}

export interface InquisitorProfile {
  id: string
  inquisitor_name: string
  stats: ProfileStats
  created_at: string
  updated_at: string
}

