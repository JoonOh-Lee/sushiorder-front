import type { MenuItem } from '../../customer/menuApi'
import { MenuThumbnail } from '../../customer/MenuThumbnail'

interface MenuDetailSheetProps {
  menu: MenuItem | null
  quantity: number
  isOpen: boolean
  onIncrement: () => void
  onDecrement: () => void
  onConfirm: () => void
  onClose: () => void
  onImageClick: (imageUrl: string) => void
}

function MenuDetailSheet({
  menu,
  quantity,
  isOpen,
  onIncrement,
  onDecrement,
  onConfirm,
  onClose,
  onImageClick,
}: MenuDetailSheetProps) {
  return (
    <div
      className={`fixed inset-0 z-40 transition-opacity duration-300 ${
        isOpen ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'
      }`}
    >
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div
        className={`absolute inset-x-0 bottom-0 max-h-[85vh] overflow-y-auto rounded-t-3xl bg-surface-raised p-5 transition-transform duration-300 ${
          isOpen ? 'translate-y-0' : 'translate-y-full'
        }`}
      >
        {menu && (
          <>
            <button
              type="button"
              aria-label="사진 확대"
              onClick={() => menu.imageUrl && onImageClick(menu.imageUrl)}
              className="block w-full"
            >
              <MenuThumbnail menu={menu} className="h-44 w-full overflow-hidden rounded-2xl bg-primary-50" />
            </button>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <h3 className="text-xl font-bold text-ink">{menu.name}</h3>
              {menu.limitedStock && (
                <span className="shrink-0 whitespace-nowrap rounded-full bg-accent-400 px-2.5 py-1 text-xs font-semibold text-white">
                  마감임박
                </span>
              )}
            </div>
            <p className="mt-1 text-lg font-bold text-primary-600">{menu.price.toLocaleString()}원</p>
            <p className="mt-2 text-base text-muted">{menu.description}</p>

            <dl className="mt-4 grid gap-2 rounded-xl bg-surface px-4 py-3 text-sm">
              {menu.ingredients && (
                <div className="flex gap-2">
                  <dt className="shrink-0 font-semibold text-ink">원재료</dt>
                  <dd className="text-muted">{menu.ingredients}</dd>
                </div>
              )}
              {menu.allergyInfo && (
                <div className="flex gap-2">
                  <dt className="shrink-0 font-semibold text-ink">알레르기</dt>
                  <dd className="text-muted">{menu.allergyInfo}</dd>
                </div>
              )}
            </dl>

            <div className="mt-5 flex items-center justify-center gap-6">
              <button
                type="button"
                aria-label="수량 줄이기"
                onClick={onDecrement}
                className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-100 text-xl font-bold text-primary-600 transition-transform active:scale-90"
              >
                −
              </button>
              <span className="w-10 text-center text-2xl font-bold text-ink">{quantity}</span>
              <button
                type="button"
                aria-label="수량 늘리기"
                onClick={onIncrement}
                className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-500 text-xl font-bold text-white transition-transform active:scale-90"
              >
                +
              </button>
            </div>

            <button
              type="button"
              onClick={onConfirm}
              className="mt-5 w-full rounded-full bg-primary-500 py-4 text-base font-semibold text-white transition-transform active:scale-[0.98]"
            >
              담기 · {(menu.price * quantity).toLocaleString()}원
            </button>
          </>
        )}
      </div>
    </div>
  )
}

export default MenuDetailSheet
