// 공통 유틸리티: Supabase 클라이언트 초기화, 인증 체크, 달성률 계산 등

// ---- 로그인 세션 저장 방식 ----
// supabase-js 기본값은 localStorage라서 브라우저를 껐다 켜도 토큰이 남아 자동 로그인이 된다.
// 브라우저(또는 탭)를 닫으면 로그인이 풀리도록 sessionStorage에 저장한다.
// sessionStorage는 탭 단위로 유지되므로, 이 앱처럼 페이지 이동이 전체 새로고침이어도 같은 탭 안에서는 로그인이 끊기지 않는다.
const _memoryAuthStore = {};
const AUTH_STORAGE = {
  getItem(key) {
    try { return window.sessionStorage.getItem(key); }
    catch (e) { return Object.prototype.hasOwnProperty.call(_memoryAuthStore, key) ? _memoryAuthStore[key] : null; }
  },
  setItem(key, value) {
    try { window.sessionStorage.setItem(key, value); }
    catch (e) { _memoryAuthStore[key] = value; }
  },
  removeItem(key) {
    try { window.sessionStorage.removeItem(key); }
    catch (e) { delete _memoryAuthStore[key]; }
  }
};

// 방식 전환 이전에 localStorage에 저장돼 있던 토큰 정리.
// 그대로 두면 디스크에 로그인 토큰이 계속 남기 때문에, 페이지를 열 때마다 한 번씩 확인해 지운다.
(function clearLegacyAuthTokens() {
  try {
    const stale = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (key && key.startsWith("sb-") && key.indexOf("-auth-token") !== -1) stale.push(key);
    }
    stale.forEach(key => window.localStorage.removeItem(key));
  } catch (e) {
    // 시크릿 모드 등에서 localStorage 접근이 막혀 있을 수 있으므로 무시한다
  }
})();

const sb = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY, {
  auth: {
    storage: AUTH_STORAGE,
    persistSession: true,      // 같은 탭 안에서는 페이지를 이동해도 로그인 유지
    autoRefreshToken: true,    // 1시간짜리 액세스 토큰 자동 갱신
    detectSessionInUrl: true   // 비밀번호 재설정 이메일 링크(#access_token=...) 처리
  }
});

// 결재 흐름: 사업부 담당자 작성 → 계열사 담당자 검토 → 지주사 담당자 최종 확정
//
// 상태 이름은 "지금 이 목표가 어떤 상태인지"를 처음 보는 사람도 알 수 있는 말로 쓴다.
// (옛 이름: 임시저장 / 합의완료 → 새 이름: 작성 중 / 확정)
const STATUS_LABEL = {
  draft: "작성 중",
  submitted: "계열사 검토 중",
  company_approved: "지주사 검토 중",
  revision_requested: "수정 요청됨",
  approved: "확정",
  locked: "잠김"
};

// 목록에서 "지금 누구 손에 있는지"를 한 줄로 알려주는 설명
const STATUS_HINT = {
  draft: "아직 제출하지 않았습니다",
  submitted: "계열사 담당자가 보고 있습니다",
  company_approved: "지주사 담당자가 보고 있습니다",
  revision_requested: "작성자가 고쳐야 합니다",
  approved: "확정되어 더 이상 고칠 수 없습니다",
  locked: "잠겨 있습니다"
};

// 색상값은 design.css의 .badge-* 클래스에만 둔다.
// 화면 코드에 색상값을 흩어두면 한 곳만 바뀌어 톤이 어긋난다.
const STATUS_BADGE_CLASS = {
  draft: "badge-draft",
  submitted: "badge-submitted",
  company_approved: "badge-company",
  revision_requested: "badge-revision",
  approved: "badge-approved",
  locked: "badge-locked"
};

const REVIEW_ACTION_LABEL = {
  submit: "제출",
  company_approve: "계열사 합의",
  approve: "지주사 합의",
  reject: "반려",
  request_revision: "수정요청",
  withdraw: "제출취소"
};

const ROLE_LABEL = {
  bu_staff: "사업부 담당자",
  company_staff: "계열사 담당자",
  holdco_staff: "지주사 담당자/관리자",
  holdco_exec: "지주사 경영진(조회)"
};

// 집계 방식 — 같은 지표를 어떤 사람은 당월 발생분으로, 어떤 사람은 누적값으로 넣으면 달성률이 틀어진다.
// 지표마다 입력 방법과 연간 실적 산출 규칙을 고정한다.
const ACCUMULATION_LABEL = {
  sum: "매달 발생분을 입력 (연간 실적 = 합계)",
  latest: "누적된 값을 입력 (연간 실적 = 마지막 값)",
  average: "기간 평균으로 평가 (연간 실적 = 평균)"
};
const ACCUMULATION_SHORT = { sum: "발생분", latest: "누적", average: "평균" };
const ACCUMULATION_INPUT_HINT = {
  sum: "이 기간에 발생한 실적만 입력하세요 (연간 실적 = 합계)",
  latest: "연초부터 누적된 값을 입력하세요 (연간 실적 = 마지막 값)",
  average: "이 기간의 값을 입력하세요 (연간 실적 = 기간 평균)"
};
// 물음표 도움말에 들어갈 한 줄 설명
const ACCUMULATION_HELP = "매달 새로 발생한 양을 적는 지표인지(매출·수주건수), 연초부터 쌓인 총량을 적는 지표인지(회원수·누적 계약수) 고르는 항목입니다.";

const METRIC_TYPE_LABEL = {
  increasing: "높을수록 좋음 (매출 · 건수 등)",
  decreasing: "낮을수록 좋음 (원가율 · 불량률 등)",
  milestone: "완료 / 미완료로 관리",
  qualitative: "진척도(%)를 직접 입력"
};
const METRIC_TYPE_HELP = "목표를 어느 방향으로 달성하는지 고릅니다. 달성률 계산식이 달라집니다.";

// SMART 다섯 칸 — 큰 글씨는 질문으로, 알파벳은 작은 배지로 옆에 둔다.
// word는 원래 영어 용어. 교육·문서에서 쓰는 말이라 함께 적어두면 두 표기가 연결된다.
const SMART_FIELDS = [
  { key: "specific_text",   letter: "S", word: "Specific",   label: "무엇을 할지",
    hint: "예: 기계설비 성능점검과 연계한 공사 수주를 늘린다" },
  { key: "measurable_text", letter: "M", word: "Measurable", label: "어떻게 잴지",
    hint: "예: 성능점검 연계 공사 수주 건수와 금액으로 측정한다" },
  { key: "achievable_text", letter: "A", word: "Achievable", label: "가능한 근거",
    hint: "예: 기계설비유지관리 거래처 40곳 중 12곳이 점검 대상이다" },
  { key: "relevant_text",   letter: "R", word: "Relevant",   label: "왜 중요한지",
    hint: "예: 점검-수선-FM 수주로 이어지는 선순환의 출발점이다" },
  { key: "timebound_text",  letter: "T", word: "Time-bound", label: "언제까지",
    hint: "예: 3월까지 면허 등록, 6월부터 수주 개시" }
];

