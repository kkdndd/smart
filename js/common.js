// 공통 유틸리티: Supabase 클라이언트 초기화, 인증 체크, 달성률 계산 등

const sb = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);

const STATUS_LABEL = {
  draft: "임시저장",
  submitted: "제출됨(검토대기)",
  revision_requested: "수정요청",
  approved: "승인완료",
  locked: "잠김"
};

const STATUS_BADGE_CLASS = {
  draft: "bg-[#f0f0f2] text-[#6e6e73]",
  submitted: "bg-[#eaf0f8] text-[#4c6fa5]",
  revision_requested: "bg-[#faf1de] text-[#b9821f]",
  approved: "bg-[#e7f5ec] text-[#2f9e5b]",
  locked: "bg-[#eceef1] text-[#3a4356]"
};

const METRIC_TYPE_LABEL = {
  increasing: "증가형 (정량)",
  decreasing: "감소형 · 원가율 등 (정량)",
  milestone: "마일스톤 · 완료여부 (정성)",
  qualitative: "진척도(%) 자가평가 (정성)"
};

// 현재 로그인 세션 + 프로필을 가져오고, 없으면 로그인 페이지로 이동
async function requireAuth() {
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

async function signOutAndRedirect() {
  await sb.auth.signOut();
  window.location.href = "index.html";
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

// 위험도 판단 (경영진 대시보드용): 미승인/미달성 목표를 빠르게 식별
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

// 연도 기준 월별/분기별 period 문자열 목록 생성
function periodsForYear(year, periodType) {
  if (periodType === "quarterly") {
    return [1, 2, 3, 4].map(q => `${year}-Q${q}`);
  }
  return Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, "0")}`);
}

// 해당 기간(월/분기) 실적의 입력 마감일을 계산한다.
// 규칙: 월별 실적은 해당 월의 다음 달 말일까지, 분기별 실적은 해당 분기 종료월의 다음 달 말일까지 입력.
// 예) 2026-01(월별) → 마감 2026-02-28 / 2026-Q1(분기별, 3월 종료) → 마감 2026-04-30
function periodDeadline(period, periodType) {
  const year = parseInt(period.slice(0, 4), 10);
  let endMonth; // 해당 기간이 끝나는 월 (1~12)
  if (periodType === "quarterly") {
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
