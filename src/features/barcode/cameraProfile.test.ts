import { describe, expect, it, vi } from 'vitest'
import { applyBarcodeCameraProfile } from './cameraProfile'

function cameraTrack(capabilities: Record<string, unknown>, applyConstraints = vi.fn().mockResolvedValue(undefined)) {
  return {
    applyConstraints,
    getCapabilities: () => capabilities
  } as unknown as MediaStreamTrack
}

describe('applyBarcodeCameraProfile', () => {
  it('requests continuous close focus and moderate zoom when all are available', async () => {
    const track = cameraTrack({ focusMode: ['continuous'], focusDistance: { min: 0.05, max: 2, step: 0.01 }, zoom: { min: 1, max: 3, step: 0.25 } })

    expect(await applyBarcodeCameraProfile(track)).toBe(true)
    expect(track.applyConstraints).toHaveBeenCalledWith({ focusMode: 'continuous', focusDistance: { ideal: 0.12 }, zoom: { ideal: 1.75 } })
  })

  it('falls back to continuous autofocus when a lens rejects close-focus controls', async () => {
    const applyConstraints = vi.fn()
      .mockRejectedValueOnce(new Error('focus distance unavailable'))
      .mockRejectedValueOnce(new Error('zoom unavailable'))
      .mockResolvedValueOnce(undefined)
    const track = cameraTrack({ focusMode: ['continuous'], focusDistance: { min: 0.05, max: 1 }, zoom: { min: 1, max: 2 } }, applyConstraints)

    expect(await applyBarcodeCameraProfile(track)).toBe(true)
    expect(applyConstraints).toHaveBeenLastCalledWith({ focusMode: 'continuous' })
  })

  it('uses a close manual distance only when continuous autofocus is unavailable', async () => {
    const track = cameraTrack({ focusMode: ['manual'], focusDistance: { min: 0.2, max: 2 }, zoom: { min: 1, max: 1.5 } })

    expect(await applyBarcodeCameraProfile(track)).toBe(true)
    expect(track.applyConstraints).toHaveBeenCalledWith({ focusMode: 'manual', focusDistance: 0.2, zoom: { ideal: 1.5 } })
  })
})

