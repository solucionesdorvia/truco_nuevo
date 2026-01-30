import express from "express";
import http from "http";
import path from "path";
import fs from "fs";
import cors from "cors";
import helmet from "helmet";
import { Server } from "socket.io";
import { env } from "./env";
import { registerSockets } from "./sockets";
import { requireUser, AuthenticatedRequest } from "./users/auth";
import { userService } from "./users/userService";
import { chipsService } from "./chips/chipsService";
import { roomService } from "./rooms/roomService";
import { rankingService } from "./ranking/rankingService";

const app = express();
app.use(
  helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        "default-src": ["'self'"],
        "script-src": ["'self'", "'unsafe-inline'", "https://cdn.tailwindcss.com"],
        "style-src": ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        "font-src": ["'self'", "https://fonts.gstatic.com", "data:"],
        "img-src": ["'self'", "https:", "data:"],
        "connect-src": ["'self'", "ws:", "wss:"]
      }
    }
  })
);
app.use(cors({ origin: env.corsOrigin }));
app.use(express.json());

roomService.loadOpenRooms();

const frontendPath = path.join(process.cwd(), "frontend");
const screens = new Set([
  "landing",
  "lobby",
  "crear-mesa",
  "unirse",
  "fichas",
  "tienda",
  "bases",
  "faq",
  "privacidad",
  "terminos",
  "ranking",
  "comunidad",
  "soporte",
  "mesa"
]);
const sendScreen = (res: express.Response, screen: string) => {
  const filePath = path.join(frontendPath, screen, "code.html");
  if (!fs.existsSync(filePath)) {
    res.status(404).send("Screen not found");
    return;
  }
  res.sendFile(filePath);
};

app.get("/", (_req, res) => {
  sendScreen(res, "landing");
});
app.use(express.static(frontendPath));

app.post("/api/users", (req, res) => {
  try {
    const user = userService.createUser(req.body?.username ?? "");
    res.status(201).json({
      id: user.id,
      username: user.username,
      token: user.token,
      chips: user.chips
    });
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

app.get("/api/users/me", requireUser, (req, res) => {
  const user = (req as AuthenticatedRequest).user;
  res.json({
    id: user.id,
    username: user.username,
    chips: user.chips,
    bonusChips: user.bonusChips,
    bonusLocked: user.bonusLocked,
    inviteCode: user.inviteCode
  });
});

app.get("/api/chips/balance", requireUser, (req, res) => {
  try {
    const user = (req as AuthenticatedRequest).user;
    const balance = chipsService.getBalance(user.id);
    res.json({ balance });
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

app.get("/api/chips/history", requireUser, (req, res) => {
  try {
    const user = (req as AuthenticatedRequest).user;
    const limit = Number.parseInt(req.query.limit?.toString() ?? "20", 10);
    res.json(chipsService.history(user.id, Number.isFinite(limit) ? limit : 20));
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

app.get("/api/chips/summary", requireUser, (req, res) => {
  try {
    const user = (req as AuthenticatedRequest).user;
    res.json(chipsService.getSummary(user.id));
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

app.post("/api/chips/add", requireUser, (req, res) => {
  try {
    const user = (req as AuthenticatedRequest).user;
    const amount = Number(req.body?.amount ?? 0);
    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ error: "Invalid amount" });
    }
    const metadata = req.body?.metadata && typeof req.body.metadata === "object"
      ? req.body.metadata
      : undefined;
    const summary = chipsService.deposit(user.id, amount, metadata);
    res.json(summary);
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

app.post("/api/referral/apply", requireUser, (req, res) => {
  try {
    const user = (req as AuthenticatedRequest).user;
    const code = String(req.body?.code ?? "").trim().toUpperCase();
    if (!code) {
      return res.status(400).json({ error: "Invalid code" });
    }
    if (user.inviteCode && code === user.inviteCode) {
      return res.status(400).json({ error: "Cannot use your own code" });
    }
    if (user.referredBy) {
      return res.status(400).json({ error: "Referral already set" });
    }
    const referrer = userService.getByInviteCode(code);
    if (!referrer) {
      return res.status(404).json({ error: "Code not found" });
    }
    if (referrer.id === user.id) {
      return res.status(400).json({ error: "Invalid referral" });
    }
    userService.setReferral(user.id, referrer.id);
    res.json({ ok: true });
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

app.get("/api/rooms", (req, res) => {
  const rooms = roomService.listPublicRooms();
  res.json(
    rooms.map((room) => ({
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
    }))
  );
});

app.post("/api/rooms", requireUser, (req, res) => {
  try {
    const user = (req as AuthenticatedRequest).user;
    const room = roomService.createRoom(user.id, req.body);
    res.status(201).json(room);
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

app.get("/api/ranking", (req, res) => {
  const limit = Number.parseInt(req.query.limit?.toString() ?? "50", 10);
  res.json(rankingService.getTop(limit));
});

app.get("/mesa/:id", (_req, res) => {
  sendScreen(res, "mesa");
});

app.get("/:screen", (req, res, next) => {
  const screen = req.params.screen;
  if (!screens.has(screen)) {
    return next();
  }
  sendScreen(res, screen);
});

const httpServer = http.createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: env.corsOrigin
  }
});

registerSockets(io);

httpServer.listen(env.port, () => {
  console.log(`Truco backend listening on port ${env.port}`);
});
