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
const STATUS_LABEL = {
  draft: "임시저장",
  submitted: "계열사 검토중",
  company_approved: "지주사 검토중",
  revision_requested: "수정요청",
  approved: "합의완료",
  locked: "잠김"
};

const STATUS_BADGE_CLASS = {
  draft: "bg-[#f0f0f2] text-[#6e6e73]",
  submitted: "bg-[#eaf0f8] text-[#4c6fa5]",
  company_approved: "bg-[#e8eefb] text-[#3f5bb5]",
  revision_requested: "bg-[#faf1de] text-[#b9821f]",
  approved: "bg-[#e7f5ec] text-[#2f9e5b]",
  locked: "bg-[#eceef1] text-[#3a4356]"
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
  sum: "합산형 (당월 실적 입력)",
  latest: "누적형 (누적값 입력)",
  average: "평균형 (기간 평균 평가)"
};
const ACCUMULATION_SHORT = { sum: "합산", latest: "누적", average: "평균" };
const ACCUMULATION_INPUT_HINT = {
  sum: "이 기간에 발생한 실적만 입력하세요 (연간 실적 = 합계)",
  latest: "연초부터 누적된 값을 입력하세요 (연간 실적 = 마지막 값)",
  average: "이 기간의 값을 입력하세요 (연간 실적 = 기간 평균)"
};

const METRIC_TYPE_LABEL = {
  increasing: "증가형 (정량)",
  decreasing: "감소형 · 원가율 등 (정량)",
  milestone: "마일스톤 · 완료여부 (정성)",
  qualitative: "진척도(%) 자가평가 (정성)"
};

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

function rateColorClass(rate) {
  if (rate === null || rate === undefined) return "bg-[#f0f0f2] text-[#a1a1a6]";
  if (rate >= 90) return "bg-[#e7f5ec] text-[#2f9e5b]";
  if (rate >= 60) return "bg-[#faf1de] text-[#b9821f]";
  return "bg-[#fbeae7] text-[#c94a3c]";
}

function rateDotClass(rate) {
  if (rate === null || rate === undefined) return "bg-[#d1d1d6]";
  if (rate >= 90) return "bg-[#2f9e5b]";
  if (rate >= 60) return "bg-[#c98a1f]";
  return "bg-[#c94a3c]";
}

// 위험도 판단 (경영진 대시보드용): 미합의/미달성 목표를 빠르게 식별
function riskLevel(rate, status) {
  if (status === "revision_requested") return "warn";
  if (rate === null || rate === undefined) return "none";
  if (rate < 60) return "risk";
  if (rate < 90) return "warn";
  return "ok";
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
