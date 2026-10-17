import { useId } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

const control =
  'w-full rounded-lg border border-input bg-card px-3 text-sm text-foreground placeholder:text-muted-foreground/70 transition-colors focus:border-primary focus:outline-none focus:ring-3 focus:ring-primary/15 disabled:opacity-60 aria-[invalid=true]:border-danger aria-[invalid=true]:ring-danger/15'

export function Input({ className, ...props }) {
  return <input className={cn(control, 'h-10', className)} {...props} />
}

export function Textarea({ className, ...props }) {
  return <textarea className={cn(control, 'min-h-28 py-2.5 leading-relaxed', className)} {...props} />
}

export function Select({ className, children, ...props }) {
  return (
    <div className="relative">
      <select className={cn(control, 'h-10 appearance-none pr-9', className)} {...props}>
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
    </div>
  )
}

export function Label({ className, ...props }) {
  return <label className={cn('text-sm font-semibold text-foreground', className)} {...props} />
}

/**
 * Label + control + hint/error. The child receives id / aria-invalid / aria-describedby.
 * Usage: <Field label="Name" error={errors.name}>{(p) => <Input {...p} />}</Field>
 */
export function Field({ label, hint, error, className, children, optional }) {
  const id = useId()
  const descId = `${id}-desc`
  return (
    <div className={cn('space-y-1.5', className)}>
      {label && (
        <Label htmlFor={id} className="flex items-baseline justify-between">
          {label}
          {optional && <span className="text-xs font-normal text-muted-foreground">Optional</span>}
        </Label>
      )}
      {children({ id, 'aria-invalid': Boolean(error), 'aria-describedby': hint || error ? descId : undefined })}
      {(error || hint) && (
        <p id={descId} className={cn('text-xs', error ? 'font-medium text-danger' : 'text-muted-foreground')}>
          {error || hint}
        </p>
      )}
    </div>
  )
}

export function Switch({ checked, onChange, label, description, className, id: idProp }) {
  const autoId = useId()
  const id = idProp || autoId
  return (
    <label htmlFor={id} className={cn('flex cursor-pointer items-start justify-between gap-4', className)}>
      <span>
        <span className="block text-sm font-semibold">{label}</span>
        {description && <span className="block text-xs text-muted-foreground">{description}</span>}
      </span>
      <span className="relative mt-0.5 inline-flex shrink-0">
        <input id={id} type="checkbox" role="switch" className="peer sr-only" checked={checked} onChange={(e) => onChange(e.target.checked)} />
        <span className="h-6 w-11 rounded-full bg-input transition-colors peer-checked:bg-primary peer-focus-visible:ring-2 peer-focus-visible:ring-ring" />
        <span className="absolute left-0.5 top-0.5 size-5 rounded-full bg-white shadow transition-transform peer-checked:translate-x-5" />
      </span>
    </label>
  )
}
