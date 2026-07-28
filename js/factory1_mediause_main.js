/* factory1_mediause_main.js — 1공장 사용량 [2층] 진입점
   ────────────────────────────────────────────────────────────────
   상단 공통 헤더(달력 · PDF · 공지)는 1층 모듈(factory1_paperuse_main.js)이
   소유합니다. 여기서는 헤더를 초기화하지 않고, 날짜 변경 통지만 받습니다.
     · 날짜 변경 → 1층 onDateChange 가 Factory1MediaUse.loadData 를 호출
     · 최초 1회  → 아래 init 이 직접 호출

   script 태그 순서상 1층 main 이 먼저 DOMContentLoaded 를 받습니다.
   CommonHeader.init 이 그 자리에서 onDateChange 를 부르면 2층이 이미
   한 번 그려진 상태가 되므로, 아래에서 중복 렌더를 걸러 냅니다.
   ──────────────────────────────────────────────────────────────── */
(function () {
    'use strict';

    const App = window.Factory1MediaUse;
    if (!App) return;

    function pad(n) { return String(n).padStart(2, '0'); }

    function yesterdayStr() {
        const t = new Date();
        t.setDate(t.getDate() - 1);
        return `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}`;
    }

    const Factory1MediaUseModule = {
        init: function () {
            if (!document.getElementById(App.PANELS[0].bodyId)) return;

            App.initUI();

            // 1층 onDateChange 가 이미 그렸다면(baseDate 가 잡혀 있으면) 건너뜁니다.
            if (App.state.baseDate) return;

            const api = window.Factory1PaperUse && window.Factory1PaperUse.headerApi;
            const date = (api && api.getCurrentDate && api.getCurrentDate()) || yesterdayStr();
            App.loadData(date);
        }
    };

    window.Factory1MediaUseModule = Factory1MediaUseModule;

    document.addEventListener('DOMContentLoaded', function () {
        Factory1MediaUseModule.init();
    });
})();