// SMART 라벨 한 줄: [S] Specific 무엇을 할지
// 화면마다 따로 조립하면 어디는 영어가 있고 어디는 없는 상태가 되므로 여기 한 곳에서 만든다.
function smartLabelHtml(f) {
  return `<span class="letter-badge">${f.letter}</span>`
    + `<span class="smart-word">${escapeHtml(f.word)}</span>`
    + escapeHtml(f.label);
}

// 금액 지표의 그룹 표준 단위 — 계열사마다 백만원·억원을 섞어 쓰면 전사 비교가 불가능해진다
const MONEY_UNIT_DEFAULT = "백만원";
const MONEY_UNITS = ["백만원", "억원", "천원", "원"];
const COMMON_UNITS = ["백만원", "억원", "건", "개", "명", "사", "%", "점", "회", "일"];

// 현재 로그인 세션 + 프로필을 가져오고, 없으면 로그인 페이지로 이동
// opts.skipPasswordGate: 비밀번호 변경 페이지에서만 true (무한 리다이렉트 방지)
async function requireAuth(opts) {
  opts = opts || {};
  const { data: { session } } = await sb.auth.getSession();
  if (!session) {
    window.location.href = "index.html";
    return null;
  }
  const { data: profile, error } = await sb
    .from("profiles")
    .select("*, companies:company_id(id,name,is_holding)")
    .eq("id", session.user.id)
    .single();
  if (error || !profile) {
    console.error(error);
    await sb.auth.signOut();
    window.location.href = "index.html";
    return null;
  }
  // 초기 비밀번호를 아직 바꾸지 않은 계정은 다른 화면을 쓰기 전에 비밀번호부터 변경하게 한다
  if (!opts.skipPasswordGate && profile.must_change_password) {
    window.location.href = "password.html";
    return null;
  }

  // 사업부 담당자는 배정된 사업부 범위 안에서만 조회/입력할 수 있으므로 함께 실어둔다
  const { data: buRows } = await sb.from("profile_business_units")
    .select("business_unit_id, business_units:business_unit_id(id,name,is_active,active_from_year,active_to_year)")
    .eq("profile_id", profile.id);
  profile.business_units = (buRows || []).map(r => r.business_units).filter(Boolean);
  profile.business_unit_ids = (buRows || []).map(r => r.business_unit_id);
  return profile;
}

function isHoldco(profile) {
  return profile.role === "holdco_staff" || profile.role === "holdco_exec";
}
function isHoldcoEditor(profile) {
  return profile.role === "holdco_staff";
}
function isCompanyStaff(profile) {
  return profile.role === "company_staff";
}
function isBuStaff(profile) {
  return profile.role === "bu_staff";
}
// 목표를 직접 작성/수정할 수 있는 역할 (사업부 담당자 + 계열사 담당자)
function canWriteGoals(profile) {
  return isBuStaff(profile) || isCompanyStaff(profile);
}
// 사업부 마스터(등록/수정/병합)를 관리할 수 있는 역할
function canManageBusinessUnits(profile) {
  return isCompanyStaff(profile) || isHoldcoEditor(profile);
}
// 목표 하나에 대해 이 사용자가 손댈 수 있는지 (RLS와 동일한 규칙을 화면에서 미리 판단)
function canEditGoal(profile, goal) {
  if (isHoldcoEditor(profile)) return true;
  if (isCompanyStaff(profile)) {
    return goal.company_id === profile.company_id
      && ["draft", "submitted", "revision_requested", "company_approved"].includes(goal.status);
  }
  if (isBuStaff(profile)) {
    return goal.company_id === profile.company_id
      && goal.business_unit_id && profile.business_unit_ids.includes(goal.business_unit_id)
      && ["draft", "submitted", "revision_requested"].includes(goal.status);
  }
  return false;
}
function roleLabel(role) {
  return ROLE_LABEL[role] || role;
}

// 목표 삭제는 임시저장 상태에서만 허용한다 (제출 이후에는 결재 이력이 남아야 하므로 제출취소 후 삭제)
// DB의 goals_delete 정책과 같은 규칙을 화면에서도 미리 판단한다.
function canDeleteGoal(profile, goal) {
  if (!goal || goal.status !== "draft") return false;
  if (isHoldcoEditor(profile)) return true;
  if (isCompanyStaff(profile)) return goal.company_id === profile.company_id;
  if (isBuStaff(profile)) {
    return goal.company_id === profile.company_id
      && goal.business_unit_id && profile.business_unit_ids.includes(goal.business_unit_id);
  }
  return false;
}

// 삭제하면 함께 사라지는 데이터 규모를 미리 센다 (지표·실적은 DB에서 CASCADE로 삭제됨)
async function goalDeleteImpact(goalId) {
  const { data: metrics } = await sb.from("goal_metrics").select("id").eq("goal_id", goalId);
  const metricIds = (metrics || []).map(m => m.id);
  let entries = [];
  if (metricIds.length) {
    const { data: rows } = await sb.from("progress_entries").select("attachment_path").in("goal_metric_id", metricIds);
    entries = rows || [];
  }
  return {
    metricIds,
    metricCount: metricIds.length,
    entryCount: entries.length,
    attachmentPaths: entries.map(e => e.attachment_path).filter(Boolean)
  };
}

// 목표 삭제. DB는 지표·실적·검토이력이 CASCADE로 지워지지만
// 스토리지의 증빙파일은 따로 지우지 않으면 고아 파일로 남는다.
async function deleteGoalCascade(goalId, attachmentPaths) {
  if (attachmentPaths && attachmentPaths.length) {
    const { error: fileErr } = await sb.storage.from("progress-attachments").remove(attachmentPaths);
    if (fileErr) console.error("첨부파일 삭제 실패:", fileErr); // 파일 정리 실패가 목표 삭제를 막지는 않는다
  }
  return await sb.from("goals").delete().eq("id", goalId);
}

// 확인 문구를 만들고 삭제까지 수행한다. 삭제했으면 true를 돌려준다.
async function confirmAndDeleteGoal(goal) {
  const impact = await goalDeleteImpact(goal.id);
  const lines = [`'${goal.strategy_name}' 목표를 삭제할까요?`, ""];
  if (impact.metricCount) lines.push(`· 핵심지표 ${impact.metricCount}개`);
  if (impact.entryCount) lines.push(`· 입력된 실적 ${impact.entryCount}건`);
  if (impact.attachmentPaths.length) lines.push(`· 증빙파일 ${impact.attachmentPaths.length}개`);
  if (impact.metricCount || impact.entryCount) lines.push("", "위 데이터가 함께 삭제되며 되돌릴 수 없습니다.");
  else lines.push("되돌릴 수 없습니다.");

  if (!confirm(lines.join("\n"))) return false;

  const { error } = await deleteGoalCascade(goal.id, impact.attachmentPaths);
  if (error) {
    alert("삭제 실패: " + error.message + "\n(임시저장 상태의 목표만 삭제할 수 있습니다)");
    return false;
  }
  return true;
}

