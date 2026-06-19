// ─── 게임 초기화 ───
// auth.js → showGame(email) 에서 최초 1회 호출.
// 이후 재로그인 시에는 currentName만 갱신하고 리스너는 재등록하지 않음.

let gameInitialized = false;
let currentName = '';

window.initGame = function initGame(name) {
  currentName = name;

  if (gameInitialized) {
    // 재로그인: 플레이어 표시만 갱신 후 게임 상태 초기화
    playerEmailEl.textContent = currentName;
    resetUI();
    loadHighScore();
    return;
  }
  gameInitialized = true;

  // ─── 상수 ───
  const COLS = 10;
  const ROWS = 20;
  const CELL = 30;
  const BASE_DROP_INTERVAL  = 575;
  const MIN_DROP_INTERVAL   = 100;
  const LEVEL_STEPS = [60, 60, 60, 55, 45, 40, 35, 30, 25]; // 레벨별 감소폭(ms)
  const LEVEL_UP_INTERVAL_MS = 20000;
  const LINE_SCORES = { 1: 100, 2: 300, 3: 500, 4: 800 };

  const SHAPES = {
    I: { color: '#6e93ff', cells: [[0,1],[1,1],[2,1],[3,1]] },
    O: { color: '#ffd86e', cells: [[1,0],[2,0],[1,1],[2,1]] },
    T: { color: '#c46eff', cells: [[1,0],[0,1],[1,1],[2,1]] },
    S: { color: '#6effb0', cells: [[1,0],[2,0],[0,1],[1,1]] },
    Z: { color: '#ff6e6e', cells: [[0,0],[1,0],[1,1],[2,1]] },
    J: { color: '#6ecfff', cells: [[0,0],[0,1],[1,1],[2,1]] },
    L: { color: '#ff9e4d', cells: [[2,0],[0,1],[1,1],[2,1]] },
  };
  const PIECE_NAMES = Object.keys(SHAPES);


  // ─── DOM 참조 ───
  const canvas             = document.getElementById('board');
  const ctx                = canvas.getContext('2d');
  const nextCanvas         = document.getElementById('next-canvas');
  const nextCtx            = nextCanvas.getContext('2d');
  const scoreEl            = document.getElementById('score');
  const levelEl            = document.getElementById('level');
  const finalScoreEl       = document.getElementById('final-score');
  const overlayEl          = document.getElementById('game-over-overlay');
  const startBtn           = document.getElementById('start-btn');
  const restartBtn         = document.getElementById('restart-btn');
  const top3ListEl         = document.getElementById('top3-list');
  const leaderboardModal   = document.getElementById('leaderboard-modal');
  const leaderboardContent = document.getElementById('leaderboard-content');
  const closeLeaderboardBtn = document.getElementById('close-leaderboard-btn');
  const leaderboardBtn     = document.getElementById('leaderboard-btn');
  const logoutBtn          = document.getElementById('logout-btn');
  const playerEmailEl      = document.getElementById('player-email');
  const danceCanvas        = document.getElementById('dance-canvas');
  const danceCtx           = danceCanvas.getContext('2d');

  // ─── DANCE ANIMATION ───
  let danceAnimId = null;

  const DANCE_POSES = [
    (cx, cy, sc) => ({                                          // 왼팔 위, 오른팔 아래
      la: [cx, cy-0.1*sc,  cx-0.35*sc, cy-0.42*sc],
      ra: [cx, cy-0.1*sc,  cx+0.32*sc, cy+0.14*sc],
      ll: [cx, cy+0.2*sc,  cx-0.18*sc, cy+0.52*sc],
      rl: [cx, cy+0.2*sc,  cx+0.18*sc, cy+0.52*sc],
    }),
    (cx, cy, sc) => ({                                          // 오른팔 위, 왼팔 아래
      la: [cx, cy-0.1*sc,  cx-0.32*sc, cy+0.14*sc],
      ra: [cx, cy-0.1*sc,  cx+0.35*sc, cy-0.42*sc],
      ll: [cx, cy+0.2*sc,  cx-0.18*sc, cy+0.52*sc],
      rl: [cx, cy+0.2*sc,  cx+0.18*sc, cy+0.52*sc],
    }),
    (cx, cy, sc) => ({                                          // 양팔 위, 다리 넓게
      la: [cx, cy-0.15*sc, cx-0.38*sc, cy-0.48*sc],
      ra: [cx, cy-0.15*sc, cx+0.38*sc, cy-0.48*sc],
      ll: [cx, cy+0.2*sc,  cx-0.26*sc, cy+0.52*sc],
      rl: [cx, cy+0.2*sc,  cx+0.26*sc, cy+0.52*sc],
    }),
    (cx, cy, sc) => ({                                          // 양팔 옆, 오른발 킥
      la: [cx, cy-0.05*sc, cx-0.44*sc, cy-0.06*sc],
      ra: [cx, cy-0.05*sc, cx+0.44*sc, cy-0.06*sc],
      ll: [cx, cy+0.2*sc,  cx-0.12*sc, cy+0.5*sc],
      rl: [cx, cy+0.2*sc,  cx+0.4*sc,  cy+0.28*sc],
    }),
    (cx, cy, sc) => ({                                          // 양팔 옆, 왼발 킥
      la: [cx, cy-0.05*sc, cx-0.44*sc, cy-0.06*sc],
      ra: [cx, cy-0.05*sc, cx+0.44*sc, cy-0.06*sc],
      ll: [cx, cy+0.2*sc,  cx-0.4*sc,  cy+0.28*sc],
      rl: [cx, cy+0.2*sc,  cx+0.12*sc, cy+0.5*sc],
    }),
  ];

  function drawStickFigure(c, cx, cy, sc, poseIdx) {
    const pose = DANCE_POSES[poseIdx % DANCE_POSES.length](cx, cy, sc);
    c.lineWidth = Math.max(2.5, sc * 0.08);
    c.lineCap = 'round';
    c.lineJoin = 'round';
    c.strokeStyle = '#fff';
    c.fillStyle = '#fff';

    c.beginPath();
    c.arc(cx, cy - sc * 0.52, sc * 0.16, 0, Math.PI * 2);
    c.fill();

    c.beginPath(); c.moveTo(cx, cy - sc*0.35); c.lineTo(cx, cy + sc*0.2); c.stroke();

    for (const [x1, y1, x2, y2] of [pose.la, pose.ra, pose.ll, pose.rl]) {
      c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke();
    }
  }

  function showDanceOverlay(label, color, onDone) {
    if (danceAnimId) cancelAnimationFrame(danceAnimId);
    danceCanvas.hidden = false;
    const TICKS_PER_POSE = 9;
    const TOTAL_TICKS    = 108;   // ~1.8s @ 60fps
    const W = danceCanvas.width, H = danceCanvas.height;
    const cx = W / 2;
    let tick = 0;

    function animate() {
      danceCtx.clearRect(0, 0, W, H);

      danceCtx.fillStyle = 'rgba(10, 12, 28, 0.88)';
      danceCtx.fillRect(0, 0, W, H);

      // 레트로 점선 테두리
      danceCtx.strokeStyle = color;
      danceCtx.lineWidth = 2;
      danceCtx.setLineDash([6, 4]);
      danceCtx.strokeRect(6, 6, W - 12, H - 12);
      danceCtx.setLineDash([]);

      // 깜빡이는 라벨
      if (Math.floor(tick / 8) % 2 === 0) {
        danceCtx.fillStyle = color;
        danceCtx.font = 'bold 26px monospace';
        danceCtx.textAlign = 'center';
        danceCtx.fillText(label, cx, 72);
      }

      // 막대 인형 (위아래 bobbing 포함)
      const bob  = Math.sin(tick * 0.25) * 6;
      const pose = Math.floor(tick / TICKS_PER_POSE);
      drawStickFigure(danceCtx, cx, H / 2 + bob, 88, pose);

      // 별 파티클
      const stars = [[40,120],[260,160],[50,420],[250,400],[150,500],[80,300],[220,280]];
      stars.forEach(([sx, sy], i) => {
        const blink = Math.floor((tick + i * 7) / 6) % 2;
        if (blink) {
          danceCtx.fillStyle = color;
          danceCtx.font = '14px monospace';
          danceCtx.textAlign = 'center';
          danceCtx.fillText('★', sx, sy);
        }
      });

      tick++;
      if (tick < TOTAL_TICKS) {
        danceAnimId = requestAnimationFrame(animate);
      } else {
        danceCanvas.hidden = true;
        danceAnimId = null;
        onDone?.();
      }
    }
    danceAnimId = requestAnimationFrame(animate);
  }

  // ─── HIGH SCORE / LEADERBOARD ───
  const TOP3_MEDALS = ['🥇', '🥈', '🥉'];
  const TOP3_COLORS = ['#ffd86e', '#c0c0c0', '#cd7f32'];

  function renderTop3(list) {
    if (!Array.isArray(list) || list.length === 0) {
      top3ListEl.innerHTML = '<p class="top3-empty">기록 없음</p>';
      return;
    }
    top3ListEl.innerHTML = list.map((p, i) => `
      <div class="top3-item">
        <span class="top3-rank">${TOP3_MEDALS[i]}</span>
        <span class="top3-name">${escapeHtml(p.player_name)}</span>
        <span class="top3-score" style="color:${TOP3_COLORS[i]}">${p.score.toLocaleString()}</span>
      </div>`).join('');
  }

  async function loadHighScore() {
    renderTop3(await fetchTop3());
  }

  function escapeHtml(str) {
    const d = document.createElement('div');
    d.appendChild(document.createTextNode(String(str)));
    return d.innerHTML;
  }

  function formatDate(iso) {
    if (!iso) return '-';
    const d = new Date(iso);
    const pad = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}.${pad(d.getMonth()+1)}.${pad(d.getDate())} - ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  }

  function renderLeaderboard(data) {
    if (!Array.isArray(data) || data.length === 0) {
      leaderboardContent.innerHTML = '<p class="loading-text">아직 기록이 없습니다.</p>';
      return;
    }
    const rows = data.map((p, i) => {
      const cls = i === 0 ? 'rank-1' : i === 1 ? 'rank-2' : i === 2 ? 'rank-3' : '';
      return `<tr class="${cls}">
        <td class="lb-rank">${i + 1}</td>
        <td class="lb-name">${escapeHtml(p.player_name)}</td>
        <td class="lb-score">${p.score.toLocaleString()}</td>
        <td class="lb-date">${formatDate(p.created_at)}</td>
      </tr>`;
    }).join('');
    leaderboardContent.innerHTML = `
      <table class="leaderboard-table">
        <thead><tr><th>순위</th><th>플레이어</th><th>점수</th><th>일시</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>`;
  }

  async function openLeaderboard() {
    localStorage.setItem('leaderboard_open', '1');
    leaderboardModal.classList.remove('hidden');
    leaderboardContent.innerHTML = '<p class="loading-text">불러오는 중...</p>';
    renderLeaderboard(await fetchLeaderboard());
  }
  function closeLeaderboard() {
    localStorage.removeItem('leaderboard_open');
    leaderboardModal.classList.add('hidden');
  }

  leaderboardBtn.addEventListener('click', openLeaderboard);
  closeLeaderboardBtn.addEventListener('click', closeLeaderboard);

  logoutBtn.addEventListener('click', () => {
    if (running) return;
    clearTimeout(dropTimeoutId);
    running = false;
    showLogin();
  });

  // ─── 게임 상태 ───
  let board, current, nextPiece, score, level, totalLines, dropTimeoutId, levelTimerId, running;
  let canStart = true;
  let locking  = false;

  function createEmptyBoard() {
    return Array.from({ length: ROWS }, () => Array(COLS).fill(null));
  }
  function generatePieceData() {
    const name = PIECE_NAMES[Math.floor(Math.random() * PIECE_NAMES.length)];
    const s = SHAPES[name];
    return { cells: s.cells.map(([x,y]) => [x,y]), color: s.color };
  }

  function resetUI() {
    if (running) {
      clearTimeout(dropTimeoutId);
      clearInterval(levelTimerId);
      running = false;
    }
    board     = createEmptyBoard();
    nextPiece = null;
    score = 0; level = 1; totalLines = 0; locking = false;
    scoreEl.textContent = 0;
    levelEl.textContent = 1;
    overlayEl.classList.add('hidden');
    nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
    render();
  }

  function getDropInterval() {
    let ms = BASE_DROP_INTERVAL;
    for (let i = 0; i < level - 1; i++) ms -= (LEVEL_STEPS[i] ?? 20);
    return Math.max(MIN_DROP_INTERVAL, ms);
  }
  function scheduleDrop() {
    dropTimeoutId = setTimeout(async () => { await softDrop(); if (running) scheduleDrop(); }, getDropInterval());
  }
  function startLevelTimer() {
    clearInterval(levelTimerId);
    levelTimerId = setInterval(() => {
      if (!running) return;
      level++;
      levelEl.textContent = level;
    }, LEVEL_UP_INTERVAL_MS);
  }
