import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ApiError } from '../../api/types'
import {
  activateMenu,
  changeMenuPrice,
  createMenu,
  deactivateMenu,
  listAllMenus,
  restockMenu,
  updateMenu,
  type MenuCreateInput,
} from '../../auth/adminMenuApi'
import { getStaffAuth } from '../../auth/staffAuth'
import { listStations, type Station } from '../../auth/stationApi'
import type { MenuItem } from '../../customer/menuApi'

type Status = 'loading' | 'ready' | 'error'

const CATEGORY_LABEL: Record<string, string> = {
  DESSERT_ETC: '디저트·기타',
  DRINK_ALCOHOL: '음료·주류',
  FRESH_SUSHI: '생선초밥',
  FRIED: '튀김',
  GRILLED_SUSHI: '구이초밥',
  GUNKAN_SUSHI: '군함초밥',
  MEAL: '식사',
  MEAT_SUSHI: '육류초밥',
  PREMIUM_SUSHI: '프리미엄',
  SEASONED_SUSHI: '조미초밥',
  TAKEOUT: '포장',
  TUNA_SUSHI: '참치초밥',
}

function categoryLabel(cat: string) {
  return CATEGORY_LABEL[cat] ?? cat
}

// ── 생성/수정 모달 ──────────────────────────────────────────────────────────
interface MenuFormModalProps {
  menu: MenuItem | null // null = 신규
  stations: Station[]
  onCancel: () => void
  onSave: (menu: MenuItem) => void
}

const BLANK_FORM = {
  name: '',
  description: '',
  price: '',
  category: 'FRESH_SUSHI',
  imageUrl: '',
  stockCount: '',
  stationId: '',
}

