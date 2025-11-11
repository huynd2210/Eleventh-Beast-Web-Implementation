import 'server-only'
import { randomUUID } from 'node:crypto'
import seedrandom from 'seedrandom'

type Prng = seedrandom.prng

export enum GamePhase {
  BEAST_APPROACHES = 'beast-approaches',
  TAKE_ACTIONS = 'take-actions',
  HUNT = 'hunt',
  GAME_ENDED = 'game-ended',
}

export interface Location {
  id: string
  name: string
  x: number
  y: number
}

type RumorCategory = 'ward' | 'weapon'

export interface Rumor {
  id: string
  location: string
  note: string
  verified: boolean
  is_false: boolean
  is_learned: boolean
  category: RumorCategory
}

export interface Secret {
  id: string
  secret: string
  category: RumorCategory
}

export interface GameLogEntry {
  id: string
  message: string
  timestamp: number
}

export interface GameData {
  beast_name: string
  inquisitor_name: string
  current_day: number
  current_month: string
  current_year: number
  seed: number
  player_location: string
  health: number
  knowledge: number
  wounds: number
  beast_location: string | null
  beast_distance: number | null
  investigation: {
    rumors: Rumor[]
    secrets: Secret[]
    notes: Array<{ id: string; note: string }>
  }
  wards: Array<{ id: string; name: string }>
  weapons: Array<{ id: string; name: string }>
  rumors_tokens: Record<string, boolean>
  game_ended: boolean
  victorious: boolean
  game_phase: GamePhase
  actions_remaining: number
  current_round: number
  start_time: number
  days_elapsed: number
  investigations_completed: number
  equipment_collected: number
  session_id?: string
}

export interface GameResponse {
  success: boolean
  message: string
  game_data?: GameData
  game_log?: GameLogEntry[]
  locations?: Location[]
  location_connections?: Record<string, string[]>
  dice_rolls?: number[]
  lowest_roll?: number
}

const MONTH_SEQUENCE = ['May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'] as const

export const LOCATIONS: Location[] = [
  { id: 'I', name: 'The Royal Exchange', x: 50, y: 20 },
  { id: 'II', name: 'All-Hallows-The-Great', x: 30, y: 40 },
  { id: 'III', name: 'Billingsgate Dock', x: 70, y: 35 },
  { id: 'IV', name: 'London Bridge', x: 60, y: 55 },
  { id: 'V', name: "St. Thomas' Hospital", x: 40, y: 65 },
  { id: 'VI', name: 'Coxes Wharf', x: 75, y: 70 },
  { id: 'VII', name: 'Marshalsea Prison', x: 35, y: 85 },
  { id: 'VIII', name: 'Burying Ground', x: 55, y: 90 },
]

export const LOCATION_CONNECTIONS: Record<string, string[]> = {
  I: ['II', 'III'],
  II: ['I', 'IV'],
  III: ['I', 'IV'],
  IV: ['II', 'III', 'V'],
  V: ['IV', 'VI', 'VIII', 'VII'],
  VI: ['V'],
  VII: ['V', 'VIII'],
  VIII: ['V', 'VII'],
}

const CARD_VALUES = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'] as const
type CardValue = typeof CARD_VALUES[number]

type SuitKey = 'hearts' | 'diamonds' | 'spades' | 'clubs'

const FIRST_NAMES = ['Agnes', 'Bartholomew', 'Catherine', 'William', 'Thomas', 'Isolde']
const SURNAMES = ['Aldworth', 'Bentham', 'Clarke', 'Gibbes', 'Milward', 'Huxham']

const RUMOR_METHODS: Array<{ label: string; phrase: string }> = [
  { label: 'Witnessed it', phrase: 'claims to have witnessed the Beast and shares:' },
  { label: 'Mysterious note', phrase: 'reveals a mysterious note that reads:' },
  { label: 'Read in a book', phrase: 'recites from an old tome:' },
  { label: 'Found an artifact', phrase: 'describes an artifact that implies:' },
  { label: 'Heard rumor', phrase: 'whispers that:' },
  { label: 'Had a dream', phrase: 'describes a chilling dream:' },
]

