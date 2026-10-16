import { Link } from 'react-router-dom'
import { Moon, Sun } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTheme } from '@/hooks/useTheme'
import { Button } from './ui/button'

export function LogoMark({ className }) {
  return (
    <svg viewBox="0 0 32 32" className={cn('size-8', className)} aria-hidden="true">
      <rect width="32" height="32" rx="9" fill="var(--primary)" />
      <path d="M18.2 6 10 18h5.4L13.8 26 22 14h-5.4L18.2 6Z" fill="white" />
    </svg>
  )
}

export function Logo({ to = '/', className, suffix }) {
  return (
    <Link to={to} className={cn('flex items-center gap-2 font-extrabold tracking-tight', className)}>
      <LogoMark />
      <span className="text-lg">
        Uni<span className="text-primary">Vibe</span>
      </span>
      {suffix && <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{suffix}</span>}
    </Link>
  )
}

export function ThemeToggle({ className }) {
  const { isDark, toggle } = useTheme()
  return (
    <Button variant="ghost" size="icon" onClick={toggle} className={className} aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}>
      {isDark ? <Sun /> : <Moon />}
    </Button>
  )
}
