/* factory1_barcode.js — 1공장 바코드 스캔 해석 규칙 (공용)
   ────────────────────────────────────────────────────────────────
   공정 PC 의 Access DB(\\192.168.0.229\지고\Dongjin.mdb)가 받아 적은
   입출고 스캔을 품목으로 읽어 내는 규칙입니다.

   **이 파일이 규칙의 유일한 출처입니다.** 쓰는 곳이 둘입니다.
     factory1_inoutbound.html          스캔 내역을 그대로 보여주는 화면
     factory1_geupji_inventory.html    '전산 출고' 열 (용지별 롤 수만 씁니다)

   규칙을 두 벌 두면 두 화면의 숫자가 조용히 갈라집니다. 고칠 일이 있으면
   여기만 고치세요.

   [나중에 뷰로 옮길 것]
     합의된 최종 구조는 `factory1_barcode_rule` + `v_factory1_io_normalized`
     입니다. 아직 옮기지 않은 이유는 규칙이 안 끝났기 때문입니다 —
     `11/7534/0133` 이 무엇인지 모르고, 통신 오류로 특수문자가 들어온
     행('7?')도 있습니다. 규칙이 굳으면 normalize() 를 그대로 SQL 로 옮기면
     됩니다. **어느 쪽이든 원본 테이블은 손대지 않습니다.**

   [시각을 절대 변환하지 말 것]
     created_at 은 한국시간 벽시계 값이 timestamptz 에 +00 으로 저장돼
     있습니다. 그래서 하루 경계에도 +00:00 을 붙입니다. 로컬 시각으로
     변환하면 야간 출고(예: 23:19)가 하루씩 밀립니다.
   ──────────────────────────────────────────────────────────────── */