interface SuitDetailConfig {
  category: RumorCategory
  formatter: (detail: string) => string
  details: Record<CardValue, string>
}

const SUIT_DETAILS: Record<SuitKey, SuitDetailConfig> = {
  hearts: {
    category: 'ward',
    formatter: (detail) => `The Beast's appearance: ${detail}.`,
    details: {
      '2': 'Large, sparkling eyes',
      '3': 'Body covered in thick fur',
      '4': 'Grunting pig snout',
      '5': 'Foul odor of rotting fish',
      '6': 'Head like a goat',
      '7': 'Massive antlers of a stag',
      '8': 'Runs on all fours like a dog',
      '9': 'Powerful, barbed tail',
      '10': 'Giant bat wings',
      J: 'Long hands with sharp claws',
      Q: 'Tendrils that whip and lash',
      K: "Jaws larger than a lion's",
      A: 'Feet with talons like an eagle',
    },
  },
  diamonds: {
    category: 'weapon',
    formatter: (detail) => `The Beast's behavior: ${detail}.`,
    details: {
      '2': 'Stealthy',
      '3': 'Blasphemous',
      '4': 'Lycanthropic',
      '5': 'Erratic',
      '6': 'Howling',
      '7': 'Nocturnal',
      '8': 'Vicious',
      '9': 'Furtive',
      '10': 'Shapeshifting',
      J: 'Predatory',
      Q: 'Stalking',
      K: 'Hidden',
      A: 'Invisible',
    },
  },
  spades: {
    category: 'ward',
    formatter: (detail) => `Ward against the Beast: ${detail}.`,
    details: {
      '2': 'Rosemary & sage',
      '3': 'Silver mirror',
      '4': 'Bell made of lead',
      '5': 'Black salt',
      '6': 'String of acorns',
      '7': 'Running water',
      '8': 'Iron horseshoe',
      '9': 'Golden amulet',
      '10': "Criminal's hand",
      J: 'Wolf bones',
      Q: 'Chalked circle',
      K: 'Glass witch ball',
      A: 'Relic of a saint',
    },
  },
  clubs: {
    category: 'weapon',
    formatter: (detail) => `Weapon or tactic against the Beast: ${detail}.`,
    details: {
      '2': 'Bladed',
      '3': 'Cold iron',
      '4': 'Lead shot',
      '5': 'Piercing',
      '6': 'View with mirror',
      '7': 'Rowan tree wood',
      '8': 'Douse with water',
      '9': 'Fire',
      '10': 'Bludgeoning',
      J: 'Snare trap',
      Q: 'Direct sunlight',
      K: 'Ancient sword',
      A: 'Loud clanging',
    },
  },
}

const ROMAN_NUMERALS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII']

const gameSessions = new Map<string, GameEngine>()
const MAX_WOUNDS = 3

const generateId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8)

export class GameEngine {
  private readonly rng: Prng
  private readonly gameLog: GameLogEntry[]
  private gamePhase: GamePhase
  private gameData: GameData

  constructor(beastName: string, inquisitorName: string, seed?: number) {
    const resolvedSeed = typeof seed === 'number' ? seed : Date.now()
    this.rng = seedrandom(`${resolvedSeed}`)
    this.gamePhase = GamePhase.BEAST_APPROACHES
    this.gameData = {
      beast_name: beastName,
      inquisitor_name: inquisitorName,
      current_day: 13,
      current_month: 'May',
      current_year: 1746,
      seed: resolvedSeed,
      player_location: 'II',
      health: MAX_WOUNDS,
      knowledge: 0,
      wounds: 0,
      beast_location: null,
      beast_distance: null,
      investigation: {
        rumors: [],
        secrets: [],
        notes: [],
      },
      wards: [],
      weapons: [],
      rumors_tokens: {},
      game_ended: false,
      victorious: false,
      game_phase: GamePhase.BEAST_APPROACHES,
      actions_remaining: 2,
      current_round: 1,
      start_time: Date.now(),
      days_elapsed: 0,
      investigations_completed: 0,
      equipment_collected: 0,
    }

    this.gameLog = [
      {
        id: generateId(),
        message: `${inquisitorName} begins their investigation at All-Hallows-The-Great on May 13, 1746.`,
        timestamp: Date.now(),
      },
    ]

    this.executeBeastApproachesPhase()
    if (this.gamePhase !== GamePhase.HUNT) {
      this.gamePhase = GamePhase.TAKE_ACTIONS
    }

    this.updateHealth()
  }

