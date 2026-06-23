import { useEffect, useState } from 'react'
import { ApiError } from '../../api/types'
import { dislikeMenu, fetchMenus, likeMenu, type MenuCategory, type MenuItem } from '../../customer/menuApi'

type Status = 'loading' | 'ready' | 'error'
type Reaction = 'like' | 'dislike'

const CATEGORIES: { value: MenuCategory | 'ALL'; label: string }[] = [
  { value: 'ALL', label: '전체' },
  { value: 'SUSHI', label: '초밥' },
  { value: 'ROLL', label: '롤' },
  { value: 'SIDE', label: '사이드' },
  { value: 'DRINK', label: '음료' },
  { value: 'DESSERT', label: '디저트' },
]

function MenuListPage() {
  const [status, setStatus] = useState<Status>('loading')
  const [errorMessage, setErrorMessage] = useState('')
  const [menus, setMenus] = useState<MenuItem[]>([])
  const [category, setCategory] = useState<MenuCategory | 'ALL'>('ALL')
  const [reactions, setReactions] = useState<Record<number, Reaction>>({})

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
    if (reactions[menuId]) return

    setReactions((prev) => ({ ...prev, [menuId]: reaction }))
    applyDelta(menuId, reaction, 1)

    const request = reaction === 'like' ? likeMenu(menuId) : dislikeMenu(menuId)
    request.catch(() => {
      setReactions((prev) => {
        const next = { ...prev }
        delete next[menuId]
        return next
      })
      applyDelta(menuId, reaction, -1)
    })
  }

  if (status === 'loading') {
    return <p className="px-4 py-10 text-center text-muted">메뉴를 불러오는 중입니다...</p>
  }

  if (status === 'error') {
    return <p className="px-4 py-10 text-center text-red-600">{errorMessage}</p>
  }

  const filtered = category === 'ALL' ? menus : menus.filter((menu) => menu.category === category)

  return (
    <div className="bg-surface pb-6">
      <div className="sticky top-0 z-10 bg-surface/95 px-4 py-3 backdrop-blur">
        <div className="flex gap-2 overflow-x-auto">
          {CATEGORIES.map((c) => (
            <button
              key={c.value}
              type="button"
              aria-pressed={category === c.value}
              onClick={() => setCategory(c.value)}
              className={
                category === c.value
                  ? 'shrink-0 rounded-full bg-primary-500 px-4 py-2 text-sm font-medium text-white'
                  : 'shrink-0 rounded-full border border-primary-100 bg-white px-4 py-2 text-sm font-medium text-ink/70'
              }
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4">
        {filtered.length === 0 ? (
          <p className="py-10 text-center text-muted">표시할 메뉴가 없습니다.</p>
        ) : (
          <ul className="grid gap-3">
            {filtered.map((menu) => {
              const reaction = reactions[menu.id]
              return (
                <li key={menu.id} className="flex gap-3 rounded-card bg-surface-raised p-3 shadow-sm">
                  <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-secondary-50">
                    {menu.imageUrl && (
                      <img src={menu.imageUrl} alt={menu.name} className="h-full w-full object-cover" />
                    )}
                  </div>
                  <div className="flex flex-1 flex-col justify-center">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-ink">{menu.name}</h3>
                      {menu.limitedStock && (
                        <span className="rounded-full bg-accent-400 px-2 py-0.5 text-xs font-medium text-white">
                          마감임박
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-sm text-muted">{menu.description}</p>
                    <p className="mt-1 font-bold text-primary-600">{menu.price.toLocaleString()}원</p>

                    <div className="mt-2 flex gap-2">
                      <button
                        type="button"
                        disabled={Boolean(reaction)}
                        onClick={() => handleReact(menu.id, 'like')}
                        className={
                          reaction === 'like'
                            ? 'rounded-full bg-primary-500 px-2.5 py-1 text-xs font-medium text-white'
                            : 'rounded-full bg-primary-50 px-2.5 py-1 text-xs font-medium text-primary-600 disabled:opacity-50'
                        }
                      >
                        좋아요 {menu.likeCount}
                      </button>
                      <button
                        type="button"
                        disabled={Boolean(reaction)}
                        onClick={() => handleReact(menu.id, 'dislike')}
                        className={
                          reaction === 'dislike'
                            ? 'rounded-full bg-ink/70 px-2.5 py-1 text-xs font-medium text-white'
                            : 'rounded-full bg-ink/5 px-2.5 py-1 text-xs font-medium text-muted disabled:opacity-50'
                        }
                      >
                        싫어요 {menu.dislikeCount}
                      </button>
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}

export default MenuListPage
