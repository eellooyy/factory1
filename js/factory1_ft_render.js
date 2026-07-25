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
            if (input.dataset.field === 'jigo') {
                delete input.dataset.qty;
                delete input.dataset.weight;
            }
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
        // 편집 중 실시간 급지 재고 합계 갱신 (loadData 시에는 updateGeupjiTotals가 직접 호출됨)
        App.updateGeupjiTotals(App.collectInputData('end', false));

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

    // ── 지고 재고: 롤 수 / 무게를 dataset에 보관 (표시 단위와 무관하게 원본 유지) ──
    //    qty = stock_qty(R/L), weight = stock_weight(KG) — DB 컬럼과 1:1 대응
    App.setJigoValue = function (input, qty, weight) {
        if (!input) return;
        if (qty === null || qty === undefined || qty === '') {
            delete input.dataset.qty;
            delete input.dataset.weight;
            return;
        }
        const qtyNum = App.utils.parseNum(qty);
        input.dataset.qty = qtyNum;
        input.dataset.weight = (weight === null || weight === undefined || weight === '')
            ? qtyNum * (App.JIGO_WEIGHT_MULTIPLIER[input.dataset.group] || 0)
            : App.utils.parseNum(weight);
    };

    // ── 지고 재고 단위 토글 (R/L ↔ KG) ──────────────────────────────────────
    App.setJigoUnit = function (unit) {
        App.state.jigoUnit = unit === 'KG' ? 'KG' : 'RL';

        const switcher = document.getElementById('f1FtJigoUnitToggle');
        const switcherBg = document.getElementById('f1FtJigoSwitcherBg');
        if (switcher) {
            switcher.querySelectorAll('.unit-btn').forEach(btn => {
                btn.classList.toggle('active', btn.dataset.unit === App.state.jigoUnit);
            });
        }
        if (switcherBg) {
            switcherBg.className = App.state.jigoUnit === 'KG' ? 'selection-bg mode-kg' : 'selection-bg mode-roll';
        }

        App.updateJigoDisplay();
    };

    // ── 지고 재고 값 표시 업데이트 (dataset 원본값 → 현재 단위로 렌더링) ─────
    App.updateJigoDisplay = function () {
        if (!App.elements.wrapper) return;

        App.elements.wrapper.querySelectorAll('.f1ft-input[data-field="jigo"]').forEach(input => {
            if (input.dataset.qty === undefined) {
                input.value = '';
                return;
            }
            input.value = App.state.jigoUnit === 'KG'
                ? `${App.utils.formatNum(input.dataset.weight)} KG`
                : `${App.utils.formatNum(input.dataset.qty)} R/L`;
        });
    };

    // ── 급지 재고 합계 업데이트 (endValues 객체를 직접 받아 날짜별 명시 처리) ──
    App.updateGeupjiTotals = function (endValues) {
        App.GROUPS.forEach(group => {
            const span = App.elements.wrapper
                ? App.elements.wrapper.querySelector(`.f1ft-geupji-total[data-group="${group}"]`)
                : null;
            if (!span) return;
            const cols = App.GROUP_KEYS[group];
            let totalKg = 0;
            let hasValue = false;
            cols.forEach(col => {
                const val = endValues ? endValues[col] : undefined;
                if (val !== undefined && val !== null && val !== '') {
                    totalKg += App.utils.parseNum(val);
                    hasValue = true;
                }
            });
            span.textContent = hasValue
                ? `${App.utils.formatNum(totalKg)} KG`
                : '-';
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
                    // 단위 접미사를 떼어내고 현재 단위 기준의 순수 숫자만 남겨 편집하기 쉽게 함
                    const raw = App.state.jigoUnit === 'KG' ? this.dataset.weight : this.dataset.qty;
                    this.value = raw === undefined ? '' : String(raw);
                } else {
                    this.value = this.value.replace(/,/g, '');
                }
                this.select();
            });
            input.addEventListener('input', App.calculateFields);
            input.addEventListener('blur', function () {
                if (this.value.trim() === '') {
                    if (isJigo) App.setJigoValue(this, '');
                    this.value = '';
                } else if (isJigo) {
                    // 입력한 단위를 기준으로 나머지 단위를 환산해 dataset에 함께 보관
                    const typed = App.utils.parseNum(this.value);
                    const multiplier = App.JIGO_WEIGHT_MULTIPLIER[this.dataset.group] || 0;
                    if (App.state.jigoUnit === 'KG') {
                        App.setJigoValue(this, multiplier ? typed / multiplier : 0, typed);
                    } else {
                        App.setJigoValue(this, typed, typed * multiplier);
                    }
                    App.updateJigoDisplay();
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