  private generateRumor(existingNotes: Set<string>): Rumor {
    const suitKeys: SuitKey[] = ['hearts', 'diamonds', 'spades', 'clubs']
    let attempts = 0
    let note = ''
    let category: RumorCategory = 'appearance'

    while (attempts < 10) {
      const firstName = this.randomChoice(FIRST_NAMES)
      const surname = this.randomChoice(SURNAMES)
      const method = this.randomChoice(RUMOR_METHODS)
      const suit = this.randomChoice(suitKeys)
      const cardValue = this.randomChoice(CARD_VALUES as unknown as CardValue[])
      const suitConfig = SUIT_DETAILS[suit]
      const detail = suitConfig.details[cardValue] ?? suitConfig.details['2']
      const detailSentence = suitConfig.formatter(detail)

      note = `${firstName} ${surname} (${method.label}) ${method.phrase} ${detailSentence}`
      category = suitConfig.category

      if (!existingNotes.has(note)) {
        break
      }
      attempts += 1
    }

    return {
      id: generateId(),
      location: this.gameData.player_location,
      note,
      verified: false,
      is_false: false,
      is_learned: false,
      category,
    }
  }

  createGameStateResponse(message: string): GameResponse {
    return {
      success: true,
      message,
      game_data: this.getSerializableGameData(),
      game_log: [...this.gameLog],
    }
  }

  getGameState(): GameResponse {
    return {
      success: true,
      message: 'Game state retrieved',
      game_data: this.getSerializableGameData(),
      game_log: [...this.gameLog],
      locations: LOCATIONS.map((location) => ({ ...location })),
      location_connections: { ...LOCATION_CONNECTIONS },
    }
  }

  movePlayer(targetLocation: string): GameResponse {
    if (!LOCATION_CONNECTIONS[this.gameData.player_location]?.includes(targetLocation)) {
      return {
        success: false,
        message: `Cannot move to ${targetLocation} from ${this.gameData.player_location}. Must be adjacent location.`,
        game_data: this.getSerializableGameData(),
        game_log: [...this.gameLog],
      }
    }

    const locationName = this.findLocationName(targetLocation)
    this.gameData.player_location = targetLocation
    this.addToLog(`${this.gameData.inquisitor_name} moves to ${locationName} (Location ${targetLocation}).`)

    if (this.gameData.beast_location === targetLocation) {
      this.addToLog(
        `Caution! ${this.gameData.beast_name} is present at ${locationName} (Location ${targetLocation}). Prepare to hunt.`,
      )
    }

    return this.createGameStateResponse(`Moved to ${locationName}`)
  }

  investigate(): GameResponse {
    if (this.gameData.actions_remaining <= 0) {
      return {
        success: false,
        message: 'No actions remaining',
        game_data: this.getSerializableGameData(),
        game_log: [...this.gameLog],
      }
    }

    if (!this.gameData.rumors_tokens[this.gameData.player_location]) {
      return {
        success: false,
        message: 'No Rumor Token at this location to investigate!',
        game_data: this.getSerializableGameData(),
        game_log: [...this.gameLog],
      }
    }

    delete this.gameData.rumors_tokens[this.gameData.player_location]
    const locationName = this.findLocationName(this.gameData.player_location)

    const existingNotes = new Set(this.gameData.investigation.rumors.map((rumor) => rumor.note))
    const newRumor = this.generateRumor(existingNotes)

    this.gameData.investigation.rumors.push(newRumor)
    this.gameData.investigations_completed += 1
    this.addToLog(
      `${this.gameData.inquisitor_name} investigates at ${locationName} (Location ${this.gameData.player_location}) and uncovers a rumor: "${newRumor.note}"`,
    )

    return this.createGameStateResponse('Investigation complete. New rumor added.')
  }

