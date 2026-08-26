// ============================================================
// 游戏常量与配置
// ============================================================

import type { GamePhase } from './types.js';

/** v0 配置 */
export const GAME_CONFIG = {
  /** 最少玩家数（含 AI） */
  MIN_PLAYERS: 2,
  /** 最多玩家数 */
  MAX_PLAYERS: 6,
  /** v0 固定 4 人房间 */
  V0_ROOM_SIZE: 4,
  /** v0 固定 3 轮 */
  V0_TOTAL_ROUNDS: 3,
  /** AI 填位数量 */
  AI_FILLED_SLOTS: 1,
} as const;

/** 阶段持续时间（毫秒） */
export const PHASE_DURATIONS: Record<Exclude<GamePhase, 'lobby' | 'finished'>, number> = {
  reveal: 15_000,        // 议案揭示 15 秒
  negotiate: 120_000,    // 谈判 2 分钟
  vote: 30_000,           // 投票 30 秒
  settle: 20_000,         // 结算 20 秒
};

/** 投票通过所需比例（过半数） */
export const VOTE_PASS_RATIO = 0.5;

/** 身份中文名 */
export const IDENTITY_LABELS: Record<string, string> = {
  conservative: '保守派',
  radical: '激进派',
  moderate: '中间派',
  conspirator: '阴谋家',
  agitator: '煽动者',
};

/** 身份能力描述 */
export const IDENTITY_ABILITIES: Record<string, string> = {
  conservative: '稳定收益加成',
  radical: '高风险高回报',
  moderate: '调和奖励',
  conspirator: '窥探私聊',
  agitator: '操纵声誉',
};

/** 声誉阈值：低于此值视为不可信 */
export const REPUTATION_UNTRUST_THRESHOLD = 0.5;

/** 声誉条颜色映射（与设计 tokens 对齐） */
export const REPUTATION_COLORS = {
  high: '#2E7D5B',    // 信任绿
  mid: '#C9A961',      // 暗金
  low: '#B23A3A',      // 警示红
} as const;

/** 根据兑现率获取声誉颜色 */
export function getReputationColor(reputation: number): string {
  if (reputation >= 0.75) return REPUTATION_COLORS.high;
  if (reputation >= 0.5) return REPUTATION_COLORS.mid;
  return REPUTATION_COLORS.low;
}
