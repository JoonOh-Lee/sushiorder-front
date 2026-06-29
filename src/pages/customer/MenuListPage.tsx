import { useEffect, useMemo, useState } from 'react'
import { ApiError } from '../../api/types'
import { dislikeMenu, fetchMenus, likeMenu, type MenuItem } from '../../customer/menuApi'
import { MenuThumbnail } from '../../components/MenuThumbnail'
import { ImageLightbox } from '../../components/ImageLightbox'
import { CartIcon, ThumbDownIcon, ThumbUpIcon } from '../../components/icons'
import { CATEGORY_LABEL, CATEGORY_NOTE, CATEGORY_ORDER } from '../../constants/menu'
import MenuDetailSheet from './MenuDetailSheet'

type Status = 'loading' | 'ready' | 'error'
type Reaction = 'like' | 'dislike'

interface MenuListPageProps {
  cartQuantities: Record<number, number>
  onQuantityChange: (menu: MenuItem, quantity: number) => void
}


function MenuListPage({ cartQuantities, onQuantityChange }: MenuListPageProps) {
  const [status, setStatus] = useState<Status>('loading')
  const [errorMessage, setErrorMessage] = useState('')
  const [menus, setMenus] = useState<MenuItem[]>([])
  const [category, setCategory] = useState<string>('')
  const [reactions, setReactions] = useState<Record<number, Reaction>>({})
  const [activeMenu, setActiveMenu] = useState<MenuItem | null>(null)
  const [isSheetOpen, setIsSheetOpen] = useState(false)
  const [draftQuantity, setDraftQuantity] = useState(1)
  const [zoomImage, setZoomImage] = useState<string | null>(null)

  const categories = useMemo(() => {
    const present = Array.from(new Set(menus.map((menu) => menu.category)))
    present.sort((a, b) => {
      const ai = CATEGORY_ORDER.indexOf(a)
      const bi = CATEGORY_ORDER.indexOf(b)
      if (ai === -1 && bi === -1) return a.localeCompare(b)
      if (ai === -1) return 1
      if (bi === -1) return -1
      return ai - bi
    })
    return present
  }, [menus])

  useEffect(() => {
    fetchMenus()
      .then((result) => {
        setMenus(result)
        setStatus('ready')
      })
      .catch((err: unknown) => {
        setErrorMessage(err instanceof ApiError ? err.message : '메뉴를 불러오지 못했습니다.')
        setStatus('error')
      })
  }, [])

  function applyDelta(id: number, reaction: Reaction, delta: 1 | -1) {
    setMenus((prev) =>
      prev.map((m) =>
        m.id === id
          ? reaction === 'like'
            ? { ...m, likeCount: m.likeCount + delta }
            : { ...m, dislikeCount: m.dislikeCount + delta }
          : m,
      ),
    )
  }

  function handleReact(menuId: number, reaction: Reaction) {
    const current = reactions[menuId]

    // 같은 버튼을 다시 누르면 해제 — 백엔드엔 취소 API가 없어서 화면에서만 되돌린다.
    if (current === reaction) {
      setReactions((prev) => {
        const next = { ...prev }
        delete next[menuId]
        return next
      })
      applyDelta(menuId, reaction, -1)
      return
    }

    if (current) {
      applyDelta(menuId, current, -1)
    }

    setReactions((prev) => ({ ...prev, [menuId]: reaction }))
    applyDelta(menuId, reaction, 1)

    const request = reaction === 'like' ? likeMenu(menuId) : dislikeMenu(menuId)
    request.catch(() => {
      setReactions((prev) => {
        const next = { ...prev }
        if (current) next[menuId] = current
        else delete next[menuId]
        return next
      })
      applyDelta(menuId, reaction, -1)
      if (current) applyDelta(menuId, current, 1)
    })
  }

  function openDetailSheet(menu: MenuItem) {
    setActiveMenu(menu)
    setDraftQuantity(cartQuantities[menu.id] ?? 1)
    setIsSheetOpen(true)
  }

  function confirmQuantity() {
    if (activeMenu) {
      onQuantityChange(activeMenu, draftQuantity)
    }
    setIsSheetOpen(false)
  }

  if (status === 'loading') {
    return <p className="px-4 py-12 text-center text-base text-muted">메뉴를 불러오는 중입니다...</p>
  }

  if (status === 'error') {
    return <p className="px-4 py-12 text-center text-base text-red-600">{errorMessage}</p>
  }

  const activeCategory = category || categories[0] || ''
  const filtered = menus.filter((menu) => menu.category === activeCategory)
  const categoryNote = CATEGORY_NOTE[activeCategory]

  return (
    <div className="flex bg-surface pb-6">
      <div className="sticky top-0 flex h-screen w-[104px] shrink-0 flex-col overflow-y-auto bg-surface-raised py-2 shadow-sm">
        {categories.map((value) => (
          <button
            key={value}
            type="button"
            aria-pressed={activeCategory === value}
            onClick={() => setCategory(value)}
            className={
              activeCategory === value
                ? 'border-l-4 border-primary-500 bg-primary-50 px-1.5 py-4 text-center text-xs font-bold leading-tight text-primary-600 transition-colors'
                : 'border-l-4 border-transparent px-1.5 py-4 text-center text-xs font-semibold leading-tight text-ink/70 transition-colors'
            }
          >
            {CATEGORY_LABEL[value] ?? value}
          </button>
        ))}
      </div>

      <div className="min-w-0 flex-1 px-3 pt-3">
        {categoryNote && (
          <div className="mb-3 flex items-center gap-2 rounded-xl bg-accent-400/15 px-3 py-2.5 text-sm font-semibold text-ink">
            <span className="shrink-0 rounded-full bg-accent-500 px-2 py-0.5 text-xs font-bold text-white">한정수량</span>
            <span>{categoryNote}</span>
          </div>
        )}
        {filtered.length === 0 ? (
          <p className="py-12 text-center text-base text-muted">표시할 메뉴가 없습니다.</p>
        ) : (
          <ul className="grid gap-4">
            {filtered.map((menu) => {
              const reaction = reactions[menu.id]
              const quantity = cartQuantities[menu.id] ?? 0
              return (
                <li
                  key={menu.id}
                  className={`rounded-card bg-surface-raised p-4 shadow-sm ${menu.soldOut ? 'opacity-60' : ''}`}
                >
                  <div className="flex w-full gap-4">
                    <button
                      type="button"
                      aria-label={`${menu.name} 사진 확대`}
                      onClick={() => menu.imageUrl && setZoomImage(menu.imageUrl)}
                      className="relative shrink-0"
                    >
                      <MenuThumbnail menu={menu} className="h-24 w-24 shrink-0 overflow-hidden rounded-xl bg-primary-50" />
                      {menu.soldOut && (
                        <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-black/40">
                          <span className="text-xs font-bold text-white">품절</span>
                        </div>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => openDetailSheet(menu)}
                      className="flex flex-1 flex-col justify-center text-left"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-lg font-bold text-ink">{menu.name}</h3>
                        {menu.soldOut ? (
                          <span className="shrink-0 whitespace-nowrap rounded-full bg-ink/30 px-2.5 py-1 text-xs font-semibold text-white">
                            품절
                          </span>
                        ) : menu.limitedStock && menu.stockCount != null && menu.stockCount <= 10 && (
                          <span className="shrink-0 whitespace-nowrap rounded-full bg-accent-400 px-2.5 py-1 text-xs font-semibold text-white">
                            마감임박
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-base text-muted">{menu.description}</p>
                      <p className="mt-1 text-lg font-bold text-primary-600">{menu.price.toLocaleString()}원</p>
                    </button>
                  </div>

                  <div className="mt-2 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        aria-label="좋아요"
                        onClick={() => handleReact(menu.id, 'like')}
                        className={
                          reaction === 'like'
                            ? 'flex items-center gap-1 rounded-full bg-primary-50 px-2.5 py-1.5 text-primary-600 transition-transform active:scale-95'
                            : 'flex items-center gap-1 rounded-full px-2.5 py-1.5 text-muted transition-transform active:scale-95'
                        }
                      >
                        <ThumbUpIcon className="h-5 w-5" />
                        <span className="text-sm font-semibold">{menu.likeCount}</span>
                      </button>
                      <button
                        type="button"
                        aria-label="싫어요"
                        onClick={() => handleReact(menu.id, 'dislike')}
                        className={
                          reaction === 'dislike'
                            ? 'flex items-center gap-1 rounded-full bg-ink/10 px-2.5 py-1.5 text-ink transition-transform active:scale-95'
                            : 'flex items-center gap-1 rounded-full px-2.5 py-1.5 text-muted transition-transform active:scale-95'
                        }
                      >
                        <ThumbDownIcon className="h-5 w-5" />
                        <span className="text-sm font-semibold">{menu.dislikeCount}</span>
                      </button>
                    </div>

                    <button
                      type="button"
                      aria-label={menu.soldOut ? '품절된 메뉴' : `${menu.name} 담기`}
                      onClick={() => !menu.soldOut && openDetailSheet(menu)}
                      disabled={menu.soldOut}
                      className={`relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white transition-transform ${
                        menu.soldOut
                          ? 'cursor-not-allowed bg-ink/20'
                          : 'bg-primary-500 active:scale-90'
                      }`}
                    >
                      <CartIcon className="h-5 w-5" />
                      {!menu.soldOut && quantity > 0 && (
                        <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-accent-500 text-[11px] font-bold text-white">
                          {quantity}
                        </span>
                      )}
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <MenuDetailSheet
        menu={activeMenu}
        quantity={draftQuantity}
        isOpen={isSheetOpen}
        onIncrement={() => setDraftQuantity((q) => q + 1)}
        onDecrement={() => setDraftQuantity((q) => Math.max(1, q - 1))}
        onConfirm={confirmQuantity}
        onClose={() => setIsSheetOpen(false)}
        onImageClick={setZoomImage}
      />

      <ImageLightbox imageUrl={zoomImage} onClose={() => setZoomImage(null)} />
    </div>
  )
}

export default MenuListPage
