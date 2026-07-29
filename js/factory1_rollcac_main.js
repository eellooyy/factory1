/* factory1_rollcac_main.js — 롤 무게 계산 화면 로직
   ────────────────────────────────────────────────────────────────
   회사 → 롤 규격 → 표준 무게 순으로 좁혀 고르고, 두께(cm)를 적으면 그
   자리에서 잔량이 나옵니다. [계산] 버튼이 없는 것은 일부러입니다 —
   누를 것이 하나 줄면 그만큼 덜 틀립니다. 되돌릴 일은 [초기화] 하나로
   끝냅니다.

   저장하지 않습니다. 조회하지도 않습니다. 이 파일 밖으로 나가는 값이
   없습니다.

   [드롭다운을 직접 그린 이유]
     body 에 zoom:115% 가 걸려 있어 크롬이 네이티브 <select> 팝업의 위치를
     어긋나게 잡습니다. 그러면 열자마자 마우스를 뗀 자리가 팝업 밖이 되어
     그대로 닫힙니다("깜빡인다"고 보이는 증상). 아래 Dropdown 은 평범한
     div/button 이라 이 영향을 받지 않습니다.
   ──────────────────────────────────────────────────────────────── */
(function () {
    'use strict';

    const C = window.Factory1RollcacConstant;

    function $(id) { return document.getElementById(id); }
    function fmt(n) { return Number(n).toLocaleString('ko-KR'); }

    /* ================================================================
       Dropdown — 버튼 하나 + 목록 하나

       열려 있는 드롭다운은 언제나 하나뿐입니다. 바깥을 누르면 닫히고,
       Esc 로도 닫힙니다. 위/아래 화살표로 항목을 옮겨 다닐 수 있습니다.
       ================================================================ */
    const registry = [];

    function Dropdown(rootId, placeholder, onChange) {
        const root = $(rootId);
        const btn = root.querySelector('.f1rc-dd-btn');
        const text = root.querySelector('.f1rc-dd-text');
        const panel = root.querySelector('.f1rc-dd-panel');

        let items = [];        // [{ value, label }]
        let value = null;
        let isOpen = false;

        function paintButton() {
            const hit = items.find(i => i.value === value);
            text.textContent = hit ? hit.label : placeholder;
            text.classList.toggle('is-placeholder', !hit);
        }

        function close() {
            if (!isOpen) return;
            isOpen = false;
            root.classList.remove('is-open');
            btn.setAttribute('aria-expanded', 'false');
        }

        function open() {
            if (isOpen || root.classList.contains('is-disabled')) return;
            registry.forEach(d => { if (d !== api) d.close(); });
            isOpen = true;
            root.classList.add('is-open');
            btn.setAttribute('aria-expanded', 'true');

            // 고른 항목이 목록 밖에 있으면 보이는 자리로 끌어옵니다
            const active = panel.querySelector('.is-selected');
            if (active) active.scrollIntoView({ block: 'nearest' });
        }

        function select(v, silent) {
            value = v;
            paintButton();
            panel.querySelectorAll('.f1rc-dd-option').forEach(o => {
                o.classList.toggle('is-selected', o.dataset.value === String(v));
            });
            close();
            if (!silent && onChange) onChange(v);
        }

        function moveFocus(step) {
            const options = [...panel.querySelectorAll('.f1rc-dd-option')];
            if (!options.length) return;
            const at = options.indexOf(document.activeElement);
            const next = at < 0
                ? (step > 0 ? 0 : options.length - 1)
                : Math.min(options.length - 1, Math.max(0, at + step));
            options[next].focus();
        }

        function setItems(list) {
            items = list;
            panel.innerHTML = '';

            list.forEach(item => {
                const opt = document.createElement('button');
                opt.type = 'button';
                opt.className = 'f1rc-dd-option';
                opt.setAttribute('role', 'option');
                opt.dataset.value = item.value;
                opt.textContent = item.label;
                opt.addEventListener('click', () => select(item.value));
                panel.appendChild(opt);
            });

            /* 고를 것이 하나뿐이면 사람 손을 빌리지 않습니다 — 누를 것이
               하나뿐인 드롭다운은 물어보는 시늉일 뿐입니다. */
            if (list.length === 1) {
                select(list[0].value);
            } else {
                value = null;
                paintButton();
            }
        }

        btn.addEventListener('click', () => { isOpen ? close() : open(); });

        btn.addEventListener('keydown', e => {
            if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                open();
                moveFocus(1);
            } else if (e.key === 'Escape') {
                close();
            }
        });

        panel.addEventListener('keydown', e => {
            if (e.key === 'ArrowDown') { e.preventDefault(); moveFocus(1); }
            else if (e.key === 'ArrowUp') { e.preventDefault(); moveFocus(-1); }
            else if (e.key === 'Escape') { e.preventDefault(); close(); btn.focus(); }
            else if (e.key === 'Tab') { close(); }
        });

        const api = {
            root,
            close,
            setItems,
            getValue: () => value,
            clear: () => { setItems([]); value = null; paintButton(); },
            setDisabled: on => {
                root.classList.toggle('is-disabled', !!on);
                btn.disabled = !!on;
                if (on) close();
            },
            focus: () => btn.focus()
        };

        registry.push(api);
        paintButton();
        return api;
    }

    /* 바깥을 누르면 닫습니다. 누른 자리가 그 드롭다운 안이면 놔둡니다 —
       여기서 stopPropagation 을 쓰면 상단 햄버거 메뉴가 안 닫힙니다. */
    document.addEventListener('click', e => {
        registry.forEach(d => { if (!d.root.contains(e.target)) d.close(); });
    });

    /* ================================================================
       화면
       ================================================================ */
    const el = {};
    const dd = {};
    let paper = null;   // 최종 선택된 용지 (없으면 null)

    /* 규격 키 — 회사 안에서 '권종 + 폭' 이 같으면 같은 규격입니다.
       (대한 A 1576 은 46g/48.8g 둘로 갈리는데, 그 갈림은 다음 칸에서
       표준 무게로 고릅니다) */
    function specKey(p) { return `${p.grade}|${p.width}`; }
    function specLabel(p) { return `${p.grade}권 · ${fmt(p.width)}mm`; }
    function weightLabel(p) {
        return p.note ? `${fmt(p.rollKg)} kg (${p.note})` : `${fmt(p.rollKg)} kg`;
    }

    function uniqueSpecs(vendor) {
        const out = [];
        C.PAPERS.filter(p => p.vendor === vendor).forEach(p => {
            if (out.some(o => o.value === specKey(p))) return;
            out.push({ value: specKey(p), label: specLabel(p) });
        });
        return out;
    }

    function weightsOf(vendor, spec) {
        return C.PAPERS
            .filter(p => p.vendor === vendor && specKey(p) === spec)
            .map(p => ({ value: p.key, label: weightLabel(p) }));
    }

    function onVendorChange(vendor) {
        dd.weight.clear();
        dd.weight.setDisabled(true);

        if (!vendor) {
            dd.spec.clear();
            dd.spec.setDisabled(true);
        } else {
            dd.spec.setDisabled(false);
            dd.spec.setItems(uniqueSpecs(vendor));   // 하나뿐이면 스스로 골라 다음 칸까지 이어집니다
        }
        syncPaper();
    }

    function onSpecChange(spec) {
        const vendor = dd.vendor.getValue();
        if (!vendor || !spec) {
            dd.weight.clear();
            dd.weight.setDisabled(true);
        } else {
            dd.weight.setDisabled(false);
            dd.weight.setItems(weightsOf(vendor, spec));
        }
        syncPaper();
    }

    function syncPaper() {
        paper = C.findPaper(dd.weight.getValue());
        render();
    }

    function readThickness() {
        const raw = el.thickness.value.trim();
        if (raw === '') return null;
        const v = parseFloat(raw);
        return Number.isFinite(v) ? v : null;
    }

    function setHint(message, warn) {
        el.hint.textContent = message || '';
        el.hint.className = warn ? 'f1rc-hint warn' : 'f1rc-hint';
    }

    function render() {
        const t = readThickness();

        if (!paper || t === null) {
            el.value.textContent = '—';
            el.value.classList.add('is-empty');
            setHint('');
            return;
        }
        if (t < 0) {
            el.value.textContent = '—';
            el.value.classList.add('is-empty');
            setHint('두께는 0 보다 작을 수 없습니다.', true);
            return;
        }

        el.value.textContent = fmt(C.remainWeight(paper.rollKg, t));
        el.value.classList.remove('is-empty');

        /* 완롤 두께를 넘긴 값은 막지 않고 계산해 주되 말은 해 둡니다.
           지관이 굵게 감긴 롤에서 55.25 를 살짝 넘기는 일이 실제로 있고,
           그때 입력이 튕기면 쓸 수 없는 계산기가 됩니다. */
        if (t > C.CALC.fullThicknessCm) {
            setHint(`완롤 두께(${C.CALC.fullThicknessCm}cm)를 넘었습니다 — 참고용으로만 보세요.`, true);
        } else {
            setHint('');
        }
    }

    function reset() {
        dd.vendor.setItems(C.vendorOrder().map(v => ({ value: v, label: v })));
        onVendorChange(null);
        el.thickness.value = '';
        render();
        dd.vendor.focus();
    }

    function init() {
        el.thickness = $('f1rcThickness');
        el.resetBtn = $('f1rcResetBtn');
        el.value = $('f1rcValue');
        el.hint = $('f1rcHint');
        if (!el.thickness) return;

        dd.vendor = Dropdown('f1rcVendor', '회사 선택', onVendorChange);
        dd.spec = Dropdown('f1rcSpec', '규격 선택', onSpecChange);
        dd.weight = Dropdown('f1rcWeight', '무게 선택', syncPaper);

        dd.vendor.setItems(C.vendorOrder().map(v => ({ value: v, label: v })));
        dd.spec.setDisabled(true);
        dd.weight.setDisabled(true);

        el.thickness.addEventListener('input', render);
        el.resetBtn.addEventListener('click', reset);

        /* 엔터는 계산이 아니라 "다 적었다"는 신호로 씁니다 — 값은 이미
           떠 있으므로 커서만 입력칸에서 빼 줍니다. */
        el.thickness.addEventListener('keydown', e => {
            if (e.key === 'Enter') { e.preventDefault(); el.thickness.blur(); }
        });

        render();
    }

    document.addEventListener('DOMContentLoaded', init);
})();
