import { Camera, Flashlight, Keyboard, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { applyBarcodeCameraProfile } from './cameraProfile'

interface NativeBarcodeDetector {
  detect(source: ImageBitmapSource): Promise<Array<{ rawValue: string }>>
}

declare global {
  interface Window {
    BarcodeDetector?: new (options?: { formats?: string[] }) => NativeBarcodeDetector
  }
}

interface BarcodeScannerProps {
  onDetected: (barcode: string) => void
  onClose: () => void
}

const formats = ['upc_a', 'upc_e', 'ean_8', 'ean_13']

export function BarcodeScanner({ onDetected, onClose }: BarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const cleanupRef = useRef<() => void>(() => undefined)
  const lastValueRef = useRef('')
  const [error, setError] = useState('')
  const [manual, setManual] = useState('')
  const [torchAvailable, setTorchAvailable] = useState(false)
  const [torchOn, setTorchOn] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function start() {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error('Camera access is not available in this browser.')
        if (window.BarcodeDetector) {
          const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false })
          if (cancelled) { stream.getTracks().forEach((track) => track.stop()); return }
          const video = videoRef.current
          if (!video) return
          video.srcObject = stream
          await video.play()
          const track = stream.getVideoTracks()[0]
          if (track) await applyBarcodeCameraProfile(track)
          const capabilities = track?.getCapabilities?.() as MediaTrackCapabilities & { torch?: boolean }
          setTorchAvailable(Boolean(capabilities?.torch))
          const detector = new window.BarcodeDetector({ formats })
          let timer = 0
          const scan = async () => {
            if (cancelled || !video.videoWidth) return
            try {
              const results = await detector.detect(video)
              const value = results[0]?.rawValue?.replace(/\s/g, '')
              if (value && value !== lastValueRef.current) {
                lastValueRef.current = value
                navigator.vibrate?.(35)
                onDetected(value)
                return
              }
            } catch {
              // A camera frame can be unavailable while Safari is starting; keep scanning.
            }
            timer = window.setTimeout(scan, 280)
          }
          scan()
          cleanupRef.current = () => { window.clearTimeout(timer); stream.getTracks().forEach((item) => item.stop()) }
          return
        }

        const { BrowserMultiFormatReader } = await import('@zxing/browser')
        const reader = new BrowserMultiFormatReader()
        const controls = await reader.decodeFromConstraints({ video: { facingMode: { ideal: 'environment' } }, audio: false }, videoRef.current!, (result) => {
          const value = result?.getText()?.replace(/\s/g, '')
          if (value && value !== lastValueRef.current) {
            lastValueRef.current = value
            navigator.vibrate?.(35)
            onDetected(value)
          }
        })
        const fallbackTrack = (videoRef.current?.srcObject as MediaStream | null)?.getVideoTracks()[0]
        if (fallbackTrack) {
          await applyBarcodeCameraProfile(fallbackTrack)
          const capabilities = fallbackTrack.getCapabilities?.() as MediaTrackCapabilities & { torch?: boolean }
          setTorchAvailable(Boolean(capabilities?.torch))
        }
        cleanupRef.current = () => controls.stop()
      } catch (scanError) {
        const message = scanError instanceof Error ? scanError.message : 'Unable to open the camera.'
        setError(message.includes('Permission') || message.includes('NotAllowed') ? 'Camera permission was denied. You can enter the barcode manually instead.' : message)
      }
    }
    void start()
    return () => { cancelled = true; cleanupRef.current() }
  }, [onDetected])

  async function toggleTorch() {
    const track = (videoRef.current?.srcObject as MediaStream | null)?.getVideoTracks()[0]
    if (!track) return
    const next = !torchOn
    try {
      await track.applyConstraints({ advanced: [{ torch: next } as MediaTrackConstraintSet] })
      setTorchOn(next)
    } catch { setError('Torch control is unavailable on this camera.') }
  }

  return <div aria-modal="true" className="modal-backdrop" role="dialog"><div className="modal-panel overflow-hidden"><div className="modal-header flex items-center justify-between px-5 pb-3 pt-5"><div><p className="eyebrow">Camera</p><h2 className="mt-1 text-lg font-semibold text-slate-50">Scan food barcode</h2></div><button aria-label="Close scanner" className="workout-icon-button" onClick={onClose}><X className="size-4" /></button></div><div className="modal-scroll px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))]"><div className="relative overflow-hidden rounded-2xl bg-slate-950 aspect-[4/3]"><video autoPlay className="h-full w-full object-cover" muted playsInline ref={videoRef} /><div className="pointer-events-none absolute inset-[18%_10%] rounded-xl border-2 border-sky-300/80 shadow-[0_0_0_999px_rgba(2,6,23,0.32)]" /></div>{error && <p className="mt-3 rounded-xl bg-amber-300/10 px-3 py-2.5 text-sm leading-5 text-amber-100">{error}</p>}<div className="mt-3 flex gap-2">{torchAvailable && <button className="button-secondary flex-1" onClick={() => void toggleTorch()}><Flashlight className="size-4" />{torchOn ? 'Torch on' : 'Torch off'}</button>}<span className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-slate-800 px-3 text-xs font-semibold text-slate-400"><Camera className="size-4" />Point at UPC or EAN</span></div><div className="mt-4 border-t border-white/[0.07] pt-4"><label className="field-label">Manual barcode entry<div className="mt-1 flex gap-2"><input className="field-input mt-0" inputMode="numeric" onChange={(event) => setManual(event.target.value.replace(/\D/g, ''))} placeholder="UPC / EAN" value={manual} /><button className="button-primary shrink-0" disabled={!manual} onClick={() => onDetected(manual)}><Keyboard className="size-4" />Use</button></div></label></div></div></div></div>
}
