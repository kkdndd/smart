# 대교홀딩스 SMART 사업계획 관리 시스템

## 구성
- 프론트엔드: 정적 HTML/CSS(Tailwind CDN)/JS, 프레임워크 없음
- 백엔드/DB/인증/파일저장: Supabase (project ref: cbvjjocihktcbvfqsbyq, region: ap-northeast-2)
- 배포: Cloudflare Pages (정적 호스팅)

## 로컬에서 미리보기
이 폴더(web/)를 그대로 정적 서버로 띄우면 됩니다. 예:
```
npx serve .
```

## Cloudflare Pages 배포 방법
### 방법 A: Git 연동 (권장)
1. 이 web/ 폴더를 GitHub(또는 GitLab) 저장소로 push
2. Cloudflare 대시보드 → Workers & Pages → Create → Pages → Connect to Git
3. 빌드 설정: Build command 없음(정적 파일), Build output directory: `/` (web 폴더 자체가 루트)
4. 배포 후 `*.pages.dev` 주소가 발급되며, 이후 저장소에 push할 때마다 자동 재배포됩니다.

### 방법 B: 직접 업로드
1. Cloudflare 대시보드 → Workers & Pages → Create → Pages → Upload assets
2. web/ 폴더 전체를 업로드

도메인은 별도로 없으므로 우선 `*.pages.dev` 기본 주소를 사용하고, 추후 커스텀 도메인을 연결할 수 있습니다.

## 초기 계정 세팅 (최초 1회, 관리자 작업)
1. Supabase 대시보드 → Authentication → Users → Invite user 로 @daekyo.co.kr 이메일 초대
   (이 시스템은 auth.users insert 시 도메인이 @daekyo.co.kr 가 아니면 자동으로 거부되도록 DB 트리거가 설정되어 있습니다)
2. 초대받은 사용자는 이메일의 링크로 비밀번호를 설정 후 로그인
3. **최초 관리자 부트스트랩**: 처음에는 아무도 지주사 권한(holdco_staff)이 없으므로, 최소 1명은
   Supabase SQL Editor에서 아래 SQL을 직접 실행해 지주사 관리자로 승격해야 합니다.
   ```sql
   update profiles set role = 'holdco_staff', company_id = null
   where email = '최초관리자@daekyo.co.kr';
   ```
4. 이후부터는 이 관리자가 `admin.html` (계정 관리) 화면에서 다른 사용자의 소속 계열사/역할/담당 사업부를 지정할 수 있습니다.

## 권한 구조 (지주사 - 계열사 - 사업부 3단계)

| 역할 | 조회 범위 | 주요 권한 |
| --- | --- | --- |
| 사업부 담당자 (`bu_staff`) | 배정된 사업부만 | 목표 작성 → 계열사 검토 제출, 실적 입력 |
| 계열사 담당자 (`company_staff`) | 자기 회사 전체 사업부 | 사업부 제출 목표 검토(승인/수정요청), 전사 목표 직접 작성, 사업부 등록·병합 |
| 지주사 담당자 (`holdco_staff`) | 전 계열사 | 최종 승인/반려, 계정·권한 관리(유일), 사업부 관리 |
| 지주사 경영진 (`holdco_exec`) | 전 계열사 | 조회 전용 |

- 계정·권한 배정(역할 지정, 사업부 배정)은 **지주사 담당자만** 가능합니다. (`profile_business_units` 테이블 RLS로 강제)
- 사업부 담당자는 겸직이 가능하며, 여러 사업부를 배정받을 수 있습니다.

### 목표 결재 흐름
```
사업부 담당자 작성 → [임시저장]
      ↓ 계열사 검토 제출
[계열사 검토중] ── 수정요청 → [수정요청] (사업부가 수정 후 재제출)
      ↓ 계열사 승인
[지주사 검토중] ── 수정요청/반려 → [수정요청] / [임시저장]
      ↓ 지주사 최종 승인
[승인완료]
```
- 계열사 담당자가 직접 작성한 목표는 제출 시 곧바로 `지주사 검토중` 상태가 됩니다.
- 월별/분기별 **진행실적 입력은 별도 결재 없이** 입력 즉시 반영됩니다.

### 사업부 중복 등록 방지
- `business_units`에 공백·대소문자를 무시한 정규화 이름(`name_norm`) 기준 회사별 유니크 인덱스가 걸려 있어,
  "온채널"과 "온 채널"처럼 표기만 다른 중복 등록이 DB 레벨에서 차단됩니다.
- 이미 생긴 중복은 `business-units.html`(사업부 관리)의 **병합** 기능으로 정리할 수 있습니다.
  병합 시 해당 사업부의 목표와 담당자 배정이 대상 사업부로 모두 이관됩니다. (`merge_business_unit` RPC)

## 남은 작업 (요청 시 이어서 진행)
- 미제출/지연 알림 이메일 발송: Resend 등 이메일 발송 서비스의 API 키 필요 (Supabase Edge Function + pg_cron 조합으로 구현 예정)
- PDF 내보내기의 한글 폰트: 현재 jsPDF 기본 폰트는 한글을 지원하지 않아 한글이 깨질 수 있습니다.
  나눔고딕 등 한글 폰트를 base64로 임베드하는 추가 작업이 필요합니다.
