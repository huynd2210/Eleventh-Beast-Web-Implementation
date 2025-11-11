/**
 * API Service for The Eleventh Beast Game
 * Handles communication with Python backend game engine
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? ''

export interface CreateGameRequest {
  beast_name: string
  inquisitor_name: string
  seed?: number
}

export interface GameActionRequest {
  session_id: string
  action_type: 'move' | 'investigate' | 'verify' | 'hunt' | 'complete_action'
  target_location?: string
}

export interface GameResponse {
  success: boolean
  message: string
  game_data?: any
  game_log?: any[]
  locations?: any[]
  location_connections?: Record<string, string[]>
}

export interface GameData {
  beast_name: string
  inquisitor_name: string
  current_day: number
  current_month: string
  current_year: number
  player_location: string
  health: number
  knowledge: number
  beast_location?: string
  beast_distance?: number
  investigation: {
    rumors: Array<{
      id: string
      location: string
      note: string
      verified: boolean
      category: string
      is_false?: boolean
      is_learned?: boolean
    }>
    secrets: Array<{ id: string; secret: string; category?: string }>
    notes: Array<{ id: string; note: string }>
  }
  wards: Array<{ id: string; name: string }>
  weapons: Array<{ id: string; name: string }>
  rumors_tokens?: Record<string, boolean>
  game_ended: boolean
  victorious: boolean
  game_phase: 'beast-approaches' | 'take-actions' | 'hunt' | 'game-ended'
  actions_remaining: number
  current_round: number
  seed: number
  session_id?: string
  start_time: number
  days_elapsed: number
  investigations_completed: number
  equipment_collected: number
  wounds: number
}

class GameAPI {
  private baseUrl: string

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`
    
    try {
      const response = await fetch(url, {
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
        ...options,
      })

      const data = await response.json().catch(() => null)

      if (!response.ok) {
        const errorData = (data as { success?: boolean; message?: string; detail?: string } | null) ?? {}
        const detail = errorData.message ?? errorData.detail ?? `HTTP ${response.status}: ${response.statusText}`
        return {
          ...errorData,
          success: errorData.success ?? false,
          message: detail,
        } as T
      }

      return data as T
    } catch (error) {
      throw error
    }
  }

  /**
   * Create a new game session
   */
  async createGame(request: CreateGameRequest): Promise<GameResponse> {
    return this.request<GameResponse>('/api/games', {
      method: 'POST',
      body: JSON.stringify(request),
    })
  }

  /**
   * Get current game state
   */
  async getGameState(sessionId: string): Promise<GameResponse> {
    return this.request<GameResponse>(`/api/games/${sessionId}`)
  }

  /**
   * Perform a game action
   */
  async performAction(request: GameActionRequest): Promise<GameResponse> {
    return this.request<GameResponse>('/api/games/action', {
      method: 'POST',
      body: JSON.stringify(request),
    })
  }

  /**
   * Delete a game session
   */
  async deleteGame(sessionId: string): Promise<{ success: boolean; message: string }> {
    return this.request<{ success: boolean; message: string }>(`/api/games/${sessionId}`, {
      method: 'DELETE',
    })
  }

  /**
   * Get all game locations and connections
   */
  async getLocations(): Promise<{
    success: boolean
    locations: any[]
    location_connections: Record<string, string[]>
  }> {
    return this.request('/api/locations')
  }

  /**
   * List all active game sessions (for debugging)
   */
  async listGames(): Promise<{ success: boolean; sessions: string[]; count: number }> {
    return this.request('/api/games')
  }

  // Action helpers

  async movePlayer(sessionId: string, targetLocation: string): Promise<GameResponse> {
    return this.performAction({
      session_id: sessionId,
      action_type: 'move',
      target_location: targetLocation,
    })
  }

  async investigate(sessionId: string): Promise<GameResponse> {
    return this.performAction({
      session_id: sessionId,
      action_type: 'investigate',
    })
  }

  async verifyRumors(sessionId: string): Promise<GameResponse> {
    return this.performAction({
      session_id: sessionId,
      action_type: 'verify',
    })
  }

  async huntBeast(sessionId: string): Promise<GameResponse> {
    return this.performAction({
      session_id: sessionId,
      action_type: 'hunt',
    })
  }

  async completeAction(sessionId: string): Promise<GameResponse> {
    return this.performAction({
      session_id: sessionId,
      action_type: 'complete_action',
    })
  }
}

// Export singleton instance
export const gameAPI = new GameAPI()

// Also export the class for testing
export { GameAPI }