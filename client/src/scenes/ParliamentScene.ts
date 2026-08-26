import Phaser from 'phaser';
import type { RoomState, GamePhase } from '@parliament/shared';
import { getReputationColor } from '@parliament/shared';

// ============================================================
// Phaser 渲染层 — 议会桌场景
// 程序化绘制：环形议会桌 + 议员棋子 + 投票指示 + 阶段动效
// 与 UI 层解耦，只通过外部传入的 state 渲染
// ============================================================

const COLORS = {
  ink: 0x0e0e10,
  slate: 0x1a1a1e,
  slate2: 0x25252b,
  gold: 0xc9a961,
  goldDim: 0x8a7a4a,
  crimson: 0xb23a3a,
  emerald: 0x2e7d5b,
  parchment: 0xd8cfb8,
  ash: 0x8a8a92,
};

const PHASE_TINT: Record<GamePhase, number> = {
  lobby: 0x1a1a1e,
  reveal: 0x1a1a1e,
  negotiate: 0x1a1a1e,
  vote: 0x1e1a22,
  settle: 0x1a1e1a,
  finished: 0x1a1a1e,
};

const IDENTITY_COLORS: Record<string, number> = {
  conservative: COLORS.gold,
  radical: COLORS.crimson,
  moderate: COLORS.emerald,
  conspirator: COLORS.parchment,
  agitator: COLORS.goldDim,
};

interface TokenData {
  id: string;
  name: string;
  isAI: boolean;
  reputation: number;
  capital: number;
  identity: string;
  hasVoted: boolean;
}

export class ParliamentScene extends Phaser.Scene {
  private tokens: Map<string, Phaser.GameObjects.Container> = new Map();
  private tableCenter = { x: 480, y: 320 };
  private tableRadius = 220;

  private tableOuter!: Phaser.GameObjects.Graphics;
  private tableMain!: Phaser.GameObjects.Graphics;
  private tableInner!: Phaser.GameObjects.Graphics;
  private emblem!: Phaser.GameObjects.Graphics;
  private billTitleText: Phaser.GameObjects.Text | null = null;
  private phaseLabel: Phaser.GameObjects.Text | null = null;
  private currentPhase: GamePhase = 'lobby';

  constructor() {
    super({ key: 'ParliamentScene' });
  }

  create() {
    this.cameras.main.setBackgroundColor(COLORS.ink);
    this.drawTable();
    this.drawCenterText();
  }

  private drawTable() {
    const { x, y } = this.tableCenter;
    const r = this.tableRadius;

    this.tableOuter = this.add.graphics();
    this.tableOuter.fillStyle(COLORS.slate2, 1);
    this.tableOuter.fillCircle(x, y, r + 30);

    this.tableMain = this.add.graphics();
    this.tableMain.fillStyle(COLORS.slate, 1);
    this.tableMain.fillCircle(x, y, r);
    this.tableMain.lineStyle(2, COLORS.goldDim, 1);
    this.tableMain.strokeCircle(x, y, r);

    this.tableInner = this.add.graphics();
    this.tableInner.lineStyle(1, COLORS.goldDim, 0.4);
    this.tableInner.strokeCircle(x, y, r * 0.7);
    this.tableInner.strokeCircle(x, y, r * 0.4);

    this.emblem = this.add.graphics();
    this.emblem.fillStyle(COLORS.goldDim, 0.3);
    this.emblem.fillCircle(x, y, 30);
    this.emblem.lineStyle(2, COLORS.gold, 1);
    this.emblem.strokeCircle(x, y, 30);
  }

  private drawCenterText() {
    const { x, y } = this.tableCenter;

    this.billTitleText = this.add.text(x, y - 10, '', {
      fontFamily: 'Georgia, serif',
      fontSize: '16px',
      color: '#C9A961',
      align: 'center',
      wordWrap: { width: 260 },
    });
    this.billTitleText.setOrigin(0.5);
    this.billTitleText.setAlpha(0);

    this.phaseLabel = this.add.text(x, y + 20, '议会大厅', {
      fontFamily: 'Georgia, serif',
      fontSize: '12px',
      color: '#8A8A92',
    });
    this.phaseLabel.setOrigin(0.5);
  }

  /** 根据房间状态更新议员棋子 */
  syncState(state: RoomState) {
    const phaseChanged = state.phase !== this.currentPhase;
    this.currentPhase = state.phase;

    if (phaseChanged) {
      this.updatePhaseVisuals(state.phase, state.currentBill?.title ?? null);
    } else if (state.currentBill && this.billTitleText) {
      const title = state.currentBill.title;
      if (this.billTitleText.text !== title) {
        this.billTitleText.setText(title);
      }
    }

    const players = state.players;
    const count = players.length;
    if (count === 0) return;

    const currentIds = new Set(players.map((p) => p.id));
    for (const [id, token] of this.tokens) {
      if (!currentIds.has(id)) {
        token.destroy();
        this.tokens.delete(id);
      }
    }

    players.forEach((player, index) => {
      const angle = (index / count) * Math.PI * 2 - Math.PI / 2;
      const px = this.tableCenter.x + Math.cos(angle) * this.tableRadius;
      const py = this.tableCenter.y + Math.sin(angle) * this.tableRadius;

      let token = this.tokens.get(player.id);
      if (!token) {
        token = this.createToken(player as TokenData, px, py);
        this.tokens.set(player.id, token);
      }

      this.tweens.add({
        targets: token,
        x: px,
        y: py,
        duration: 400,
        ease: 'Power2',
      });

      this.updateToken(token, player as TokenData, state);
    });
  }

