import { v4 as uuid } from "uuid";
import { chipsService } from "../chips/chipsService";
import { createInitialGameState } from "../gameLogic/trucoEngine";
import { RoomConfig, RoomJoinResult, RoomMember, RoomMode, RoomState, TeamId } from "./roomTypes";
import { roomMemberRepository } from "./roomMemberRepository";
import { roomRepository } from "./roomRepository";
import { rankingService } from "../ranking/rankingService";

const rooms = new Map<string, RoomState>();
const games = new Map<string, ReturnType<typeof createInitialGameState>>();
const completedGames = new Set<string>();

const getTeamSize = (mode: RoomMode): number => {
  if (mode === "1v1") return 1;
  if (mode === "2v2") return 2;
  return 3;
};

const generateJoinCode = (): string =>
  Math.floor(100000 + Math.random() * 900000).toString();

const ensureRoomLoaded = (roomId: string): RoomState => {
  const inMemory = rooms.get(roomId);
  if (inMemory) return inMemory;

  const fromDb = roomRepository.findById(roomId);
  if (!fromDb) {
    throw new Error("Room not found");
  }

  fromDb.members = roomMemberRepository.list(roomId);
  rooms.set(roomId, fromDb);
  return fromDb;
};

const pickTeam = (room: RoomState, preferred?: TeamId): TeamId => {
  const teamSize = getTeamSize(room.mode);
  const countA = room.members.filter((m) => m.team === "A").length;
  const countB = room.members.filter((m) => m.team === "B").length;

  if (preferred === "A" && countA < teamSize) return "A";
  if (preferred === "B" && countB < teamSize) return "B";

  return countA <= countB && countA < teamSize ? "A" : "B";
};

const assertSlotAvailable = (room: RoomState, team: TeamId): void => {
  const teamSize = getTeamSize(room.mode);
  const count = room.members.filter((m) => m.team === team).length;
  if (count >= teamSize) {
    throw new Error("Team is full");
  }
};

const maybeStartGame = (room: RoomState): void => {
  const teamSize = getTeamSize(room.mode);
  const totalPlayers = room.members.length;
  if (totalPlayers !== teamSize * 2) return;

  if (room.status !== "in_progress") {
    room.status = "in_progress";
  }

  if (!games.has(room.id)) {
    const players = room.members.map((member, index) => ({
      userId: member.userId,
      seat: index,
      team: member.team
    }));
    const gameState = createInitialGameState({
      roomId: room.id,
      players,
      targetScore: room.points
    });
    games.set(room.id, gameState);
  }
};

export const roomService = {
  loadOpenRooms(): void {
    const openRooms = roomRepository.listOpenRooms();
    for (const room of openRooms) {
      room.members = roomMemberRepository.list(room.id);
      rooms.set(room.id, room);
    }
  },

  listPublicRooms(): RoomState[] {
    return [...rooms.values()].filter((room) => room.privacy === "public");
  },

  createRoom(userId: string, config: RoomConfig): RoomState {
    if (config.economy === "paid" && config.entryFee <= 0) {
      throw new Error("Entry fee required for paid rooms");
    }

    if (config.points !== 15 && config.points !== 30) {
      throw new Error("Invalid points configuration");
    }

    const now = new Date().toISOString();
    const joinCodeA = config.privacy === "private" ? generateJoinCode() : null;
    const joinCodeB = config.privacy === "private" ? generateJoinCode() : null;

    const room: RoomState = {
      id: uuid(),
      name: config.name,
      privacy: config.privacy,
      mode: config.mode,
      points: config.points,
      economy: config.economy,
      entryFee: config.entryFee,
      allowFlor: config.allowFlor,
      joinCodeA,
      joinCodeB,
      createdBy: userId,
      status: "open",
      potTotal: 0,
      createdAt: now,
      members: []
    };

    roomRepository.create(room);
    rooms.set(room.id, room);
    return room;
  },

  joinRoom(params: {
    userId: string;
    roomId?: string;
    code?: string;
    team?: TeamId;
  }): RoomJoinResult {
    const room = params.roomId
      ? ensureRoomLoaded(params.roomId)
      : params.code
        ? ensureRoomLoaded(roomRepository.findByJoinCode(params.code)?.id ?? "")
        : null;

    if (!room) {
      throw new Error("Room not found");
    }

    if (room.status === "closed") {
      throw new Error("Room is closed");
    }

    if (room.members.some((m) => m.userId === params.userId)) {
      return { room, team: room.members.find((m) => m.userId === params.userId)!.team };
    }

    let team: TeamId | undefined = params.team;
    if (params.code) {
      if (room.joinCodeA === params.code) team = "A";
      if (room.joinCodeB === params.code) team = "B";
    }

    const finalTeam = pickTeam(room, team);
    assertSlotAvailable(room, finalTeam);

    if (room.economy === "paid" && room.entryFee > 0) {
      chipsService.debit(params.userId, room.entryFee, "room_entry", { roomId: room.id });
      room.potTotal += room.entryFee;
      roomRepository.updatePot(room.id, room.potTotal);
    }

    const member: RoomMember = {
      userId: params.userId,
      team: finalTeam,
      joinedAt: new Date().toISOString()
    };

    room.members.push(member);
    roomMemberRepository.add(room.id, member);
    maybeStartGame(room);

    return { room, team: finalTeam };
  },

  leaveRoom(roomId: string, userId: string): RoomState {
    const room = ensureRoomLoaded(roomId);
    room.members = room.members.filter((member) => member.userId !== userId);
    roomMemberRepository.remove(roomId, userId);
    return room;
  },

  getRoomState(roomId: string): RoomState {
    return ensureRoomLoaded(roomId);
  },

  getGameState(roomId: string) {
    return games.get(roomId);
  },

  completeGame(roomId: string, winnerTeam: TeamId): void {
    if (completedGames.has(roomId)) return;
    const room = ensureRoomLoaded(roomId);
    const winners = room.members.filter((m) => m.team === winnerTeam).map((m) => m.userId);
    const losers = room.members.filter((m) => m.team !== winnerTeam).map((m) => m.userId);

    if (room.economy === "paid" && room.potTotal > 0 && winners.length) {
      const share = Math.floor(room.potTotal / winners.length);
      for (const userId of winners) {
        chipsService.credit(userId, share, "room_payout", { roomId });
      }
      room.potTotal = 0;
      roomRepository.updatePot(roomId, room.potTotal);
    }

    rankingService.recordMatch({ winners, losers });
    room.status = "closed";
    roomRepository.updateStatus(roomId, room.status);
    completedGames.add(roomId);
  }
};
