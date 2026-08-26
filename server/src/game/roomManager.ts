import type { RoomState, Player } from '@parliament/shared';
import { GAME_CONFIG } from '@parliament/shared';
import { nanoid } from 'nanoid';
import { GameStateMachine } from './stateMachine.js';

// ============================================================
// 房间管理器 — 管理所有活跃房间与 AI 填位
// ============================================================

export class RoomManager {
  private rooms = new Map<string, GameStateMachine>();
  private playerRoom = new Map<string, string>(); // socketId -> roomId

  createRoom(): GameStateMachine {
    const roomId = nanoid(8);
    const machine = new GameStateMachine(roomId);
    this.rooms.set(roomId, machine);
    return machine;
  }

  getRoom(roomId: string): GameStateMachine | undefined {
    return this.rooms.get(roomId);
  }

  joinRoom(roomId: string, socketId: string, name: string): { machine: GameStateMachine; player: Player } | { error: string } {
    let machine = this.rooms.get(roomId);
    if (!machine) {
      // 房间不存在则创建
      machine = this.createRoom();
      roomId = machine.state.id;
    }

    if (machine.state.phase !== 'lobby') {
      return { error: '游戏已开始，无法加入' };
    }
    if (machine.state.players.length >= GAME_CONFIG.MAX_PLAYERS) {
      return { error: '房间已满' };
    }

    const player: Player = {
      id: socketId,
      name,
      isAI: false,
      isHost: machine.state.players.length === 0,
      identity: 'conservative',
      capital: 0,
      reputation: 0.5,
      totalPromises: 0,
      fulfilledPromises: 0,
      ready: false,
      hasVoted: false,
    };

    machine.addPlayer(player);
    this.playerRoom.set(socketId, machine.state.id);

    return { machine, player };
  }

  leaveRoom(socketId: string): GameStateMachine | undefined {
    const roomId = this.playerRoom.get(socketId);
    if (!roomId) return;
    this.playerRoom.delete(socketId);

    const machine = this.rooms.get(roomId);
    if (!machine) return;

    machine.removePlayer(socketId);
    if (machine.state.players.length === 0) {
      this.rooms.delete(roomId);
    }
    return machine;
  }

  /** 填入 AI NPC 凑齐人数 */
  fillAIPlayers(machine: GameStateMachine, aiBuilder: (id: string) => Player): Player[] {
    const added: Player[] = [];
    while (machine.state.players.length < GAME_CONFIG.V0_ROOM_SIZE) {
      const ai = aiBuilder(`ai-${nanoid(6)}`);
      machine.addPlayer(ai);
      ai.ready = true;
      added.push(ai);
    }
    return added;
  }

  getPlayerRoom(socketId: string): GameStateMachine | undefined {
    const roomId = this.playerRoom.get(socketId);
    if (!roomId) return;
    return this.rooms.get(roomId);
  }

  getState(roomId: string): RoomState | undefined {
    return this.rooms.get(roomId)?.state;
  }

  listRooms(): RoomState[] {
    return Array.from(this.rooms.values()).map((m) => m.state);
  }
}

export const roomManager = new RoomManager();
