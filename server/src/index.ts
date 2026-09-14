import express from "express";
import cors from "cors";
import { createServer } from "http";
import { Server } from "socket.io";
import { config } from "./config";

const app = express();
app.use(cors({ origin: config.clientOrigin }));

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: config.clientOrigin },
});

io.on("connection", (socket) => {
  console.log(`[socket] connected: ${socket.id}`);

  socket.on("ping", () => {
    socket.emit("pong", { at: Date.now() });
  });

  socket.on("disconnect", () => {
    console.log(`[socket] disconnected: ${socket.id}`);
  });
});

httpServer.listen(config.port, () => {
  console.log(`server listening on :${config.port}`);
});
