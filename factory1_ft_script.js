(function () {
    'use strict';

    const state = {
        currentDate: null,
        fp: null,
        isEditMode: false
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
        },
        parseNum(value) {
            if (!value) return 0;
            return Number(String(value).replace(/,/g, '').trim()) || 0;
        },
        formatNum(value) {
            if (!value) return '';
            return Number.isInteger(value)
                ? value.toLocaleString()
                : value.toLocaleString(undefined, { maximumFractionDigits: 2 });
        },
        formatSignedNum(value) {
            if (!value) return '';
            const formatted = utils.formatNum(Math.abs(value));
            return value > 0 ? `+${formatted}` : `-${formatted}`;
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

    function getInput(field, key, attr = 'col') {
        return elements.wrapper.querySelector(`.f1ft-input[data-field="${field}"][data-${attr}="${key}"]`);
    }

    function setReadOnlyMode(isReadOnly) {
        elements.wrapper.classList.toggle('edit-mode', !isReadOnly);
        elements.wrapper
            .querySelectorAll('.f1ft-input[data-field="start"], .f1ft-input[data-field="end"], .f1ft-input[data-field="memo"], .f1ft-input[data-field="erp"]')
            .forEach((input) => {
                input.readOnly = isReadOnly;
            });
    }

    function calculateFields() {
        const groups = { A: 0, C: 0, D: 0 };
        const columns = ['A1', 'A2', 'A3', 'A4', 'C1', 'C2', 'D1', 'D2'];

        columns.forEach((col) => {
            const startInput = getInput('start', col);
            const endInput = getInput('end', col);
            const usageInput = getInput('usage', col);
            const start = utils.parseNum(startInput?.value);
            const end = utils.parseNum(endInput?.value);
            const usage = start - end;
            const group = startInput?.dataset.group;

            if (usageInput) {
                usageInput.value = start || end ? utils.formatNum(usage) : '';
            }

            if (group && Object.prototype.hasOwnProperty.call(groups, group)) {
                groups[group] += usage;
            }
        });

        Object.entries(groups).forEach(([group, realUsage]) => {
            const realInput = getInput('real', group, 'group');
            const erpInput = getInput('erp', group, 'group');
            const deltaInput = getInput('delta', group, 'group');
            const diffInput = getInput('diff', group, 'group');
            const erpValue = utils.parseNum(erpInput?.value);
            const baseValue = utils.parseNum(diffInput?.dataset.base);
            const deltaValue = erpValue - realUsage;
            const diffValue = baseValue + deltaValue;

            if (realInput) realInput.value = realUsage ? utils.formatNum(realUsage) : '';
            if (deltaInput) {
                deltaInput.value = deltaValue ? utils.formatSignedNum(deltaValue) : '';
                deltaInput.classList.toggle('delta-positive', deltaValue > 0);
                deltaInput.classList.toggle('delta-negative', deltaValue < 0);
            }
            if (diffInput) diffInput.value = erpValue || realUsage || baseValue ? utils.formatNum(diffValue) : '';
        });
    }

    function toggleEditMode() {
        state.isEditMode = !state.isEditMode;
        setReadOnlyMode(!state.isEditMode);
        elements.editBtn.textContent = state.isEditMode ? '보기' : '수정';
        elements.saveBtn.disabled = !state.isEditMode;
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
            onChange(_, dateStr) {
                if (!dateStr) return;
                setDate(dateStr);
            }
        });
    }

    function bindDateEvents() {
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
    }

    function bindInputEvents() {
        elements.wrapper.querySelectorAll('.numeric-input').forEach((input) => {
            input.addEventListener('focus', function () {
                if (this.readOnly) return;
                this.value = this.value.replace(/,/g, '');
                this.select();
            });

            input.addEventListener('input', calculateFields);

            input.addEventListener('blur', function () {
                const value = utils.parseNum(this.value);
                this.value = value ? utils.formatNum(value) : '';
                calculateFields();
            });
        });
    }

    function bindButtonEvents() {
        elements.editBtn.addEventListener('click', toggleEditMode);

        elements.saveBtn.addEventListener('click', () => {
            if (!state.isEditMode) return;
            toggleEditMode();
        });

        elements.excelBtn.addEventListener('click', () => {
            alert('엑셀 출력 기능은 하단 레이아웃과 DB 연결을 정리한 뒤 활성화할 예정입니다.');
        });
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

        elements.editBtn.disabled = false;
        syncDateLabel();
        initCalendar();
        bindDateEvents();
        bindInputEvents();
        bindButtonEvents();
        setReadOnlyMode(true);
        calculateFields();
    });
})();
