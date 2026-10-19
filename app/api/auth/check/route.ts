import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyToken } from '@/lib/auth'

export async function GET() {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get('auth-token')?.value
    
    if (!token) {
      return NextResponse.json({ authenticated: false })
    }
    
    const payload = verifyToken(token)
    
    if (!payload) {
      return NextResponse.json({ authenticated: false })
    }
    
    return NextResponse.json({ authenticated: true, userId: payload.userId })
  } catch (error) {
    return NextResponse.json({ authenticated: false })
  }
}
