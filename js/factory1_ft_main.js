/* factory1_ft_main.js — 1공장 FT 진입점 · 헤더 초기화 · 이벤트 연결 */
(function () {
    'use strict';

    const App = window.Factory1Ft;
    if (!App) return;

    // ── 날짜 라벨 동기화 ─────────────────────────────────────────────────────
    function syncDateLabel() {
        if (App.elements.dateText) {
            App.elements.dateText.textContent = App.utils.formatKoDate(App.state.currentDate);
        }
    }

    // ── 날짜 변경 ─────────────────────────────────────────────────────────────
    function setDate(dateStr) {
        App.state.currentDate = dateStr;
        syncDateLabel();

        // flatpickr 동기화
        const fp = App.state.fp;
        if (fp && fp.selectedDates[0]) {
            const selected = fp.formatDate(fp.selectedDates[0], 'Y-m-d');
            if (selected !== dateStr) fp.setDate(dateStr, false);
        }

        App.loadData(dateStr);
    }

    // ── 저장 안내 확인 ────────────────────────────────────────────────────────
    function confirmLeave() {
        if (App.state.isChanged) {
            return confirm('저장하지 않은 변경사항이 있습니다.\n저장하지 않고 이동하시겠습니까?');
        }
        return true;
    }

    // ── 수정/보기 모드 토글 ───────────────────────────────────────────────────
    function toggleEditMode() {
        App.state.isEditMode = !App.state.isEditMode;
        App.setReadOnlyMode(!App.state.isEditMode);
        App.elements.editBtn.textContent = App.state.isEditMode ? '보기' : '수정';
        App.elements.saveBtn.disabled = !App.state.isEditMode;
    }

    // ── flatpickr 캘린더 초기화 ───────────────────────────────────────────────
    function initCalendar() {
        App.state.fp = flatpickr('#f1ftFlatpickr', {
            locale: 'ko',
            dateFormat: 'Y-m-d',
            defaultDate: App.state.currentDate,
            clickOpens: false,
            allowInput: false,
            positionElement: App.elements.dateText,
            position: 'auto center',
            onReady(_, __, instance) {
                instance.calendarContainer.style.marginTop = '10px';
            },
            onChange(_, dateStr) {
                if (!dateStr) return;
                if (App.state.isChanged) {
                    if (!confirm('저장되지 않은 변경사항이 있습니다.\n저장하지 않고 선택한 날짜로 이동하시겠습니까?')) {
                        App.state.fp.setDate(App.state.currentDate, false);
                        return;
                    }
                }
                setDate(dateStr);
            },
            onClose() {
                if (App.elements.dateText) {
                    App.elements.dateText.classList.add('just-closed');
                    setTimeout(() => App.elements.dateText.classList.remove('just-closed'), 200);
                }
            }
        });
    }

    // ── 날짜 버튼 이벤트 바인딩 ──────────────────────────────────────────────
    function bindDateEvents() {
        App.elements.dateText.addEventListener('click', e => {
            e.stopPropagation();
            if (!App.state.fp) return;
            if (App.elements.dateText.classList.contains('just-closed')) return;
            App.state.fp.isOpen ? App.state.fp.close() : App.state.fp.open();
        });

        App.elements.prevBtn.addEventListener('click', () => {
            if (!confirmLeave()) return;
            setDate(App.utils.addDays(App.state.currentDate, -1));
        });

        App.elements.nextBtn.addEventListener('click', () => {
            if (!confirmLeave()) return;
            setDate(App.utils.addDays(App.state.currentDate, 1));
        });

        App.elements.todayBtn.addEventListener('click', () => {
            const today = App.utils.getTodayStr();
            if (App.state.currentDate !== today) {
                if (!confirmLeave()) return;
                setDate(today);
            }
        });
    }

    // ── 메뉴 드롭다운 이벤트 바인딩 추가 ────────────────────────────────────────
    function bindDropdownEvents() {
        const toggleDropdown = (e) => {
            e.stopPropagation();
            App.elements.dropdown.classList.toggle('show');
        };

        // 삼선 메뉴 및 메인 제목 클릭 시 오픈 토글
        App.elements.menuBtn.addEventListener('click', toggleDropdown);
        App.elements.mainTitle.addEventListener('click', toggleDropdown);

        // 드롭다운 바깥 영역 클릭 시 메뉴 자동 닫힘
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.f1ft-title-area')) {
                App.elements.dropdown.classList.remove('show');
            }
        });

        // 드롭다운 메뉴 클릭 시 미저장 경고(컨펌) 처리 연동
        App.elements.dropdown.querySelectorAll('.f1ft-dropdown-item').forEach(item => {
            item.addEventListener('click', (e) => {
                // 현재 활성화된 페이지인 경우 단순 닫기
                if (item.classList.contains('active')) {
                    e.preventDefault();
                    App.elements.dropdown.classList.remove('show');
                    return;
                }
                // 변경 사항이 있는데 이동을 취소한 경우 
                if (!confirmLeave()) {
                    e.preventDefault();
                }
            });
        });
    }

    // ── 버튼 이벤트 바인딩 ───────────────────────────────────────────────────
    function bindButtonEvents() {
        App.elements.editBtn.addEventListener('click', () => {
            if (App.state.isEditMode && !confirmLeave()) return;
            toggleEditMode();
        });

        App.elements.saveBtn.addEventListener('click', () => {
            if (!App.state.isEditMode) return;
            App.saveData();
        });

        App.elements.excelBtn.addEventListener('click', () => {
            alert('엑셀 출력 기능은 하단 레이아웃과 DB 연결을 정리한 뒤 활성화할 예정입니다.');
        });

        window.addEventListener('beforeunload', e => {
            if (App.state.isChanged) {
                e.preventDefault();
                e.returnValue = '';
            }
        });
    }

    // ── 모듈 공개 API ─────────────────────────────────────────────────────────
    const Factory1FtModule = {
        init() {
            // elements 캐시 및 새로 추가된 엘리먼트 바인딩 추가
            App.elements.wrapper   = document.querySelector('.f1ft-wrapper');
            App.elements.menuBtn   = document.getElementById('f1ftMenuBtn');
            App.elements.mainTitle = document.getElementById('f1ftMainTitle');
            App.elements.dropdown  = document.getElementById('f1ftDropdown');
            App.elements.dateText  = document.getElementById('f1ftDateText');
            App.elements.prevBtn   = document.getElementById('f1ftPrevBtn');
            App.elements.nextBtn   = document.getElementById('f1ftNextBtn');
            App.elements.todayBtn  = document.getElementById('f1ftTodayBtn');
            App.elements.editBtn   = document.getElementById('f1ftEditBtn');
            App.elements.saveBtn   = document.getElementById('f1ftSaveBtn');
            App.elements.excelBtn  = document.getElementById('f1ftExcelBtn');

            if (!App.elements.wrapper) return;

            // 초기 상태
            const today = App.utils.getTodayStr();
            App.state.currentDate = today;
            App.elements.editBtn.disabled = true;

            initCalendar();
            bindDateEvents();
            bindDropdownEvents(); // 드롭다운 리스너 초기화
            App.bindInputFormatters();      // render.js
            App.bindKeyboardNavigation();  // render.js
            bindButtonEvents();
            App.setReadOnlyMode(true);     // render.js

            setDate(today);  // 초기 데이터 로드 (api.js)
        },
        destroy() {
            if (App.state.fp) App.state.fp.destroy();
        }
    };

    window.Factory1FtModule = Factory1FtModule;

    document.addEventListener('DOMContentLoaded', function () {
        Factory1FtModule.init();
    });

})();