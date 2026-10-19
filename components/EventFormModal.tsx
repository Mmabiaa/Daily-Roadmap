'use client'

import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import type { Day } from '@/lib/schedule'
import { haptic } from '@/lib/utils'
import type { Event } from '@/lib/models'

interface EventFormModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: () => void
  event?: Event | null
  defaultDay?: Day
}

const days: Day[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const categories = ['class', 'study', 'project', 'body', 'eat', 'people', 'rest', 'chores', 'sleep'] as const

type FormData = {
  day: Day
  time: string
  title: string
  category: (typeof categories)[number]
  note: string
  essential: boolean
}

const emptyForm = (day: Day): FormData => ({
  day,
  time: '',
  title: '',
  category: 'study',
  note: '',
  essential: false,
})

export default function EventFormModal({ isOpen, onClose, onSave, event, defaultDay = 'Mon' }: EventFormModalProps) {
  const [formData, setFormData] = useState<FormData>(emptyForm(defaultDay))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Reset the form each time it opens so a previous edit never leaks into a new event.
  useEffect(() => {
    if (!isOpen) return
    setError('')
    setLoading(false)
    setFormData(
      event
        ? {
            day: event.day,
            time: event.time,
            title: event.title,
            category: event.category,
            note: event.note || '',
            essential: event.essential || false,
          }
        : emptyForm(defaultDay)
    )
  }, [isOpen, event, defaultDay])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const url = event?._id ? `/api/events/${event._id}` : '/api/events'
      const method = event?._id ? 'PATCH' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to save event')
      }

      onSave()
      onClose()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!event?._id || !confirm('Are you sure you want to delete this event?')) return

    setLoading(true)
    try {
      const res = await fetch(`/api/events/${event._id}`, {
        method: 'DELETE',
      })

      if (!res.ok) {
        throw new Error('Failed to delete event')
      }

      onSave()
      onClose()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

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

        <form className="event-form" onSubmit={handleSubmit}>
          <div className="event-field">
            <label htmlFor="event-title">Title</label>
            <input
              id="event-title"
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="Study session"
              required
            />
          </div>

          <div className="event-row">
            <div className="event-field">
              <label htmlFor="event-day">Day</label>
              <select
                id="event-day"
                value={formData.day}
                onChange={(e) => setFormData({ ...formData, day: e.target.value as Day })}
                required
              >
                {days.map((day) => (
                  <option key={day} value={day}>
                    {day}
                  </option>
                ))}
              </select>
            </div>

            <div className="event-field">
              <label htmlFor="event-time">Start time</label>
              <input
                id="event-time"
                type="text"
                value={formData.time}
                onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                placeholder="08:30"
                inputMode="numeric"
                required
              />
            </div>
          </div>

          <div className="event-field">
            <label htmlFor="event-category">Category</label>
            <select
              id="event-category"
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value as FormData['category'] })}
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
            <label htmlFor="event-note">Note (optional)</label>
            <textarea
              id="event-note"
              value={formData.note}
              onChange={(e) => setFormData({ ...formData, note: e.target.value })}
              rows={3}
              placeholder="Additional details..."
            />
          </div>

          <label className="event-check" htmlFor="event-essential">
            <input
              id="event-essential"
              type="checkbox"
              checked={formData.essential}
              onChange={(e) => setFormData({ ...formData, essential: e.target.checked })}
            />
            Mark as essential
          </label>

          {error && <p className="event-error">{error}</p>}

          <div className="event-actions">
            <button type="submit" className="event-save" disabled={loading}>
              {loading ? 'Saving...' : event ? 'Save changes' : 'Add event'}
            </button>
            {event && (
              <button type="button" className="event-delete" onClick={handleDelete} disabled={loading}>
                Delete
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  )
}
