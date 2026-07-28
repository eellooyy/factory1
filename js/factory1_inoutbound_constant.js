/* factory1_inoutbound_constant.js — 1공장 전산 입출고 상세 내역 상수
   ────────────────────────────────────────────────────────────────
   공정 PC 의 Access DB(\\192.168.0.229\지고\Dongjin.mdb)가 받아 적은
   바코드 스캔 기록입니다. 사람이 입력하는 값이 하나도 없는 조회 전용 화면.

   [화면에는 걸러진 값만 옵니다]
     1층 입고 · 2층 출고 표는 **원본이 아니라 해석이 끝난 값**을 보여줍니다.
     오독 규칙으로 되살린 행도 되살린 값 그대로 들어갑니다. 원본을 그대로
     늘어놓으면 사람이 매번 60=62, 4372=1404 를 암산해야 하기 때문입니다.
     대신 되살리지 못한 행은 지우지 않고 3층으로 보냅니다 — 그 건수가 곧
     "오늘 스캔이 얼마나 깨졌나" 이고, 사람이 보고 정해야 할 몫입니다.

   [입고는 층을 나누지 않습니다]
     B5 와 B6 는 스캔 테이블이 둘로 나뉘어 있을 뿐 같은 입고입니다.
     화면에서는 하나로 합치고, 어느 층 것인지는 행의 floor 값으로만
     남깁니다. 3층 '확인 필요' 표에서만 구분 열로 드러납니다.

   [정제는 여기가 아니라 뷰에서]
     오독값 자체가 "어떤 롤이 잘못 기록됐나"를 실재고와 대조할 근거라
     원본 테이블을 지우면 안 됩니다. 규칙도 아직 안 끝났습니다(7534 · 특수문자).
     원본 3테이블은 그대로 두고 해석은 `v_factory1_io_normalized` 가 맡습니다.

   [시각을 절대 변환하지 말 것]
     created_at 은 한국시간 벽시계 값이 timestamptz 에 +00 으로 들어가
     있습니다. timezone 변환을 태우면 야간 출고가 하루씩 밀립니다.
     문자열을 그대로 잘라 씁니다.
   ──────────────────────────────────────────────────────────────── */
