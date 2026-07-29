/* factory1_inventory_io_main.js — 1공장 재고 종합 모듈 진입점
   ────────────────────────────────────────────────────────────────
   factory1_ft_io_main.js 와 동일한 패턴으로 CommonHeader.init()을 호출합니다.
   표의 숫자는 전부 다른 화면에서 온 것이라 여기서 고칠 수 없고, 사람이 적는
   값은 우측의 '재고 확인' 상태(확인 / 보류 / 미확인) 하나뿐입니다. 그래서
   수정 → 선택 → 저장 순서로 다른 페이지들과 같게 동작합니다.
   ──────────────────────────────────────────────────────────────── */
(function () {
    'use strict';

    const App = window.Factory1InventoryIo;
    if (!App) return;

    const Factory1InventoryIoModule = {
        init: function () {
            App.elements.wrapper = document.querySelector('.f1inv-wrapper');
            if (!App.elements.wrapper) return;

            App.elements.blocks = document.getElementById('f1invBlocks');
            App.elements.subtitle = document.getElementById('f1invSubtitle');
            App.elements.status = document.getElementById('f1invStatus');

            App.bindStatus();
            App.renderStatus();

            App.headerApi = window.CommonHeader.init({
                idPrefix: 'f1Inv',
                wrapperSelector: '.gf3-wrapper',
                onDateChange: App.loadData,
                onEditModeChange: App.setEditMode,
                onSave: App.saveData,
                onExportExcel: function () {
                    const pdfBtn = App.headerApi.elements.excelBtn;
                    const btnInner = pdfBtn.innerHTML;
                    window.CommonPdf.exportElementToPDF({
                        target: document.body,
                        filename: `1공장_재고종합_${App.headerApi.getCurrentDate()}.pdf`,
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

            App.loadData(App.headerApi.getCurrentDate());
        }
    };

    window.Factory1InventoryIoModule = Factory1InventoryIoModule;

    document.addEventListener('DOMContentLoaded', function () {
        Factory1InventoryIoModule.init();
    });
})();
