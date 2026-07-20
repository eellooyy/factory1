/* factory1_ft_api.js — 1공장 FT Supabase DB 연동1 (load / save) */
(function () {
    'use strict';

    const App = window.Factory1Ft;
    if (!App) return;

    // ── Supabase 클라이언트 초기화 ─────────────────────────────────────────────
    const supabase = window.supabase.createClient(App.SUPABASE_URL, App.SUPABASE_KEY);

    // ── 헬퍼: input 요소 조회 ─────────────────────────────────────────────────
    function getInput(field, key, attr) {
        attr = attr || 'col';
        const wrapper = App.elements.wrapper;
        if (!wrapper) return null;
        return wrapper.querySelector(`.f1ft-input[data-field="${field}"][data-${attr}="${key}"]`);
    }

    // ── 헬퍼: 지고 재고 input 요소 조회 (층 + 품목 기준) ─────────────────────
    function getJigoInput(floor, group) {
        const wrapper = App.elements.wrapper;
        if (!wrapper) return null;
        return wrapper.querySelector(`.f1ft-input[data-field="jigo"][data-floor="${floor}"][data-group="${group}"]`);
    }

    // ── 데이터 불러오기 ───────────────────────────────────────────────────────
    App.loadData = async function (dateStr) {
        // 편집 모드 해제
        if (App.headerApi && App.headerApi.isEditMode && App.headerApi.isEditMode()) {
            App.headerApi.toggleEditMode();
        }

        App.clearAllInputs();
        const editBtn = App.elements.editBtn;
        if (editBtn) editBtn.disabled = true;

        const yesterdayStr = App.utils.addDays(dateStr, -1);

        const [yesterdayRes, todayRes] = await Promise.all([
            supabase.from(App.TABLE).select('end_values, contrast_qty').eq('log_date', yesterdayStr).single(),
            supabase.from(App.TABLE).select('*').eq('log_date', dateStr).single()
        ]);

        const yesterdayData = yesterdayRes.data || {};
        const todayData = todayRes.data || {};

        const prevContrast = yesterdayData.contrast_qty || {};
        const todayContrast = todayData.contrast_qty || {};

        // 실재고 – ERP 기준값 세팅
        App.GROUPS.forEach(group => {
            const input = getInput('diff', group, 'group');
            if (input) {
                input.dataset.base = prevContrast[group] || 0;
                input.dataset.saved = todayContrast[group] !== undefined ? todayContrast[group] : '';
            }
        });

        // 사용 전 잔량: 오늘 데이터 우선, 없으면 전날 end_values 이월 (0 제외)
        let startValues = todayData.start_values;
        if (!startValues && yesterdayData.end_values) {
            startValues = {};
            Object.entries(yesterdayData.end_values).forEach(([col, val]) => {
                const numVal = App.utils.parseNum(val);
                if (numVal > 0) startValues[col] = numVal;
            });
        }
        startValues = startValues || {};

        Object.entries(startValues).forEach(([col, val]) => {
            const input = getInput('start', col, 'col');
            if (input) input.value = App.utils.formatNum(val);
        });

        // 사용 후 잔량
        const endValues = todayData.end_values || {};
        Object.entries(endValues).forEach(([col, val]) => {
            const input = getInput('end', col, 'col');
            if (input) input.value = App.utils.formatNum(val);
        });

        // ERP 입력량
        const erpUsage = todayData.erp_usage || {};
        Object.entries(erpUsage).forEach(([group, val]) => {
            const input = getInput('erp', group, 'group');
            if (input) input.value = App.utils.formatNum(val);
        });

        // 메모
        const memoInput = App.elements.wrapper
            ? App.elements.wrapper.querySelector('.f1ft-input[data-field="memo"]')
            : null;
        if (memoInput && todayData.memo) memoInput.value = todayData.memo;

        // 지고 재고 (날짜와 무관하게 항상 현재 스냅샷을 그대로 표시)
        const { data: jigoRows, error: jigoLoadError } = await supabase
            .from(App.JIGO_TABLE)
            .select('location, item_name, stock_qty');

        if (jigoLoadError) {
            console.error('[factory1_ft] 지고 재고 조회 실패:', jigoLoadError.message);
        } else {
            (jigoRows || []).forEach(row => {
                const floor = row.location ? String(row.location).replace(/F$/i, '') : '';
                const input = getJigoInput(floor, row.item_name);
                if (input) input.value = `${App.utils.formatNum(row.stock_qty) || '0'} R/L`;
            });
        }

        App.calculateFields();
        if (editBtn) editBtn.disabled = false;
        App.state.isChanged = false;
    };

    // ── 데이터 저장하기 ───────────────────────────────────────────────────────
    App.saveData = async function () {
        const columns = App.COLUMNS;
        let autoFilledCols = [];

        // 1. 사용 후 잔량이 빈 경우 → 사용 전 잔량으로 자동 채움
        columns.forEach(col => {
            const startInput = getInput('start', col);
            const endInput = getInput('end', col);
            if (startInput && endInput) {
                const startVal = startInput.value.trim();
                const endVal = endInput.value.trim();
                if (startVal !== '' && endVal === '') {
                    endInput.value = startVal;
                    autoFilledCols.push(col);
                }
            }
        });

        if (autoFilledCols.length > 0) {
            App.calculateFields();
            alert(`[자동 입력 안내]\n사용 후 잔량이 입력되지 않은 롤(${autoFilledCols.join(', ')})이 발견되었습니다.\n해당 항목들은 사용하지 않은 것으로 간주하여 '사용 전 잔량' 값이 자동으로 적용되었습니다.`);
        }

        const saveBtn = App.elements.saveBtn;
        if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = '저장 중...'; }

        // 2. 화면 데이터 수집
        const startData = App.collectInputData('start', false);
        const endData = App.collectInputData('end', false);

        // 3. 그룹별 내림차순 자동 정렬 (사용 전 잔량 기준)
        const sortedStartData = {};
        const sortedEndData = {};

        Object.keys(App.GROUP_KEYS).forEach(group => {
            const keys = App.GROUP_KEYS[group];
            let pairs = keys.map(k => ({
                start: startData[k] || 0,
                end: endData[k] || 0
            })).filter(p => p.start > 0 || p.end > 0);

            pairs.sort((a, b) => b.start - a.start);

            keys.forEach((k, index) => {
                if (pairs[index]) {
                    if (pairs[index].start > 0) sortedStartData[k] = pairs[index].start;
                    if (pairs[index].end > 0 || pairs[index].end === 0) sortedEndData[k] = pairs[index].end;
                }
            });
        });

        const memoInput = App.elements.wrapper
            ? App.elements.wrapper.querySelector('.f1ft-input[data-field="memo"]')
            : null;

        // 4. DB Payload
        const payload = {
            log_date: App.state.currentDate,
            start_values: sortedStartData,
            end_values: sortedEndData,
            erp_usage: App.collectInputData('erp', true),
            memo: memoInput ? memoInput.value.trim() : '',
            contrast_qty: {
                A: App.utils.parseNum(getInput('diff', 'A', 'group')?.value) || 0,
                C: App.utils.parseNum(getInput('diff', 'C', 'group')?.value) || 0,
                D: App.utils.parseNum(getInput('diff', 'D', 'group')?.value) || 0
            }
        };

        // 5. 지고 재고 payload 구성 (location + item_name 기준, 날짜와 무관하게 항상 덮어씀)
        //    stock_weight = 입력한 롤 수 × 품목별 롤당 무게(A:1337, C:1003, D:669)
        const jigoPayload = [];
        App.GROUPS.forEach(group => {
            ['5', '6'].forEach(floor => {
                const input = getJigoInput(floor, group);
                if (!input || input.value.trim() === '') return;
                const qty = App.utils.parseJigoNum(input.value);
                jigoPayload.push({
                    location: `${floor}F`,
                    item_name: group,
                    stock_qty: qty,
                    stock_weight: qty * (App.JIGO_WEIGHT_MULTIPLIER[group] || 0)
                });
            });
        });

        const [{ error }, jigoResult] = await Promise.all([
            supabase.from(App.TABLE).upsert(payload, { onConflict: 'log_date' }),
            jigoPayload.length > 0
                ? supabase.from(App.JIGO_TABLE).upsert(jigoPayload, { onConflict: 'location,item_name' })
                : Promise.resolve({ error: null })
        ]);

        if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = '저장'; }

        if (error) {
            alert('저장에 실패했습니다: ' + error.message);
            return;
        }

        if (jigoResult && jigoResult.error) {
            alert('지고 재고 저장에 실패했습니다: ' + jigoResult.error.message);
            return;
        }

        alert('성공적으로 저장되었습니다.');
        App.state.isChanged = false;

        // 4일 이상 과거 데이터 수정 경고
        const fourDaysAgo = App.utils.addDays(App.utils.getTodayStr(), -4);
        if (App.state.currentDate < fourDaysAgo) {
            alert('[주의] 4일 이상 경과된 과거 데이터를 수정하셨습니다.\n수정하신 내역이 이후 날짜의 이월 및 누적 계산에 연쇄적으로 영향을 미칩니다.\n\n반드시 오늘 날짜까지 차례대로 확인하시고 재저장해 주세요.');
        }

        // 편집 모드 종료 후 데이터 리로드
        if (App.headerApi && App.headerApi.toggleEditMode) App.headerApi.toggleEditMode();
        await App.loadData(App.state.currentDate);
    };

})();