import { useState } from 'react'
import { CATEGORY_EMOJI } from '../constants/menu'

interface MenuThumbnailProps {
  menu: { imageUrl?: string | null; category: string; name: string }
  className: string
}

export function MenuThumbnail({ menu, className }: MenuThumbnailProps) {
  const [err, setErr] = useState(false)

  if (!menu.imageUrl || err) {
    return (
      <div className={`flex items-center justify-center bg-primary-50 text-xl ${className}`}>
        {CATEGORY_EMOJI[menu.category] ?? '🍣'}
      </div>
    )
  }

  return (
    <div className={className}>
      <img
        src={menu.imageUrl}
        alt={menu.name}
        className="h-full w-full object-cover"
        onError={() => setErr(true)}
      />
    </div>
  )
}
