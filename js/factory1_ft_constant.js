/* factory1_ft_constant.js — 1공장 FT 공통 상수 · 유틸 · 상태1 */
(function () {
    'use strict';

    // 전역 공유 객체 초기화
    window.Factory1Ft = window.Factory1Ft || {};

    const App = window.Factory1Ft;

    // ── Supabase 설정 ────────────────────────────────────────────────────────
    App.SUPABASE_URL = 'https://npiflqoscsvnnauvqhrr.supabase.co';
    App.SUPABASE_KEY = 'sb_publishable_ir-mHSsX6SSIQwHerkLbfA_2qCOP3KW';

    // DB 테이블명
    App.TABLE = 'factory1_ft_real';

    // 지고 재고 테이블명 (날짜와 무관하게 항상 현재값을 덮어쓰는 스냅샷 테이블)
    App.JIGO_TABLE = 'factory1_ft_jigo';

    // 지고 재고 품목별 롤당 무게(kg) — stock_weight 자동 계산용
    App.JIGO_WEIGHT_MULTIPLIER = { A: 1337, C: 1003, D: 669 };

    // 컬럼 목록 (그룹 매핑 포함)
    App.COLUMNS = ['A1', 'A2', 'A3', 'A4', 'C1', 'C2', 'D1', 'D2'];
    App.GROUP_KEYS = { A: ['A1', 'A2', 'A3', 'A4'], C: ['C1', 'C2'], D: ['D1', 'D2'] };
    App.GROUPS = ['A', 'C', 'D'];

    // ── 공통 유틸리티 ─────────────────────────────────────────────────────────
    App.utils = {
        getTodayStr() {
            const d = new Date();
            return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        },
        addDays(dateStr, days) {
            const d = new Date(`${dateStr}T00:00:00`);
            d.setDate(d.getDate() + days);
            return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        },
        formatKoDate(dateStr) {
            if (!dateStr) return '';
            const d = new Date(`${dateStr}T00:00:00`);
            const days = ['일', '월', '화', '수', '목', '금', '토'];
            return `${d.getFullYear()}년 ${String(d.getMonth() + 1).padStart(2, '0')}월 ${String(d.getDate()).padStart(2, '0')}일 (${days[d.getDay()]})`;
        },
        parseNum(value) {
            if (value === undefined || value === null || value === '') return 0;
            const parsed = Number(String(value).replace(/,/g, '').trim());
            return isNaN(parsed) ? 0 : parsed;
        },
        formatNum(value) {
            if (value === '' || value == null) return '';
            const num = Number(value);
            if (isNaN(num)) return '';
            return Number.isInteger(num)
                ? num.toLocaleString()
                : num.toLocaleString(undefined, { maximumFractionDigits: 2 });
        },
        // '1 R/L', '1,234 R/L' 등 지고 재고 표시 형식에서 숫자만 추출
        parseJigoNum(value) {
            if (value === undefined || value === null || value === '') return 0;
            const cleaned = String(value).replace(/R\/L/gi, '').replace(/,/g, '').trim();
            const parsed = Number(cleaned);
            return isNaN(parsed) ? 0 : parsed;
        },
        formatSignedNum(value) {
            if (!value) return '';
            const formatted = App.utils.formatNum(Math.abs(value));
            return value > 0 ? `+${formatted}` : `-${formatted}`;
        }
    };

    // ── 전역 상태 ─────────────────────────────────────────────────────────────
    App.state = {
        currentDate: null,
        isEditMode: false,
        isChanged: false
    };

    // headerApi 플레이스홀더 (factory1_ft_main.js 에서 주입)
    App.headerApi = null;

    // elements 캐시 (factory1_ft_main.js 에서 주입)
    App.elements = {};

})();