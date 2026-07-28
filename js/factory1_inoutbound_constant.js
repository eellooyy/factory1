/* factory1_inoutbound_constant.js — 1공장 입출고 내역 상수
   ────────────────────────────────────────────────────────────────
   공정 PC 의 Access DB(\\192.168.0.229\지고\Dongjin.mdb)가 받아 적은
   바코드 스캔 기록입니다. 사람이 입력하는 값이 하나도 없는 조회 전용 화면.

   [한 화면에서 입고/출고를 바꿔 봅니다]
     둘은 열 구성도 읽는 법도 같아서 따로 세워 둘 이유가 없습니다.
     우측 스위처로 방향만 바꿉니다. 한 번 조회할 때 입고·출고를 같이
     받아 두므로 스위처를 눌러도 다시 조회하지 않습니다.

   [입고는 층을 나누지 않습니다]
     B5 와 B6 는 스캔 테이블이 둘로 나뉘어 있을 뿐 같은 입고입니다.
     화면에서는 한 표로 합치고, 5층(B5)에서 들어온 행만 배경색과 우측
     '5층 입고' 태그로 구분합니다.

   [화면에는 걸러진 값만 옵니다]
     상세 표는 원본이 아니라 해석이 끝난 값입니다. 오독 규칙으로 되살린
     행도 되살린 값 그대로 들어갑니다 — 원본을 늘어놓으면 사람이 매번
     60=62, 4372=1404 를 암산해야 하기 때문입니다. 되살리지 못한 행은
     지우지 않고 아래 '확인 필요'로 보냅니다. 그 건수가 곧 "오늘 스캔이
     얼마나 깨졌나"이고, 인식 불가 롤도 물건은 실제로 들어왔습니다.

   [시각을 절대 변환하지 말 것]
     created_at 은 한국시간 벽시계 값이 timestamptz 에 +00 으로 들어가
     있습니다. timezone 변환을 태우면 야간 출고가 하루씩 밀립니다.
     문자열을 그대로 잘라 씁니다. (api.js 의 dayRange / timeOf)
   ──────────────────────────────────────────────────────────────── */
