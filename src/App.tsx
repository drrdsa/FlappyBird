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
const BIRD_SIZE = 30;
const PIPE_WIDTH = 60;
const PIPE_GAP = 170;
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

  // Completely Rewritten AI Logic - Simple and Effective
  const shouldAIJump = useCallback((currentBird: Bird, currentPipes: Pipe[]) => {
    // No pipes yet - maintain middle height
    if (currentPipes.length === 0) {
      return currentBird.y > GAME_HEIGHT * 0.6;
    }

    // Find the next pipe to navigate
    const nextPipe = currentPipes.find(pipe => 
      pipe.x + PIPE_WIDTH > currentBird.x - 20
    );
    
    if (!nextPipe) {
      // No pipes ahead, maintain safe height
      return currentBird.y > GAME_HEIGHT * 0.7;
    }

    const distanceToPipe = nextPipe.x - currentBird.x;
    const gapCenter = nextPipe.topHeight + (PIPE_GAP / 2);
    const gapTop = nextPipe.topHeight;
    const gapBottom = nextPipe.bottomY;

    // Calculate where bird will be when reaching the pipe
    const framesToPipe = Math.max(1, distanceToPipe / PIPE_SPEED);
    let futureY = currentBird.y;
    let futureVelocity = currentBird.velocity;
    
    for (let i = 0; i < framesToPipe; i++) {
      futureY += futureVelocity;
      futureVelocity += GRAVITY;
    }

    // CORE LOGIC: Simple position-based decisions
    
    // If we're far from the pipe, just maintain reasonable height
    if (distanceToPipe > 120) {
      return currentBird.y > GAME_HEIGHT * 0.65;
    }

    // Close to pipe - make precise decisions
    if (distanceToPipe <= 120) {
      
      // CRITICAL: If bird is ABOVE the gap center, DON'T JUMP unless emergency
      if (currentBird.y < gapCenter - 20) {
        // Only jump if we're going to hit the TOP pipe
        if (futureY < gapTop + 15) {
          return true; // Emergency jump to avoid top pipe
        }
        // Otherwise, let gravity pull us down - DON'T JUMP
        return false;
      }
      
      // CRITICAL: If bird is BELOW the gap center, consider jumping
      if (currentBird.y > gapCenter + 20) {
        // Jump if we're going to hit the bottom pipe
        if (futureY > gapBottom - BIRD_SIZE - 15) {
          return true;
        }
        // Also jump if we're falling too fast toward bottom
        if (currentBird.velocity > 4 && currentBird.y > gapCenter + 40) {
          return true;
        }
      }
      
      // In the middle zone - be very conservative
      if (currentBird.y >= gapCenter - 20 && currentBird.y <= gapCenter + 20) {
        // Only jump if definitely going to hit bottom
        if (futureY > gapBottom - BIRD_SIZE - 10) {
          return true;
        }
        // Otherwise coast through
        return false;
      }
    }

    // Emergency ground avoidance
    if (currentBird.y > GAME_HEIGHT - 100) {
      return true;
    }

    // Emergency ceiling avoidance
    if (currentBird.y < 30) {
      return false;
    }

    // Default: don't jump
    return false;
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

  // AI Decision Making - Even slower to prevent spam jumping
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
    }, 1000 / 20); // Even slower - 20 FPS for AI decisions

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
              <div className="text-red-300 text-sm mt-1">🤖 AI MODE</div>
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
                    🤖 AI Play Again
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
                    🤖 Watch AI Play
                  </button>
                </div>
                <p className="text-sm text-gray-600 mt-4">
                  Manual: Click or press Space to flap
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Instructions */}
        <div className="mt-4 text-center text-white">
          {aiMode ? (
            <div>
              <p className="text-lg">🤖 AI is playing automatically!</p>
              <p className="text-sm opacity-80">Watch how it drops through high gaps and jumps through low gaps</p>
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
              {aiMode ? '🎮 Switch to Manual' : '🤖 Switch to AI'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