  private updatePhaseVisuals(phase: GamePhase, billTitle: string | null) {
    const tint = PHASE_TINT[phase] ?? COLORS.slate;

    this.tableMain.clear();
    this.tableMain.fillStyle(tint, 1);
    this.tableMain.fillCircle(this.tableCenter.x, this.tableCenter.y, this.tableRadius);
    this.tableMain.lineStyle(2, COLORS.goldDim, 1);
    this.tableMain.strokeCircle(this.tableCenter.x, this.tableCenter.y, this.tableRadius);

    const phaseLabels: Record<string, string> = {
      lobby: '议会大厅',
      reveal: '议案揭示',
      negotiate: '谈判阶段',
      vote: '投票表决',
      settle: '结算阶段',
      finished: '终局',
    };
    this.phaseLabel?.setText(phaseLabels[phase] ?? phase);

    if (billTitle && this.billTitleText) {
      this.billTitleText.setText(billTitle);
      this.tweens.add({
        targets: this.billTitleText,
        alpha: 0.9,
        duration: 600,
        ease: 'Power2',
      });
      this.emblem.setAlpha(0.15);
    } else if (this.billTitleText) {
      this.tweens.add({
        targets: this.billTitleText,
        alpha: 0,
        duration: 300,
        ease: 'Power2',
      });
      this.emblem.setAlpha(1);
    }
  }

  private createToken(data: TokenData, x: number, y: number): Phaser.GameObjects.Container {
    const container = this.add.container(x, y);

    const base = this.add.graphics();
    base.fillStyle(COLORS.slate2, 1);
    base.fillCircle(0, 0, 42);
    base.lineStyle(2, COLORS.goldDim, 1);
    base.strokeCircle(0, 0, 42);

    const avatar = this.add.graphics();
    const idColor = IDENTITY_COLORS[data.identity] ?? COLORS.gold;
    avatar.fillStyle(idColor, 0.8);
    avatar.fillCircle(0, -4, 22);

    const nameText = this.add.text(0, 38, data.name, {
      fontFamily: 'Georgia, serif',
      fontSize: '13px',
      color: '#D8CFB8',
    });
    nameText.setOrigin(0.5);

    const capitalText = this.add.text(0, 56, `+${data.capital}`, {
      fontFamily: 'JetBrains Mono, monospace',
      fontSize: '14px',
      color: '#C9A961',
    });
    capitalText.setOrigin(0.5);

    const repBg = this.add.graphics();
    repBg.fillStyle(COLORS.slate2, 1);
    repBg.fillRoundedRect(-28, 72, 56, 4, 2);

    const repBar = this.add.graphics();

    const voteDot = this.add.graphics();
    voteDot.setAlpha(0);

    container.add([base, avatar, nameText, capitalText, repBg, repBar, voteDot]);

    container.setData('capitalText', capitalText);
    container.setData('repBar', repBar);
    container.setData('voteDot', voteDot);
    container.setData('base', base);

    return container;
  }

  private updateToken(
    token: Phaser.GameObjects.Container,
    player: TokenData,
    _state: RoomState,
  ) {
    const capitalText = token.getData('capitalText') as Phaser.GameObjects.Text;
    const repBar = token.getData('repBar') as Phaser.GameObjects.Graphics;
    const voteDot = token.getData('voteDot') as Phaser.GameObjects.Graphics;
    const base = token.getData('base') as Phaser.GameObjects.Graphics;

    capitalText.setText(`+${player.capital}`);

    repBar.clear();
    const repColor = Phaser.Display.Color.HexStringToColor(
      getReputationColor(player.reputation),
    ).color;
    const width = 56 * player.reputation;
    repBar.fillStyle(repColor, 1);
    repBar.fillRoundedRect(-28, 72, width, 4, 2);

    // 投票指示器
    voteDot.clear();
    if (player.hasVoted) {
      voteDot.fillStyle(COLORS.gold, 1);
      voteDot.fillCircle(30, -30, 6);
      voteDot.lineStyle(2, COLORS.ink, 1);
      voteDot.strokeCircle(30, -30, 6);
      voteDot.setAlpha(1);

      // 弹出动画
      this.tweens.add({
        targets: voteDot,
        scaleX: { from: 0, to: 1 },
        scaleY: { from: 0, to: 1 },
        duration: 300,
        ease: 'Back.easeOut',
      });
    } else {
      voteDot.setAlpha(0);
    }

    // 当前玩家高亮
    base.clear();
    base.fillStyle(COLORS.slate2, 1);
    base.fillCircle(0, 0, 42);
    base.lineStyle(2, COLORS.gold, 1);
    base.strokeCircle(0, 0, 42);
  }
}

/** 创建 Phaser 游戏实例 */
export function createPhaserGame(parent: HTMLElement): Phaser.Game {
  return new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: 960,
    height: 640,
    backgroundColor: '#0E0E10',
    scale: {
      mode: Phaser.Scale.RESIZE,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    scene: [ParliamentScene],
  });
}