  verifyRumors(): GameResponse {
    if (this.gameData.player_location !== 'II') {
      return {
        success: false,
        message: 'You can only verify rumors at All-Hallows-The-Great (Location II)!',
        game_data: this.getSerializableGameData(),
        game_log: [...this.gameLog],
      }
    }

    if (this.gameData.actions_remaining <= 0) {
      return {
        success: false,
        message: 'No actions remaining',
        game_data: this.getSerializableGameData(),
        game_log: [...this.gameLog],
      }
    }

    const unverified = this.gameData.investigation.rumors.filter((rumor) => !rumor.verified)
    if (unverified.length === 0) {
      return {
        success: false,
        message: 'You have no unverified rumors to verify!',
        game_data: this.getSerializableGameData(),
        game_log: [...this.gameLog],
      }
    }

    let falseCount = 0
    let learnedCount = 0

    for (const rumor of unverified) {
      const roll = this.rollDie(6, `Verify Rumor "${this.truncateText(rumor.note)}"`)
      rumor.verified = true

      if (roll >= 5) {
        rumor.is_false = true
        rumor.is_learned = false
        this.addToLog(`Rumor verification failed: "${rumor.note}" is marked as a false rumor.`)
        falseCount += 1
      } else {
        rumor.is_false = false
        rumor.is_learned = true
        this.addToLog(`Rumor verified as truth: "${rumor.note}" becomes a Learned Secret and provides insight into the Beast.`)
        learnedCount += 1
      }
    }

    for (const rumor of this.gameData.investigation.rumors) {
      if (rumor.is_learned && !this.gameData.investigation.secrets.some((secret) => secret.id === rumor.id)) {
        const newSecret: Secret = {
          id: rumor.id,
          secret: rumor.note,
          category: rumor.category,
        }
        this.gameData.investigation.secrets.push(newSecret)

        if (rumor.category === 'ward' && !this.gameData.wards.some((ward) => ward.id === rumor.id)) {
          this.gameData.wards.push({ id: rumor.id, name: rumor.note })
        }

        if (rumor.category === 'weapon' && !this.gameData.weapons.some((weapon) => weapon.id === rumor.id)) {
          this.gameData.weapons.push({ id: rumor.id, name: rumor.note })
        }
      }
    }

    this.gameData.equipment_collected = this.gameData.wards.length + this.gameData.weapons.length
    this.addToLog(
      `${this.gameData.inquisitor_name} completes verification at All-Hallows-The-Great. ${learnedCount} truth(s) learned, ${falseCount} false rumor(s) dismissed.`,
    )

    return this.createGameStateResponse(
      `Verification complete. ${learnedCount} truths learned, ${falseCount} false rumors dismissed.`,
    )
  }

