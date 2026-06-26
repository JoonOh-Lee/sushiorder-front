import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ApiError } from '../../api/types'
import {
  activateMenu,
  changeMenuPrice,
  createMenu,
  deactivateMenu,
  listAllMenus,
  restockMenu,
  setMenuStock,
  updateMenu,
  type MenuCreateInput,
} from '../../auth/adminMenuApi'
import { getStaffAuth } from '../../auth/staffAuth'
import { listStations, type Station } from '../../auth/stationApi'
import type { MenuItem } from '../../customer/menuApi'

type Status = 'loading' | 'ready' | 'error'

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
}

const CATEGORY_EMOJI: Record<string, string> = {
  DESSERT_ETC: '🍮',
  DRINK_ALCOHOL: '🍺',
  FRESH_SUSHI: '🐟',
  FRIED: '🍤',
  GRILLED_SUSHI: '🔥',
  GUNKAN_SUSHI: '⛵',
  MEAL: '🍜',
  MEAT_SUSHI: '🥩',
  PREMIUM_SUSHI: '✨',
  SEASONED_SUSHI: '🌿',
  TAKEOUT: '📦',
  TUNA_SUSHI: '🐉',
}

function categoryLabel(cat: string) {
  return CATEGORY_LABEL[cat] ?? cat
}

// ── 이미지 컴포넌트 ─────────────────────────────────────────────────────────
function MenuThumb({ src, category }: { src: string; category: string }) {
  const [err, setErr] = useState(false)
  if (!src || err) {
    return (
      <div className="flex h-full w-full select-none items-center justify-center bg-primary-50 text-xl">
        {CATEGORY_EMOJI[category] ?? '🍣'}
      </div>
    )
  }
  return (
    <img
      src={src}
      alt=""
      className="h-full w-full object-cover"
      onError={() => setErr(true)}
    />
  )
}

// ── 입력 공통 ───────────────────────────────────────────────────────────────
function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-semibold text-muted">{label}</label>
      {children}
    </div>
  )
}

const inputCls =
  'w-full rounded-xl border border-primary-100 bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-primary-400'

// ── 생성/수정 모달 ──────────────────────────────────────────────────────────
interface MenuFormModalProps {
  menu: MenuItem | null
  stations: Station[]
  onCancel: () => void
  onSave: (menu: MenuItem) => void
}

const BLANK: Record<string, string> = {
  name: '',
  description: '',
  price: '',
  category: 'FRESH_SUSHI',
  imageUrl: '',
  stockCount: '',
  stationId: '',
}

