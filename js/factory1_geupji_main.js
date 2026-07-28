/* factory1_geupji_main.js — 1공장 급지 재고 모듈 진입점
   ────────────────────────────────────────────────────────────────
   factory1_ft_main.js 와 동일한 패턴으로 CommonHeader.init()을 직접 호출합니다.
   ──────────────────────────────────────────────────────────────── */
(function () {
    'use strict';

    const App = window.Factory1GeupjiInv;
    if (!App) return;

    const Factory1GeupjiInventoryModule = {
        init: async function () {
            App.elements.wrapper = document.querySelector('.f1il-wrapper');
            if (!App.elements.wrapper) return;

            App.headerApi = window.CommonHeader.init({
                idPrefix: 'f1Geupji',
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
                        filename: `1공장_급지재고_${App.headerApi.getCurrentDate()}.pdf`,
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

            /* 용지 마스터를 먼저 읽습니다. 드롭다운 옵션이 여기서 만들어지므로
               이게 끝나기 전에는 화면에 채울 값도, 계산할 롤당 중량도 없습니다. */
            const ok = await App.loadPaperMaster();
            if (!ok) {
                alert('용지 마스터를 불러오지 못했습니다.\n급지대 드롭다운과 재고 계산이 동작하지 않습니다.\n(콘솔에 원인이 찍혀 있습니다)');
            }

            App.bindInputFormatters();
            App.bindKeyboardNavigation();
            App.bindAllocPopovers();
            App.setReadOnlyMode(true); // 페이지 진입 시 항상 보기 모드로 시작

            App.loadData(App.headerApi.getCurrentDate());
        }
    };

    window.Factory1GeupjiInventoryModule = Factory1GeupjiInventoryModule;

    document.addEventListener('DOMContentLoaded', function () {
        Factory1GeupjiInventoryModule.init();
    });
})();
