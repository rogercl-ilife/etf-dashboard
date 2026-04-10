export type UiLanguage = 'en' | 'zh-TW' | 'zh-CN'

type CategoryLabel = {
  'zh-TW': string
  'zh-CN': string
}

function normalizeCategory(value: string) {
  return value.trim().replace(/\s+/g, ' ').toLowerCase()
}

const CATEGORY_LABELS: Record<string, CategoryLabel> = {
  'large blend': { 'zh-TW': '大型混合', 'zh-CN': '大盘混合' },
  'large value': { 'zh-TW': '大型價值', 'zh-CN': '大盘价值' },
  'large growth': { 'zh-TW': '大型成長', 'zh-CN': '大盘成长' },
  'mid-cap blend': { 'zh-TW': '中型混合', 'zh-CN': '中盘混合' },
  'mid-cap value': { 'zh-TW': '中型價值', 'zh-CN': '中盘价值' },
  'mid-cap growth': { 'zh-TW': '中型成長', 'zh-CN': '中盘成长' },
  'small blend': { 'zh-TW': '小型混合', 'zh-CN': '小盘混合' },
  'small value': { 'zh-TW': '小型價值', 'zh-CN': '小盘价值' },
  'small growth': { 'zh-TW': '小型成長', 'zh-CN': '小盘成长' },
  'foreign large blend': { 'zh-TW': '海外大型混合', 'zh-CN': '海外大盘混合' },
  'foreign large value': { 'zh-TW': '海外大型價值', 'zh-CN': '海外大盘价值' },
  'foreign large growth': { 'zh-TW': '海外大型成長', 'zh-CN': '海外大盘成长' },
  'foreign small/mid blend': { 'zh-TW': '海外中小型混合', 'zh-CN': '海外中小盘混合' },
  'diversified emerging mkts': { 'zh-TW': '新興市場綜合', 'zh-CN': '新兴市场综合' },
  'world large stock': { 'zh-TW': '全球大型股票', 'zh-CN': '全球大盘股票' },
  'global large-stock blend': { 'zh-TW': '全球大型混合股票', 'zh-CN': '全球大盘混合股票' },
  'global large stock blend': { 'zh-TW': '全球大型混合股票', 'zh-CN': '全球大盘混合股票' },
  'derivative income': { 'zh-TW': '衍生性收益', 'zh-CN': '衍生品收益' },
  'equity energy': { 'zh-TW': '能源股票', 'zh-CN': '能源股票' },
  'utilities': { 'zh-TW': '公用事業', 'zh-CN': '公用事业' },
  'technology': { 'zh-TW': '科技', 'zh-CN': '科技' },
  'financial': { 'zh-TW': '金融', 'zh-CN': '金融' },
  'financials': { 'zh-TW': '金融', 'zh-CN': '金融' },
  'health': { 'zh-TW': '醫療保健', 'zh-CN': '医疗保健' },
  'healthcare': { 'zh-TW': '醫療保健', 'zh-CN': '医疗保健' },
  'industrials': { 'zh-TW': '工業', 'zh-CN': '工业' },
  'consumer defensive': { 'zh-TW': '必需消費', 'zh-CN': '必选消费' },
  'consumer cyclical': { 'zh-TW': '非必需消費', 'zh-CN': '可选消费' },
  'communication services': { 'zh-TW': '通訊服務', 'zh-CN': '通信服务' },
  'materials': { 'zh-TW': '原物料', 'zh-CN': '原材料' },
  'energy': { 'zh-TW': '能源', 'zh-CN': '能源' },
  'real estate': { 'zh-TW': '不動產', 'zh-CN': '房地产' },
  'ultrashort bond': { 'zh-TW': '超短期債券', 'zh-CN': '超短债' },
  'short government': { 'zh-TW': '短期公債', 'zh-CN': '短期国债' },
  'intermediate government': { 'zh-TW': '中期公債', 'zh-CN': '中期国债' },
  'long government': { 'zh-TW': '長期公債', 'zh-CN': '长期国债' },
  'intermediate core bond': { 'zh-TW': '中期核心債券', 'zh-CN': '中期核心债券' },
  'intermediate core-plus bond': { 'zh-TW': '中期核心增強債券', 'zh-CN': '中期核心增强债券' },
  'long-term bond': { 'zh-TW': '長天期債券', 'zh-CN': '长期债券' },
  'corporate bond': { 'zh-TW': '公司債', 'zh-CN': '公司债' },
  'high yield bond': { 'zh-TW': '高收益債', 'zh-CN': '高收益债' },
  'inflation-protected bond': { 'zh-TW': '抗通膨債券', 'zh-CN': '抗通胀债券' },
  'muni national short': { 'zh-TW': '美國市政短債', 'zh-CN': '美国市政短债' },
  'muni national interm': { 'zh-TW': '美國市政中期債', 'zh-CN': '美国市政中期债' },
  'muni national long': { 'zh-TW': '美國市政長債', 'zh-CN': '美国市政长债' },
  'bank loan': { 'zh-TW': '銀行貸款', 'zh-CN': '银行贷款' },
  'multisector bond': { 'zh-TW': '多元債券', 'zh-CN': '多元债券' },
  'global bond-usd hedged': { 'zh-TW': '全球債券（美元避險）', 'zh-CN': '全球债券（美元对冲）' },
  'global bond usd hedged': { 'zh-TW': '全球債券（美元避險）', 'zh-CN': '全球债券（美元对冲）' },
  'commodities broad basket': { 'zh-TW': '大宗商品綜合', 'zh-CN': '大宗商品综合' },
  'natural resources': { 'zh-TW': '天然資源', 'zh-CN': '自然资源' },
}

export function localizeCategory(category: string | null | undefined, language: UiLanguage) {
  if (!category) return category ?? null
  if (language === 'en') return category
  const key = normalizeCategory(category)
  const mapped = CATEGORY_LABELS[key]
  return mapped ? mapped[language] : category
}
