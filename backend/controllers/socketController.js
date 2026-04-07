const Pixel = require("../models/pixel");
const BOARD_SIZE = 100;

let board = Array(BOARD_SIZE).fill().map(() => Array(BOARD_SIZE).fill("#FFFFFF"));

async function loadBoardFromDB() {
  try {
    const pixels = await Pixel.findAll({ raw: true });
    pixels.forEach((p) => {
      if (p.y < BOARD_SIZE && p.x < BOARD_SIZE) {
        board[p.y][p.x] = p.color;
      }
    });
    console.log("Laud laetud mällu andmebaasist!");
  } catch (error) {
    console.error("Viga laadimisel:", error);
  }
}

module.exports = function (io) {
  loadBoardFromDB();

  const emitActiveUsers = () => {
    io.emit("dev:activeUsers", io.engine.clientsCount);
  };

  io.on("connection", (socket) => {
    socket.emit("initBoard", board);
    socket.emit("dev:boardMeta", { boardSize: BOARD_SIZE });
    emitActiveUsers();

    socket.on("dev:ping", (ack) => {
      if (typeof ack === "function") {
        ack({ serverTime: Date.now() });
      }
    });

    socket.on("drawPixel", async (data) => {
      const { x, y, color } = data;

      if (x >= 0 && x < BOARD_SIZE && y >= 0 && y < BOARD_SIZE) {
        board[y][x] = color;
        io.emit("pixelUpdated", { x, y, color });
        await Pixel.upsert({ x, y, color }).catch(() => {});
      }
    });

    socket.on("disconnect", () => {
      emitActiveUsers();
    });
  });
};