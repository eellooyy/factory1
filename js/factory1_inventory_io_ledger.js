/* factory1_inventory_io_ledger.js — 전자신문 대장 대조
   ────────────────────────────────────────────────────────────────
   재고실사 표의 사급 창고(WB11102) 한 블록에만 붙는 기능입니다. 거래처
   (전자신문)가 관리하는 용지재고대장을 이 화면에서 바로 맞춰 봅니다.

   [왜 열을 안 늘렸나]
   이 페이지는 머리글 카드와 본문 카드가 같은 colgroup 을 공유하고
   table-layout: fixed 로 열을 맞춥니다. 열을 하나 늘리면 두 곳을 같이
   고쳐야 하고, 대장이 없는 저장위치 4곳에도 빈 칸이 생깁니다.
   대신 이미 세로 병합돼 있는 저장위치 칸(.f1inv-loc-td)에 배지 한 줄을
   얹었습니다. 그 칸은 이름·코드가 쌓인 구조라 세 번째 줄이 자연스럽게
   들어가고, 2행 높이라 행 높이도 변하지 않습니다.

   [왜 팝업인가]
   표 안에 말풍선을 띄우면 .f1inv-table-scroll 의 overflow 에 잘립니다.
   중앙 모달은 그 문제가 없고, 이 페이지가 이미 쓰는 공지 모달과 껍데기가
   같아 새로 익힐 것이 없습니다.

   [이 대조는 0 을 기대하지 않습니다]
   대장 출고 = 정미사용량 × 1.03(약정 손지 3%), ERP 출고 = 실사용량
   (실손지 5~6%). 매일 200~600kg 씩 구조적으로 벌어집니다. 그래서 세 값의
   차이를 '차이'가 아니라 '미정산 손지 누계'로 적습니다.

   [지금 상태]
   DB 뷰가 아직 없어 전자신문 페이지의 표본(window.Factory1Jeonja.SAMPLE)을
   읽습니다. 값을 가져오는 곳은 아래 fetchMonth() 하나뿐이므로, 뷰가 생기면
   그 함수만 비동기 조회로 바꾸면 됩니다. 표본조차 없으면 배지는
   '대장 미연동' 으로 뜨고 팝업은 그 사실을 그대로 적습니다.
   ──────────────────────────────────────────────────────────────── */
