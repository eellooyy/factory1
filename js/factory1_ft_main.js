/* factory1_ft_main.js — 1공장 FT 모듈 진입점
   ────────────────────────────────────────────────────────────────
   기존에는 factory1_common.js(SPA 라우터)가 헤더를 소유하고
   activate/setEditMode/save/isChanged 인터페이스로 이 모듈을 불렀습니다.

   이제는 이 페이지가 독립된(MPA) 페이지이므로, 3공장의 각 페이지들과
   똑같이 이 모듈이 CommonHeader.init()을 직접 호출해서 헤더(날짜 네비게이션/
   마스터 비밀번호 인증/수정·저장 버튼/공지 티커)를 연결합니다.
   ──────────────────────────────────────────────────────────────── */
(function () {
    'use strict';

    const App = window.Factory1Ft;
    if (!App) return;

    const Factory1FtModule = {
        init: function () {
            App.elements.wrapper = document.querySelector('.f1ft-wrapper');
            if (!App.elements.wrapper) return;

            App.headerApi = window.CommonHeader.init({
                idPrefix: 'f1Ft',
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
                        filename: `1공장_FT일지_${App.headerApi.getCurrentDate()}.pdf`,
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

    window.Factory1FtModule = Factory1FtModule;

    document.addEventListener('DOMContentLoaded', function () {
        Factory1FtModule.init();
    });
})();
