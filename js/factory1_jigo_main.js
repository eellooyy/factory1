/* factory1_jigo_main.js — 1공장 지고 재고 페이지 진입점
   ────────────────────────────────────────────────────────────────
   factory1_ipgo_main.js 와 같은 패턴으로 CommonHeader.init() 을 호출합니다.

   입고 페이지와 마찬가지로 requireMaster: true 입니다. 사람이 직접 적는
   숫자가 그대로 재고가 되는 화면이라, admin(edit0000) 계정에는 열지
   않습니다. (권한 정리는 나중에 페이지·테이블 전체 검수 때 한 번에 합니다)
   ──────────────────────────────────────────────────────────────── */
(function () {
    'use strict';

    const App = window.Factory1JigoInv;
    if (!App) return;

    /* 저장 — DB 연결 전이라 아직 보낼 곳이 없습니다.
       테이블이 확정되면 이 함수의 몸통을 factory1_jigo_api.js 의
       App.saveData 로 옮기고 여기서는 호출만 남깁니다. dirty 집합의
       모양('층|날짜|itemCode')이 곧 보낼 행의 모양입니다. */
    function saveData() {
        const rows = Array.from(App.state.dirty).map(key => {
            const [floor, date, itemCode] = key.split('|');
            const bucket = App.state.values[floor] || {};
            return {
                floor: floor,
                inv_date: date,
                item_code: itemCode,
                roll_qty: (bucket[date] && bucket[date][itemCode]) || 0
            };
        });

        if (!rows.length) {
            alert('변경된 칸이 없습니다.');
            return;
        }

        // 어떤 값이 나갈지 눈으로 확인할 수 있게 남겨 둡니다.
        console.table(rows);
        alert(`아직 DB 연결 전입니다. (레이아웃 확인 단계)\n\n저장 대상 ${rows.length}칸을 콘솔에 출력했습니다.`);
    }

    const Factory1JigoInventoryModule = {
        init: function () {
            App.elements.wrapper = document.querySelector('.f1jg-wrapper');
            if (!App.elements.wrapper) return;

            App.headerApi = window.CommonHeader.init({
                idPrefix: 'f1Jigo',
                wrapperSelector: '.gf3-wrapper',
                requireMaster: true,
                onDateChange: App.loadData,
                onSave: saveData,
                onEditModeChange: function (isEdit) {
                    if (App.setReadOnlyMode) App.setReadOnlyMode(!isEdit);
                },
                onExportExcel: function () {
                    const pdfBtn = App.headerApi.elements.excelBtn;
                    const btnInner = pdfBtn.innerHTML;
                    window.CommonPdf.exportElementToPDF({
                        target: document.body,
                        filename: `1공장_지고재고_${App.headerApi.getCurrentDate()}.pdf`,
                        backgroundColor: '#f5f5f7',
                        hideDuringCapture: [
                            document.getElementById('f3iNoticeTicker'),
                            document.getElementById('f1jgScrollToggleWrap'),
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

            App.initUI();   // 스크롤 잠금 / 클릭 / 단위 스위처 / 입력 바인딩

            /* 공통 헤더는 기본값이 '어제'이지만 이 페이지는 '오늘'로 시작합니다.
               오늘 센 값을 적는 게 이 화면의 일상적인 용도입니다.
               (false = 데이터 재조회 없이 표시만 갱신 → 바로 아래에서 한 번만 로드) */
            const today = (window.Factory3Utils || window.CommonUtils).getTodayStr();
            App.headerApi.setCurrentDate(today, false);

            App.loadData(App.headerApi.getCurrentDate());
        }
    };

    window.Factory1JigoInventoryModule = Factory1JigoInventoryModule;

    document.addEventListener('DOMContentLoaded', function () {
        Factory1JigoInventoryModule.init();
    });
})();
