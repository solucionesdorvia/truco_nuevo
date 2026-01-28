export type RoomPrivacy = "public" | "private";
export type RoomMode = "1v1" | "2v2" | "3v3";
export type RoomEconomy = "free" | "paid";
export type TeamId = "A" | "B";
export type RoomStatus = "open" | "in_progress" | "closed";

export interface RoomConfig {
  name?: string;
  privacy: RoomPrivacy;
  mode: RoomMode;
  points: 15 | 30;
  economy: RoomEconomy;
  entryFee: number;
  allowFlor: boolean;
}

export interface RoomMember {
  userId: string;
  team: TeamId;
  joinedAt: string;
}

export interface RoomState {
  id: string;
  name?: string;
  privacy: RoomPrivacy;
  mode: RoomMode;
  points: 15 | 30;
  economy: RoomEconomy;
  entryFee: number;
  allowFlor: boolean;
  joinCodeA?: string | null;
  joinCodeB?: string | null;
  createdBy: string;
  status: RoomStatus;
  potTotal: number;
  createdAt: string;
  members: RoomMember[];
  gameId?: string;
}

export interface RoomJoinResult {
  room: RoomState;
  team: TeamId;
}