(function () {
    'use strict';

    window.Factory1Inoutbound = {
        SUPABASE_URL: 'https://npiflqoscsvnnauvqhrr.supabase.co',
        SUPABASE_KEY: 'sb_publishable_ir-mHSsX6SSIQwHerkLbfA_2qCOP3KW',

        /* ── 방향 ─────────────────────────────────────────────────
           원본 테이블은 백업 스크립트(C:\AutoRun\factory1_io_supabase_backup.pyw)가
           최근 7일을 delete + insert 합니다. 컬럼은 Access 이름만 바꿔 그대로입니다.
             DTime→created_at, Make→manufacturer, A/D_ITEM→item_type,
             RollNo→roll_number, Weigh→weight, Code→product_code

           ※ 해석은 아직 화면(api.js)이 합니다. 규칙이 굳으면
             factory1_barcode_rule + v_factory1_io_normalized 로 옮기고
             api.js 는 뷰 한 번 읽는 것으로 줄어듭니다. 지금 뷰로 못 옮기는
             이유는 규칙이 아직 안 끝났기 때문입니다(7534 · 특수문자).
             원본 테이블은 어느 쪽이든 손대지 않습니다.
           ──────────────────────────────────────────────────────── */
        DIRECTIONS: [
            {
                key: 'in', label: '입고',
                tables: [
                    { name: 'factory1_inbound_b5', floor: 'B5' },
                    { name: 'factory1_inbound_b6', floor: 'B6' }
                ]
            },
            {
                key: 'out', label: '출고',
                tables: [
                    { name: 'factory1_outbound_b6', floor: 'B6' }
                ]
            }
        ],

        /* ── 상세 표 열 ───────────────────────────────────────────
           단 헤더입니다. HTML 의 colgroup / thead 와 짝이 맞아야 하므로
           열을 넣거나 뺄 때는 factory1_inoutbound.html 도 같이 고쳐야 합니다.
           ──────────────────────────────────────────────────────── */
        COLUMNS: [
            { key: 'time',        label: '시간',     cls: 'f1iob-time' },
            { key: 'vendor',      label: '회사',     cls: 'f1iob-center' },
            { key: 'grade',       label: '권종',     cls: 'f1iob-center' },
            { key: 'rollNumber',  label: 'RollNo',   cls: 'f1iob-code' },
            { key: 'weight',      label: '중량',     cls: 'f1iob-num' },
            { key: 'productCode', label: '물류코드', cls: 'f1iob-code' }
        ],

        /* '확인 필요' 표 열 — 위 6열과 자리를 맞추되 두 가지가 다릅니다.
           ① 맨 앞에 '구분'(입고 B5 / 입고 B6 / 출고 B6) — 어디서 온 행인지
              모르면 손을 댈 수가 없습니다.
           ② '회사' 자리에 원본 '제조사코드' — 해석이 안 된 행이라 회사가
              비어 있습니다. 판단 근거가 되는 원본 코드를 그 자리에 둡니다. */
        REVIEW_COLUMNS: [
            { key: 'origin',       label: '구분',       cls: 'f1iob-center f1iob-origin' },
            { key: 'time',         label: '시간',       cls: 'f1iob-time' },
            { key: 'manufacturer', label: '제조사코드', cls: 'f1iob-code' },
            { key: 'itemType',     label: '권종',       cls: 'f1iob-center' },
            { key: 'rollNumber',   label: 'RollNo',     cls: 'f1iob-code' },
            { key: 'weight',       label: '중량',       cls: 'f1iob-num' },
            { key: 'productCode',  label: '물류코드',   cls: 'f1iob-code' }
        ],

        /* ── 품목별 롤 수 요약 ────────────────────────────────────
           표 우측에 표와 높이를 맞춘 칸으로 섭니다.

           **순서는 고정입니다.** 지고 재고·입고·사용량 화면의 열 순서와 같게
           맞췄고, 롤 수가 많은 순으로 재배치하지 않습니다. 화면들을 나란히
           놓고 같은 자리에서 같은 품목을 읽는 것이 목적이기 때문입니다.
           같은 이유로 그날 0롤인 품목도 줄을 지킵니다 — 줄이 사라지면
           "대한 D 가 오늘 안 들어왔다"가 보이지 않습니다.

           ※ 전주는 본지(자사)와 전자(사급)가 바코드에 구분되지 않습니다.
             급지의 jj_1404 / jj_702 와 같은 상황이라 여기서도 '전주'까지만
             갈립니다. 회계용 분리는 factory1_geupji_alloc 이 따로 합니다.
           ※ F.T(1337)는 2026-06-29~07-28 실데이터에 한 건도 없습니다.
             엑셀 시절 스크립트에 규칙이 있어 줄만 남겨 둡니다.
           ──────────────────────────────────────────────────────── */
        // 요약에 세울 품목 — 목록·순서·급지 매핑은 공용 모듈이 갖고 있습니다
        ITEMS: window.Factory1Barcode.ITEMS,

        /* ── 바코드 해석 ──────────────────────────────────────────
           제조사 코드 · 중량 → 품목 규칙과 오독 보정은 전부
           `js/factory1_barcode.js` 에 있습니다. 급지 재고 페이지의
           '전산 출고' 열이 같은 파일을 쓰기 때문입니다 — 규칙을 두 벌 두면
           두 화면의 숫자가 조용히 갈라집니다.
           ──────────────────────────────────────────────────────── */


        // '확인 필요' 표의 '구분' 열에 찍히는 이름
        ORIGIN_LABEL: { 'in|B5': '입고 B5', 'in|B6': '입고 B6', 'out|B6': '출고 B6' },

        // 5층 입고 태그 — 이 층에서 들어온 롤만 따로 셉니다
        FLOOR_TAG: { floor: 'B5', label: '5층 입고' },

        /* ── 급지 재고에서 손댄 전산 출고 ─────────────────────────
           급지 재고 페이지에서 전산 출고를 수기로 고치면 그 사실을 이 화면의
           요약에도 알려 줍니다. **숫자는 바꾸지 않습니다.**

           이 화면이 보여주는 것은 "스캐너가 무엇을 찍었나"라는 관측 기록이고,
           급지에서 고친 값은 "실제로는 몇 롤이었나"라는 사람의 판단입니다.
           층위가 다릅니다. 관측값에 판단을 섞으면 원본을 볼 곳이 사라지고,
           무엇보다 전산 출고를 만든 이유(계산 출고와 출처가 다르다)가 무너집니다
           — 두 숫자가 같이 움직이면 "둘 다 틀리면 실사 문제, 하나만 틀리면
           그쪽 문제"라는 판별을 할 수 없습니다.

           그래서 스캔 롤 수는 그대로 두고 '급지에서 N롤로 고침'과 그 메모만
           품목 줄 아래에 덧붙입니다. 입고에는 해당이 없어 출고에서만 나옵니다.
           ──────────────────────────────────────────────────────── */
        GEUPJI_ISSUE_TABLE: 'factory1_geupji_issue',

        state: {
            // 조회 기준일 (공통 헤더의 날짜 네비게이션과 동기화)
            currentDate: null,
            isLoading: false,

            // 화면에 띄운 방향 — 'in' | 'out'. 스위처가 바꿉니다.
            direction: 'in',

            /* 해석이 끝난 행 — rows.in / rows.out
               한 날짜를 조회할 때 세 테이블을 모두 받아 둘 다 채웁니다.
               '확인 필요'는 따로 담지 않고 여기서 status === 'none' 인 행을
               뽑아 씁니다. 같은 데이터를 두 벌 들고 있으면 반드시 갈라집니다. */
            rows: { in: [], out: [] },

            /* 급지 재고에서 손댄 전산 출고 — sysManual[품목키] = { roll, memo }
               표시용일 뿐이라 표와 요약의 숫자에는 들어가지 않습니다. */
            sysManual: {}
        },

        elements: {
            wrapper: null,
            title: null,
            basedate: null,
            switcher: null
        }
    };

})();
