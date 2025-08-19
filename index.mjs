import express from "express";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";
import mongoose from "mongoose";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
import axios from "axios";
import authRouter from "./Routes/auth.mjs";
import passport from "./Auth/passport.mjs";

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
	cors: {
		origin: "https://type-rush-frontend.vercel.app",
		credentials: true,
	},
});
const PORT = process.env.PORT || 8080;
app.use(
	cors({
		origin: "https://type-rush-frontend.vercel.app",
		credentials: true,
	})
);

app.use(express.json());
app.use(cookieParser());
app.use(passport.initialize());

const rooms = {};
const gameStats = {};

function generateRoom() {
	const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
	let id = "";
	for (let i = 0; i < 8; i++) {
		id += chars.charAt(Math.floor(Math.random() * chars.length));
	}
	return rooms[id] ? generateRoom() : id;
}

const getText = async () => {
	const res = await axios.get(
		"https://random-word-api.vercel.app/api?words=50&length=5"
	);
	let text = res.data.join(" ").split("");
	return text;
};

mongoose
	.connect(process.env.MONGO_URI)
	.then(() => {
		console.log(`connected to DB`);
		io.on("connection", (socket) => {
			console.log(`user connected: ${socket.id}`);

			socket.on("create-room", (playerName) => {
				const roomId = generateRoom();

				const room = {
					id: roomId,
					players: [
						{
							id: socket.id,
							name: playerName,
							isHost: true,
						},
					],
				};
				rooms[roomId] = room;
				socket.join(roomId);
				socket.emit("room-created", roomId);
				io.to(roomId).emit("player-list", room.players);
				console.log(room);
			});

			socket.on("join-room", ({ roomId, playerName }) => {
				const room = rooms[roomId];
				if (room) {
					room.players.push({
						id: socket.id,
						name: playerName,
						isHost: false,
					});
					socket.join(roomId);
					io.to(roomId).emit("player-list", room.players);
				} else {
					socket.emit("error", "Room does not exist.");
				}
			});

			socket.on("start-game", async (roomId) => {
				try {
					const text = await getText();
					console.log(text);
					socket.to(roomId).emit("start-game", roomId);
					setTimeout(() => {
						io.to(roomId).emit("set-text", text);
					}, 1000);
				} catch (err) {
					console.error("Error fetching text:", err);
				}
			});

			socket.on("player-progress", ({ roomId, userId, progress, name }) => {
				io.to(roomId).emit("update-progress", {
					userId,
					roomId,
					progress,
					name,
				});
			});

			socket.on("game-end-request", (roomId) => {
				io.to(roomId).emit("game-ended");
			});

			socket.on("personal-stats", ({ stats, roomId }) => {
				console.log("personal stats", stats);
				if (!gameStats[roomId]) {
					gameStats[roomId] = []; // initialize array properly
				}
				gameStats[roomId] = gameStats[roomId].filter(
					(s) => s.userId !== stats.userId
				);
				gameStats[roomId].push(stats);
				io.to(roomId).emit("player-stats", gameStats[roomId]);
			});

			socket.on("disconnect", () => {
				console.log(`User disconnected: ${socket.id}`);
				for (const roomId in rooms) {
					const room = rooms[roomId];
					if (!room) continue;
					const playerIndex = room.players.findIndex((p) => p.id === socket.id);
					if (playerIndex === -1) continue;
					const isHost = room.players[playerIndex].isHost;
					room.players.splice(playerIndex, 1);
					if (isHost) {
						io.to(roomId).emit("room-closed");
						delete rooms[roomId];
						console.log(`Host disconnected.`);
					} else {
						room.players = room.players.filter(
							(player) => player.id !== socket.id
						);
						if (room.players.length == 0) {
							delete rooms[roomId];
							delete gameStats[roomId];
							console.log(`Room ${roomId} deleted because it's empty`);
						} else {
							io.to(roomId).emit("player-list", room.players);
						}
					}
				}
			});
		});
		server.listen(PORT, () => {
			console.log(`app running at ${PORT}`);
		});
	})
	.catch((err) => {
		console.log("DB connection error", err);
	});

app.use("/api", authRouter);
