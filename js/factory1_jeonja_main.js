/* factory1_jeonja_main.js — 1공장 전자신문 (용지재고대장) 진입점
   ────────────────────────────────────────────────────────────────
   factory1_paperuse_main.js 와 같은 패턴입니다. 조회 전용이라 편집 폼이
   없고, 상단 수정/저장 버튼은 다른 조회 페이지와 동일하게 마스터 모드의
   공지사항 편집용으로 남겨 둡니다.

   ※ 지금은 레이아웃 확인 단계라 데이터가 constant.js 의 표본입니다.
     뷰가 붙으면 factory1_jeonja_api.js 를 추가하고 render.js 의
     loadData() 만 비동기로 바꾸면 됩니다. 이 파일은 손댈 것이 없습니다.
   ──────────────────────────────────────────────────────────────── */
(function () {
    'use strict';

    const App = window.Factory1Jeonja;
    if (!App) return;

    const Factory1JeonjaModule = {
        init: function () {
            App.elements.wrapper = document.querySelector('.f1jn-wrapper');
            if (!App.elements.wrapper) return;

            App.headerApi = window.CommonHeader.init({
                idPrefix: 'f1Jeonja',
                wrapperSelector: '.gf3-wrapper',
                onDateChange: function (dateStr) {
                    App.loadData(dateStr);
                },
                onSave: function () {
                    alert('전자신문 원장은 거래처 원장을 그대로 보여주는 조회 전용 화면입니다.');
                },
                onExportExcel: function () {
                    const pdfBtn = App.headerApi.elements.excelBtn;
                    const btnInner = pdfBtn.innerHTML;
                    window.CommonPdf.exportElementToPDF({
                        target: document.body,
                        filename: `1공장_전자신문_용지재고대장_${App.state.currentMonth || ''}.pdf`,
                        backgroundColor: '#f5f5f7',
                        hideDuringCapture: [
                            document.getElementById('f3iNoticeTicker'),
                            document.getElementById('f1jnScrollToggleWrap'),
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

            /* 공통 헤더 기본값이 '어제'입니다. 이 표는 달 단위라 어느 날로
               열든 같은 달이 나오고, 그 날 줄만 잡혀 있으면 됩니다.
               (재고실사처럼 '어제'를 기준일로 삼는 화면과 줄이 맞습니다)

               단 ?d=YYYY-MM-DD 로 들어오면 그 날짜로 엽니다. 재고실사의
               대조 팝업에서 '전체 보기'로 넘어올 때 쓰는 길이라, 보고 있던
               날과 다른 달이 열리면 대조가 끊깁니다. 오늘 이후 날짜는
               공통 헤더가 막고 있으므로 무시합니다. */
            const asked = new URLSearchParams(location.search).get('d');
            const today = window.Factory3Utils.getTodayStr();
            const start = (asked && /^\d{4}-\d{2}-\d{2}$/.test(asked) && asked <= today)
                ? asked
                : App.headerApi.getCurrentDate();

            if (start !== App.headerApi.getCurrentDate()) {
                App.headerApi.setCurrentDate(start);   // 표까지 같이 그려집니다
            } else {
                App.loadData(start);
            }
        }
    };

    window.Factory1JeonjaModule = Factory1JeonjaModule;

    document.addEventListener('DOMContentLoaded', function () {
        Factory1JeonjaModule.init();
    });
})();
