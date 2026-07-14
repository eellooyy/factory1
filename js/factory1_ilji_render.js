/* factory1_ilji_render.js — 1공장 일지 UI 계산 · 렌더링 · 입력 이벤트 바인딩 */
(function () {
    'use strict';

    const App = window.Factory1Ilji;
    if (!App) return;

    // ── 헬퍼: 요소 조회 ───────────────────────────────────────────────────────
    function getMachineEl(field, machine, col) {
        const wrapper = App.elements.wrapper;
        if (!wrapper) return null;
        return wrapper.querySelector(`.f1il-cell[data-field="${field}"][data-machine="${machine}"][data-col="${col}"]`);
    }
    function getNoteEl(machine, typeKey) {
        const wrapper = App.elements.wrapper;
        if (!wrapper) return null;
        return wrapper.querySelector(`.f1il-note[data-machine="${machine}"][data-type="${typeKey}"]`);
    }
    function getSubtotalEl(machine) {
        const wrapper = App.elements.wrapper;
        if (!wrapper) return null;
        return wrapper.querySelector(`.f1il-subtotal[data-machine="${machine}"]`);
    }
    function getPanelEl(field, typeKey) {
        const wrapper = App.elements.wrapper;
        if (!wrapper) return null;
        return wrapper.querySelector(`.f1il-panel-cell[data-field="${field}"][data-type="${typeKey}"]`);
    }
    function getPanelTotalEl(field) {
        const wrapper = App.elements.wrapper;
        if (!wrapper) return null;
        return wrapper.querySelector(`.f1il-panel-total[data-field="${field}"]`);
    }

    // ── 드롭다운 색상 갱신 (품목별 색상 유지 기능) ───────────────────────────
    App.updateSelectColor = function (selectEl) {
        if (!selectEl) return;
        selectEl.classList.remove('type-dh', 'type-jj', 'type-pp');
        const cls = App.typeColorClass(selectEl.value);
        if (cls) selectEl.classList.add(cls);
    };

    // ── 입력값 수집 (저장용 페이로드 구성) ───────────────────────────────────
    App.collectPayload = function () {
        const machines = {};
        App.MACHINES.forEach(machine => {
            machines[machine] = {};
            App.COLUMNS.forEach(col => {
                const type1 = getMachineEl('type1', machine, col);
                const pre = getMachineEl('pre', machine, col);
                const type2 = getMachineEl('type2', machine, col);
                const count = getMachineEl('count', machine, col);
                machines[machine][col] = {
                    type1: type1 ? type1.value : '',
                    pre: pre ? pre.value.trim() : '',
                    type2: type2 ? type2.value : '',
                    count: count ? count.value.trim() : ''
                };
            });
        });

        const issue = {};
        const erp = {};
        App.TYPE_KEYS.forEach(key => {
            const issueInput = getPanelEl('issue', key);
            const erpInput = getPanelEl('erp', key);
            issue[key] = issueInput ? issueInput.value.trim() : '';
            erp[key] = erpInput ? erpInput.value.trim() : '';
        });

        return {
            log_date: App.state.currentDate,
            machines,
            issue,
            erp
        };
    };

    // ── 전체 입력값을 기본값으로 초기화 ───────────────────────────────────────
    App.resetToDefaults = function () {
        if (!App.elements.wrapper) return;

        App.MACHINES.forEach(machine => {
            App.COLUMNS.forEach(col => {
                const defType = App.defaultType(machine, col);
                const type1 = getMachineEl('type1', machine, col);
                const pre = getMachineEl('pre', machine, col);
                const type2 = getMachineEl('type2', machine, col);
                const count = getMachineEl('count', machine, col);

                if (type1) { type1.value = defType; App.updateSelectColor(type1); }
                if (type2) { type2.value = defType; App.updateSelectColor(type2); }
                if (pre) pre.value = '';
                if (count) count.value = '';
            });
        });

        App.TYPE_KEYS.forEach(key => {
            const issueInput = getPanelEl('issue', key);
            const erpInput = getPanelEl('erp', key);
            if (issueInput) issueInput.value = '';
            if (erpInput) erpInput.value = '';
        });

        App.state.nextDayInventory = {};
        App.state.isChanged = false;
    };

    // ── 읽기/편집 모드 전환 ───────────────────────────────────────────────────
    App.setReadOnlyMode = function (isReadOnly) {
        if (!App.elements.wrapper) return;
        App.elements.wrapper.classList.toggle('edit-mode', !isReadOnly);
        App.elements.wrapper
            .querySelectorAll('.f1il-cell[data-field="pre"], .f1il-cell[data-field="count"], .f1il-panel-cell[data-field="issue"], .f1il-panel-cell[data-field="erp"]')
            .forEach(input => { input.readOnly = isReadOnly; });
        App.elements.wrapper
            .querySelectorAll('.f1il-cell[data-field="type1"], .f1il-cell[data-field="type2"]')
            .forEach(select => { select.disabled = isReadOnly; });
    };

    // ── 자동 수식 계산 (pyw update_calculations 로직 이식) ───────────────────
    App.calculateFields = function () {
        const globalInventory = {};
        App.TYPE_KEYS.forEach(k => { globalInventory[k] = 0; });

        // 1) 호기별 재고 합산 (전체 재고 globalInventory 산출용)
        App.MACHINES.forEach(machine => {
            App.COLUMNS.forEach(col => {
                const type1 = getMachineEl('type1', machine, col);
                const pre = getMachineEl('pre', machine, col);
                const type2 = getMachineEl('type2', machine, col);
                const count = getMachineEl('count', machine, col);

                const preVal = App.utils.parseNum(pre?.value);
                if (pre && pre.value.trim() !== '' && preVal !== 0) {
                    const key = type1?.value;
                    if (key && Object.prototype.hasOwnProperty.call(globalInventory, key)) {
                        globalInventory[key] += preVal;
                    }
                }

                const countVal = App.utils.parseNum(count?.value);
                if (count && count.value.trim() !== '' && countVal !== 0) {
                    const key2 = type2?.value;
                    if (key2 && Object.prototype.hasOwnProperty.call(globalInventory, key2)) {
                        globalInventory[key2] += countVal * App.rollWeight(key2);
                    }
                }
            });
        });

        // 2) 전체 재고 (우측 패널) - 총 재고량은 행이 삭제되었으므로 각 품목별 재고만 반영
        App.TYPE_KEYS.forEach(k => {
            const invEl = getPanelEl('inventory', k);
            if (invEl) invEl.textContent = `${App.utils.formatNum(globalInventory[k]) || '0'}kg`;
        });

        // 3) 실사용량 = (오늘 재고 + 출고롤*중량) - 다음날 재고(DB 연결 전에는 0)
        // 4) 실사용량 - ERP
        const nextInv = App.state.nextDayInventory || {};
        App.TYPE_KEYS.forEach(k => {
            const issueInput = getPanelEl('issue', k);
            const issueVal = App.utils.parseNum(issueInput?.value);
            const sw = App.rollWeight(k);
            const nextVal = App.utils.parseNum(nextInv[k]);
            const actualUsage = (globalInventory[k] + issueVal * sw) - nextVal;

            const actualEl = getPanelEl('actual', k);
            if (actualEl) actualEl.textContent = `${App.utils.formatNum(actualUsage) || '0'}kg`;

            const erpInput = getPanelEl('erp', k);
            const erpVal = App.utils.parseNum(erpInput?.value);
            const diff = actualUsage - erpVal;

            const diffEl = getPanelEl('diff', k);
            if (diffEl) {
                diffEl.textContent = `${App.utils.formatNum(diff) || '0'}kg`;
                diffEl.classList.toggle('delta-positive', diff > 0);
                diffEl.classList.toggle('delta-negative', diff < 0);
            }
        });
    };

    // ── 숫자 입력 포맷터 / 드롭다운 색상 이벤트 바인딩 ───────────────────────
    App.bindInputFormatters = function () {
        if (!App.elements.wrapper) return;

        App.elements.wrapper.querySelectorAll('.numeric-input').forEach(input => {
            input.addEventListener('focus', function () {
                if (this.readOnly) return;
                this.value = this.value.replace(/,/g, '');
                this.select();
            });
            input.addEventListener('input', App.calculateFields);
            input.addEventListener('blur', function () {
                if (this.value.trim() === '') {
                    this.value = '';
                } else {
                    const value = App.utils.parseNum(this.value);
                    this.value = App.utils.formatNum(value);
                }
                App.calculateFields();
            });
        });

        App.elements.wrapper.querySelectorAll('.f1il-select').forEach(select => {
            select.addEventListener('change', function () {
                App.updateSelectColor(this);
                App.calculateFields();
            });
            App.updateSelectColor(select);
        });
    };

    // ── 변경 감지 · 키보드 네비게이션 (엑셀식 방향키/엔터 이동) ─────────────
    App.bindKeyboardNavigation = function () {
        if (!App.elements.wrapper) return;

        App.elements.wrapper.addEventListener('dragstart', e => {
            if (e.target.classList.contains('f1il-cell')) e.preventDefault();
        });
        App.elements.wrapper.addEventListener('drop', e => {
            if (e.target.classList.contains('f1il-cell')) e.preventDefault();
        });

        App.elements.wrapper.addEventListener('input', e => {
            if (e.target.classList.contains('f1il-cell')) App.state.isChanged = true;
        });
        App.elements.wrapper.addEventListener('change', e => {
            if (e.target.classList.contains('f1il-cell')) App.state.isChanged = true;
        });

        App.elements.wrapper.addEventListener('keydown', e => {
            const isCell = e.target.classList.contains('f1il-cell');
            if (!isCell || e.target.disabled || e.target.readOnly) return;
            const key = e.key;
            if (!['Enter', 'ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight'].includes(key)) return;

            const isTextInput = e.target.tagName === 'INPUT';
            if (isTextInput) {
                if (key === 'ArrowLeft' && e.target.selectionStart > 0) return;
                if (key === 'ArrowRight' && e.target.selectionEnd < e.target.value.length) return;
            }

            const td = e.target.closest('td');
            if (!td) return;
            const tr = td.closest('tr');
            const tds = Array.from(tr.querySelectorAll('td'));
            const colIndex = tds.indexOf(td);

            e.preventDefault();
            let nextCell = null;

            if (key === 'ArrowLeft') {
                let prevTd = td.previousElementSibling;
                while (prevTd && !prevTd.querySelector('.f1il-cell')) prevTd = prevTd.previousElementSibling;
                if (prevTd) nextCell = prevTd.querySelector('.f1il-cell');
            } else if (key === 'ArrowRight') {
                let nextTd = td.nextElementSibling;
                while (nextTd && !nextTd.querySelector('.f1il-cell')) nextTd = nextTd.nextElementSibling;
                if (nextTd) nextCell = nextTd.querySelector('.f1il-cell');
            } else if (key === 'ArrowUp') {
                let prevTr = tr.previousElementSibling;
                while (prevTr) {
                    const targetTd = Array.from(prevTr.querySelectorAll('td'))[colIndex];
                    if (targetTd && targetTd.querySelector('.f1il-cell')) { nextCell = targetTd.querySelector('.f1il-cell'); break; }
                    prevTr = prevTr.previousElementSibling;
                }
            } else if (key === 'ArrowDown' || key === 'Enter') {
                let nextTr = tr.nextElementSibling;
                while (nextTr) {
                    const targetTd = Array.from(nextTr.querySelectorAll('td'))[colIndex];
                    if (targetTd && targetTd.querySelector('.f1il-cell')) { nextCell = targetTd.querySelector('.f1il-cell'); break; }
                    nextTr = nextTr.nextElementSibling;
                }
            }

            if (nextCell) {
                nextCell.focus();
                if (nextCell.tagName === 'INPUT') nextCell.select();
            }
        });
    };

})();