  huntBeast(): GameResponse {
    if (this.gameData.beast_location !== this.gameData.player_location) {
      return {
        success: false,
        message: 'You must be in the same location as the Beast to hunt!',
        game_data: this.getSerializableGameData(),
        game_log: [...this.gameLog],
      }
    }

    if (this.gameData.actions_remaining <= 0) {
      return {
        success: false,
        message: 'No actions remaining',
        game_data: this.getSerializableGameData(),
        game_log: [...this.gameLog],
      }
    }

    const learnedSecrets = this.gameData.investigation.secrets
    const diceCount = Math.min(5, learnedSecrets.length)

    if (diceCount === 0) {
      this.gameData.wounds += 1
      this.updateHealth()
      this.addToLog('You have no dice for the hunt! You take 1 wound and the Beast survives.')
      if (this.gameData.wounds >= 3) {
        this.endGame(false)
      }

      if (!this.gameData.game_ended) {
        this.gamePhase = GamePhase.TAKE_ACTIONS
      }

      return {
        success: true,
        message: 'Hunt failed. You take 1 wound with no dice.',
        game_data: this.getSerializableGameData(),
        game_log: [...this.gameLog],
      }
    }

    const diceRolls = Array.from({ length: diceCount }, (_, index) =>
      this.rollDie(6, `Hunt (${index + 1}/${diceCount})`),
    )
    const lowestRoll = Math.min(...diceRolls)
    let outcomeMessage = ''

    if (lowestRoll <= 2) {
      this.addToLog(`HUNT SUCCESS! ${this.gameData.inquisitor_name} has slain the ${this.gameData.beast_name}!`)
      this.endGame(true)
      outcomeMessage = 'Victory! Beast slain!'
    } else if (lowestRoll <= 4) {
      this.gameData.wounds += 1
      this.updateHealth()
      this.addToLog(`The Beast survives! ${this.gameData.inquisitor_name} takes 1 wound.`)
      outcomeMessage = 'Beast survives. You take 1 wound.'
      if (this.gameData.wounds >= 3) {
        this.endGame(false)
      }
    } else {
      this.gameData.wounds += 2
      this.updateHealth()
      this.addToLog(`The Beast is unharmed! ${this.gameData.inquisitor_name} takes 2 wounds.`)
      outcomeMessage = 'Beast unharmed. You take 2 wounds.'
      if (this.gameData.wounds >= 3) {
        this.endGame(false)
      }
    }

    if (!this.gameData.game_ended) {
      this.gamePhase = GamePhase.TAKE_ACTIONS
    }

    return {
      success: true,
      message: `Hunt complete. ${outcomeMessage}`,
      game_data: this.getSerializableGameData(),
      game_log: [...this.gameLog],
      dice_rolls: diceRolls,
      lowest_roll: lowestRoll,
    }
  }

  completeAction(): GameResponse {
    this.gameData.actions_remaining -= 1

    if (this.gameData.actions_remaining <= 0) {
      return this.advanceDay()
    }

    return {
      success: true,
      message: `Actions remaining: ${this.gameData.actions_remaining}`,
      game_data: this.getSerializableGameData(),
      game_log: [...this.gameLog],
    }
  }

  private advanceDay(): GameResponse {
    this.addToLog('All actions for this turn have been used. Proceeding to The Beast Approaches phase...')
    this.addToLog(`[Round ${this.gameData.current_round}] Day ${this.gameData.current_day} of ${this.gameData.current_month}. The round has ended.`)

    this.gameData.current_day += 1

    if (this.gameData.current_day > 31) {
      this.gameData.current_day = 1
      const currentIndex = MONTH_SEQUENCE.indexOf(this.gameData.current_month as (typeof MONTH_SEQUENCE)[number])
      const nextIndex = currentIndex >= 0 ? (currentIndex + 1) % MONTH_SEQUENCE.length : 0
      this.gameData.current_month = MONTH_SEQUENCE[nextIndex]
    }

    this.gameData.current_round += 1
    this.gameData.days_elapsed += 1
    this.gameData.actions_remaining = 2
    this.gamePhase = GamePhase.BEAST_APPROACHES

    this.addToLog(
      `[Round ${this.gameData.current_round}] Day ${this.gameData.current_day} of ${this.gameData.current_month}. The investigation continues...`,
    )

    this.executeBeastApproachesPhase()

    const beastHere =
      this.gameData.beast_location && this.gameData.beast_location === this.gameData.player_location
    if (this.gamePhase !== GamePhase.HUNT && beastHere) {
      const locationName = this.findLocationName(this.gameData.player_location)
      this.addToLog(
        `SURPRISE! ${this.gameData.beast_name} is here with you at ${locationName} (Location ${this.gameData.player_location})! A hunt is triggered!`,
      )
      this.gamePhase = GamePhase.HUNT

      return {
        success: true,
        message: 'The Beast is upon you! A hunt is triggered!',
        game_data: this.getSerializableGameData(),
        game_log: [...this.gameLog],
      }
    }

    if (this.gamePhase !== GamePhase.HUNT) {
      this.gamePhase = GamePhase.TAKE_ACTIONS
    }

    return {
      success: true,
      message: 'New day begins! Beast approaches phase completed.',
      game_data: this.getSerializableGameData(),
      game_log: [...this.gameLog],
    }
  }

