// 상단 네비게이션 렌더링
function renderNav(profile, active) {
  const links = [
    { href: "dashboard.html", label: "대시보드", key: "dashboard" },
    { href: "goals.html", label: "사업계획 목표", key: "goals" },
    { href: "progress.html", label: "진행실적 입력", key: "progress" },
  ];
  if (isHoldco(profile)) {
    links.push({ href: "review.html", label: "검토/승인", key: "review" });
    links.push({ href: "change-requests.html", label: "변경요청 관리", key: "cr" });
  } else {
    links.push({ href: "change-requests.html", label: "목표 변경요청", key: "cr" });
  }
  if (isHoldcoEditor(profile)) {
    links.push({ href: "admin.html", label: "계정 관리", key: "admin" });
  }

  const navHtml = `
  <nav class="bg-slate-800 text-white">
    <div class="max-w-6xl mx-auto px-4 flex items-center justify-between h-14">
      <div class="flex items-center gap-6">
        <span class="font-bold">대교홀딩스 SMART</span>
        <div class="hidden md:flex gap-4 text-sm">
          ${links.map(l => `<a href="${l.href}" class="${active===l.key ? 'text-white font-semibold' : 'text-slate-300 hover:text-white'}">${l.label}</a>`).join("")}
        </div>
      </div>
      <div class="flex items-center gap-3 text-sm">
        <span class="text-slate-300">${escapeHtml(profile.name || profile.email)} · ${escapeHtml(profile.companies ? profile.companies.name : '지주사')} · ${roleLabel(profile.role)}</span>
        <button onclick="signOutAndRedirect()" class="bg-slate-700 hover:bg-slate-600 rounded px-3 py-1">로그아웃</button>
      </div>
    </div>
    <div class="md:hidden flex gap-3 overflow-x-auto px-4 pb-2 text-sm">
      ${links.map(l => `<a href="${l.href}" class="${active===l.key ? 'text-white font-semibold' : 'text-slate-300'}">${l.label}</a>`).join("")}
    </div>
  </nav>`;
  document.getElementById("nav-root").innerHTML = navHtml;
}

function roleLabel(role) {
  return { company_staff: "계열사 담당자", holdco_staff: "지주사 담당자/관리자", holdco_exec: "지주사 경영진(조회)" }[role] || role;
}
