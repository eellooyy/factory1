/* factory1_jeonja_constant.js — 1공장 전자신문 (용지재고대장) 상수 선언
   ────────────────────────────────────────────────────────────────
   ※ 지금은 '레이아웃 확인용' 단계입니다. DB 연결과 계산 로직은 아직
     붙이지 않았고, 아래 SAMPLE 에 2026년 7월 원장(4주차)을 그대로 넣어
     두었습니다. 실제 뷰가 붙으면 SAMPLE 을 지우고 api.js 한 파일만
     추가하면 됩니다 — render.js 는 손댈 것이 없습니다.

   ── 원장이 어떤 표인가 ──────────────────────────────────────────
   거래처(전자신문)가 관리하는 용지 원장이고, 저장위치로는 재고실사
   페이지의 '(사급)1공장 용지창고(전자신문) WB11102' 한 칸에 대응합니다.
     1576롤 → 11BNP-0000003 (사급-(전주)신문용지 46g 1576롤)
     788롤  → 11BNP-0000004 (사급-(전주)신문용지 46g 788롤)

   재고 열이 1576 · 788 합산이라 원장만으로는 롤별 재고를 못 나눕니다.
   나누려면 전월재고의 롤별 내역(앵커) 한 줄이 필요합니다. 그전까지는
   재고를 합계로만 적습니다 — 없는 값을 화면에서 만들어 내면 나중에
   앵커가 들어왔을 때 어느 쪽이 맞는지 아무도 모르게 됩니다.

   ── 숫자가 어디서 나오는가 ──────────────────────────────────────
   입고 : ERP 사급 창고 입고와 전 일자 일치합니다. 1576롤 1R/L = 1,404kg,
          788롤 1R/L = 702kg 이라 R/L 은 kg 에서 그대로 떨어집니다.
   출고 : 실사용량이 아니라 '정미사용량 × 1.03' 입니다. 약정 손지 3% 를
          얹은 계산값이라 매일 같은 숫자가 나옵니다. 실사용량은 손지가
          날마다 달라 흔들립니다 — 두 값이 다른 것이 정상입니다.
          정미사용량 = 부수 × 면수 × 4.947g
   면수 : 1576롤이 8면 단위(배폭지), 788롤이 4면 단위(반폭지)를 맡습니다.
          그래서 8로 나누어떨어지는 면수는 788 출고가 0 입니다.
            28면 = 1576(24) + 788(4)
            36면 = 1576(32) + 788(4)   ← 본지 28 + 특집 8
            24면 = 1576(24) + 788(0)
   ──────────────────────────────────────────────────────────────── */
