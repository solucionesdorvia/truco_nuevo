import db from "../db";
import { RoomMember, TeamId } from "./roomTypes";

export const roomMemberRepository = {
  add(roomId: string, member: RoomMember): void {
    db.prepare(
      "INSERT INTO room_members (id, room_id, user_id, team, joined_at) VALUES (?, ?, ?, ?, ?)"
    ).run(`${roomId}:${member.userId}`, roomId, member.userId, member.team, member.joinedAt);
  },

  list(roomId: string): RoomMember[] {
    const rows = db
      .prepare("SELECT user_id as userId, team, joined_at as joinedAt FROM room_members WHERE room_id = ?")
      .all(roomId);
    return rows.map((row: any) => ({
      userId: row.userId,
      team: row.team as TeamId,
      joinedAt: row.joinedAt
    }));
  },

  remove(roomId: string, userId: string): void {
    db.prepare("DELETE FROM room_members WHERE room_id = ? AND user_id = ?").run(roomId, userId);
  }
};
