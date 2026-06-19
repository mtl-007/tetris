// ─── tetris_plays 테이블 CRUD ───
// RLS: SELECT / INSERT 모두 공개 허용 (인증 불필요)

async function savePlay(playerName, score) {
  const { error } = await supabaseClient
    .from('tetris_plays')
    .insert({ player_name: playerName, score });
  return !error;
}

async function fetchHighScore() {
  const { data, error } = await supabaseClient
    .from('tetris_plays')
    .select('player_name, score')
    .order('score', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) return null;
  return data;
}

async function fetchTop3() {
  const { data, error } = await supabaseClient
    .from('tetris_plays')
    .select('player_name, score')
    .order('score', { ascending: false })
    .limit(3);
  if (error) return [];
  return data ?? [];
}

async function fetchLeaderboard() {
  const { data, error } = await supabaseClient
    .from('tetris_plays')
    .select('player_name, score, created_at')
    .order('score', { ascending: false })
    .limit(10);
  if (error) return [];
  return data ?? [];
}
