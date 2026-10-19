import { NextResponse } from 'next/server'
import { getDb } from '@/lib/mongodb'
import { verifyPin, generateToken, setSession } from '@/lib/auth'

export async function POST(request: Request) {
  try {
    const { username, pin } = await request.json()
    
    if (!username || !pin) {
      return NextResponse.json(
        { error: 'Username and PIN are required' },
        { status: 400 }
      )
    }
    
    const db = await getDb()
    const user = await db.collection('users').findOne({ username })
    
    if (!user) {
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      )
    }
    
    const isValid = await verifyPin(pin, user.pinHash)
    
    if (!isValid) {
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      )
    }
    
    const token = generateToken(user._id.toString())
    await setSession(token)
    
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Sign in error:', error)
    return NextResponse.json(
      { error: 'Sign in failed' },
      { status: 500 }
    )
  }
}
