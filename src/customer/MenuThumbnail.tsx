import type { MenuItem } from './menuApi'

interface MenuThumbnailProps {
  menu: MenuItem
  className: string
}

export function MenuThumbnail({ menu, className }: MenuThumbnailProps) {
  return (
    <div className={className}>
      {menu.imageUrl ? (
        <img
          src={menu.imageUrl}
          alt={menu.name}
          className="h-full w-full object-cover"
          onError={(e) => {
            e.currentTarget.onerror = null
            e.currentTarget.src = '/nodata.svg'
            e.currentTarget.className = 'h-full w-full object-contain p-3'
          }}
        />
      ) : (
        <img src="/nodata.svg" alt="이미지 없음" className="h-full w-full object-contain p-3" />
      )}
    </div>
  )
}
