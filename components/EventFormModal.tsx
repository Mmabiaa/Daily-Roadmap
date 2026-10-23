'use client'

import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import { Category, Day, days } from '@/lib/schedule'
import type { Kind, Repeat } from '@/lib/models'
import { haptic } from '@/lib/utils'

/** The event behind a block, as the form needs it: what it says, and how it repeats. */
export type EditTarget = {
  id: string
  /** The date the block was opened from — the point a series edit splits at. */
  date: string
  title: string
  category: Category
  kind: Kind
  start: string
  end: string
  essential: boolean
  note?: string
  repeat: Repeat
  startDate?: string
  endDate?: string
}

interface EventFormModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: () => void
  /** The event being edited, or nothing for a new one. */
  event?: EditTarget | null
  /** The weekday a new event starts on. */
  defaultDay?: Day
  /** The date a new event starts on, used as the one-off date. */
  defaultDate?: string
}

const categories: Category[] = ['class', 'study', 'project', 'body', 'eat', 'people', 'rest', 'chores', 'sleep']

/** What the form holds while it is open, whichever shape it opened in. */
type Draft = {
  title: string
  category: Category
  kind: Kind
  start: string
  end: string
  mode: 'weekly' | 'once'
  days: Day[]
  date: string
  endDate: string
  essential: boolean
  note: string
}

const emptyDraft = (day: Day, date: string): Draft => ({
  title: '',
  category: 'study',
  kind: 'fixed',
  start: '',
  end: '',
  mode: 'weekly',
  days: [day],
  date,
  endDate: '',
  essential: false,
  note: '',
})

const draftOf = (event: EditTarget): Draft => ({
  title: event.title,
  category: event.category,
  kind: event.kind,
  start: event.start,
  end: event.end,
  mode: event.repeat.type,
  days: event.repeat.type === 'weekly' ? ([...event.repeat.days] as Day[]) : [],
  date: event.repeat.type === 'once' ? event.repeat.date : event.date,
  endDate: event.endDate ?? '',
  essential: event.essential,
  note: event.note ?? '',
})

/** The request body both create and edit send. */
const bodyOf = (draft: Draft) => ({
  title: draft.title.trim(),
  category: draft.category,
  kind: draft.kind,
  start: draft.start,
  end: draft.end,
  repeat:
    draft.mode === 'once'
      ? { type: 'once' as const, date: draft.date }
      : { type: 'weekly' as const, days: draft.days },
  // A one-off is dated by its own `repeat.date`, so it carries no window.
  ...(draft.mode === 'weekly' && draft.endDate ? { endDate: draft.endDate } : {}),
  essential: draft.essential,
  ...(draft.note.trim() ? { note: draft.note.trim() } : {}),
})

/** The first thing wrong with the draft, or `null`. The server re-checks all of it. */
function problemWith(draft: Draft): string | null {
  if (!draft.title.trim()) return 'Give the block a title.'
  if (!draft.start || !draft.end) return 'Set a start and an end time.'
  if (draft.start === draft.end) return 'The end time must differ from the start time.'
  if (draft.mode === 'weekly' && draft.days.length === 0) return 'Pick at least one weekday.'
  if (draft.mode === 'once' && !draft.date) return 'Pick a date for the one-off.'
  return null
}

async function messageFrom(res: Response): Promise<string> {
  try {
    const data = await res.json()
    return typeof data?.error === 'string' ? data.error : `Request failed (${res.status})`
  } catch {
    return `Request failed (${res.status})`
  }
}

