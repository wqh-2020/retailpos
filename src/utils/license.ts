/**
 * 软件授权模块 — 机器码 / 激活码生成与验证
 */

// ─── 常量 ────────────────────────────────────────────────
const LICENSE_SECRET = 'retailpos_lic_secret_2024'
const LICENSE_STORAGE_KEY = 'retailpos_license'
const FIRST_LAUNCH_KEY = 'retailpos_first_launch'
const TRIAL_DAYS = 30
const BASE32_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'

// ─── 类型 ────────────────────────────────────────────────
export interface LicenseData {
  machineId: string
  expiryDate: string   // 'YYYY-MM-DD' 或 'permanent'
  activationCode: string
  activatedAt: string  // ISO 8601
}

export type LicenseStatus =
  | { valid: true; license: LicenseData; daysLeft: number | null }
  | { valid: false; reason: string; trial: false }
  | { valid: false; reason: string; trial: true; trialDaysLeft: number }

// ─── 工具函数 ────────────────────────────────────────────

/** Uint8Array → Base32 字符串 */
function bytesToBase32(bytes: Uint8Array): string {
  let bits = ''
  for (const b of bytes) bits += b.toString(2).padStart(8, '0')
  let result = ''
  for (let i = 0; i + 5 <= bits.length; i += 5) {
    result += BASE32_CHARS[parseInt(bits.slice(i, i + 5), 2)]
  }
  return result
}

/** 格式化为 XXXX-XXXX-XXXX-XXXX 每组4字符 */
function formatCode(raw: string, groupSize = 4): string {
  return raw.slice(0, 20).toUpperCase().replace(new RegExp(`(.{${groupSize}})`, 'g'), '$1-').replace(/-$/, '')
}

// ─── 哈希 ────────────────────────────────────────────────

async function sha256(data: string): Promise<Uint8Array> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(data))
  return new Uint8Array(buf)
}

async function hmacSha256(key: string, data: string): Promise<Uint8Array> {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(key),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const buf = await crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(data))
  return new Uint8Array(buf)
}

// ─── 公开 API ────────────────────────────────────────────

/**
 * 根据硬件指纹字符串生成机器码
 * @param fingerprint 主进程拼好的 "hostname|cpuCores|mac"
 */
export async function generateMachineId(fingerprint: string): Promise<string> {
  const hash = await sha256(fingerprint)
  const base32 = bytesToBase32(hash.slice(0, 10)) // 10 bytes → 16 Base32 chars
  return formatCode(base32)
}

/**
 * 根据机器码 + 到期日期生成激活码（注册机使用）
 *
 * 激活码格式：YYYYMMDD-XXXX-XXXX-XXXX-XXXX
 *   前 8 位 = 到期日期（99999999 = 永久）
 *   后 16 位 = HMAC-SHA256 签名
 *
 * @param machineId   格式化后的机器码（如 A3B2-C1D0-E9F8-G7H6）
 * @param expiryDate  'YYYY-MM-DD' 或 'permanent'
 * @param secret      HMAC 密钥（注册机用相同密钥）
 */
export async function generateActivationCode(
  machineId: string,
  expiryDate: string,
  secret = LICENSE_SECRET,
): Promise<string> {
  const payload = `${machineId}|${expiryDate}`
  const mac = await hmacSha256(secret, payload)
  const base32 = bytesToBase32(mac.slice(0, 10)) // 10 bytes → 16 Base32 chars
  const sig = formatCode(base32, 4) // XXXX-XXXX-XXXX-XXXX
  // 到期日期编码：2026-12-31 → 20261231，permanent → 99999999
  const datePart = expiryDate === 'permanent' ? '99999999' : expiryDate.replace(/-/g, '')
  return `${datePart}-${sig}`
}

/**
 * 从激活码中解析到期日期
 * @returns 'YYYY-MM-DD' | 'permanent' | null（格式无效时）
 */
export function parseActivationExpiry(code: string): string | null {
  const clean = code.trim().toUpperCase().replace(/\s/g, '').replace(/-/g, '')
  if (clean.length < 24) return null // 8(date) + 16(sig)
  const datePart = clean.slice(0, 8)
  if (datePart === '99999999') return 'permanent'
  // 校验 YYYYMMDD 格式
  if (!/^\d{8}$/.test(datePart)) return null
  const y = datePart.slice(0, 4), m = datePart.slice(4, 6), d = datePart.slice(6, 8)
  const num = Number(y), mon = Number(m), day = Number(d)
  if (num < 2020 || num > 2099 || mon < 1 || mon > 12 || day < 1 || day > 31) return null
  return `${y}-${m}-${d}`
}

/**
 * 验证激活码是否合法（自动从激活码解析到期日期）
 * @returns true / false
 */
export async function verifyActivationCode(
  machineId: string,
  activationCode: string,
  secret = LICENSE_SECRET,
): Promise<boolean> {
  const expiryDate = parseActivationExpiry(activationCode)
  if (!expiryDate) return false
  const expected = await generateActivationCode(machineId, expiryDate, secret)
  return expected === activationCode.trim().toUpperCase().replace(/\s/g, '')
}

/**
 * 确保首次启动日期已记录（调用一次即可）
 */
export function ensureFirstLaunch(): void {
  if (!localStorage.getItem(FIRST_LAUNCH_KEY)) {
    localStorage.setItem(FIRST_LAUNCH_KEY, new Date().toISOString())
  }
}

/**
 * 获取试用期剩余天数（内部函数）
 */
function getTrialDaysLeft(): number {
  const raw = localStorage.getItem(FIRST_LAUNCH_KEY)
  if (!raw) return TRIAL_DAYS // 尚未记录，视为刚安装
  const first = new Date(raw)
  first.setHours(0, 0, 0, 0)
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const expiry = new Date(first.getTime() + TRIAL_DAYS * 86400000)
  expiry.setHours(23, 59, 59, 999)
  const left = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  return left > 0 ? left : 0
}

/**
 * 获取当前授权状态（含试用期判断）
 */
export function getLicenseStatus(): LicenseStatus {
  try {
    const raw = localStorage.getItem(LICENSE_STORAGE_KEY)
    if (!raw) {
      // 未激活 → 判断试用期
      ensureFirstLaunch()
      const daysLeft = getTrialDaysLeft()
      if (daysLeft > 0) {
        return { valid: false, reason: '试用中', trial: true, trialDaysLeft: daysLeft }
      }
      return { valid: false, reason: '试用期已结束', trial: false }
    }

    const license: LicenseData = JSON.parse(raw)

    // 检查到期
    if (license.expiryDate !== 'permanent') {
      const now = new Date()
      now.setHours(0, 0, 0, 0)
      const expiry = new Date(license.expiryDate + 'T23:59:59')
      if (now > expiry) {
        return { valid: false, reason: '授权已过期', trial: false }
      }
    }

    // 计算剩余天数
    let daysLeft: number | null = null
    if (license.expiryDate !== 'permanent') {
      const now = new Date(); now.setHours(0, 0, 0, 0)
      const expiry = new Date(license.expiryDate); expiry.setHours(0, 0, 0, 0)
      daysLeft = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    }

    return { valid: true, license, daysLeft }
  } catch {
    return { valid: false, reason: '授权数据损坏', trial: false }
  }
}

/** 保存授权信息 */
export function saveLicense(license: LicenseData): void {
  localStorage.setItem(LICENSE_STORAGE_KEY, JSON.stringify(license))
}

/** 清除授权 */
export function clearLicense(): void {
  localStorage.removeItem(LICENSE_STORAGE_KEY)
}
