const Pixel = require("../models/pixel");
const BOARD_SIZE = 1000;

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
  
  io.on("connection", (socket) => {
    socket.emit("initBoard", board); 

    socket.on("drawPixel", async (data) => {
      const { x, y, color } = data;
      
      if (x >= 0 && x < BOARD_SIZE && y >= 0 && y < BOARD_SIZE) {
        board[y][x] = color;
        io.emit("pixelUpdated", { x, y, color });
        await Pixel.upsert({ x, y, color }).catch(() => {});
      }
    });
  });
};