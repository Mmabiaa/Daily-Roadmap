import { z } from 'zod'

export const EventSchema = z.object({
  _id: z.string().optional(),
  day: z.enum(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']),
  time: z.string(),
  title: z.string().min(1),
  category: z.enum(['class', 'study', 'project', 'body', 'eat', 'people', 'rest', 'chores', 'sleep']),
  note: z.string().optional(),
  essential: z.boolean().optional(),
})

export type Event = z.infer<typeof EventSchema>

export const UserSchema = z.object({
  _id: z.string().optional(),
  username: z.string().min(1),
  pinHash: z.string(),
})

export type User = z.infer<typeof UserSchema>
