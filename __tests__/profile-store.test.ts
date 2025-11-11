import { describe, expect, it } from "vitest"
import { sanitizeProfileData, normalizeRun } from "@/lib/profile-store"

describe("profile-store sanitizeProfileData", () => {
  it("returns null when payload is invalid", () => {
    expect(sanitizeProfileData(null)).toBeNull()
    expect(sanitizeProfileData(undefined)).toBeNull()
    expect(sanitizeProfileData({})).toBeNull()
  })

  it("normalizes profiles and ensures activeProfileId matches an existing profile", () => {
    const payload = {
      activeProfileId: "missing",
      profiles: [
        {
          inquisitor_name: "Test Inquisitor",
          stats: { games_played: 2, victories: 1, defeats: 1, win_rate: 50 },
          runs: [
            {
              beast_name: "The Shade",
              result: "victory",
              rumors_verified: 2,
              verified_rumors: [
                { id: "vr-1", category: "ward", text: "Silver dagger" },
                { id: "vr-2", category: "weapon", text: "Consecrated blade" },
              ],
              false_rumors: [],
              journal: "Triumph in the moonlight.",
            },
          ],
        },
      ],
    }

    const sanitized = sanitizeProfileData(payload)
    expect(sanitized).not.toBeNull()
    expect(sanitized?.profiles).toHaveLength(1)
    expect(sanitized?.activeProfileId).toBeDefined()
    if (!sanitized) return
    expect(sanitized.activeProfileId).toBe(sanitized.profiles[0].id)
    expect(sanitized.profiles[0].runs[0].journal).toBe("Triumph in the moonlight.")
  })

  it("preserves explicit activeProfileId when it exists", () => {
    const baseRun = normalizeRun(
      {
        id: "run-1",
        beast_name: "The Wraith",
        result: "defeat",
        rumors_verified: 0,
        verified_rumors: [],
        false_rumors: [],
      },
      "defeat",
    )

    const profileId = "profile-123"
    const payload = {
      activeProfileId: profileId,
      profiles: [
        {
          id: profileId,
          inquisitor_name: "Keeper",
          runs: [baseRun],
        },
      ],
    }

    const sanitized = sanitizeProfileData(payload)
    expect(sanitized).not.toBeNull()
    expect(sanitized?.activeProfileId).toBe(profileId)
  })
})

