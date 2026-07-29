/* factory1_inventory_io_constant.js — 1공장 재고 종합 모듈 상수 선언
   ────────────────────────────────────────────────────────────────
   이 페이지의 "고정 텍스트"(저장위치명 · 저장위치 코드 · 품목코드 · 품목명)는
   전부 이 파일에서 관리합니다. 표 행의 순서/구성이 바뀌면 LOCATIONS 배열만
   수정하면 되고 render.js는 손댈 필요가 없습니다.

   숫자는 api.js가 뷰에서 읽어 state.values 를 채웁니다.
     실재고(B5 / B6 / B6주행지)  →  v_factory1_actual_stock
     ERP 재고 / 입고 / 사용량    →  아직 미연결 ('–' 로 비어 있습니다)

   ※ 합계 = B5 + B6 + B6(주행지),  실재고-ERP재고 = 합계 − ERP 재고
     두 값은 render.js에서 계산합니다. 저장하지 않는 이유는 원본을 고쳤을 때
     조용히 갈라지기 때문입니다.

   기준일은 '어제'입니다. 아침에 세는 재고는 어제 작업이 끝난 뒤 남은 롤이라
   오늘 자로 적으면 그날 입고와 섞입니다. 날짜 기본값은 common_header.js가
   이미 어제로 열어 주므로 이 파일에 따로 설정할 것이 없습니다.
   ──────────────────────────────────────────────────────────────── */
