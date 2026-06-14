/**
 * FILE: components/scan/ScanUpload.tsx
 *
 * WHAT THIS DOES:
 *   Source selector grid for bill scanning. Three options: Camera, Gallery, File.
 *   On selection, reads the file and calls onFileSelected.
 *
 * CHANGES THIS SESSION:
 *   - Initial creation
 *   - Khata Green restyle
 *
 * WHERE IT FITS:
 *   First screen of the scan flow. Shown when scan state = 'upload'.
 *
 * CALLED BY / IMPORTS FROM:
 *   app/(dashboard)/scan/page.tsx
 */
'use client'
import { useRef } from 'react'

interface Props {
  onFileSelected: (file: File) => void
}

export function ScanUpload({ onFileSelected }: Props) {
  const cameraRef = useRef<HTMLInputElement>(null)
  const galleryRef = useRef<HTMLInputElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) onFileSelected(file)
    e.target.value = ''
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-6 py-8">
      <h2 className="text-lg font-semibold text-gray-900 mb-2">Scan a bill</h2>
      <p className="text-sm text-gray-500 mb-1 text-center">
        Take a photo, pick from gallery, or upload a file
      </p>
      <p className="text-xs text-gray-400 mt-1 mb-8 text-center">Photo kheencho, hisab ho gaya ✨</p>

      {/* Hidden inputs */}
      <input ref={cameraRef} type="file" accept="image/*" capture="environment"
        className="hidden" onChange={handleChange} />
      <input ref={galleryRef} type="file" accept="image/*"
        className="hidden" onChange={handleChange} />
      <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp"
        className="hidden" onChange={handleChange} />

      <div className="w-full max-w-xs space-y-3 rounded-2xl border-2 border-dashed border-emerald-300 bg-emerald-50/40 hover:bg-emerald-50 transition-colors p-4">
        {/* Camera + Gallery row */}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => cameraRef.current?.click()}
            className="flex flex-col items-center justify-center gap-2 bg-white border border-gray-200 rounded-2xl py-6 hover:bg-gray-50 active:scale-95 transition-transform">
            <span className="text-3xl">📷</span>
            <span className="text-sm font-medium text-gray-700">Camera</span>
          </button>
          <button
            onClick={() => galleryRef.current?.click()}
            className="flex flex-col items-center justify-center gap-2 bg-white border border-gray-200 rounded-2xl py-6 hover:bg-gray-50 active:scale-95 transition-transform">
            <span className="text-3xl">🖼️</span>
            <span className="text-sm font-medium text-gray-700">Gallery</span>
          </button>
        </div>
        {/* File row */}
        <button
          onClick={() => fileRef.current?.click()}
          className="w-full flex items-center justify-center gap-2 bg-white border border-gray-200 rounded-2xl py-5 hover:bg-gray-50 active:scale-95 transition-transform">
          <span className="text-2xl">📄</span>
          <span className="text-sm font-medium text-gray-700">Upload file (PDF or image)</span>
        </button>
      </div>
    </div>
  )
}
