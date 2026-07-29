/* factory1_narasarang_constant.js — 1공장 나라사랑(48.8g) 재고 대장 상수
   ────────────────────────────────────────────────────────────────
   나라사랑은 월 1회 인쇄물입니다. 그래서 이 페이지는 다른 페이지와 두 가지가
   근본적으로 다릅니다.

   [1] 날짜가 연속이 아닙니다
     다른 페이지는 '오늘부터 며칠치'를 봅니다. 여기는 한 달에 며칠만 무슨 일이
     생기므로, 날짜를 쭉 깔면 30줄 중 2~3줄만 차고 나머지는 빈 줄입니다.
     그래서 **일이 있었던 날만 줄을 만듭니다.**
       입고가 있는 날 ∪ ERP 출고가 있는 날 ∪ 잔량을 적은 날
     지고 재고는 매일 들어오므로 기준에서 뺍니다. 넣으면 매일이 이벤트가 됩니다.

     인쇄 당일 아침처럼 ERP 출고가 아직 안 올라온 날은 줄이 없습니다. 그때만
     헤더 날짜를 맞추고 [+ 이 날짜 추가] 로 줄을 만듭니다.

   [2] 재고를 롤과 kg 로 따로 세지 않고, 하나에서 다른 하나를 만듭니다
       재고(kg) = 지고 재고(완롤) × 롤중량 + B5 주행지 잔량(kg)

     화면에서 'B5 주행지 잔량'이라 부르는 것이 급지 재고 페이지의 '잔여 주행지'와
     같은 물건입니다(같은 테이블). 이름이 갈리는 건 부르는 사람이 달라서입니다.

     기존 엑셀은 이 계산이 아니라 `전월 재고kg + 입고kg − 출고kg` 를 굴린
     누적 원장이었습니다. 그래서 실물에서 서서히 떠내려갑니다 — 2026-03-31 에
     재고 5롤(=7,025kg)인데 원장은 20,827kg 이었고, 차이 13,802kg 은 롤 하나가
     1,405kg 이니 약 9.8롤입니다. 급지대 부분 롤로는 설명이 안 되는 크기입니다.
     실물을 세어 만들면 이 누적 오차가 애초에 생기지 않고, 나중에 붙일 ERP 대조가
     "누적 vs 누적"이 아니라 "실물 vs 전산"이 됩니다.

   [출처가 넷입니다 — 이 페이지가 쓰는 곳은 잔량 하나뿐]
     factory1_ipgo              입고 (완롤)          읽기만
     factory1_jigo_real         지고 재고 (완롤)      읽기만 — 지고 재고 페이지가 주인
     v_factory1_usage_by_item   출고 (kg, ERP)       읽기만
     factory1_geupji_carry      B5 주행지 잔량 (kg)   ← 여기만 씁니다

   ※ 48.8g 은 `factory1_paper_item.geupji_key` 가 null 인 채로 둡니다. 그래야
     급지 재고 페이지의 호기 표·실제 출고 자동값 계산에서 계속 빠집니다.
     월 1회짜리가 거기 끼면 매일 빈 줄이 하나 생깁니다.
     `factory1_geupji_paper` 의 `dh_488` 도 `is_carry = false` 입니다 — 급지 재고
     페이지의 '잔여 주행지' 표는 is_carry 가 켜진 용지만 그리므로, false 면 그
     화면이 전혀 안 바뀌고 이 페이지만 dh_488 키를 직접 읽습니다.
   ──────────────────────────────────────────────────────────────── */
(function () {
    'use strict';

    window.Factory1Narasarang = {
        SUPABASE_URL: 'https://npiflqoscsvnnauvqhrr.supabase.co',
        SUPABASE_KEY: 'sb_publishable_ir-mHSsX6SSIQwHerkLbfA_2qCOP3KW',

        /* ── 이 용지를 부르는 이름이 테이블마다 다릅니다 ──────────
           같은 종이인데 세 군데서 세 가지 키를 씁니다. 한 곳에 모아 둡니다.
           ──────────────────────────────────────────────────────── */
        ITEM_CODE:  'daehan_488',      // factory1_ipgo · factory1_jigo_real
        ERP_CODE:   '11ANP-0000006',   // ERP 품목코드 — 사용량 뷰
        GEUPJI_KEY: 'dh_488',          // factory1_geupji_carry

        JIGO_TABLE:  'factory1_jigo_real',
        IPGO_TABLE:  'factory1_ipgo',
        USAGE_VIEW:  'v_factory1_usage_by_item',
        PAPER_TABLE: 'factory1_paper_item',

        /* 잔량은 급지 재고의 '잔여 주행지'와 같은 테이블을 씁니다.
           CARRY_TABLE 은 '값이 바뀐 날'만 담고, CARRY_VIEW 가 그 사이 날짜를
           펼쳐 직전 값을 이어 줍니다. 인쇄일에만 적으면 되는 이유가 이것입니다. */
        CARRY_TABLE: 'factory1_geupji_carry',
        CARRY_VIEW:  'v_factory1_geupji_carry',

        /* 주행지 잔량 자리 수. 보통 5개, 많을 때 6개까지 나옵니다.
           늘릴 때는 이 숫자와 테이블의 CHECK 제약, HTML thead·colgroup 을
           함께 맞추세요 (행 구조라 컬럼 추가는 없습니다). */
        SLOTS: 6,

        /* 완롤 1개 중량(kg). 페이지가 뜰 때 factory1_paper_item.roll_kg 로
           덮어씁니다 — 여기 값은 마스터를 못 읽었을 때의 대비책입니다. */
        ROLL_KG: 1405,

        WD_KR: ['일', '월', '화', '수', '목', '금', '토'],

        state: {
            year: null,          // 지금 보고 있는 연도 (헤더 날짜에서 옵니다)
            loading: false,

            /* 화면에 그려진 줄. [{ date, isBase }] — 오래된 것부터.
               isBase 는 조회 연도 이전의 마지막 이벤트로, 엑셀의 12/31 줄과
               같은 자리입니다. 값을 읽는 출발점이라 회색으로 깔고 편집도 막습니다. */
            rows: [],

            ipgo:  {},           // { 'YYYY-MM-DD': 완롤 }
            jigo:  {},           // { 'YYYY-MM-DD': 완롤 (B5+B6) }
            usage: {},           // { 'YYYY-MM-DD': kg }

            /* 계승까지 끝난 잔량 — carry[날짜][칸번호] = kg
               저장 판단의 기준값입니다. 화면에서 이것과 달라진 줄만 씁니다. */
            carry: {},

            /* 사용자가 [+ 이 날짜 추가] 로 만든 날짜. 아직 아무 데이터도 없어
               자동 기준으로는 줄이 안 생기는 날입니다. 저장하면 잔량 행이
               생기면서 다음 조회부터는 자동으로 잡힙니다. */
            extraDates: [],

            // 값이 바뀐 줄 — '날짜' 문자열 집합. 저장 대상입니다.
            dirtyRows: new Set(),
            isChanged: false
        },

        elements: {
            wrapper: null
        }
    };
})();
