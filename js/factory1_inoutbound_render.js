/* factory1_inoutbound_render.js — 1공장 전산 입출고 상세 내역 렌더링
   ────────────────────────────────────────────────────────────────
   1층 입고 · 2층 출고 · 3층 확인 필요 · 4층 스캔 요약을 그립니다.

   행 객체는 뷰가 내려줄 모양을 그대로 씁니다.
     { floor, time, manufacturer, vendor, grade, rollNumber, weight,
       productCode, itemKey, status, rawRoll? }

   1·2층에는 해석이 끝난 행(ok · fixed)만 갑니다. 되살리지 못한 행(none)은
   버리지 않고 전부 3층으로 모읍니다. 두 벌로 들고 있지 않고 같은 배열에서
   갈라 쓰기 때문에, api.js 는 state.rows.in / .out 만 채우면 됩니다.

   DB 연결 시에는 api.js 가 App.state.rows 를 채운 뒤 renderAll() 만
   다시 부르면 됩니다.
   ──────────────────────────────────────────────────────────────── */
(function () {
    'use strict';

    const App = window.Factory1Inoutbound;
    if (!App) return;

    const EMPTY = '–';

    function isBlank(v) {
        return v === null || v === undefined || v === '';
    }

    /* 1순위: DB 에서 채워진 state.rows / 2순위: 임시 표시용 SAMPLE / 없으면 빈 배열 */
    function getRows(key) {
        const fromDb = App.state.rows[key];
        if (fromDb && fromDb.length) return fromDb;
        if (App.USE_SAMPLE_DATA && App.SAMPLE[key]) return App.SAMPLE[key];
        return [];
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

    // 중량은 실측이 아니라 라벨에 찍힌 롤 규격 중량(1404 / 702 / 4372 …)입니다.
    // factory1_paper_item.roll_kg 와 같은 숫자입니다.
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
            return cell(row.rollNumber, col.cls + ' f1iob-fixed-cell', `스캔 원본 ${row.rawRoll} → 오독 보정`);
        }

        return cell(row[col.key], col.cls);
    }

    function rowHtml(row, columns) {
        return '<tr>' + columns.map(col => td(row, col)).join('') + '</tr>';
    }

    function placeholder(columns, msg) {
        return `<tr class="f1iob-placeholder"><td colspan="${columns.length}">${msg}</td></tr>`;
    }

    // ── 품목별 롤 수 요약 (표 우측 칸) ────────────────────────────
    /* "대한1576 18롤" 처럼 그날 몇 롤이 오갔는지만 봅니다.
       ITEMS 순서 그대로 깔고, 0롤인 품목도 줄을 비워 두지 않습니다.
       줄이 사라지면 "오늘 대한 D 가 안 들어왔다"가 보이지 않습니다.

       ※ 해석하지 못한 행(none)은 어느 품목인지 알 수 없어 어느 줄에도
         들어가지 못합니다. 그 몫은 맨 아래 '미상' 줄로 따로 세웁니다 —
         합계에서 조용히 빠지면 롤 수가 실제보다 적어 보입니다.
         (그래서 합계는 품목 줄의 합이 아니라 그날 스캔된 전체 롤 수입니다) */
    function renderSide(section, rows) {
        const wrap = document.getElementById(section.sideId);
        if (!wrap) return;

        const count = {};
        let unknown = 0;

        rows.forEach(r => {
            if (isBlank(r.itemKey)) unknown += 1;
            else count[r.itemKey] = (count[r.itemKey] || 0) + 1;
        });

        const line = (label, n, cls, title) => {
            const attr = title ? ` title="${title}"` : '';
            return `<div class="f1iob-side-row${cls ? ' ' + cls : ''}"${attr}>
                        <span class="f1iob-side-name">${label}</span>
                        <span class="f1iob-side-num">${n}</span><span class="f1iob-side-unit">롤</span>
                    </div>`;
        };

        let html = App.ITEMS.map(item => {
            const n = count[item.key] || 0;
            return line(item.label, n, n ? '' : 'zero');
        }).join('');

        if (unknown) {
            html += line('미상', unknown, 'unknown',
                "해석하지 못해 품목을 모르는 롤입니다. 아래 '확인 필요'에 있습니다.");
        }

        wrap.innerHTML = `
            <div class="f1iob-side-title">품목별 롤 수</div>
            <div class="f1iob-side-list">${html}</div>
            <div class="f1iob-side-total">
                <span class="f1iob-side-name">합계</span>
                <span class="f1iob-side-num">${rows.length.toLocaleString('ko-KR')}</span><span class="f1iob-side-unit">롤</span>
            </div>`;
    }

    // ── 층 ────────────────────────────────────────────────────────

    // 1·2층 — 좌측 표에는 해석이 끝난 행만, 우측 요약은 전체를 셉니다
    function renderSection(section) {
        const body = document.getElementById(section.bodyId);
        if (!body) return;

        const all = getRows(section.key);
        const resolved = all.filter(r => r.status !== 'none');

        body.innerHTML = resolved.length
            ? resolved.map(r => rowHtml(r, App.COLUMNS)).join('')
            : placeholder(App.COLUMNS, '이 날짜에 스캔 기록이 없습니다.');

        renderSide(section, all);
    }

    // 3층 — 자동 해석이 안 된 행. 입고·출고를 한 표에 모읍니다.
    function renderReview() {
        const body = document.getElementById(App.REVIEW.bodyId);
        if (!body) return;

        const rows = [];
        App.SECTIONS.forEach(section => {
            getRows(section.key)
                .filter(r => r.status === 'none')
                .forEach(r => {
                    rows.push(Object.assign({}, r, {
                        origin: App.ORIGIN_LABEL[`${section.dir}|${r.floor}`] || section.title
                    }));
                });
        });

        // 입고와 출고가 섞이므로 시각순으로 다시 세웁니다. 시각은 한국시간
        // 벽시계 문자열이라 그대로 비교해도 순서가 맞습니다.
        rows.sort((a, b) => String(a.time).localeCompare(String(b.time)));

        body.innerHTML = rows.length
            ? rows.map(r => rowHtml(r, App.REVIEW_COLUMNS)).join('')
            : placeholder(App.REVIEW_COLUMNS, '확인이 필요한 행이 없습니다.');

        const countEl = document.getElementById(App.REVIEW.countId);
        if (countEl) countEl.textContent = `${rows.length}건`;
    }

    function renderAll() {
        App.SECTIONS.forEach(renderSection);
        renderReview();
    }

    function renderLoading() {
        App.SECTIONS.forEach(section => {
            const body = document.getElementById(section.bodyId);
            if (body) body.innerHTML = placeholder(App.COLUMNS, '불러오는 중...');
        });
        const rv = document.getElementById(App.REVIEW.bodyId);
        if (rv) rv.innerHTML = placeholder(App.REVIEW_COLUMNS, '불러오는 중...');
    }

    // 카드 제목 옆 기준일 안내 문구
    function renderSubtitle(dateStr) {
        const el = App.elements.subtitle;
        if (!el) return;
        const utils = window.Factory3Utils || window.CommonUtils;
        el.textContent = dateStr ? `기준일 ${utils.formatKoDate(dateStr)}` : '';
    }

    /* 날짜가 바뀌면 호출됩니다. (DB 연결 전이므로 지금은 표만 다시 그립니다)

       ※ 조회할 때 created_at 을 날짜로 자르는 방식에 주의하세요. 값이 한국시간
         벽시계인데 +00 으로 저장되어 있어, timezone 을 태우면 야간 출고가 하루씩
         밀립니다. 그대로 잘라야 합니다.
           .gte('created_at', `${dateStr}T00:00:00`)
           .lt ('created_at', `${다음날}T00:00:00`) */
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
    App.loadData = loadData;

})();
