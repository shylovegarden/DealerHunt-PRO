import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default function WatchlistRedirect() {
  redirect('/fleet')
}