async function signOutAndRedirect() {
  await sb.auth.signOut();
  window.location.href = "index.html";
}

// ---- 비밀번호 ----
// 새 비밀번호 규칙: 8자 이상 + 영문/숫자/특수문자 중 2종류 이상 조합
// 문제가 있으면 안내 문구를, 통과하면 null을 반환한다
function validateNewPassword(pw) {
  if (!pw || pw.length < 8) return "비밀번호는 8자 이상이어야 합니다.";
  if (pw.length > 72) return "비밀번호는 72자 이하로 입력해주세요.";
  const kinds = [/[A-Za-z]/, /[0-9]/, /[^A-Za-z0-9]/].filter(re => re.test(pw)).length;
  if (kinds < 2) return "영문·숫자·특수문자 중 2종류 이상을 섞어주세요.";
  if (/\s/.test(pw)) return "비밀번호에 공백은 사용할 수 없습니다.";
  return null;
}

// 비밀번호를 실제로 바꾼 뒤, 변경 요구 상태를 해제한다
async function markPasswordChanged(profileId) {
  const { error } = await sb.from("profiles")
    .update({ must_change_password: false, password_changed_at: new Date().toISOString() })
    .eq("id", profileId);
  if (error) console.error(error);
  return !error;
}

// 지표 유형/목표값/실적값을 바탕으로 달성률(%) 계산
// periodTargetOverride: 해당 기간(월/분기)에 설정된 목표값이 있으면 연간 목표값 대신 사용
function calcAchievementRate(metric, latestActual, milestoneAchieved, periodTargetOverride) {
  if (metric.metric_type === "milestone") {
    return milestoneAchieved ? 100 : 0;
  }
  if (metric.metric_type === "qualitative") {
    // 정성 지표: 목표/기준값 없이 담당자가 직접 입력한 진척도(0~100%)를 그대로 달성률로 사용
    const v = Number(latestActual);
    if (latestActual === null || latestActual === undefined || isNaN(v)) return null;
    return Math.max(0, Math.min(100, Math.round(v * 10) / 10));
  }
  const hasOverride = periodTargetOverride !== undefined && periodTargetOverride !== null && periodTargetOverride !== "";
  const target = Number(hasOverride ? periodTargetOverride : metric.target_value);
  const baseline = Number(metric.baseline_value);
  const actual = Number(latestActual);
  if (isNaN(target) || target === 0 || latestActual === null || latestActual === undefined || isNaN(actual)) {
    return null; // 계산 불가
  }
  if (metric.metric_type === "increasing") {
    return Math.round((actual / target) * 1000) / 10;
  }
  if (metric.metric_type === "decreasing") {
    if (isNaN(baseline) || baseline === target) return null;
    const rate = ((baseline - actual) / (baseline - target)) * 100;
    return Math.round(rate * 10) / 10;
  }
  return null;
}

// ---- 집계 방식에 따른 연간 실적/목표 산출 ----
function accumulationOf(metric) {
  return (metric && metric.accumulation) || "sum";
}

function aggregateValues(values, accumulation) {
  const nums = values.filter(v => v !== null && v !== undefined && v !== "").map(Number).filter(v => !isNaN(v));
  if (!nums.length) return null;
  if (accumulation === "latest") return nums[nums.length - 1];
  const sum = nums.reduce((a, b) => a + b, 0);
  const v = (accumulation === "average") ? sum / nums.length : sum;
  return Math.round(v * 1000) / 1000;
}

// 연간 실적. entries는 기간 오름차순이어야 한다.
function annualActual(metric, entriesAsc) {
  return aggregateValues((entriesAsc || []).map(e => e.actual_value), accumulationOf(metric));
}

// 연간 목표. 연간 목표값이 있으면 그것을, 없으면 기간별 목표값을 같은 방식으로 묶는다.
function annualTarget(metric, periodTargetValues) {
  if (metric.target_value !== null && metric.target_value !== undefined) return Number(metric.target_value);
  return aggregateValues(periodTargetValues || [], accumulationOf(metric));
}

// 그 기간에 도달해야 할 목표값. 기간별 목표가 설정돼 있으면 그 값을, 없으면 연간 목표로 계산한 참고값을 쓴다.
function periodTargetAt(metric, period, idx, count, periodTargetMap) {
  const set = periodTargetMap && periodTargetMap[period];
  if (set !== undefined && set !== null && set !== "") return Number(set);
  return referencePeriodTarget(metric, idx, count);
}

// 달성률 — 실적이 입력된 기간의 목표와만 비교한다.
//
// 예전에는 "연간 실적 ÷ 연간 목표"로 계산했는데, 7월까지 입력한 실적을 12개월 목표와 비교하게 되어
// 합산형 지표에서 값이 크게 왜곡됐다(월 목표·실적이 매달 똑같이 1,1,2,2,3,3,3인데도 300%로 표시).
// 같은 구간끼리 비교하면 집계 방식(합산/누적/평균)과 무관하게 "목표만큼 했으면 100%"가 나온다.
function achievementRate(metric, entriesAsc, periodTargetMap, year) {
  if (metric.metric_type === "milestone") {
    const done = (entriesAsc || []).filter(e => e.milestone_achieved === true).length;
    const total = (entriesAsc || []).filter(e => e.milestone_achieved !== null && e.milestone_achieved !== undefined).length;
    return total ? Math.round((done / total) * 1000) / 10 : null;
  }
  if (metric.metric_type === "qualitative") {
    // 진척도는 마지막에 보고된 값이 곧 현재 수준
    return aggregateValues((entriesAsc || []).map(e => e.actual_value), "latest");
  }

  const periods = periodsForYear(year, metric.period_type);
  const idxOf = {};
  periods.forEach((p, i) => { idxOf[p] = i; });

  const actuals = [], targets = [];
  (entriesAsc || []).forEach(e => {
    if (e.actual_value === null || e.actual_value === undefined) return;
    const idx = idxOf[e.period];
    if (idx === undefined) return; // 기간 유형이 바뀌어 짝이 맞지 않는 옛 실적은 제외
    actuals.push(Number(e.actual_value));
    targets.push(periodTargetAt(metric, e.period, idx, periods.length, periodTargetMap));
  });
  if (!actuals.length || targets.some(t => t === null || t === undefined)) return null;

  const acc = accumulationOf(metric);
  const actual = aggregateValues(actuals, acc);
  const target = aggregateValues(targets, acc);
  if (actual === null || target === null || target === 0) return null;

  if (metric.metric_type === "decreasing") {
    const baseline = Number(metric.baseline_value);
    if (isNaN(baseline) || baseline === target) return null;
    return Math.round(((baseline - actual) / (baseline - target)) * 1000) / 10;
  }
  return Math.round((actual / target) * 1000) / 10;
}

// 연간 목표 대비 진척 (참고 지표). 합산형은 누계, 누적형은 현재값, 평균형은 평균을 연간 목표와 비교한다.
function annualProgressRate(metric, entriesAsc) {
  if (metric.metric_type === "milestone" || metric.metric_type === "qualitative") return null;
  const actual = annualActual(metric, entriesAsc);
  const target = (metric.target_value !== null && metric.target_value !== undefined) ? Number(metric.target_value) : null;
  if (actual === null || target === null || target === 0) return null;
  return Math.round((actual / target) * 1000) / 10;
}

