const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const sequelize = require("./config/db");
const setupSockets = require("./controllers/socketController");

const app = express();
const server = http.createServer(app);

app.use(
  cors({
    origin: "http://localhost:5173",
    methods: ["GET", "POST"],
  }),
);

app.use(express.json());

const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173",
    methods: ["GET", "POST"],
  },
  maxHttpBufferSize: 50e6, // 50MB - vajalik 1000x1000 tahvli jaoks
});

const PORT = 3000;

sequelize
  .sync({ force: false })
  .then(() => {
    console.log("Andmebaas ühendatud!");

    setupSockets(io);

    server.listen(PORT, () => {
      console.log(`Backend töötab pordil ${PORT}`);
    });
  })
  .catch((err) => console.error("Viga DB-ga:", err));