function MenuFormModal({ menu, stations, onCancel, onSave }: MenuFormModalProps) {
  const [form, setForm] = useState<Record<string, string>>(() =>
    menu
      ? {
          name: menu.name,
          description: menu.description ?? '',
          price: String(menu.price),
          category: menu.category,
          imageUrl: menu.imageUrl ?? '',
          stockCount: menu.stockCount != null ? String(menu.stockCount) : '',
          stationId: String(menu.stationId),
        }
      : { ...BLANK, stationId: stations[0] ? String(stations[0].id) : '' },
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function set(key: string, value: string) {
    setForm((p) => ({ ...p, [key]: value }))
  }

  async function handleSubmit() {
    if (!form.name.trim()) { setError('이름을 입력하세요.'); return }
    if (!form.price || isNaN(Number(form.price)) || Number(form.price) < 0) {
      setError('가격을 올바르게 입력하세요.')
      return
    }
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
          await changeMenuPrice(menu.id, Number(form.price))
          result = { ...result, price: Number(form.price) }
        }
      } else {
        result = await createMenu({
          name: form.name.trim(),
          description: form.description.trim(),
          price: Number(form.price),
          category: form.category,
          imageUrl: form.imageUrl.trim(),
          stockCount: form.stockCount !== '' ? Number(form.stockCount) : null,
          stationId: Number(form.stationId),
        } satisfies MenuCreateInput)
      }
      onSave(result)
    } catch (e) {
      setError(e instanceof ApiError ? e.message : '저장에 실패했습니다.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-30 flex items-end justify-center bg-ink/50 backdrop-blur-sm sm:items-center"
      onClick={(e) => { if (e.target === e.currentTarget) onCancel() }}
    >
      <div className="w-full max-w-lg rounded-t-2xl bg-surface-raised pb-safe shadow-2xl sm:rounded-2xl">
        {/* 모달 헤더 */}
        <div className="flex items-center justify-between border-b border-primary-100 px-5 py-4">
          <h2 className="text-base font-bold text-ink">{menu ? '메뉴 수정' : '메뉴 추가'}</h2>
          <button
            type="button"
            onClick={onCancel}
            className="flex h-8 w-8 items-center justify-center rounded-full text-muted hover:bg-ink/5"
          >
            ✕
          </button>
        </div>

        {/* 폼 */}
        <div className="max-h-[70vh] overflow-y-auto px-5 py-4">
          {error && (
            <div className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">
              {error}
            </div>
          )}

          <div className="grid gap-4">
            <div className="grid grid-cols-2 gap-3">
              <Field label="메뉴 이름">
                <input
                  value={form.name}
                  onChange={(e) => set('name', e.target.value)}
                  className={inputCls}
                  placeholder="예: 참치 대뱃살"
                />
              </Field>
              <Field label="가격 (원)">
                <input
                  type="number"
                  value={form.price}
                  onChange={(e) => set('price', e.target.value)}
                  className={inputCls}
                  placeholder="3900"
                  min={0}
                />
              </Field>
            </div>

            <Field label="설명">
              <textarea
                value={form.description}
                onChange={(e) => set('description', e.target.value)}
                rows={2}
                className={`${inputCls} resize-none`}
                placeholder="메뉴 간단 설명"
              />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="카테고리">
                <select
                  value={form.category}
                  onChange={(e) => set('category', e.target.value)}
                  className={inputCls}
                >
                  {Object.keys(CATEGORY_LABEL).map((c) => (
                    <option key={c} value={c}>
                      {categoryLabel(c)}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label={menu ? '담당 스테이션 (변경 불가)' : '담당 스테이션'}>
                <select
                  value={form.stationId}
                  onChange={(e) => set('stationId', e.target.value)}
                  disabled={!!menu}
                  className={`${inputCls} ${menu ? 'cursor-not-allowed opacity-50' : ''}`}
                >
                  {stations.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            {menu ? (
              <div className="rounded-xl bg-amber-50 px-4 py-3 text-xs text-amber-700">
                재고:{' '}
                <span className="font-bold">
                  {menu.stockCount != null ? `${menu.stockCount}개` : '무제한'}
                </span>
                <span className="ml-2 opacity-70">
                  · 재고 변경은 목록의 '보충' 버튼을 이용하세요.
                </span>
              </div>
            ) : (
              <Field label="재고 수량">
                <input
                  type="number"
                  value={form.stockCount}
                  onChange={(e) => set('stockCount', e.target.value)}
                  className={inputCls}
                  placeholder="비워두면 무제한"
                  min={0}
                />
              </Field>
            )}

            <Field label="이미지 URL">
              <input
                value={form.imageUrl}
                onChange={(e) => set('imageUrl', e.target.value)}
                className={inputCls}
                placeholder="https://..."
              />
            </Field>
          </div>
        </div>

        {/* 버튼 */}
        <div className="flex gap-2 border-t border-primary-100 px-5 py-4">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-full bg-ink/8 py-3 text-sm font-semibold text-ink active:scale-95"
          >
            취소
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={saving}
            className="flex-1 rounded-full bg-primary-500 py-3 text-sm font-semibold text-white shadow-sm active:scale-95 disabled:opacity-50"
          >
            {saving ? '저장 중…' : menu ? '수정 완료' : '메뉴 추가'}
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
  onRestock: (addedQty: number) => void
  onSetStock: (qty: number) => void
  onSetUnlimited: () => void
}

function RestockModal({ menu, onCancel, onRestock, onSetStock, onSetUnlimited }: RestockModalProps) {
  const isUnlimited = menu.stockCount === null
  const [qty, setQty] = useState(isUnlimited ? '30' : '10')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handlePrimary() {
    const n = Number(qty)
    if (!n || n <= 0) { setError('1 이상의 수량을 입력하세요.'); return }
    setSaving(true)
    try {
      if (isUnlimited) {
        await setMenuStock(menu.id, n)
        onSetStock(n)
      } else {
        await restockMenu(menu.id, n)
        onRestock(n)
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : '실패했습니다.')
      setSaving(false)
    }
  }

  async function handleSetUnlimited() {
    setSaving(true)
    try {
      await setMenuStock(menu.id, null)
      onSetUnlimited()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : '실패했습니다.')
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-ink/50 backdrop-blur-sm px-4">
      <div className="w-full max-w-xs rounded-2xl bg-surface-raised p-5 shadow-2xl">
        <h3 className="font-bold text-ink">{menu.name}</h3>
        <p className="mt-0.5 text-sm text-muted">
          현재 재고:{' '}
          <span className={menu.stockCount != null && menu.stockCount <= 5 ? 'font-bold text-red-500' : 'font-semibold text-ink'}>
            {menu.stockCount != null ? `${menu.stockCount}개` : '무제한'}
          </span>
        </p>

        {error && (
          <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
        )}

        <div className="mt-4">
          <label className="mb-1.5 block text-xs font-semibold text-muted">
            {isUnlimited ? '설정할 재고 수량' : '추가할 수량'}
          </label>
          <input
            type="number"
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            autoFocus
            min={1}
            className={inputCls}
          />
        </div>

        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-full bg-ink/8 py-3 text-sm font-semibold text-ink active:scale-95"
          >
            취소
          </button>
          <button
            type="button"
            onClick={handlePrimary}
            disabled={saving}
            className="flex-1 rounded-full bg-primary-500 py-3 text-sm font-semibold text-white active:scale-95 disabled:opacity-50"
          >
            {saving ? '처리 중…' : isUnlimited ? '재고 설정' : '보충하기'}
          </button>
        </div>

        {!isUnlimited && (
          <button
            type="button"
            onClick={handleSetUnlimited}
            disabled={saving}
            className="mt-2 w-full rounded-full border border-ink/15 py-2.5 text-sm font-semibold text-muted transition-colors hover:bg-ink/5 active:scale-95 disabled:opacity-40"
          >
            무제한으로 변경
          </button>
        )}
      </div>
    </div>
  )
}

// ── 사용/미사용 버튼 ────────────────────────────────────────────────────────
function ActiveToggle({
  active,
  loading,
  onToggle,
}: {
  active: boolean
  loading: boolean
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={loading}
      className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-bold transition-colors active:scale-95 disabled:opacity-40 ${
        active
          ? 'bg-primary-500 text-white hover:bg-primary-600'
          : 'bg-ink/10 text-muted hover:bg-ink/15'
      }`}
    >
      {loading ? '…' : active ? '사용중' : '미사용'}
    </button>
  )
}

// ── 메인 페이지 ─────────────────────────────────────────────────────────────
function MenuManagePage() {
  const navigate = useNavigate()
  const [status, setStatus] = useState<Status>('loading')
  const [loadError, setLoadError] = useState('')
  const [toastMsg, setToastMsg] = useState('')
  const [menus, setMenus] = useState<MenuItem[]>([])
  const [stations, setStations] = useState<Station[]>([])
  const [activeCategory, setActiveCategory] = useState('ALL')
  const [search, setSearch] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [editingMenu, setEditingMenu] = useState<MenuItem | null>(null)
  const [restockTarget, setRestockTarget] = useState<MenuItem | null>(null)
  const [togglingId, setTogglingId] = useState<number | null>(null)

  useEffect(() => {
    const auth = getStaffAuth()
    if (!auth) { navigate('/staff/login'); return }
    if (auth.role !== 'ADMIN') { navigate('/staff'); return }

    Promise.all([listAllMenus(), listStations()])
      .then(([ms, ss]) => {
        setMenus(ms)
        setStations(ss)
        setStatus('ready')
      })
      .catch((err: unknown) => {
        setLoadError(err instanceof ApiError ? err.message : '데이터를 불러오지 못했습니다.')
        setStatus('error')
      })
  }, [navigate])

  function showToast(msg: string) {
    setToastMsg(msg)
    setTimeout(() => setToastMsg(''), 2500)
  }

  const CATEGORY_ORDER = Object.keys(CATEGORY_LABEL)
  const categories = [
    'ALL',
    ...Array.from(new Set(menus.map((m) => m.category))).sort((a, b) => {
      const ai = CATEGORY_ORDER.indexOf(a)
      const bi = CATEGORY_ORDER.indexOf(b)
      if (ai === -1 && bi === -1) return a.localeCompare(b)
      if (ai === -1) return 1
      if (bi === -1) return -1
      return ai - bi
    }),
  ]

  // 검색어만 적용한 중간 결과 — 카테고리 탭 카운트에 사용
  const searchFiltered = search.trim()
    ? menus.filter((m) => m.name.includes(search.trim()))
    : menus

  const filtered = searchFiltered.filter(
    (m) => activeCategory === 'ALL' || m.category === activeCategory,
  )

  function stationName(id: number) {
    return stations.find((s) => s.id === id)?.name ?? `#${id}`
  }

  function patchMenu(id: number, updated: Partial<MenuItem>) {
    setMenus((prev) => prev.map((m) => (m.id === id ? { ...m, ...updated } : m)))
  }

  function replaceMenu(updated: MenuItem | null | undefined) {
    if (!updated || typeof updated !== 'object' || !('id' in updated)) return
    setMenus((prev) => prev.map((m) => (m.id === updated.id ? updated : m)))
  }

  async function handleToggleActive(menu: MenuItem) {
    setTogglingId(menu.id)
    // 낙관적 업데이트: 즉시 UI 반영
    patchMenu(menu.id, { active: !menu.active })
    try {
      await (menu.active ? deactivateMenu(menu.id) : activateMenu(menu.id))
      showToast(menu.active ? `"${menu.name}" 비활성화` : `"${menu.name}" 활성화`)
    } catch (e) {
      // 실패 시 원래 상태로 롤백
      patchMenu(menu.id, { active: menu.active })
      showToast(e instanceof ApiError ? e.message : '처리에 실패했습니다.')
    } finally {
      setTogglingId(null)
    }
  }

  const activeCount = filtered.filter((m) => m.active).length
  const inactiveCount = filtered.length - activeCount

  return (
    <div className="min-h-screen bg-surface">
      {/* 헤더 */}
      <header className="bg-primary-500 px-4 pb-3 pt-5 text-white">
        <div className="mx-auto flex max-w-3xl items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/staff')}
            aria-label="뒤로"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-lg transition-transform active:scale-90 hover:bg-white/10"
          >
            ←
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-bold">메뉴 관리</h1>
            <p className="mt-0.5 text-xs opacity-70">
              전체 {menus.length}개 · 활성 {menus.filter((m) => m.active).length}개
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            className="shrink-0 rounded-full bg-white/20 px-4 py-2 text-sm font-semibold transition-colors hover:bg-white/30 active:scale-95"
          >
            + 추가
          </button>
        </div>

        {/* 검색 */}
        <div className="mx-auto mt-3 max-w-3xl">
          <div className="flex items-center gap-2 rounded-xl bg-white/15 px-3 py-2">
            <span className="text-sm opacity-60">🔍</span>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="메뉴 이름 검색"
              className="flex-1 bg-transparent text-sm text-white placeholder-white/50 outline-none"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="text-sm opacity-60 hover:opacity-100"
              >
                ✕
              </button>
            )}
          </div>
        </div>
      </header>

      {/* 카테고리 탭 */}
      <div className="sticky top-0 z-10 border-b border-primary-100 bg-surface px-4 pt-3">
        <div
          className="mx-auto flex max-w-3xl gap-1.5 overflow-x-auto pb-3"
          style={{ scrollbarWidth: 'none' }}
        >
          {categories.map((cat) => {
            const count = cat === 'ALL' ? searchFiltered.length : searchFiltered.filter((m) => m.category === cat).length
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setActiveCategory(cat)}
                className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm font-semibold transition-colors ${
                  activeCategory === cat
                    ? 'bg-primary-500 text-white shadow-sm'
                    : 'bg-primary-50 text-primary-600 hover:bg-primary-100'
                }`}
              >
                {cat === 'ALL' ? '전체' : categoryLabel(cat)}
                <span className={`ml-1 text-xs ${activeCategory === cat ? 'opacity-70' : 'opacity-50'}`}>
                  {count}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* 본문 */}
      <main className="mx-auto max-w-3xl px-4 pb-24 pt-3">
        {status === 'loading' && (
          <div className="flex flex-col items-center gap-3 py-20 text-muted">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary-200 border-t-primary-500" />
            <span className="text-sm">불러오는 중…</span>
          </div>
        )}

        {status === 'error' && (
          <div className="mt-10 rounded-2xl bg-red-50 p-6 text-center">
            <p className="text-sm text-red-600">{loadError}</p>
          </div>
        )}

        {status === 'ready' && (
          <>
            {/* 결과 요약 */}
            {search && (
              <p className="mb-3 text-sm text-muted">
                <span className="font-semibold text-ink">"{search}"</span> 검색 결과 {filtered.length}개
              </p>
            )}
            {!search && activeCategory !== 'ALL' && (
              <p className="mb-3 text-sm text-muted">
                활성 {activeCount}개 · 비활성 {inactiveCount}개
              </p>
            )}

            {filtered.length === 0 ? (
              <div className="mt-10 text-center text-muted">
                <p className="text-3xl">🍽️</p>
                <p className="mt-2 text-sm">검색 결과가 없습니다.</p>
              </div>
            ) : (
              <ul className="grid gap-2">
                {filtered.map((menu) => (
                  <li
                    key={menu.id}
                    className={`flex items-center gap-3 rounded-2xl bg-surface-raised px-4 py-3 shadow-sm ring-1 transition-all ${
                      menu.active ? 'ring-primary-100' : 'ring-ink/5 opacity-60'
                    }`}
                  >
                    {/* 썸네일 */}
                    <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl">
                      <MenuThumb src={menu.imageUrl} category={menu.category} />
                    </div>

                    {/* 정보 */}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className={`font-semibold text-ink ${menu.active ? '' : 'line-through'}`}>
                          {menu.name}
                        </span>
                        <span className="rounded-full bg-primary-100 px-2 py-0.5 text-[10px] font-semibold text-primary-700">
                          {categoryLabel(menu.category)}
                        </span>
                        {!menu.active && (
                          <span className="rounded-full bg-ink/10 px-2 py-0.5 text-[10px] font-semibold text-muted">
                            비활성
                          </span>
                        )}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted">
                        <span className="font-bold text-sm text-ink">
                          {menu.price.toLocaleString()}원
                        </span>
                        <span>·</span>
                        <span>{stationName(menu.stationId)}</span>
                        {menu.stockCount != null && (
                          <>
                            <span>·</span>
                            <span
                              className={
                                menu.stockCount <= 3
                                  ? 'font-bold text-red-500'
                                  : menu.stockCount <= 10
                                  ? 'font-semibold text-amber-600'
                                  : ''
                              }
                            >
                              재고 {menu.stockCount}개
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* 액션 */}
                    <div className="flex shrink-0 items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setRestockTarget(menu)}
                        className="rounded-full border border-primary-200 px-2.5 py-1 text-xs font-semibold text-primary-600 transition-colors hover:bg-primary-50 active:scale-95"
                      >
                        재고
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingMenu(menu)}
                        className="rounded-full border border-ink/10 px-2.5 py-1 text-xs font-semibold text-ink transition-colors hover:bg-ink/5 active:scale-95"
                      >
                        수정
                      </button>
                      <ActiveToggle
                        active={menu.active}
                        loading={togglingId === menu.id}
                        onToggle={() => handleToggleActive(menu)}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </main>

      {/* 토스트 */}
      {toastMsg && (
        <div className="pointer-events-none fixed bottom-6 left-1/2 z-50 -translate-x-1/2">
          <div className="rounded-full bg-ink/80 px-5 py-2.5 text-sm font-medium text-white shadow-lg backdrop-blur-sm">
            {toastMsg}
          </div>
        </div>
      )}

      {/* 생성 모달 */}
      {showCreate && (
        <MenuFormModal
          menu={null}
          stations={stations}
          onCancel={() => setShowCreate(false)}
          onSave={(created) => {
            setMenus((prev) => [created, ...prev])
            setShowCreate(false)
            showToast(`"${created.name}" 추가됨`)
          }}
        />
      )}

      {/* 수정 모달 */}
      {editingMenu && (
        <MenuFormModal
          menu={editingMenu}
          stations={stations}
          onCancel={() => setEditingMenu(null)}
          onSave={(updated) => {
            replaceMenu(updated)
            setEditingMenu(null)
            showToast('수정되었습니다.')
          }}
        />
      )}

      {/* 재고 보충 모달 */}
      {restockTarget && (
        <RestockModal
          menu={restockTarget}
          onCancel={() => setRestockTarget(null)}
          onRestock={(addedQty) => {
            patchMenu(restockTarget.id, {
              stockCount: restockTarget.stockCount != null ? restockTarget.stockCount + addedQty : null,
            })
            setRestockTarget(null)
            showToast(`재고 +${addedQty}개 보충되었습니다.`)
          }}
          onSetStock={(qty) => {
            patchMenu(restockTarget.id, { stockCount: qty, limitedStock: true, soldOut: false })
            setRestockTarget(null)
            showToast(`"${restockTarget.name}" 재고 ${qty}개로 설정되었습니다.`)
          }}
          onSetUnlimited={() => {
            patchMenu(restockTarget.id, { stockCount: null, limitedStock: false, soldOut: false })
            setRestockTarget(null)
            showToast(`"${restockTarget.name}" 무제한으로 변경되었습니다.`)
          }}
        />
      )}
    </div>
  )
}

export default MenuManagePage
