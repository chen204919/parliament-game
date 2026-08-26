import type { RoomState, GamePhase, Player, Bill, Promise, ChatMessage, VoteChoice, VoteResult, RoundResult, BillAllocation } from '@parliament/shared';
import { GAME_CONFIG, PHASE_DURATIONS, VOTE_PASS_RATIO } from '@parliament/shared';
import { nanoid } from 'nanoid';

// ============================================================
// 房间状态机 — 管理单局四阶段流转
// 议案揭示 → 谈判（2min）→ 投票（盲投）→ 结算与声誉
// ============================================================

/** v0 固定 3 轮议案库 */
const V0_BILLS: Omit<Bill, 'index'>[] = [
  {
    title: '资源分配方案',
    description: '议会分配本季度财政资源，各议员按方案比例获得政治资本。',
    type: 'allocation',
    allocations: [],
  },
  {
    title: '联盟信任投票',
    description: '囚徒困境：是否兑现承诺？背叛者短期获利但声誉暴跌。',
    type: 'prisoners',
    allocations: [],
  },
  {
    title: '公共基金贡献',
    description: '公共品博弈：每人贡献资本至公共池，总额翻倍后均分。搭便车者获益但池子缩水。',
    type: 'public-goods',
    allocations: [],
  },
];

/** 为指定玩家组生成本轮议案 */
function generateBill(players: Player[], roundIndex: number): Bill {
  const template = V0_BILLS[roundIndex % V0_BILLS.length];
  const allocations: BillAllocation[] = players.map((p, i) => {
    let pct = 100 / players.length;
    if (template.type === 'allocation') {
      // 非均匀分配，制造谈判张力
      pct = [35, 25, 25, 15][i] ?? pct;
    }
    return { playerId: p.id, percentage: Math.round(pct) };
  });
  // 修正总和为 100
  const sum = allocations.reduce((s, a) => s + a.percentage, 0);
  if (sum !== 100 && allocations.length > 0) {
    allocations[0].percentage += 100 - sum;
  }
  return { ...template, index: roundIndex, allocations };
}

export class GameStateMachine {
  state: RoomState;

  constructor(roomId: string) {
    this.state = {
      id: roomId,
      phase: 'lobby',
      players: [],
      currentRound: 0,
      totalRounds: GAME_CONFIG.V0_TOTAL_ROUNDS,
      currentBill: null,
      bills: [],
      promises: [],
      messages: [],
      votes: [],
      results: [],
      phaseStartTime: 0,
      phaseDuration: 0,
      speakerId: null,
      createdAt: Date.now(),
    };
  }

  addPlayer(player: Player): void {
    if (this.state.players.length >= GAME_CONFIG.MAX_PLAYERS) return;
    this.state.players.push(player);
    if (this.state.players.length === 1) {
      player.isHost = true;
      this.state.speakerId = player.id;
    }
  }

  removePlayer(playerId: string): void {
    this.state.players = this.state.players.filter((p) => p.id !== playerId);
    if (this.state.players.length > 0 && !this.state.players.some((p) => p.isHost)) {
      this.state.players[0].isHost = true;
      this.state.speakerId = this.state.players[0].id;
    }
  }

  allReady(): boolean {
    return this.state.players.every((p) => p.ready);
  }

  canStart(): boolean {
    // v0：所有真人玩家就绪即可，AI 由服务端自动填位
    const humans = this.state.players.filter((p) => !p.isAI);
    return humans.length >= 1 && humans.every((p) => p.ready);
  }

  /** 推进到指定阶段 */
  transitionTo(phase: GamePhase): void {
    this.state.phase = phase;
    this.state.phaseStartTime = Date.now();

    switch (phase) {
      case 'reveal':
        this.state.currentBill = generateBill(this.state.players, this.state.currentRound);
        this.state.bills.push(this.state.currentBill);
        this.state.votes = [];
        this.state.players.forEach((p) => (p.hasVoted = false));
        this.state.phaseDuration = PHASE_DURATIONS.reveal;
        break;

      case 'negotiate':
        this.state.phaseDuration = PHASE_DURATIONS.negotiate;
        break;

      case 'vote':
        this.state.phaseDuration = PHASE_DURATIONS.vote;
        break;

      case 'settle':
        this.state.phaseDuration = PHASE_DURATIONS.settle;
        this.settleRound();
        break;

      case 'finished':
        this.state.phaseDuration = 0;
        break;
    }
  }

