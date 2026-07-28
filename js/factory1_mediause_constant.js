/* factory1_mediause_constant.js — 1공장 사용량 페이지 [2층] 매체별 사용량 상수
   ────────────────────────────────────────────────────────────────
   1층(용지별)이 "무슨 종이를 썼나"를 본다면, 2층은 같은 사용량을
   "어느 신문에 썼나"로 갈라 봅니다. 두 층의 합계는 같아야 정상입니다.

   데이터 출처
     1~6열   v_factory1_usage_by_media  (adjustments 보정이 반영된 뷰)
     7~12열  v_factory3_usage_by_media  (같은 형식, factory = 3 보정 반영)

   ※ 본지(13AM)와 별쇄(13AS)는 나란히 두되 열을 나눕니다. 별쇄는 인쇄가
     있는 날만 찍히고 편차가 큽니다(3공장은 누적으로 본지보다 많습니다).
     합쳐 두면 본지 열이 이유 없이 출렁이는 것처럼 보여, 어느 쪽이 움직인
     것인지 화면에서 알 수 없습니다. 열 오른쪽 구분선으로 묶어 보입니다.

   ※ 열을 media_code 로 잡습니다. 제호(media_name)는 ERP 에서 바뀔 수
     있지만 코드는 유지되므로, 이름이 바뀌어도 통계가 끊기지 않습니다.
   ──────────────────────────────────────────────────────────────── */
(function () {
    'use strict';

    window.Factory1MediaUse = {
        SUPABASE_URL: 'https://npiflqoscsvnnauvqhrr.supabase.co',
        SUPABASE_KEY: 'sb_publishable_ir-mHSsX6SSIQwHerkLbfA_2qCOP3KW',

        // 1공장 — 보정(adjustments)이 반영된 뷰. base 테이블을 직접 보지 않습니다.
        VIEW: 'v_factory1_usage_by_media',

        // 3공장 — 1공장과 같은 형식의 뷰입니다. (2026-07-28 연결)
        // factory3_usage 에 media_code 를 백업하도록 고치고 1월치부터 다시
        // 적재한 뒤 만든 뷰라, 1공장과 같은 매체코드 체계를 씁니다.
        FACTORY3_VIEW: 'v_factory3_usage_by_media',

        WD_KR: ['일', '월', '화', '수', '목', '금', '토'],

        // ── 1레벨 헤더 라벨 ────────────────────────────────────────
        GROUPS: {
            'f1': '1공장',
            'f3': '3공장'
        },

        /* ── 데이터 열 정의 ────────────────────────────────────────
           col       : 열 번호 (헤더 th / 데이터 td 의 data-col 과 일치)
           group     : 소속 1레벨 헤더 키
           label     : 2레벨 헤더 라벨
           sep       : 그룹 시작 열 → 좌측 구분선
           mediaCode : ERP 매체코드 (MDA_CD)
           erpName   : ERP 상의 실제 제호 — 화면 라벨과 다를 때 확인용 메모
           source    : 생략하면 1공장(VIEW), 'factory3' 이면 3공장 열
           ──────────────────────────────────────────────────────── */
        COLUMNS: [
            { col: 1,  panel: 1, group: 'f1', label: '본지',      mediaCode: '13AM',       erpName: '매일경제신문' },
            { col: 2,  panel: 1, group: 'f1', label: '별쇄',      mediaCode: '13AS',       erpName: '매일경제신문(특집)' },
            { col: 3,  panel: 1, group: 'f1', label: '국방일보',  mediaCode: '13BN-00002', erpName: '국방일보', sep: true },
            { col: 4,  panel: 1, group: 'f1', label: '전자신문',  mediaCode: '13BN-00010', erpName: '전자신문' },
            { col: 5,  panel: 1, group: 'f1', label: 'F.T',       mediaCode: '13BN-00004', erpName: 'Financial Times' },
            { col: 6,  panel: 1, group: 'f1', label: '나라사랑',  mediaCode: '13BN-00009', erpName: '나라사랑신문' },

            /* 3공장은 별도 패널입니다. 매체코드는 1공장과 같은 체계이고,
               본지/별쇄는 아예 같은 코드(13AM/13AS)를 씁니다. 매체코드는
               공장이 아니라 신문 자체에 붙는 값이기 때문입니다. */
            { col: 7,  panel: 2, group: 'f3', label: '본지',        mediaCode: '13AM',       erpName: '매일경제신문',       source: 'factory3' },
            { col: 8,  panel: 2, group: 'f3', label: '별쇄',        mediaCode: '13AS',       erpName: '매일경제신문(특집)', source: 'factory3' },
            { col: 9,  panel: 2, group: 'f3', label: '경인일보',    mediaCode: '13BN-00003', erpName: '경인일보',           source: 'factory3', sep: true },
            { col: 10, panel: 2, group: 'f3', label: '평화신문',    mediaCode: '13BN-00008', erpName: '가톨릭평화신문',     source: 'factory3' },
            { col: 11, panel: 2, group: 'f3', label: '기독교타임즈', mediaCode: '13BN-00013', erpName: '기독교타임즈',       source: 'factory3' },
            { col: 12, panel: 2, group: 'f3', label: '대학신문',    mediaCode: '13BN-00005', erpName: '한국대학신문',       source: 'factory3' }
        ],

        /* 패널 정의 — 두 패널은 스크롤이 서로 동기화되어 같이 움직입니다.
           cols   : 각 패널이 그릴 열 개수 (CSS 의 열 너비 계산과 맞춥니다)
           noDate : true 면 날짜 열을 그리지 않습니다. 스크롤이 붙어 다녀
                    같은 줄이 항상 나란히 오므로 날짜가 두 번 필요 없습니다. */
        PANELS: [
            { idx: 1, cols: 6, scrollId: 'f1usMediaF1Scroll', bodyId: 'f1usMediaF1Body', cursorId: 'f1usMediaF1Cursor' },
            { idx: 2, cols: 6, scrollId: 'f1usMediaF3Scroll', bodyId: 'f1usMediaF3Body', cursorId: 'f1usMediaF3Cursor', noDate: true }
        ],

        // 한 번에 불러오는 일수 / 과거로 조회 가능한 최대치 (1층과 동일)
        RANGE: 15,
        MAX_PAST_DAYS: 365,

        state: {
            isScrollUnlocked: false,
            loading: false,
            hasPrev: true,
            hasNext: true,
            isInitialLoad: true,

            baseDate: null,
            selectedDate: null,
            selectedCol: null,
            selectedPanel: 1,
            syncLock: false,

            // 조회 결과 캐시
            //   usage[날짜][mediaCode]    = 1공장 사용량
            //   factory3[날짜][mediaCode] = 3공장 사용량 (소스 연결 전까지 비어 있음)
            usage: {},
            factory3: {},

            // 이미 조회한 날짜 구간 (중복 조회 방지)
            fetched: new Set()
        }
    };

})();
