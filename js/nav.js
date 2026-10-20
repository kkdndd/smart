// 좌측 사이드바 내비게이션
//
// 상시 메뉴는 네 개뿐이다: 대시보드 · 나의 할 일 · 사업계획 · 실적 입력.
// 이 시스템의 목적은 '현황을 보고 관리하는 것'이므로 대시보드가 맨 위에 온다.
// 계열사/사업부/KPI 기준정보/계정처럼 일 년에 몇 번 쓰는 설정 화면은
// 아래쪽 '설정'으로 따로 내려 일상 업무와 섞이지 않게 한다.
const ICONS = {
  // 대시보드: 계기판
  status: '<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.7"><path stroke-linecap="round" stroke-linejoin="round" d="M4 16.5a8 8 0 0116 0"/><path stroke-linecap="round" d="M12 16.5l4.1-4.6"/><circle cx="12" cy="16.5" r="1.1" fill="currentColor" stroke="none"/></svg>',
  // 나의 할 일: 체크 표시가 있는 종이
  home: '<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.7"><rect x="4" y="3.5" width="16" height="17" rx="2.5"/><path stroke-linecap="round" stroke-linejoin="round" d="M8.2 9.3l1.4 1.4 2.6-2.8M8.2 15.3l1.4 1.4 2.6-2.8M14.8 9.6h2.6M14.8 15.6h2.6"/></svg>',
  // 사업계획: 과녁
  plan: '<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.7"><circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.3"/><circle cx="12" cy="12" r="1.1" fill="currentColor" stroke="none"/></svg>',
  // 실적 입력: 키보드
  actual: '<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.7"><rect x="2.5" y="5.5" width="19" height="13" rx="2.5"/><path stroke-linecap="round" d="M6.4 9.7h.01M10.5 9.7h.01M14.6 9.7h.01M18.2 9.7h.01M6.4 12.9h.01M10.5 12.9h.01M14.6 12.9h.01M18.2 12.9h.01"/><path stroke-linecap="round" d="M8.6 15.9h6.8"/></svg>',
  // 설정: 톱니
  settings: '<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.7"><circle cx="12" cy="12" r="3.1"/><path stroke-linecap="round" stroke-linejoin="round" d="M12 3.6v2.1M12 18.3v2.1M20.4 12h-2.1M5.7 12H3.6M18 6l-1.5 1.5M7.5 16.5L6 18M18 18l-1.5-1.5M7.5 7.5L6 6"/></svg>'
};

// 어떤 파일이 어떤 메뉴에 속하는지 — 세부 화면에서도 메뉴가 선택된 채로 보이게 한다
const NAV_GROUP_OF_PAGE = {
  "home.html": "home",
  "goals.html": "plan",
  "goal-form.html": "plan",
  "goal-detail.html": "plan",
  "review.html": "plan",
  "change-requests.html": "plan",
  "progress.html": "actual",
  "dashboard.html": "status",
  "settings.html": "settings",
  "companies.html": "settings",
  "business-units.html": "settings",
  "kpi.html": "settings",
  "admin.html": "settings",
  "process-map.html": "settings"
};

// 현재 열려 있는 파일명으로 활성 메뉴를 추정한다 (각 화면이 직접 지정하지 않아도 되도록)
function activeNavKey(explicit) {
  if (explicit) return explicit;
  const file = (location.pathname.split("/").pop() || "home.html").toLowerCase();
  return NAV_GROUP_OF_PAGE[file] || "home";
}

function navLinksFor(profile) {
  // 1순위는 대시보드 — 이 시스템은 현황을 보고 관리하기 위한 것이고, 입력은 그다음이다
  const links = [
    { href: "dashboard.html", label: "대시보드", key: "status" },
    { href: "home.html", label: "나의 할 일", key: "home" }
  ];

  // 경영진도 사업계획 목록을 본다 (조회 전용).
  // 대시보드에서 숫자를 눌러 목록으로 들어가게 해놓고 메뉴에는 없으면,
  // 도착한 화면에서 돌아갈 길이 없어 길을 잃는다.
  links.push({ href: "goals.html", label: "사업계획", key: "plan", badge: profile.role !== "holdco_exec" });
  if (canWriteGoals(profile)) {
    links.push({ href: "progress.html", label: "실적 입력", key: "actual" });
  }
  return links;
}