window.Factory1Barcode = (function () {
    'use strict';

    /* ── 원본 테이블 ──────────────────────────────────────────────
       백업 스크립트(C:\AutoRun\factory1_io_supabase_backup.pyw)가 최근 7일을
       delete + insert 합니다. 컬럼은 Access 이름만 바꿔 그대로입니다.
         DTime→created_at, Make→manufacturer, A/D_ITEM→item_type,
         RollNo→roll_number, Weigh→weight, Code→product_code
       ──────────────────────────────────────────────────────────── */
    const TABLES = {
        IN_B5:  'factory1_inbound_b5',
        IN_B6:  'factory1_inbound_b6',
        OUT_B6: 'factory1_outbound_b6'
    };

    /* ── 품목 ─────────────────────────────────────────────────────
       label     화면에 쓰는 짧은 이름
       geupjiKey 급지 재고 페이지의 용지 키(v_factory1_geupji_paper).
                 없는 품목은 급지 '전산 출고'에 잡히지 않습니다 —
                 48.8g(나라사랑)은 아직 geupji_key 가 없고, F.T 는 급지를
                 타지 않습니다.

       순서는 지고 재고·입고·사용량 화면의 열 순서와 같게 고정입니다.
       롤 수가 많은 순으로 재배치하지 않습니다.
       ──────────────────────────────────────────────────────────── */
    const ITEMS = [
        { key: 'daehan_1576', label: '대한1576',  geupjiKey: 'dh_1404' },
        { key: 'daehan_788',  label: '대한788',   geupjiKey: 'dh_702'  },
        { key: 'paper_1576',  label: '페이퍼1576', geupjiKey: 'pp_1404' },
        { key: 'jeonju_1576', label: '전주1576',  geupjiKey: 'jj_1404' },
        { key: 'jeonju_788',  label: '전주788',   geupjiKey: 'jj_702'  },
        { key: 'daehan_1182', label: '대한1182',  geupjiKey: 'dh_1052' },
        { key: 'daehan_488',  label: '48.8g',     geupjiKey: null },
        { key: 'ft',          label: 'F.T',       geupjiKey: null }
    ];

    const GEUPJI_OF = {};        // 품목 키 → 급지 용지 키
    const ITEM_OF_GEUPJI = {};   // 급지 용지 키 → 품목 키 (역방향)
    ITEMS.forEach(i => {
        if (!i.geupjiKey) return;
        GEUPJI_OF[i.key] = i.geupjiKey;
        ITEM_OF_GEUPJI[i.geupjiKey] = i.key;
    });

    /* ── 제조사 코드 ──────────────────────────────────────────────
       misreadOf 가 있으면 그 코드의 오독입니다. 규격은 원래 코드의 규칙을
       그대로 쓰고, 행은 '오독 보정'으로 표시합니다.

       실측(2026-06-29~07-28, 입고 793 · 출고 817):
         입고는 73 / 10 / 62 만 나오고 오독이 한 건도 없습니다.
         출고는 전주가 11(320건) 로, 페이퍼가 60(103건) 으로 거의 항상
         깨집니다. 대한(73)은 입출고 모두 100% 정상입니다.
       ──────────────────────────────────────────────────────────── */
    const VENDORS = {
        '73': { name: '대한제지' },
        '62': { name: '페이퍼코리아' },
        '50': { name: '페이퍼코리아' },
        '51': { name: '페이퍼코리아' },
        '60': { name: '페이퍼코리아', misreadOf: '62' },
        '10': { name: '전주제지' },
        '11': { name: '전주제지', misreadOf: '10' }
    };

    /* ── 제조사 × 중량 → 품목 ─────────────────────────────────────
       weight 는 실측이 아니라 라벨에 찍힌 롤 규격 중량입니다
       (factory1_paper_item.roll_kg 와 같은 값).

       kg      화면에 보여줄 중량. 오독으로 깨진 값(4372 · 2443 · 빈 값)을
               규격 중량으로 되돌립니다.
       misread 중량 자체가 오독인 경우. 제조사 코드가 멀쩡해도 이 값이면
               보정 행으로 셉니다.
       '*'     중량을 보지 않는다는 뜻. 페이퍼코리아는 조건이 없어 전부
               1404(1576폭) 취급입니다 — 출고 60 행은 중량이 아예 비어서
               오기 때문에, 이 규칙이 없으면 통째로 미해석이 됩니다.
       ──────────────────────────────────────────────────────────── */
    const WEIGHT_MAP = {
        '73': {
            1404: { item: 'daehan_1576', grade: 'A권', kg: 1404 },
            1052: { item: 'daehan_1182', grade: 'C권', kg: 1052 },
            702:  { item: 'daehan_788',  grade: 'D권', kg: 702  },
            1405: { item: 'daehan_488',  grade: 'A권', kg: 1405 }
        },
        '62': {
            '*':  { item: 'paper_1576',  grade: 'A권', kg: 1404 }
        },
        '10': {
            1404: { item: 'jeonju_1576', grade: 'A권', kg: 1404 },
            4372: { item: 'jeonju_1576', grade: 'A권', kg: 1404, misread: true },
            702:  { item: 'jeonju_788',  grade: 'D권', kg: 702  },
            2443: { item: 'jeonju_788',  grade: 'D권', kg: 702,  misread: true },
            1337: { item: 'ft',          grade: 'A권', kg: 1337 }
        }
    };
    // 50 · 51 은 62 와 같은 규칙을 씁니다 (WEIGHT_MAP 을 세 벌 두지 않습니다)
    const WEIGHT_MAP_ALIAS = { '50': '62', '51': '62' };

    /* ── 오독 롤번호 되돌리기 ─────────────────────────────────────
       60(=62 페이퍼) 행은 롤번호에서 앞 두 자리 '60' 이 빠지고 중간에 '9' 가
       낍니다. 60[ABC][DEFG] → [ABC]9[DEFG]
         예) 입고 605180278 → 출고 51890278

       실측 검증: 출고 60 행 103건을 이 규칙으로 되돌려 같은 기간 입고 62
       목록과 맞춰 보니 89건이 일치했습니다. 남은 14건은 조회 기간보다 앞서
       입고된 롤이라 목록에 없는 것입니다.

       ※ 11(=10 전주) 행은 롤번호가 깨지지 않습니다. 제조사 코드와 중량만
         흔들립니다. 되돌릴 것이 없습니다.
       ──────────────────────────────────────────────────────────── */
    const ROLL_FIX_MAKE = '60';

    function restoreRoll(roll) {
        if (roll.length === 8 && roll[3] === '9') {
            return '60' + roll.slice(0, 3) + roll.slice(4);
        }
        return null;
    }

    /* 보이지 않는 문자만 털어 냅니다. 값 자체는 고치지 않습니다 —
       무엇이 찍혔는지가 '확인 필요' 표의 판단 근거이기 때문입니다.

       출고 60 행의 roll_number 끝에는 CR 이 붙어 옵니다(103건 전부).
       0x80 이 낀 행도 몇 건 있습니다. */
    function clean(v) {
        if (v === null || v === undefined) return '';
        const str = String(v);
        let out = '';
        for (let i = 0; i < str.length; i++) {
            const c = str.charCodeAt(i);
            if (c > 0x1F && c !== 0x7F && (c < 0x80 || c > 0x9F)) out += str[i];
        }
        return out.trim();
    }

    // '2026-07-28T08:59:05+00:00' → '08:59:05' (변환 없이 그대로 자릅니다)
    function timeOf(createdAt) {
        const s = String(createdAt || '');
        return s.length >= 19 ? s.slice(11, 19) : '';
    }

    // 하루 경계 — 저장된 값이 +00 이므로 경계도 +00 으로 맞춥니다
    function dayRange(dateStr) {
        const utils = window.Factory3Utils || window.CommonUtils;
        return {
            from: `${dateStr}T00:00:00+00:00`,
            to:   `${utils.addDays(dateStr, 1)}T00:00:00+00:00`
        };
    }

    /* ── 한 행 해석 ───────────────────────────────────────────────
       돌려주는 모양:
         { floor, time, manufacturer, itemType, vendor, grade,
           rollNumber, weight, productCode, itemKey, status, rawRoll? }

       status  ok    바코드가 그대로 읽힘
               fixed 오독 규칙으로 품목까지 되살림
               none  되살리지 못함

       해석하지 못하면 status: 'none' 으로 두고 **원본 값을 그대로 실어
       보냅니다.** 버리지 않습니다 — 그 건수가 곧 "오늘 스캔이 얼마나
       깨졌나"이고, 인식 불가 롤(B5 의 0000/000/00)도 물건은 실제로
       들어왔기 때문입니다.
       ──────────────────────────────────────────────────────────── */
    function normalize(raw, floor) {
        const make     = clean(raw.manufacturer);
        const itemType = clean(raw.item_type);
        const pcode    = clean(raw.product_code);
        const weight   = (raw.weight === null || raw.weight === undefined) ? null : Number(raw.weight);
        const roll     = clean(raw.roll_number);

        const row = {
            floor: floor,
            time: timeOf(raw.created_at),
            manufacturer: make,
            itemType: itemType,
            vendor: '',
            grade: '',
            rollNumber: roll,
            weight: weight,
            productCode: pcode,
            itemKey: null,
            status: 'none'
        };

        const vendor = VENDORS[make];
        if (!vendor) return row;

        // 오독 코드는 원래 코드의 규격 규칙을 그대로 씁니다 (60→62, 11→10)
        const base  = vendor.misreadOf || make;
        const table = WEIGHT_MAP[WEIGHT_MAP_ALIAS[base] || base];
        if (!table) return row;

        const hit = (weight !== null && table[weight]) || table['*'];
        if (!hit) return row;

        row.vendor  = vendor.name;
        row.grade   = hit.grade;
        row.weight  = hit.kg;          // 깨진 중량(4372 · 2443 · 빈 값)을 규격 중량으로
        row.itemKey = hit.item;
        row.status  = (vendor.misreadOf || hit.misread) ? 'fixed' : 'ok';

        if (make === ROLL_FIX_MAKE) {
            const fixed = restoreRoll(roll);
            if (fixed) {
                row.rawRoll = roll;    // 원본은 표의 툴팁으로 남습니다
                row.rollNumber = fixed;
            }
        }

        return row;
    }

    /* ── 하루치 조회 ──────────────────────────────────────────────
       tables: [{ name, floor }] — 부르는 쪽이 필요한 것만 넘깁니다.
       실패하면 null 을 돌려줍니다(빈 배열과 구분해야 "조회가 안 됐다"와
       "그날 스캔이 없다"를 가릴 수 있습니다).
       ──────────────────────────────────────────────────────────── */
    async function fetchRows(supabase, tables, dateStr) {
        const range = dayRange(dateStr);

        const jobs = tables.map(async t => {
            const { data, error } = await supabase
                .from(t.name)
                .select('created_at, manufacturer, item_type, roll_number, weight, product_code')
                .gte('created_at', range.from)
                .lt('created_at', range.to)
                .order('created_at', { ascending: true });

            if (error) {
                console.error(`[factory1_barcode] ${t.name} 조회 실패:`, error.message);
                return null;
            }
            return (data || []).map(r => normalize(r, t.floor));
        });

        const done = await Promise.all(jobs);
        if (done.some(r => r === null)) return null;

        // 여러 테이블을 합쳐 오므로 시각순으로 다시 세웁니다. 시각은 한국시간
        // 벽시계 문자열이라 그대로 비교해도 순서가 맞습니다.
        return done.flat().sort((a, b) => String(a.time).localeCompare(String(b.time)));
    }

    /* 급지 재고 페이지가 쓰는 모양 — 용지 키별 롤 수.
       해석하지 못한 행과 급지를 타지 않는 품목(48.8g · F.T)은 빠집니다.
       그래서 이 합은 그날 스캔된 전체 롤 수보다 작을 수 있습니다. */
    function countByGeupjiKey(rows) {
        const byKey = {};
        (rows || []).forEach(r => {
            const gk = r.itemKey && GEUPJI_OF[r.itemKey];
            if (!gk) return;
            byKey[gk] = (byKey[gk] || 0) + 1;
        });
        return byKey;
    }

    // 출고 하루치 → 용지 키별 롤 수. 조회 실패는 null.
    async function fetchOutboundByGeupjiKey(supabase, dateStr) {
        const rows = await fetchRows(supabase, [{ name: TABLES.OUT_B6, floor: 'B6' }], dateStr);
        if (rows === null) return null;
        return countByGeupjiKey(rows);
    }

    return {
        TABLES: TABLES,
        ITEMS: ITEMS,
        GEUPJI_OF: GEUPJI_OF,
        ITEM_OF_GEUPJI: ITEM_OF_GEUPJI,
        VENDORS: VENDORS,
        WEIGHT_MAP: WEIGHT_MAP,
        WEIGHT_MAP_ALIAS: WEIGHT_MAP_ALIAS,
        clean: clean,
        timeOf: timeOf,
        dayRange: dayRange,
        normalize: normalize,
        fetchRows: fetchRows,
        countByGeupjiKey: countByGeupjiKey,
        fetchOutboundByGeupjiKey: fetchOutboundByGeupjiKey
    };
})();
