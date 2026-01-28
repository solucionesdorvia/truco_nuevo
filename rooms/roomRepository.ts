import db from "../db";
import { RoomState } from "./roomTypes";

const mapRow = (row: any): RoomState => ({
  id: row.id,
  name: row.name ?? undefined,
  privacy: row.privacy,
  mode: row.mode,
  points: row.points,
  economy: row.economy,
  entryFee: row.entry_fee,
  allowFlor: Boolean(row.allow_flor),
  joinCodeA: row.join_code_a,
  joinCodeB: row.join_code_b,
  createdBy: row.created_by,
  status: row.status,
  potTotal: row.pot_total,
  createdAt: row.created_at,
  members: []
});

export const roomRepository = {
  create(room: RoomState): RoomState {
    db.prepare(
      `INSERT INTO rooms
        (id, name, privacy, mode, points, economy, entry_fee, allow_flor, join_code_a, join_code_b, created_by, status, pot_total, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      room.id,
      room.name ?? null,
      room.privacy,
      room.mode,
      room.points,
      room.economy,
      room.entryFee,
      room.allowFlor ? 1 : 0,
      room.joinCodeA ?? null,
      room.joinCodeB ?? null,
      room.createdBy,
      room.status,
      room.potTotal,
      room.createdAt
    );

    return room;
  },

  listOpenRooms(): RoomState[] {
    const rows = db
      .prepare("SELECT * FROM rooms WHERE status = 'open' ORDER BY created_at DESC")
      .all();
    return rows.map(mapRow);
  },

  findById(id: string): RoomState | null {
    const row = db.prepare("SELECT * FROM rooms WHERE id = ?").get(id);
    return row ? mapRow(row) : null;
  },

  findByJoinCode(code: string): RoomState | null {
    const row = db
      .prepare("SELECT * FROM rooms WHERE join_code_a = ? OR join_code_b = ?")
      .get(code, code);
    return row ? mapRow(row) : null;
  },

  updatePot(roomId: string, potTotal: number): void {
    db.prepare("UPDATE rooms SET pot_total = ? WHERE id = ?").run(potTotal, roomId);
  },

  updateStatus(roomId: string, status: RoomState["status"]): void {
    db.prepare("UPDATE rooms SET status = ? WHERE id = ?").run(status, roomId);
  }
};
