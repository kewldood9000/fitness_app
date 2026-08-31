interface NumericCameraCapability {
  min: number
  max: number
  step?: number
}

interface BarcodeCameraCapabilities extends MediaTrackCapabilities {
  focusDistance?: NumericCameraCapability
  focusMode?: string[]
  zoom?: NumericCameraCapability
}

type BarcodeCameraConstraintSet = MediaTrackConstraintSet & {
  focusDistance?: number | { ideal: number }
  focusMode?: string
  zoom?: number | { ideal: number }
}

function valueWithin(capability: NumericCameraCapability, preferred: number): number {
  const bounded = Math.min(capability.max, Math.max(capability.min, preferred))
  if (!capability.step || capability.step <= 0) return bounded
  const stepped = capability.min + Math.round((bounded - capability.min) / capability.step) * capability.step
  return Math.min(capability.max, Math.max(capability.min, Number(stepped.toFixed(4))))
}

/** Applies a best-effort close-range profile without preventing camera fallback. */
export async function applyBarcodeCameraProfile(track: MediaStreamTrack): Promise<boolean> {
  if (!track.getCapabilities || !track.applyConstraints) return false
  const capabilities = track.getCapabilities() as BarcodeCameraCapabilities
  const focusModes = capabilities.focusMode ?? []
  const closeFocus = capabilities.focusDistance ? valueWithin(capabilities.focusDistance, 0.12) : undefined
  const barcodeZoom = capabilities.zoom ? valueWithin(capabilities.zoom, 1.75) : undefined
  const candidates: BarcodeCameraConstraintSet[] = []

  if (focusModes.includes('continuous')) {
    candidates.push({
      focusMode: 'continuous',
      ...(closeFocus !== undefined ? { focusDistance: { ideal: closeFocus } } : {}),
      ...(barcodeZoom !== undefined ? { zoom: { ideal: barcodeZoom } } : {})
    })
    if (closeFocus !== undefined) candidates.push({ focusMode: 'continuous', ...(barcodeZoom !== undefined ? { zoom: { ideal: barcodeZoom } } : {}) })
    candidates.push({ focusMode: 'continuous' })
  } else if (focusModes.includes('manual') && closeFocus !== undefined) {
    candidates.push({ focusMode: 'manual', focusDistance: closeFocus, ...(barcodeZoom !== undefined ? { zoom: { ideal: barcodeZoom } } : {}) })
    candidates.push({ focusMode: 'manual', focusDistance: closeFocus })
  } else if (barcodeZoom !== undefined) {
    candidates.push({ zoom: { ideal: barcodeZoom } })
  }

  for (const candidate of candidates) {
    try {
      await track.applyConstraints(candidate as MediaTrackConstraints)
      return true
    } catch {
      // Safari exposes different camera controls depending on the selected lens.
    }
  }
  return false
}

