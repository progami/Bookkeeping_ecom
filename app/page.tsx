import { redirect } from 'next/navigation'

export default function Home() {
  // Redirect to the main dashboard (Finance Overview) instead of login
  // The middleware will handle authentication if needed
  redirect('/finance')
}