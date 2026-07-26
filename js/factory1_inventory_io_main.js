/* factory1_inventory_io_main.js — 1공장 재고 종합 모듈 진입점
   ────────────────────────────────────────────────────────────────
   factory1_ft_io_main.js 와 동일한 패턴으로 CommonHeader.init()을 호출합니다.
   이 페이지는 여러 테이블의 데이터를 모아 보여주기만 하는 조회 전용 화면이라
   편집 폼이 없습니다. (상단 수정/저장 버튼은 마스터 모드의 공지사항 편집용으로
   다른 페이지들과 동일하게 유지합니다)
   ──────────────────────────────────────────────────────────────── */
(function () {
    'use strict';

    const App = window.Factory1InventoryIo;
    if (!App) return;

    const Factory1InventoryIoModule = {
        init: function () {
            App.elements.wrapper = document.querySelector('.f1inv-wrapper');
            if (!App.elements.wrapper) return;

            App.elements.body = document.getElementById('f1invBody');
            App.elements.subtitle = document.getElementById('f1invSubtitle');

            App.headerApi = window.CommonHeader.init({
                idPrefix: 'f1Inv',
                wrapperSelector: '.gf3-wrapper',
                onDateChange: App.loadData,
                onSave: function () {
                    // 조회 전용 페이지 — 저장할 입력값이 없습니다.
                    // (마스터 모드에서 공지사항을 편집한 경우 모달 안의 [이 공지만 저장]을 사용합니다)
                    alert('재고 종합은 조회 전용 화면입니다.');
                },
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
