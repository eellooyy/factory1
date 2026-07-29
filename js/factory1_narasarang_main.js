/* factory1_narasarang_main.js — 1공장 나라사랑(48.8g) 페이지 진입점
   ────────────────────────────────────────────────────────────────
   지고 재고 · 입고 페이지와 마찬가지로 requireMaster: true 입니다.
   사람이 적은 잔량이 그대로 재고(kg)가 되는 화면이라 admin(edit0000) 에는
   열지 않습니다. (권한 정리는 나중에 전체 검수 때 한 번에 합니다)

   헤더 날짜는 여기서 **연도를 고르는 손잡이**입니다. 표는 그 날짜가 속한
   해를 통째로 보여주고, 날짜가 표에 있으면 그 줄이 잡힙니다.
   [+ 이 날짜 추가] 도 이 날짜를 씁니다 — 달력을 하나 더 두지 않으려는 것이고,
   추가할 날짜를 고르는 동안 그 날짜가 어디쯤인지 표에서 바로 보입니다.
   ──────────────────────────────────────────────────────────────── */
(function () {
    'use strict';

    const App = window.Factory1Narasarang;
    if (!App) return;

    const Factory1NarasarangModule = {
        init: function () {
            App.elements.wrapper = document.querySelector('.f1ns-wrapper');
            if (!App.elements.wrapper) return;

            App.headerApi = window.CommonHeader.init({
                idPrefix: 'f1Ns',
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
                        filename: `1공장_나라사랑_${App.state.year}.pdf`,
                        backgroundColor: '#f5f5f7',
                        hideDuringCapture: [
                            document.getElementById('f3iNoticeTicker'),
                            document.getElementById('f1nsAddDateBtn'),
                            document.getElementById('f1nsScrollToggleWrap'),
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

            App.initUI();

            /* 롤당 중량을 먼저 받습니다. 재고(kg) 가 이 계수로 만들어지므로,
               표를 먼저 그리면 첫 화면의 kg 열이 대비값으로 찍혔다가 조용히
               바뀝니다. 실패해도 상수의 대비값으로 계속 그립니다. */
            App.loadRollKg().then(function () {
                App.loadData(App.headerApi.getCurrentDate());
            });
        }
    };

    window.Factory1NarasarangModule = Factory1NarasarangModule;

    document.addEventListener('DOMContentLoaded', function () {
        Factory1NarasarangModule.init();
    });
})();
