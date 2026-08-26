// ============================================================
// 《议会博弈》共享类型 — 三层架构的数据契约
// 渲染层 / UI 层 / 服务层 共用，单一状态源
// ============================================================

/** 游戏阶段（每轮四阶段流转） */
export type GamePhase =
  | 'lobby'        // 房间组建
  | 'reveal'      // 议案揭示
  | 'negotiate'   // 谈判阶段（限时 2 分钟）
  | 'vote'        // 投票阶段（盲投）
  | 'settle'      // 结算与声誉
  | 'finished';   // 终局排名

/** 身份系统（v0 仅保守派，后续扩展） */
export type Identity =
  | 'conservative'  // 保守派：稳定收益
  | 'radical'        // 激进派：高风险高回报
  | 'moderate'       // 中间派：调和奖励
  | 'conspirator'    // 阴谋家：窥探私聊
  | 'agitator';      // 煽动者：操纵声誉

/** 投票选择 */
export type VoteChoice = 'yea' | 'nay' | 'abstain';

/** 承诺状态 */
export type PromiseStatus = 'pending' | 'fulfilled' | 'broken';

/** 承诺契约（结构化，可追踪/结算/标记违约） */
export interface Promise {
  id: string;
  fromPlayerId: string;
  toPlayerId: string;
  /** 我做什么 */
  fromAction: string;
  /** 你做什么 */
  toAction: string;
  isPublic: boolean;
  status: PromiseStatus;
  createdAt: number;
  /** 关联的轮次 */
  roundIndex: number;
}

/** 议案分配方案 */
export interface BillAllocation {
  playerId: string;
  percentage: number;
}

/** 议案 */
export interface Bill {
  index: number;
  title: string;
  description: string;
  /** 分配方案（百分比，总和应为 100） */
  allocations: BillAllocation[];
  /** 议案类型（v0 固定分配议案） */
  type: 'allocation' | 'prisoners' | 'auction' | 'public-goods' | 'voting-paradox' | 'amendment';
}

/** 玩家状态 */
export interface Player {
  id: string;
  name: string;
  isAI: boolean;
  isHost: boolean;
  identity: Identity;
  /** 本局政治资本 */
  capital: number;
  /** 历史兑现率（0-1，跨局延续） */
  reputation: number;
  /** 累计承诺总数（用于计算兑现率） */
  totalPromises: number;
  /** 已兑现承诺数 */
  fulfilledPromises: number;
  /** 是否已准备 */
  ready: boolean;
  /** 是否已投票（本轮） */
  hasVoted: boolean;
}

/** 聊天通道类型 */
export type ChannelType = 'private' | 'public';

/** 聊天消息 */
export interface ChatMessage {
  id: string;
  roomId: string;
  channelId: string;
  fromPlayerId: string;
  toPlayerId?: string;
  type: ChannelType;
  content: string;
  timestamp: number;
}

/** 投票结果 */
export interface VoteResult {
  playerId: string;
  choice: VoteChoice;
}

/** 单轮结算结果 */
export interface RoundResult {
  roundIndex: number;
  passed: boolean;
  votes: VoteResult[];
  /** 资本变化 */
  capitalChanges: Record<string, number>;
  /** 声誉变化 */
  reputationChanges: Record<string, number>;
}

/** 房间/游戏完整状态（单一状态源） */
export interface RoomState {
  id: string;
  phase: GamePhase;
  players: Player[];
  /** 当前轮次索引 */
  currentRound: number;
  /** 总轮数 */
  totalRounds: number;
  /** 当前议案 */
  currentBill: Bill | null;
  /** 历史议案（每轮） */
  bills: Bill[];
  /** 所有承诺 */
  promises: Promise[];
  /** 聊天消息 */
  messages: ChatMessage[];
  /** 投票结果（本轮） */
  votes: VoteResult[];
  /** 每轮结算 */
  results: RoundResult[];
  /** 阶段开始时间戳 */
  phaseStartTime: number;
  /** 阶段持续时间（毫秒） */
  phaseDuration: number;
  /** 议会厅厅主 ID */
  speakerId: string | null;
  /** 创建时间 */
  createdAt: number;
}

/** 玩家简要信息（排行榜用） */
export interface PlayerSummary {
  id: string;
  name: string;
  capital: number;
  reputation: number;
}
