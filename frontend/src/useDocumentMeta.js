import { useEffect } from 'react'

const SITE_TITLE = 'AvgPace'
const HOME_TITLE = 'AvgPace — Free race results, leaderboards & running history'
const DEFAULT_DESCRIPTION =
  'Log your 5K, 10K, half marathon and marathon times for free. No GPX upload, no subscription, no paywalled history — just your race results, verified and shareable.'

function setMetaContent(selector, content) {
  const el = document.querySelector(selector)
  if (el) el.setAttribute('content', content)
}

// Keeps <title> and index.html's static meta tags (description, Open Graph,
// Twitter Card, robots) in sync with whichever page is mounted. This is a
// client-rendered SPA with no server-side rendering, so a non-JS crawler or
// link-preview bot (Twitter/WhatsApp/Slack/etc. unfurlers never run JS) only
// ever sees index.html's static tags, not these per-page updates - true
// per-page social-preview cards would need server-side rendering for bots
// specifically, a separate feature. This still genuinely helps search
// ranking, since Google's own indexer does execute JS and re-reads the DOM
// after render, and it keeps the actual browser tab/title accurate for
// people, which is worth doing on its own.
export function useDocumentMeta({ title, description, noindex = false } = {}) {
  useEffect(() => {
    const fullTitle = title ? `${title} — ${SITE_TITLE}` : HOME_TITLE
    const desc = description || DEFAULT_DESCRIPTION

    document.title = fullTitle
    setMetaContent('meta[name="description"]', desc)
    setMetaContent('meta[property="og:title"]', fullTitle)
    setMetaContent('meta[property="og:description"]', desc)
    setMetaContent('meta[property="og:url"]', window.location.href)
    setMetaContent('meta[name="twitter:title"]', fullTitle)
    setMetaContent('meta[name="twitter:description"]', desc)
    setMetaContent('meta[name="robots"]', noindex ? 'noindex, nofollow' : 'index, follow')
  }, [title, description, noindex])
}