(function () {
    'use strict';

    window.Factory1InventoryIo = {
        SUPABASE_URL: 'https://npiflqoscsvnnauvqhrr.supabase.co',
        SUPABASE_KEY: 'sb_publishable_ir-mHSsX6SSIQwHerkLbfA_2qCOP3KW',

        // ── 조회 대상 ────────────────────────────────────────────────
        // 페이지는 v_* 뷰만 조회합니다. base 테이블을 직접 읽으면 회계 보정
        // (adjustments)이 반영되지 않고, 실재고는 출처가 다섯 군데라 화면에서
        // 합치면 다른 페이지와 숫자가 갈라집니다.
        /* 입고와 사용량은 ERP 전산값(v_factory1_stock_daily 의 rcpt_qt/iss_qt)이
           아니라 현장 원본에서 읽습니다.

           숫자는 같습니다 — 대한1576 7/20~7/27 을 전 일자 대조해 ipgo 와 ERP 입고가
           한 건도 다르지 않았습니다. 다른 것은 '언제 들어오느냐'입니다. ERP 백업은
           새벽 2시에 돌고 전날 자료가 하루 늦게 잡히는 일이 잦아, 기준일이 어제인
           이 화면에서는 두 열이 늘 비어 보입니다. 원본은 그날 바로 있습니다.
           (2026-07-29 기준 ERP 최종일 7/27, ipgo 7/29, 사용량 7/28) */
        TABLES: {
            ACTUAL_STOCK: 'v_factory1_actual_stock',   // B5 / B6 / B6(주행지)

            IPGO: 'v_factory1_ipgo',                   // 입고 — 입고 페이지 수기 입력
            USAGE: 'v_factory1_usage_by_item',         // 사용량 — 급지 실적
            F3_IPGO: 'factory3_io',                    // 별관 입고 (in_a_kg / in_d_kg)
            F3_USAGE: 'v_factory3_usage_by_item',      // 별관 사용량

            /* ERP 재고 — 'ERP 원장을 그대로 옮긴 값'이 아닙니다.
               결재가 밀리면 하루·이틀, 길게는 일주일 전 자료도 안 들어오기 때문에
               ERP 원본(factory1_erp_history)은 이 열의 출처로 쓸 수 없습니다.
               대신 기준일의 재고를 앵커로 잡고 입고와 사용량을 누적해 만든 값을
               'ERP 재고'라 부르고 있습니다. 그래서 출처가 저장위치마다 다릅니다.

               별관 v_factory3_daily_stock.erp_a / erp_d
               F.T  v_factory1_ft_erp_stock.erp_stock (item = A/C/D)
               1공장 용지창고(대한·전주·페이퍼 등)는 아직 그런 누적 뷰가 없어
               비어 있습니다 — 만들기 전까지 '–' 가 맞습니다. */
            FT_ERP: 'v_factory1_ft_erp_stock',
            F3_STOCK: 'v_factory3_daily_stock',

            PAPER_ITEM: 'factory1_paper_item',         // 입고의 item_code → ERP 품목코드
            CHECK: 'factory1_inventory_check'          // 날짜별 재고 확인 상태
        },

        /* 재고 확인 상태 — 매일 실사를 할 수 있는 것이 아니고 숫자가 애매한 날도
           있어서, 그날의 표를 어디까지 믿을 수 있는지 남겨 둡니다.

           '미확인'은 기본값이라 DB에 행이 없습니다. 확인·보류를 고른 날만 행이
           생기고 미확인으로 되돌리면 행을 지웁니다. 그래서 DB의 CHECK 제약에는
           'confirmed'·'hold' 둘만 있습니다. */
        STATUS_DEFAULT: 'unchecked',
        STATUS_OPTIONS: [
            { key: 'confirmed', label: '확인' },
            { key: 'hold', label: '보류' },
            { key: 'unchecked', label: '미확인' }
        ],

        // 실재고 하위 열 정의 (창고 구분) — 열 추가/이름 변경 시 여기만 수정
        REAL_COLUMNS: [
            { key: 'b5', label: 'B5' },
            { key: 'b6', label: 'B6' },
            { key: 'b6run', label: 'B6(주행지)' }
        ],

        /* 고정값 행(FIXED_ITEMS)을 화면에 표시할지 여부.
           false 로 바꾸면 fixed 가 붙은 행이 통째로 사라집니다.
           나투라를 버리게 되면 이 값을 false 로 두거나, 아래 LOCATIONS 에서
           해당 항목 객체 한 줄만 지우면 끝입니다. DB에는 아무것도 없습니다. */
        SHOW_FIXED_ITEMS: true,

        // ── 표 본문 고정 텍스트 ──────────────────────────────────────
        // locName : 저장위치명 (셀 윗줄)
        // locCode : 저장위치 코드 (셀 아랫줄)
        // items[] : 해당 저장위치에 속한 품목 (품목코드 오름차순)
        //   code  : ERP 품목코드 — v_factory1_actual_stock.erp_code 와 조인하는 키
        //   fixed : DB가 아니라 이 파일에 박아 둔 상수값 (아래 나투라 참고)
        LOCATIONS: [
            {
                locName: '1공장 용지창고',
                locCode: 'WA11110',
                items: [
                    { code: '11ANP-0000001', name: '(대한)신문용지 46g 1576롤' },
                    { code: '11ANP-0000002', name: '(대한)신문용지 46g 1182롤' },
                    { code: '11ANP-0000003', name: '(대한)신문용지 46g 788롤' },
                    { code: '11ANP-0000004', name: '(페이퍼)신문용지 46g 1576롤' },
                    { code: '11ANP-0000006', name: '(대한)신문용지 48g 1576롤' },
                    { code: '11ANP-0000008', name: '(전주)신문용지 46g 1576롤' },
                    /* 전주 본지 788 — 실제로 입고·출고된 적이 없어 늘 0 이지만
                       나중에 생길 수 있어 자리를 만들어 둡니다. 마스터
                       (factory1_paper_item.jj_bonji_d)에는 이미 있으므로 값이
                       들어오면 바로 채워집니다. */
                    { code: '11ANP-0000009', name: '(전주)신문용지 46g 788롤' }
                ]
            },
            {
                locName: '(사급)1공장 용지창고(전자신문)',
                locCode: 'WB11102',
                items: [
                    { code: '11BNP-0000003', name: '사급-(전주)신문용지 46g 1576롤' },
                    { code: '11BNP-0000004', name: '사급-(전주)신문용지 46g 788롤' }
                ]
            },
            {
                /* ftErp: ERP 재고를 v_factory1_ft_erp_stock 에서 읽습니다.
                   ftGrade 가 그 뷰의 item(A/C/D)입니다. 나투라는 등급이 없어 '–'. */
                locName: '(사급)1공장 용지창고(FT)',
                locCode: 'WB11101',
                ftErp: true,
                items: [
                    /* 나투라 55g — 테스트용으로 들여와 쓰고 남은 재고입니다.
                       ERP 상 2025-08-31 의 440kg 이 마지막 기록이고 그 뒤로 한 번도
                       움직이지 않았습니다. 지고 재고·급지 재고 어느 화면에도 열이
                       없고 앞으로 쓸 용지도 아니라, 마스터(factory1_paper_item)에
                       넣지 않고 여기 상수 한 칸으로만 둡니다.

                       마스터에 넣으면 입고·사용량·지고 재고 세 화면에 열이 3개씩
                       생기고, '매일 전량을 다시 세는 표'라 매일 적어야 하는 칸이
                       늘어납니다. 안 움직이는 재고에는 과한 비용입니다.

                       ▸ 버리게 되면 : 아래 객체 한 줄을 지우면 행이 사라집니다.
                         잠시 감추기만 하려면 위 SHOW_FIXED_ITEMS 를 false 로.
                         어느 쪽이든 DB는 건드릴 것이 없습니다. */
                    {
                        code: '11APP-0000605',
                        name: '(페이퍼코리아)나투라 55g 788롤',
                        fixed: { b6run: 440 },
                        fixedNote: '실사 고정값 — 2025-08 이후 변동 없음 (DB 미연동)'
                    },
                    { code: '11BNP-0000005', name: '사급-(전주)신문용지(살구) 45g 1575롤', ftGrade: 'A' },
                    { code: '11BNP-0000006', name: '사급-(전주)신문용지(살구) 45g 1182롤', ftGrade: 'C' },
                    { code: '11BNP-0000007', name: '사급-(전주)신문용지(살구) 45g 788롤', ftGrade: 'D' }
                ]
            },
            {
                /* 별관은 층 구분도 주행지 개념도 없습니다. 표의 열을 빌려
                   B6 = 지고 재고, B6(주행지) = 급지 재고로 쓰고 B5 는 항상 0 입니다.

                   factory3: 이 저장위치의 입고·사용량은 1공장 원본에 없습니다.
                   1공장 ERP 백업이 WA31110 창고를 아예 당겨오지 않고(전 기간 0행),
                   입고 페이지·급지 실적도 1공장 것만 담습니다. 그래서 3공장 쪽
                   원본에서 읽습니다 — 입고는 factory3_io, 사용량은 3공장 급지 실적,
                   ERP 재고는 v_factory3_daily_stock 의 erp_a / erp_d.

                   f3Grade: 세 원본 모두 품목코드 없이 A/D 두 등급으로만 적습니다. */
                locName: '3공장 용지창고',
                locCode: 'WA31110',
                factory3: true,
                items: [
                    { code: '11ANP-0000001', name: '(대한)신문용지 46g 1576롤', f3Grade: 'a' },
                    { code: '11ANP-0000003', name: '(대한)신문용지 46g 788롤', f3Grade: 'd' }
                ]
            }
        ],

        state: {
            // 조회 기준일 (공통 헤더의 날짜 네비게이션과 동기화)
            currentDate: null,
            isLoading: false,

            // (저장위치코드|품목코드) → { erp, inQty, useQty, b5, b6, b6run }
            values: {},

            // 재고 확인 상태 — status 는 화면의 현재 선택, savedStatus 는 DB 값.
            // 둘을 나눠 두어야 '고쳤는데 저장 안 함'을 알 수 있습니다.
            status: 'unchecked',
            savedStatus: 'unchecked',
            isEditMode: false
        },

        elements: {
            wrapper: null,
            blocks: null,
            subtitle: null,
            status: null
        }
    };

})();