function drawCell3D(c, color, px, py, size) {
    const s = size - 1;
    const b = Math.max(2, Math.floor(size * 0.12));
    c.fillStyle = color;
    c.fillRect(px, py, s, s);
    c.fillStyle = 'rgba(255,255,255,0.3)';
    c.fillRect(px, py, s, b);
    c.fillStyle = 'rgba(255,255,255,0.13)';
    c.fillRect(px, py + b, b, s - b);
    c.fillStyle = 'rgba(0,0,0,0.25)';
    c.fillRect(px, py + s - b, s, b);
    c.fillStyle = 'rgba(0,0,0,0.12)';
    c.fillRect(px + s - b, py, b, s - b);
  }

  function renderNext() {
    nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
    if (!nextPiece) return;
    const xs = nextPiece.cells.map(([x]) => x), ys = nextPiece.cells.map(([,y]) => y);
    const minX = Math.min(...xs), minY = Math.min(...ys);
    const offX = Math.floor((nextCanvas.width  - (Math.max(...xs)-minX+1)*24)/2) - minX*24;
    const offY = Math.floor((nextCanvas.height - (Math.max(...ys)-minY+1)*24)/2) - minY*24;
    nextPiece.cells.forEach(([x,y]) => {
      drawCell3D(nextCtx, nextPiece.color, offX+x*24, offY+y*24, 24);
    });
  }

  function spawnPiece(keepNext = false) {
    if (!nextPiece) nextPiece = generatePieceData();
    current = { ...nextPiece, x: 3, y: 0 };
    if (!keepNext) nextPiece = generatePieceData();
    renderNext();
    if (hasCollision(current, 0, 0)) gameOver();
  }

  function absoluteCells(piece, dx=0, dy=0) {
    return piece.cells.map(([x,y]) => [piece.x+x+dx, piece.y+y+dy]);
  }
  function hasCollision(piece, dx, dy, cells=null) {
    return (cells || absoluteCells(piece,dx,dy)).some(([x,y]) => {
      if (x < 0 || x >= COLS || y >= ROWS) return true;
      if (y < 0) return false;
      return board[y][x] !== null;
    });
  }
  async function lockPiece() {
    if (locking) return;
    locking = true;
    absoluteCells(current).forEach(([x,y]) => { if (y >= 0) board[y][x] = current.color; });
    const cleared = await clearLines();
    spawnPiece(cleared > 0);
    render();   // 보드 갱신 후 즉시 렌더
    locking = false;
  }
  async function clearLines() {
    const fullRows = [];
    for (let y = ROWS - 1; y >= 0; y--) {
      if (board[y].every(c => c !== null)) fullRows.push(y);
    }
    if (fullRows.length === 0) return 0;

    const wait = ms => new Promise(r => setTimeout(r, ms));
    for (let f = 0; f < 4; f++) {
      fullRows.forEach(y => {
        for (let x = 0; x < COLS; x++) {
          ctx.fillStyle = f % 2 === 0 ? '#ffffff' : board[y][x];
          ctx.fillRect(x * CELL, y * CELL, CELL - 1, CELL - 1);
        }
      });
      await wait(35);
    }

    // splice를 먼저 모두 실행한 뒤 unshift — 교대 실행 시 인덱스가 밀려 잘못된 행이 제거되는 버그 방지
    fullRows.sort((a, b) => b - a);
    fullRows.forEach(y => board.splice(y, 1));
    for (let i = 0; i < fullRows.length; i++) board.unshift(Array(COLS).fill(null));

    score += LINE_SCORES[fullRows.length] || fullRows.length * 100;
    scoreEl.textContent = score;

    totalLines += fullRows.length;

    return fullRows.length;
  }
  function move(dx, dy) {
    if (!running || hasCollision(current,dx,dy)) return false;
    current.x += dx; current.y += dy; return true;
  }
  function rotate() {
    if (!running) return;
    const xs=current.cells.map(([x])=>x), ys=current.cells.map(([,y])=>y);
    const minX=Math.min(...xs), minY=Math.min(...ys), h=Math.max(...ys)-minY+1;
    const rotated = current.cells.map(([x,y]) => [h-1-(y-minY), x-minX]);
    const bX=current.x+minX, bY=current.y+minY;
    for (const dx of [0,-1,1,-2,2]) {
      const targets = rotated.map(([x,y]) => [bX+x+dx, bY+y]);
      if (!hasCollision(current,0,0,targets)) {
        current.cells=rotated; current.x=bX+dx; current.y=bY; return;
      }
    }
  }
  async function softDrop() { if (!move(0,1) && !locking) await lockPiece(); if (!locking) render(); }
  async function hardDrop() {
    if (!running || locking) return;
    while (move(0, 1)) {}
    await lockPiece();
  }

  function gameOver() {
    running = false;
    clearTimeout(dropTimeoutId);
    clearInterval(levelTimerId);
    logoutBtn.disabled = false;
    nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
    savePlay(currentName, score).then(loadHighScore);
    showDanceOverlay('GAME OVER!', '#ff6e6e', () => {
      finalScoreEl.textContent = score;
      overlayEl.classList.remove('hidden');
      canStart = true;
      startBtn.disabled = false;
    });
  }

  function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (let y=0; y<ROWS; y++)
      for (let x=0; x<COLS; x++)
        if (board[y][x]) drawCell3D(ctx, board[y][x], x*CELL, y*CELL, CELL);
    if (current)
      absoluteCells(current).forEach(([x,y]) => {
        if (y >= 0) drawCell3D(ctx, current.color, x*CELL, y*CELL, CELL);
      });
  }

  function startGame() {
    if (!canStart) return;
    canStart = false;
    startBtn.disabled = true;
    logoutBtn.disabled = true;
    resetUI();
    playerEmailEl.textContent = currentName;
    showDanceOverlay('GAME START!', '#6e93ff', () => {
      running = true;
      spawnPiece(); render();
      scheduleDrop();
      startLevelTimer();
    });
  }

  document.addEventListener('keydown', e => {
    if (!running) return;
    switch (e.key) {
      case 'ArrowLeft':  e.preventDefault(); move(-1,0); render(); break;
      case 'ArrowRight': e.preventDefault(); move( 1,0); render(); break;
      case 'ArrowDown':  e.preventDefault(); softDrop(); break;
      case 'ArrowUp':
      case ' ':          e.preventDefault(); rotate(); render(); break;
    }
  });

  startBtn.addEventListener('click',  startGame);
  restartBtn.addEventListener('click', startGame);

  // ─── 모바일 버튼 ───
  function addTouchBtn(id, action) {
    const btn = document.getElementById(id);
    let interval = null;
    const start = e => {
      e.preventDefault();
      if (!running) return;
      action();
      render();
      interval = setInterval(() => { if (running) { action(); render(); } }, 120);
    };
    const stop = () => { clearInterval(interval); interval = null; };
    btn.addEventListener('touchstart', start, { passive: false });
    btn.addEventListener('touchend',   stop);
    btn.addEventListener('mousedown',  start);
    btn.addEventListener('mouseup',    stop);
    btn.addEventListener('mouseleave', stop);
  }

  addTouchBtn('btn-left',  () => move(-1, 0));
  addTouchBtn('btn-right', () => move( 1, 0));

  // 아래/회전 버튼: touchstart + mousedown만 사용 (click은 touchstart 후 중복 발화)
  // 200ms 쿨다운으로 가볍게 닿았을 때 오작동 방지
  function addTapBtn(id, action) {
    const btn = document.getElementById(id);
    let lastTime = 0;
    const handle = e => {
      e.preventDefault();
      const now = Date.now();
      if (now - lastTime < 200) return;
      lastTime = now;
      action();
    };
    btn.addEventListener('touchstart', handle, { passive: false });
    btn.addEventListener('mousedown',  handle);
  }

  addTapBtn('btn-down',   () => { hardDrop(); });
  addTapBtn('btn-rotate', () => { if (!running) return; rotate(); render(); });

  // 최초 진입 시 초기화
  resetUI();
  playerEmailEl.textContent = currentName;
  loadHighScore();

  // 새로고침 전 점수순위 모달이 열려 있었으면 복원
  if (localStorage.getItem('leaderboard_open') === '1') openLeaderboard();
};
