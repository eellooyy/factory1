/* common_subnav.js — 서브메뉴 형제 페이지 이동 버튼 (숨은 기능)
   ────────────────────────────────────────────────────────────────
   상단 드롭다운의 하위 메뉴 묶음을 그대로 따라갑니다. 같은 묶음의 다음/이전
   페이지로 한 번에 넘어가는 얇은 세로 버튼을 본문 바깥 여백에 세웁니다.

     첫 페이지  → 우측에 '다음' 버튼
     끝 페이지  → 좌측에 '이전' 버튼
     가운데     → 양쪽 다 (지금은 묶음마다 2개씩이라 해당 없음)

   메뉴를 고칠 때는 아래 GROUPS 만 맞춰 주면 됩니다. HTML 은 건드릴 것이
   없습니다. (버튼은 이 파일이 만들어 붙입니다)
   ──────────────────────────────────────────────────────────────── */
(function () {
    'use strict';

    /* 드롭다운 하위 메뉴 묶음 — 순서가 곧 이동 순서입니다 */
    const GROUPS = [
        {
            menu: '재고 종합',
            pages: [
                { file: 'factory1_inventory_io.html', label: '재고실사' },
                { file: 'factory1_usage.html',        label: '용지별,매체별 사용량' }
            ]
        },
        {
            menu: '1공장 FT',
            pages: [
                { file: 'factory1_ft.html',    label: 'FT 일지' },
                { file: 'factory1_ft_io.html', label: 'FT 재고 종합' }
            ]
        },
        {
            menu: '기타',
            pages: [
                { file: 'factory1_inoutbound.html', label: '입출고 상세 내역' },
                { file: 'factory1_rollcac.html',    label: '롤 무게 계산' }
            ]
        }
    ];

    function currentFile() {
        const path = window.location.pathname;
        return decodeURIComponent(path.substring(path.lastIndexOf('/') + 1));
    }

    /* 본문 래퍼 — 페이지마다 .gf3-wrapper 가 둘입니다.
       하나는 상단 헤더(.gf3-header 를 품음), 다른 하나가 본문입니다. */
    function findContentWrapper() {
        const wrappers = document.querySelectorAll('.gf3-wrapper');
        for (const w of wrappers) {
            if (!w.querySelector('.gf3-header')) return w;
        }
        return null;
    }

    function makeButton(side, target) {
        const a = document.createElement('a');
        a.className = `gf3-subnav gf3-subnav-${side}`;
        a.href = target.file;
        a.title = target.label;          // 네이티브 툴팁 — 올려 봐야 정체를 압니다
        a.setAttribute('aria-label', target.label);

        const icon = document.createElement('span');
        icon.className = 'material-symbols-outlined';
        icon.textContent = (side === 'right') ? 'chevron_right' : 'chevron_left';
        a.appendChild(icon);

        return a;
    }

    /* 버튼을 층 컨테이너에 맞춰 세우고, 자리가 없으면 숨깁니다.

       상하 — 본문 래퍼는 padding-top 이 있어 top:0 으로 두면 표보다 위로
              솟습니다. 래퍼의 실제 padding 을 읽어 그만큼 안쪽으로 넣습니다.
       좌우 — body 에 zoom:115% 가 걸려 있어 "화면 몇 px 이상이면 보인다"를
              미리 계산해 두면 틀립니다. 그래서 버튼을 실제로 놓아 보고
              화면 밖으로 나가면 그때 뺍니다. */
    const EDGE_SLACK = 4;   // 화면 가장자리에 딱 붙지 않도록 두는 여유(px)

    function layout(wrapper, buttons) {
        const cs = window.getComputedStyle(wrapper);
        const top = parseFloat(cs.paddingTop) || 0;
        const bottom = parseFloat(cs.paddingBottom) || 0;
        const viewW = document.documentElement.clientWidth;

        buttons.forEach(btn => {
            btn.style.top = `${top}px`;
            btn.style.bottom = `${bottom}px`;

            // 재는 동안에는 보이지 않게 — 좁은 화면에서 깜빡이지 않습니다
            btn.style.visibility = 'hidden';
            btn.style.display = 'flex';

            const r = btn.getBoundingClientRect();
            const fits = (r.left >= EDGE_SLACK) && (r.right <= viewW - EDGE_SLACK);

            btn.style.display = fits ? 'flex' : 'none';
            btn.style.visibility = '';
        });
    }

    function init() {
        const file = currentFile();
        const group = GROUPS.find(g => g.pages.some(p => p.file === file));
        if (!group) return;

        const idx = group.pages.findIndex(p => p.file === file);
        const wrapper = findContentWrapper();
        if (!wrapper) return;

        const buttons = [];
        if (idx > 0) buttons.push(makeButton('left', group.pages[idx - 1]));
        if (idx < group.pages.length - 1) buttons.push(makeButton('right', group.pages[idx + 1]));
        if (!buttons.length) return;

        wrapper.classList.add('gf3-subnav-host');
        buttons.forEach(b => wrapper.appendChild(b));
        layout(wrapper, buttons);

        /* 창 크기가 바뀌면 다시 판단합니다. load 에서 한 번 더 부르는 이유는,
           웹폰트(Material Symbols)가 늦게 붙으면서 폭이 확정되기 때문입니다.
           표의 행이 늘어나는 것은 다시 잴 필요가 없습니다 — top/bottom 으로
           고정해 두어 래퍼 높이를 저절로 따라갑니다. */
        window.addEventListener('load', () => layout(wrapper, buttons));
        window.addEventListener('resize', () => layout(wrapper, buttons));
    }

    document.addEventListener('DOMContentLoaded', init);
})();