function MenuFormModal({ menu, stations, onCancel, onSave }: MenuFormModalProps) {
  const [form, setForm] = useState(() =>
    menu
      ? {
          name: menu.name,
          description: menu.description,
          price: String(menu.price),
          category: menu.category,
          imageUrl: menu.imageUrl ?? '',
          stockCount: menu.stockCount != null ? String(menu.stockCount) : '',
          stationId: String(menu.stationId),
        }
      : { ...BLANK_FORM, stationId: stations[0] ? String(stations[0].id) : '' },
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function set(key: keyof typeof form, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSubmit() {
    if (!form.name.trim()) { setError('이름을 입력하세요.'); return }
    if (!form.price || isNaN(Number(form.price))) { setError('가격을 올바르게 입력하세요.'); return }
    if (!form.stationId) { setError('스테이션을 선택하세요.'); return }

    setSaving(true)
    setError('')
    try {
      let result: MenuItem
      if (menu) {
        result = await updateMenu(menu.id, {
          name: form.name.trim(),
          description: form.description.trim(),
          category: form.category,
          imageUrl: form.imageUrl.trim(),
        })
        if (Number(form.price) !== menu.price) {
          result = await changeMenuPrice(menu.id, Number(form.price))
        }
      } else {
        const input: MenuCreateInput = {
          name: form.name.trim(),
          description: form.description.trim(),
          price: Number(form.price),
          category: form.category,
          imageUrl: form.imageUrl.trim(),
          stockCount: form.stockCount !== '' ? Number(form.stockCount) : null,
          stationId: Number(form.stationId),
        }
        result = await createMenu(input)
      }
      onSave(result)
    } catch (e) {
      setError(e instanceof ApiError ? e.message : '저장에 실패했습니다.')
    } finally {
      setSaving(false)
    }
  }

  const categories = Object.keys(CATEGORY_LABEL)

  return (
    <div className="fixed inset-0 z-20 flex items-end justify-center bg-ink/40 sm:items-center">
      <div className="w-full max-w-md rounded-t-card bg-surface-raised p-5 shadow-xl sm:rounded-card">
        <h2 className="text-lg font-bold text-ink">{menu ? '메뉴 수정' : '메뉴 추가'}</h2>

        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

        <div className="mt-4 grid gap-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-muted">이름</label>
              <input
                value={form.name}
                onChange={(e) => set('name', e.target.value)}
                className="w-full rounded-xl border border-primary-100 bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-primary-400"
                placeholder="메뉴 이름"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-muted">가격 (원)</label>
              <input
                type="number"
                value={form.price}
                onChange={(e) => set('price', e.target.value)}
                className="w-full rounded-xl border border-primary-100 bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-primary-400"
                placeholder="4500"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-muted">설명</label>
            <textarea
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
              rows={2}
              className="w-full rounded-xl border border-primary-100 bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-primary-400 resize-none"
              placeholder="메뉴 설명"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-muted">카테고리</label>
              <select
                value={form.category}
                onChange={(e) => set('category', e.target.value)}
                className="w-full rounded-xl border border-primary-100 bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-primary-400"
              >
                {categories.map((c) => (
                  <option key={c} value={c}>{categoryLabel(c)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-muted">스테이션</label>
              <select
                value={form.stationId}
                onChange={(e) => set('stationId', e.target.value)}
                className="w-full rounded-xl border border-primary-100 bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-primary-400"
              >
                {stations.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-muted">
                재고 수량{menu ? ' (현재: ' + (menu.stockCount ?? '무제한') + ')' : ''}
              </label>
              <input
                type="number"
                value={form.stockCount}
                onChange={(e) => set('stockCount', e.target.value)}
                className="w-full rounded-xl border border-primary-100 bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-primary-400"
                placeholder="빈칸=무제한"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-muted">이미지 URL</label>
              <input
                value={form.imageUrl}
                onChange={(e) => set('imageUrl', e.target.value)}
                className="w-full rounded-xl border border-primary-100 bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-primary-400"
                placeholder="https://..."
              />
            </div>
          </div>
        </div>

        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-full bg-ink/10 py-2.5 text-sm font-semibold text-ink active:scale-95"
          >
            취소
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={saving}
            className="flex-1 rounded-full bg-primary-500 py-2.5 text-sm font-semibold text-white active:scale-95 disabled:opacity-50"
          >
            {saving ? '저장 중...' : '저장'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── 재고 보충 모달 ──────────────────────────────────────────────────────────
interface RestockModalProps {
  menu: MenuItem
  onCancel: () => void
  onDone: (menu: MenuItem) => void
}

function RestockModal({ menu, onCancel, onDone }: RestockModalProps) {
  const [qty, setQty] = useState('10')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleRestock() {
    const n = Number(qty)
    if (!n || n <= 0) { setError('수량을 입력하세요.'); return }
    setSaving(true)
    try {
      const updated = await restockMenu(menu.id, n)
      onDone(updated)
    } catch (e) {
      setError(e instanceof ApiError ? e.message : '실패했습니다.')
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-ink/40 px-4">
      <div className="w-full max-w-xs rounded-card bg-surface-raised p-5 shadow-xl">
        <h3 className="font-bold text-ink">{menu.name}</h3>
        <p className="mt-0.5 text-sm text-muted">
          현재 재고: {menu.stockCount != null ? `${menu.stockCount}개` : '무제한'}
        </p>
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        <div className="mt-4">
          <label className="mb-1 block text-xs font-semibold text-muted">보충 수량</label>
          <input
            type="number"
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            autoFocus
            className="w-full rounded-xl border border-primary-100 bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-primary-400"
          />
        </div>
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-full bg-ink/10 py-2.5 text-sm font-semibold text-ink active:scale-95"
          >
            취소
          </button>
          <button
            type="button"
            onClick={handleRestock}
            disabled={saving}
            className="flex-1 rounded-full bg-primary-500 py-2.5 text-sm font-semibold text-white active:scale-95 disabled:opacity-50"
          >
            {saving ? '처리 중...' : '보충'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── 메인 페이지 ─────────────────────────────────────────────────────────────
function MenuManagePage() {
  const navigate = useNavigate()
  const [status, setStatus] = useState<Status>('loading')
  const [errorMessage, setErrorMessage] = useState('')
  const [menus, setMenus] = useState<MenuItem[]>([])
  const [stations, setStations] = useState<Station[]>([])
  const [activeCategory, setActiveCategory] = useState<string>('ALL')
  const [showCreate, setShowCreate] = useState(false)
  const [editingMenu, setEditingMenu] = useState<MenuItem | null>(null)
  const [restockTarget, setRestockTarget] = useState<MenuItem | null>(null)
  const [togglingId, setTogglingId] = useState<number | null>(null)
  const tabsRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const auth = getStaffAuth()
    if (!auth) { navigate('/staff/login'); return }
    if (auth.role !== 'ADMIN') { navigate('/staff'); return }

    Promise.all([listAllMenus(), listStations()])
      .then(([menuResult, stationResult]) => {
        setMenus(menuResult)
        setStations(stationResult)
        setStatus('ready')
      })
      .catch((err: unknown) => {
        setErrorMessage(err instanceof ApiError ? err.message : '메뉴를 불러오지 못했습니다.')
        setStatus('error')
      })
  }, [navigate])

  // 카테고리 목록 (응답 기반 동적 생성)
  const categories = ['ALL', ...Array.from(new Set(menus.map((m) => m.category))).sort()]

  const filtered =
    activeCategory === 'ALL' ? menus : menus.filter((m) => m.category === activeCategory)

  function stationName(id: number) {
    return stations.find((s) => s.id === id)?.name ?? `#${id}`
  }

  function updateInList(updated: MenuItem) {
    setMenus((prev) => prev.map((m) => (m.id === updated.id ? updated : m)))
  }

  function addToList(created: MenuItem) {
    setMenus((prev) => [created, ...prev])
  }

  async function handleToggleActive(menu: MenuItem) {
    setTogglingId(menu.id)
    try {
      const updated = menu.active ? await deactivateMenu(menu.id) : await activateMenu(menu.id)
      updateInList(updated)
    } catch (e) {
      setErrorMessage(e instanceof ApiError ? e.message : '처리에 실패했습니다.')
    } finally {
      setTogglingId(null)
    }
  }

  return (
    <div className="min-h-screen bg-surface pb-6">
      <header className="flex items-center gap-3 bg-primary-500 px-4 py-5 text-white">
        <button
          type="button"
          onClick={() => navigate('/staff')}
          aria-label="뒤로"
          className="flex h-9 w-9 items-center justify-center rounded-full text-xl transition-transform active:scale-90"
        >
          ←
        </button>
        <h1 className="flex-1 text-xl font-bold">메뉴 관리</h1>
        <span className="text-sm opacity-75">{menus.length}개</span>
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          className="rounded-full bg-white/20 px-3.5 py-1.5 text-sm font-semibold active:scale-95"
        >
          + 추가
        </button>
      </header>

      {/* 카테고리 탭 */}
      <div
        ref={tabsRef}
        className="flex gap-1.5 overflow-x-auto px-4 py-3 scrollbar-hide"
        style={{ scrollbarWidth: 'none' }}
      >
        {categories.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setActiveCategory(cat)}
            className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm font-semibold transition-colors ${
              activeCategory === cat
                ? 'bg-primary-500 text-white'
                : 'bg-primary-50 text-primary-600'
            }`}
          >
            {cat === 'ALL' ? '전체' : categoryLabel(cat)}
            <span className="ml-1 opacity-60 text-xs">
              {cat === 'ALL' ? menus.length : menus.filter((m) => m.category === cat).length}
            </span>
          </button>
        ))}
      </div>

      <div className="px-4">
        {status === 'loading' && <p className="py-10 text-center text-muted">불러오는 중...</p>}
        {status === 'error' && <p className="py-10 text-center text-red-600">{errorMessage}</p>}

        {status === 'ready' && (
          <ul className="grid gap-2">
            {filtered.map((menu) => (
              <li
                key={menu.id}
                className={`flex items-center gap-3 rounded-card bg-surface-raised px-4 py-3 shadow-sm transition-opacity ${
                  !menu.active ? 'opacity-50' : ''
                }`}
              >
                {/* 이미지 */}
                <div className="h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-primary-50">
                  {menu.imageUrl ? (
                    <img
                      src={menu.imageUrl}
                      alt={menu.name}
                      className="h-full w-full object-cover"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-lg">🍣</div>
                  )}
                </div>

                {/* 이름 + 정보 */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate text-sm font-bold text-ink">{menu.name}</span>
                    <span className="shrink-0 rounded-full bg-primary-100 px-2 py-0.5 text-[10px] font-semibold text-primary-700">
                      {categoryLabel(menu.category)}
                    </span>
                  </div>
                  <div className="mt-0.5 flex items-center gap-2 text-xs text-muted">
                    <span className="font-semibold text-ink">{menu.price.toLocaleString()}원</span>
                    <span>·</span>
                    <span>{stationName(menu.stationId)}</span>
                    {menu.stockCount != null && (
                      <>
                        <span>·</span>
                        <span className={menu.stockCount <= 5 ? 'text-red-500 font-semibold' : ''}>
                          재고 {menu.stockCount}
                        </span>
                      </>
                    )}
                  </div>
                </div>

                {/* 액션 버튼들 */}
                <div className="flex shrink-0 items-center gap-1.5">
                  {menu.stockCount != null && (
                    <button
                      type="button"
                      onClick={() => setRestockTarget(menu)}
                      className="rounded-full bg-primary-50 px-2.5 py-1 text-xs font-semibold text-primary-600 active:scale-95"
                    >
                      보충
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setEditingMenu(menu)}
                    className="rounded-full bg-ink/5 px-2.5 py-1 text-xs font-semibold text-ink active:scale-95"
                  >
                    수정
                  </button>
                  {/* 활성/비활성 토글 */}
                  <button
                    type="button"
                    disabled={togglingId === menu.id}
                    onClick={() => handleToggleActive(menu)}
                    className={`relative h-6 w-11 rounded-full transition-colors disabled:opacity-50 ${
                      menu.active ? 'bg-primary-500' : 'bg-ink/20'
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                        menu.active ? 'translate-x-5.5' : 'translate-x-0.5'
                      }`}
                    />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* 생성 모달 */}
      {showCreate && (
        <MenuFormModal
          menu={null}
          stations={stations}
          onCancel={() => setShowCreate(false)}
          onSave={(created) => { addToList(created); setShowCreate(false) }}
        />
      )}

      {/* 수정 모달 */}
      {editingMenu && (
        <MenuFormModal
          menu={editingMenu}
          stations={stations}
          onCancel={() => setEditingMenu(null)}
          onSave={(updated) => { updateInList(updated); setEditingMenu(null) }}
        />
      )}

      {/* 재고 보충 모달 */}
      {restockTarget && (
        <RestockModal
          menu={restockTarget}
          onCancel={() => setRestockTarget(null)}
          onDone={(updated) => { updateInList(updated); setRestockTarget(null) }}
        />
      )}
    </div>
  )
}

export default MenuManagePage
