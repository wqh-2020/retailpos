import { db } from './index'
import type { Member, MemberPointsLog, MemberLevel } from '@/types'

// ─── 会员等级配置 ─────────────────────────────────────────

export const MEMBER_LEVELS: { level: MemberLevel; label: string; discountRate: number; icon: string }[] = [
  { level: 'bronze',   label: '青铜',  discountRate: 100, icon: '🥉' },
  { level: 'silver',   label: '白银',  discountRate: 95,  icon: '🥈' },
  { level: 'gold',     label: '黄金',  discountRate: 90,  icon: '🥇' },
  { level: 'platinum', label: '铂金',  discountRate: 85,  icon: '💎' },
]

export function getLevelLabel(level: MemberLevel): string {
  return MEMBER_LEVELS.find((l) => l.level === level)?.label ?? level
}

// ─── 会员 CRUD ───────────────────────────────────────────

export async function getMembers(opts?: {
  keyword?: string
  level?: MemberLevel
  isActive?: boolean
  page?: number
  pageSize?: number
}): Promise<{ list: Member[]; total: number }> {
  let collection = db.members.filter((m) => {
    if (opts?.isActive !== undefined && m.isActive !== opts.isActive) return false
    if (opts?.level && m.level !== opts.level) return false
    if (opts?.keyword) {
      const kw = opts.keyword.toLowerCase()
      return m.name.toLowerCase().includes(kw) || m.phone.includes(kw)
    }
    return true
  })

  const total = await collection.count()
  const page = opts?.page ?? 1
  const pageSize = opts?.pageSize ?? 20
  const list = await collection
    .offset((page - 1) * pageSize)
    .limit(pageSize)
    .reverse()
    .sortBy('createdAt')

  return { list, total }
}

export async function getMemberByPhone(phone: string): Promise<Member | undefined> {
  return db.members.where('phone').equals(phone).first()
}

export async function getMemberById(id: number): Promise<Member | undefined> {
  return db.members.get(id)
}

export async function addMember(data: Omit<Member, 'id'>): Promise<number> {
  return db.members.add(data)
}

export async function updateMember(id: number, data: Partial<Member>): Promise<void> {
  await db.members.update(id, { ...data, updatedAt: Date.now() })
}

export async function deleteMember(id: number): Promise<void> {
  await db.members.update(id, { isActive: false, updatedAt: Date.now() })
}

// ─── 积分操作 ─────────────────────────────────────────────

/** 获得积分（消费返积分） */
export async function earnPoints(
  memberId: number,
  orderId: number,
  orderNo: string,
  points: number,
  remark?: string
): Promise<void> {
  const member = await db.members.get(memberId)
  if (!member) throw new Error('会员不存在')

  await db.transaction('rw', [db.members, db.memberPointsLogs], async () => {
    await db.members.update(memberId, {
      points: member.points + points,
      totalPoints: member.totalPoints + points,
      updatedAt: Date.now(),
    })
    await db.memberPointsLogs.add({
      memberId,
      type: 'earn',
      points,
      orderId,
      orderNo,
      remark,
      createdAt: Date.now(),
    })
  })
}

/** 兑换积分 */
export async function redeemPoints(
  memberId: number,
  points: number,
  remark?: string
): Promise<void> {
  const member = await db.members.get(memberId)
  if (!member) throw new Error('会员不存在')
  if (member.points < points) throw new Error('积分不足')

  await db.transaction('rw', [db.members, db.memberPointsLogs], async () => {
    await db.members.update(memberId, {
      points: member.points - points,
      updatedAt: Date.now(),
    })
    await db.memberPointsLogs.add({
      memberId,
      type: 'redeem',
      points: -points,
      remark,
      createdAt: Date.now(),
    })
  })
}

/** 积分调整（手动增减） */
export async function adjustPoints(
  memberId: number,
  points: number,
  remark?: string
): Promise<void> {
  const member = await db.members.get(memberId)
  if (!member) throw new Error('会员不存在')

  await db.transaction('rw', [db.members, db.memberPointsLogs], async () => {
    await db.members.update(memberId, {
      points: member.points + points,
      totalPoints: points > 0 ? member.totalPoints + points : member.totalPoints,
      updatedAt: Date.now(),
    })
    await db.memberPointsLogs.add({
      memberId,
      type: 'adjust',
      points,
      remark,
      createdAt: Date.now(),
    })
  })
}

/** 积分记录 */
export async function getMemberPointsLogs(memberId: number): Promise<MemberPointsLog[]> {
  return db.memberPointsLogs
    .where('memberId')
    .equals(memberId)
    .reverse()
    .sortBy('createdAt')
}

/** 积分换算：1元 = 1积分（可配置，这里固定） */
export function calcEarnPoints(amountFen: number): number {
  return Math.floor(amountFen / 100) // 每消费1元返1积分
}
