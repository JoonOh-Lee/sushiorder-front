export const CATEGORY_LABEL: Record<string, string> = {
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

export const CATEGORY_ORDER = Object.keys(CATEGORY_LABEL)

export const CATEGORY_EMOJI: Record<string, string> = {
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

export const CATEGORY_NOTE: Record<string, string> = {
  PREMIUM_SUSHI: '일일 한정 수량으로 제공돼요. 소진 시 품절될 수 있습니다.',
}
