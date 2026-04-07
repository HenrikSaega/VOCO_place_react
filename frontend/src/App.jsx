import { useEffect, useRef, useState } from 'react'
import { io } from 'socket.io-client'


import CanvasBoard from './CanvasBoard'
import Header from './components/header';
import DevInfoPanel from './components/dev-info-panel';

const socket = io("http://localhost:3000");

function App() {
  const [isConnected, setIsConnected] = useState(false);
  const [board, setBoard] = useState([]);
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [activeUsers, setActiveUsers] = useState(null);
  const [rttMs, setRttMs] = useState(null);
  const [pixelLatencyMs, setPixelLatencyMs] = useState(null);
  const [backendBoardSize, setBackendBoardSize] = useState(null);
  const [showDevPanel, setShowDevPanel] = useState(true);
  const pendingPixelRef = useRef(null);

  useEffect(() => {
    const onConnect = () => setIsConnected(true);
    const onDisconnect = () => setIsConnected(false);

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);

    socket.on("initBoard", (initialBoard) => {
      setBoard(initialBoard);
    });

    socket.on("dev:activeUsers", (count) => {
      setActiveUsers(count);
    });

    socket.on("dev:boardMeta", ({ boardSize }) => {
      setBackendBoardSize(boardSize);
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

      const pending = pendingPixelRef.current;
      if (pending && pending.x === x && pending.y === y) {
        setPixelLatencyMs(Math.max(1, Math.round(performance.now() - pending.sentAt)));
        pendingPixelRef.current = null;
      }
    });

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("initBoard");
      socket.off("dev:activeUsers");
      socket.off("dev:boardMeta");
      socket.off("pixelUpdated");
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === 'd') {
        event.preventDefault();
        setShowDevPanel((prev) => !prev);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    if (!isConnected) {
      setRttMs(null);
      return;
    }

    const runPing = () => {
      const start = performance.now();
      socket.emit("dev:ping", () => {
        setRttMs(Math.max(1, Math.round(performance.now() - start)));
      });
    };

    runPing();
    const pingInterval = setInterval(runPing, 3000);

    return () => clearInterval(pingInterval);
  }, [isConnected]);

  const handlePixelDraw = ({ x, y, sentAt }) => {
    pendingPixelRef.current = { x, y, sentAt };
  };

  return (
    <>
      <Header
        isLoginOpen={isLoginOpen}
        setLoginOpen={setIsLoginOpen}
      />

      {showDevPanel ? (
        <DevInfoPanel
          isConnected={isConnected}
          activeUsers={activeUsers}
          rttMs={rttMs}
          pixelLatencyMs={pixelLatencyMs}
          board={board}
          backendBoardSize={backendBoardSize}
          onClose={() => setShowDevPanel(false)}
        />
      ) : (
        <button className="dev-panel-toggle" onClick={() => setShowDevPanel(true)}>
          Show Dev Panel
        </button>
      )}

      <div style={{ margin: 0, padding: 0, overflow: 'hidden' }}>
        <CanvasBoard
          socket={socket}
          board={board}
          isConnected={isConnected}
          onPixelDraw={handlePixelDraw}
        />
      </div>
    </>
  )
}

export default App