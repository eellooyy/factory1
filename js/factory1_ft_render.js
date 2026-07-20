/* factory1_ft_render.js — 1공장 FT UI 계산 · 렌더링 · 입력 이벤트 바인딩1 */
(function () {
    'use strict';

    const App = window.Factory1Ft;
    if (!App) return;

    // ── 헬퍼: input 요소 조회 ─────────────────────────────────────────────────
    function getInput(field, key, attr) {
        attr = attr || 'col';
        const wrapper = App.elements.wrapper;
        if (!wrapper) return null;
        return wrapper.querySelector(`.f1ft-input[data-field="${field}"][data-${attr}="${key}"]`);
    }

    // ── 입력값 수집 ───────────────────────────────────────────────────────────
    App.collectInputData = function (field, isGroup) {
        isGroup = isGroup || false;
        const data = {};
        if (!App.elements.wrapper) return data;
        App.elements.wrapper.querySelectorAll(`.f1ft-input[data-field="${field}"]`).forEach(input => {
            const val = input.value.trim();
            if (val !== '') {
                const key = isGroup ? input.dataset.group : input.dataset.col;
                if (key) {
                    data[key] = input.classList.contains('numeric-input')
                        ? App.utils.parseNum(val)
                        : val;
                }
            }
        });
        return data;
    };

    // ── 전체 input 초기화 ─────────────────────────────────────────────────────
    App.clearAllInputs = function () {
        if (!App.elements.wrapper) return;
        App.elements.wrapper.querySelectorAll('.f1ft-input').forEach(input => {
            input.value = '';
            if (input.dataset.base !== undefined) input.dataset.base = '0';
            if (input.dataset.saved !== undefined) input.dataset.saved = '';
        });
        App.state.isChanged = false;
    };

    // ── 읽기/편집 모드 전환 ───────────────────────────────────────────────────
    App.setReadOnlyMode = function (isReadOnly) {
        if (!App.elements.wrapper) return;
        App.elements.wrapper.classList.toggle('edit-mode', !isReadOnly);
        App.elements.wrapper
            .querySelectorAll('.f1ft-input[data-field="start"], .f1ft-input[data-field="end"], .f1ft-input[data-field="memo"], .f1ft-input[data-field="erp"], .f1ft-input[data-field="jigo"]')
            .forEach(input => { input.readOnly = isReadOnly; });
    };

    // ── 자동 수식 계산 ────────────────────────────────────────────────────────
    App.calculateFields = function () {
        const groups = { A: 0, C: 0, D: 0 };
        const validCounts = { A: 0, C: 0, D: 0 };

        App.COLUMNS.forEach(col => {
            const startInput = getInput('start', col);
            const endInput = getInput('end', col);
            const usageInput = getInput('usage', col);
            const start = App.utils.parseNum(startInput?.value);
            const end = App.utils.parseNum(endInput?.value);
            const group = startInput?.dataset.group;

            if (endInput && endInput.value.trim() !== '') {
                const usage = start - end;
                if (usageInput) usageInput.value = App.utils.formatNum(usage);
                if (group && Object.prototype.hasOwnProperty.call(groups, group)) {
                    groups[group] += usage;
                    validCounts[group]++;
                }
            } else {
                if (usageInput) usageInput.value = '';
            }
        });

        App.GROUPS.forEach(group => {
            const realUsage = groups[group];
            const realInput = getInput('real', group, 'group');
            const erpInput = getInput('erp', group, 'group');
            const deltaInput = getInput('delta', group, 'group');
            const diffInput = getInput('diff', group, 'group');

            const erpValue = App.utils.parseNum(erpInput?.value);
            const baseValue = App.utils.parseNum(diffInput?.dataset.base);
            const savedValue = diffInput?.dataset.saved;

            const hasTodayInput = validCounts[group] > 0 || (erpInput && erpInput.value.trim() !== '');

            let diffValue = 0;
            let shouldShowDiff = false;

            if (hasTodayInput) {
                const deltaValue = erpValue - realUsage;
                diffValue = baseValue + deltaValue;
                shouldShowDiff = true;

                if (realInput) realInput.value = App.utils.formatNum(realUsage);
                if (deltaInput) {
                    deltaInput.value = deltaValue === 0 ? '0' : App.utils.formatSignedNum(deltaValue);
                    deltaInput.classList.toggle('delta-positive', deltaValue > 0);
                    deltaInput.classList.toggle('delta-negative', deltaValue < 0);
                }
            } else {
                if (realInput) realInput.value = '';
                if (deltaInput) {
                    deltaInput.value = '';
                    deltaInput.classList.remove('delta-positive', 'delta-negative');
                }

                if (savedValue !== '') {
                    diffValue = App.utils.parseNum(savedValue);
                    shouldShowDiff = true;
                } else if (baseValue !== 0) {
                    diffValue = baseValue;
                    shouldShowDiff = true;
                }
            }

            if (diffInput) {
                if (shouldShowDiff) {
                    diffInput.value = diffValue === 0 ? '0' : App.utils.formatSignedNum(diffValue);
                    diffInput.classList.toggle('delta-positive', diffValue > 0);
                    diffInput.classList.toggle('delta-negative', diffValue < 0);
                } else {
                    diffInput.value = '';
                    diffInput.classList.remove('delta-positive', 'delta-negative');
                }
            }
        });
    };

    // ── 숫자 입력 포맷터 바인딩 ───────────────────────────────────────────────
    App.bindInputFormatters = function () {
        if (!App.elements.wrapper) return;
        App.elements.wrapper.querySelectorAll('.numeric-input').forEach(input => {
            const isJigo = input.dataset.field === 'jigo';

            input.addEventListener('focus', function () {
                if (this.readOnly) return;
                if (isJigo) {
                    // 'R/L' 표시 접미사를 떼어내고 순수 숫자만 남겨 편집하기 쉽게 함
                    if (this.value.trim() !== '') {
                        this.value = String(App.utils.parseJigoNum(this.value));
                    }
                } else {
                    this.value = this.value.replace(/,/g, '');
                }
                this.select();
            });
            input.addEventListener('input', App.calculateFields);
            input.addEventListener('blur', function () {
                if (this.value.trim() === '') {
                    this.value = '';
                } else if (isJigo) {
                    const value = App.utils.parseJigoNum(this.value);
                    this.value = `${App.utils.formatNum(value)} R/L`;
                } else {
                    const value = App.utils.parseNum(this.value);
                    this.value = App.utils.formatNum(value);
                }
                App.calculateFields();
            });
        });
    };

    // ── 키보드 네비게이션 (엑셀식 방향키/엔터 이동) ─────────────────────────
    App.bindKeyboardNavigation = function () {
        if (!App.elements.wrapper) return;

        // 드래그 복사/붙여넣기 방지
        App.elements.wrapper.addEventListener('dragstart', e => {
            if (e.target.classList.contains('f1ft-input')) e.preventDefault();
        });
        App.elements.wrapper.addEventListener('drop', e => {
            if (e.target.classList.contains('f1ft-input')) e.preventDefault();
        });

        // 변경 감지 (★실제 사용자 직접 입력(e.isTrusted)이고 편집 모드 활성화인 상태에서만 변경 처리)
        App.elements.wrapper.addEventListener('input', e => {
            if (e.target.classList.contains('f1ft-input') && e.isTrusted) {
                if (App.elements.wrapper.classList.contains('edit-mode')) {
                    App.state.isChanged = true;
                }
            }
        });

        // 방향키 / 엔터 이동
        App.elements.wrapper.addEventListener('keydown', e => {
            if (!e.target.classList.contains('f1ft-input') || e.target.readOnly) return;
            const key = e.key;
            if (!['Enter', 'ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight'].includes(key)) return;

            if (key === 'ArrowLeft' && e.target.selectionStart > 0) return;
            if (key === 'ArrowRight' && e.target.selectionEnd < e.target.value.length) return;

            e.preventDefault();

            const td = e.target.closest('td');
            if (!td) return;
            const tr = td.closest('tr');
            const tds = Array.from(tr.querySelectorAll('td'));
            const colIndex = tds.indexOf(td);

            let nextInput = null;

            if (key === 'ArrowLeft') {
                let prevTd = td.previousElementSibling;
                while (prevTd && !prevTd.querySelector('.f1ft-input:not([readonly])')) prevTd = prevTd.previousElementSibling;
                if (prevTd) nextInput = prevTd.querySelector('.f1ft-input:not([readonly])');
            } else if (key === 'ArrowRight') {
                let nextTd = td.nextElementSibling;
                while (nextTd && !nextTd.querySelector('.f1ft-input:not([readonly])')) nextTd = nextTd.nextElementSibling;
                if (nextTd) nextInput = nextTd.querySelector('.f1ft-input:not([readonly])');
            } else if (key === 'ArrowUp') {
                let prevTr = tr.previousElementSibling;
                while (prevTr) {
                    const targetTd = Array.from(prevTr.querySelectorAll('td'))[colIndex];
                    if (targetTd && targetTd.querySelector('.f1ft-input:not([readonly])')) {
                        nextInput = targetTd.querySelector('.f1ft-input:not([readonly])');
                        break;
                    }
                    prevTr = prevTr.previousElementSibling;
                }
            } else if (key === 'ArrowDown' || key === 'Enter') {
                let nextTr = tr.nextElementSibling;
                while (nextTr) {
                    const targetTd = Array.from(nextTr.querySelectorAll('td'))[colIndex];
                    if (targetTd && targetTd.querySelector('.f1ft-input:not([readonly])')) {
                        nextInput = targetTd.querySelector('.f1ft-input:not([readonly])');
                        break;
                    }
                    nextTr = nextTr.nextElementSibling;
                }
            }

            if (nextInput) {
                nextInput.focus();
                if (nextInput.type === 'text' || nextInput.type === 'number') nextInput.select();
            }
        });
    };

})();