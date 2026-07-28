/* factory1_inoutbound_render.js — 1공장 전산 입출고 상세 내역 렌더링
   ────────────────────────────────────────────────────────────────
   constant.js 의 SECTIONS(구획) · COLUMNS(열)에 따라 세 개의 상세 표와
   상단 요약 카드 세 장을 그립니다.

   행 객체는 뷰가 내려줄 모양을 그대로 씁니다.
     { time, manufacturer, itemType, weight, rollNumber, productCode,
       vendor, item, status }
   앞 6개가 스캔 원본, 뒤 3개가 해석 결과입니다. 해석되지 않은 행은 뒤 3개가
   비고 status 가 'none' 입니다. **행을 지우지 않습니다** — 그 건수가 곧
   "오늘 스캔이 얼마나 깨졌나" 이기 때문입니다.

   DB 연결 시에는 api.js 가 App.state.rows 를 채운 뒤 renderAll() 만
   다시 부르면 됩니다.
   ──────────────────────────────────────────────────────────────── */
(function () {
    'use strict';

    const App = window.Factory1Inoutbound;
    if (!App) return;

    const EMPTY = '–';
    const COLSPAN = App.COLUMNS.length;

    function isBlank(v) {
        return v === null || v === undefined || v === '';
    }

    // 값이 없으면 회색 '–'. 0 은 값이므로 그대로 씁니다.
    function cell(value, cls) {
        if (isBlank(value)) {
            return `<td class="${cls} f1iob-empty">${EMPTY}</td>`;
        }
        return `<td class="${cls}">${value}</td>`;
    }

    // 중량은 롤 규격 중량(1404 / 702 / 4372 …)이라 천 단위 콤마를 넣습니다.
    // 실측이 아니라 라벨에 찍힌 값이며, factory1_paper_item.roll_kg 와 같은 숫자입니다.
    function weightCell(value, cls) {
        if (isBlank(value) || isNaN(value)) {
            return `<td class="${cls} f1iob-empty">${EMPTY}</td>`;
        }
        return `<td class="${cls}">${Number(value).toLocaleString('ko-KR')}</td>`;
    }

    function statusCell(status, cls) {
        const st = App.STATUS[status];
        if (!st) {
            return `<td class="${cls} f1iob-empty">${EMPTY}</td>`;
        }
        return `<td class="${cls}"><span class="f1iob-badge ${st.cls}">${st.label}</span></td>`;
    }

    function rowHtml(row) {
        let html = `<tr class="f1iob-row f1iob-row-${row.status || 'none'}">`;

        App.COLUMNS.forEach(col => {
            const cls = col.cls || '';
            if (col.key === 'status')      html += statusCell(row.status, cls);
            else if (col.key === 'weight') html += weightCell(row.weight, cls);
            else                           html += cell(row[col.key], cls);
        });

        return html + '</tr>';
    }

    /* 1순위: DB 에서 채워진 state.rows / 2순위: 임시 표시용 SAMPLE / 없으면 빈 배열 */
    function getRows(sectionKey) {
        const fromDb = App.state.rows[sectionKey];
        if (fromDb && fromDb.length) return fromDb;
        if (App.USE_SAMPLE_DATA && App.SAMPLE[sectionKey]) return App.SAMPLE[sectionKey];
        return [];
    }

    // 상태 필터 — '오독·미해석만' 은 정상 행을 감춥니다.
    // 요약 카드의 숫자는 필터와 무관하게 언제나 전체를 셉니다. 필터를 걸었다고
    // 오늘 들어온 롤 수가 줄어드는 것처럼 보이면 안 되기 때문입니다.
    function applyFilter(rows) {
        if (App.state.filter !== 'problem') return rows;
        return rows.filter(r => r.status !== 'ok');
    }

    function countByStatus(rows) {
        const c = { total: rows.length, ok: 0, fixed: 0, none: 0 };
        rows.forEach(r => {
            if (c[r.status] !== undefined) c[r.status] += 1;
        });
        return c;
    }

    function renderSection(section) {
        const body = document.getElementById(section.bodyId);
        if (!body) return null;

        const all = getRows(section.key);
        const shown = applyFilter(all);

        if (!shown.length) {
            const msg = all.length ? '해당하는 행이 없습니다.' : '이 날짜에 스캔 기록이 없습니다.';
            body.innerHTML = `<tr class="f1iob-placeholder"><td colspan="${COLSPAN}">${msg}</td></tr>`;
        } else {
            body.innerHTML = shown.map(rowHtml).join('');
        }

        const counts = countByStatus(all);

        // 구획 헤더 우측 건수 — 필터가 걸려 있으면 몇 건만 보고 있는지 같이 알려줍니다
        const countEl = document.getElementById(section.countId);
        if (countEl) {
            countEl.textContent = (shown.length === all.length)
                ? `${all.length}건`
                : `${shown.length} / ${all.length}건`;
        }

        return counts;
    }

    // 요약 카드 한 장 — 총 롤 수와 해석 내역
    function renderCard(section, counts) {
        const card = document.getElementById(section.cardId);
        if (!card) return;

        const set = (name, value) => {
            const el = card.querySelector(`[data-stat="${name}"]`);
            if (el) el.textContent = value;
        };

        set('total', counts.total.toLocaleString('ko-KR'));
        set('ok', counts.ok.toLocaleString('ko-KR'));
        set('fixed', counts.fixed.toLocaleString('ko-KR'));
        set('none', counts.none.toLocaleString('ko-KR'));

        // 깨진 행이 하나도 없는 날은 카드에 표시를 남기지 않습니다.
        // 반대로 하나라도 있으면 카드 자체에 색을 넣어 멀리서도 눈에 띄게 합니다.
        card.classList.toggle('has-problem', (counts.fixed + counts.none) > 0);
    }

    function renderAll() {
        App.SECTIONS.forEach(section => {
            const counts = renderSection(section);
            if (counts) renderCard(section, counts);
        });
    }

    function renderLoading() {
        App.SECTIONS.forEach(section => {
            const body = document.getElementById(section.bodyId);
            if (body) {
                body.innerHTML = `<tr class="f1iob-placeholder"><td colspan="${COLSPAN}">불러오는 중...</td></tr>`;
            }
        });
    }

    // 카드 제목 옆 기준일 안내 문구
    function renderSubtitle(dateStr) {
        const el = App.elements.subtitle;
        if (!el) return;
        const utils = window.Factory3Utils || window.CommonUtils;
        el.textContent = dateStr ? `기준일 ${utils.formatKoDate(dateStr)}` : '';
    }

    function setFilter(key) {
        if (App.state.filter === key) return;
        App.state.filter = key;

        const wrap = App.elements.filterWrap;
        if (wrap) {
            wrap.querySelectorAll('.f1iob-filter-btn').forEach(btn => {
                btn.classList.toggle('active', btn.dataset.filter === key);
            });
        }
        renderAll();
    }

    /* 날짜가 바뀌면 호출됩니다. (DB 연결 전이므로 지금은 표만 다시 그립니다)

       ※ 조회할 때 created_at 을 날짜로 자르는 방식에 주의하세요. 값이 한국시간
         벽시계인데 +00 으로 저장되어 있어, timezone 을 태우면 야간 출고가 하루씩
         밀립니다. 그대로 잘라야 합니다.
           .gte('created_at', `${dateStr}T00:00:00`)
           .lt ('created_at', `${dateStr}T24:00:00` 에 해당하는 다음날 00:00:00) */
    function loadData(dateStr) {
        App.state.currentDate = dateStr;
        renderSubtitle(dateStr);

        // TODO: DB 연결 후 아래처럼 사용합니다.
        //   renderLoading();
        //   App.state.rows = await Api.fetchDay(dateStr);
        //   renderAll();
        renderAll();
    }

    App.renderAll = renderAll;
    App.renderLoading = renderLoading;
    App.renderSubtitle = renderSubtitle;
    App.setFilter = setFilter;
    App.loadData = loadData;

})();
