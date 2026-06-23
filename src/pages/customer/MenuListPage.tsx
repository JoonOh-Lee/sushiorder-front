import { useEffect, useMemo, useState } from 'react'
import { ApiError } from '../../api/types'
import { dislikeMenu, fetchMenus, likeMenu, type MenuItem } from '../../customer/menuApi'
import { MenuThumbnail } from '../../customer/MenuThumbnail'
import { CartIcon, ThumbDownIcon, ThumbUpIcon } from '../../customer/icons'
import MenuQuantitySheet from './MenuQuantitySheet'

type Status = 'loading' | 'ready' | 'error'
type Reaction = 'like' | 'dislike'

interface MenuListPageProps {
  cartQuantities: Record<number, number>
  onQuantityChange: (menu: MenuItem, quantity: number) => void
}

// 백엔드 카테고리 키 → 한글 라벨. 매핑이 없는 새 카테고리가 와도 키 그대로 보여주면 되니 깨지지 않는다.
const CATEGORY_LABEL: Record<string, string> = {
  PREMIUM_SUSHI: '프리미엄초밥',
  FRESH_SUSHI: '신선초밥',
  TUNA_SUSHI: '참치초밥',
  MEAT_SUSHI: '고기초밥',
  GRILLED_SUSHI: '구운초밥',
  SEASONED_SUSHI: '양념초밥',
  GUNKAN_SUSHI: '군함초밥',
  FRIED: '튀김류',
  DESSERT_ETC: '디저트/기타',
  MEAL: '식사류',
  DRINK_ALCOHOL: '음료/주류',
  TAKEOUT: '포장',
  // 이전 카테고리 체계(마이그레이션 전 데이터 호환용)
  SUSHI: '초밥',
  ROLL: '롤',
  SIDE: '사이드',
  DRINK: '음료',
  DESSERT: '디저트',
}

// 알려진 카테고리의 표시 순서. 목록에 없는 카테고리는 뒤에 가나다순으로 붙는다.
const CATEGORY_ORDER = Object.keys(CATEGORY_LABEL)

function MenuListPage({ cartQuantities, onQuantityChange }: MenuListPageProps) {
  const [status, setStatus] = useState<Status>('loading')
  const [errorMessage, setErrorMessage] = useState('')
  const [menus, setMenus] = useState<MenuItem[]>([])
  const [category, setCategory] = useState<string>('ALL')
  const [reactions, setReactions] = useState<Record<number, Reaction>>({})
  const [activeMenu, setActiveMenu] = useState<MenuItem | null>(null)
  const [isSheetOpen, setIsSheetOpen] = useState(false)
  const [draftQuantity, setDraftQuantity] = useState(1)

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

  function openQuantitySheet(menu: MenuItem) {
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

  const filtered = category === 'ALL' ? menus : menus.filter((menu) => menu.category === category)

  return (
    <div className="flex bg-surface pb-6">
      <div className="sticky top-0 flex h-screen w-[88px] shrink-0 flex-col overflow-y-auto bg-surface-raised py-2 shadow-sm">
        {['ALL', ...categories].map((value) => (
          <button
            key={value}
            type="button"
            aria-pressed={category === value}
            onClick={() => setCategory(value)}
            className={
              category === value
                ? 'border-l-4 border-primary-500 bg-primary-50 px-2 py-4 text-sm font-bold text-primary-600 transition-colors'
                : 'border-l-4 border-transparent px-2 py-4 text-sm font-semibold text-ink/70 transition-colors'
            }
          >
            {value === 'ALL' ? '전체' : CATEGORY_LABEL[value] ?? value}
          </button>
        ))}
      </div>

      <div className="min-w-0 flex-1 px-3 pt-3">
        {filtered.length === 0 ? (
          <p className="py-12 text-center text-base text-muted">표시할 메뉴가 없습니다.</p>
        ) : (
          <ul className="grid gap-4">
            {filtered.map((menu) => {
              const reaction = reactions[menu.id]
              const quantity = cartQuantities[menu.id] ?? 0
              return (
                <li key={menu.id} className="flex gap-4 rounded-card bg-surface-raised p-4 shadow-sm">
                  <MenuThumbnail menu={menu} className="h-24 w-24 shrink-0 overflow-hidden rounded-xl bg-primary-50" />
                  <div className="flex flex-1 flex-col justify-center">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-lg font-bold text-ink">{menu.name}</h3>
                      {menu.limitedStock && (
                        <span className="shrink-0 whitespace-nowrap rounded-full bg-accent-400 px-2.5 py-1 text-xs font-semibold text-white">
                          마감임박
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-base text-muted">{menu.description}</p>
                    <p className="mt-1 text-lg font-bold text-primary-600">{menu.price.toLocaleString()}원</p>

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
                        aria-label={`${menu.name} 담기`}
                        onClick={() => openQuantitySheet(menu)}
                        className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-500 text-white transition-transform active:scale-90"
                      >
                        <CartIcon className="h-5 w-5" />
                        {quantity > 0 && (
                          <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-accent-500 text-[11px] font-bold text-white">
                            {quantity}
                          </span>
                        )}
                      </button>
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <MenuQuantitySheet
        menu={activeMenu}
        quantity={draftQuantity}
        isOpen={isSheetOpen}
        onIncrement={() => setDraftQuantity((q) => q + 1)}
        onDecrement={() => setDraftQuantity((q) => Math.max(1, q - 1))}
        onConfirm={confirmQuantity}
        onClose={() => setIsSheetOpen(false)}
      />
    </div>
  )
}

export default MenuListPage
