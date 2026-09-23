import { useCallback, useEffect, useRef, useState } from 'react'
import { Alert, Box, Button, IconButton, Typography } from '@mui/material'
import { X, Image as ImageIcon, SwitchCamera } from 'lucide-react'

interface CameraCaptureProps {
  onCapture: (photoDataUrl: string) => void
  onClose: () => void
}

// Photos are uploaded as data URLs, so they are downscaled first: a phone
// original is several megabytes, and the analysis needs neither the pixels nor
// the wait.
const MAX_DIMENSION = 1280
const JPEG_QUALITY = 0.72

function toDataUrl(source: HTMLVideoElement | HTMLImageElement): string {
  const width = 'videoWidth' in source ? source.videoWidth : source.naturalWidth
  const height = 'videoHeight' in source ? source.videoHeight : source.naturalHeight
  const scale = Math.min(1, MAX_DIMENSION / Math.max(width, height))

  const canvas = document.createElement('canvas')
  canvas.width = Math.round(width * scale)
  canvas.height = Math.round(height * scale)
  canvas.getContext('2d')?.drawImage(source, 0, 0, canvas.width, canvas.height)

  return canvas.toDataURL('image/jpeg', JPEG_QUALITY)
}

export default function CameraCapture({ onCapture, onClose }: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment')
  const [error, setError] = useState<string | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function start() {
      setReady(false)
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode },
          audio: false,
        })
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop())
          return
        }
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play().catch(() => undefined)
        }
        setReady(true)
        setError(null)
      } catch {
        // No camera, or permission denied — the gallery button still works.
        setError('אין גישה למצלמה. ניתן לבחור תמונה קיימת מהגלריה')
      }
    }

    void start()

    return () => {
      cancelled = true
      streamRef.current?.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }
  }, [facingMode])

  const capture = useCallback(() => {
    const video = videoRef.current
    if (!video || !video.videoWidth) return
    onCapture(toDataUrl(video))
  }, [onCapture])

  const handleFile = (file: File) => {
    const reader = new FileReader()
    reader.onload = () => {
      const image = new Image()
      image.onload = () => onCapture(toDataUrl(image))
      image.onerror = () => setError('לא ניתן לקרוא את התמונה שנבחרה')
      image.src = String(reader.result)
    }
    reader.onerror = () => setError('לא ניתן לקרוא את התמונה שנבחרה')
    reader.readAsDataURL(file)
  }

  return (
    <Box
      dir="rtl"
      sx={{
        position: 'fixed',
        inset: 0,
        zIndex: 1300,
        bgcolor: '#1C1109',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          px: 2,
          pt: 'calc(env(safe-area-inset-top, 0px) + 10px)',
          pb: 1,
          color: '#FDF6EC',
        }}
      >
        <IconButton onClick={onClose} aria-label="סגירה" sx={{ color: 'inherit' }}>
          <X size={24} />
        </IconButton>
        <Box sx={{ textAlign: 'center' }}>
          <Typography sx={{ fontWeight: 700, fontSize: '1.05rem' }}>צלם וטפל</Typography>
          <Typography sx={{ fontSize: '0.75rem', opacity: 0.8 }}>
            צלם את התקלה וה-AI יטפל בשאר
          </Typography>
        </Box>
        <IconButton
          aria-label="החלפת מצלמה"
          onClick={() => setFacingMode((mode) => (mode === 'environment' ? 'user' : 'environment'))}
          sx={{ color: 'inherit' }}
        >
          <SwitchCamera size={22} />
        </IconButton>
      </Box>

      <Box sx={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        <video
          ref={videoRef}
          playsInline
          muted
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            opacity: ready ? 1 : 0.2,
            transition: 'opacity 0.2s ease',
          }}
        />

        {/* Viewfinder corners, as in the design */}
        <Box sx={{ position: 'absolute', inset: '8% 10%', pointerEvents: 'none' }}>
          {[
            { top: 0, insetInlineStart: 0, borderTop: 3, borderInlineStart: 3 },
            { top: 0, insetInlineEnd: 0, borderTop: 3, borderInlineEnd: 3 },
            { bottom: 0, insetInlineStart: 0, borderBottom: 3, borderInlineStart: 3 },
            { bottom: 0, insetInlineEnd: 0, borderBottom: 3, borderInlineEnd: 3 },
          ].map((corner, index) => (
            <Box
              key={index}
              sx={{
                position: 'absolute',
                width: 34,
                height: 34,
                borderColor: 'rgba(253, 246, 236, 0.9)',
                borderStyle: 'solid',
                borderWidth: 0,
                borderRadius: '6px',
                ...corner,
              }}
            />
          ))}
        </Box>

        {error && (
          <Alert
            severity="warning"
            sx={{ position: 'absolute', insetInline: 16, bottom: 16, borderRadius: 2 }}
          >
            {error}
          </Alert>
        )}
      </Box>

      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-around',
          px: 3,
          py: 2.5,
          pb: 'calc(env(safe-area-inset-bottom, 0px) + 20px)',
          color: '#FDF6EC',
        }}
      >
        <IconButton
          aria-label="בחירת תמונה מהגלריה"
          onClick={() => fileInputRef.current?.click()}
          sx={{ color: 'inherit', bgcolor: 'rgba(253,246,236,0.14)', p: 1.6 }}
        >
          <ImageIcon size={24} />
        </IconButton>

        <Box
          role="button"
          aria-label="צילום"
          onClick={capture}
          sx={{
            width: 74,
            height: 74,
            borderRadius: '50%',
            border: '4px solid rgba(253,246,236,0.9)',
            bgcolor: ready ? '#FDF6EC' : 'rgba(253,246,236,0.35)',
            cursor: ready ? 'pointer' : 'default',
            WebkitTapHighlightColor: 'transparent',
            transition: 'transform 0.12s ease',
            '&:active': { transform: ready ? 'scale(0.92)' : 'none' },
          }}
        />

        {/* Balances the row; the gallery is the only alternative source. */}
        <Box sx={{ width: 56 }} />
      </Box>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(event) => {
          const file = event.target.files?.[0]
          if (file) handleFile(file)
          event.target.value = ''
        }}
      />

      {!ready && !error && (
        <Button
          disabled
          sx={{ position: 'absolute', insetInline: 0, top: '50%', color: '#FDF6EC' }}
        >
          מפעיל מצלמה…
        </Button>
      )}
    </Box>
  )
}
