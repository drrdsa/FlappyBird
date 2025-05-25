import React, { useState, useEffect, useCallback } from 'react';
import './index.css';

interface Bird {
  x: number;
  y: number;
  velocity: number;
}

interface Pipe {
  x: number;
  topHeight: number;
  bottomY: number;
  passed: boolean;
}

const GAME_HEIGHT = 600;
const GAME_WIDTH = 400;
const BIRD_SIZE = 25;
const PIPE_WIDTH = 60;
const PIPE_GAP = 120;
const GRAVITY = 0.5;
const JUMP_FORCE = -7;
const PIPE_SPEED = 3;

function App() {
  const [bird, setBird] = useState<Bird>({ x: 100, y: 300, velocity: 0 });
  const [pipes, setPipes] = useState<Pipe[]>([]);
  const [gameStarted, setGameStarted] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [score, setScore] = useState(0);
  const [aiMode, setAiMode] = useState(false);

  const resetGame = useCallback(() => {
    setBird({ x: 100, y: 300, velocity: 0 });
    setPipes([]);
    setScore(0);
    setGameOver(false);
    setGameStarted(false);
  }, []);

  const jump = useCallback(() => {
    if (!gameStarted) {
      setGameStarted(true);
    }
    if (!gameOver) {
      setBird(prev => ({ ...prev, velocity: JUMP_FORCE }));
    } else {
      resetGame();
    }
  }, [gameStarted, gameOver, resetGame]);

  // SIMPLE AND EFFECTIVE AI - Back to basics but improved
  const shouldAIJump = useCallback((currentBird: Bird, currentPipes: Pipe[]) => {
    // Emergency ground avoidance
    if (currentBird.y > GAME_HEIGHT - BIRD_SIZE - 30) {
      return true;
    }

    // No pipes yet - stay in middle
    if (currentPipes.length === 0) {
      return currentBird.y > GAME_HEIGHT * 0.6;
    }

    // Find the next pipe we need to go through
    const nextPipe = currentPipes.find(pipe => 
      pipe.x + PIPE_WIDTH > currentBird.x
    );
    
    if (!nextPipe) {
      // No pipes ahead - maintain safe height
      return currentBird.y > GAME_HEIGHT * 0.2;
    }

    const distanceToPipe = nextPipe.x - currentBird.x;
    const gapCenter = nextPipe.topHeight + (PIPE_GAP / 2);

    // Simple prediction: where will we be in a few frames?
    const framesToPipe = Math.max(1, distanceToPipe / PIPE_SPEED);
    const predictedY = currentBird.y + (currentBird.velocity * Math.min(framesToPipe, 10));

    // CORE LOGIC: Simple and reliable
    if (distanceToPipe > 5) {
      // Far from pipe - get into good position
      const targetY = gapCenter - 20; // Aim slightly above center
      return currentBird.y > targetY + 40;
    } else {
      // Close to pipe - make precise decisions
      
      // If we're going to hit the bottom pipe, jump
      if (predictedY > nextPipe.bottomY - BIRD_SIZE - 15) {
        return true;
      }
      
      // If we're going to hit the top pipe, don't jump (let gravity help)
      if (predictedY < nextPipe.topHeight + 15) {
        return false;
      }
      
      // In the safe zone - only jump if we're below center and falling
      if (currentBird.y > gapCenter + 10 && currentBird.velocity > 2) {
        return true;
      }
      
      // If we're above center, let gravity bring us down
      if (currentBird.y < gapCenter - 10) {
        return false;
      }
      
      // Default: jump if we're getting too low
      return currentBird.y > gapCenter + 30;
    }
  }, []);

  // Handle keyboard input
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'ArrowUp') {
        e.preventDefault();
        if (!aiMode) {
          jump();
        }
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [jump, aiMode]);

  // Game loop
  useEffect(() => {
    if (!gameStarted || gameOver) return;

    const gameLoop = setInterval(() => {
      // Update bird
      setBird(prev => {
        const newY = prev.y + prev.velocity;
        const newVelocity = prev.velocity + GRAVITY;

        // Check ground and ceiling collision
        if (newY > GAME_HEIGHT - BIRD_SIZE || newY < 0) {
          setGameOver(true);
          return prev;
        }

        return { ...prev, y: newY, velocity: newVelocity };
      });

      // Update pipes
      setPipes(prev => {
        let newPipes = prev.map(pipe => ({ ...pipe, x: pipe.x - PIPE_SPEED }));
        
        // Remove pipes that are off screen
        newPipes = newPipes.filter(pipe => pipe.x > -PIPE_WIDTH);
        
        // Add new pipe if needed
        if (newPipes.length === 0 || newPipes[newPipes.length - 1].x < GAME_WIDTH - 200) {
          const topHeight = Math.random() * (GAME_HEIGHT - PIPE_GAP - 100) + 50;
          newPipes.push({
            x: GAME_WIDTH,
            topHeight,
            bottomY: topHeight + PIPE_GAP,
            passed: false
          });
        }

        return newPipes;
      });
    }, 1000 / 60); // 60 FPS

    return () => clearInterval(gameLoop);
  }, [gameStarted, gameOver]);

  // AI Decision Making - Balanced frequency
  useEffect(() => {
    if (!aiMode || !gameStarted || gameOver) return;

    const aiLoop = setInterval(() => {
      setBird(currentBird => {
        setPipes(currentPipes => {
          if (shouldAIJump(currentBird, currentPipes)) {
            setBird(prev => ({ ...prev, velocity: JUMP_FORCE }));
          }
          return currentPipes;
        });
        return currentBird;
      });
    }, 1000 / 25); // 25 FPS for AI decisions - good balance

    return () => clearInterval(aiLoop);
  }, [aiMode, gameStarted, gameOver, shouldAIJump]);

  // Collision detection and scoring
  useEffect(() => {
    if (!gameStarted || gameOver) return;

    pipes.forEach(pipe => {
      // Check if bird passed the pipe
      if (!pipe.passed && bird.x > pipe.x + PIPE_WIDTH) {
        pipe.passed = true;
        setScore(prev => prev + 1);
      }

      // Check collision
      if (
        bird.x + BIRD_SIZE > pipe.x &&
        bird.x < pipe.x + PIPE_WIDTH &&
        (bird.y < pipe.topHeight || bird.y + BIRD_SIZE > pipe.bottomY)
      ) {
        setGameOver(true);
      }
    });
  }, [bird, pipes, gameStarted, gameOver]);

  const startAIMode = () => {
    setAiMode(true);
    if (!gameStarted) {
      setGameStarted(true);
    }
    if (gameOver) {
      resetGame();
      setTimeout(() => setGameStarted(true), 100);
    }
  };

  const startManualMode = () => {
    setAiMode(false);
    if (!gameStarted) {
      jump();
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-b from-blue-400 to-blue-600">
      <div className="relative">
        {/* Game Container */}
        <div 
          className="relative bg-gradient-to-b from-cyan-300 to-blue-400 border-4 border-yellow-400 rounded-lg overflow-hidden cursor-pointer"
          style={{ width: GAME_WIDTH, height: GAME_HEIGHT }}
          onClick={!aiMode ? jump : undefined}
        >
          {/* Background clouds */}
          <div className="absolute inset-0">
            <div className="absolute top-10 left-10 w-16 h-10 bg-white rounded-full opacity-80"></div>
            <div className="absolute top-20 right-20 w-12 h-8 bg-white rounded-full opacity-80"></div>
            <div className="absolute top-32 left-32 w-20 h-12 bg-white rounded-full opacity-80"></div>
          </div>

          {/* Bird */}
          <div
            className={`absolute w-8 h-8 rounded-full border-2 transition-transform duration-75 ${
              aiMode ? 'bg-red-400 border-red-600' : 'bg-yellow-400 border-orange-400'
            }`}
            style={{
              left: bird.x,
              top: bird.y,
              transform: `rotate(${Math.min(Math.max(bird.velocity * 3, -30), 30)}deg)`
            }}
          >
            {/* Bird eye */}
            <div className="absolute top-1 right-1 w-2 h-2 bg-black rounded-full"></div>
            {/* Bird beak */}
            <div className={`absolute top-3 -right-1 w-0 h-0 border-l-2 border-t-2 border-t-transparent border-b-2 border-b-transparent ${
              aiMode ? 'border-l-red-700' : 'border-l-orange-500'
            }`}></div>
          </div>

          {/* Pipes */}
          {pipes.map((pipe, index) => (
            <div key={index}>
              {/* Top pipe */}
              <div
                className="absolute bg-green-500 border-2 border-green-700"
                style={{
                  left: pipe.x,
                  top: 0,
                  width: PIPE_WIDTH,
                  height: pipe.topHeight
                }}
              >
                <div className="absolute bottom-0 left-0 right-0 h-8 bg-green-600 border-2 border-green-800"></div>
              </div>
              
              {/* Bottom pipe */}
              <div
                className="absolute bg-green-500 border-2 border-green-700"
                style={{
                  left: pipe.x,
                  top: pipe.bottomY,
                  width: PIPE_WIDTH,
                  height: GAME_HEIGHT - pipe.bottomY
                }}
              >
                <div className="absolute top-0 left-0 right-0 h-8 bg-green-600 border-2 border-green-800"></div>
              </div>
            </div>
          ))}

          {/* Ground */}
          <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-green-600 to-green-400 border-t-4 border-green-700"></div>

          {/* Score and AI Indicator */}
          <div className="absolute top-4 left-4 text-white text-xl font-bold drop-shadow-lg">
            <div>Score: {score}</div>
            {aiMode && (
              <div className="text-red-300 text-sm mt-1">🤖 Smart AI</div>
            )}
          </div>

          {/* Game Over Screen */}
          {gameOver && (
            <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
              <div className="bg-white p-8 rounded-lg text-center">
                <h2 className="text-3xl font-bold text-red-600 mb-4">Game Over!</h2>
                <p className="text-xl mb-4">Score: {score}</p>
                <div className="space-y-2">
                  <button
                    onClick={() => {
                      resetGame();
                      setAiMode(false);
                    }}
                    className="block w-full bg-blue-500 hover:bg-blue-600 text-white px-6 py-3 rounded-lg font-bold"
                  >
                    Play Again (Manual)
                  </button>
                  <button
                    onClick={() => {
                      resetGame();
                      startAIMode();
                    }}
                    className="block w-full bg-red-500 hover:bg-red-600 text-white px-6 py-3 rounded-lg font-bold"
                  >
                    🤖 Smart AI Again
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Start Screen */}
          {!gameStarted && !gameOver && (
            <div className="absolute inset-0 bg-black bg-opacity-30 flex items-center justify-center">
              <div className="bg-white p-8 rounded-lg text-center">
                <h1 className="text-4xl font-bold text-blue-600 mb-4">Flappy Bird</h1>
                <p className="text-lg mb-6">Choose your mode:</p>
                <div className="space-y-3">
                  <button
                    onClick={startManualMode}
                    className="block w-full bg-blue-500 hover:bg-blue-600 text-white px-6 py-3 rounded-lg font-bold"
                  >
                    🎮 Play Manually
                  </button>
                  <button
                    onClick={startAIMode}
                    className="block w-full bg-red-500 hover:bg-red-600 text-white px-6 py-3 rounded-lg font-bold"
                  >
                    🤖 Watch Smart AI
                  </button>
                </div>
                <p className="text-sm text-gray-600 mt-4">
                  Manual: Click or press Space to flap
                </p>
                <p className="text-xs text-green-600 mt-2">
                  AI: Simple but effective decision making
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Instructions */}
        <div className="mt-4 text-center text-white">
          {aiMode ? (
            <div>
              <p className="text-lg">🤖 Smart AI playing - Reliable performance!</p>
              <p className="text-sm opacity-80">Simple logic that actually works consistently</p>
            </div>
          ) : (
            <div>
              <p className="text-lg">Click the game area or press Space/↑ to flap!</p>
              <p className="text-sm opacity-80">Avoid the pipes and try to get a high score!</p>
            </div>
          )}
        </div>

        {/* Mode Toggle */}
        {gameStarted && !gameOver && (
          <div className="mt-4 text-center">
            <button
              onClick={() => {
                if (aiMode) {
                  setAiMode(false);
                } else {
                  startAIMode();
                }
              }}
              className={`px-6 py-2 rounded-lg font-bold ${
                aiMode 
                  ? 'bg-blue-500 hover:bg-blue-600 text-white' 
                  : 'bg-red-500 hover:bg-red-600 text-white'
              }`}
            >
              {aiMode ? '🎮 Switch to Manual' : '🤖 Switch to Smart AI'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