// 기간별 목표의 합계(집계 방식 기준)가 연간 목표값과 어긋나면 알려준다.
// 예: 합산형인데 월 목표를 누적값으로 넣으면 합계가 연간 목표를 크게 넘어선다.
function targetConsistencyWarning(metric, periodTargetMap, year) {
  const annual = (metric.target_value !== null && metric.target_value !== undefined) ? Number(metric.target_value) : null;
  if (annual === null || !periodTargetMap) return "";
  const periods = periodsForYear(year, metric.period_type);
  const values = periods.map(p => periodTargetMap[p]).filter(v => v !== undefined && v !== null && v !== "");
  if (values.length !== periods.length) return ""; // 일부만 설정된 경우는 비교하지 않는다
  const rolled = aggregateValues(values, accumulationOf(metric));
  if (rolled === null || Math.abs(rolled - annual) < 0.001) return "";
  const acc = accumulationOf(metric);
  const label = acc === "latest" ? "마지막 기간 목표" : acc === "average" ? "기간 목표 평균" : "기간 목표 합계";
  return `${label} ${rolled.toLocaleString()} 이(가) 연간 목표값 ${annual.toLocaleString()} 과(와) 다릅니다. 집계 방식이나 목표값을 확인해주세요.`;
}

// 기간별 목표값이 따로 설정되지 않은 지표의 "그 기간에 도달해야 할 수준" 참고값.
// 화면마다 다르게 계산하면 같은 지표가 화면마다 다른 목표로 보이므로 여기 한 곳에서만 계산한다.
//  · 합산형: 연간 목표 ÷ 기간수
//  · 누적형: 기준값에서 목표값까지 균등하게 올라가는 수준 (기준값이 없으면 0에서 시작하는 누적으로 본다)
//  · 평균형: 매 기간 연간 목표 수준을 유지
function referencePeriodTarget(metric, idx, count) {
  const target = (metric.target_value !== null && metric.target_value !== undefined) ? Number(metric.target_value) : null;
  if (target === null || !count) return null;
  const acc = accumulationOf(metric);
  if (acc === "average") return target;
  if (acc === "latest") {
    const base = (metric.baseline_value !== null && metric.baseline_value !== undefined) ? Number(metric.baseline_value) : 0;
    return Math.round((base + (target - base) * (idx + 1) / count) * 100) / 100;
  }
  return Math.round((target / count) * 100) / 100;
}

// 연중에는 합산형 지표가 항상 미달로 보이므로, 경과 기간 비율을 함께 본다 (2026-07이면 7/12 = 58%)
function elapsedRatio(year, periodType, now) {
  now = now || new Date();
  if (now.getFullYear() > year) return 1;
  if (now.getFullYear() < year) return 0;
  const total = periodCount(periodType);
  const done = periodType === "annual" ? 1
             : periodType === "half" ? Math.floor(now.getMonth() / 6) + 1
             : periodType === "quarterly" ? Math.floor(now.getMonth() / 3) + 1
             : now.getMonth() + 1;
  return Math.min(1, done / total);
}

// 달성률은 이제 "실적이 입력된 구간의 목표 대비"라서 페이스 개념이 이미 반영돼 있다.
// 대신 연간 목표까지 얼마나 왔는지를 보조로 보여준다. (예: 7/12기간 · 연간 목표의 58%)
function progressSubText(metric, entriesAsc, year) {
  const periods = periodsForYear(year, metric.period_type);
  const filled = (entriesAsc || []).filter(e =>
    (e.actual_value !== null && e.actual_value !== undefined) ||
    (e.milestone_achieved !== null && e.milestone_achieved !== undefined)).length;
  if (!filled) return "";
  const parts = [`${filled}/${periods.length}기간 입력`];
  const annual = annualProgressRate(metric, entriesAsc);
  if (annual !== null) parts.push(`연간 목표의 ${annual}%`);
  return parts.join(" · ");
}

// 달성률 색도 design.css의 클래스로 (90% / 60% 경계)
function rateColorClass(rate) {
  if (rate === null || rate === undefined) return "rate-none";
  if (rate >= 90) return "rate-good";
  if (rate >= 60) return "rate-warn";
  return "rate-risk";
}

function rateDotClass(rate) {
  if (rate === null || rate === undefined) return "dot-none";
  if (rate >= 90) return "dot-good";
  if (rate >= 60) return "dot-warn";
  return "dot-risk";
}

// 위험도 판단 (경영진 대시보드용): 미합의/미달성 목표를 빠르게 식별
function riskLevel(rate, status) {
  if (status === "revision_requested") return "warn";
  if (rate === null || rate === undefined) return "none";
  if (rate < 60) return "risk";
  if (rate < 90) return "warn";
  return "ok";
}

// Chart.js는 캔버스에 직접 그리기 때문에 CSS 변수를 읽지 못하고 실제 색상 문자열이 필요하다.
// 차트 파일마다 색을 따로 적어두면 화면과 차트의 색이 조용히 어긋나므로,
// design.css의 토큰 값을 런타임에 꺼내 쓴다. 색을 바꿀 때 고칠 곳은 여전히 design.css 한 곳뿐이다.
//   예) cssVar("--green") → design.css에 적힌 초록 값
function cssVar(name) {
  try {
    const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    if (v) return v;
  } catch (e) { /* 토큰을 읽을 수 없으면 아래로 */ }
  console.warn("정의되지 않은 디자인 토큰:", name);
  return "currentColor";
}

// 차트에서 자주 쓰는 색 묶음 (의미 이름 → 토큰)
function chartColors() {
  return {
    good: cssVar("--green"), warn: cssVar("--amber"), risk: cssVar("--red"),
    goodFill: cssVar("--green-soft"),
    none: cssVar("--neutral-dot"), info: cssVar("--blue"), deep: cssVar("--indigo"),
    accent: cssVar("--accent"),
    target: cssVar("--neutral-dot"), gridLine: cssVar("--neutral-soft"),
    ink: cssVar("--text-primary"), inkSoft: cssVar("--text-secondary"), inkFaint: cssVar("--text-tertiary"),
    surface: cssVar("--surface")
  };
}

