// ─── Supabase 클라이언트 (DB 전용, Auth 미사용) ───
const { createClient } = window.supabase;
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ─── UI 상태 ───
const SESSION_KEY = 'tetris_player';
let gameVisible = false;

function showLogin() {
  gameVisible = false;
  localStorage.removeItem(SESSION_KEY);
  document.getElementById('login-overlay').hidden = false;
  document.getElementById('game-wrapper').hidden  = true;
  const input = document.getElementById('email-input');
  input.value = '';
  input.focus();
  document.getElementById('email-error').hidden = true;
}

function showGame(name) {
  if (gameVisible) return;
  gameVisible = true;
  localStorage.setItem(SESSION_KEY, name);
  document.getElementById('login-overlay').hidden = true;
  document.getElementById('game-wrapper').hidden  = false;
  if (typeof window.initGame === 'function') window.initGame(name);
}

// ─── 이름 유효성 검사 ───
function validateName(name) {
  return name.length >= 1 && name.length <= 20;
}

// ─── 초기화 ───
document.addEventListener('DOMContentLoaded', () => {
  const emailInput = document.getElementById('email-input');
  const emailError = document.getElementById('email-error');
  const startBtn   = document.getElementById('btn-start');

  function handleStart() {
    setTimeout(() => {
      const name = emailInput.value.trim();
      if (!name) {
        emailError.textContent = '이름을 입력하세요.';
        emailError.hidden = false;
        emailInput.focus();
        return;
      }
      if (!validateName(name)) {
        emailError.textContent = '이름은 1~20자로 입력하세요.';
        emailError.hidden = false;
        emailInput.focus();
        return;
      }
      emailError.hidden = true;
      showGame(name);
    }, 0);
  }

  // 중복 실행 방지 (click + touchend 동시 발생 케이스)
  let starting = false;
  function safeStart() {
    if (starting) return;
    starting = true;
    startBtn.blur();
    setTimeout(() => { starting = false; }, 400);
    handleStart();
  }

  // 이벤트 리스너는 세션 복원 여부와 무관하게 항상 등록
  startBtn.addEventListener('click', safeStart);
  startBtn.addEventListener('touchend', e => { e.preventDefault(); safeStart(); });
  emailInput.addEventListener('keydown', e => { if (e.key === 'Enter') safeStart(); });
  emailInput.addEventListener('change', () => { emailError.hidden = true; });
  emailInput.addEventListener('input',  () => { emailError.hidden = true; });

  // 새로고침 시 세션 복원 (이벤트 등록 이후에 체크)
  const savedName = localStorage.getItem(SESSION_KEY);
  if (savedName) {
    showGame(savedName);
  } else {
    emailInput.focus();
  }
});
