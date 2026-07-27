/* factory1_paperuse_main.js — 1공장 사용량 페이지 진입점
   ────────────────────────────────────────────────────────────────
   factory1_inventory_io_main.js 와 같은 패턴으로 CommonHeader.init() 을
   호출합니다. 조회 전용이라 편집 폼이 없습니다. 상단 수정/저장 버튼은
   다른 페이지와 동일하게 마스터 모드의 공지사항 편집용으로 남겨 둡니다.

   ※ 2층(매체별 사용량)이 붙으면 이 파일은 그대로 두고
     factory1_mediause_main.js 를 따로 추가합니다. 상단 헤더는 이 모듈이
     소유하고, 2층 모듈은 날짜 변경 통지만 받아 가면 됩니다.
   ──────────────────────────────────────────────────────────────── */
(function () {
    'use strict';

    const App = window.Factory1PaperUse;
    if (!App) return;

    const Factory1UsageModule = {
        init: function () {
            App.elements.wrapper = document.querySelector('.f1us-wrapper');
            if (!App.elements.wrapper) return;

            App.headerApi = window.CommonHeader.init({
                idPrefix: 'f1Use',
                wrapperSelector: '.gf3-wrapper',
                onDateChange: function (dateStr) {
                    App.loadData(dateStr);
                    // 2층이 붙으면 여기서 함께 갱신합니다.
                    if (window.Factory1MediaUse && window.Factory1MediaUse.loadData) {
                        window.Factory1MediaUse.loadData(dateStr);
                    }
                },
                onSave: function () {
                    alert('사용량은 ERP 실적을 그대로 보여주는 조회 전용 화면입니다.');
                },
                onExportExcel: function () {
                    const pdfBtn = App.headerApi.elements.excelBtn;
                    const btnInner = pdfBtn.innerHTML;
                    window.CommonPdf.exportElementToPDF({
                        target: document.body,
                        filename: `1공장_사용량_${App.headerApi.getCurrentDate()}.pdf`,
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

            App.initUI();

            // 공통 헤더 기본값이 '어제'입니다. 사용량은 전일 실적이 최신이라
            // 그대로 씁니다. (입고 페이지처럼 '오늘'로 당기지 않습니다)
            App.loadData(App.headerApi.getCurrentDate());
        }
    };

    window.Factory1UsageModule = Factory1UsageModule;

    document.addEventListener('DOMContentLoaded', function () {
        Factory1UsageModule.init();
    });
})();