(function () {
    'use strict';

    const App = window.Factory1InventoryIo;
    if (!App) return;

    const CFG = App.LEDGER || {};
    const EMPTY = '–';

    function pad(n) { return String(n).padStart(2, '0'); }
    function fmt(v) {
        if (v === null || v === undefined || v === '' || isNaN(v)) return EMPTY;
        return Number(v).toLocaleString('ko-KR');
    }
    function signed(v) {
        if (v === null || v === undefined || isNaN(v)) return EMPTY;
        const n = Number(v);
        return (n > 0 ? '+' : n < 0 ? '−' : '') + Math.abs(n).toLocaleString('ko-KR');
    }
    function escapeHtml(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    /* ── 대장 조회 ─────────────────────────────────────────────
       ※ 뷰가 붙으면 이 함수 하나만 바꿉니다. 아래 로직은 '달 단위 객체'
         모양(carryStock / rows[] / total)만 알고 있습니다. */
    function fetchMonth(monthStr) {
        const src = window.Factory1Jeonja;
        if (!src || !src.SAMPLE) return null;
        return src.SAMPLE[monthStr] || null;
    }

    // 그 날짜의 대장 한 줄. 없거나 아직 안 적힌 날이면 null
    function ledgerRow(dateStr) {
        const m = fetchMonth(dateStr.slice(0, 7));
        if (!m) return null;
        const row = (m.rows || []).find(r => r.d === Number(dateStr.slice(8, 10)));
        if (!row || row.stock === null || row.stock === undefined) return null;
        if (row.kind === 'pending') return null;   // 원장이 아직 안 온 구간
        return row;
    }

    /* 그 날짜 이하에서 대장이 실제로 적혀 있는 가장 마지막 줄.
       원장은 주 단위로 오므로 화면 기준일에 값이 없는 것이 정상입니다.
       그때 0 이나 직전 값을 몰래 끌어오면 안 되고, '언제 것인지'를 같이
       들고 나와서 화면에 밝혀야 합니다. */
    function latestRow(dateStr) {
        const mStr = dateStr.slice(0, 7);
        const m = fetchMonth(mStr);
        if (!m) return null;
        const day = Number(dateStr.slice(8, 10));
        const rows = (m.rows || [])
            .filter(r => r.d <= day && r.kind !== 'pending'
                         && r.stock !== null && r.stock !== undefined);
        if (!rows.length) return null;
        const r = rows[rows.length - 1];
        return { row: r, date: `${mStr}-${pad(r.d)}`, month: m };
    }

    // 그 주 흐름 — 대장 최종일 기준으로 거슬러 최근 작업일 몇 개
    function recentRows(mStr, upToDay, count) {
        const m = fetchMonth(mStr);
        if (!m) return [];
        return (m.rows || [])
            .filter(r => r.d <= upToDay && r.kind === 'work')
            .slice(-count)
            .map(r => Object.assign({ date: `${mStr}-${pad(r.d)}` }, r));
    }

    /* ── 화면 값(ERP · 실재고) 합계 ────────────────────────────
       대장 재고 열은 1576 · 788 합산이라 품목행별 대조가 원리적으로
       불가능합니다. 그래서 화면 쪽도 블록 소계로 맞춰 더합니다.
       한 품목이라도 값이 없으면 null 로 둡니다 — 없는 값을 0 으로 채우면
       합계가 조용히 작아져서 차이가 실제보다 커 보입니다. */
    function blockSum(loc, keys) {
        let sum = 0;
        for (const item of loc.items) {
            const v = App.state.values[`${loc.locCode}|${item.code}`];
            if (!v) return null;
            for (const k of keys) {
                const n = v[k];
                if (n === null || n === undefined || n === '' || isNaN(n)) return null;
                sum += Number(n);
            }
        }
        return sum;
    }

    function ledgerLoc() {
        return (App.LOCATIONS || []).find(l => l.ledger);
    }

    /* ── 배지 ──────────────────────────────────────────────────
       상태 셋 — 지금 알 수 있는 것만 구분합니다.
         is-ready : 화면 기준일 대장이 있다
         is-stale : 대장은 있으나 기준일보다 이전 것이다 (주차 마감 전)
         is-empty : 아무것도 없다 (대장 미연동)
       '일 증가분이 정상 폭을 벗어남' 경고는 어제 ERP 값이 필요해서
       뷰가 붙은 뒤에 여기 한 가지 상태를 더 추가하면 됩니다. */
    function badgeHtml(loc) {
        if (!loc || !loc.ledger) return '';

        const dateStr = App.state.currentDate;
        if (!dateStr) return '';

        const latest = latestRow(dateStr);

        let cls = 'is-empty';
        let main = '대장 미연동';
        let sub = '';

        if (latest) {
            const onDate = latest.date === dateStr;
            cls = onDate ? 'is-ready' : 'is-stale';
            main = fmt(latest.row.stock);
            // 며칠 자 대장인지. 기준일과 다르면 테두리가 점선으로 바뀌므로
            // '기준' 같은 말을 덧붙이지 않습니다 — 칸이 좁습니다.
            sub = `${Number(latest.date.slice(5, 7))}/${Number(latest.date.slice(8, 10))}`;
        }

        return `
            <button type="button" class="f1inv-ledger-badge ${cls}" data-ledger-open="1"
                    title="전자신문 대장과 대조 (클릭)">
                <span class="material-symbols-outlined">description</span>
                <span class="f1inv-ledger-badge-main">${main}</span>
                ${sub ? `<span class="f1inv-ledger-badge-sub">${sub}</span>` : ''}
            </button>`;
    }

    /* ── 팝업 내용 ─────────────────────────────────────────────── */
    function rowHtml(label, value, cls, note) {
        return `
            <div class="f1inv-lrow ${cls || ''}">
                <span class="f1inv-lrow-label">${label}</span>
                <span class="f1inv-lrow-value">${value}</span>
                <span class="f1inv-lrow-note">${note || ''}</span>
            </div>`;
    }

    function bodyHtml() {
        const loc = ledgerLoc();
        const dateStr = App.state.currentDate;
        const utils = window.Factory3Utils || window.CommonUtils;

        if (!loc) return '<div class="f1inv-lempty">대조할 저장위치가 없습니다.</div>';

        const latest = latestRow(dateStr);
        const erp = blockSum(loc, ['erp']);
        const real = blockSum(loc, ['b5', 'b6', 'b6run']);

        let html = '';

        // 어느 창고 · 어느 날 기준인지 먼저 밝힙니다
        html += `
            <div class="f1inv-lhead">
                <span class="f1inv-lhead-loc">${escapeHtml(loc.locName)}</span>
                <span class="f1inv-lhead-code">${loc.locCode}</span>
                <span class="f1inv-lhead-date">화면 기준일 ${utils.formatKoDate(dateStr)}</span>
            </div>`;

        if (!latest) {
            html += `
                <div class="f1inv-lempty">
                    <strong>대장이 아직 연결되지 않았습니다.</strong>
                    이 달의 전자신문 원장 자료가 없습니다. 자료가 들어오면 아래
                    세 값이 함께 뜹니다.
                </div>`;
        } else if (latest.date !== dateStr) {
            html += `
                <div class="f1inv-lnotice">
                    원장은 주 단위로 옵니다. 화면 기준일
                    <b>${dateStr.slice(5).replace('-', '/')}</b> 자 대장은 아직 오지 않아,
                    수록된 마지막 날 <b>${latest.date.slice(5).replace('-', '/')}</b> 로 맞춥니다.
                </div>`;
        }

        // ── 세 값 ──
        const stock = latest ? latest.row.stock : null;
        html += '<div class="f1inv-lgroup">';
        html += rowHtml('대장 재고', fmt(stock) + ' <em>kg</em>', 'is-primary',
                        latest ? `${latest.date.slice(5).replace('-', '/')} 마감 · 1576 + 788 합산`
                               : '자료 없음');
        html += rowHtml('ERP 재고', fmt(erp) + ' <em>kg</em>', '',
                        erp === null ? '값이 빈 품목이 있어 합계를 내지 않았습니다' : '두 품목 합계');
        html += rowHtml('실재고', fmt(real) + ' <em>kg</em>', '',
                        real === null ? '아직 세지 않은 칸이 있습니다' : 'B5 + B6 + B6(주행지)');
        html += '</div>';

        // ── 미정산 손지 누계 ──
        const gap = (stock === null || erp === null) ? null : stock - erp;
        html += `
            <div class="f1inv-lgap">
                <div class="f1inv-lgap-top">
                    <span class="f1inv-lgap-label">미정산 손지 누계</span>
                    <span class="f1inv-lgap-value">${signed(gap)} <em>kg</em></span>
                </div>
                <p class="f1inv-lgap-why">
                    대장 출고는 <b>정미사용량 × 1.03</b>(약정 손지 3%)이고 ERP 는
                    실사용량입니다. 실손지가 5~6% 라 하루 약
                    <b>${fmt(CFG.dailyDrift)}kg</b> 씩 대장에만 남습니다.
                    <b>0 이 되어야 하는 값이 아니라</b>, 증가 속도가 평소를 벗어나는지
                    보는 값입니다.
                </p>
            </div>`;

        // ── 그 주 흐름 ──
        if (latest) {
            const recent = recentRows(latest.date.slice(0, 7),
                                      Number(latest.date.slice(8, 10)), 4);
            if (recent.length) {
                html += '<div class="f1inv-lweek"><div class="f1inv-lweek-title">최근 작업일</div><table>';
                html += '<thead><tr><th>날짜</th><th>면수</th><th>입고</th><th>출고</th><th>재고</th></tr></thead><tbody>';
                recent.forEach(r => {
                    const isLast = `${latest.date.slice(0, 7)}-${pad(r.d)}` === latest.date;
                    html += `<tr${isLast ? ' class="is-last"' : ''}>`
                         + `<td>${Number(latest.date.slice(5, 7))}/${r.d}</td>`
                         + `<td>${r.myeon ? r.myeon + (r.myeon > 28 ? '<i>증면</i>' : '') : EMPTY}</td>`
                         + `<td>${fmt(r.inSum)}</td>`
                         + `<td>${fmt(r.outSum)}</td>`
                         + `<td>${fmt(r.stock)}</td></tr>`;
                });
                html += '</tbody></table></div>';
            }
        }

        // ── 아직 못 하는 것 ──
        html += `
            <div class="f1inv-lnote">
                대장의 재고 열은 <b>1576 · 788 합산</b>이라 품목행별로는 나눌 수
                없습니다. 전월재고의 롤별 내역(앵커) 한 줄을 받으면 위 '대장 재고'
                가 두 줄로 갈라집니다.
            </div>`;

        html += `
            <div class="f1inv-lfoot">
                <a class="f1inv-lfoot-link" href="${CFG.pageUrl}?d=${dateStr}">
                    전자신문 원장 전체 보기
                    <span class="material-symbols-outlined">arrow_forward</span>
                </a>
            </div>`;

        return html;
    }

    /* ── 열고 닫기 ─────────────────────────────────────────────── */
    function open() {
        const el = App.elements;
        if (!el.ledgerModal) return;
        el.ledgerBody.innerHTML = bodyHtml();
        el.ledgerModal.classList.add('show');
    }

    function close() {
        const el = App.elements;
        if (el.ledgerModal) el.ledgerModal.classList.remove('show');
    }

    function isOpen() {
        const el = App.elements;
        return !!(el.ledgerModal && el.ledgerModal.classList.contains('show'));
    }

    function bind() {
        const el = App.elements;
        el.ledgerModal = document.getElementById('f1invLedgerModal');
        el.ledgerBody = document.getElementById('f1invLedgerBody');
        el.ledgerBtn = document.getElementById('f1invLedgerBtn');

        const closeBtn = document.getElementById('f1invLedgerCloseBtn');
        if (closeBtn) closeBtn.addEventListener('click', close);

        // 바깥을 눌러도 닫힙니다 (공지 모달과 같은 동작)
        if (el.ledgerModal) {
            el.ledgerModal.addEventListener('click', function (e) {
                if (e.target === el.ledgerModal) close();
            });
        }

        if (el.ledgerBtn) el.ledgerBtn.addEventListener('click', open);

        /* 표 안 배지 — 위임으로 답니다. 표는 날짜마다 다시 그려지고,
           bindCellSelect 도 같은 host 에 위임으로 붙어 있습니다.
           stopPropagation 을 하는 이유: 배지가 저장위치 칸(td) 안에 있어서
           그대로 두면 셀 커서까지 같이 움직입니다. */
        if (el.blocks) {
            el.blocks.addEventListener('click', function (e) {
                const btn = e.target.closest('[data-ledger-open]');
                if (!btn) return;
                e.stopPropagation();
                open();
            }, true);
        }

        /* Esc — 셀 선택 해제(render.js)와 같은 키를 씁니다. 팝업이 열려 있으면
           팝업이 먼저 먹고, 선택은 그대로 둡니다. */
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape' && isOpen()) {
                e.stopPropagation();
                close();
            }
        }, true);
    }

    App.ledgerBadgeHtml = badgeHtml;
    App.bindLedger = bind;
    App.openLedger = open;
    App.closeLedger = close;

})();
