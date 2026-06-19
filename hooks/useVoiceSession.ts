/**
 * FILE: hooks/useVoiceSession.ts
 *
 * WHAT THIS DOES:
 *   Runs the continuous mic loop for the voice sales session. Captures audio,
 *   uses the pure VAD helper to cut each spoken phrase on ~1s of silence, POSTs
 *   the clip to /api/voice/parse, and reports the result + a status the UI shows
 *   (listening / thinking / denied / offline / error).
 *
 * CHANGES THIS SESSION:
 *   - Initial creation (Voice Layer 1)
 *
 * WHERE IT FITS:
 *   Used by app/(dashboard)/voice/page.tsx behind the mic button.
 *
 * CALLED BY / IMPORTS FROM:
 *   app/(dashboard)/voice/page.tsx ; uses lib/voice/vad.ts and lib/voice/types.ts
 */
'use client'
import { useCallback, useRef, useState } from 'react'
import { advanceVad, computeRms, initVadState, type VadState } from '@/lib/voice/vad'
import type { VoiceParseResponse } from '@/lib/voice/types'

const FRAME_MS = 50
const MIN_CLIP_BYTES = 1200 // ignore clips too short to contain speech

export type VoiceStatus = 'idle' | 'listening' | 'thinking' | 'error' | 'denied' | 'offline'

export function useVoiceSession(onResult: (r: VoiceParseResponse) => void) {
  const [status, setStatus] = useState<VoiceStatus>('idle')
  const [lastTranscript, setLastTranscript] = useState('')

  const streamRef = useRef<MediaStream | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const vadRef = useRef<VadState>(initVadState())
  const loopRef = useRef<number | null>(null)
  const bufRef = useRef<Float32Array | null>(null)

  const send = useCallback(async (blob: Blob) => {
    if (blob.size < MIN_CLIP_BYTES) { setStatus('listening'); return }
    if (typeof navigator !== 'undefined' && !navigator.onLine) { setStatus('offline'); return }
    setStatus('thinking')
    try {
      const fd = new FormData()
      fd.append('audio', blob, 'clip.webm')
      const res = await fetch('/api/voice/parse', { method: 'POST', body: fd })
      if (!res.ok) { setStatus('error'); return }
      const data: VoiceParseResponse = await res.json()
      if (data.transcript) setLastTranscript(data.transcript)
      onResult(data)
      setStatus('listening')
    } catch {
      setStatus('error')
    }
  }, [onResult])

  const startRecorder = useCallback(() => {
    if (recorderRef.current || !streamRef.current) return
    const rec = new MediaRecorder(streamRef.current, { mimeType: 'audio/webm' })
    chunksRef.current = []
    rec.ondataavailable = (e) => { if (e.data.size) chunksRef.current.push(e.data) }
    rec.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
      recorderRef.current = null
      void send(blob)
    }
    rec.start()
    recorderRef.current = rec
  }, [send])

  const tick = useCallback(() => {
    const analyser = analyserRef.current
    const buf = bufRef.current
    if (!analyser || !buf) return
    analyser.getFloatTimeDomainData(buf as Float32Array<ArrayBuffer>)
    const rms = computeRms(buf)
    const wasSpeaking = vadRef.current.speaking
    const { state, finalize } = advanceVad(vadRef.current, rms, FRAME_MS)
    vadRef.current = state
    if (!wasSpeaking && state.speaking) startRecorder()
    if (finalize && recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.stop()
    }
  }, [startRecorder])

  const start = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      const ctx = new AudioContext()
      audioCtxRef.current = ctx
      const source = ctx.createMediaStreamSource(stream)
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 1024
      source.connect(analyser)
      analyserRef.current = analyser
      bufRef.current = new Float32Array(analyser.fftSize)
      vadRef.current = initVadState()
      loopRef.current = window.setInterval(tick, FRAME_MS)
      setStatus('listening')
    } catch (e) {
      const denied = e instanceof DOMException && (e.name === 'NotAllowedError' || e.name === 'SecurityError')
      setStatus(denied ? 'denied' : 'error')
    }
  }, [tick])

  const stop = useCallback(() => {
    if (loopRef.current !== null) { clearInterval(loopRef.current); loopRef.current = null }
    if (recorderRef.current && recorderRef.current.state !== 'inactive') recorderRef.current.stop()
    recorderRef.current = null
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    void audioCtxRef.current?.close()
    audioCtxRef.current = null
    analyserRef.current = null
    setStatus('idle')
  }, [])

  return { status, lastTranscript, start, stop }
}
