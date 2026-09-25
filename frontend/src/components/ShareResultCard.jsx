import { useRef, useState } from 'react'
import { toPng } from 'html-to-image'
import { formatDuration, formatPace, formatEventDate } from '../format.js'

const DISTANCE_LABELS = { '5k': '5K', '10k': '10K', half: 'HALF MARATHON', marathon: 'MARATHON' }

// Rendered at this CSS width, then exported at PIXEL_RATIO x for a crisp
// image - big enough to look sharp resized into an Instagram Story, small
// enough to stay a "sticker" rather than a full-screen background.
const CARD_WIDTH = 480
const PIXEL_RATIO = 3

async function exportCard(node) {
  // Custom fonts must be fully loaded before the DOM is rasterized, or the
  // capture can silently fall back to a generic monospace mid-word.
  await document.fonts.ready
  return toPng(node, {
    pixelRatio: PIXEL_RATIO,
    width: CARD_WIDTH,
    // html-to-image's own font-embedding step walks every stylesheet on the
    // page looking for @font-face rules, including the cross-origin Google
    // Fonts one - reading a cross-origin stylesheet's rules throws a
    // SecurityError and aborts the whole export. Skip it: this capture
    // rasterizes in the same page that already has the font active, so it
    // renders correctly either way - the embedding step only matters for
    // reusing the intermediate SVG outside this page, which nothing here does.
    skipFonts: true,
    // No backgroundColor set - html-to-image leaves the canvas transparent
    // where the DOM itself has no fill, which is the whole point: this is
    // meant to be pasted over a runner's own race photo, not stand alone.
  })
}

export default function ShareResultCard({ run, onClose }) {
  const cardRef = useRef(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const canShareFiles = typeof navigator.canShare === 'function'

  const distance = DISTANCE_LABELS[run.distance_bucket] ?? run.distance_bucket.toUpperCase()

  async function handleDownload() {
    setBusy(true)
    setError(null)
    try {
      const dataUrl = await exportCard(cardRef.current)
      const a = document.createElement('a')
      a.href = dataUrl
      a.download = `averagepace-${run.distance_bucket}-${formatDuration(run.duration_s).replace(/:/g, '-')}.png`
      a.click()
    } catch {
      setError("Couldn't generate the image - try again.")
    } finally {
      setBusy(false)
    }
  }

  async function handleShare() {
    setBusy(true)
    setError(null)
    try {
      const dataUrl = await exportCard(cardRef.current)
      const blob = await (await fetch(dataUrl)).blob()
      const file = new File([blob], 'averagepace-result.png', { type: 'image/png' })
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file] })
      } else {
        throw new Error('sharing not supported')
      }
    } catch (err) {
      if (err.name !== 'AbortError') setError("Couldn't share the image - try downloading instead.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal share-modal" onClick={(e) => e.stopPropagation()}>
        <p className="eyebrow">Share this result</p>
        <h2>Looks good?</h2>
        <p className="lede">
          Transparent background - drop it on top of your own race photo in
          Instagram Stories or wherever you post.
        </p>

        <div className="share-card-preview">
          <div className="share-card" ref={cardRef} style={{ width: CARD_WIDTH }}>
            <div className="share-card-panel">
              <span className="share-card-badge">{distance}</span>
              <div className="share-card-time">{formatDuration(run.duration_s)}</div>
              <div className="share-card-pace">{formatPace(run.pace_sec_per_km)} PACE</div>
              {(run.event_name || run.event_date) && (
                <div className="share-card-event">
                  {run.event_name}
                  {run.event_name && run.event_date && ' · '}
                  {run.event_date && formatEventDate(run.event_date)}
                </div>
              )}
              <div className="share-card-brand">Average<span>Pace</span></div>
            </div>
          </div>
        </div>

        {error && <div className="banner err">{error}</div>}

        <div className="share-modal-actions">
          {canShareFiles && (
            <button type="button" onClick={handleShare} disabled={busy}>
              {busy ? 'Preparing…' : 'Share'}
            </button>
          )}
          <button type="button" className={canShareFiles ? 'ghost' : ''} onClick={handleDownload} disabled={busy}>
            {busy ? 'Preparing…' : 'Download image'}
          </button>
          <button type="button" className="ghost" onClick={onClose} disabled={busy}>
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
