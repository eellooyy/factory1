/* factory1_inventory_io_constant.js — 1공장 재고 종합 모듈 상수 선언
   ────────────────────────────────────────────────────────────────
   이 페이지의 "고정 텍스트"(저장위치명 · 저장위치 코드 · 품목코드 · 품목명)는
   전부 이 파일에서 관리합니다. 표 행의 순서/구성이 바뀌면 LOCATIONS 배열만
   수정하면 되고 render.js는 손댈 필요가 없습니다.

   숫자(ERP 재고 / 전일 입고 / 전일 사용 / B5 / B6 / B6(주행지))는 나중에
   여러 테이블에서 불러올 값입니다. 지금은 DB 연결 전이라 화면 확인용
   임시 숫자(sample)를 넣어두었고, USE_SAMPLE_DATA 를 false 로 바꾸면
   숫자 칸이 전부 빈 값(–)으로 표시됩니다.

   ※ 합계 = B5 + B6 + B6(주행지),  실재고-ERP재고 = 합계 − ERP 재고
     두 값은 render.js에서 계산하므로 DB에서는 6개 숫자만 채우면 됩니다.
   ──────────────────────────────────────────────────────────────── */
(function () {
    'use strict';

    window.Factory1InventoryIo = {
        SUPABASE_URL: 'https://npiflqoscsvnnauvqhrr.supabase.co',
        SUPABASE_KEY: 'sb_publishable_ir-mHSsX6SSIQwHerkLbfA_2qCOP3KW',

        // ── DB 연결 예정 자리 ────────────────────────────────────────
        // 실제 테이블/뷰 이름이 확정되면 여기에 적고 api.js를 추가합니다.
        // ERP 재고 · 전일 입고 · 전일 사용 · 실재고(B5/B6/주행지)를 각각
        // 다른 테이블에서 가져와 (저장위치코드 + 품목코드) 기준으로 합칩니다.
        TABLES: {
            ERP_STOCK: null,   // 예) 'v_factory1_erp_stock'
            INBOUND: null,     // 예) 'v_factory1_inbound_daily'
            USAGE: null,       // 예) 'v_factory1_usage_daily'
            ACTUAL_STOCK: null // 예) 'v_factory1_actual_stock'
        },

        // 실재고 하위 열 정의 (창고 구분) — 열 추가/이름 변경 시 여기만 수정
        REAL_COLUMNS: [
            { key: 'b5', label: 'B5' },
            { key: 'b6', label: 'B6' },
            { key: 'b6run', label: 'B6(주행지)' }
        ],

        // 화면 확인용 임시 숫자 사용 여부 (DB 연결 시 false 로 변경)
        USE_SAMPLE_DATA: true,

        // ── 표 본문 고정 텍스트 ──────────────────────────────────────
        // locName : 저장위치명 (셀 윗줄)
        // locCode : 저장위치 코드 (셀 아랫줄)
        // items[] : 해당 저장위치에 속한 품목 (표시 순서 그대로)
        LOCATIONS: [
            {
                locName: '1공장 용지창고',
                locCode: 'WA11110',
                items: [
                    { code: '11ANP-0000001', name: '(대한)신문용지 46g 1576롤', sample: { erp: 74418, inQty: 0, useQty: 0, b5: 47736, b6: 35100, b6run: 8300 } },
                    { code: '11ANP-0000002', name: '(대한)신문용지 46g 1182롤', sample: { erp: 4490, inQty: 0, useQty: 0, b5: 3156, b6: 0, b6run: 1245 } },
                    { code: '11ANP-0000003', name: '(대한)신문용지 46g 788롤', sample: { erp: 15887, inQty: 0, useQty: 0, b5: 0, b6: 16146, b6run: 1091 } },
                    { code: '11ANP-0000004', name: '(페이퍼)신문용지 46g 1576롤', sample: { erp: 14540, inQty: 0, useQty: 0, b5: 0, b6: 11232, b6run: 0 } },
                    { code: '11ANP-0000006', name: '(대한)신문용지 48g 1576롤', sample: { erp: 5796, inQty: 0, useQty: 0, b5: 2810, b6: 0, b6run: 2285 } },
                    { code: '11ANP-0000008', name: '(전주)신문용지 46g 1576롤', sample: { erp: 17651, inQty: 0, useQty: 0, b5: 0, b6: 19656, b6run: 0 } }
                ]
            },
            {
                locName: '(사급)1공장 용지창고(FT)',
                locCode: 'WB11101',
                items: [
                    { code: '11APP-0000605', name: '(페이퍼코리아)나투라 55g 788롤', sample: { erp: 440, inQty: 0, useQty: 0, b5: 0, b6: 0, b6run: 440 } },
                    { code: '11BNP-0000005', name: '사급-(전주)신문용지(살구) 45g 1575롤', sample: { erp: 8533, inQty: 0, useQty: 0, b5: 2674, b6: 5348, b6run: 2023 } },
                    { code: '11BNP-0000006', name: '사급-(전주)신문용지(살구) 45g 1182롤', sample: { erp: 2970, inQty: 0, useQty: 0, b5: 2006, b6: 1003, b6run: 337 } },
                    { code: '11BNP-0000007', name: '사급-(전주)신문용지(살구) 45g 788롤', sample: { erp: 3614, inQty: 0, useQty: 0, b5: 2007, b6: 1338, b6run: 396 } }
                ]
            },
            {
                locName: '(사급)1공장 용지창고(전자신문)',
                locCode: 'WB11102',
                items: [
                    { code: '11BNP-0000003', name: '사급-(전주)신문용지 46g 1576롤', sample: { erp: 25816, inQty: 0, useQty: 0, b5: 8424, b6: 5616, b6run: 4030 } },
                    { code: '11BNP-0000004', name: '사급-(전주)신문용지 46g 788롤', sample: { erp: 4740, inQty: 0, useQty: 0, b5: 702, b6: 2106, b6run: 752 } }
                ]
            },
            {
                locName: '3공장 용지창고',
                locCode: 'WA31110',
                items: [
                    { code: '11ANP-0000001', name: '(대한)신문용지 46g 1576롤', sample: { erp: 31318, inQty: 0, useQty: 0, b5: 0, b6: 27432, b6run: 4282 } },
                    { code: '11ANP-0000003', name: '(대한)신문용지 46g 788롤', sample: { erp: 5765, inQty: 0, useQty: 0, b5: 0, b6: 5710, b6run: 148 } }
                ]
            }
        ],

        state: {
            // 조회 기준일 (공통 헤더의 날짜 네비게이션과 동기화)
            currentDate: null,
            isLoading: false,

            // (저장위치코드|품목코드) → { erp, inQty, useQty, b5, b6, b6run }
            // DB 연결 후 api.js가 이 맵을 채우고 render 를 다시 호출합니다.
            values: {}
        },

        elements: {
            wrapper: null,
            body: null,
            subtitle: null
        }
    };

})();
