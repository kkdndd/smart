// 좌측 사이드바 내비게이션 렌더링
const ICONS = {
  dashboard: '<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.7"><path stroke-linecap="round" stroke-linejoin="round" d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z"/></svg>',
  goals: '<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.7"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>',
  progress: '<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.7"><path stroke-linecap="round" stroke-linejoin="round" d="M9 19V6l12-3v13M9 19a3 3 0 11-6 0 3 3 0 016 0zm12-3a3 3 0 11-6 0 3 3 0 016 0z"/></svg>',
  review: '<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.7"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"/></svg>',
  cr: '<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.7"><path stroke-linecap="round" stroke-linejoin="round" d="M16 15v-1a4 4 0 00-4-4H8m0 0l3-3m-3 3l3 3m5 2v1a4 4 0 01-4 4H8"/></svg>',
  admin: '<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.7"><path stroke-linecap="round" stroke-linejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14c-4.4 0-8 2.2-8 5v1h16v-1c0-2.8-3.6-5-8-5z"/></svg>',
  bu: '<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.7"><path stroke-linecap="round" stroke-linejoin="round" d="M12 3v4m0 0H7a1 1 0 00-1 1v3m6-4h5a1 1 0 011 1v3M4 11h4v4H4v-4zm6 0h4v4h-4v-4zm6 0h4v4h-4v-4z"/></svg>',
  process: '<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.7"><path stroke-linecap="round" stroke-linejoin="round" d="M4 6h9a3 3 0 013 3v0a3 3 0 01-3 3H8a3 3 0 00-3 3v0a3 3 0 003 3h12M4 6a1.5 1.5 0 100-.001M20 6a1.5 1.5 0 100-.001M20 18a1.5 1.5 0 100-.001"/></svg>',
};

function renderNav(profile, active) {
  const links = [
    { href: "dashboard.html", label: "대시보드", key: "dashboard" },
    { href: "process-map.html", label: "프로세스 맵", key: "process" },
    { href: "goals.html", label: "사업계획 목표", key: "goals" },
    { href: "progress.html", label: "진행실적 입력", key: "progress" },
  ];
  // 검토/승인: 계열사 담당자는 사업부 제출건을, 지주사 담당자는 계열사 승인건을 확정한다
  if (isCompanyStaff(profile)) {
    links.push({ href: "review.html", label: "사업부 목표 검토", key: "review" });
  } else if (isHoldcoEditor(profile)) {
    links.push({ href: "review.html", label: "검토/승인", key: "review" });
  }
  if (isHoldco(profile)) {
    links.push({ href: "change-requests.html", label: "변경요청 관리", key: "cr" });
  } else {
    links.push({ href: "change-requests.html", label: "목표 변경요청", key: "cr" });
  }
  if (canManageBusinessUnits(profile)) {
    links.push({ href: "business-units.html", label: "사업부 관리", key: "bu" });
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
      <button onclick="signOutAndRedirect()" class="btn btn-secondary mt-2 w-full !py-1.5 !text-xs">로그아웃</button>
    </div>`;

  document.body.classList.add("has-sidebar");
}

// 사이드바 연도 선택 변경 시: 선택값을 저장하고 현재 화면을 새로고침해 그 연도 기준으로 다시 불러온다
function onYearChange(newYear) {
  setSelectedYear(parseInt(newYear, 10));
  location.reload();
}
