import { useEffect, useState } from 'react'
import { io } from 'socket.io-client'
import CanvasBoard from './CanvasBoard' // Impordime uue komponendi

const socket = io("http://localhost:3000");

function App() {
  const [isConnected, setIsConnected] = useState(false);
  const [board, setBoard] = useState([]);

  useEffect(() => {
    socket.on("connect", () => setIsConnected(true));
    socket.on("disconnect", () => setIsConnected(false));

    socket.on("initBoard", (initialBoard) => {
      setBoard(initialBoard);
    });

    socket.on("pixelUpdated", ({ x, y, color }) => {
      setBoard((prevBoard) => {
        const newBoard = [...prevBoard];
        if (newBoard[y]) {
          newBoard[y] = [...newBoard[y]];
          newBoard[y][x] = color;
        }
        return newBoard;
      });
    });

    return () => {
      socket.off("connect");
      socket.off("disconnect");
      socket.off("initBoard");
      socket.off("pixelUpdated");
    };
  }, []);

  return (
    // Eemaldame siit kogu vana CSSi ja jätame ruumi ainult lõuendile
    <div style={{ margin: 0, padding: 0, overflow: 'hidden' }}>
      <CanvasBoard socket={socket} board={board} isConnected={isConnected} />
    </div>
  )
}

export default App