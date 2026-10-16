import { useState } from 'react'
import { eventImage } from '@/lib/utils'

/** Event cover with a generated fallback when the stored URL is missing or broken. */
export function EventImage({ event, w, h, alt = '', ...props }) {
  const [failed, setFailed] = useState(false)
  const fallback = `https://picsum.photos/seed/${encodeURIComponent(event?.id || 'univibe')}/${w}/${h}`
  return <img src={failed ? fallback : eventImage(event, w, h)} alt={alt} onError={() => !failed && setFailed(true)} {...props} />
}
