import React from 'react'
import { ArrowLeft } from 'lucide-react'
import { useRouter } from 'next/navigation'

interface BackButtonProps {
  label?: string
  href?: string
  onClick?: () => void
}

export function BackButton({ label = 'Back', href, onClick }: BackButtonProps) {
  const router = useRouter()
  
  const handleClick = () => {
    if (onClick) {
      onClick()
    } else if (href) {
      router.push(href)
    } else {
      router.back()
    }
  }
  
  return (
    <button
      onClick={handleClick}
      className="text-gray-400 hover:text-white transition-colors mb-4 inline-flex items-center group"
    >
      <ArrowLeft className="h-4 w-4 mr-2 group-hover:-translate-x-1 transition-transform" />
      {label}
    </button>
  )
}