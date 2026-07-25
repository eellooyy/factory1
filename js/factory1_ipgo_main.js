/* factory1_ipgo_main.js — 1공장 입고 모듈 진입점
   ────────────────────────────────────────────────────────────────
   factory1_ft_io_main.js 와 동일한 패턴으로 CommonHeader.init()을 호출합니다.
   ──────────────────────────────────────────────────────────────── */
(function () {
    'use strict';

    const App = window.Factory1Ipgo;
    if (!App) return;

    const Factory1IpgoModule = {
        init: function () {
            App.elements.wrapper = document.querySelector('.f1ip-wrapper');
            if (!App.elements.wrapper) return;

            App.headerApi = window.CommonHeader.init({
                idPrefix: 'f1Ipgo',
                wrapperSelector: '.gf3-wrapper',
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
                        filename: `1공장_입고_${App.headerApi.getCurrentDate()}.pdf`,
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

            App.initUI(); // 스크롤 잠금 / 클릭 / 키보드 네비게이션 바인딩

            App.loadData(App.headerApi.getCurrentDate());
        }
    };

    window.Factory1IpgoModule = Factory1IpgoModule;

    document.addEventListener('DOMContentLoaded', function () {
        Factory1IpgoModule.init();
    });
})();
