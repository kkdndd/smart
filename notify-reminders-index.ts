// Supabase Edge Function: notify-reminders
// 매일 pg_cron으로 호출되어, 마감일(월별: 다음달 말일 / 분기별: 분기 종료월의 다음달 말일)이
// 지났는데도 실적이 미입력된 KPI에 대해 해당 계열사 담당자들에게 Resend를 통해 이메일 알림을 보낸다.

import { createClient } from "jsr:@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const CRON_SECRET = Deno.env.get("CRON_SECRET")!;
const FROM_EMAIL = Deno.env.get("NOTIFY_FROM_EMAIL") || "onboarding@resend.dev";
const APP_URL = Deno.env.get("APP_URL") || "https://smart.jini0828.workers.dev";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

function pad2(n: number) { return String(n).padStart(2, "0"); }

// 연도 기준 월별/분기별 period 문자열 목록 생성 (js/common.js의 periodsForYear와 동일한 규칙)
function periodsForYear(year: number, periodType: string): string[] {
  if (periodType === "quarterly") {
    return [1, 2, 3, 4].map(q => `${year}-Q${q}`);
  }
  return Array.from({ length: 12 }, (_, i) => `${year}-${pad2(i + 1)}`);
}

// 해당 기간(월/분기) 실적의 입력 마감일 계산 (js/common.js의 periodDeadline과 동일한 규칙)
// 월별: 해당 월의 다음 달 말일까지 / 분기별: 분기 종료월의 다음 달 말일까지
function periodDeadline(period: string, periodType: string): Date {
  const year = parseInt(period.slice(0, 4), 10);
  let endMonth: number;
  if (periodType === "quarterly") {
    const q = parseInt(period.replace(/^\d{4}-Q/, ""), 10);
    endMonth = q * 3;
  } else {
    endMonth = parseInt(period.slice(5, 7), 10);
  }
  return new Date(year, endMonth + 1, 0, 23, 59, 59, 999);
}

async function sendEmail(to: string, subject: string, html: string) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ from: FROM_EMAIL, to: [to], subject, html })
  });
  if (!res.ok) {
    const body = await res.text();
    console.error(`Resend 발송 실패 (${to}):`, res.status, body);
    return false;
  }
  return true;
}

Deno.serve(async (req: Request) => {
  const secret = req.headers.get("x-cron-secret");
  if (secret !== CRON_SECRET) {
    return new Response("unauthorized", { status: 401 });
  }

  const now = new Date();

  const { data: goals, error: goalsErr } = await supabase
    .from("goals")
    .select("id, company_id, year, strategy_name, status, companies:company_id(name)")
    .in("status", ["approved", "locked"]);
  if (goalsErr) {
    console.error(goalsErr);
    return new Response("goals query failed", { status: 500 });
  }

  const goalIds = (goals || []).map(g => g.id);
  if (goalIds.length === 0) return new Response("ok: no approved goals", { status: 200 });

  const { data: metrics, error: metricsErr } = await supabase
    .from("goal_metrics")
    .select("id, goal_id, metric_name, metric_type, period_type")
    .in("goal_id", goalIds);
  if (metricsErr) {
    console.error(metricsErr);
    return new Response("metrics query failed", { status: 500 });
  }

  const metricIds = (metrics || []).map(m => m.id);
  let entriesByKey: Record<string, { actual_value: number | null; milestone_achieved: boolean | null }> = {};
  if (metricIds.length > 0) {
    const { data: entries, error: entriesErr } = await supabase
      .from("progress_entries")
      .select("goal_metric_id, period, actual_value, milestone_achieved")
      .in("goal_metric_id", metricIds);
    if (entriesErr) {
      console.error(entriesErr);
      return new Response("progress_entries query failed", { status: 500 });
    }
    (entries || []).forEach(e => { entriesByKey[`${e.goal_metric_id}|${e.period}`] = e; });
  }

  const goalsById = Object.fromEntries((goals || []).map(g => [g.id, g]));
  let notifiedCount = 0;

  for (const metric of metrics || []) {
    const goal = goalsById[metric.goal_id];
    if (!goal) continue;

    // 마감일이 지났는데도 실적이 입력되지 않은 기간을 모두 찾는다 (밀린 건이 여러 개 쌓여있을 수 있음)
    const overduePeriods = periodsForYear(goal.year, metric.period_type).filter(period => {
      if (periodDeadline(period, metric.period_type) >= now) return false; // 아직 마감 전
      const entry = entriesByKey[`${metric.id}|${period}`];
      const hasRealEntry = !!entry && (entry.actual_value !== null || entry.milestone_achieved !== null);
      return !hasRealEntry;
    });

    for (const period of overduePeriods) {
      const notifType = `overdue:${metric.id}`;

      // 이미 이 지표+기간에 대해 알림을 보낸 적이 있는지 확인
      const { data: alreadySent } = await supabase
        .from("notification_log")
        .select("id")
        .eq("notif_type", notifType)
        .eq("period", period)
        .limit(1);
      if (alreadySent && alreadySent.length > 0) continue;

      // 해당 계열사 담당자 조회
      const { data: staff } = await supabase
        .from("profiles")
        .select("email, name")
        .eq("company_id", goal.company_id)
        .eq("role", "company_staff");

      if (!staff || staff.length === 0) continue;

      const subject = `[대교홀딩스 SMART] ${goal.companies?.name || ""} - ${period} 실적 미입력 안내`;
      const html = `
        <p>안녕하세요, ${goal.companies?.name || ""} 담당자님.</p>
        <p><b>${goal.strategy_name}</b> 목표의 지표 <b>${metric.metric_name}</b>에 대해
        <b>${period}</b> 실적 입력 마감일이 지났습니다.</p>
        <p>아래 링크에서 실적을 입력해주세요.</p>
        <p><a href="${APP_URL}/progress.html?goal=${goal.id}">${APP_URL}/progress.html?goal=${goal.id}</a></p>
        <p>감사합니다.</p>`;

      for (const person of staff) {
        const ok = await sendEmail(person.email, subject, html);
        await supabase.from("notification_log").insert({
          user_id: null,
          notif_type: notifType,
          period,
          sent_at: new Date().toISOString()
        });
        if (ok) notifiedCount++;
      }
    }
  }

  return new Response(`ok: ${notifiedCount}건 알림 발송`, { status: 200 });
});
