/* factory1_rollcac_constant.js — 롤 무게 계산 상수 (용지 목록 + 계산식)
   ────────────────────────────────────────────────────────────────
   이 페이지는 DB를 보지 않습니다. 저울에 올리지 않고 남은 무게를 어림하는
   계산기일 뿐이라, 값을 저장할 곳도 불러올 곳도 없습니다.

   [용지 목록의 출처]
     factory1_paper_item 테이블을 그대로 옮겨 적은 것입니다.
     (item_code / vendor_name / grade / width_mm / roll_kg / sort_order)
     품목이 늘거나 완롤 무게가 바뀌면 여기 PAPERS 만 고치면 됩니다.
     DB를 읽지 않는 이유는, 이 페이지가 현장에서 인터넷이 끊겨도 열려야
     하기 때문입니다 — 계산에 필요한 건 숫자 두 개뿐입니다.

     ※ 대한 C(1182)는 1052kg 입니다. 예전 계산기(roll_caculate.pyw)에는
       1003 으로 적혀 있었는데, 그건 F.T C 의 값입니다. 여기서는 테이블
       값(1052)을 따릅니다.

   [계산식]
     롤을 옆에서 보면 종이는 코어 바깥면부터 표면까지 도넛 모양으로 감겨
     있습니다. 그 단면적이 곧 감긴 종이의 양입니다.

       단면적 ∝ (코어지름 + 2×두께)² − 코어지름²

     완롤일 때의 단면적을 1로 두고, 지금 측정한 두께의 단면적이 그 중
     몇 할인지를 완롤 무게에 곱합니다. 여기에 지수 0.97 을 씌우는 것은
     안쪽이 바깥쪽보다 조금 더 단단하게 감기기 때문입니다(=안쪽 종이가
     같은 두께라도 더 무겁습니다). 마지막 −19kg 은 지관 무게 보정입니다.

     세 상수(코어 10.5 · 완롤 55.25 · 보정 19)는 1공장 실측으로 맞춘
     값입니다.
   ──────────────────────────────────────────────────────────────── */
window.Factory1RollcacConstant = (function () {
    'use strict';

    /* ── 계산 상수 ─────────────────────────────────────────────── */
    const CALC = {
        coreDiameterCm: 10.5,    // 지관 바깥 지름
        fullThicknessCm: 55.25,  // 완롤일 때 코어 바깥면 ~ 표면 두께
        packExponent: 0.97,      // 권취 밀도 보정
        coreWeightKg: 19         // 지관 무게 보정
    };

    /* ── 용지 목록 ─────────────────────────────────────────────── */
    /* key      화면/상태에서 쓰는 식별자 (factory1_paper_item.item_code)
       vendor   드롭다운 묶음 이름
       grade    권종
       width    폭(mm)
       rollKg   완롤 규격 무게
       note     같은 규격인데 무게가 다른 경우의 꼬리표 (48.8g) */
    const PAPERS = [
        { key: 'daehan_a',    vendor: '대한제지',   grade: 'A', width: 1576, rollKg: 1404, note: '' },
        { key: 'daehan_d',    vendor: '대한제지',   grade: 'D', width: 788,  rollKg: 702,  note: '' },
        { key: 'daehan_c',    vendor: '대한제지',   grade: 'C', width: 1182, rollKg: 1052, note: '' },
        { key: 'daehan_488',  vendor: '대한제지',   grade: 'A', width: 1576, rollKg: 1405, note: '48.8g' },

        { key: 'paperkorea',  vendor: '페이퍼코리아', grade: 'A', width: 1576, rollKg: 1404, note: '' },

        { key: 'jj_bonji_a',  vendor: '전주본지',   grade: 'A', width: 1576, rollKg: 1404, note: '' },
        { key: 'jj_bonji_d',  vendor: '전주본지',   grade: 'D', width: 788,  rollKg: 702,  note: '' },

        { key: 'jj_jeonja_a', vendor: '전주전자',   grade: 'A', width: 1576, rollKg: 1404, note: '' },
        { key: 'jj_jeonja_d', vendor: '전주전자',   grade: 'D', width: 788,  rollKg: 702,  note: '' },

        { key: 'ft_a',        vendor: 'F.T',       grade: 'A', width: 1575, rollKg: 1337, note: '' },
        { key: 'ft_c',        vendor: 'F.T',       grade: 'C', width: 1182, rollKg: 1003, note: '' },
        { key: 'ft_d',        vendor: 'F.T',       grade: 'D', width: 788,  rollKg: 669,  note: '' }
    ];

    /* 드롭다운 묶음 순서 — PAPERS 에 처음 나온 순서를 그대로 씁니다 */
    function vendorOrder() {
        const seen = [];
        PAPERS.forEach(p => { if (!seen.includes(p.vendor)) seen.push(p.vendor); });
        return seen;
    }

    function findPaper(key) {
        return PAPERS.find(p => p.key === key) || null;
    }

    /* 측정 두께(cm) → 남은 무게(kg)
       음수는 돌려주지 않습니다. 두께가 아주 얇으면 지관 보정(−19)이 종이
       무게보다 커져 음수가 나오는데, 그건 "거의 다 썼다"는 뜻이지 무게가
       음수라는 뜻이 아닙니다. */
    function remainWeight(rollKg, thicknessCm) {
        const core = CALC.coreDiameterCm;
        const denom = Math.pow(core + 2 * CALC.fullThicknessCm, 2) - Math.pow(core, 2);
        const num = Math.pow(core + 2 * thicknessCm, 2) - Math.pow(core, 2);
        if (num <= 0) return 0;

        const raw = Math.floor(rollKg * Math.pow(num / denom, CALC.packExponent)) - CALC.coreWeightKg;
        return Math.max(0, raw);
    }

    return { CALC, PAPERS, vendorOrder, findPaper, remainWeight };
})();
