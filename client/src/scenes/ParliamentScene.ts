import Phaser from 'phaser';
import type { RoomState } from '@parliament/shared';
import { getReputationColor } from '@parliament/shared';

// ============================================================
// Phaser 渲染层 — 议会桌场景
// 程序化绘制：环形议会桌 + 议员棋子 + 状态动效
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

interface TokenData {
  id: string;
  name: string;
  isAI: boolean;
  reputation: number;
  capital: number;
  identity: string;
}

export class ParliamentScene extends Phaser.Scene {
  private tokens: Map<string, Phaser.GameObjects.Container> = new Map();
  private tableCenter = { x: 480, y: 320 };
  private tableRadius = 220;

  constructor() {
    super({ key: 'ParliamentScene' });
  }

  create() {
    // 墨色背景
    this.cameras.main.setBackgroundColor(COLORS.ink);

    // 议会桌（环形）
    this.drawTable();

    // 标题
    const titleText = this.add.text(this.tableCenter.x, 40, '议会大厅', {
      fontFamily: 'Georgia, serif',
      fontSize: '24px',
      color: '#C9A961',
    });
    titleText.setOrigin(0.5);
  }

  private drawTable() {
    const { x, y } = this.tableCenter;
    const r = this.tableRadius;

    // 桌面外环
    const outer = this.add.graphics();
    outer.fillStyle(COLORS.slate2, 1);
    outer.fillCircle(x, y, r + 30);

    // 桌面
    const table = this.add.graphics();
    table.fillStyle(COLORS.slate, 1);
    table.fillCircle(x, y, r);
    table.lineStyle(2, COLORS.goldDim, 1);
    table.strokeCircle(x, y, r);

    // 桌面暗金内纹
    const inner = this.add.graphics();
    inner.lineStyle(1, COLORS.goldDim, 0.4);
    inner.strokeCircle(x, y, r * 0.7);
    inner.strokeCircle(x, y, r * 0.4);

    // 中央徽记
    const emblem = this.add.graphics();
    emblem.fillStyle(COLORS.goldDim, 0.3);
    emblem.fillCircle(x, y, 30);
    emblem.lineStyle(2, COLORS.gold, 1);
    emblem.strokeCircle(x, y, 30);
  }

  /** 根据房间状态更新议员棋子 */
  syncState(state: RoomState) {
    const players = state.players;
    const count = players.length;
    if (count === 0) return;

    // 移除已离开的议员
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
        token = this.createToken(player, px, py);
        this.tokens.set(player.id, token);
      }

      // 更新位置（平滑移动）
      this.tweens.add({
        targets: token,
        x: px,
        y: py,
        duration: 400,
        ease: 'Power2',
      });

      this.updateToken(token, player, state);
    });
  }

  private createToken(data: TokenData, x: number, y: number): Phaser.GameObjects.Container {
    const container = this.add.container(x, y);

    // 棋子底盘
    const base = this.add.graphics();
    base.fillStyle(COLORS.slate2, 1);
    base.fillCircle(0, 0, 42);
    base.lineStyle(2, COLORS.goldDim, 1);
    base.strokeCircle(0, 0, 42);

    // 头像（几何形状 + 身份色）
    const avatar = this.add.graphics();
    const identityColors: Record<string, number> = {
      conservative: COLORS.gold,
      radical: COLORS.crimson,
      moderate: COLORS.emerald,
      conspirator: COLORS.parchment,
      agitator: COLORS.goldDim,
    };
    const idColor = identityColors[data.identity] ?? COLORS.gold;
    avatar.fillStyle(idColor, 0.8);
    avatar.fillCircle(0, -4, 22);

    // 名称
    const nameText = this.add.text(0, 38, data.name, {
      fontFamily: 'Georgia, serif',
      fontSize: '13px',
      color: '#D8CFB8',
    });
    nameText.setOrigin(0.5);

    // 资本
    const capitalText = this.add.text(0, 56, `+${data.capital}`, {
      fontFamily: 'JetBrains Mono, monospace',
      fontSize: '14px',
      color: '#C9A961',
    });
    capitalText.setOrigin(0.5);

    // 声誉条背景
    const repBg = this.add.graphics();
    repBg.fillStyle(COLORS.slate2, 1);
    repBg.fillRoundedRect(-28, 72, 56, 4, 2);

    // 声誉条填充
    const repBar = this.add.graphics();

    container.add([base, avatar, nameText, capitalText, repBg, repBar]);

    // 存储引用
    container.setData('capitalText', capitalText);
    container.setData('repBar', repBar);

    return container;
  }

  private updateToken(
    token: Phaser.GameObjects.Container,
    player: TokenData,
    state: RoomState,
  ) {
    const capitalText = token.getData('capitalText') as Phaser.GameObjects.Text;
    const repBar = token.getData('repBar') as Phaser.GameObjects.Graphics;

    capitalText.setText(`+${player.capital}`);

    // 重绘声誉条
    repBar.clear();
    const repColor = Phaser.Display.Color.HexStringToColor(
      getReputationColor(player.reputation),
    ).color;
    const width = 56 * player.reputation;
    repBar.fillStyle(repColor, 1);
    repBar.fillRoundedRect(-28, 72, width, 4, 2);
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
