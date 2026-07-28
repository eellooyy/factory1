/* factory1_inoutbound_main.js — 1공장 전산 입출고 상세 내역 진입점
   ────────────────────────────────────────────────────────────────
   factory1_inventory_io_main.js 와 같은 패턴입니다. 공정 PC 가 스캔한
   기록을 그대로 보여주기만 하는 조회 전용 화면이라 편집 폼이 없습니다.
   (상단 수정/저장 버튼은 마스터 모드의 공지사항 편집용으로 다른 페이지들과
    동일하게 유지합니다)

   기준일은 공통 헤더의 기본값(어제)을 그대로 씁니다. 지고 재고처럼 따로
   당겨 놓지 않는 이유는, 이 화면의 숫자가 '어제 작업의 결과'가 아니라
   '그 날짜에 실제로 찍힌 스캔'이기 때문입니다. 오늘 것을 보고 싶으면
   [오늘] 버튼을 누르면 됩니다.
   ──────────────────────────────────────────────────────────────── */
(function () {
    'use strict';

    const App = window.Factory1Inoutbound;
    if (!App) return;

    const Factory1InoutboundModule = {
        init: function () {
            App.elements.wrapper = document.querySelector('.f1iob-wrapper');
            if (!App.elements.wrapper) return;

            App.elements.subtitle = document.getElementById('f1iobSubtitle');
            App.elements.filterWrap = document.getElementById('f1iobFilter');

            App.headerApi = window.CommonHeader.init({
                idPrefix: 'f1Iob',
                wrapperSelector: '.gf3-wrapper',
                onDateChange: App.loadData,
                onSave: function () {
                    // 조회 전용 페이지 — 저장할 입력값이 없습니다.
                    // (마스터 모드에서 공지사항을 편집한 경우 모달 안의 [이 공지만 저장]을 사용합니다)
                    alert('전산 입출고 상세 내역은 조회 전용 화면입니다.');
                },
                onExportExcel: function () {
                    const pdfBtn = App.headerApi.elements.excelBtn;
                    const btnInner = pdfBtn.innerHTML;
                    window.CommonPdf.exportElementToPDF({
                        target: document.body,
                        filename: `1공장_전산입출고_${App.headerApi.getCurrentDate()}.pdf`,
                        backgroundColor: '#f5f5f7',
                        hideDuringCapture: [
                            document.getElementById('f3iNoticeTicker'),
                            document.getElementById('f1iobFilter'),
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

            // 상태 필터 스위처 — 표시만 거르고 요약 카드의 숫자는 건드리지 않습니다
            if (App.elements.filterWrap) {
                App.elements.filterWrap.addEventListener('click', function (e) {
                    const btn = e.target.closest('.f1iob-filter-btn');
                    if (btn) App.setFilter(btn.dataset.filter);
                });
            }

            App.loadData(App.headerApi.getCurrentDate());
        }
    };

    window.Factory1InoutboundModule = Factory1InoutboundModule;

    document.addEventListener('DOMContentLoaded', function () {
        Factory1InoutboundModule.init();
    });
})();
