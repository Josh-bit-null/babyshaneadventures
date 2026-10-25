import { describe, expect, it } from 'vitest'
import { parseScreenTime } from './ocr.js'
import { computeGain, distanceBetween, FAR_DISTANCE, NEAR_DISTANCE } from './spatialAudio.js'
import { pushSample, sampleEntity } from '../net/interpolation.js'
import { resolveMovement } from '../components/world/collision.js'

describe('screen-time parsing', () => {
  it('converts hour and minute totals into integer minutes', () => {
    expect(parseScreenTime('Screen time 4h 12m').minutes).toBe(252)
  })

  it('reads clock-style totals only when identified as a total', () => {
    expect(parseScreenTime('Total screen time 3:45').minutes).toBe(225)
  })

  it('does not mistake unrelated numbers for screen time', () => {
    expect(parseScreenTime('Messages 21, Photos 8').minutes).toBeNull()
  })
})

describe('remote transform interpolation', () => {
  it('glides between the samples around the delayed render time', () => {
    const samples = [
      { t: 1, p: [0, 0, 0], q: [0, 0, 0, 1] },
      { t: 1.2, p: [2, 0, 0], q: [0, 0, 0, 1] },
    ]
    const halfway = sampleEntity(samples, 1.22, 120)
    expect(halfway.p[0]).toBeCloseTo(1)
  })

  it('retains a pair of samples for interpolation and keeps the newest one', () => {
    const samples = pushSample(
      [{ t: 0, p: [0, 0, 0], q: [0, 0, 0, 1] }],
      { t: 4, p: [1, 0, 0], q: [0, 0, 0, 1] },
      4,
    )
    expect(samples).toHaveLength(2)
    expect(samples.at(-1).t).toBe(4)
  })
})

describe('house entry movement', () => {
  it('allows the player to walk from the porch through the centered doorway', () => {
    const moved = resolveMovement(0, 6, 0, 2)
    expect(moved.x).toBeCloseTo(0)
    expect(moved.z).toBeCloseTo(2)
  })
})

describe('spatial audio distance', () => {
  it('measures full 3D separation and fades at the configured limits', () => {
    expect(distanceBetween([0, 0, 0], [0, 3, 4])).toBe(5)
    expect(computeGain(NEAR_DISTANCE)).toBeGreaterThan(0)
    expect(computeGain(FAR_DISTANCE)).toBe(0)
  })
})