export default function EventFormModal({
  isOpen,
  onClose,
  onSave,
  event,
  defaultDay = 'Mon',
  defaultDate = '',
}: EventFormModalProps) {
  const [draft, setDraft] = useState<Draft>(emptyDraft(defaultDay, defaultDate))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Reset the form each time it opens so a previous edit never leaks into a new event.
  useEffect(() => {
    if (!isOpen) return
    setError('')
    setLoading(false)
    setDraft(event ? draftOf(event) : emptyDraft(defaultDay, defaultDate))
  }, [isOpen, event, defaultDay, defaultDate])

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((current) => ({ ...current, [key]: value }))

  const toggleDay = (day: Day) =>
    setDraft((current) => ({
      ...current,
      days: current.days.includes(day)
        ? current.days.filter((d) => d !== day)
        : [...current.days, day],
    }))

  const submit = async (scope: 'this' | 'future' = 'future') => {
    const problem = problemWith(draft)
    if (problem) {
      setError(problem)
      return
    }

    setError('')
    setLoading(true)
    try {
      // An edit always names the date it was opened from: it is the split point
      // for a series, and replacing a one-off needs a date too.
      const body = event ? { ...bodyOf(draft), scope, date: event.date } : bodyOf(draft)
      const res = await fetch(event ? `/api/events/${event.id}` : '/api/events', {
        method: event ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error(await messageFrom(res))

      onSave()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the event')
    } finally {
      setLoading(false)
    }
  }

  const remove = async (scope?: 'this' | 'future') => {
    if (!event) return
    if (scope === 'future' && !confirm('Remove every future day of this event?')) return

    setError('')
    setLoading(true)
    try {
      const query = scope ? `?scope=${scope}&date=${event.date}` : ''
      const res = await fetch(`/api/events/${event.id}${query}`, { method: 'DELETE' })
      if (!res.ok) throw new Error(await messageFrom(res))

      onSave()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not remove the event')
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  // A stored series is edited day-by-day or from today on; a one-off has one form.
  const repeats = draft.mode === 'weekly'

  return (
    <div className="event-backdrop" role="presentation" onClick={onClose}>
      <div
        className="event-modal"
        role="dialog"
        aria-modal="true"
        aria-label={event ? 'Edit event' : 'Add event'}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="event-modal-head">
          <h2>{event ? 'Edit event' : 'New event'}</h2>
          <button
            type="button"
            className="event-close"
            aria-label="Close"
            onClick={() => {
              haptic(5)
              onClose()
            }}
          >
            <X aria-hidden="true" />
          </button>
        </div>

        <form
          className="event-form"
          onSubmit={(e) => {
            e.preventDefault()
            submit()
          }}
        >
          <div className="event-field">
            <label htmlFor="event-title">Title</label>
            <input
              id="event-title"
              type="text"
              value={draft.title}
              onChange={(e) => set('title', e.target.value)}
              placeholder="Study session"
              required
            />
          </div>

          <div className="event-row">
            <div className="event-field">
              <label htmlFor="event-category">Category</label>
              <select
                id="event-category"
                value={draft.category}
                onChange={(e) => set('category', e.target.value as Category)}
                required
              >
                {categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div className="event-field">
              <label htmlFor="event-kind">Type</label>
              <select
                id="event-kind"
                value={draft.kind}
                onChange={(e) => set('kind', e.target.value as Kind)}
                required
              >
                <option value="fixed">Fixed — set time</option>
                <option value="flexible">Flexible — can move</option>
              </select>
            </div>
          </div>

          <div className="event-row">
            <div className="event-field">
              <label htmlFor="event-start">Start time</label>
              <input
                id="event-start"
                type="time"
                value={draft.start}
                onChange={(e) => set('start', e.target.value)}
                required
              />
            </div>

            <div className="event-field">
              <label htmlFor="event-end">End time</label>
              <input
                id="event-end"
                type="time"
                value={draft.end}
                onChange={(e) => set('end', e.target.value)}
                required
              />
            </div>
          </div>

          {/* A stored series keeps its shape: the mode is only chosen for a new event. */}
          {!event && (
            <div className="event-field">
              <span>Repeats</span>
              <div className="mode-toggle" role="group" aria-label="How the event repeats">
                <button
                  type="button"
                  aria-pressed={draft.mode === 'weekly'}
                  onClick={() => set('mode', 'weekly')}
                >
                  Every week
                </button>
                <button
                  type="button"
                  aria-pressed={draft.mode === 'once'}
                  onClick={() => set('mode', 'once')}
                >
                  Once
                </button>
              </div>
            </div>
          )}

          {repeats ? (
            <>
              <div className="event-field">
                <span>On these days</span>
                <div className="day-tabs" role="group" aria-label="Days the event repeats on">
                  {days.map((day) => (
                    <button
                      key={day}
                      type="button"
                      aria-pressed={draft.days.includes(day)}
                      onClick={() => toggleDay(day)}
                      className={draft.days.includes(day) ? 'selected' : ''}
                    >
                      <span>{day.slice(0, 1)}</span>
                      <small>{day}</small>
                    </button>
                  ))}
                </div>
              </div>

              <div className="event-field">
                <label htmlFor="event-end-date">Repeats until (optional)</label>
                <input
                  id="event-end-date"
                  type="date"
                  value={draft.endDate}
                  onChange={(e) => set('endDate', e.target.value)}
                />
              </div>
            </>
          ) : (
            <div className="event-field">
              <label htmlFor="event-date">Date</label>
              <input
                id="event-date"
                type="date"
                value={draft.date}
                onChange={(e) => set('date', e.target.value)}
                required
              />
            </div>
          )}

          <div className="event-field">
            <label htmlFor="event-note">Note (optional)</label>
            <textarea
              id="event-note"
              value={draft.note}
              onChange={(e) => set('note', e.target.value)}
              rows={3}
              placeholder="Additional details..."
            />
          </div>

          <label className="event-check" htmlFor="event-essential">
            <input
              id="event-essential"
              type="checkbox"
              checked={draft.essential}
              onChange={(e) => set('essential', e.target.checked)}
            />
            Mark as essential
          </label>

          {error && <p className="event-error">{error}</p>}

          {event ? (
            <>
              <div className="event-actions">
                {repeats ? (
                  <>
                    <button type="button" className="event-save" disabled={loading} onClick={() => submit('this')}>
                      Save this day
                    </button>
                    <button type="button" className="event-save" disabled={loading} onClick={() => submit('future')}>
                      Save future days
                    </button>
                  </>
                ) : (
                  <button type="button" className="event-save" disabled={loading} onClick={() => submit()}>
                    {loading ? 'Saving...' : 'Save changes'}
                  </button>
                )}
              </div>

              <div className="event-actions">
                {repeats ? (
                  <>
                    <button type="button" className="event-delete" disabled={loading} onClick={() => remove('this')}>
                      Remove this day
                    </button>
                    <button type="button" className="event-delete" disabled={loading} onClick={() => remove('future')}>
                      Remove future days
                    </button>
                  </>
                ) : (
                  <button type="button" className="event-delete" disabled={loading} onClick={() => remove()}>
                    Delete
                  </button>
                )}
              </div>
            </>
          ) : (
            <div className="event-actions">
              <button type="submit" className="event-save" disabled={loading}>
                {loading ? 'Adding...' : 'Add event'}
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  )
}
