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

            App.elements.scroll = document.querySelector('.f1inv-table-scroll');
            App.elements.head = document.getElementById('f1invHead');
            App.elements.blocks = document.getElementById('f1invBlocks');
            App.elements.subtitle = document.getElementById('f1invSubtitle');
            App.elements.status = document.getElementById('f1invStatus');

            App.bindStatus();
            App.bindCellSelect();
            if (App.bindLedger) App.bindLedger();   // 전자신문 대장 대조 팝업
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
                            // 대조 버튼은 조작용이라 뺍니다. 표 안의 대장 배지는
                            // 그날 대조 결과라 그대로 찍힙니다.
                            document.getElementById('f1invLedgerBtn'),
                            App.headerApi.elements.todayBtn,
                            App.headerApi.elements.editBtn,
                            App.headerApi.elements.saveBtn,
                            pdfBtn
                        ],
                        /* 화면에서는 표를 한 화면 높이로 가두고 머리글을 붙여
                           두지만, 그대로 찍으면 스크롤 밖의 행이 잘려 나갑니다.
                           캡쳐하는 동안만 제한을 풀어 전체를 펼칩니다. */
                        onBusy: function () {
                            App.elements.wrapper.classList.add('f1inv-capturing');
                            pdfBtn.innerHTML = '<span class="material-symbols-outlined" style="font-size: 16px; margin-right: 4px;">hourglass_empty</span>처리중...';
                            pdfBtn.disabled = true;
                        },
                        onDone: function () {
                            App.elements.wrapper.classList.remove('f1inv-capturing');
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
