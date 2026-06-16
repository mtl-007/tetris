(() => {
  const COLS = 10;
  const ROWS = 20;
  const CELL = 30;
  const BASE_DROP_INTERVAL = 800; // ms, level 1 속도
  const MIN_DROP_INTERVAL = 150; // ms, 최고 속도 한계
  const DROP_STEP_PER_LEVEL = 60; // 레벨당 빨라지는 정도
  const LEVEL_UP_INTERVAL_MS = 20000; // 20초마다 레벨 상승

  const LINE_SCORES = { 1: 100, 2: 300, 3: 500, 4: 800 };

  const SHAPES = {
    I: { color: "#6e93ff", cells: [[0, 1], [1, 1], [2, 1], [3, 1]] },
    O: { color: "#ffd86e", cells: [[1, 0], [2, 0], [1, 1], [2, 1]] },
    T: { color: "#c46eff", cells: [[1, 0], [0, 1], [1, 1], [2, 1]] },
    S: { color: "#6effb0", cells: [[1, 0], [2, 0], [0, 1], [1, 1]] },
    Z: { color: "#ff6e6e", cells: [[0, 0], [1, 0], [1, 1], [2, 1]] },
    J: { color: "#6ecfff", cells: [[0, 0], [0, 1], [1, 1], [2, 1]] },
    L: { color: "#ff9e4d", cells: [[2, 0], [0, 1], [1, 1], [2, 1]] },
  };
  const PIECE_NAMES = Object.keys(SHAPES);

  // 오락실 테트리스풍 배경음 합성 (Web Audio API, 구전 민요 "코로베이니키" 멜로디)
  const NOTE = {
    A4: 440.0, B4: 493.88, C5: 523.25, D5: 587.33, E5: 659.25,
    F5: 698.46, G5: 783.99, A5: 880.0, Gs4: 415.3, G4: 392.0,
    REST: 0,
  };
  const EIGHTH = 0.16; // 8분음표 길이(초)

  // [음, 8분음표 단위 길이]
  const START_MELODY = [
    [NOTE.E5, 2], [NOTE.B4, 1], [NOTE.C5, 1], [NOTE.D5, 2], [NOTE.C5, 1], [NOTE.B4, 1],
    [NOTE.A4, 2], [NOTE.A4, 1], [NOTE.C5, 1], [NOTE.E5, 2], [NOTE.D5, 1], [NOTE.C5, 1],
    [NOTE.B4, 3], [NOTE.C5, 1], [NOTE.D5, 2], [NOTE.E5, 2],
    [NOTE.C5, 2], [NOTE.A4, 2], [NOTE.A4, 2], [NOTE.REST, 2],
    [NOTE.D5, 3], [NOTE.F5, 1], [NOTE.A5, 2],
    [NOTE.G5, 1], [NOTE.F5, 1], [NOTE.E5, 3],
    [NOTE.C5, 1], [NOTE.E5, 2],
    [NOTE.D5, 1], [NOTE.C5, 1],
    [NOTE.B4, 2], [NOTE.B4, 1], [NOTE.C5, 1],
    [NOTE.D5, 2], [NOTE.E5, 2],
    [NOTE.C5, 2], [NOTE.A4, 2],
    [NOTE.A4, 2], [NOTE.REST, 2],
  ];
  const GAMEOVER_MELODY = [
    [NOTE.C5, 2], [NOTE.G4, 2], [NOTE.E5, 2], [NOTE.Gs4, 2], [NOTE.A4, 4],
  ];

  let audioCtx = null;
  function getAudioCtx() {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    return audioCtx;
  }

  function playNote(ctxAudio, freq, startTime, duration) {
    if (!freq) return; // REST
    const osc = ctxAudio.createOscillator();
    const gain = ctxAudio.createGain();
    osc.type = "square";
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.15, startTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
    osc.connect(gain).connect(ctxAudio.destination);
    osc.start(startTime);
    osc.stop(startTime + duration);
  }

  function playMelody(sequence) {
    const ctxAudio = getAudioCtx();
    if (ctxAudio.state === "suspended") ctxAudio.resume();
    let t = ctxAudio.currentTime + 0.05;
    sequence.forEach(([freq, beats]) => {
      const dur = beats * EIGHTH;
      playNote(ctxAudio, freq, t, dur * 0.9);
      t += dur;
    });
  }

  function playStartMelody() {
    playMelody(START_MELODY);
  }

  function playGameOverMelody() {
    playMelody(GAMEOVER_MELODY);
  }

  const canvas = document.getElementById("board");
  const ctx = canvas.getContext("2d");
  const scoreEl = document.getElementById("score");
  const levelEl = document.getElementById("level");
  const finalScoreEl = document.getElementById("final-score");
  const overlayEl = document.getElementById("game-over-overlay");
  const startBtn = document.getElementById("start-btn");
  const restartBtn = document.getElementById("restart-btn");

  let board = createEmptyBoard();
  let current = null; // { name, cells: [[x,y],...], color, x, y }
  let score = 0;
  let level = 1;
  let dropTimeoutId = null;
  let levelTimerId = null;
  let running = false;

  function getDropInterval() {
    return Math.max(MIN_DROP_INTERVAL, BASE_DROP_INTERVAL - (level - 1) * DROP_STEP_PER_LEVEL);
  }

  function scheduleDrop() {
    dropTimeoutId = setTimeout(() => {
      softDrop();
      if (running) scheduleDrop();
    }, getDropInterval());
  }

  function startLevelTimer() {
    levelTimerId = setInterval(() => {
      level++;
      levelEl.textContent = level;
    }, LEVEL_UP_INTERVAL_MS);
  }

  function createEmptyBoard() {
    return Array.from({ length: ROWS }, () => Array(COLS).fill(null));
  }

  function spawnPiece() {
    const name = PIECE_NAMES[Math.floor(Math.random() * PIECE_NAMES.length)];
    const shape = SHAPES[name];
    current = {
      name,
      cells: shape.cells.map(([x, y]) => [x, y]),
      color: shape.color,
      x: 3,
      y: 0,
    };
    if (hasCollision(current, 0, 0)) {
      gameOver();
    }
  }

  function absoluteCells(piece, dx = 0, dy = 0) {
    return piece.cells.map(([x, y]) => [piece.x + x + dx, piece.y + y + dy]);
  }

  function hasCollision(piece, dx, dy, cells = null) {
    const targets = cells || absoluteCells(piece, dx, dy);
    return targets.some(([x, y]) => {
      if (x < 0 || x >= COLS || y >= ROWS) return true;
      if (y < 0) return false;
      return board[y][x] !== null;
    });
  }

  function lockPiece() {
    absoluteCells(current).forEach(([x, y]) => {
      if (y >= 0) board[y][x] = current.color;
    });
    clearLines();
    spawnPiece();
  }

  function clearLines() {
    let cleared = 0;
    for (let y = ROWS - 1; y >= 0; y--) {
      if (board[y].every((cell) => cell !== null)) {
        board.splice(y, 1);
        board.unshift(Array(COLS).fill(null));
        cleared++;
        y++; // re-check same index after shift
      }
    }
    if (cleared > 0) {
      score += LINE_SCORES[cleared] || cleared * 100;
      scoreEl.textContent = score;
    }
  }

  function move(dx, dy) {
    if (!running) return false;
    if (hasCollision(current, dx, dy)) return false;
    current.x += dx;
    current.y += dy;
    return true;
  }

  function rotate() {
    if (!running) return;
    // rotate around piece-local center using simple 2x2/4x4 bounding rotation
    const rotated = current.cells.map(([x, y]) => [3 - y, x]);
    if (!hasCollision(current, 0, 0, rotated.map(([x, y]) => [current.x + x, current.y + y]))) {
      current.cells = rotated;
    }
  }

  function softDrop() {
    if (!move(0, 1)) {
      lockPiece();
    }
    render();
  }

  function gameOver() {
    running = false;
    clearTimeout(dropTimeoutId);
    clearInterval(levelTimerId);
    finalScoreEl.textContent = score;
    overlayEl.classList.remove("hidden");
    playGameOverMelody();
  }

  function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        if (board[y][x]) {
          drawCell(x, y, board[y][x]);
        }
      }
    }

    if (current) {
      absoluteCells(current).forEach(([x, y]) => {
        if (y >= 0) drawCell(x, y, current.color);
      });
    }
  }

  function drawCell(x, y, color) {
    ctx.fillStyle = color;
    ctx.fillRect(x * CELL, y * CELL, CELL - 1, CELL - 1);
  }

  function startGame() {
    board = createEmptyBoard();
    score = 0;
    level = 1;
    scoreEl.textContent = score;
    levelEl.textContent = level;
    overlayEl.classList.add("hidden");
    running = true;
    spawnPiece();
    render();
    clearTimeout(dropTimeoutId);
    clearInterval(levelTimerId);
    scheduleDrop();
    startLevelTimer();
    playStartMelody();
  }

  document.addEventListener("keydown", (e) => {
    if (!running) return;
    switch (e.key) {
      case "ArrowLeft":
        e.preventDefault();
        move(-1, 0);
        render();
        break;
      case "ArrowRight":
        e.preventDefault();
        move(1, 0);
        render();
        break;
      case "ArrowDown":
        e.preventDefault();
        softDrop();
        break;
      case "ArrowUp":
      case " ":
        e.preventDefault();
        rotate();
        render();
        break;
    }
  });

  startBtn.addEventListener("click", startGame);
  restartBtn.addEventListener("click", startGame);

  render();
})();
