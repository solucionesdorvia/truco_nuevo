import { Server } from "socket.io";
import { applyAction } from "../gameLogic/trucoEngine";
import { roomService } from "../rooms/roomService";
import { TeamId } from "../rooms/roomTypes";
import { userService } from "../users/userService";

const toRoomSummary = (room: ReturnType<typeof roomService.getRoomState>) => ({
  id: room.id,
  name: room.name,
  privacy: room.privacy,
  mode: room.mode,
  points: room.points,
  economy: room.economy,
  entryFee: room.entryFee,
  allowFlor: room.allowFlor,
  status: room.status,
  potTotal: room.potTotal,
  members: room.members
});

const toRoomState = (room: ReturnType<typeof roomService.getRoomState>) => ({
  ...toRoomSummary(room),
  joinCodeA: room.joinCodeA,
  joinCodeB: room.joinCodeB
});

export const registerSockets = (io: Server) => {
  io.use((socket, next) => {
    const token =
      (socket.handshake.auth as { token?: string } | undefined)?.token ??
      socket.handshake.headers["x-user-token"]?.toString();

    if (!token) {
      return next(new Error("Missing auth token"));
    }

    const user = userService.getByToken(token);
    if (!user) {
      return next(new Error("Invalid auth token"));
    }

    socket.data.user = user;
    return next();
  });

  io.on("connection", (socket) => {
    const user = socket.data.user;

    socket.on("rooms:list", () => {
      socket.emit("rooms:list", roomService.listPublicRooms().map(toRoomSummary));
    });

    socket.on("rooms:create", (payload: { config: any }) => {
      try {
        const room = roomService.createRoom(user.id, payload.config);
        const joinResult = roomService.joinRoom({ userId: user.id, roomId: room.id, team: "A" });
        socket.join(room.id);
        io.to(room.id).emit("room:state", toRoomState(joinResult.room));
        io.emit("rooms:update", roomService.listPublicRooms().map(toRoomSummary));

        const gameState = roomService.getGameState(room.id);
        if (gameState) {
          io.to(room.id).emit("game:state", gameState);
        }
      } catch (error) {
        socket.emit("rooms:error", { message: (error as Error).message });
      }
    });

    socket.on("rooms:join", (payload: { roomId?: string; code?: string; team?: TeamId }) => {
      try {
        const joinResult = roomService.joinRoom({
          userId: user.id,
          roomId: payload.roomId,
          code: payload.code,
          team: payload.team
        });
        socket.join(joinResult.room.id);
        io.to(joinResult.room.id).emit("room:state", toRoomState(joinResult.room));
        io.emit("rooms:update", roomService.listPublicRooms().map(toRoomSummary));

        const gameState = roomService.getGameState(joinResult.room.id);
        if (gameState) {
          io.to(joinResult.room.id).emit("game:state", gameState);
        }
      } catch (error) {
        socket.emit("rooms:error", { message: (error as Error).message });
      }
    });

    socket.on("rooms:leave", (payload: { roomId: string }) => {
      try {
        const room = roomService.leaveRoom(payload.roomId, user.id);
        socket.leave(payload.roomId);
        io.to(payload.roomId).emit("room:state", toRoomState(room));
        io.emit("rooms:update", roomService.listPublicRooms().map(toRoomSummary));
      } catch (error) {
        socket.emit("rooms:error", { message: (error as Error).message });
      }
    });

    socket.on("game:action", (payload: { roomId: string; action: any }) => {
      const gameState = roomService.getGameState(payload.roomId);
      if (!gameState) {
        socket.emit("game:error", { message: "Game not started" });
        return;
      }

      const result = applyAction(gameState, payload.action);
      if (result.error) {
        socket.emit("game:error", { message: result.error });
        return;
      }

      io.to(payload.roomId).emit("game:state", result.state);

      if (result.state.phase === "game_end") {
        const winnerTeam = result.state.teams.A.score >= result.state.teams.B.score ? "A" : "B";
        roomService.completeGame(payload.roomId, winnerTeam);
        io.emit("rooms:update", roomService.listPublicRooms().map(toRoomSummary));
      }
    });
  });
};
