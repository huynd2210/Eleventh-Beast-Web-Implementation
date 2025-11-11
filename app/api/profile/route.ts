import { NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'
import { InquisitorProfile, RunRecord } from '@/types/profile'

interface ProfileFile {
  activeProfileId?: string
  profiles: InquisitorProfile[]
}

const PROFILE_DIR = path.join(process.cwd(), 'data')
const PROFILE_PATH = path.join(PROFILE_DIR, 'profile.json')

function normalizeRun(raw: any, fallbackResult: 'victory' | 'defeat'): RunRecord {
  return {
    id: typeof raw?.id === 'string' ? raw.id : Date.now().toString(36),
    timestamp: typeof raw?.timestamp === 'string' ? raw.timestamp : new Date().toISOString(),
    result: raw?.result === 'defeat' ? 'defeat' : fallbackResult,
    beast_name: typeof raw?.beast_name === 'string' ? raw.beast_name : 'Unknown Beast',
    seed: typeof raw?.seed === 'number' ? raw.seed : undefined,
    rounds: Number.isFinite(raw?.rounds) ? Number(raw.rounds) : 0,
    days_elapsed: Number.isFinite(raw?.days_elapsed) ? Number(raw.days_elapsed) : 0,
    rumors_total: Number.isFinite(raw?.rumors_total) ? Number(raw.rumors_total) : 0,
    rumors_false: Number.isFinite(raw?.rumors_false) ? Number(raw.rumors_false) : 0,
    rumors_verified: Number.isFinite(raw?.rumors_verified) ? Number(raw.rumors_verified) : 0,
    verified_rumors: Array.isArray(raw?.verified_rumors)
      ? raw.verified_rumors.map((vr: any) => ({
          id: typeof vr?.id === 'string' ? vr.id : Date.now().toString(36),
          category: vr?.category === 'ward' || vr?.category === 'weapon' ? vr.category : undefined,
          text: typeof vr?.text === 'string' ? vr.text : '',
        }))
      : [],
    false_rumors: Array.isArray(raw?.false_rumors)
      ? raw.false_rumors.map((fr: any) => ({
          id: typeof fr?.id === 'string' ? fr.id : Date.now().toString(36),
          note: typeof fr?.note === 'string' ? fr.note : '',
        }))
      : [],
  }
}

function normalizeProfile(raw: any): InquisitorProfile {
  const stats = raw?.stats ?? {}
  return {
    id: typeof raw?.id === 'string' ? raw.id : Date.now().toString(36),
    inquisitor_name: typeof raw?.inquisitor_name === 'string' ? raw.inquisitor_name : 'Unknown Inquisitor',
    created_at: typeof raw?.created_at === 'string' ? raw.created_at : new Date().toISOString(),
    updated_at: typeof raw?.updated_at === 'string' ? raw.updated_at : new Date().toISOString(),
    stats: {
      games_played: Number.isFinite(stats.games_played) ? Number(stats.games_played) : 0,
      victories: Number.isFinite(stats.victories) ? Number(stats.victories) : 0,
      defeats: Number.isFinite(stats.defeats) ? Number(stats.defeats) : 0,
      win_rate: Number.isFinite(stats.win_rate) ? Number(stats.win_rate) : 0,
    },
    runs: Array.isArray(raw?.runs)
      ? raw.runs.map((run: any) => normalizeRun(run, run?.result === 'defeat' ? 'defeat' : 'victory'))
      : [],
  }
}

async function readProfileFile(): Promise<ProfileFile> {
  try {
    const file = await fs.readFile(PROFILE_PATH, 'utf-8')
    const data = JSON.parse(file)
    return {
      activeProfileId: data.activeProfileId ?? null,
      profiles: Array.isArray(data.profiles) ? data.profiles.map((profile: any) => normalizeProfile(profile)) : [],
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return { activeProfileId: undefined, profiles: [] }
    }
    throw error
  }
}

async function writeProfileFile(data: ProfileFile) {
  await fs.mkdir(PROFILE_DIR, { recursive: true })
  await fs.writeFile(
    PROFILE_PATH,
    JSON.stringify(
      {
        activeProfileId: data.activeProfileId,
        profiles: data.profiles,
      },
      null,
      2,
    ),
    'utf-8',
  )
}

function createProfile(inquisitorName: string): InquisitorProfile {
  const timestampId = Date.now().toString(36)
  const now = new Date().toISOString()
  return {
    id: timestampId,
    inquisitor_name: inquisitorName,
    created_at: now,
    updated_at: now,
    stats: {
      games_played: 0,
      victories: 0,
      defeats: 0,
      win_rate: 0,
    },
    runs: [],
  }
}

function updateWinRate(profile: InquisitorProfile) {
  const { victories, games_played } = profile.stats
  profile.stats.win_rate = games_played > 0 ? Math.round((victories / games_played) * 100) : 0
}

export async function GET() {
  try {
    const data = await readProfileFile()
    return NextResponse.json({
      success: true,
      profiles: data.profiles,
      activeProfileId: data.activeProfileId ?? null,
    })
  } catch (error) {
    console.error('Failed to read profiles', error)
    return NextResponse.json({ success: false, message: 'Unable to read profiles' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const profileId = typeof body.profileId === 'string' ? body.profileId.trim() : ''
    const inquisitorName = typeof body.inquisitor_name === 'string' ? body.inquisitor_name.trim() : ''
    const setActive = Boolean(body.setActive)

    const data = await readProfileFile()
    let profile: InquisitorProfile | null = null

    if (profileId) {
      profile = data.profiles.find((p) => p.id === profileId) ?? null
      if (!profile) {
        return NextResponse.json(
          { success: false, message: 'Profile not found' },
          { status: 404 },
        )
      }

      if (inquisitorName) {
        profile.inquisitor_name = inquisitorName
        profile.updated_at = new Date().toISOString()
      }
      if (!Array.isArray(profile.runs)) {
        profile.runs = []
      }
    } else if (inquisitorName) {
      profile = createProfile(inquisitorName)
      data.profiles.push(profile)
    } else {
      return NextResponse.json(
        { success: false, message: 'inquisitor_name or profileId is required' },
        { status: 400 },
      )
    }

    if (setActive && profile) {
      data.activeProfileId = profile.id
    }

    await writeProfileFile(data)

    return NextResponse.json({
      success: true,
      profile,
      profiles: data.profiles,
      activeProfileId: data.activeProfileId ?? null,
    })
  } catch (error) {
    console.error('Failed to persist profile', error)
    return NextResponse.json({ success: false, message: 'Unable to save profile' }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const profileId = typeof body.profileId === 'string' ? body.profileId.trim() : ''
    const result = body.result === 'victory' || body.result === 'defeat' ? body.result : null

    if (!profileId) {
      return NextResponse.json(
        { success: false, message: 'profileId is required' },
        { status: 400 },
      )
    }

    if (!result) {
      return NextResponse.json(
        { success: false, message: 'result must be either "victory" or "defeat"' },
        { status: 400 },
      )
    }

    const data = await readProfileFile()
    const profile = data.profiles.find((p) => p.id === profileId)

    if (!profile) {
      return NextResponse.json(
        { success: false, message: 'Profile not found' },
        { status: 404 },
      )
    }

    profile.stats.games_played += 1
    if (result === 'victory') {
      profile.stats.victories += 1
    } else {
      profile.stats.defeats += 1
    }
    updateWinRate(profile)
    profile.updated_at = new Date().toISOString()

    if (!Array.isArray(profile.runs)) {
      profile.runs = []
    }

    const runPayload = body.run
    if (runPayload && typeof runPayload === 'object') {
      const runRecord: RunRecord = normalizeRun({ ...runPayload, result }, result)
      profile.runs = [runRecord, ...profile.runs].slice(0, 50)
    }

    await writeProfileFile(data)

    return NextResponse.json({
      success: true,
      profile,
      profiles: data.profiles,
      activeProfileId: data.activeProfileId ?? null,
    })
  } catch (error) {
    console.error('Failed to update profile', error)
    return NextResponse.json({ success: false, message: 'Unable to update profile' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const profileId = typeof body.profileId === 'string' ? body.profileId.trim() : ''

    if (!profileId) {
      return NextResponse.json(
        { success: false, message: 'profileId is required' },
        { status: 400 },
      )
    }

    const data = await readProfileFile()
    const originalLength = data.profiles.length
    data.profiles = data.profiles.filter((profile) => profile.id !== profileId)

    if (data.profiles.length === originalLength) {
      return NextResponse.json(
        { success: false, message: 'Profile not found' },
        { status: 404 },
      )
    }

    if (data.activeProfileId === profileId) {
      data.activeProfileId = data.profiles[0]?.id ?? null
    }

    await writeProfileFile(data)

    return NextResponse.json({
      success: true,
      profiles: data.profiles,
      activeProfileId: data.activeProfileId ?? null,
    })
  } catch (error) {
    console.error('Failed to delete profile', error)
    return NextResponse.json({ success: false, message: 'Unable to delete profile' }, { status: 500 })
  }
}