(function () {
    'use strict';

    window.Factory1Inoutbound = {
        SUPABASE_URL: 'https://npiflqoscsvnnauvqhrr.supabase.co',
        SUPABASE_KEY: 'sb_publishable_ir-mHSsX6SSIQwHerkLbfA_2qCOP3KW',

        /* ── DB ───────────────────────────────────────────────────
           원본 3테이블은 백업 스크립트(C:\AutoRun\factory1_io_supabase_backup.pyw)가
           최근 7일을 delete + insert 합니다. 컬럼은 Access 이름만 바꿔 그대로입니다.
             DTime→created_at, Make→manufacturer, A/D_ITEM→item_type,
             RollNo→roll_number, Weigh→weight, Code→product_code

           ※ 2026-07-09 이후 백업이 멈춰 있습니다. 테이블·컬럼 테스트용으로만
             돌린 것이라 고장이 아닙니다.

           화면은 원본이 아니라 VIEW 를 읽습니다. VIEW 가 생기기 전까지는
           USE_SAMPLE_DATA 로 버팁니다.
           ──────────────────────────────────────────────────────── */
        TABLES: {
            IN_B5:  'factory1_inbound_b5',
            IN_B6:  'factory1_inbound_b6',
            OUT_B6: 'factory1_outbound_b6'
        },

        // 해석 뷰 / 규칙 테이블 — 아직 만들지 않았습니다 (api.js 와 함께 붙입니다)
        VIEW: null,        // 예) 'v_factory1_io_normalized'
        RULE_TABLE: null,  // 예) 'factory1_barcode_rule'

        // 화면 확인용 임시 행 사용 여부 (DB 연결 시 false 로 변경)
        USE_SAMPLE_DATA: true,

        /* ── 층 구성 ──────────────────────────────────────────────
           1층 입고 · 2층 출고 · 3층 확인 필요, 세 층입니다.

           1·2층은 좌우 두 칸입니다. 좌측이 상세 표, 우측이 품목별 롤 수
           요약이고 두 칸의 높이를 맞춰 세웁니다. 요약을 표 위에 띠로 깔면
           표를 볼 때마다 눈이 아래위로 뛰지만, 옆에 붙여 두면 상세와 합계를
           한 눈에 같이 읽을 수 있습니다.
           ──────────────────────────────────────────────────────── */
        SECTIONS: [
            {
                key: 'in', dir: 'in',
                title: '입고', subtitle: 'B5 · B6 합산',
                bodyId: 'f1iobInBody', sideId: 'f1iobInSide'
            },
            {
                key: 'out', dir: 'out',
                title: '출고', subtitle: 'B6',
                bodyId: 'f1iobOutBody', sideId: 'f1iobOutSide'
            }
        ],

        // 3층 — 자동 해석이 안 된 행. 입고·출고를 한 표에 모읍니다.
        REVIEW: { bodyId: 'f1iobReviewBody', countId: 'f1iobReviewCount' },

        /* ── 상세 표 열 ───────────────────────────────────────────
           1층·2층 공통. 단 헤더입니다(2레벨 아님).
           HTML 의 colgroup / thead 와 짝이 맞아야 하므로 열을 넣거나 뺄 때는
           factory1_inoutbound.html 의 두 표를 같이 고쳐야 합니다.
           ──────────────────────────────────────────────────────── */
        COLUMNS: [
            { key: 'time',        label: '시간',     cls: 'f1iob-time' },
            { key: 'vendor',      label: '회사',     cls: 'f1iob-center' },
            { key: 'grade',       label: '권종',     cls: 'f1iob-center' },
            { key: 'rollNumber',  label: 'RollNo',   cls: 'f1iob-code' },
            { key: 'weight',      label: '중량',     cls: 'f1iob-num' },
            { key: 'productCode', label: '물류코드', cls: 'f1iob-code' }
        ],

        /* 3층 열 — 위 6열과 자리를 맞추되 두 가지가 다릅니다.
           ① 맨 앞에 '구분'(입고 B5 / 입고 B6 / 출고 B6) — 한 표에 섞여 있어
              어디서 온 행인지 모르면 손을 댈 수가 없습니다.
           ② '회사' 자리에 원본 '제조사코드' — 해석이 안 된 행이라 회사가
              비어 있습니다. 판단 근거가 되는 원본 코드를 그 자리에 둡니다. */
        REVIEW_COLUMNS: [
            { key: 'origin',       label: '구분',       cls: 'f1iob-center f1iob-origin' },
            { key: 'time',         label: '시간',       cls: 'f1iob-time' },
            { key: 'manufacturer', label: '제조사코드', cls: 'f1iob-code' },
            { key: 'grade',        label: '권종',       cls: 'f1iob-center' },
            { key: 'rollNumber',   label: 'RollNo',     cls: 'f1iob-code' },
            { key: 'weight',       label: '중량',       cls: 'f1iob-num' },
            { key: 'productCode',  label: '물류코드',   cls: 'f1iob-code' }
        ],

        /* ── 품목별 롤 수 요약 ────────────────────────────────────
           각 층 표 **우측**에 표와 높이를 맞춘 칸으로 섭니다.
           "대한1576 18롤" 처럼 그날 몇 롤이 오갔는지만 봅니다.

           **순서는 고정입니다.** 지고 재고·입고·사용량 화면의 열 순서와 같게
           맞췄고, 롤 수가 많은 순으로 재배치하지 않습니다. 화면들을 나란히
           놓고 같은 자리에서 같은 품목을 읽는 것이 목적이기 때문입니다.
           같은 이유로 그날 0롤인 품목도 자리를 비워 두고 옅게 표시합니다 —
           칩이 사라져 버리면 "대한 D 가 오늘 안 들어왔다"가 보이지 않습니다.

           ※ 전주는 본지(자사)와 전자(사급)가 바코드에 구분되지 않습니다.
             급지의 jj_1404 / jj_702 와 같은 상황이라 여기서도 '전주'까지만
             갈립니다. 회계용 분리는 factory1_geupji_alloc 이 따로 합니다.
           ──────────────────────────────────────────────────────── */
        ITEMS: [
            { key: 'daehan_1576', label: '대한1576',  grade: 'A권' },
            { key: 'daehan_788',  label: '대한788',   grade: 'D권' },
            { key: 'paper_1576',  label: '페이퍼1576', grade: 'A권' },
            { key: 'jeonju_1576', label: '전주1576',  grade: 'A권' },
            { key: 'jeonju_788',  label: '전주788',   grade: 'D권' },
            { key: 'daehan_1182', label: '대한1182',  grade: 'C권' },
            { key: 'daehan_488',  label: '48.8g',     grade: 'A권' }
        ],

        /* ── 해석 상태 ────────────────────────────────────────────
           뷰가 행마다 이 셋 중 하나를 내려줍니다. 화면은 판정하지 않습니다.
             ok    정상 — 바코드가 그대로 읽혔습니다
             fixed 오독 보정 — 규칙(60→62, 11→10, 4372→1404, 2443→702)으로
                   품목까지 되살린 행. 1·2층 표에는 되살린 값으로 들어갑니다.
             none  미해석 — 규칙에 없는 조합(11/7534/0133), 통신 오류로 특수문자가
                   들어온 행('7?'), B5 의 0000/000/00 인식 불가 롤. **3층으로 갑니다.**
                   인식 불가 롤도 물건은 실제로 들어왔습니다. 행을 지우면 입고량이
                   줄어드니 롤 수는 세되 품목만 미상으로 둡니다.

           ※ 상태별 건수를 따로 모아 보여주는 칸은 두지 않습니다. 오독 보정은
             1·2층 표에 되살린 값으로 이미 반영되어 있고, 사람이 손대야 하는
             몫은 3층 '확인 필요'의 행 수가 그대로 말해 줍니다.
           ──────────────────────────────────────────────────────── */
        STATUS_KEYS: ['ok', 'fixed', 'none'],

        // 3층 '구분' 열에 찍히는 이름
        ORIGIN_LABEL: { 'in|B5': '입고 B5', 'in|B6': '입고 B6', 'out|B6': '출고 B6' },

        /* ── 화면 확인용 임시 행 ──────────────────────────────────
           DB 연결 전까지만 씁니다(USE_SAMPLE_DATA). 실측 분포를 본떴습니다.
             입고 — 오류가 거의 없습니다(B6 535건 중 0건). B5 의 인식 불가 롤만 섞임
             출고 — 전주 98.5% · 페이퍼 87% 가 깨집니다. 대한은 100% 정상

           행 모양이 곧 뷰가 내려줄 모양입니다.
             floor        원본 테이블 구분 ('B5' | 'B6') — 화면에 열로 두지 않습니다
             vendor/grade 해석된 회사·권종 (오독 보정 행은 되살린 값)
             itemKey      ITEMS 의 key — 품목별 롤 수 요약이 이걸로 셉니다
             rawRoll      보정 전 원본 RollNo. 보정한 행에만 있습니다
                          (표에서 마우스를 올리면 원본이 보입니다)
           ──────────────────────────────────────────────────────── */
        SAMPLE: {
            in: [
                { floor: 'B5', time: '06:41:22', manufacturer: '73', vendor: '대한제지',    grade: 'A권', rollNumber: '73051204',  weight: 1404, productCode: 'DH1576A', itemKey: 'daehan_1576', status: 'ok' },
                { floor: 'B5', time: '06:44:05', manufacturer: '73', vendor: '대한제지',    grade: 'A권', rollNumber: '73051205',  weight: 1404, productCode: 'DH1576A', itemKey: 'daehan_1576', status: 'ok' },
                { floor: 'B5', time: '07:02:53', manufacturer: '10', vendor: '전주제지',    grade: 'A권', rollNumber: '10233871',  weight: 1404, productCode: 'JJ1576',  itemKey: 'jeonju_1576', status: 'ok' },
                // B5 의 0000 / 000 / 00 — 바코드 인식 불가. 물건은 들어왔습니다
                { floor: 'B5', time: '07:05:11', manufacturer: '0000', vendor: '',          grade: '',    rollNumber: '000',       weight: null, productCode: '00',      itemKey: null,          status: 'none' },
                { floor: 'B5', time: '07:18:37', manufacturer: '62', vendor: '페이퍼코리아', grade: 'A권', rollNumber: '605180278', weight: 1404, productCode: 'PK1576',  itemKey: 'paper_1576',  status: 'ok' },
                { floor: 'B6', time: '08:12:09', manufacturer: '73', vendor: '대한제지',    grade: 'A권', rollNumber: '73051330',  weight: 1404, productCode: 'DH1576A', itemKey: 'daehan_1576', status: 'ok' },
                { floor: 'B6', time: '08:14:41', manufacturer: '73', vendor: '대한제지',    grade: 'D권', rollNumber: '73088102',  weight: 702,  productCode: 'DH0788D', itemKey: 'daehan_788',  status: 'ok' },
                { floor: 'B6', time: '08:31:26', manufacturer: '10', vendor: '전주제지',    grade: 'A권', rollNumber: '10233902',  weight: 1404, productCode: 'JJ1576',  itemKey: 'jeonju_1576', status: 'ok' },
                { floor: 'B6', time: '08:33:58', manufacturer: '62', vendor: '페이퍼코리아', grade: 'A권', rollNumber: '605180301', weight: 1404, productCode: 'PK1576',  itemKey: 'paper_1576',  status: 'ok' },
                { floor: 'B6', time: '08:47:02', manufacturer: '73', vendor: '대한제지',    grade: 'A권', rollNumber: '73051341',  weight: 1404, productCode: 'DH1576A', itemKey: 'daehan_1576', status: 'ok' },
                // 1405 = 48.8g(나라사랑). 월 1회 제작이라 평소에는 0롤입니다
                { floor: 'B6', time: '09:02:14', manufacturer: '73', vendor: '대한제지',    grade: 'A권', rollNumber: '73140502',  weight: 1405, productCode: 'DH0488',  itemKey: 'daehan_488',  status: 'ok' }
            ],
            out: [
                { floor: 'B6', time: '17:22:40', manufacturer: '73', vendor: '대한제지',    grade: 'A권', rollNumber: '73051188',  weight: 1404, productCode: 'DH1576A', itemKey: 'daehan_1576', status: 'ok' },
                /* 11 은 10(전주)의 오독, 4372 는 1404 의 오독입니다. 롤번호도 앞자리가
                   11 로 찍혀 들어와 10 으로 되돌립니다(11233871 → 10233871).
                   입고 A:D 가 93:7 인데 출고 오독 4372:2443 도 92:8 이라 이 매핑이
                   우연이 아님을 뒷받침합니다. */
                { floor: 'B6', time: '17:25:03', manufacturer: '11', vendor: '전주제지',    grade: 'A권', rollNumber: '10233871',  weight: 1404, productCode: 'JJ1576',  itemKey: 'jeonju_1576', status: 'fixed', rawRoll: '11233871' },
                { floor: 'B6', time: '17:29:47', manufacturer: '11', vendor: '전주제지',    grade: 'D권', rollNumber: '10088440',  weight: 702,  productCode: 'JJ0788',  itemKey: 'jeonju_788',  status: 'fixed', rawRoll: '11088440' },
                /* 60 은 62(페이퍼)의 오독입니다. 뒷 내용이 통째로 깨져 중량·물류코드가
                   비고 규격도 A권이어야 할 것이 D권으로 옵니다. 롤번호는 입고값에서
                   앞 두 자리 60 이 빠지고 중간에 9 가 낍니다(605180278 → 51890278).
                   확인한 8쌍이 전부 이 모양이라 거꾸로 되돌릴 수 있습니다. */
                { floor: 'B6', time: '17:33:12', manufacturer: '60', vendor: '페이퍼코리아', grade: 'A권', rollNumber: '605180278', weight: 1404, productCode: 'PK1576',  itemKey: 'paper_1576',  status: 'fixed', rawRoll: '51890278' },
                { floor: 'B6', time: '17:38:20', manufacturer: '73', vendor: '대한제지',    grade: 'D권', rollNumber: '73088077',  weight: 702,  productCode: 'DH0788D', itemKey: 'daehan_788',  status: 'ok' },
                // 규칙에 없는 조합 — 7534 가 무엇인지 아직 모릅니다
                { floor: 'B6', time: '17:41:55', manufacturer: '11', vendor: '',            grade: '',    rollNumber: '0133',      weight: 7534, productCode: '',        itemKey: null,          status: 'none' },
                // 통신 오류로 특수문자가 그대로 들어온 행
                { floor: 'B6', time: '18:06:31', manufacturer: '7?', vendor: '',            grade: '',    rollNumber: '',          weight: null, productCode: '',        itemKey: null,          status: 'none' }
            ]
        },

        state: {
            // 조회 기준일 (공통 헤더의 날짜 네비게이션과 동기화)
            currentDate: null,
            isLoading: false,

            /* 구획별 행 목록 — rows.in / rows.out
               3층 '확인 필요'는 따로 담지 않고 이 둘에서 status === 'none' 인
               행을 뽑아 씁니다. 같은 데이터를 두 벌 들고 있으면 반드시 갈라집니다.
               DB 연결 후 api.js 가 이 둘만 채우고 renderAll() 을 다시 부르면 됩니다. */
            rows: { in: [], out: [] }
        },

        elements: {
            wrapper: null,
            subtitle: null
        }
    };

})();
