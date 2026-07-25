/* factory1_ilji_main.js — 1공장 급지 일지 모듈 진입점
   ────────────────────────────────────────────────────────────────
   factory1_ft_main.js 와 동일한 패턴으로 CommonHeader.init()을 직접 호출합니다.
   ──────────────────────────────────────────────────────────────── */
(function () {
    'use strict';

    const App = window.Factory1Ilji;
    if (!App) return;

    const Factory1IljiModule = {
        init: function () {
            App.elements.wrapper = document.querySelector('.f1il-wrapper');
            if (!App.elements.wrapper) return;

            App.headerApi = window.CommonHeader.init({
                idPrefix: 'f1Ilji',
                wrapperSelector: '.gf3-wrapper',
                onDateChange: App.loadData,
                onSave: App.saveData,
                onEditModeChange: function (isEdit) {
                    App.setReadOnlyMode(!isEdit);
                },
                onExportExcel: function () {
                    const pdfBtn = App.headerApi.elements.excelBtn;
                    const btnInner = pdfBtn.innerHTML;
                    window.CommonPdf.exportElementToPDF({
                        target: document.body,
                        filename: `1공장_급지일지_${App.headerApi.getCurrentDate()}.pdf`,
                        backgroundColor: '#f5f5f7',
                        hideDuringCapture: [
                            document.getElementById('f3iNoticeTicker'),
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

            App.bindInputFormatters();
            App.bindKeyboardNavigation();
            App.setReadOnlyMode(true); // 페이지 진입 시 항상 보기 모드로 시작

            App.loadData(App.headerApi.getCurrentDate());
        }
    };

    window.Factory1IljiModule = Factory1IljiModule;

    document.addEventListener('DOMContentLoaded', function () {
        Factory1IljiModule.init();
    });
})();
