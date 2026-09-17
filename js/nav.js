// 좌측 사이드바 내비게이션 렌더링
const ICONS = {
  // 대시보드: 계기판(게이지) — 전사 현황을 한눈에 본다는 의미
  dashboard: '<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.7"><path stroke-linecap="round" stroke-linejoin="round" d="M4 16.5a8 8 0 0116 0"/><path stroke-linecap="round" d="M12 16.5l4.1-4.6"/><circle cx="12" cy="16.5" r="1.1" fill="currentColor" stroke="none"/></svg>',
  // 사업계획 목표: 과녁
  goals: '<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.7"><circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.3"/><circle cx="12" cy="12" r="1.1" fill="currentColor" stroke="none"/></svg>',
  // 진행실적 입력: 키보드
  progress: '<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.7"><rect x="2.5" y="5.5" width="19" height="13" rx="2.5"/><path stroke-linecap="round" d="M6.4 9.7h.01M10.5 9.7h.01M14.6 9.7h.01M18.2 9.7h.01M6.4 12.9h.01M10.5 12.9h.01M14.6 12.9h.01M18.2 12.9h.01"/><path stroke-linecap="round" d="M8.6 15.9h6.8"/></svg>',
  review: '<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.7"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"/></svg>',
  cr: '<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.7"><path stroke-linecap="round" stroke-linejoin="round" d="M16 15v-1a4 4 0 00-4-4H8m0 0l3-3m-3 3l3 3m5 2v1a4 4 0 01-4 4H8"/></svg>',
  admin: '<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.7"><path stroke-linecap="round" stroke-linejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14c-4.4 0-8 2.2-8 5v1h16v-1c0-2.8-3.6-5-8-5z"/></svg>',
  bu: '<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.7"><path stroke-linecap="round" stroke-linejoin="round" d="M12 3v4m0 0H7a1 1 0 00-1 1v3m6-4h5a1 1 0 011 1v3M4 11h4v4H4v-4zm6 0h4v4h-4v-4zm6 0h4v4h-4v-4z"/></svg>',
  company: '<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.7"><path stroke-linecap="round" stroke-linejoin="round" d="M3 21h18M5 21V7l7-4 7 4v14M9 9h2m2 0h2M9 13h2m2 0h2M9 17h6"/></svg>',
  kpi: '<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.7"><path stroke-linecap="round" stroke-linejoin="round" d="M4 19.5V5a1.5 1.5 0 011.5-1.5h9L20 9v10.5a1.5 1.5 0 01-1.5 1.5h-13A1.5 1.5 0 014 19.5z"/><path stroke-linecap="round" stroke-linejoin="round" d="M14 3.5V9h5.5M8.5 16.5v-3m3.5 3v-5m3.5 5v-2"/></svg>',
  // 프로세스 맵: 단계가 이어지는 흐름도(노드 → 노드)
  process: '<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.7"><rect x="2.5" y="3.5" width="8" height="6" rx="1.8"/><rect x="13.5" y="14.5" width="8" height="6" rx="1.8"/><path stroke-linecap="round" stroke-linejoin="round" d="M10.5 6.5h3.5a3 3 0 013 3v5"/></svg>',
};

function renderNav(profile, active) {
  const links = [
    { href: "dashboard.html", label: "대시보드", key: "dashboard" },
    { href: "process-map.html", label: "프로세스 맵", key: "process" },
    { href: "goals.html", label: "사업계획 목표", key: "goals" },
    { href: "progress.html", label: "진행실적 입력", key: "progress" },
  ];
  // 검토/합의: 계열사 담당자는 사업부 제출건을, 지주사 담당자는 계열사 합의건을 확정한다
  if (isCompanyStaff(profile)) {
    links.push({ href: "review.html", label: "사업부 목표 검토", key: "review" });
  } else if (isHoldcoEditor(profile)) {
    links.push({ href: "review.html", label: "검토/합의", key: "review" });
  }
  if (isHoldco(profile)) {
    links.push({ href: "change-requests.html", label: "변경요청 관리", key: "cr" });
  } else {
    links.push({ href: "change-requests.html", label: "목표 변경요청", key: "cr" });
  }
  if (isHoldcoEditor(profile)) {
    links.push({ href: "companies.html", label: "계열사 관리", key: "company" });
  }
  if (canManageBusinessUnits(profile)) {
    links.push({ href: "business-units.html", label: "사업부 관리", key: "bu" });
    links.push({ href: "kpi.html", label: "KPI 기준정보", key: "kpi" });
  }
  if (isHoldcoEditor(profile)) {
    links.push({ href: "admin.html", label: "계정 관리", key: "admin" });
  }

  const root = document.getElementById("nav-root");
  root.classList.add("sidebar");
  root.innerHTML = `
    <div class="sidebar-brand">
      <div class="name">대교홀딩스</div>
      <div class="sub">SMART 사업계획 관리 웹서비스</div>
    </div>
    <div class="sidebar-year">
      <label for="year-select">사업연도</label>
      <select id="year-select" onchange="onYearChange(this.value)">
        ${yearOptions().map(y => `<option value="${y}" ${y === getSelectedYear() ? "selected" : ""}>${y}년</option>`).join("")}
      </select>
    </div>
    <nav class="sidebar-nav">
      ${links.map(l => `<a href="${l.href}" class="sidebar-link ${active===l.key?'active':''}">${ICONS[l.key]||''}<span>${l.label}</span></a>`).join("")}
    </nav>
    <div class="sidebar-user">
      <div class="who">${escapeHtml(profile.name || profile.email)}</div>
      <div>${escapeHtml(profile.companies ? profile.companies.name : '지주사')} · ${roleLabel(profile.role)}</div>
      ${isBuStaff(profile) ? `<div class="text-[11px] mt-0.5" style="color:var(--text-tertiary)">담당 사업부: ${escapeHtml((profile.business_units||[]).map(b=>b.name).join(", ")) || '미지정'}</div>` : ''}
      <a href="password.html" class="block mt-2 text-[11px] underline" style="color:var(--text-secondary)">비밀번호 변경</a>
      <button onclick="signOutAndRedirect()" class="btn btn-secondary mt-2 w-full !py-1.5 !text-xs">로그아웃</button>
    </div>`;

  document.body.classList.add("has-sidebar");
}

// 사이드바 연도 선택 변경 시: 선택값을 저장하고 현재 화면을 새로고침해 그 연도 기준으로 다시 불러온다
function onYearChange(newYear) {
  setSelectedYear(parseInt(newYear, 10));
  location.reload();
}
