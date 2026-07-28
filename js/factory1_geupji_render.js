/* factory1_geupji_render.js — 1공장 급지 재고 UI 계산 · 렌더링 · 입력 이벤트 바인딩 */
(function () {
    'use strict';

    const App = window.Factory1GeupjiInv;
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

    /* ── 드롭다운 만들기 ──────────────────────────────────────────────────────
       옵션은 HTML 에 적혀 있지 않습니다. 용지 마스터(v_factory1_geupji_paper)를
       읽은 뒤 여기서 만들어 넣습니다. 마스터에 행을 하나 추가하면 42개 급지대
       드롭다운에 한꺼번에 나타납니다.
       ──────────────────────────────────────────────────────────────────────── */
    App.buildPaperOptions = function () {
        if (!App.elements.wrapper) return;

        App.elements.wrapper.querySelectorAll('select.f1il-select').forEach(sel => {
            const prev = sel.value;
            sel.innerHTML = '';
            App.TYPE_KEYS.forEach(key => {
                const opt = document.createElement('option');
                opt.value = key;
                opt.textContent = App.TYPE_LABELS[key];
                sel.appendChild(opt);
            });
            if (prev && App.TYPE_KEYS.includes(prev)) sel.value = prev;
        });
    };

    /* ── 저장용 수집 ──────────────────────────────────────────────────────────
       한 급지대 = 한 행입니다. 숫자가 하나도 없으면 행을 만들지 않습니다.
       드롭다운은 자주 쓰는 값이 미리 찍혀 있을 뿐이라, 선택되어 있다는 것만으로는
       "오늘 이 급지대를 썼다"는 뜻이 되지 않기 때문입니다.

       반환값
         upserts : 저장할 행
         deletes : 원래 있었는데 이번에 비워진 급지대 (행 자체를 지웁니다)
         keep    : 이번에 저장되는 급지대 키 집합 — 저장 성공 시 state.loaded 가 됩니다

       ※ 우측 패널(재고 · 실사용 · 오차 · 출고롤)은 수집 대상이 아닙니다.
         재고는 좌측에서 유도되고, 실사용 · 오차는 화면에서만 쓰는 값이며,
         출고롤은 아직 출처가 정해지지 않아 저장할 곳이 없습니다.
       ──────────────────────────────────────────────────────────────────────── */
    function numOrNull(raw) {
        if (raw === undefined || raw === null || String(raw).trim() === '') return null;
        const n = App.utils.parseNum(raw);
        return isNaN(n) ? null : n;
    }

    App.collectRows = function (logDate) {
        const upserts = [];
        const keep = new Set();

        /* updated_at 은 컬럼 기본값이 now() 라 INSERT 때만 채워집니다.
           upsert 가 UPDATE 로 돌면 옛날 시각이 그대로 남으므로 직접 넣습니다. */
        const now = new Date().toISOString();

        App.MACHINES.forEach(machine => {
            App.COLUMNS.forEach(stand => {
                const preVal = numOrNull(getMachineEl('pre', machine, stand)?.value);
                const rollVal = numOrNull(getMachineEl('count', machine, stand)?.value);
                if (preVal === null && rollVal === null) return;

                const type1 = getMachineEl('type1', machine, stand);
                const type2 = getMachineEl('type2', machine, stand);

                keep.add(`${machine}|${stand}`);
                upserts.push({
                    log_date: logDate,
                    machine,
                    stand,
                    // 숫자가 없는 쪽은 용지도 함께 비웁니다 (테이블 CHECK 제약과 같은 규칙)
                    paper_pre: preVal === null ? null : (type1 ? type1.value : null),
                    pre_kg: preVal,
                    paper_roll: rollVal === null ? null : (type2 ? type2.value : null),
                    roll_qty: rollVal,
                    updated_at: now
                });
            });
        });

        const deletes = [];
        App.state.loaded.forEach(key => {
            if (keep.has(key)) return;
            const [machine, stand] = key.split('|');
            deletes.push({ machine, stand });
        });

        return { upserts, deletes, keep };
    };

    /* ── DB 행을 화면에 반영 ──────────────────────────────────────────────────
       행이 없는 급지대는 resetToDefaults 가 이미 비워 둔 상태 그대로 둡니다.
       ──────────────────────────────────────────────────────────────────────── */
    App.applyGeupjiRows = function (rows) {
        App.state.loaded = new Set();
        if (!rows) return;

        rows.forEach(r => {
            App.state.loaded.add(`${r.machine}|${r.stand}`);

            const type1 = getMachineEl('type1', r.machine, r.stand);
            const pre = getMachineEl('pre', r.machine, r.stand);
            const type2 = getMachineEl('type2', r.machine, r.stand);
            const count = getMachineEl('count', r.machine, r.stand);

            if (type1 && r.paper_pre) { type1.value = r.paper_pre; App.updateSelectColor(type1); }
            if (type2 && r.paper_roll) { type2.value = r.paper_roll; App.updateSelectColor(type2); }
            if (pre) pre.value = (r.pre_kg === null || r.pre_kg === undefined) ? '' : App.utils.formatNum(r.pre_kg);
            if (count) count.value = (r.roll_qty === null || r.roll_qty === undefined) ? '' : App.utils.formatNum(r.roll_qty);
        });
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
            if (issueInput) issueInput.value = '';
        });

        App.applyErpUsage(null);   // ERP 열은 조회 결과가 오기 전까지 '–'

        App.state.nextDayInventory = {};
        App.state.isChanged = false;
    };

    /* ── ERP 사용량 표시 ──────────────────────────────────────────────────────
       byType 이 null 이거나 그 용지의 키가 없으면 '–' 입니다. 0kg 으로 적으면
       "그날 안 썼다"로 읽히는데, 실제로는 실적이 아직 안 넘어온 경우가 대부분이라
       오차 열이 실사용량을 통째로 오차라고 말하게 됩니다.

       화면에 찍는 건 사람이 읽을 문자열이고, 계산에 쓸 원본 숫자는 dataset.value 에
       따로 둡니다. "1,234kg" 을 다시 숫자로 파싱하는 일을 만들지 않기 위해서입니다.
       ──────────────────────────────────────────────────────────────────────── */
    App.applyErpUsage = function (byType) {
        App.TYPE_KEYS.forEach(key => {
            const el = getPanelEl('erp', key);
            if (!el) return;

            const has = byType && Object.prototype.hasOwnProperty.call(byType, key);
            if (!has) {
                delete el.dataset.value;
                el.textContent = '–';
                el.classList.add('f1il-erp-empty');
                return;
            }

            el.dataset.value = byType[key];
            el.textContent = `${App.utils.formatNum(byType[key]) || '0'}kg`;
            el.classList.remove('f1il-erp-empty');
        });
    };

    // ── 읽기/편집 모드 전환 ───────────────────────────────────────────────────
    App.setReadOnlyMode = function (isReadOnly) {
        if (!App.elements.wrapper) return;
        App.elements.wrapper.classList.toggle('edit-mode', !isReadOnly);
        /* ERP 열은 여기 없습니다. 사람이 적는 값이 아니라 사용량 뷰에서 읽어오는
           값이라, 수정 모드에서도 잠긴 채로 둡니다. (실사용 · 오차와 같은 성격) */
        App.elements.wrapper
            .querySelectorAll('.f1il-cell[data-field="pre"], .f1il-cell[data-field="count"], .f1il-panel-cell[data-field="issue"]')
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

            /* ERP 값은 입력칸이 아니라 사용량 뷰에서 받아 dataset.value 에 담아 둔
               숫자입니다. 그 날짜 실적이 아직 없으면 오차도 낼 수 없어 '–' 입니다.
               0 으로 두면 실사용량 전체가 오차인 것처럼 보입니다. */
            const erpEl = getPanelEl('erp', k);
            const hasErp = !!(erpEl && erpEl.dataset.value !== undefined && erpEl.dataset.value !== '');

            const diffEl = getPanelEl('diff', k);
            if (diffEl) {
                if (!hasErp) {
                    diffEl.textContent = '–';
                    diffEl.classList.remove('delta-positive', 'delta-negative');
                } else {
                    const diff = actualUsage - App.utils.parseNum(erpEl.dataset.value);
                    diffEl.textContent = `${App.utils.formatNum(diff) || '0'}kg`;
                    diffEl.classList.toggle('delta-positive', diff > 0);
                    diffEl.classList.toggle('delta-negative', diff < 0);
                }
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
