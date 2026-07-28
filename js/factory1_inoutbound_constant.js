/* factory1_inoutbound_constant.js — 1공장 전산 입출고 상세 내역 상수
   ────────────────────────────────────────────────────────────────
   공정 PC 의 Access DB(\\192.168.0.229\지고\Dongjin.mdb)가 받아 적은
   바코드 스캔 기록을 그대로 보여주는 화면입니다. 사람이 입력하는 값이
   하나도 없는 조회 전용 페이지입니다.

   [이 화면이 있는 이유]
     전산 입고는 오독이 거의 없어(2026-06-29~07-09 B6 535건 중 0건) 웹 입고
     페이지의 오타를 잡는 데 씁니다. 반대로 전산 출고는 전주 98.5% ·
     페이퍼 87% 가 깨져 들어옵니다. 그래도 쓸모가 있는 건 정확해서가 아니라
     계산 출고(지고 재고 차이)와 **출처가 다르기** 때문입니다. 둘이 같이
     틀리면 실사 쪽, 하나만 틀리면 그쪽 문제로 범위가 좁혀집니다.

     그래서 목표는 롤 1:1 대사가 아니라 **일 단위 롤 수 비교 + 미해석
     건수 추적**입니다. 해석하지 못한 행을 버리지 않고 그대로 세어 보여주는
     것이 이 페이지의 핵심입니다. 그 건수가 곧 "오늘 스캔이 얼마나 깨졌나"
     입니다.

   [정제는 여기가 아니라 뷰에서]
     오독값 자체가 "어떤 롤이 잘못 기록됐나"를 실재고와 대조할 근거라
     원본을 지우면 안 됩니다. 규칙도 아직 안 끝났습니다(7534 · 특수문자).
     원본 3테이블은 그대로 두고, 해석은 `v_factory1_io_normalized` 가
     맡습니다. 화면은 해석 결과와 원본을 한 줄에 나란히 보여주기만 합니다.

   [시각을 절대 변환하지 말 것]
     created_at 은 한국시간 벽시계 값이 timestamptz 에 +00 으로 들어가
     있습니다. timezone 변환을 태우면 야간 출고가 하루씩 밀립니다.
     문자열을 그대로 잘라 씁니다. (formatTime / dateOf 참고)
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
             돌린 것이라 고장이 아닙니다. 이 페이지를 실제로 쓰기 시작할 때
             다시 켭니다.

           VIEW 가 생기기 전까지는 원본을 직접 읽어도 해석 열이 비어 있습니다.
           페이지는 뷰가 붙는 것을 전제로 만들어 두었습니다.
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

        /* ── 표 구획 ──────────────────────────────────────────────
           배열 순서가 화면에 쌓이는 순서입니다. 좌우로 나누지 않고 위아래로
           쌓는 이유는 한 줄에 원본 6칸 + 해석 3칸이 들어가야 하기 때문입니다.
           반으로 접으면 롤번호와 물류코드가 먼저 뭉개집니다.

           dir : 'in' | 'out' — 요약 카드의 색과 아이콘만 가릅니다.
                 표 구성은 세 구획이 완전히 같습니다. 같은 자리에서 같은 항목을
                 읽어야 입고와 출고를 눈으로 맞대 볼 수 있습니다.
           ──────────────────────────────────────────────────────── */
        SECTIONS: [
            {
                key: 'in_b5', dir: 'in',
                title: '입고 B5', subtitle: '지하 5층 입고 스캔',
                tableKey: 'IN_B5',
                bodyId: 'f1iobInB5Body', countId: 'f1iobInB5Count', cardId: 'f1iobCardInB5'
            },
            {
                key: 'in_b6', dir: 'in',
                title: '입고 B6', subtitle: '지하 6층 입고 스캔',
                tableKey: 'IN_B6',
                bodyId: 'f1iobInB6Body', countId: 'f1iobInB6Count', cardId: 'f1iobCardInB6'
            },
            {
                key: 'out_b6', dir: 'out',
                title: '출고 B6', subtitle: '지하 6층 출고 스캔',
                tableKey: 'OUT_B6',
                bodyId: 'f1iobOutB6Body', countId: 'f1iobOutB6Count', cardId: 'f1iobCardOutB6'
            }
        ],

        /* ── 열 정의 ──────────────────────────────────────────────
           순서가 곧 td 순서입니다. HTML 의 colgroup / thead 와 짝이 맞아야
           하므로, 열을 넣거나 뺄 때는 factory1_inoutbound.html 의 세 구획을
           모두 같이 고쳐야 합니다. (구획마다 표가 따로 서 있습니다)

           앞 6열이 스캔 원본, 뒤 3열이 해석 결과입니다. 원본을 왼쪽에 두는
           것은 "무엇이 찍혔길래 이렇게 읽혔나"를 왼→오른쪽으로 읽기 위해서입니다.

           key   : 행 객체의 속성 이름
           cls   : td 에 붙일 추가 클래스
           ──────────────────────────────────────────────────────── */
        COLUMNS: [
            { key: 'time',         label: '시각',     cls: 'f1iob-time' },
            { key: 'manufacturer', label: '제조사코드', cls: 'f1iob-code f1iob-sep' },
            { key: 'itemType',     label: '규격',     cls: 'f1iob-center' },
            { key: 'weight',       label: '중량',     cls: 'f1iob-num' },
            { key: 'rollNumber',   label: '롤번호',   cls: 'f1iob-code' },
            { key: 'productCode',  label: '물류코드', cls: 'f1iob-code' },
            { key: 'vendor',       label: '회사',     cls: 'f1iob-center f1iob-sep' },
            { key: 'item',         label: '품목',     cls: 'f1iob-center' },
            { key: 'status',       label: '상태',     cls: 'f1iob-center' }   // 별도 렌더 (뱃지)
        ],

        /* ── 해석 상태 ────────────────────────────────────────────
           뷰가 행마다 이 셋 중 하나를 내려줍니다. 화면은 판정하지 않습니다.

           ok      정상 — 바코드가 그대로 읽혔습니다
           fixed   오독 보정 — 오독 규칙(60→62, 11→10, 4372→1404, 2443→702)으로
                   품목까지 되살린 행입니다. 되살렸다고 해서 조용히 정상으로
                   묻어 버리면 "출고 스캔이 얼마나 깨지고 있나"가 보이지 않습니다.
           none    미해석 — 규칙에 없는 조합(11/7534/0133)이나 통신 오류로
                   특수문자가 들어온 행('7?'), B5 의 0000/000/00 인식 불가 롤.
                   ※ 인식 불가 롤도 물건은 실제로 들어왔습니다. 롤 수는 세되
                     품목만 미상으로 둡니다. 행을 지우면 입고량이 줄어듭니다.
           ──────────────────────────────────────────────────────── */
        STATUS: {
            ok:    { label: '정상',      cls: 'f1iob-st-ok' },
            fixed: { label: '오독 보정', cls: 'f1iob-st-fixed' },
            none:  { label: '미해석',    cls: 'f1iob-st-none' }
        },

        // 상태 필터 — 요약 패널 우측 스위처. 값은 state.filter 에 들어갑니다.
        FILTERS: [
            { key: 'all',     label: '전체' },
            { key: 'problem', label: '오독·미해석만' }
        ],

        /* ── 화면 확인용 임시 행 ──────────────────────────────────
           DB 연결 전까지만 씁니다(USE_SAMPLE_DATA). 실측 분포를 그대로
           본떠서, 세 구획이 각각 어떤 모습으로 보이는지 확인할 수 있게
           골라 넣었습니다.
             입고 B6 — 오류 0건. 실제로도 그렇습니다.
             입고 B5 — 인식 불가 롤(0000)이 섞입니다.
             출고 B6 — 전주·페이퍼가 거의 다 깨집니다.
           ──────────────────────────────────────────────────────── */
        SAMPLE: {
            in_b5: [
                { time: '06:41:22', manufacturer: '73', itemType: 'A권', weight: 1404, rollNumber: '73051204', productCode: 'DH1576A', vendor: '대한제지',   item: '대한 A',   status: 'ok' },
                { time: '06:44:05', manufacturer: '73', itemType: 'A권', weight: 1404, rollNumber: '73051205', productCode: 'DH1576A', vendor: '대한제지',   item: '대한 A',   status: 'ok' },
                { time: '07:02:53', manufacturer: '10', itemType: 'A권', weight: 1404, rollNumber: '10233871', productCode: 'JJ1576',  vendor: '전주제지',   item: '전주 A',   status: 'ok' },
                { time: '07:05:11', manufacturer: '0000', itemType: '',  weight: null, rollNumber: '000',      productCode: '00',      vendor: '',           item: '',         status: 'none' },
                { time: '07:18:37', manufacturer: '62', itemType: 'A권', weight: 1404, rollNumber: '605180278', productCode: 'PK1576', vendor: '페이퍼코리아', item: '페이퍼 A', status: 'ok' }
            ],
            in_b6: [
                { time: '08:12:09', manufacturer: '73', itemType: 'A권', weight: 1404, rollNumber: '73051330', productCode: 'DH1576A', vendor: '대한제지',   item: '대한 A',   status: 'ok' },
                { time: '08:14:41', manufacturer: '73', itemType: 'D권', weight: 702,  rollNumber: '73088102', productCode: 'DH0788D', vendor: '대한제지',   item: '대한 D',   status: 'ok' },
                { time: '08:31:26', manufacturer: '10', itemType: 'A권', weight: 1404, rollNumber: '10233902', productCode: 'JJ1576',  vendor: '전주제지',   item: '전주 A',   status: 'ok' },
                { time: '08:33:58', manufacturer: '62', itemType: 'A권', weight: 1404, rollNumber: '605180301', productCode: 'PK1576', vendor: '페이퍼코리아', item: '페이퍼 A', status: 'ok' },
                { time: '09:02:14', manufacturer: '73', itemType: 'A권', weight: 1405, rollNumber: '73140502', productCode: 'DH0488',  vendor: '대한제지',   item: '48.8g',    status: 'ok' }
            ],
            out_b6: [
                { time: '17:22:40', manufacturer: '73', itemType: 'A권', weight: 1404, rollNumber: '73051188', productCode: 'DH1576A', vendor: '대한제지',   item: '대한 A',   status: 'ok' },
                /* 11 은 10(전주)의 오독이고 4372 는 1404 의 오독입니다.
                   입고 A:D 가 93:7 인데 출고 오독 4372:2443 도 92:8 이라
                   이 매핑이 우연이 아님을 뒷받침합니다. */
                { time: '17:25:03', manufacturer: '11', itemType: 'A권', weight: 4372, rollNumber: '11233871', productCode: 'JJ1576',  vendor: '전주제지',   item: '전주 A',   status: 'fixed' },
                { time: '17:29:47', manufacturer: '11', itemType: 'D권', weight: 2443, rollNumber: '11088440', productCode: 'JJ0788',  vendor: '전주제지',   item: '전주 D',   status: 'fixed' },
                /* 60 은 62(페이퍼)의 오독입니다. 뒷 내용이 통째로 깨져
                   중량·물류코드가 비고 규격도 A권이어야 할 것이 D권으로 옵니다.
                   롤번호는 입고값에서 앞 두 자리 60 이 빠지고 중간에 9 가 낍니다
                   (605180278 → 51890278). 확인한 8쌍이 전부 이 모양입니다. */
                { time: '17:33:12', manufacturer: '60', itemType: 'D권', weight: null, rollNumber: '51890278', productCode: '',        vendor: '페이퍼코리아', item: '페이퍼 A', status: 'fixed' },
                { time: '17:41:55', manufacturer: '11', itemType: '',    weight: 7534, rollNumber: '0133',     productCode: '',        vendor: '',           item: '',         status: 'none' },
                { time: '18:06:31', manufacturer: '7?', itemType: '',    weight: null, rollNumber: '',         productCode: '',        vendor: '',           item: '',         status: 'none' }
            ]
        },

        state: {
            // 조회 기준일 (공통 헤더의 날짜 네비게이션과 동기화)
            currentDate: null,
            isLoading: false,

            // 상태 필터 — 'all' | 'problem'
            filter: 'all',

            /* 구획별 행 목록 — rows[구획키] = [ {time, manufacturer, ...}, ... ]
               DB 연결 후 api.js 가 이 맵을 채우고 renderAll() 만 다시 부르면 됩니다. */
            rows: { in_b5: [], in_b6: [], out_b6: [] }
        },

        elements: {
            wrapper: null,
            subtitle: null,
            filterWrap: null
        }
    };

})();
