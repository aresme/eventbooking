import { Bookmark, BookmarkCheck, Check, Plus } from 'lucide-react'
import { usePeople } from '@/hooks/usePeople'
import { cn } from '@/lib/utils'
import { Button } from './ui/button'

export function SaveButton({ eventId, className, variant = 'icon' }) {
  const { saved, toggleSave } = usePeople()
  const on = saved.includes(eventId)
  const onClick = (e) => {
    // Cards are links; don't navigate when saving.
    e.preventDefault()
    e.stopPropagation()
    toggleSave(eventId)
  }
  if (variant === 'icon') {
    return (
      <button
        onClick={onClick}
        aria-pressed={on}
        aria-label={on ? 'Remove from saved' : 'Save event'}
        className={cn('grid size-9 place-items-center rounded-full bg-black/45 text-white backdrop-blur-md transition-transform hover:scale-110', on && 'bg-primary', className)}
      >
        {on ? <BookmarkCheck className="size-4" /> : <Bookmark className="size-4" />}
      </button>
    )
  }
  return (
    <Button variant="outline" onClick={onClick} aria-pressed={on} className={className}>
      {on ? <BookmarkCheck className="text-primary" /> : <Bookmark />} {on ? 'Saved' : 'Save'}
    </Button>
  )
}

export function FollowButton({ clubId, name, size = 'sm', className }) {
  const { following, toggleFollow } = usePeople()
  const on = following.includes(clubId)
  return (
    <Button size={size} variant={on ? 'outline' : 'soft'} onClick={() => toggleFollow(clubId, name)} aria-pressed={on} className={className}>
      {on ? <Check /> : <Plus />} {on ? 'Following' : 'Follow'}
    </Button>
  )
}
