import { useState } from 'react'
import { toast } from 'sonner'
import { Copy, Pause, Play, Tag, Trash2 } from 'lucide-react'
import { useSubscription } from '@/hooks/useSubscription'
import { createPromo, deletePromo, PromoError, setPromoActive, subscribePromos } from '@/services/promos'
import { normalizeCode, promoLabel, tierList } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Field, Input, Select } from '@/components/ui/form'
import { Badge, EmptyState } from '@/components/ui/misc'
import { Dialog, useConfirm } from '@/components/ui/dialog'

const EMPTY = { code: '', type: 'percent', value: 20, maxUses: 50, tierId: '' }

export default function PromoDialog({ event, onClose }) {
  return (
    <Dialog open={Boolean(event)} onClose={onClose} title="Promo codes" description={event?.title} size="lg">
      {event && <PromoManager event={event} />}
    </Dialog>
  )
}

function PromoManager({ event }) {
  const confirm = useConfirm()
  const { data: promos = [] } = useSubscription((ok, err) => subscribePromos(event.id, ok, err), [event.id], { initial: [] })
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const tiers = tierList(event)
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  async function create(e) {
    e.preventDefault()
    const code = normalizeCode(form.code)
    if (code.length < 3) return toast.error('Code needs at least 3 letters or numbers')
    setSaving(true)
    try {
      await createPromo(event.id, { ...form, code, tierIds: form.tierId ? [form.tierId] : [] })
      toast.success(`${code} created`)
      setForm(EMPTY)
    } catch (err) {
      toast.error(err instanceof PromoError ? err.message : 'Could not create the code')
    } finally {
      setSaving(false)
    }
  }

  async function remove(p) {
    if (!(await confirm({ title: `Delete ${p.code}?`, description: 'Bookings that already used it keep their discount.', confirmLabel: 'Delete', danger: true }))) return
    await deletePromo(event.id, p.code)
  }

  return (
    <div className="space-y-6">
      <form onSubmit={create} className="grid gap-3 rounded-xl border p-4 sm:grid-cols-2">
        <Field label="Code" hint="Letters and numbers, e.g. EARLYBIRD">
          {(p) => <Input {...p} value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: normalizeCode(e.target.value) }))} className="font-mono uppercase" placeholder="EARLYBIRD" />}
        </Field>
        <Field label="Discount">
          {(p) => (
            <Select {...p} value={form.type} onChange={set('type')}>
              <option value="percent">Percentage off</option>
              <option value="fixed">KES off each ticket</option>
              <option value="free">Free ticket</option>
            </Select>
          )}
        </Field>
        {form.type !== 'free' && (
          <Field label={form.type === 'percent' ? 'Percent (1–100)' : 'Amount (KES)'}>
            {(p) => <Input {...p} type="number" min="1" max={form.type === 'percent' ? 100 : undefined} value={form.value} onChange={set('value')} />}
          </Field>
        )}
        <Field label="Max tickets" hint="Total tickets this code can be used for">
          {(p) => <Input {...p} type="number" min="1" value={form.maxUses} onChange={set('maxUses')} />}
        </Field>
        <Field label="Ticket type" className={form.type === 'free' ? '' : 'sm:col-span-2'}>
          {(p) => (
            <Select {...p} value={form.tierId} onChange={set('tierId')}>
              <option value="">All ticket types</option>
              {tiers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </Select>
          )}
        </Field>
        <div className="sm:col-span-2">
          <Button type="submit" loading={saving}>
            {!saving && <Tag />} Create code
          </Button>
        </div>
      </form>

      {promos.length === 0 ? (
        <EmptyState icon={Tag} title="No codes yet" description="Create one above and share it with your audience." />
      ) : (
        <ul className="divide-y rounded-xl border">
          {promos.map((p) => (
            <li key={p.code} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2">
                  <span className="font-mono font-bold">{p.code}</span>
                  {!p.active && <Badge variant="outline">Paused</Badge>}
                  {p.uses >= p.maxUses && <Badge variant="danger">Used up</Badge>}
                </p>
                <p className="text-xs text-muted-foreground">
                  {promoLabel(p)} · {p.uses}/{p.maxUses} used
                  {p.tierIds?.length ? ` · ${tiers.find((t) => t.id === p.tierIds[0])?.name || 'one ticket type'} only` : ''}
                </p>
              </div>
              <Button variant="ghost" size="icon-sm" aria-label="Copy code" onClick={() => navigator.clipboard.writeText(p.code).then(() => toast.success('Copied'))}>
                <Copy />
              </Button>
              <Button variant="ghost" size="icon-sm" aria-label={p.active ? 'Pause' : 'Resume'} onClick={() => setPromoActive(event.id, p.code, !p.active)}>
                {p.active ? <Pause /> : <Play />}
              </Button>
              <Button variant="ghost" size="icon-sm" className="text-muted-foreground hover:text-danger" aria-label="Delete" onClick={() => remove(p)}>
                <Trash2 />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
