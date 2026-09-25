import { useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { toPng } from 'html-to-image'
import { formatDuration, formatPace, formatEventDate } from '../format.js'

// The runner's own entered distance (e.g. a course that ran slightly long),
// not the bucket's nominal one - "42.2KM" reads as more specific/earned
// than "MARATHON", and matches what's actually being measured for pace.
function formatDistanceKm(km) {
  const rounded = Math.round(km * 10) / 10
  return `${Number.isInteger(rounded) ? rounded : rounded.toFixed(1)}KM`
}

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
    style: {
      // .share-card's dark tint is a preview-only convenience (contrast
      // against the checkerboard, not part of the design) - stripped here
      // so the downloaded file is genuinely transparent, not just mostly.
      backgroundColor: 'transparent',
      // The live node is scaled down on narrow screens to fit the modal
      // (see the ResizeObserver below) - stripping that here forces the
      // clone back to its true, full 480px layout width, matching the
      // `width` option above exactly. Without this, the clone renders as
      // if it were still the shrunk-down on-screen size while the output
      // canvas is stretched to 480px regardless, leaving the real content
      // squeezed into one corner instead of centered in the export.
      transform: 'none',
    },
  })
}

export default function ShareResultCard({ run, onClose }) {
  const cardRef = useRef(null)
  const previewRef = useRef(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [scale, setScale] = useState(1)
  const [naturalSize, setNaturalSize] = useState({ width: CARD_WIDTH, height: CARD_WIDTH })
  const canShareFiles = typeof navigator.canShare === 'function'

  const distance = formatDistanceKm(run.distance_km)

  // .share-card always stays laid out at its true CARD_WIDTH (see the
  // export note above for why) - on narrow screens it's shrunk purely
  // visually via a CSS transform, sized against a wrapper set to match, so
  // it still fits the modal without ever changing the card's real layout
  // width. Runs before paint so there's no flash of an oversized card.
  useLayoutEffect(() => {
    const cardEl = cardRef.current
    const previewEl = previewRef.current
    if (!cardEl || !previewEl) return

    setNaturalSize({ width: cardEl.offsetWidth, height: cardEl.offsetHeight })

    function applyScale() {
      setScale(Math.min(1, previewEl.clientWidth / CARD_WIDTH))
    }
    applyScale()
    const observer = new ResizeObserver(applyScale)
    observer.observe(previewEl)
    return () => observer.disconnect()
  }, [])

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

  // Portalled to <body> rather than rendered in place: a caller might be a
  // table row (BestEffortDetailPage.jsx's history table only allows <td>
  // children of a <tr> - a modal <div> sibling there is invalid HTML that
  // browsers silently relocate), and even where that's not an issue, a
  // modal escaping its ancestors' stacking/overflow context is the
  // standard, robust default rather than something every call site has to
  // get right on its own.
  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal share-modal" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="modal-close-x" onClick={onClose} aria-label="Close">
          ×
        </button>
        <h2>Share this result</h2>

        <div className="share-card-preview" ref={previewRef}>
          <div
            className="share-card-scale-wrapper"
            style={{ width: naturalSize.width * scale, height: naturalSize.height * scale }}
          >
            <div
              className="share-card"
              ref={cardRef}
              style={{ width: CARD_WIDTH, transform: `scale(${scale})`, transformOrigin: 'top left' }}
            >
              <div className="share-card-panel">
                <span className="share-card-badge">{distance}</span>
                <div className="share-card-time">{formatDuration(run.duration_s)}</div>
                <div className="share-card-pace">{formatPace(run.pace_sec_per_km)}</div>
                {(run.event_name || run.event_date) && (
                  <div className="share-card-event">
                    {run.event_name}
                    {run.event_name && run.event_date && ' · '}
                    {run.event_date && formatEventDate(run.event_date)}
                  </div>
                )}
                <div className="share-card-brand">Avg<span>Pace</span></div>
              </div>
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
            {busy ? 'Preparing…' : 'Download'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
