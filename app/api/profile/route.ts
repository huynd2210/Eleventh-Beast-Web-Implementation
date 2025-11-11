import { NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'
import { InquisitorProfile } from '@/types/profile'

interface ProfileFile {
  activeProfileId?: string
  profiles: InquisitorProfile[]
}

const PROFILE_DIR = path.join(process.cwd(), 'data')
const PROFILE_PATH = path.join(PROFILE_DIR, 'profile.json')

async function readProfileFile(): Promise<ProfileFile> {
  try {
    const file = await fs.readFile(PROFILE_PATH, 'utf-8')
    const data = JSON.parse(file)
    return {
      activeProfileId: data.activeProfileId ?? null,
      profiles: Array.isArray(data.profiles) ? data.profiles : [],
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

