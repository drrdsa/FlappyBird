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
const BIRD_SIZE = 25; // Assuming bird is roughly square, adjust if using w/h from styles
const PIPE_WIDTH = 60;
const PIPE_GAP = 130;
const GRAVITY = 0.5;
const JUMP_FORCE = -7;
const PIPE_SPEED = 3;

// --- NEW CONSTANTS FOR PIPE GENERATION ---
const MIN_PIPE_Y_MARGIN = 50; // Min space from top/bottom of screen for the pipe body itself
const MAX_CONSECUTIVE_PIPE_HEIGHT_DIFFERENCE = 100; // Max change in topHeight of consecutive pipes
const HORIZONTAL_PIPE_SPACING = 200; // Horizontal distance between pipe generation triggers

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
    setGameStarted(false); // Ensure gameStarted is reset
  }, []);

  const jump = useCallback(() => {
    if (!gameStarted) {
      setGameStarted(true);
    }
    if (!gameOver) {
      setBird(prev => ({ ...prev, velocity: JUMP_FORCE }));
    } else {
      resetGame(); // This will set gameStarted to false
      // If you want to immediately start after reset, you'd setGameStarted(true) here or in a setTimeout
    }
  }, [gameStarted, gameOver, resetGame]);

  const shouldAIJump = useCallback((currentBird: Bird, currentPipes: Pipe[]) => {
    if (currentBird.y > GAME_HEIGHT - BIRD_SIZE - 30) {
      return true;
    }
    if (currentPipes.length === 0) {
      return currentBird.y > GAME_HEIGHT * 0.6;
    }
    const nextPipe = currentPipes.find(pipe => pipe.x + PIPE_WIDTH > currentBird.x);
    if (!nextPipe) {
      return currentBird.y > GAME_HEIGHT * 0.2;
    }
    const distanceToPipe = nextPipe.x - currentBird.x;
    const gapCenter = nextPipe.topHeight + (PIPE_GAP / 2);
    const framesToPipe = Math.max(1, distanceToPipe / PIPE_SPEED);
    const predictedY = currentBird.y + (currentBird.velocity * Math.min(framesToPipe, 10));

    if (distanceToPipe > 5) {
      const targetY = gapCenter - 20;
      return currentBird.y > targetY + 40;
    } else {
      if (predictedY > nextPipe.bottomY - BIRD_SIZE - 15) {
        return true;
      }
      if (predictedY < nextPipe.topHeight + 15) {
        return false;
      }
      if (currentBird.y > gapCenter + 10 && currentBird.velocity > 2) {
        return true;
      }
      if (currentBird.y < gapCenter - 10) {
        return false;
      }
      return currentBird.y > gapCenter + 30;
    }
  }, []);

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

    const gameLoopInterval = setInterval(() => {
      // Update bird
      setBird(prev => {
        const newY = prev.y + prev.velocity;
        const newVelocity = prev.velocity + GRAVITY;
        if (newY > GAME_HEIGHT - BIRD_SIZE || newY < 0) {
          setGameOver(true);
          return prev;
        }
        return { ...prev, y: newY, velocity: newVelocity };
      });

      // Update pipes - MODIFIED SECTION
      setPipes(prevPipes => {
        let newPipesArray = prevPipes.map(pipe => ({ ...pipe, x: pipe.x - PIPE_SPEED }));
        newPipesArray = newPipesArray.filter(pipe => pipe.x > -PIPE_WIDTH);
        
        if (newPipesArray.length === 0 || newPipesArray[newPipesArray.length - 1].x < GAME_WIDTH - HORIZONTAL_PIPE_SPACING) {
          let newTopHeight;

          const absoluteMinTopHeight = MIN_PIPE_Y_MARGIN;
          const absoluteMaxTopHeight = GAME_HEIGHT - PIPE_GAP - MIN_PIPE_Y_MARGIN;

          if (newPipesArray.length === 0) {
            // For the first pipe, generate its topHeight somewhat centrally or fully random.
            // newTopHeight = (absoluteMinTopHeight + absoluteMaxTopHeight) / 2; // Center start
            newTopHeight = Math.random() * (absoluteMaxTopHeight - absoluteMinTopHeight) + absoluteMinTopHeight;
          } else {
            const lastPipe = newPipesArray[newPipesArray.length - 1];
            const lastTopHeight = lastPipe.topHeight;

            const minNextTopHeightBasedOnLast = lastTopHeight - MAX_CONSECUTIVE_PIPE_HEIGHT_DIFFERENCE;
            const maxNextTopHeightBasedOnLast = lastTopHeight + MAX_CONSECUTIVE_PIPE_HEIGHT_DIFFERENCE;

            const effectiveMinTopHeight = Math.max(absoluteMinTopHeight, minNextTopHeightBasedOnLast);
            const effectiveMaxTopHeight = Math.min(absoluteMaxTopHeight, maxNextTopHeightBasedOnLast);
            
            if (effectiveMinTopHeight >= effectiveMaxTopHeight) {
                newTopHeight = effectiveMinTopHeight; 
            } else {
                newTopHeight = Math.random() * (effectiveMaxTopHeight - effectiveMinTopHeight) + effectiveMinTopHeight;
            }
          }
          
          newTopHeight = Math.max(absoluteMinTopHeight, Math.min(newTopHeight, absoluteMaxTopHeight));
          if (isNaN(newTopHeight)) { 
            newTopHeight = (absoluteMinTopHeight + absoluteMaxTopHeight) / 2;
          }

          newPipesArray.push({
            x: GAME_WIDTH,
            topHeight: Math.floor(newTopHeight),
            bottomY: Math.floor(newTopHeight) + PIPE_GAP,
            passed: false
          });
        }
        return newPipesArray;
      });
    }, 1000 / 60);

    return () => clearInterval(gameLoopInterval);
  }, [gameStarted, gameOver]);

  // AI Decision Making
  useEffect(() => {
    if (!aiMode || !gameStarted || gameOver) return;
    const aiLoopInterval = setInterval(() => {
      setBird(currentBird => {
        setPipes(currentPipes => { // AI needs currentPipes for decision
          if (shouldAIJump(currentBird, currentPipes)) {
            // Directly update bird state if AI jumps
            // This avoids stale closure issues with setBird from outer scope
            setBird(b => ({ ...b, velocity: JUMP_FORCE }));
          }
          return currentPipes; // Return pipes unchanged from AI perspective
        });
        return currentBird; // Return bird unchanged, jump handled above
      });
    }, 1000 / 25); // AI decision frequency
    return () => clearInterval(aiLoopInterval);
  }, [aiMode, gameStarted, gameOver, shouldAIJump]); // Include shouldAIJump


  // Collision detection and scoring
  useEffect(() => {
    if (!gameStarted || gameOver) return;

    pipes.forEach(pipe => {
      if (!pipe.passed && bird.x > pipe.x + PIPE_WIDTH) {
        setPipes(prevPipes => prevPipes.map(p => p === pipe ? { ...p, passed: true } : p));
        setScore(prev => prev + 1);
      }

      if (
        bird.x < pipe.x + PIPE_WIDTH &&
        bird.x + BIRD_SIZE > pipe.x &&
        (bird.y < pipe.topHeight || bird.y + BIRD_SIZE > pipe.bottomY)
      ) {
        setGameOver(true);
      }
    });
  }, [bird, pipes, gameStarted, gameOver]); // Removed setScore, setPipes from deps to avoid loops if not careful

  const startAIMode = () => {
    if (gameOver) {
      resetGame();
      // Need a slight delay for states to update before starting game
      setTimeout(() => {
        setAiMode(true);
        setGameStarted(true);
      }, 50);
    } else {
      setAiMode(true);
      if (!gameStarted) {
        setGameStarted(true);
      }
    }
  };
  
  const startManualMode = () => {
    setAiMode(false);
    if (gameOver) {
      resetGame();
      // No automatic start after reset for manual mode, user needs to jump
    } else if (!gameStarted) {
      jump(); // This will set gameStarted to true
    }
  };


  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-b from-blue-400 to-blue-600">
      <div className="relative">
        <div 
          className="relative bg-gradient-to-b from-cyan-300 to-blue-400 border-4 border-yellow-400 rounded-lg overflow-hidden cursor-pointer"
          style={{ width: GAME_WIDTH, height: GAME_HEIGHT }}
          onClick={!aiMode ? jump : undefined}
        >
          <div className="absolute inset-0">
            <div className="absolute top-10 left-10 w-16 h-10 bg-white rounded-full opacity-80"></div>
            <div className="absolute top-20 right-20 w-12 h-8 bg-white rounded-full opacity-80"></div>
            <div className="absolute top-32 left-32 w-20 h-12 bg-white rounded-full opacity-80"></div>
          </div>

          <div
            className={`absolute w-8 h-8 rounded-full border-2 transition-transform duration-75 ${
              aiMode ? 'bg-red-400 border-red-600' : 'bg-yellow-400 border-orange-400'
            }`}
            style={{
              width: BIRD_SIZE,
              height: BIRD_SIZE,
              left: bird.x,
              top: bird.y,
              transform: `rotate(${Math.min(Math.max(bird.velocity * 3, -30), 30)}deg)`
            }}
          >
            <div className="absolute top-1 right-1 w-2 h-2 bg-black rounded-full"></div>
            <div className={`absolute top-3 -right-1 w-0 h-0 border-l-2 border-t-2 border-t-transparent border-b-2 border-b-transparent ${
              aiMode ? 'border-l-red-700' : 'border-l-orange-500'
            }`}></div>
          </div>

          {pipes.map((pipe, index) => (
            <div key={index}>
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

          <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-green-600 to-green-400 border-t-4 border-green-700"></div>

          <div className="absolute top-4 left-4 text-white text-xl font-bold drop-shadow-lg">
            <div>Score: {score}</div>
            {aiMode && (
              <div className="text-red-300 text-sm mt-1">🤖 Smart AI</div>
            )}
          </div>

          {gameOver && (
            <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
              <div className="bg-white p-8 rounded-lg text-center">
                <h2 className="text-3xl font-bold text-red-600 mb-4">Game Over!</h2>
                <p className="text-xl mb-4">Score: {score}</p>
                <div className="space-y-2">
                  <button
                    onClick={() => {
                      // resetGame(); // startManualMode handles reset
                      startManualMode();
                    }}
                    className="block w-full bg-blue-500 hover:bg-blue-600 text-white px-6 py-3 rounded-lg font-bold"
                  >
                    Play Again (Manual)
                  </button>
                  <button
                    onClick={() => {
                      // resetGame(); // startAIMode handles reset
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
                  Manual: Click or press Space/↑ to flap
                </p>
                <p className="text-xs text-green-600 mt-2">
                  AI: Simple but effective decision making
                </p>
              </div>
            </div>
          )}
        </div>

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

        {gameStarted && !gameOver && (
          <div className="mt-4 text-center">
            <button
              onClick={() => {
                if (aiMode) {
                  // Switch to manual: reset AI state, game continues if user jumps
                  setAiMode(false);
                } else {
                  // Switch to AI: AI takes over immediately
                  setAiMode(true);
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
