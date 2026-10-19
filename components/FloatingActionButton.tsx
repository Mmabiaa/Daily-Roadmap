'use client'

import { Plus } from 'lucide-react'

interface FloatingActionButtonProps {
  onClick: () => void
}

export default function FloatingActionButton({ onClick }: FloatingActionButtonProps) {
  return (
    <button type="button" className="fab" aria-label="Add event" onClick={onClick}>
      <Plus aria-hidden="true" />
    </button>
  )
}