  private executeBeastApproachesPhase(): void {
    const roll = this.rollDie(8, 'The Beast Approaches (Location)')
    const targetLocation = ROMAN_NUMERALS[roll - 1]
    const locationName = this.findLocationName(targetLocation)

    this.addToLog(
      `THE BEAST APPROACHES - A whisper on the wind... The ${this.gameData.beast_name} stirs at ${locationName} (Location ${targetLocation}).`,
    )

    const beastAlreadyOnTile = this.gameData.beast_location === targetLocation
    const hasRumorToken = Boolean(this.gameData.rumors_tokens[targetLocation])
    const beastCurrentlyOnMap = Boolean(this.gameData.beast_location)

    if (hasRumorToken) {
      if (!beastCurrentlyOnMap) {
        this.gameData.beast_location = targetLocation
        this.gameData.beast_distance = this.calculateDistance(this.gameData.player_location, targetLocation)

        this.addToLog(
          `The Beast has ARRIVED! ${this.gameData.beast_name} materializes at ${locationName} (Location ${targetLocation})!`,
        )
      } else if (!beastAlreadyOnTile) {
        this.addToLog(
          `The rumor at ${locationName} (Location ${targetLocation}) intensifies, but the Beast is already on the hunt elsewhere.`,
        )
      }
    } else {
      this.gameData.rumors_tokens[targetLocation] = true
      if (!beastCurrentlyOnMap) {
        this.addToLog(`A Rumor Token appears at ${locationName} (Location ${targetLocation}).`)
        return
      }
    }

    if (this.gameData.beast_location === targetLocation && this.gameData.player_location === targetLocation) {
      this.addToLog(
        `SURPRISE! The Beast is here with you at ${locationName} (Location ${targetLocation})! A hunt is triggered!`,
      )
      this.gamePhase = GamePhase.HUNT
      return
    }

    if (this.gameData.beast_location) {
      const moveRoll = this.rollDie(6, 'The Beast Approaches (Movement)')
      if (moveRoll >= 5) {
        this.addToLog('The Beast moves closer... It approaches your location!')
        this.moveBeastCloser()

        if (this.gameData.player_location === this.gameData.beast_location) {
          this.addToLog(
            `SURPRISE! The Beast is here with you at ${locationName} (Location ${targetLocation})! A hunt is triggered!`,
          )
          this.gamePhase = GamePhase.HUNT
        }
      }
    }
  }

  private moveBeastCloser(): void {
    const { beast_location, player_location } = this.gameData
    if (!beast_location) {
      return
    }

    const path = this.findPath(beast_location, player_location)
    if (path.length === 0) {
      // No path found; beast stays put
      return
    }

    if (path.length === 2) {
      // Beast is adjacent; moving onto player's location triggers hunt
      this.gameData.beast_location = player_location
      this.gameData.beast_distance = 0
      this.addToLog('The Beast lunges onto your location!')
      this.gamePhase = GamePhase.HUNT
      return
    }

    if (path.length > 2) {
      const nextStep = path[1] ?? beast_location
      this.gameData.beast_location = nextStep
      this.gameData.beast_distance = path.length - 2
    }
  }

  private calculateDistance(from: string, to: string): number {
    if (from === to) {
      return 0
    }

    const path = this.findPath(from, to)
    return path.length > 0 ? path.length - 1 : -1
  }

