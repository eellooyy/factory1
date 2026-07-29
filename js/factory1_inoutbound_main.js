/* factory1_inoutbound_main.js — 1공장 입출고 내역 진입점
   ────────────────────────────────────────────────────────────────
   factory1_inventory_io_main.js 와 같은 패턴입니다. 공정 PC 가 스캔한
   기록을 그대로 보여주기만 하는 조회 전용 화면이라 편집 폼이 없습니다.
   (상단 수정/저장 버튼은 마스터 모드의 공지사항 편집용으로 다른 페이지들과
    동일하게 유지합니다)

   기준일은 공통 헤더의 기본값(어제)을 그대로 씁니다. 지고 재고처럼 따로
   당겨 놓지 않는 이유는, 이 화면의 숫자가 '어제 작업의 결과'가 아니라
   '그 날짜에 실제로 찍힌 스캔'이기 때문입니다.

   이 페이지만의 컨트롤이 둘 있습니다.
     방향 스위처   입고 ↔ 출고. 조회는 하지 않고 그리기만 다시 합니다.
     날짜 이동 버튼 표 카드 좌우에 세운 얇은 띠. 상단 헤더의 이전/다음과
                   같은 동작이고, 표를 보다가 손을 위로 올리지 않아도
                   전날·다음날로 넘어가기 위한 것입니다.
   ──────────────────────────────────────────────────────────────── */
(function () {
    'use strict';

    const App = window.Factory1Inoutbound;
    if (!App) return;

    const utils = window.Factory3Utils || window.CommonUtils;

    /* 표 좌우 날짜 이동 버튼.
       상단 헤더의 [다음] 이 오늘 이후로 못 가게 막혀 있으므로 여기도 같이
       막습니다. 한쪽만 열려 있으면 데이터가 있을 수 없는 날짜로 넘어갑니다. */
    function bindDayNav() {
        const prev = document.getElementById('f1iobDayPrev');
        const next = document.getElementById('f1iobDayNext');

        function move(delta) {
            if (!App.headerApi.confirmLeaveEditMode()) return;
            const target = utils.addDays(App.headerApi.getCurrentDate(), delta);
            if (delta > 0 && target > utils.getTodayStr()) return;
            App.headerApi.setCurrentDate(target);
            syncDayNav();
        }

        function syncDayNav() {
            if (!next) return;
            const atToday = App.headerApi.getCurrentDate() >= utils.getTodayStr();
            next.classList.toggle('disabled', atToday);
        }

        if (prev) prev.addEventListener('click', () => move(-1));
        if (next) next.addEventListener('click', () => move(1));

        App.syncDayNav = syncDayNav;
        syncDayNav();
    }

    /* '확인 필요' 접기/펼치기.
       대부분의 날은 0건이라(전 기간 6건) 기본은 접힌 상태입니다. 건수는
       접힌 채로도 제목 옆에 보이므로, 숫자가 붙은 날만 펼치면 됩니다. */
    function bindReviewToggle() {
        const panel = document.getElementById('f1iobReviewPanel');
        const btn = document.getElementById('f1iobReviewToggle');
        if (!panel || !btn) return;

        btn.addEventListener('click', function () {
            const opened = !panel.classList.toggle('collapsed');
            btn.setAttribute('aria-expanded', String(opened));
            btn.title = opened ? '접기' : '펼치기';
            btn.querySelector('.material-symbols-outlined').textContent =
                opened ? 'expand_less' : 'expand_more';
        });
    }

    // 방향 스위처 (입고 ↔ 출고) — R/L · Kg 스위처와 같은 부품입니다
    function bindSwitcher() {
        const sw = App.elements.switcher;
        if (!sw) return;
        sw.addEventListener('click', function (e) {
            const btn = e.target.closest('.unit-btn');
            if (btn) App.setDirection(btn.dataset.direction);
        });
    }

    const Factory1InoutboundModule = {
        init: function () {
            App.elements.wrapper = document.querySelector('.f1iob-wrapper');
            if (!App.elements.wrapper) return;

            App.elements.title    = document.getElementById('f1iobDirTitle');
            App.elements.basedate = document.getElementById('f1iobBaseDate');
            App.elements.dbstamp  = document.getElementById('f1iobDbStamp');
            App.elements.switcher = document.getElementById('f1iobDirSwitch');

            App.headerApi = window.CommonHeader.init({
                idPrefix: 'f1Iob',
                wrapperSelector: '.gf3-wrapper',
                onDateChange: function (dateStr) {
                    App.loadData(dateStr);
                    if (App.syncDayNav) App.syncDayNav();
                },
                onSave: function () {
                    // 조회 전용 페이지 — 저장할 입력값이 없습니다.
                    // (마스터 모드에서 공지사항을 편집한 경우 모달 안의 [이 공지만 저장]을 사용합니다)
                    alert('입출고 내역은 조회 전용 화면입니다.');
                },
                onExportExcel: function () {
                    const pdfBtn = App.headerApi.elements.excelBtn;
                    const btnInner = pdfBtn.innerHTML;
                    window.CommonPdf.exportElementToPDF({
                        target: document.body,
                        filename: `1공장_입출고내역_${App.headerApi.getCurrentDate()}.pdf`,
                        backgroundColor: '#f5f5f7',
                        hideDuringCapture: [
                            document.getElementById('f3iNoticeTicker'),
                            document.getElementById('f1iobDayPrev'),
                            document.getElementById('f1iobDayNext'),
                            App.headerApi.elements.todayBtn,
                            App.headerApi.elements.editBtn,
                            App.headerApi.elements.saveBtn,
                            pdfBtn
                        ],
                        onBusy: function () {
                            pdfBtn.innerHTML = '<span class="material-symbols-outlined" style="font-size: 16px; margin-right: 4px;">hourglass_empty</span>처리중...';
                            pdfBtn.disabled = true;
                        },
                        onDone: function () {
                            pdfBtn.innerHTML = btnInner;
                            pdfBtn.disabled = false;
                        }
                    });
                }
            });
            if (!App.headerApi) return;

            bindSwitcher();
            bindDayNav();
            bindReviewToggle();

            App.loadData(App.headerApi.getCurrentDate());
        }
    };

    window.Factory1InoutboundModule = Factory1InoutboundModule;

    document.addEventListener('DOMContentLoaded', function () {
        Factory1InoutboundModule.init();
    });
})();
