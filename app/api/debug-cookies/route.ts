import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export async function GET() {
  try {
    const cookieStore = await cookies()
    const allCookies = cookieStore.getAll()
    
    return NextResponse.json({
      cookies: allCookies,
      count: allCookies.length,
      hasAuthToken: !!cookieStore.get('auth-token')
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