  private findPath(from: string, to: string): string[] {
    if (from === to) {
      return [from]
    }

    const queue: Array<{ location: string; path: string[] }> = [{ location: from, path: [from] }]
    const visited = new Set<string>()

    while (queue.length > 0) {
      const { location, path } = queue.shift()!
      if (visited.has(location)) {
        continue
      }
      visited.add(location)

      if (location === to) {
        return path
      }

      for (const neighbor of LOCATION_CONNECTIONS[location] ?? []) {
        if (!visited.has(neighbor)) {
          queue.push({ location: neighbor, path: [...path, neighbor] })
        }
      }
    }

    return []
  }

  private getSerializableGameData(): GameData {
    this.updateHealth()
    return {
      ...this.gameData,
      beast_location: this.gameData.beast_location ?? null,
      beast_distance: this.gameData.beast_distance ?? null,
      rumors_tokens: { ...this.gameData.rumors_tokens },
      investigation: {
        rumors: this.gameData.investigation.rumors.map((rumor) => ({ ...rumor })),
        secrets: this.gameData.investigation.secrets.map((secret) => ({ ...secret })),
        notes: this.gameData.investigation.notes.map((note) => ({ ...note })),
      },
      wards: this.gameData.wards.map((ward) => ({ ...ward })),
      weapons: this.gameData.weapons.map((weapon) => ({ ...weapon })),
      game_phase: this.gamePhase,
    }
  }

  private addToLog(message: string): void {
    this.gameLog.push({
      id: generateId(),
      message: `[Round ${this.gameData.current_round}] ${message}`,
      timestamp: Date.now(),
    })
  }

  private endGame(victory: boolean): void {
    this.gameData.game_ended = true
    this.gameData.victorious = victory
    this.gamePhase = GamePhase.GAME_ENDED

    if (victory) {
      this.addToLog(`VICTORY! ${this.gameData.inquisitor_name} has defeated ${this.gameData.beast_name}!`)
    } else {
      this.addToLog(`DEFEAT! ${this.gameData.inquisitor_name} has fallen in combat.`)
    }
  }

  private updateHealth(): void {
    this.gameData.health = Math.max(0, MAX_WOUNDS - this.gameData.wounds)
  }

  private logRoll(sides: number, result: number, context?: string): void {
    const contextPart = context ? ` (${context})` : ''
    this.addToLog(`Roll 1d${sides}${contextPart} - Result: ${result}`)
  }

  private truncateText(text: string, maxLength = 60): string {
    if (text.length <= maxLength) {
      return text
    }
    return `${text.slice(0, Math.max(0, maxLength - 3))}...`
  }

  private rollDie(sides: number, context?: string): number {
    const result = Math.floor(this.rng() * sides) + 1
    this.logRoll(sides, result, context)
    return result
  }

  private findLocationName(id: string): string {
    return LOCATIONS.find((location) => location.id === id)?.name ?? 'Unknown'
  }

  private randomChoice<T>(items: T[]): T {
    return items[Math.floor(this.rng() * items.length)]
  }
}

export const createGameSession = (beastName: string, inquisitorName: string, seed?: number) => {
  const engine = new GameEngine(beastName, inquisitorName, seed)
  const sessionId = randomUUID()
  gameSessions.set(sessionId, engine)
  return { sessionId, engine }
}

export const getGameSession = (sessionId: string) => gameSessions.get(sessionId) ?? null

export const deleteGameSession = (sessionId: string) => gameSessions.delete(sessionId)

export const listSessions = () => ({
  success: true,
  sessions: Array.from(gameSessions.keys()),
  count: gameSessions.size,
})

export const getLocationsData = () => ({
  success: true,
  locations: LOCATIONS.map((location) => ({ ...location })),
  location_connections: { ...LOCATION_CONNECTIONS },
})

export type GameEngineInstance = InstanceType<typeof GameEngine>