(function () {
    'use strict';

    window.Factory1Jeonja = {
        SUPABASE_URL: 'https://npiflqoscsvnnauvqhrr.supabase.co',
        SUPABASE_KEY: 'sb_publishable_ir-mHSsX6SSIQwHerkLbfA_2qCOP3KW',

        // 이 원장이 보는 저장위치 · 품목 (재고실사 페이지와 같은 코드입니다)
        WAREHOUSE_CODE: 'WB11102',
        ITEM_A: '11BNP-0000003',   // 1576롤
        ITEM_D: '11BNP-0000004',   // 788롤

        // 롤 1개 무게 — R/L ↔ kg 환산에 쓰입니다. 788 은 정확히 절반입니다.
        ROLL_KG_A: 1404,
        ROLL_KG_D: 702,

        WD_KR: ['일', '월', '화', '수', '목', '금', '토'],

        /* 행 종류
             work    : 작업일 (입출고가 있는 날)
             off     : 휴간 · 미작업일 — 출고 없음, 재고만 이월
             pending : 원장이 아직 여기까지 오지 않은 날 (주차 마감 전)
           off 와 pending 은 화면에서 둘 다 '-' 이지만 뜻이 다릅니다.
           off 는 '움직임이 없었다', pending 은 '아직 모른다' 입니다. */
        ROW_WORK: 'work',
        ROW_OFF: 'off',
        ROW_PENDING: 'pending',

        /* ── 레이아웃 확인용 표본 데이터 ────────────────────────────
           전자신문 용지재고대장 2026년 7월 4주차 원본 그대로입니다.
           키: 'YYYY-MM' → { carryStock, rows[], total }

           rows[] 한 줄
             d       : 일자 (1~31)
             myeon   : 그날 면수 (없으면 null)
             inARl   : 입고 1576 R/L      inAKg : 입고 1576 kg
             inDRl   : 입고 788 R/L       inDKg : 입고 788 kg
             inSum   : 입고 합계 kg
             outA    : 출고 1576 kg       outD  : 출고 788 kg
             outSum  : 출고 합계 kg
             stock   : 마감 재고 kg (1576 + 788 합산)
             kind    : ROW_WORK / ROW_OFF / ROW_PENDING

           ※ 7/16 은 작업지시 자체가 없는 날(휴간)이라 출고가 0 입니다.
             7/27 이후는 4주차 원장이 아직 안 온 구간이라 pending 입니다.
           ──────────────────────────────────────────────────────── */
        SAMPLE: {
            '2026-07': {
                carryStock: 32435,
                rows: [
                    { d: 1,  myeon: 28, inARl: 6,  inAKg: 8424,  inDRl: null, inDKg: null, inSum: 8424,  outA: 6996, outD: 1166, outSum: 8162,  stock: 32697, kind: 'work' },
                    { d: 2,  myeon: 36, inARl: 10, inAKg: 14040, inDRl: 4,    inDKg: 2808, inSum: 16848, outA: 9328, outD: 1166, outSum: 10494, stock: 39051, kind: 'work' },
                    { d: 3,  myeon: null, inARl: null, inAKg: null, inDRl: null, inDKg: null, inSum: null, outA: null, outD: null, outSum: null, stock: 39051, kind: 'off' },
                    { d: 4,  myeon: null, inARl: null, inAKg: null, inDRl: null, inDKg: null, inSum: null, outA: null, outD: null, outSum: null, stock: 39051, kind: 'off' },
                    { d: 5,  myeon: 28, inARl: 4,  inAKg: 5616,  inDRl: 4,    inDKg: 2808, inSum: 8424,  outA: 6999, outD: 1166, outSum: 8165,  stock: 39310, kind: 'work' },
                    { d: 6,  myeon: 28, inARl: 6,  inAKg: 8424,  inDRl: null, inDKg: null, inSum: 8424,  outA: 6999, outD: 1166, outSum: 8165,  stock: 39569, kind: 'work' },
                    { d: 7,  myeon: 28, inARl: 6,  inAKg: 8424,  inDRl: null, inDKg: null, inSum: 8424,  outA: 6999, outD: 1166, outSum: 8165,  stock: 39828, kind: 'work' },
                    { d: 8,  myeon: 28, inARl: 5,  inAKg: 7020,  inDRl: 2,    inDKg: 1404, inSum: 8424,  outA: 6999, outD: 1166, outSum: 8165,  stock: 40087, kind: 'work' },
                    { d: 9,  myeon: 36, inARl: 10, inAKg: 14040, inDRl: 4,    inDKg: 2808, inSum: 16848, outA: 9332, outD: 1166, outSum: 10498, stock: 46437, kind: 'work' },
                    { d: 10, myeon: null, inARl: null, inAKg: null, inDRl: null, inDKg: null, inSum: null, outA: null, outD: null, outSum: null, stock: 46437, kind: 'off' },
                    { d: 11, myeon: null, inARl: null, inAKg: null, inDRl: null, inDKg: null, inSum: null, outA: null, outD: null, outSum: null, stock: 46437, kind: 'off' },
                    { d: 12, myeon: 28, inARl: 4,  inAKg: 5616,  inDRl: 4,    inDKg: 2808, inSum: 8424,  outA: 6999, outD: 1166, outSum: 8165,  stock: 46696, kind: 'work' },
                    { d: 13, myeon: 28, inARl: 6,  inAKg: 8424,  inDRl: null, inDKg: null, inSum: 8424,  outA: 6999, outD: 1166, outSum: 8165,  stock: 46955, kind: 'work' },
                    { d: 14, myeon: 28, inARl: 6,  inAKg: 8424,  inDRl: null, inDKg: null, inSum: 8424,  outA: 6999, outD: 1166, outSum: 8165,  stock: 47214, kind: 'work' },
                    { d: 15, myeon: 28, inARl: 5,  inAKg: 7020,  inDRl: 2,    inDKg: 1404, inSum: 8424,  outA: 6999, outD: 1166, outSum: 8165,  stock: 47473, kind: 'work' },
                    { d: 16, myeon: null, inARl: null, inAKg: null, inDRl: null, inDKg: null, inSum: null, outA: null, outD: null, outSum: null, stock: 47473, kind: 'off' },
                    { d: 17, myeon: null, inARl: null, inAKg: null, inDRl: null, inDKg: null, inSum: null, outA: null, outD: null, outSum: null, stock: 47473, kind: 'off' },
                    { d: 18, myeon: null, inARl: null, inAKg: null, inDRl: null, inDKg: null, inSum: null, outA: null, outD: null, outSum: null, stock: 47473, kind: 'off' },
                    { d: 19, myeon: 28, inARl: 4,  inAKg: 5616,  inDRl: 4,    inDKg: 2808, inSum: 8424,  outA: 6999, outD: 1166, outSum: 8165,  stock: 47732, kind: 'work' },
                    { d: 20, myeon: 28, inARl: 6,  inAKg: 8424,  inDRl: null, inDKg: null, inSum: 8424,  outA: 6999, outD: 1166, outSum: 8165,  stock: 47991, kind: 'work' },
                    { d: 21, myeon: 28, inARl: 6,  inAKg: 8424,  inDRl: null, inDKg: null, inSum: 8424,  outA: 6999, outD: 1166, outSum: 8165,  stock: 48250, kind: 'work' },
                    { d: 22, myeon: 28, inARl: 5,  inAKg: 7020,  inDRl: 2,    inDKg: 1404, inSum: 8424,  outA: 6999, outD: 1166, outSum: 8165,  stock: 48509, kind: 'work' },
                    { d: 23, myeon: 36, inARl: 10, inAKg: 14040, inDRl: 4,    inDKg: 2808, inSum: 16848, outA: 9332, outD: 1166, outSum: 10498, stock: 54859, kind: 'work' },
                    { d: 24, myeon: null, inARl: null, inAKg: null, inDRl: null, inDKg: null, inSum: null, outA: null, outD: null, outSum: null, stock: 54859, kind: 'off' },
                    { d: 25, myeon: null, inARl: null, inAKg: null, inDRl: null, inDKg: null, inSum: null, outA: null, outD: null, outSum: null, stock: 54859, kind: 'off' },
                    { d: 26, myeon: 24, inARl: null, inAKg: null, inDRl: null, inDKg: null, inSum: null, outA: 6999, outD: null, outSum: 6999,  stock: 47860, kind: 'work' },
                    { d: 27, myeon: null, inARl: null, inAKg: null, inDRl: null, inDKg: null, inSum: null, outA: null, outD: null, outSum: null, stock: 47860, kind: 'pending' },
                    { d: 28, myeon: null, inARl: null, inAKg: null, inDRl: null, inDKg: null, inSum: null, outA: null, outD: null, outSum: null, stock: 47860, kind: 'pending' },
                    { d: 29, myeon: null, inARl: null, inAKg: null, inDRl: null, inDKg: null, inSum: null, outA: null, outD: null, outSum: null, stock: 47860, kind: 'pending' },
                    { d: 30, myeon: null, inARl: null, inAKg: null, inDRl: null, inDKg: null, inSum: null, outA: null, outD: null, outSum: null, stock: 47860, kind: 'pending' },
                    { d: 31, myeon: null, inARl: null, inAKg: null, inDRl: null, inDKg: null, inSum: null, outA: null, outD: null, outSum: null, stock: 47860, kind: 'pending' }
                ],
                /* 소계 — 원장에 있는 행입니다. 화면에서 더하지 않고 원장값을
                   그대로 씁니다. 여기서 다시 더하면 원장과 1kg 어긋났을 때
                   그 사실이 조용히 지워집니다. */
                total: { inARl: 99, inAKg: 138996, inDRl: 30, inDKg: 21060, inSum: 160056,
                         outA: 125975, outD: 18656, outSum: 144631, stock: 47860 }
            }
        },

        state: {
            // 상단 네비게이션이 가리키는 날 (이 날이 속한 달을 그립니다)
            currentDate: null,
            currentMonth: null,   // 'YYYY-MM'
            hoverDay: null,       // 마우스가 올라간 줄 — 네 패널에 같이 걸립니다
            isLoading: false
        },

        elements: {
            wrapper: null,
            // 패널 번호(1~4) → 요소. 네 표가 같은 줄을 나눠 그립니다.
            //   1 날짜·면수   2 입고   3 출고   4 재고
            body: {},
            foot: {},
            scroll: {},
            monthTitle: null,
            // 본문 좌우 여백에 세우는 월 이동 버튼 — render.js 가 만들어 붙입니다
            prevMonthBtn: null,
            nextMonthBtn: null
        }
    };

})();
