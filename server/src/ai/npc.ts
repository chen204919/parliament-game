import OpenAI from 'openai';
import { config } from '../config.js';
import type { RoomState, VoteChoice, Player } from '@parliament/shared';

// ============================================================
// AI NPC — 填位议员，使用 OpenAI 兼容 API
// v0：简单性格参数 + 谈判/投票决策
// ============================================================

const AI_NAMES = ['议员·周', '议员·吴', '议员·郑', '议员·王'] as const;

const AI_PERSONALITIES = [
  { name: '谨慎', aggression: 0.3, betrayalThreshold: 0.7, desc: '倾向合作，声誉高才敢背叛' },
  { name: '投机', aggression: 0.6, betrayalThreshold: 0.4, desc: '看利益行事，常在背叛边缘' },
  { name: '激进', aggression: 0.8, betrayalThreshold: 0.3, desc: '高风险高回报，频繁背叛' },
  { name: '圆滑', aggression: 0.5, betrayalThreshold: 0.5, desc: '看人下菜，声誉中等' },
] as const;

export function createAIPlayer(index: number): Player {
  const i = index % AI_PERSONALITIES.length;
  return {
    id: `ai-npc-${index}`,
    name: AI_NAMES[index % AI_NAMES.length],
    isAI: true,
    isHost: false,
    identity: 'conservative',
    capital: 0,
    reputation: 0.5 + Math.random() * 0.2,
    totalPromises: 0,
    fulfilledPromises: 0,
    ready: true,
    hasVoted: false,
  };
}

let client: OpenAI | null = null;

function getClient(): OpenAI | null {
  if (!config.openai.apiKey) return null;
  if (!client) {
    client = new OpenAI({
      apiKey: config.openai.apiKey,
      baseURL: config.openai.baseURL,
    });
  }
  return client;
}

const SYSTEM_PROMPT = `你是一个虚拟议会游戏中的 AI 议员。你参与资源分配议案的谈判与投票。
你的决策基于：你的性格参数、当前议案分配、其他玩家的声誉（历史兑现率）。
声誉高（>0.7）的玩家更可能兑现承诺；声誉低（<0.5）的玩家不可信。
请在谈判阶段用简短中文发言，在投票阶段只返回 yea / nay / abstain。`;

/** AI 决定投票 */
export async function aiDecideVote(player: Player, state: RoomState): Promise<VoteChoice> {
  const ai = getClient();
  const bill = state.currentBill;

  // 无 API key 时使用启发式
  if (!ai || !bill) {
    return heuristicVote(player, state);
  }

  const myAllocation = bill.allocations.find((a) => a.playerId === player.id);
  const myGain = myAllocation?.percentage ?? 0;
  // 分配高则倾向赞成
  if (myGain >= 30) return 'yea';
  if (myGain < 15) return 'nay';
  return 'abstain';
}

/** 启发式投票（无 LLM 时回退） */
function heuristicVote(player: Player, state: RoomState): VoteChoice {
  const bill = state.currentBill;
  if (!bill) return 'abstain';
  const myAllocation = bill.allocations.find((a) => a.playerId === player.id);
  const myGain = myAllocation?.percentage ?? 0;
  if (myGain >= 25) return 'yea';
  if (myGain < 15) return 'nay';
  return Math.random() > 0.5 ? 'yea' : 'nay';
}

/** AI 生成谈判发言 */
export async function aiNegotiate(player: Player, state: RoomState): Promise<string | null> {
  const ai = getClient();
  if (!ai) {
    const bill = state.currentBill;
    const myAllocation = bill?.allocations.find((a) => a.playerId === player.id);
    const gain = myAllocation?.percentage ?? 0;
    if (gain >= 25) return '我的分配还不错，倾向支持。';
    if (gain < 15) return '这个分配对我不利，我反对。';
    return '先看看大家的意见。';
  }

  try {
    const bill = state.currentBill;
    const myAllocation = bill?.allocations.find((a) => a.playerId === player.id);
    const playersBrief = state.players
      .filter((p) => p.id !== player.id)
      .map((p) => `${p.name}（声誉${Math.round(p.reputation * 100)}%）`)
      .join('、');

    const resp = await ai.chat.completions.create({
      model: config.openai.model,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: `当前议案：${bill?.title}。我的分配比例：${myAllocation?.percentage ?? 0}%。其他议员：${playersBrief}。请用一两句话简短发言表态。`,
        },
      ],
      max_tokens: 100,
      temperature: 0.8,
    });
    return resp.choices[0]?.message?.content ?? null;
  } catch {
    return null;
  }
}
