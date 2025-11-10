import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import { GameEngine } from '../lib/server/game-engine'

const ROMAN_LOCATIONS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII']

const getGameData = (engine: GameEngine) => (engine as unknown as { gameData: any }).gameData

describe('GameEngine', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2024-01-01T00:00:00Z'))
  })

  it('Given multiple investigations without exhausting rumors, when investigating repeatedly, then each rumor is unique', () => {
    // Given
    const engine = new GameEngine('Test Beast', 'Investigator', 12345)
    const gameData = getGameData(engine)
    const discoveredNotes = new Set<string>()

    for (const location of ROMAN_LOCATIONS) {
      gameData.player_location = location
      gameData.rumors_tokens[location] = true
      gameData.actions_remaining = 2

      // When
      const response = engine.investigate()

      // Then
      expect(response.success).toBe(true)
      const latestRumor = gameData.investigation.rumors.at(-1)
      expect(latestRumor).toBeTruthy()
      expect(discoveredNotes.has(latestRumor.note)).toBe(false)
      discoveredNotes.add(latestRumor.note)
    }

    expect(discoveredNotes.size).toBe(gameData.investigation.rumors.length)
  })

  it('Given learned secrets, when hunting the beast, then the number of dice equals the secrets count', () => {
    // Given
    const engine = new GameEngine('Test Beast', 'Hunter', 999)
    const gameData = getGameData(engine)
    gameData.beast_location = gameData.player_location
    gameData.investigation.secrets = Array.from({ length: 4 }).map((_, index) => ({
      id: `secret-${index}`,
      secret: `Ancient Secret ${index}`,
      category: index % 2 === 0 ? 'ward' : 'weapon',
    }))

    // When
    const response = engine.huntBeast()

    // Then
    expect(response.success).toBe(true)
    expect(response.dice_rolls).toBeDefined()
    expect(response.dice_rolls?.length).toBe(4)
  })

  it('Given the beast and player are apart, when the beast moves closer, then it advances only one location', () => {
    // Given
    const engine = new GameEngine('Test Beast', 'Hunter', 2024)
    const gameData = getGameData(engine)
    gameData.beast_location = 'VIII'
    gameData.player_location = 'IV'
    gameData.rumors_tokens['VIII'] = true

    // When
    ;(engine as unknown as { moveBeastCloser: () => void }).moveBeastCloser()

    // Then
    expect(gameData.beast_location).toBe('V')
    expect(gameData.beast_distance).toBe(1)
  })
})



