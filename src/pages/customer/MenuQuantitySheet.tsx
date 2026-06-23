import type { MenuItem } from '../../customer/menuApi'
import { MenuThumbnail } from '../../customer/MenuThumbnail'

interface MenuQuantitySheetProps {
  menu: MenuItem | null
  quantity: number
  isOpen: boolean
  onIncrement: () => void
  onDecrement: () => void
  onConfirm: () => void
  onClose: () => void
}

function MenuQuantitySheet({ menu, quantity, isOpen, onIncrement, onDecrement, onConfirm, onClose }: MenuQuantitySheetProps) {
  return (
    <div
      className={`fixed inset-0 z-40 transition-opacity duration-300 ${
        isOpen ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'
      }`}
    >
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div
        className={`absolute inset-x-0 bottom-0 rounded-t-3xl bg-surface-raised p-5 transition-transform duration-300 ${
          isOpen ? 'translate-y-0' : 'translate-y-full'
        }`}
      >
        {menu && (
          <>
            <div className="flex gap-4">
              <MenuThumbnail menu={menu} className="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-primary-50" />
              <div className="flex flex-1 flex-col justify-center">
                <h3 className="text-lg font-bold text-ink">{menu.name}</h3>
                <p className="mt-1 text-lg font-bold text-primary-600">{menu.price.toLocaleString()}원</p>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-center gap-6">
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
              className="mt-6 w-full rounded-full bg-primary-500 py-4 text-base font-semibold text-white transition-transform active:scale-[0.98]"
            >
              담기 · {(menu.price * quantity).toLocaleString()}원
            </button>
          </>
        )}
      </div>
    </div>
  )
}

export default MenuQuantitySheet
