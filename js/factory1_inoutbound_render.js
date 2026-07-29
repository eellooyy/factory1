/* factory1_inoutbound_render.js — 1공장 입출고 내역 렌더링
   ────────────────────────────────────────────────────────────────
   한 화면에 방향(입고/출고) 하나를 띄웁니다. 우측 스위처가 state.direction
   만 바꾸고 renderAll() 을 다시 부릅니다 — 조회는 하지 않습니다. 한 날짜를
   불러올 때 api.js 가 입고·출고를 모두 채워 두기 때문입니다.

   행 객체는 api.js 의 normalize() 가 내놓는 모양입니다.
     { floor, time, manufacturer, itemType, vendor, grade, rollNumber,
       weight, productCode, itemKey, status, rawRoll? }

   상세 표에는 해석이 끝난 행(ok · fixed)만 갑니다. 되살리지 못한 행(none)은
   버리지 않고 아래 '확인 필요' 표로 모읍니다.
   ──────────────────────────────────────────────────────────────── */
(function () {
    'use strict';

    const App = window.Factory1Inoutbound;
    if (!App) return;

    const EMPTY = '–';

    function isBlank(v) {
        return v === null || v === undefined || v === '';
    }

    function currentRows() {
        return App.state.rows[App.state.direction] || [];
    }

    function currentDir() {
        return App.DIRECTIONS.find(d => d.key === App.state.direction) || App.DIRECTIONS[0];
    }

    // ── 셀 ────────────────────────────────────────────────────────

    // 값이 없으면 회색 '–'. 0 은 값이므로 그대로 씁니다.
    function cell(value, cls, title) {
        const attr = title ? ` title="${title}"` : '';
        if (isBlank(value)) {
            return `<td class="${cls} f1iob-empty"${attr}>${EMPTY}</td>`;
        }
        return `<td class="${cls}"${attr}>${value}</td>`;
    }

    // 중량은 실측이 아니라 라벨에 찍힌 롤 규격 중량입니다
    // (factory1_paper_item.roll_kg 와 같은 숫자).
    function weightCell(value, cls) {
        if (isBlank(value) || isNaN(value)) {
            return `<td class="${cls} f1iob-empty">${EMPTY}</td>`;
        }
        return `<td class="${cls}">${Number(value).toLocaleString('ko-KR')}</td>`;
    }

    function td(row, col) {
        if (col.key === 'weight') return weightCell(row.weight, col.cls);

        /* 오독을 되살린 행은 되살린 값으로 보여주되, RollNo 에 마우스를 올리면
           원본이 보이게 해 둡니다. 보정은 규칙에 따른 추정이라 언젠가 틀릴 수
           있는데, 원본을 볼 길이 화면에 아예 없으면 틀렸다는 것도 알 수 없습니다.
           (표를 조용하게 두려고 색이나 뱃지 대신 툴팁으로만 남겼습니다) */
        if (col.key === 'rollNumber' && row.rawRoll) {
            return cell(row.rollNumber, col.cls + ' f1iob-fixed-cell',
                `스캔 원본 ${row.rawRoll} → 오독 보정`);
        }

        return cell(row[col.key], col.cls);
    }

    function rowHtml(row, columns, extraClass) {
        const cls = extraClass ? ` class="${extraClass}"` : '';
        return `<tr${cls}>` + columns.map(col => td(row, col)).join('') + '</tr>';
    }

    function placeholder(columns, msg) {
        return `<tr class="f1iob-placeholder"><td colspan="${columns.length}">${msg}</td></tr>`;
    }

    // 표에 배경색을 칠할 층 (B5 하나뿐입니다 — constant.js 의 FLOOR_TAGS)
    function tintFloor() {
        const t = App.FLOOR_TAGS.find(x => x.tint);
        return t ? t.floor : null;
    }

    // ── 상세 표 ───────────────────────────────────────────────────
    /* 5층(B5)에서 들어온 행은 배경으로 구분합니다. 표를 층별로 나누지 않기로
       했으므로, 어느 층 것인지는 색과 우측 '5층 입고' 태그로만 드러납니다. */
    function renderTable() {
        const body = document.getElementById('f1iobBody');
        if (!body) return;

        const resolved = currentRows().filter(r => r.status !== 'none');

        if (!resolved.length) {
            body.innerHTML = placeholder(App.COLUMNS, '이 날짜에 스캔 기록이 없습니다.');
            return;
        }

        const tint = tintFloor();
        body.innerHTML = resolved.map(r =>
            rowHtml(r, App.COLUMNS, r.floor === tint ? 'f1iob-row-tagged' : '')
        ).join('');
    }

    // ── 우측 요약 ─────────────────────────────────────────────────
    /* "대한1576 18롤 25,272kg" 처럼 그날 몇 롤이 오갔는지만 봅니다.
       ITEMS 순서 그대로 깔고 0롤인 품목도 줄을 지킵니다.

       Kg 은 롤 수 × 롤 규격 중량입니다. 실측이 아니라 라벨에 찍힌 값을
       더한 것이므로, 저울에 올린 무게가 아니라 "장부상 이만큼"이라는
       뜻입니다. 급지·ERP 쪽 숫자와 맞대 보려면 이 단위가 필요합니다.

       ※ 해석하지 못한 행(none)은 어느 품목인지 알 수 없어 어느 줄에도
         들어가지 못합니다. 그 몫은 '미상' 줄로 따로 세웁니다 — 합계에서
         조용히 빠지면 롤 수가 실제보다 적어 보입니다.
         (그래서 합계 롤 수는 품목 줄의 합이 아니라 그날 스캔된 전체입니다.
          반대로 합계 Kg 은 해석된 행만 더합니다 — 미상 행의 중량은 깨진
          값이라 더하면 없는 무게가 생깁니다) */
    function renderSide() {
        const wrap = document.getElementById('f1iobSide');
        if (!wrap) return;

        const rows = currentRows();
        const count = {}, kg = {}, byFloor = {};
        let unknown = 0, totalKg = 0;

        rows.forEach(r => {
            const w = Number(r.weight) || 0;

            if (isBlank(r.itemKey)) {
                unknown += 1;
            } else {
                count[r.itemKey] = (count[r.itemKey] || 0) + 1;
                kg[r.itemKey] = (kg[r.itemKey] || 0) + w;
                totalKg += w;
            }

            /* 층별 집계 — 롤 수는 해석 여부와 무관하게 전부 세고(물건은
               실제로 들어왔습니다), Kg 은 해석된 행만 더합니다. 미상 행의
               중량은 깨진 값이라 더하면 없는 무게가 생깁니다. */
            const f = byFloor[r.floor] || (byFloor[r.floor] = { n: 0, kg: 0 });
            f.n += 1;
            if (!isBlank(r.itemKey)) f.kg += w;
        });

        const num = v => Number(v).toLocaleString('ko-KR');

        // Kg 칸 — 해석이 안 돼 무게를 셀 수 없는 줄은 '–'
        const kgCell = v => (v > 0)
            ? `<span class="f1iob-side-kg"><b>${num(v)}</b>kg</span>`
            : `<span class="f1iob-side-kg f1iob-empty">${EMPTY}</span>`;

        const line = (label, n, v, cls, title) => {
            const attr = title ? ` title="${title}"` : '';
            return `<div class="f1iob-side-row${cls ? ' ' + cls : ''}"${attr}>
                        <span class="f1iob-side-name">${label}</span>
                        <span class="f1iob-side-roll"><b>${num(n)}</b>롤</span>
                        ${kgCell(v)}
                    </div>`;
        };

        /* 급지 재고에서 손댄 전산 출고 — 숫자는 스캔 그대로 두고 그 아래에
           '급지에서 N롤로 고침'과 메모만 덧붙입니다. 관측 기록과 사람의 판단을
           섞지 않기 위해서입니다(자세한 이유는 constant.js 의 GEUPJI_ISSUE_TABLE).
           입고에는 해당이 없어 출고를 볼 때만 나옵니다. */
        const noteOf = itemKey => {
            if (App.state.direction !== 'out') return '';
            const m = App.state.sysManual[itemKey];
            if (!m) return '';

            const head = (m.roll === null) ? '급지 메모' : `급지에서 ${num(m.roll)}롤로 고침`;
            const memo = m.memo ? `<span class="f1iob-side-note-memo">${m.memo}</span>` : '';
            return `<div class="f1iob-side-note"><span class="f1iob-side-note-head">${head}</span>${memo}</div>`;
        };

        let html = App.ITEMS.map(item => {
            const n = count[item.key] || 0;
            return line(item.label, n, kg[item.key] || 0, n ? '' : 'zero') + noteOf(item.key);
        }).join('');

        if (unknown) {
            html += line('미상', unknown, 0, 'unknown',
                "해석하지 못해 품목을 모르는 롤입니다. 아래 '확인 필요'에 있습니다.");
        }

        /* 5층 입고 줄 — 표에서 색이 칠해진 행이 몇 롤인지입니다. 위 품목
           줄에서 이만큼이 5층 몫이라는 뜻이기도 합니다.
           출고에는 5층이 없으므로 입고를 볼 때만 나옵니다. 0롤인 날도 줄을
           지킵니다 — 줄이 사라지면 "오늘 5층이 아예 없었다"가 안 보입니다. */
        const tagHtml = (App.state.direction === 'in')
            ? App.FLOOR_TAGS.map(t => {
                const f = byFloor[t.floor] || { n: 0, kg: 0 };
                return `<div class="f1iob-side-tagrow">
                            <span class="f1iob-side-tag ${t.cls}">${t.label}</span>
                            <span class="f1iob-side-roll"><b>${num(f.n)}</b>롤</span>
                            ${kgCell(f.kg)}
                        </div>`;
              }).join('')
            : '';

        /* 제목 자리 — '요약' 대신 '6층 입고' 태그를 세웁니다. 아래 품목 줄이
           어느 층 것인지를 제목이 말하게 하려는 것입니다. 숫자는 붙이지
           않습니다(제목이지 집계 줄이 아닙니다). */
        const sideTag = App.SIDE_TAG;
        const titleHtml = `<span class="f1iob-side-tag ${sideTag.cls}">${sideTag.label} ${currentDir().label}</span>`;

        wrap.innerHTML = `
            <div class="f1iob-side-title">${titleHtml}</div>
            <div class="f1iob-side-list">${html}</div>
            ${tagHtml}
            <div class="f1iob-side-total">
                <span class="f1iob-side-name">합계</span>
                <span class="f1iob-side-roll"><b>${num(rows.length)}</b>롤</span>
                ${kgCell(totalKg)}
            </div>`;
    }

    // ── 확인 필요 ─────────────────────────────────────────────────
    // 지금 보고 있는 방향에서 자동 해석이 안 된 행만 모읍니다.
    function renderReview() {
        const body = document.getElementById('f1iobReviewBody');
        if (!body) return;

        const dir = currentDir();
        const rows = currentRows()
            .filter(r => r.status === 'none')
            .map(r => Object.assign({}, r, {
                origin: App.ORIGIN_LABEL[`${dir.key}|${r.floor}`] || dir.label
            }));

        body.innerHTML = rows.length
            ? rows.map(r => rowHtml(r, App.REVIEW_COLUMNS)).join('')
            : placeholder(App.REVIEW_COLUMNS, '확인이 필요한 행이 없습니다.');

        const countEl = document.getElementById('f1iobReviewCount');
        if (countEl) countEl.textContent = `${rows.length}건`;
    }

    // 좌측 상단 제목 — 방향에 따라 '입고' / '출고'
    function renderTitle() {
        if (App.elements.title) App.elements.title.textContent = currentDir().label;
    }

    function renderAll() {
        renderTitle();
        renderTable();
        renderSide();
        renderReview();
    }

    function renderLoading() {
        const body = document.getElementById('f1iobBody');
        if (body) body.innerHTML = placeholder(App.COLUMNS, '불러오는 중...');
        const rv = document.getElementById('f1iobReviewBody');
        if (rv) rv.innerHTML = placeholder(App.REVIEW_COLUMNS, '불러오는 중...');
    }

    // 제목 우측 기준일 안내 문구
    function renderBaseDate(dateStr) {
        const el = App.elements.basedate;
        if (!el) return;
        const utils = window.Factory3Utils || window.CommonUtils;
        el.textContent = dateStr ? utils.formatKoDate(dateStr) : '';
    }

    /* 최근 DB 갱신 시간 — 방향 스위처 왼쪽.
       "최근 DB 갱신 시간 07-29 14:22" 처럼 월-일 시:분까지만 씁니다. 초까지는
       필요 없고, 날짜가 붙어야 "며칠째 멈춰 있다"가 보입니다.
       문자열을 그대로 자릅니다 — Date 로 바꾸면 안 됩니다(api.js 참고). */
    function renderDbStamp(stamp) {
        const el = App.elements.dbstamp;
        if (!el) return;

        const s = String(stamp || '');
        if (s.length < 16) { el.textContent = ''; return; }

        el.textContent = `최근 DB 갱신 시간 ${s.slice(5, 7)}-${s.slice(8, 10)} ${s.slice(11, 16)}`;
    }

    /* 방향 전환 — 이미 받아 둔 데이터를 다시 그리기만 합니다 */
    function setDirection(key) {
        if (App.state.direction === key) return;
        if (!App.DIRECTIONS.some(d => d.key === key)) return;

        App.state.direction = key;

        const sw = App.elements.switcher;
        if (sw) {
            const bg = sw.querySelector('.selection-bg');
            if (bg) bg.className = `selection-bg mode-${key}`;
            sw.querySelectorAll('.unit-btn').forEach(btn => {
                btn.classList.toggle('active', btn.dataset.direction === key);
            });
        }

        renderAll();
    }

    // 날짜가 바뀌면 호출됩니다
    async function loadData(dateStr) {
        App.state.currentDate = dateStr;
        renderBaseDate(dateStr);

        /* DB 최신 시각은 조회 기준일과 무관하므로 표와 따로 돕니다.
           실패해도 표는 그대로 그려야 하니 기다리지 않습니다. */
        App.fetchLastUpdate().then(renderDbStamp).catch(() => {});

        if (App.state.isLoading) return;
        App.state.isLoading = true;
        renderLoading();

        try {
            const res = await App.fetchDay(dateStr);
            App.state.rows.in = res.in;
            App.state.rows.out = res.out;
            App.state.sysManual = res.sysManual || {};

            renderAll();

            if (res.failed.length) {
                console.warn('[factory1_inoutbound] 일부 테이블 조회에 실패해 그 방향은 비어 있습니다:',
                    res.failed.join(', '));
            }
        } catch (e) {
            console.error('[factory1_inoutbound] 조회 중 오류:', e);
            const body = document.getElementById('f1iobBody');
            if (body) body.innerHTML = placeholder(App.COLUMNS, '불러오지 못했습니다.');
        } finally {
            App.state.isLoading = false;
        }
    }

    App.renderAll = renderAll;
    App.renderLoading = renderLoading;
    App.setDirection = setDirection;
    App.loadData = loadData;

})();