  /** 投票 */
  castVote(playerId: string, choice: VoteChoice): boolean {
    const player = this.state.players.find((p) => p.id === playerId);
    if (!player || player.hasVoted) return false;
    player.hasVoted = true;
    this.state.votes.push({ playerId, choice });
    return true;
  }

  /** 判断是否所有玩家已投票 */
  allVoted(): boolean {
    return this.state.players.every((p) => p.hasVoted);
  }

  /** 结算本轮 */
  private settleRound(): void {
    const votes = this.state.votes;
    const totalVoters = votes.length;
    const yeaCount = votes.filter((v) => v.choice === 'yea').length;
    const passed = totalVoters > 0 && yeaCount / totalVoters > VOTE_PASS_RATIO;

    const capitalChanges: Record<string, number> = {};
    const reputationChanges: Record<string, number> = {};
    const bill = this.state.currentBill;

    if (bill && passed) {
      // 议案通过：按分配方案给资本
      for (const alloc of bill.allocations) {
        const gain = Math.round(alloc.percentage * 2);
        capitalChanges[alloc.playerId] = gain;
        const p = this.state.players.find((pl) => pl.id === alloc.playerId);
        if (p) p.capital += gain;
      }
    } else {
      // 议案未通过：少量基础资本
      this.state.players.forEach((p) => {
        capitalChanges[p.id] = 5;
        p.capital += 5;
      });
    }

    // 检查承诺兑现/违约
    for (const promise of this.state.promises) {
      if (promise.roundIndex !== this.state.currentRound) continue;
      if (promise.status !== 'pending') continue;

      const fromPlayer = this.state.players.find((p) => p.id === promise.fromPlayerId);
      const fromVote = votes.find((v) => v.playerId === promise.fromPlayerId);
      if (fromPlayer && fromVote) {
        // 简化：若承诺中含"赞成"且玩家投了赞成，视为兑现
        const promisedYea = promise.fromAction.includes('赞成') || promise.fromAction.includes('yea');
        if (promisedYea && fromVote.choice === 'yea') {
          promise.status = 'fulfilled';
          fromPlayer.fulfilledPromises++;
          fromPlayer.totalPromises++;
          reputationChanges[fromPlayer.id] = (reputationChanges[fromPlayer.id] ?? 0) + 0.05;
        } else if (promisedYea && fromVote.choice !== 'yea') {
          promise.status = 'broken';
          fromPlayer.totalPromises++;
          reputationChanges[fromPlayer.id] = (reputationChanges[fromPlayer.id] ?? 0) - 0.15;
        }
      }
    }

    // 更新声誉
    for (const p of this.state.players) {
      const delta = reputationChanges[p.id] ?? 0;
      p.reputation = Math.max(0, Math.min(1, p.reputation + delta));
    }

    const result: RoundResult = {
      roundIndex: this.state.currentRound,
      passed,
      votes,
      capitalChanges,
      reputationChanges,
    };
    this.state.results.push(result);
  }

  /** 推进到下一轮或终局 */
  nextRound(): void {
    if (this.state.currentRound + 1 >= this.state.totalRounds) {
      this.transitionTo('finished');
    } else {
      this.state.currentRound++;
      this.transitionTo('reveal');
    }
  }

  /** 获取终局排名 */
  getRankings() {
    return [...this.state.players]
      .sort((a, b) => b.capital - a.capital)
      .map((p, i) => ({
        playerId: p.id,
        capital: p.capital,
        reputation: p.reputation,
      }));
  }

  /** 创建承诺 */
  createPromise(fromPlayerId: string, toPlayerId: string, fromAction: string, toAction: string, isPublic: boolean): Promise {
    const promise: Promise = {
      id: nanoid(),
      fromPlayerId,
      toPlayerId,
      fromAction,
      toAction,
      isPublic,
      status: 'pending',
      createdAt: Date.now(),
      roundIndex: this.state.currentRound,
    };
    this.state.promises.push(promise);
    return promise;
  }

  /** 添加聊天消息 */
  addMessage(msg: Omit<ChatMessage, 'id' | 'timestamp'>): ChatMessage {
    const message: ChatMessage = { ...msg, id: nanoid(), timestamp: Date.now() };
    this.state.messages.push(message);
    return message;
  }
}
