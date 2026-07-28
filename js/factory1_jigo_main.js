/* factory1_jigo_main.js — 1공장 지고 재고 페이지 진입점
   ────────────────────────────────────────────────────────────────
   factory1_ipgo_main.js 와 같은 패턴으로 CommonHeader.init() 을 호출합니다.

   입고 페이지와 마찬가지로 requireMaster: true 입니다. 사람이 직접 적는
   숫자가 그대로 재고가 되는 화면이라, admin(edit0000) 계정에는 열지
   않습니다. (권한 정리는 나중에 페이지·테이블 전체 검수 때 한 번에 합니다)
   ──────────────────────────────────────────────────────────────── */
(function () {
    'use strict';

    const App = window.Factory1JigoInv;
    if (!App) return;

    const Factory1JigoInventoryModule = {
        init: function () {
            App.elements.wrapper = document.querySelector('.f1jg-wrapper');
            if (!App.elements.wrapper) return;

            App.headerApi = window.CommonHeader.init({
                idPrefix: 'f1Jigo',
                wrapperSelector: '.gf3-wrapper',
                requireMaster: true,
                onDateChange: App.loadData,
                onSave: App.saveData,
                onEditModeChange: function (isEdit) {
                    if (App.setReadOnlyMode) App.setReadOnlyMode(!isEdit);
                },
                onExportExcel: function () {
                    const pdfBtn = App.headerApi.elements.excelBtn;
                    const btnInner = pdfBtn.innerHTML;
                    window.CommonPdf.exportElementToPDF({
                        target: document.body,
                        filename: `1공장_지고재고_${App.headerApi.getCurrentDate()}.pdf`,
                        backgroundColor: '#f5f5f7',
                        hideDuringCapture: [
                            document.getElementById('f3iNoticeTicker'),
                            document.getElementById('f1jgScrollToggleWrap'),
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

            App.initUI();   // 스크롤 잠금 / 클릭 / 단위 스위처 / 입력 바인딩

            /* 공통 헤더는 기본값이 '어제'이지만 이 페이지는 '오늘'로 시작합니다.
               오늘 센 값을 적는 게 이 화면의 일상적인 용도입니다.
               (false = 데이터 재조회 없이 표시만 갱신 → 바로 아래에서 한 번만 로드) */
            const today = (window.Factory3Utils || window.CommonUtils).getTodayStr();
            App.headerApi.setCurrentDate(today, false);

            /* 롤당 중량을 먼저 받아 둡니다. Kg 스위처가 첫 클릭부터 제대로 나와야
               하고, 실패해도 롤 표시는 멀쩡하므로 결과와 무관하게 표를 그립니다. */
            App.loadRollKg().then(function () {
                App.loadData(App.headerApi.getCurrentDate());
            });
        }
    };

    window.Factory1JigoInventoryModule = Factory1JigoInventoryModule;

    document.addEventListener('DOMContentLoaded', function () {
        Factory1JigoInventoryModule.init();
    });
})();
