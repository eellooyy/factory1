/* factory1_mediause_constant.js — 1공장 사용량 페이지 [2층] 매체별 사용량 상수
   ────────────────────────────────────────────────────────────────
   1층(용지별)이 "무슨 종이를 썼나"를 본다면, 2층은 같은 사용량을
   "어느 신문에 썼나"로 갈라 봅니다. 두 층의 합계는 같아야 정상입니다.

   데이터 출처
     1~5열   v_factory1_usage_by_media  (adjustments 보정이 반영된 뷰)
     6~10열  3공장 — 아직 소스가 없습니다. 아래 FACTORY3_VIEW 주석 참조.

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

        /* 3공장 — 아직 소스가 없어 6~10열은 빈칸('–')으로 나옵니다.
           factory3_usage 에 media_code 가 백업되지 않아(백업 스크립트가
           MDA_NM 만 담고 MDA_CD 를 버립니다) 매체를 코드로 가를 수 없습니다.

           정리가 끝나면 이 값을 'v_factory3_usage_by_media' 로 바꾸고,
           아래 COLUMNS 의 3공장 열에 mediaCode 를 채우면 그대로 붙습니다.
           (factory1_mediause_api.js 는 이미 그 경로를 타도록 돼 있습니다) */
        FACTORY3_VIEW: null,

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
            { col: 1,  group: 'f1', label: '본지',      mediaCode: '13AM',       erpName: '매일경제신문' },
            { col: 2,  group: 'f1', label: '국방일보',  mediaCode: '13BN-00002', erpName: '국방일보' },
            { col: 3,  group: 'f1', label: '전자신문',  mediaCode: '13BN-00010', erpName: '전자신문' },
            { col: 4,  group: 'f1', label: 'F.T',       mediaCode: '13BN-00004', erpName: 'Financial Times' },
            { col: 5,  group: 'f1', label: '나라사랑',  mediaCode: '13BN-00009', erpName: '나라사랑신문' },

            /* 3공장 열 — mediaCode 는 media_code 백업이 끝난 뒤 채웁니다.
               erpName 은 현재 factory3_usage.media_name 에 실제로 들어 있는
               문자열이며, 코드를 찾을 때의 단서입니다. */
            { col: 6,  group: 'f3', label: '본지',        mediaCode: null, erpName: '매일경제신문',   source: 'factory3', sep: true },
            { col: 7,  group: 'f3', label: '경인일보',    mediaCode: null, erpName: '경인일보',       source: 'factory3' },
            { col: 8,  group: 'f3', label: '평화신문',    mediaCode: null, erpName: '가톨릭평화신문', source: 'factory3' },
            { col: 9,  group: 'f3', label: '기독교타임즈', mediaCode: null, erpName: '기독교타임즈',   source: 'factory3' },
            // 대학신문은 2026-07-28 현재 factory3_usage 에 한 건도 없습니다.
            { col: 10, group: 'f3', label: '대학신문',    mediaCode: null, erpName: '한국대학신문',   source: 'factory3' }
        ],

        // 패널 정의 — 1층과 같은 구조입니다.
        PANELS: [
            { idx: 1, scrollId: 'f1usMediaScroll', bodyId: 'f1usMediaBody', cursorId: 'f1usMediaCursor' }
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