function escapeHtml(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function nl2br(str) {
  return escapeHtml(str).replace(/\n/g, "<br/>");
}

// 적어둔 내용을 읽기 좋게 바꾼다. **줄 수와 상관없이 항상 불릿 목록으로** 보여준다.
//  · 여러 줄이면 줄마다 한 항목 — <br>로만 이으면 어디까지가 한 항목인지 눈으로 구분되지 않는다
//  · 한 줄이어도 불릿을 붙인다 — 항목마다 들쭉날쭉하면 세로로 훑을 때 시선이 걸린다
// 앞에 직접 찍은 -, ·, *, • 기호는 불릿과 겹치므로 떼어낸다.
function textBlockHtml(str) {
  if (str === null || str === undefined) return "";
  const lines = String(str).split(/\r?\n/).map(s => s.trim()).filter(Boolean);
  if (!lines.length) return "";
  return `<ul class="text-lines">${lines
    .map(l => `<li>${escapeHtml(l.replace(/^[-·*•‧∙]\s*/, ""))}</li>`).join("")}</ul>`;
}

// ---- 실적 입력 주기 ----
// 기간 문자열 표기: 2026-01(월) / 2026-Q1(분기) / 2026-H1(반기) / 2026-Y(연간)
const PERIOD_TYPE_LABEL = {
  monthly: "월별",
  quarterly: "분기별",
  half: "반기별",
  annual: "연 1회"
};
const PERIOD_TYPE_COUNT = { monthly: 12, quarterly: 4, half: 2, annual: 1 };

function periodCount(periodType) {
  return PERIOD_TYPE_COUNT[periodType] || 12;
}

// 연도 기준 period 문자열 목록 생성
function periodsForYear(year, periodType) {
  if (periodType === "annual") return [`${year}-Y`];
  if (periodType === "half") return [1, 2].map(h => `${year}-H${h}`);
  if (periodType === "quarterly") return [1, 2, 3, 4].map(q => `${year}-Q${q}`);
  return Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, "0")}`);
}

// 기간 문자열을 화면용 라벨로 (2026-03 → 3월, 2026-H1 → 상반기, 2026-Y → 연간)
function periodDisplayLabel(period) {
  if (!period) return "";
  if (/-Y$/.test(period)) return "연간";
  const h = period.match(/-H(\d)$/);
  if (h) return h[1] === "1" ? "상반기" : "하반기";
  const q = period.match(/-Q(\d)$/);
  if (q) return `${q[1]}분기`;
  const mm = period.match(/-(\d{2})$/);
  if (mm) return `${parseInt(mm[1], 10)}월`;
  return period;
}

// 해당 기간 실적의 입력 마감일. 규칙: 그 기간이 끝나는 달의 "다음 달 말일"까지 입력.
// 예) 2026-01 → 2026-02-28 / 2026-Q1(3월 종료) → 2026-04-30
//     2026-H1(6월 종료) → 2026-07-31 / 2026-Y(12월 종료) → 2027-01-31
function periodDeadline(period, periodType) {
  const year = parseInt(period.slice(0, 4), 10);
  let endMonth; // 해당 기간이 끝나는 월 (1~12)
  if (periodType === "annual") {
    endMonth = 12;
  } else if (periodType === "half") {
    const h = parseInt(period.replace(/^\d{4}-H/, ""), 10);
    endMonth = h * 6;
  } else if (periodType === "quarterly") {
    const q = parseInt(period.replace(/^\d{4}-Q/, ""), 10);
    endMonth = q * 3;
  } else {
    endMonth = parseInt(period.slice(5, 7), 10);
  }
  // endMonth+1이 마감 월(1-indexed). new Date(year, m, 0)은 0-indexed 월 m의 "0일" = (m-1) 0-indexed 월의 말일
  // 마감 월(1-indexed, endMonth+1)의 말일 = new Date(year, endMonth+1, 0) (12월 초과 시 자동으로 다음해로 이월됨)
  return new Date(year, endMonth + 1, 0, 23, 59, 59, 999);
}

// 지금(now) 시점 기준으로, 마감일이 지났는데도 실적이 입력되지 않은 기간 목록을 반환
// entryExists(period) => 해당 기간에 실적 데이터가 있는지 판단하는 콜백
function overduePeriods(periodType, year, entryExists, now) {
  now = now || new Date();
  return periodsForYear(year, periodType).filter(period => {
    if (periodDeadline(period, periodType) >= now) return false;
    return !entryExists(period);
  });
}

// ---- 목표 관리번호(seq_no) ----
// 관리번호는 "연도 + 계열사 + 사업부" 그룹 안에서 1번부터 매겨진다. (예: 2026년 강원심층수 영업 1번)
// 따라서 목록에서는 사업부로 묶은 뒤 번호 순으로 정렬해야 번호가 순서대로 읽힌다.
function sortGoalsByBusinessUnit(goals) {
  return [...goals].sort((a, b) => {
    const an = a.business_units ? a.business_units.name : "";
    const bn = b.business_units ? b.business_units.name : "";
    if (an !== bn) return an.localeCompare(bn, "ko");
    return (a.seq_no ?? 0) - (b.seq_no ?? 0);
  });
}

// 목표를 가리키는 표기: "영업 1번"
function goalRefLabel(goal) {
  const bu = goal.business_units ? goal.business_units.name : "전사 공통";
  return `${bu} ${goal.seq_no ?? "-"}번`;
}

// ---- 목표의 KPI 지표명 ----
// 목표 한 건의 지표명을 한 줄로 만든다. 화면 어디서나 "전략(목표) / KPI 지표" 구조를 같게 유지하기 위한 공통 함수.
//  · 지표명은 goal_metrics 에서 가져온다. 기준정보(kpi_definitions)에 연결돼 있으면 그 이름이 우선(이름을 정비하면 전 화면에 즉시 반영)
//  · goals.indicator_name 은 옛 단일 지표 필드. goal_metrics 가 없는 과거 데이터만 이 값으로 보완한다
//  · 지표가 전혀 없으면 빈 문자열을 반환한다. Specific 본문 등 다른 내용으로 대체하지 않는다
function metricNameOf(metric) {
  if (!metric) return "";
  return (metric.kpi_definitions && metric.kpi_definitions.name) || metric.metric_name || "";
}
function goalMetricNames(goal, metrics) {
  const names = (metrics || []).map(metricNameOf).filter(Boolean);
  if (names.length) return names.join(" / ");
  return (goal && goal.indicator_name) || "";
}

// ---- 계열사/사업부 표시 기간 ----
// 해당 연도 조회 화면(대시보드·목표 목록 등)에 이 계열사/사업부를 노출할지 판단한다.
//  · active_to_year 가 있으면 그 연도까지만 노출 (이후 연도에서는 빠지되 과거 데이터는 그대로 보임)
//  · active_from_year 가 있으면 그 연도부터 노출 (신설 조직)
//  · 둘 다 없으면 is_active(전체 표시/전체 숨김)를 따른다
function isVisibleInYear(entity, year) {
  if (!entity) return false;
  if (entity.active_from_year != null && year < entity.active_from_year) return false;
  if (entity.active_to_year != null) return year <= entity.active_to_year;
  return entity.is_active !== false;
}

// 새 목표 작성·계정 배정 등 "신규 선택" 목록에 넣을지 판단 (숨긴 조직은 무조건 제외)
function isSelectableInYear(entity, year) {
  return entity && entity.is_active !== false && isVisibleInYear(entity, year);
}

// 표시 기간을 사람이 읽는 문구로
function activeRangeLabel(entity) {
  if (!entity) return "";
  const from = entity.active_from_year, to = entity.active_to_year;
  if (from != null && to != null) return `${from}~${to}년 표시`;
  if (to != null) return `${to}년까지 표시`;
  if (from != null) return `${from}년부터 표시`;
  return entity.is_active === false ? "전체 숨김" : "표시중";
}

// 표시 기간 지정용 연도 드롭다운 (관리 화면 공용)
function rangeYearOptions() {
  const base = new Date().getFullYear();
  const arr = [];
  for (let y = base - 3; y <= base + 2; y++) arr.push(y);
  return arr;
}

function yearRangeSelectHtml(cls, selected) {
  return `<select class="${cls} border border-slate-300 rounded px-1 py-0.5 text-[11px]">
    <option value="">제한 없음</option>
    ${rangeYearOptions().map(y => `<option value="${y}" ${String(selected) === String(y) ? 'selected' : ''}>${y}년</option>`).join("")}
  </select>`;
}

// ---- 사업연도 선택 (사이드바 드롭다운에서 고른 연도를 전 페이지에서 공유) ----
const SELECTED_YEAR_KEY = "smart_selected_year";

// 현재 선택된 사업연도. 아직 고른 적이 없으면 이번 해(달력 기준)를 기본값으로 사용
function getSelectedYear() {
  const stored = parseInt(localStorage.getItem(SELECTED_YEAR_KEY), 10);
  return isNaN(stored) ? new Date().getFullYear() : stored;
}

function setSelectedYear(year) {
  localStorage.setItem(SELECTED_YEAR_KEY, String(year));
}

// 연도 드롭다운에 보여줄 선택지: 작년 ~ 2년 뒤(다음 연도 계획을 미리 준비할 수 있도록)
// 이미 선택되어 있던 연도가 이 범위 밖이면 그 값도 포함시켜 목록에서 사라지지 않게 한다
function yearOptions() {
  const base = new Date().getFullYear();
  const selected = getSelectedYear();
  const lo = Math.min(base - 1, selected);
  const hi = Math.max(base + 2, selected);
  const arr = [];
  for (let y = lo; y <= hi; y++) arr.push(y);
  return arr;
}

// ============================================================
//  내 차례 판정 — "지금 이 목표가 내 손에 있는가"
// ============================================================
// 결재는 3단계(사업부 → 계열사 → 지주사)를 그대로 유지한다.
// 사업부 담당자가 배정되지 않은 사업부는 계열사 담당자가 작성까지 겸하므로,
// 계열사 담당자에게는 작성 단계와 검토 단계가 모두 "내 차례"로 잡힌다.
function myTurnKind(profile, goal) {
  if (!profile || !goal) return null;
  const mine = goal.company_id === profile.company_id;
  const myBu = goal.business_unit_id && (profile.business_unit_ids || []).includes(goal.business_unit_id);

  if (isBuStaff(profile)) {
    if (!mine || !myBu) return null;
    if (goal.status === "revision_requested") return "fix";
    if (goal.status === "draft") return "write";
    return null;
  }
  if (isCompanyStaff(profile)) {
    if (!mine) return null;
    if (goal.status === "submitted") return "review";
    if (goal.status === "revision_requested") return "fix";
    if (goal.status === "draft") return "write";
    return null;
  }
  if (isHoldcoEditor(profile)) {
    if (goal.status === "company_approved") return "approve";
    return null;
  }
  return null;
}

function isMyTurn(profile, goal) {
  return myTurnKind(profile, goal) !== null;
}

// 지금 입력해야 할 기간 (2026-09 / 2026-Q3 / 2026-H2 / 2026-Y)
function currentPeriod(year, periodType, now) {
  now = now || new Date();
  let m = now.getMonth() + 1;
  if (now.getFullYear() > year) m = 12;
  else if (now.getFullYear() < year) m = 1;
  if (periodType === "annual") return `${year}-Y`;
  if (periodType === "half") return `${year}-H${Math.floor((m - 1) / 6) + 1}`;
  if (periodType === "quarterly") return `${year}-Q${Math.floor((m - 1) / 3) + 1}`;
  return `${year}-${String(m).padStart(2, "0")}`;
}

// 기간 문자열을 "2026년 9월"처럼 연도까지 붙여 표기
function periodFullLabel(period) {
  if (!period) return "";
  return `${period.slice(0, 4)}년 ${periodDisplayLabel(period)}`;
}

// ============================================================
//  홈 화면 — 내 할 일 모으기
// ============================================================
// 화면 곳곳에 흩어져 있던 "내가 처리해야 할 것"을 한 번에 모은다.
// 급한 순서(마감 지남 → 내가 멈춰둔 일 → 남이 넘긴 일)로 정렬해서 돌려준다.
// 반환 형식: [{ key, tone, title, sub, cta, href, count }]
//   tone: "overdue"(마감 지남) | "mine"(내가 멈춰둔 일) | "handed"(남이 넘긴 일)
const TASK_TONE_ORDER = { overdue: 0, handed: 1, mine: 2 };

async function loadMyTasks(profile, year, now) {
  now = now || new Date();
  const tasks = [];

  // --- 내 범위의 목표 ---
  let q = sb.from("goals")
    .select("id,status,strategy_name,seq_no,company_id,business_unit_id")
    .eq("year", year);
  if (!isHoldco(profile)) q = q.eq("company_id", profile.company_id);
  const { data: goalsRaw } = await q;
  let goals = goalsRaw || [];
  if (isBuStaff(profile)) {
    goals = goals.filter(g => g.business_unit_id && (profile.business_unit_ids || []).includes(g.business_unit_id));
  }

  const byTurn = { write: [], fix: [], review: [], approve: [] };
  goals.forEach(g => {
    const kind = myTurnKind(profile, g);
    if (kind) byTurn[kind].push(g);
  });

  // --- 실적 미입력 (작성 권한이 있는 사람만) ---
  if (canWriteGoals(profile)) {
    const approved = goals.filter(g => g.status === "approved");
    if (approved.length) {
      const { data: metrics } = await sb.from("goal_metrics")
        .select("id,goal_id,period_type").in("goal_id", approved.map(g => g.id));
      const mIds = (metrics || []).map(m => m.id);
      let entries = [];
      if (mIds.length) {
        const { data: rows } = await sb.from("progress_entries")
          .select("goal_metric_id,period,actual_value,milestone_achieved").in("goal_metric_id", mIds);
        entries = rows || [];
      }
      const filled = {};
      entries.forEach(e => {
        if (e.actual_value !== null || e.milestone_achieved !== null) filled[e.goal_metric_id + "|" + e.period] = true;
      });

      let overdue = 0, due = 0, dueLabel = "";
      (metrics || []).forEach(m => {
        overdue += overduePeriods(m.period_type, year, p => filled[m.id + "|" + p], now).length;
        const cur = currentPeriod(year, m.period_type, now);
        if (periodDeadline(cur, m.period_type) >= now && !filled[m.id + "|" + cur]) {
          due++;
          if (!dueLabel) dueLabel = periodFullLabel(cur);
        }
      });

      if (overdue) tasks.push({
        key: "overdue", tone: "overdue", count: overdue,
        title: `마감이 지난 실적 ${overdue}칸이 비어 있습니다`,
        sub: "지난 기간 실적부터 채워주세요",
        cta: "입력하기", href: "progress.html?focus=overdue"
      });
      if (due) tasks.push({
        key: "due", tone: "mine", count: due,
        title: `${dueLabel} 실적 ${due}칸이 아직 비어 있습니다`,
        sub: "마감 전에 입력해주세요",
        cta: "입력하기", href: "progress.html"
      });
    }
  }

  // --- 수정 요청받은 목표 ---
  if (byTurn.fix.length) tasks.push({
    key: "fix", tone: "overdue", count: byTurn.fix.length,
    title: `수정 요청받은 목표 ${byTurn.fix.length}건`,
    sub: "검토 의견을 보고 고쳐서 다시 제출해주세요",
    cta: "확인하기", href: "goals.html?tab=fix"
  });

  // --- 내가 검토할 차례 ---
  if (byTurn.review.length) tasks.push({
    key: "review", tone: "handed", count: byTurn.review.length,
    title: `사업부가 올린 목표 ${byTurn.review.length}건이 기다리고 있습니다`,
    sub: "지표와 목표값을 확인하고 합의해주세요",
    cta: "검토하기", href: "review.html"
  });
  if (byTurn.approve.length) tasks.push({
    key: "approve", tone: "handed", count: byTurn.approve.length,
    title: `계열사가 합의한 목표 ${byTurn.approve.length}건이 확정을 기다립니다`,
    sub: "확정하면 더 이상 고칠 수 없습니다",
    cta: "확정하기", href: "review.html"
  });

  // --- 쓰다 만 목표 ---
  if (byTurn.write.length) tasks.push({
    key: "write", tone: "mine", count: byTurn.write.length,
    title: `쓰다 말아둔 목표 ${byTurn.write.length}건`,
    sub: "제출하려면 지표와 목표값까지 채워야 합니다",
    cta: "이어서 쓰기", href: "goals.html?tab=draft"
  });

  // --- 변경요청 처리 (지주사 담당자) ---
  if (isHoldcoEditor(profile)) {
    const { data: crs } = await sb.from("change_requests").select("id,status").eq("status", "pending");
    if ((crs || []).length) tasks.push({
      key: "cr", tone: "handed", count: crs.length,
      title: `목표 변경요청 ${crs.length}건`,
      sub: "반영할지 반려할지 정해주세요",
      cta: "확인하기", href: "change-requests.html"
    });
  }

  tasks.sort((a, b) => (TASK_TONE_ORDER[a.tone] ?? 9) - (TASK_TONE_ORDER[b.tone] ?? 9));
  return { tasks, goals };
}

// 할 일이 없을 때 보여줄 한 문장 — 빈 화면이 불안하게 보이지 않도록 완결된 말로 끝낸다
function allDoneMessage(year, now) {
  now = now || new Date();
  const m = (now.getFullYear() === year) ? `${now.getMonth() + 1}월` : `${year}년`;
  return `${m}에 처리할 일은 다 끝내셨습니다.`;
}

// ============================================================
//  전역 필터 — 화면이 바뀌어도 보던 범위가 유지된다
// ============================================================
// 태블로처럼 화면 위에 필터를 고정해 두고, 고른 값을 화면 사이에서 공유한다.
// 목록에서 '미머디'를 고른 뒤 현황으로 넘어가도 계속 미머디를 보고 있어야 하기 때문이다.
// 탭을 닫으면 사라지도록 sessionStorage에 둔다 (연도만 localStorage에 따로 보관).
const FILTER_KEY = "smart_filter";

function getFilter() {
  try { return JSON.parse(sessionStorage.getItem(FILTER_KEY)) || {}; }
  catch (e) { return {}; }
}
function setFilter(patch) {
  const next = Object.assign(getFilter(), patch || {});
  try { sessionStorage.setItem(FILTER_KEY, JSON.stringify(next)); } catch (e) {}
  return next;
}
// 주소에 ?company= / ?bu= 가 실려 오면(드릴다운) 그 값을 필터에 반영한다
function applyFilterFromUrl() {
  const p = new URLSearchParams(location.search);
  const patch = {};
  if (p.has("company")) patch.companyId = p.get("company") || "";
  if (p.has("bu")) patch.buId = p.get("bu") || "";
  if (Object.keys(patch).length) setFilter(patch);
  return getFilter();
}

// 숫자·막대를 눌러 목록으로 들어갈 때 쓰는 주소 (현재 필터를 함께 실어 보낸다)
function goalsLink(opts) {
  opts = opts || {};
  const f = getFilter();
  const q = new URLSearchParams();
  if (opts.tab) q.set("tab", opts.tab);
  const company = opts.companyId !== undefined ? opts.companyId : f.companyId;
  const bu = opts.buId !== undefined ? opts.buId : f.buId;
  if (company) q.set("company", company);
  if (bu) q.set("bu", bu);
  return "goals.html?" + q.toString();
}

// 필터바를 그린다.
//   root     : 넣을 DOM 요소
//   profile  : 로그인 사용자
//   year     : 사업연도
//   fields   : ["company","bu"] 중 쓸 것
//   onChange : 값이 바뀌면 호출 (인자: 현재 필터)
//   extraHtml: 오른쪽에 덧붙일 사용자 정의 컨트롤(검색창 등)
async function renderFilterBar(opts) {
  const { root, profile, year, onChange } = opts;
  const fields = opts.fields || ["company", "bu"];
  const f = getFilter();

  // 지주사만 회사를 고를 수 있다. 계열사 소속은 자기 회사로 고정.
  let companies = [];
  if (fields.includes("company") && isHoldco(profile)) {
    const { data } = await sb.from("companies").select("*").order("is_holding", { ascending: false }).order("name");
    companies = (data || []).filter(c => isVisibleInYear(c, year));
    // allowAll: '전체 회사'를 허용하는 화면(현황)에서는 비워둔 상태를 그대로 둔다.
    // 허용하지 않는 화면(목록)에서는 첫 계열사를 골라준다.
    const valid = !f.companyId ? !!opts.allowAll : companies.some(c => c.id === f.companyId);
    if (!valid) setFilter({ companyId: companies[0] ? companies[0].id : "" });
  } else if (fields.includes("company")) {
    setFilter({ companyId: profile.company_id });
  }

  const current = getFilter();

  // 사업부 목록은 고른 회사에 따라 달라진다
  let units = [];
  if (fields.includes("bu")) {
    if (isBuStaff(profile)) {
      units = [...(profile.business_units || [])].sort((a, b) => a.name.localeCompare(b.name, "ko"));
    } else if (current.companyId) {
      const { data } = await sb.from("business_units")
        .select("id,name,is_active,active_from_year,active_to_year")
        .eq("company_id", current.companyId).order("name");
      units = (data || []).filter(b => isVisibleInYear(b, year));
    }
    if (current.buId && !units.some(u => u.id === current.buId)) setFilter({ buId: "" });
  }

  const sel = (id, label, options, value, highlight) => `
    <label class="filter-item ${highlight ? 'filter-item-strong' : ''}">
      <span class="filter-label">${label}</span>
      <select id="${id}" class="filter-select">${options}</select>
    </label>`;

  let html = "";
  if (fields.includes("company") && isHoldco(profile)) {
    html += sel("filter-company", "회사",
      (opts.allowAll ? `<option value="" ${!getFilter().companyId ? "selected" : ""}>전체 회사</option>` : "") +
      companies.map(c => `<option value="${c.id}" ${getFilter().companyId === c.id ? "selected" : ""}>${escapeHtml(c.name)}</option>`).join(""),
      null, true);
  }
  if (fields.includes("bu") && units.length) {
    html += sel("filter-bu", "사업부",
      `<option value="">전체 사업부</option>` +
      units.map(b => `<option value="${b.id}" ${getFilter().buId === b.id ? "selected" : ""}>${escapeHtml(b.name)}</option>`).join(""));
  }

  root.className = "filter-bar";
  root.innerHTML = `<div class="filter-group">${html}</div>
    <div class="filter-extra">${opts.extraHtml || ""}</div>`;

  const companyEl = document.getElementById("filter-company");
  if (companyEl) companyEl.addEventListener("change", async () => {
    setFilter({ companyId: companyEl.value, buId: "" }); // 회사가 바뀌면 사업부는 초기화
    await renderFilterBar(opts);
    onChange(getFilter());
  });
  const buEl = document.getElementById("filter-bu");
  if (buEl) buEl.addEventListener("change", () => {
    setFilter({ buId: buEl.value });
    onChange(getFilter());
  });

  return getFilter();
}

// ============================================================
//  알림 — 흐름을 끊지 않는 토스트
// ============================================================
// 브라우저 기본 alert()는 화면을 멈추고 확인을 눌러야 넘어간다.
// 저장처럼 자주 일어나는 일에 쓰면 사람들이 내용을 읽지 않고 엔터만 치게 된다.
// 되돌릴 수 없는 일(삭제 등)만 confirm을 쓰고, 나머지는 아래 토스트로 알린다.
//   kind: "ok" | "error" | "info"
function toast(message, kind, ms) {
  let root = document.getElementById("toast-root");
  if (!root) {
    root = document.createElement("div");
    root.id = "toast-root";
    root.className = "toast-root";
    document.body.appendChild(root);
  }
  const el = document.createElement("div");
  el.className = "toast toast-" + (kind || "info");
  el.setAttribute("role", kind === "error" ? "alert" : "status");
  el.textContent = message;
  root.appendChild(el);
  // 오류는 읽을 시간이 더 필요하다
  const life = ms || (kind === "error" ? 6000 : 2600);
  setTimeout(() => {
    el.classList.add("leaving");
    setTimeout(() => el.remove(), 220);
  }, life);
  return el;
}
function toastOk(msg) { return toast(msg, "ok"); }
function toastError(msg) { return toast(msg, "error"); }

// ============================================================
//  화면 공통 조각
// ============================================================
// 물음표 도움말 — 처음 보는 용어 옆에 붙인다 (hover/focus 시 설명)
function helpTip(text) {
  return `<span class="help-tip" tabindex="0" aria-label="${escapeHtml(text)}">?<span class="help-bubble">${escapeHtml(text)}</span></span>`;
}

// 빈 화면 — "없습니다" 한 줄로 끝내지 않고 다음에 할 일을 버튼으로 준다
// actions: [{ label, href, primary }]
function emptyStateHtml(title, desc, actions) {
  const btns = (actions || []).map(a =>
    `<a href="${a.href}" class="btn ${a.primary ? 'btn-primary' : 'btn-secondary'} !text-[13px]">${escapeHtml(a.label)}</a>`
  ).join("");
  return `<div class="empty-state">
    <p class="empty-title">${escapeHtml(title)}</p>
    ${desc ? `<p class="empty-desc">${escapeHtml(desc)}</p>` : ""}
    ${btns ? `<div class="empty-actions">${btns}</div>` : ""}
  </div>`;
}

// 처음 몇 번만 보여주는 안내. 같은 키로 limit회 보여준 뒤에는 다시 뜨지 않는다.
function shouldShowIntro(key, limit) {
  limit = limit || 3;
  try {
    const n = parseInt(localStorage.getItem("smart_intro_" + key) || "0", 10);
    return n < limit;
  } catch (e) { return false; }
}
function markIntroShown(key) {
  try {
    const n = parseInt(localStorage.getItem("smart_intro_" + key) || "0", 10);
    localStorage.setItem("smart_intro_" + key, String(n + 1));
  } catch (e) { /* 저장 못 해도 화면은 동작해야 한다 */ }
}
function dismissIntro(key) {
  try { localStorage.setItem("smart_intro_" + key, "99"); } catch (e) {}
}

// 첫 사용 안내 배너. 같은 키로 세 번까지만 보인다.
function introBannerHtml(key, title, body) {
  if (!shouldShowIntro(key)) return "";
  markIntroShown(key);
  return `<div class="intro-banner" data-intro="${key}">
    <div>
      <p class="intro-title">${escapeHtml(title)}</p>
      <p class="intro-body">${escapeHtml(body)}</p>
    </div>
    <button type="button" class="intro-close" onclick="dismissIntro('${key}');this.closest('.intro-banner').remove()">다시 보지 않기</button>
  </div>`;
}

// 목표가 제출 가능한 상태인지 — 작성 화면과 목록이 같은 규칙을 쓴다.
//
// SMART 다섯 칸은 **선택**이다. 비어 있어도 제출을 막지 않는다(운영 정책).
// 다만 비어 있다는 사실은 숨기지 않는다 — 제출할 때 한 번 확인을 받고,
// 검토 화면에서는 경고로 표시해 검토자가 되돌려 보낼 수 있게 한다.
// 제출을 막는 것은 '없으면 관리 자체가 불가능한 것'뿐이다: 전략 이름, 지표, 목표값, 단위.
// metrics: goal_metrics 배열, periodTargetCount: { [metricId]: 설정된 기간목표 개수 }
function submitReadiness(goal, metrics, periodTargetCount) {
  const missing = [];
  if (!goal || !goal.strategy_name || !goal.strategy_name.trim()) missing.push("전략(목표) 이름");
  const list = metrics || [];
  if (!list.length) missing.push("KPI 지표");
  list.forEach(m => {
    const name = metricNameOf(m) || "지표";
    const quantitative = m.metric_type === "increasing" || m.metric_type === "decreasing";
    if (quantitative) {
      const hasAnnual = m.target_value !== null && m.target_value !== undefined && m.target_value !== "";
      const hasPeriod = (periodTargetCount || {})[m.id] > 0;
      if (!hasAnnual && !hasPeriod) missing.push(`${name}의 목표값`);
      // 단위는 지표에 직접 적혀 있거나 기준정보에서 따라올 수 있다
      const unit = m.unit || (m.kpi_definitions && m.kpi_definitions.unit);
      if (!unit || !String(unit).trim()) missing.push(`${name}의 단위`);
    }
  });
  return { ok: missing.length === 0, missing };
}