function renderNav(profile, active) {
  const links = navLinksFor(profile);
  const activeKey = activeNavKey(active);
  const canSettings = canManageBusinessUnits(profile) || isHoldcoEditor(profile);

  const root = document.getElementById("nav-root");
  root.classList.add("sidebar");
  root.innerHTML = `
    <div class="sidebar-brand">
      <div class="name">대교홀딩스</div>
      <div class="sub">SMART 사업계획</div>
    </div>
    <div class="sidebar-year">
      <label for="year-select">사업연도</label>
      <select id="year-select" onchange="onYearChange(this.value)">
        ${yearOptions().map(y => `<option value="${y}" ${y === getSelectedYear() ? "selected" : ""}>${y}년</option>`).join("")}
      </select>
    </div>
    <nav class="sidebar-nav">
      ${links.map(l => `<a href="${l.href}" class="sidebar-link ${activeKey === l.key ? 'active' : ''}">${ICONS[l.key] || ''}<span>${l.label}</span>${l.badge ? `<span class="nav-badge" id="nav-badge-${l.key}" hidden></span>` : ''}</a>`).join("")}
    </nav>
    <div class="sidebar-foot">
      ${canSettings ? `<a href="settings.html" class="sidebar-link sidebar-link-quiet ${activeKey === 'settings' ? 'active' : ''}">${ICONS.settings}<span>설정</span></a>` : ''}
      <div class="sidebar-user">
        <div class="who">${escapeHtml(profile.name || profile.email)}</div>
        <div>${escapeHtml(profile.companies ? profile.companies.name : '지주사')} · ${roleLabel(profile.role)}</div>
        ${isBuStaff(profile) ? `<div class="text-[11px] mt-0.5" style="color:var(--text-tertiary)">담당 사업부: ${escapeHtml((profile.business_units || []).map(b => b.name).join(", ")) || '미지정'}</div>` : ''}
        <a href="password.html" class="block mt-2 text-[11px] underline" style="color:var(--text-secondary)">비밀번호 변경</a>
        <button onclick="signOutAndRedirect()" class="btn btn-secondary mt-2 w-full !py-1.5 !text-xs">로그아웃</button>
      </div>
    </div>`;

  document.body.classList.add("has-sidebar");
  if (profile.role !== "holdco_exec") refreshNavBadge(profile);
}

// '내 차례'인 목표 개수를 사업계획 메뉴에 띄운다.
// 어느 화면에 있든 공이 나에게 넘어왔다는 것을 알 수 있어야 하므로 전 페이지에서 갱신한다.
// (목표 테이블 한 번만 읽는 가벼운 질의)
async function refreshNavBadge(profile) {
  try {
    const year = getSelectedYear();
    let q = sb.from("goals").select("id,status,company_id,business_unit_id").eq("year", year);
    if (!isHoldco(profile)) q = q.eq("company_id", profile.company_id);
    const { data } = await q;
    const n = (data || []).filter(g => {
      const kind = myTurnKind(profile, g);
      return kind === "fix" || kind === "review" || kind === "approve";
    }).length;
    const el = document.getElementById("nav-badge-plan");
    if (el && n > 0) { el.textContent = n; el.hidden = false; }
  } catch (e) {
    // 배지는 보조 정보이므로 실패해도 화면 동작에는 영향이 없다
  }
}

// 사이드바 연도 선택 변경 시: 선택값을 저장하고 현재 화면을 새로고침해 그 연도 기준으로 다시 불러온다
function onYearChange(newYear) {
  setSelectedYear(parseInt(newYear, 10));
  location.reload();
}
