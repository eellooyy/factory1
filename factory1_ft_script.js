(function () {
    'use strict';

    const state = {
        currentDate: null,
        fp: null
    };

    const elements = {};

    const utils = {
        getTodayStr() {
            const d = new Date();
            return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        },
        addDays(dateStr, days) {
            const d = new Date(`${dateStr}T00:00:00`);
            d.setDate(d.getDate() + days);
            return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        },
        formatKoDate(dateStr) {
            if (!dateStr) return '';
            const d = new Date(`${dateStr}T00:00:00`);
            const days = ['일', '월', '화', '수', '목', '금', '토'];
            return `${d.getFullYear()}년 ${String(d.getMonth() + 1).padStart(2, '0')}월 ${String(d.getDate()).padStart(2, '0')}일 (${days[d.getDay()]})`;
        }
    };

    function syncDateLabel() {
        if (elements.dateText) {
            elements.dateText.textContent = utils.formatKoDate(state.currentDate);
        }
    }

    function setDate(dateStr) {
        state.currentDate = dateStr;
        syncDateLabel();

        if (state.fp && state.fp.selectedDates[0]) {
            const selected = state.fp.formatDate(state.fp.selectedDates[0], 'Y-m-d');
            if (selected !== dateStr) {
                state.fp.setDate(dateStr, false);
            }
        }
    }

    function initCalendar() {
        state.fp = flatpickr('#f1ftFlatpickr', {
            locale: 'ko',
            dateFormat: 'Y-m-d',
            defaultDate: state.currentDate,
            clickOpens: false,
            allowInput: false,
            positionElement: elements.dateText,
            position: 'auto center',
            onReady(_, __, instance) {
                instance.calendarContainer.style.marginTop = '10px';
            },
            onChange(selectedDates, dateStr) {
                if (!dateStr) return;
                setDate(dateStr);
            }
        });
    }

    function bindEvents() {
        elements.dateText.addEventListener('click', (event) => {
            event.stopPropagation();
            if (!state.fp) return;

            if (state.fp.isOpen) {
                state.fp.close();
            } else {
                state.fp.open();
            }
        });

        elements.prevBtn.addEventListener('click', () => {
            setDate(utils.addDays(state.currentDate, -1));
        });

        elements.nextBtn.addEventListener('click', () => {
            setDate(utils.addDays(state.currentDate, 1));
        });

        elements.todayBtn.addEventListener('click', () => {
            const today = utils.getTodayStr();
            if (state.currentDate !== today) {
                setDate(today);
            }
        });

        const pendingAlert = (label) => {
            alert(`${label} 기능은 하단 레이아웃과 DB 연결을 정리한 뒤 활성화할 예정입니다.`);
        };

        elements.editBtn.addEventListener('click', () => pendingAlert('수정'));
        elements.saveBtn.addEventListener('click', () => pendingAlert('저장'));
        elements.excelBtn.addEventListener('click', () => pendingAlert('엑셀 출력'));
    }

    document.addEventListener('DOMContentLoaded', () => {
        document.title = '1공장 FT 일지';

        elements.wrapper = document.querySelector('.f1ft-wrapper');
        elements.dateText = document.getElementById('f1ftDateText');
        elements.prevBtn = document.getElementById('f1ftPrevBtn');
        elements.nextBtn = document.getElementById('f1ftNextBtn');
        elements.todayBtn = document.getElementById('f1ftTodayBtn');
        elements.editBtn = document.getElementById('f1ftEditBtn');
        elements.saveBtn = document.getElementById('f1ftSaveBtn');
        elements.excelBtn = document.getElementById('f1ftExcelBtn');

        const today = utils.getTodayStr();
        state.currentDate = utils.addDays(today, -1);
        syncDateLabel();

        initCalendar();
        bindEvents();
    });
})();
