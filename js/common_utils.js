/* common_utils.js — 1공장 · 3공장 공통 유틸 (기존 factory3_utils.js를 승격, 내용은 완전히 동일) */
window.Factory3Utils = {
    supabaseUrl: 'https://npiflqoscsvnnauvqhrr.supabase.co',
    supabaseKey: 'sb_publishable_ir-mHSsX6SSIQwHerkLbfA_2qCOP3KW',
    supabase: null,
    initSupabase: function() {
        if (!this.supabase && window.supabase) {
            this.supabase = window.supabase.createClient(this.supabaseUrl, this.supabaseKey);
        }
        return this.supabase;
    },
    getTodayStr: () => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    },
    formatKoDate: (str) => {
        if (!str) return '';
        const d = new Date(str);
        const days = ['일', '월', '화', '수', '목', '금', '토'];
        return `${d.getFullYear()}년 ${String(d.getMonth() + 1).padStart(2, '0')}월 ${String(d.getDate()).padStart(2, '0')}일 (${days[d.getDay()]})`;
    },
    addDays: (dateStr, days) => {
        const d = new Date(dateStr);
        d.setDate(d.getDate() + days);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }
};
