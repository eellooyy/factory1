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
    /* ── 우측 두 표 만들기 ────────────────────────────────────────────────────
       행이 HTML 에 적혀 있지 않습니다. 용지 마스터를 읽은 뒤 여기서 만듭니다.
       마스터에 용지를 하나 넣으면 두 표에 함께 나타납니다.

       [전주 배분 하위 줄]
       한 급지 그룹에 ERP 품목이 둘 이상이면 그 아래에 품목별 하위 줄이 붙습니다.
       지금은 전주 1404 · 전주 702 만 해당합니다(본지 = 자사, 전자 = 사급).
       급지 현장에서는 같은 롤이라 구분하지 않지만 회계상으로는 다른 물건이라,
       재고 총계를 회계용으로 나눠 둘 필요가 있습니다.

       규칙은 "마지막 품목이 나머지를 받는다" 입니다. 마스터의 sort_order 상
       본지가 앞, 전자가 뒤라서 본지에만 적으면 남는 만큼이 전부 전자로 갑니다.
       아무것도 안 적은 날은 전액 전자입니다 — 평상시 루틴이 그렇기 때문입니다.

       배분은 재고 열에만 걸립니다. 출고 · 실사용 · ERP · 오차는 전주 총계
       그대로입니다. 그 넷까지 나누려면 매일 배분을 적어야 하는데, 배분은
       회계 처리할 때만 필요한 값입니다.
       ──────────────────────────────────────────────────────────────────────── */
    function td(child, cls) {
        const cell = document.createElement('td');
        cell.className = 'f1il-td' + (cls ? ' ' + cls : '');
        cell.appendChild(child);
        return cell;
    }

    function readonlyCell(field, key, text) {
        const span = document.createElement('span');
        span.className = 'f1il-panel-cell readonly';
        span.dataset.field = field;
        span.dataset.type = key;
        span.textContent = text;
        return span;
    }

    function inputCell(field, key) {
        const inp = document.createElement('input');
        inp.type = 'text';
        inp.className = 'f1il-cell f1il-panel-cell numeric-input';
        inp.dataset.field = field;
        inp.dataset.type = key;
        inp.inputMode = 'decimal';
        inp.readOnly = true;   // 편집 모드에서만 열립니다 (setReadOnlyMode)
        return inp;
    }

    function rowTitle(text, cls) {
        const th = document.createElement('th');
        th.className = 'f1il-th f1il-row-title' + (cls ? ' ' + cls : '');
        th.textContent = text;
        return th;
    }

    // 품목이 둘 이상인 그룹만 하위 줄을 갖습니다
    function subItems(key) {
        const codes = App.ITEM_CODES[key] || [];
        return codes.length > 1 ? codes : [];
    }

    /* 배분 팝오버 — 용지 이름 옆 [+] 를 누르면 그 행 오른쪽에 떠오릅니다.
       표에 하위 줄로 붙이면 우측 카드가 좌측 3적층 높이에 맞춰 늘어나는 구조라
       행이 늘어난 만큼 전체가 눌립니다. 게다가 배분은 회계 처리할 때만 쓰는
       값이라 평상시 화면을 차지할 이유가 없습니다. */
    function buildAllocPop(key, codes) {
        const pop = document.createElement('div');
        pop.className = 'f1il-alloc-pop';
        pop.dataset.type = key;

        const head = document.createElement('div');
        head.className = 'f1il-alloc-pop-head';

        const headText = document.createElement('span');
        headText.textContent = `${App.TYPE_LABELS[key]} 재고 배분`;
        head.appendChild(headText);

        const close = document.createElement('button');
        close.type = 'button';
        close.className = 'f1il-alloc-close';
        close.title = '닫기';
        close.innerHTML = '<span class="material-symbols-outlined">close</span>';
        head.appendChild(close);

        pop.appendChild(head);

        const table = document.createElement('table');
        table.className = 'f1il-alloc-pop-table';

        codes.forEach((code, i) => {
            const isLast = (i === codes.length - 1);
            const tr = document.createElement('tr');

            const th = document.createElement('th');
            th.textContent = App.ITEM_LABELS[code] || code;
            tr.appendChild(th);

            const cell = document.createElement('td');
            // 마지막 품목이 나머지를 받습니다 — 그래서 입력칸이 없습니다
            cell.appendChild(isLast ? readonlyCell('alloc-rest', code, '0kg') : inputCell('alloc', code));
            tr.appendChild(cell);
            table.appendChild(tr);
        });

        // 총계는 좌측 호기 표에서 계산된 값입니다. 배분이 넘지 못하는 한계선입니다.
        const totalTr = document.createElement('tr');
        totalTr.className = 'f1il-alloc-pop-total';
        const totalTh = document.createElement('th');
        totalTh.textContent = '재고 총계';
        totalTr.appendChild(totalTh);
        const totalTd = document.createElement('td');
        totalTd.appendChild(readonlyCell('alloc-total', key, '0kg'));
        totalTr.appendChild(totalTd);
        table.appendChild(totalTr);

        pop.appendChild(table);
        return pop;
    }

    /* ── 잔여 주행지 표 ──────────────────────────────────────────────────────
       is_carry 가 켜진 용지마다 한 행. 칸은 CARRY_SLOTS 개이고 마지막에 합계가
       붙습니다. 합계는 저장하지 않습니다 — 칸의 합이라 저장하면 칸을 고쳤을 때
       조용히 갈라집니다. 재고실사 페이지는 같은 합을 뷰에서 읽습니다.
       ──────────────────────────────────────────────────────────────────────── */
    function carryInput(key, slot) {
        const inp = document.createElement('input');
        inp.type = 'text';
        inp.className = 'f1il-cell numeric-input';
        inp.dataset.field = 'carry';
        inp.dataset.type = key;
        inp.dataset.slot = String(slot);
        inp.inputMode = 'decimal';
        inp.readOnly = true;   // 편집 모드에서만 열립니다 (setReadOnlyMode)
        return inp;
    }

    App.buildCarryTable = function () {
        const body = document.getElementById('f1ilCarryBody');
        if (!body) return;

        body.innerHTML = '';

        /* 표를 감추는 건 "관리할 용지가 하나도 없다"가 확실할 때뿐입니다.
           빈 표가 남아 있으면 좌측이 그만큼 길어져 우측 카드 높이까지 밀리기
           때문입니다.

           조회 자체가 실패했을 때(CARRY_KEYS === null)는 감추지 않습니다.
           그리면서 지웠다가는 화면이 한 번 튀고, 무엇보다 "여기 표가 있어야
           하는데 값을 못 읽었다"는 상태가 눈에 보이지 않게 됩니다. */
        const box = body.closest('.f1il-machine-box');
        const keys = App.CARRY_KEYS;

        if (box) box.style.display = (keys && !keys.length) ? 'none' : '';
        if (!keys || !keys.length) return;

        keys.forEach(key => {
            const tr = document.createElement('tr');
            tr.appendChild(rowTitle(App.TYPE_LABELS[key] || key));

            for (let slot = 1; slot <= App.CARRY_SLOTS; slot++) {
                tr.appendChild(td(carryInput(key, slot)));
            }

            const total = document.createElement('span');
            total.className = 'f1il-panel-cell readonly';
            total.dataset.field = 'carry-total';
            total.dataset.type = key;
            total.textContent = '0kg';
            tr.appendChild(td(total));

            body.appendChild(tr);
        });
    };

    // 화면의 칸을 더해 합계 칸에 씁니다 (입력할 때마다 바로 따라 움직입니다)
    App.calcCarryTotals = function () {
        (App.CARRY_KEYS || []).forEach(key => {
            let sum = 0;
            App.elements.wrapper
                .querySelectorAll(`.f1il-cell[data-field="carry"][data-type="${key}"]`)
                .forEach(inp => { sum += App.utils.parseNum(inp.value) || 0; });

            const el = App.elements.wrapper
                .querySelector(`[data-field="carry-total"][data-type="${key}"]`);
            if (el) el.textContent = `${App.utils.formatNum(sum) || '0'}kg`;
        });
    };

    /* DB(계승 뷰)에서 읽은 값을 칸에 채웁니다.
       byKey[용지키][칸번호] = kg. 값이 없는 칸은 빈 칸으로 둡니다 — 0 과 다릅니다.
       (0 은 "다 썼다", 빈 칸은 "그런 롤이 없다"입니다) */
    App.applyCarry = function (byKey) {
        App.state.loadedCarry = byKey || {};

        App.elements.wrapper
            .querySelectorAll('.f1il-cell[data-field="carry"]')
            .forEach(inp => {
                const slots = App.state.loadedCarry[inp.dataset.type];
                const v = slots ? slots[inp.dataset.slot] : undefined;
                inp.value = (v === undefined || v === null)
                    ? '' : App.utils.formatNum(v);
            });

        App.calcCarryTotals();
    };

    /* 저장할 칸만 골라냅니다 — 계승된 현재 값과 다른 칸만.
       빈 칸은 0 으로 봅니다. 화면에서 지웠다는 건 "그 롤을 다 썼다"는 뜻이고,
       행을 안 만들면 뷰가 옛날 값을 이어받아 재고가 줄지 않습니다. */
    App.collectCarry = function (logDate) {
        const upserts = [];

        App.elements.wrapper
            .querySelectorAll('.f1il-cell[data-field="carry"]')
            .forEach(inp => {
                const key = inp.dataset.type;
                const slot = Number(inp.dataset.slot);

                const slots = App.state.loadedCarry[key] || {};
                const before = slots[slot];
                const raw = numOrNull(inp.value);

                // 원래도 비어 있었고 지금도 비었다 — 아직 존재한 적 없는 칸입니다
                if (raw === null && (before === undefined || before === null)) return;

                const now = (raw === null) ? 0 : raw;
                if (before !== undefined && before !== null && Number(before) === now) return;

                upserts.push({
                    log_date: logDate,
                    geupji_key: key,
                    slot: slot,
                    remain_kg: now
                });
            });

        return upserts;
    };

    /* ── 출고 두 갈래 (실제 · 전산) ───────────────────────────────────────────
       같은 표에 출고가 둘 있습니다. 나오는 곳이 다를 뿐 다루는 방식은 똑같아서
       한 벌의 코드로 처리합니다.

         실제 출고  지고 재고에서 역산한 값 (전일 재고 − 금일 재고 + 당일 입고)
         전산 출고  공정 PC 가 찍은 출고 바코드를 용지별 롤 수로 센 값

       둘 다 **자동값은 저장하지 않고 사람이 고친 값만** 남깁니다. 자동값을
       저장하면 원본(지고 재고 · 스캔)을 고쳐도 옛 값이 남아, 오차 검증용
       지표가 스스로 갈라집니다.

       나란히 두는 이유는 **출처가 다르기** 때문입니다. 둘이 같이 틀리면 실사
       쪽, 하나만 틀리면 그쪽 문제로 범위가 좁혀집니다. 그래서 어느 쪽을
       손댔는지가 반드시 보여야 합니다 — 수기 칸은 색이 붙고 메모줄이 따라
       나옵니다.

       한 행(log_date, geupji_key)에 네 값이 같이 삽니다.
         issue_roll · memo          실제 출고
         sys_issue_roll · sys_memo  전산 출고
       ──────────────────────────────────────────────────────────────────────── */
    const ISSUE_KINDS = [
        { field: 'issue',    store: 'loadedIssue',    tag: '실제',
          rollCol: 'issue_roll',     memoCol: 'memo' },
        { field: 'sysissue', store: 'loadedSysIssue', tag: '전산',
          rollCol: 'sys_issue_roll', memoCol: 'sys_memo' }
    ];

    function kindOf(field) {
        return ISSUE_KINDS.find(k => k.field === field);
    }

    function rowOf(kind, key) {
        const store = App.state[kind.store] || {};
        return store[key] || { auto: null, manual: null, memo: null };
    }

    /* 한 갈래를 화면에 얹습니다. 화면에는 '합친 값'(수기 있으면 수기, 없으면
       자동)이 뜨고, 저장할 때만 자동값과 견줘 달라진 것을 가려냅니다. */
    function applyKind(kind, byKey) {
        App.state[kind.store] = byKey || {};

        App.TYPE_KEYS.forEach(key => {
            const inp = getPanelEl(kind.field, key);
            if (!inp) return;

            const row = rowOf(kind, key);
            const shown = (row.manual !== null && row.manual !== undefined)
                ? row.manual : row.auto;

            inp.value = (shown === null || shown === undefined)
                ? '' : App.utils.formatNum(shown);

            /* 자동 계산이 안 되는 날입니다 — 실제 출고는 지고 재고를 안 적은 날,
               전산 출고는 그날 스캔이 아예 없는 날(백업이 멈춰 있던 구간, 휴일).
               0 을 채우면 "출고가 없었다"로 읽히는데 사실은 "자료가 없다"입니다. */
            const noAuto = (row.auto === null || row.auto === undefined);
            inp.placeholder = noAuto ? '–' : '';
            inp.classList.toggle('f1il-issue-none', noAuto);
        });
    }

    App.applyIssue = function (byKey) {
        applyKind(kindOf('issue'), byKey);
        App.state.issueMemoKeys = '';   // 다음 refresh 가 무조건 다시 그리게
        App.refreshIssueMemos();
    };

    /* 전산 출고 — 자동값은 바코드에서, 수기값·메모는 실제 출고와 같은 행에서
       옵니다. api.js 의 fetchSysIssue 가 둘을 합쳐 넘깁니다. */
    App.applySysIssue = function (byKey) {
        applyKind(kindOf('sysissue'), byKey);
        App.state.issueMemoKeys = '';
        App.refreshIssueMemos();
    };

    // 화면 값이 자동값과 다른 용지 = 지금 수기로 고쳐진 용지
    function manualKeys(kind) {
        return App.TYPE_KEYS.filter(key => {
            const inp = getPanelEl(kind.field, key);
            if (!inp) return false;

            const auto = rowOf(kind, key).auto;
            const raw = numOrNull(inp.value);

            if (raw === null) return false;                 // 비움 = 자동으로 되돌림
            if (auto === null || auto === undefined) return true;
            return raw !== Number(auto);
        });
    }

    /* 수기로 고쳐진 칸에 색을 입힙니다. 이 표시가 오차 검증의 핵심입니다 —
       자동값 그대로인 날과 손댄 날이 구분되지 않으면 오차를 해석할 수 없습니다. */
    function paintIssueCells(kind, keys) {
        App.TYPE_KEYS.forEach(key => {
            const inp = getPanelEl(kind.field, key);
            if (inp) inp.classList.toggle('f1il-issue-manual', keys.indexOf(key) !== -1);
        });
    }

    /* 메모줄은 '지금 수기로 고쳐진 용지' + '메모가 이미 적힌 용지'에만 나옵니다.
       보기 모드에서는 글로, 수정 모드에서는 입력칸으로 그립니다.
       실제 · 전산 두 갈래가 한 띠에 섞이므로 앞에 갈래 표를 답니다.

       입력 중에 매번 다시 그리면 글자를 한 자 칠 때마다 포커스가 날아갑니다.
       대상 목록이 바뀔 때만 다시 그리고, 그때도 이미 친 글자는 옮겨 담습니다. */
    App.refreshIssueMemos = function (isEditing) {
        const wrap = document.getElementById('f1ilIssueMemos');
        if (!wrap) return;

        /* 모드 전환 중에는 헤더의 상태가 아직 안 바뀌어 있을 수 있어 인자로 받습니다.
           (setReadOnlyMode 가 넘겨 줍니다) */
        const editing = (isEditing === undefined)
            ? !!(App.headerApi && App.headerApi.isEditMode && App.headerApi.isEditMode())
            : !!isEditing;

        const lines = [];
        ISSUE_KINDS.forEach(kind => {
            const keys = manualKeys(kind);
            paintIssueCells(kind, keys);

            App.TYPE_KEYS.forEach(key => {
                const touched = keys.indexOf(key) !== -1;            // 지금 손댄 용지
                const written = !editing && !!rowOf(kind, key).memo;  // 보기 모드에서 적힌 메모
                if (touched || written) lines.push({ kind: kind, key: key });
            });
        });

        const sig = (editing ? 'E|' : 'V|')
            + lines.map(l => l.kind.field + ':' + l.key).join(',');
        if (sig === App.state.issueMemoKeys) return;

        // 이미 친 글자를 잃지 않게 먼저 걷어 둡니다
        const typed = {};
        wrap.querySelectorAll('.f1il-issue-memo-input').forEach(i => {
            typed[i.dataset.kind + ':' + i.dataset.type] = i.value;
        });

        App.state.issueMemoKeys = sig;
        wrap.innerHTML = '';

        lines.forEach(function (line) {
            const kind = line.kind;
            const key = line.key;

            const row = document.createElement('div');
            row.className = 'f1il-issue-memo';

            // 실제 / 전산 — 어느 출고를 손댔는지 앞에 답니다
            const tag = document.createElement('span');
            tag.className = 'f1il-issue-memo-tag f1il-issue-tag-' + kind.field;
            tag.textContent = kind.tag;
            row.appendChild(tag);

            const label = document.createElement('span');
            label.className = 'f1il-issue-memo-label';
            label.textContent = App.TYPE_LABELS[key] || key;
            row.appendChild(label);

            const saved = rowOf(kind, key).memo || '';
            const cacheKey = kind.field + ':' + key;

            if (editing) {
                const inp = document.createElement('input');
                inp.type = 'text';
                inp.className = 'f1il-issue-memo-input';
                inp.dataset.kind = kind.field;
                inp.dataset.type = key;
                inp.maxLength = 200;
                inp.placeholder = '수기로 고친 이유 (선택)';
                inp.value = (typed[cacheKey] !== undefined) ? typed[cacheKey] : saved;
                row.appendChild(inp);
            } else {
                const txt = document.createElement('span');
                txt.className = 'f1il-issue-memo-text';
                txt.textContent = saved;
                row.appendChild(txt);
            }

            wrap.appendChild(row);
        });
    };

    function memoOf(kind, key) {
        const el = document.querySelector(
            '.f1il-issue-memo-input[data-kind="' + kind.field + '"][data-type="' + key + '"]');
        const v = el ? el.value.trim() : '';
        return v === '' ? null : v;
    }

    /* 한 갈래의 저장값을 냅니다.
         { roll, memo }  둘 다 null 이면 그 갈래는 자동값으로 되돌아간 것입니다. */
    function collectKind(kind, key, keys) {
        const isManual = keys.indexOf(key) !== -1;
        const memo = memoOf(kind, key);
        if (!isManual && !memo) return { roll: null, memo: null };

        const inp = getPanelEl(kind.field, key);
        const raw = numOrNull(inp && inp.value);

        /* 값은 그대로 두고 메모만 적은 경우입니다. 적어 둔 글이 조용히
           사라지지 않도록 그때 보이던 숫자를 함께 남깁니다. */
        const val = (raw !== null) ? raw : rowOf(kind, key).auto;
        if (val === null || val === undefined) return { roll: null, memo: null };

        return { roll: val, memo: memo };
    }

    /* 저장 대상을 가려냅니다.
         upserts : 실제 · 전산 중 하나라도 수기값이나 메모가 있는 용지
         deletes : 둘 다 자동값으로 되돌아갔고 메모도 없는데 예전 행이 남아 있는 용지

       **네 컬럼을 언제나 함께 보냅니다.** 빠뜨리면 upsert 의 UPDATE 경로에서
       그 컬럼만 옛 값으로 살아남아, 지운 수기값이 되살아납니다.

       비우면 행을 지웁니다(= 자동값 복귀). 잔여 주행지와 반대입니다 — 거기는
       뒤에 받쳐 줄 자동값이 없어서 0 을 적어야 했습니다. */
    App.collectIssue = function (logDate) {
        const upserts = [];
        const deletes = [];
        const keysByKind = ISSUE_KINDS.map(k => manualKeys(k));

        App.TYPE_KEYS.forEach(key => {
            const parts = ISSUE_KINDS.map((kind, i) => collectKind(kind, key, keysByKind[i]));
            const any = parts.some(p => p.roll !== null || p.memo !== null);

            if (any) {
                const row = { log_date: logDate, geupji_key: key };
                ISSUE_KINDS.forEach((kind, i) => {
                    row[kind.rollCol] = parts[i].roll;
                    row[kind.memoCol] = parts[i].memo;
                });
                upserts.push(row);
                return;
            }

            const hadRow = ISSUE_KINDS.some(kind => {
                const r = rowOf(kind, key);
                return (r.manual !== null && r.manual !== undefined) || !!r.memo;
            });
            if (hadRow) deletes.push(key);
        });

        return { upserts, deletes };
    };

    App.buildPanels = function () {
        const stockBody = document.getElementById('f1ilStockBody');
        const usageBody = document.getElementById('f1ilUsageBody');
        if (!stockBody || !usageBody) return;

        stockBody.innerHTML = '';
        usageBody.innerHTML = '';

        App.TYPE_KEYS.forEach(key => {
            // ── 급지 재고 / 출고 ──
            const tr = document.createElement('tr');
            const title = rowTitle(App.TYPE_LABELS[key]);

            /* 품목이 둘 이상인 그룹에만 배분 버튼이 붙습니다.
               지금은 전주 1404 · 702 뿐입니다(본지 = 자사, 전자 = 사급). */
            const codes = subItems(key);
            if (codes.length) {
                title.classList.add('f1il-has-alloc-btn');

                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'f1il-alloc-btn';
                btn.dataset.type = key;
                btn.title = `${App.TYPE_LABELS[key]} 재고 배분`;
                btn.textContent = '+';
                title.appendChild(btn);

                title.appendChild(buildAllocPop(key, codes));
            }

            tr.appendChild(title);
            tr.appendChild(td(readonlyCell('inventory', key, '0kg')));
            /* 출고 두 칸 모두 입력칸입니다. 자동값이 채워져 있고, 사람이 고치면
               그 값만 저장됩니다(자동값은 저장하지 않습니다). */
            tr.appendChild(td(inputCell('issue', key)));
            tr.appendChild(td(inputCell('sysissue', key)));
            stockBody.appendChild(tr);

            // ── 사용량 상세 내역 ──
            const ur = document.createElement('tr');
            ur.appendChild(rowTitle(App.TYPE_LABELS[key]));
            ur.appendChild(td(readonlyCell('actual', key, '0kg')));
            ur.appendChild(td(readonlyCell('erp', key, '–'), null));
            ur.appendChild(td(readonlyCell('diff', key, '–')));
            usageBody.appendChild(ur);
        });

        // ERP 열은 값이 오기 전까지 옅게 (전산 출고는 입력칸이라 placeholder 로 처리)
        App.elements.wrapper.querySelectorAll('.f1il-panel-cell[data-field="erp"]')
            .forEach(el => el.classList.add('f1il-erp-empty'));
    };

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

        /* updated_at 은 DB 가 채웁니다 — INSERT 는 컬럼 기본값 now(),
           UPDATE 는 touch_updated_at() 트리거입니다. 여기서 보내면 공장 PC
           시계에 의존하게 되고, 파이썬 스크립트가 같은 테이블을 건드릴 때는
           아예 안 걸립니다. */

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
                    roll_qty: rollVal
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
    /* ── 회계용 재고 배분 반영 ────────────────────────────────────────────────
       입력칸을 채우기만 하고, 잔여 품목(마지막)은 calculateFields 가 계산합니다.
       ──────────────────────────────────────────────────────────────────────── */
    App.applyAlloc = function (byItem) {
        App.state.loadedAlloc = new Set();

        App.elements.wrapper.querySelectorAll('.f1il-panel-cell[data-field="alloc"]').forEach(inp => {
            const code = inp.dataset.type;
            const has = byItem && Object.prototype.hasOwnProperty.call(byItem, code);
            inp.value = has ? App.utils.formatNum(byItem[code]) : '';
            if (has) App.state.loadedAlloc.add(code);
        });
    };

    /* 배분 저장분 수집 — 입력한 품목만 저장하고, 비운 칸은 행을 지웁니다.
       0 은 "배분 없음"이라 저장하지 않습니다. 행이 없는 것과 같은 뜻입니다. */
    App.collectAlloc = function (logDate) {
        const upserts = [];
        const keep = new Set();
        const now = new Date().toISOString();

        App.elements.wrapper.querySelectorAll('.f1il-panel-cell[data-field="alloc"]').forEach(inp => {
            const code = inp.dataset.type;
            const val = numOrNull(inp.value);
            if (val === null || val === 0) return;

            keep.add(code);
            upserts.push({ log_date: logDate, item_code: code, alloc_kg: val, updated_at: now });
        });

        const deletes = [];
        (App.state.loadedAlloc || new Set()).forEach(code => {
            if (!keep.has(code)) deletes.push(code);
        });

        return { upserts, deletes, keep };
    };

    /* 배분이 총계를 넘는지 검사합니다. 넘으면 오타입니다 — 급지대에 실제로 걸려
       있는 양이 총계인데 그보다 많이 나눌 수는 없습니다. 저장을 막습니다. */
    App.allocErrors = function () {
        const bad = [];
        App.TYPE_KEYS.forEach(key => {
            const codes = subItems(key);
            if (!codes.length) return;

            const total = App.state.stockTotal[key] || 0;
            let sum = 0;
            codes.slice(0, -1).forEach(code => {
                const inp = App.elements.wrapper.querySelector(`.f1il-panel-cell[data-field="alloc"][data-type="${code}"]`);
                sum += App.utils.parseNum(inp && inp.value);
            });

            if (sum > total) bad.push(`${App.TYPE_LABELS[key]} (배분 ${App.utils.formatNum(sum)}kg > 재고 ${App.utils.formatNum(total)}kg)`);
        });
        return bad;
    };

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
            const sysInput = getPanelEl('sysissue', key);
            if (sysInput) sysInput.value = '';
        });

        App.applyErpUsage(null);   // ERP 열은 조회 결과가 오기 전까지 '–'
        App.applySysIssue(null);   // 전산 출고도 마찬가지
        App.applyAlloc(null);      // 배분 입력칸도 비웁니다 (미입력 = 전액 잔여 품목)

        App.state.prevDayInventory = {};
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
            .querySelectorAll('.f1il-cell[data-field="pre"], .f1il-cell[data-field="count"],'
                + ' .f1il-cell[data-field="carry"],'
                + ' .f1il-panel-cell[data-field="issue"], .f1il-panel-cell[data-field="sysissue"],'
                + ' .f1il-panel-cell[data-field="alloc"]')
            .forEach(input => { input.readOnly = isReadOnly; });
        App.elements.wrapper
            .querySelectorAll('.f1il-cell[data-field="type1"], .f1il-cell[data-field="type2"]')
            .forEach(select => { select.disabled = isReadOnly; });

        // 메모줄을 글 ↔ 입력칸으로 바꿔 답니다
        App.refreshIssueMemos(!isReadOnly);
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

        /* 총계를 남겨 둡니다. 배분이 총계를 넘는지 검사할 때(App.allocErrors) 씁니다.
           좌측을 고쳐 총계가 줄면 그 검사도 곧바로 새 총계 기준이 됩니다. */
        App.state.stockTotal = globalInventory;

        /* 2-1) 회계용 재고 배분 — 재고 열에만 걸립니다.
           마지막 품목이 나머지를 받습니다. 앞 품목에 아무것도 안 적으면 전액이
           마지막(전자)으로 갑니다. 평상시 루틴이 그렇습니다.

           배분 합이 총계를 넘으면 잔여가 음수가 됩니다. 그건 오타이므로 빨갛게
           표시하고, 저장은 App.saveData 가 막습니다. 화면에서는 계산을 멈추지
           않고 음수를 그대로 보여줍니다 — 얼마나 넘쳤는지 보여야 고칠 수 있습니다. */
        App.TYPE_KEYS.forEach(key => {
            const codes = subItems(key);
            if (!codes.length) return;

            const total = globalInventory[key] || 0;
            let sum = 0;

            codes.slice(0, -1).forEach(code => {
                const inp = App.elements.wrapper.querySelector(`.f1il-panel-cell[data-field="alloc"][data-type="${code}"]`);
                const v = App.utils.parseNum(inp && inp.value);
                sum += v;
                if (inp) inp.classList.toggle('f1il-alloc-over', sum > total);
            });

            const restEl = App.elements.wrapper
                .querySelector(`.f1il-panel-cell[data-field="alloc-rest"][data-type="${codes[codes.length - 1]}"]`);
            if (restEl) {
                const rest = total - sum;
                restEl.textContent = `${App.utils.formatNum(rest) || '0'}kg`;
                restEl.classList.toggle('f1il-alloc-over', rest < 0);
            }

            const totalEl = getPanelEl('alloc-total', key);
            if (totalEl) totalEl.textContent = `${App.utils.formatNum(total) || '0'}kg`;

            /* 팝오버를 닫아 두면 배분을 넣었는지 알 수 없습니다. 값이 들어 있으면
               버튼 모양을 바꿔 접힌 상태에서도 보이게 합니다. 넘친 경우도 마찬가지입니다. */
            const btn = App.elements.wrapper.querySelector(`.f1il-alloc-btn[data-type="${key}"]`);
            if (btn) {
                btn.classList.toggle('has-value', sum > 0);
                btn.classList.toggle('is-over', sum > total);
            }
        });

        // 3) 실사용량 = (전일 재고 + 출고롤*중량) - 오늘 재고
        // 4) 실사용량 - ERP
        const prevInv = App.state.prevDayInventory || {};
        App.TYPE_KEYS.forEach(k => {
            const issueInput = getPanelEl('issue', k);
            const issueVal = App.utils.parseNum(issueInput?.value);
            const sw = App.rollWeight(k);
            const prevVal = App.utils.parseNum(prevInv[k]);
            const actualUsage = (prevVal + issueVal * sw) - globalInventory[k];

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

        /* 잔여 주행지 합계는 급지대 계산과 무관하지만, 입력 이벤트가 이 함수
           하나로 모여 있어 여기서 같이 갱신합니다.

           ※ 잔여 주행지는 위의 재고 · 실사용 계산에 넣지 않았습니다. 그 값들은
             급지대에 걸린 양을 다루고, 전일 재고를 v_factory1_geupji_stock
             (호기 표만 보는 뷰)에서 읽어 옵니다. 한쪽에만 더하면 실사용량이
             주행지 잔량만큼 어긋납니다. 두 값을 합치는 건 재고실사 페이지의
             몫입니다. */
        App.calcCarryTotals();

        /* 출고 칸을 고치면 그 자리에서 수기 표시가 붙고 메모줄이 따라 나옵니다.
           대상 용지가 바뀔 때만 다시 그리므로 메모를 치는 중에도 포커스가
           살아 있습니다. */
        App.refreshIssueMemos();
    };

    /* ── 배분 팝오버 열고 닫기 ────────────────────────────────────────────────
       표를 다시 그려도 살아 있도록 wrapper 에 위임해서 한 번만 겁니다.
       ──────────────────────────────────────────────────────────────────────── */
    function closeAllocPops(except) {
        App.elements.wrapper.querySelectorAll('.f1il-alloc-pop.open').forEach(p => {
            if (p !== except) p.classList.remove('open');
        });
        App.elements.wrapper.querySelectorAll('.f1il-alloc-btn.open').forEach(b => {
            if (!except || b.dataset.type !== except.dataset.type) b.classList.remove('open');
        });
    }

    App.bindAllocPopovers = function () {
        if (!App.elements.wrapper) return;

        App.elements.wrapper.addEventListener('click', (e) => {
            const btn = e.target.closest('.f1il-alloc-btn');
            if (btn) {
                const pop = btn.parentElement.querySelector('.f1il-alloc-pop');
                const willOpen = !pop.classList.contains('open');
                closeAllocPops();
                pop.classList.toggle('open', willOpen);
                btn.classList.toggle('open', willOpen);
                if (willOpen) {
                    const first = pop.querySelector('.f1il-panel-cell[data-field="alloc"]');
                    if (first && !first.readOnly) { first.focus(); first.select(); }
                }
                return;
            }

            if (e.target.closest('.f1il-alloc-close')) { closeAllocPops(); return; }

            // 팝오버 바깥을 누르면 닫습니다
            if (!e.target.closest('.f1il-alloc-pop')) closeAllocPops();
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') closeAllocPops();
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
