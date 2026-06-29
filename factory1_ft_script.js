(function () {
    'use strict';

    // Supabase 설정 (본인 프로젝트 정보)
    const supabaseUrl = 'https://npiflqoscsvnnauvqhrr.supabase.co';
    const supabaseKey = 'sb_publishable_ir-mHSsX6SSIQwHerkLbfA_2qCOP3KW'; 
    const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

    const state = {
        currentDate: null,
        fp: null,
        isEditMode: false
    };

    const elements = {};

    const utils = {
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
            if (!value) return 0;
            return Number(String(value).replace(/,/g, '').trim()) || 0;
        },
        formatNum(value) {
            if (!value) return '';
            return Number.isInteger(value)
                ? value.toLocaleString()
                : value.toLocaleString(undefined, { maximumFractionDigits: 2 });
        },
        formatSignedNum(value) {
            if (!value) return '';
            const formatted = utils.formatNum(Math.abs(value));
            return value > 0 ? `+${formatted}` : `-${formatted}`;
        }
    };

    function syncDateLabel() {
        if (elements.dateText) {
            elements.dateText.textContent = utils.formatKoDate(state.currentDate);
        }
    }

    // 날짜 설정 시 데이터를 DB에서 새로 불러옵니다.
    function setDate(dateStr) {
        state.currentDate = dateStr;
        syncDateLabel();

        if (state.fp && state.fp.selectedDates[0]) {
            const selected = state.fp.formatDate(state.fp.selectedDates[0], 'Y-m-d');
            if (selected !== dateStr) {
                state.fp.setDate(dateStr, false);
            }
        }
        
        // 날짜 변경 시 해당 일자 DB 불러오기
        loadFactoryData(dateStr);
    }

    function getInput(field, key, attr = 'col') {
        return elements.wrapper.querySelector(`.f1ft-input[data-field="${field}"][data-${attr}="${key}"]`);
    }

    function setReadOnlyMode(isReadOnly) {
        elements.wrapper.classList.toggle('edit-mode', !isReadOnly);
        elements.wrapper
            .querySelectorAll('.f1ft-input[data-field="start"], .f1ft-input[data-field="end"], .f1ft-input[data-field="memo"], .f1ft-input[data-field="erp"]')
            .forEach((input) => {
                input.readOnly = isReadOnly;
            });
    }

    function calculateFields() {
        const groups = { A: 0, C: 0, D: 0 };
        const columns = ['A1', 'A2', 'A3', 'A4', 'C1', 'C2', 'D1', 'D2'];

        columns.forEach((col) => {
            const startInput = getInput('start', col);
            const endInput = getInput('end', col);
            const usageInput = getInput('usage', col);
            const start = utils.parseNum(startInput?.value);
            const end = utils.parseNum(endInput?.value);
            const usage = start - end;
            const group = startInput?.dataset.group;

            if (usageInput) {
                usageInput.value = start || end ? utils.formatNum(usage) : '';
            }

            if (group && Object.prototype.hasOwnProperty.call(groups, group)) {
                groups[group] += usage;
            }
        });

        Object.entries(groups).forEach(([group, realUsage]) => {
            const realInput = getInput('real', group, 'group');
            const erpInput = getInput('erp', group, 'group');
            const deltaInput = getInput('delta', group, 'group');
            const diffInput = getInput('diff', group, 'group');
            const erpValue = utils.parseNum(erpInput?.value);
            const baseValue = utils.parseNum(diffInput?.dataset.base);
            const deltaValue = erpValue - realUsage;
            const diffValue = baseValue + deltaValue;

            if (realInput) realInput.value = realUsage ? utils.formatNum(realUsage) : '';
            if (deltaInput) {
                deltaInput.value = deltaValue ? utils.formatSignedNum(deltaValue) : '';
                deltaInput.classList.toggle('delta-positive', deltaValue > 0);
                deltaInput.classList.toggle('delta-negative', deltaValue < 0);
            }
            if (diffInput) diffInput.value = erpValue || realUsage || baseValue ? utils.formatNum(diffValue) : '';
        });
    }

    // --- DB 연동 로직 시작 --- //

    // 화면의 입력값 초기화
    function clearAllInputs() {
        elements.wrapper.querySelectorAll('.f1ft-input').forEach(input => {
            input.value = '';
            if(input.dataset.base) input.dataset.base = "0"; 
        });
    }

    // 빈 값은 제외하고 데이터 수집
    function collectInputData(field, isGroup = false) {
        const data = {};
        elements.wrapper.querySelectorAll(`.f1ft-input[data-field="${field}"]`).forEach(input => {
            const val = input.value.trim();
            if (val !== '') {
                const key = isGroup ? input.dataset.group : input.dataset.col;
                if (key) {
                   data[key] = input.classList.contains('numeric-input') ? utils.parseNum(val) : val;
                }
            }
        });
        return data;
    }

    // 데이터 불러오기 (오늘과 어제 기록 연동)
    async function loadFactoryData(dateStr) {
        clearAllInputs();
        elements.editBtn.disabled = true; // 로딩 중 버튼 비활성화

        const yesterdayStr = utils.addDays(dateStr, -1);

        // 어제 데이터와 선택한 날짜 데이터를 동시에 가져옵니다.
        const [yesterdayRes, todayRes] = await Promise.all([
            supabase.from('factory1_ft_real').select('end_values, contrast_qty').eq('log_date', yesterdayStr).single(),
            supabase.from('factory1_ft_real').select('*').eq('log_date', dateStr).single()
        ]);

        const yesterdayData = yesterdayRes.data || {};
        const todayData = todayRes.data || {};

        // 1. [실재고 - ERP] 전일 기록을 Base로 설정
        const prevContrast = yesterdayData.contrast_qty || { A: 0, C: 0, D: 0 };
        if (getInput('diff', 'A', 'group')) getInput('diff', 'A', 'group').dataset.base = prevContrast.A || 0;
        if (getInput('diff', 'C', 'group')) getInput('diff', 'C', 'group').dataset.base = prevContrast.C || 0;
        if (getInput('diff', 'D', 'group')) getInput('diff', 'D', 'group').dataset.base = prevContrast.D || 0;

        // 2. 사용 전 잔량 (오늘 저장된게 있으면 오늘것, 없으면 어제 사용 후 잔량 불러오기)
        const startValues = todayData.start_values || yesterdayData.end_values || {};
        Object.entries(startValues).forEach(([col, val]) => {
            const input = getInput('start', col, 'col');
            if (input) input.value = utils.formatNum(val);
        });

        // 3. 오늘 저장된 사용 후 잔량, ERP 입력량 세팅
        const endValues = todayData.end_values || {};
        Object.entries(endValues).forEach(([col, val]) => {
            const input = getInput('end', col, 'col');
            if (input) input.value = utils.formatNum(val);
        });

        const erpUsage = todayData.erp_usage || {};
        Object.entries(erpUsage).forEach(([group, val]) => {
            const input = getInput('erp', group, 'group');
            if (input) input.value = utils.formatNum(val);
        });

        // 4. 비고 세팅
        const memoInput = elements.wrapper.querySelector('.f1ft-input[data-field="memo"]');
        if (memoInput && todayData.memo) {
            memoInput.value = todayData.memo;
        }

        calculateFields(); // 로드된 데이터로 전체 재계산
        elements.editBtn.disabled = false;
    }

    // 데이터 DB에 저장하기
    async function saveFactoryData() {
        elements.saveBtn.disabled = true;
        elements.saveBtn.textContent = '저장 중...';

        // 비고 입력칸 찾기
        const memoInput = elements.wrapper.querySelector('.f1ft-input[data-field="memo"]');

        // 입력된 내용만 모아서 JSON으로 만들기
        const payload = {
            log_date: state.currentDate,
            start_values: collectInputData('start', false),
            end_values: collectInputData('end', false),
            erp_usage: collectInputData('erp', true),
            memo: memoInput ? memoInput.value.trim() : '',
            contrast_qty: {
                A: utils.parseNum(getInput('diff', 'A', 'group')?.value) || 0,
                C: utils.parseNum(getInput('diff', 'C', 'group')?.value) || 0,
                D: utils.parseNum(getInput('diff', 'D', 'group')?.value) || 0
            }
        };

        const { error } = await supabase
            .from('factory1_ft_real')
            .upsert(payload, { onConflict: 'log_date' });

        elements.saveBtn.disabled = false;
        elements.saveBtn.textContent = '저장';

        if (error) {
            alert('저장에 실패했습니다: ' + error.message);
            return;
        }

        alert('성공적으로 저장되었습니다.');

        // [전략 A] 과거 데이터 수정 시 경고 알림 발생
        if (state.currentDate < utils.getTodayStr()) {
            alert('[주의] 과거 데이터를 수정하셨습니다.\n수정하신 내역이 이후 날짜의 "시작 잔량" 및 "실재고" 계산에 연쇄적으로 영향을 미칩니다.\n\n반드시 오늘 날짜까지 차례대로 확인하시고 재저장해 주세요.');
        }

        toggleEditMode(); // 수정 모드 종료
    }
    // --- DB 연동 로직 끝 --- //

    function toggleEditMode() {
        state.isEditMode = !state.isEditMode;
        setReadOnlyMode(!state.isEditMode);
        elements.editBtn.textContent = state.isEditMode ? '보기' : '수정';
        elements.saveBtn.disabled = !state.isEditMode;
    }

    function initCalendar() {
        state.fp = flatpickr('#f1ftFlatpickr', {
            locale: 'ko',
            dateFormat: 'Y-m-d',
            defaultDate: state.currentDate,
            clickOpens: false,
            allowInput: false,
            positionElement: elements.dateText,
            position: 'auto center',
            onReady(_, __, instance) {
                instance.calendarContainer.style.marginTop = '10px';
            },
            onChange(_, dateStr) {
                if (!dateStr) return;
                setDate(dateStr);
            }
        });
    }

    function bindDateEvents() {
        elements.dateText.addEventListener('click', (event) => {
            event.stopPropagation();
            if (!state.fp) return;

            if (state.fp.isOpen) {
                state.fp.close();
            } else {
                state.fp.open();
            }
        });

        elements.prevBtn.addEventListener('click', () => {
            setDate(utils.addDays(state.currentDate, -1));
        });

        elements.nextBtn.addEventListener('click', () => {
            setDate(utils.addDays(state.currentDate, 1));
        });

        elements.todayBtn.addEventListener('click', () => {
            const today = utils.getTodayStr();
            if (state.currentDate !== today) {
                setDate(today);
            }
        });
    }

    function bindInputEvents() {
        elements.wrapper.querySelectorAll('.numeric-input').forEach((input) => {
            input.addEventListener('focus', function () {
                if (this.readOnly) return;
                this.value = this.value.replace(/,/g, '');
                this.select();
            });

            input.addEventListener('input', calculateFields);

            input.addEventListener('blur', function () {
                const value = utils.parseNum(this.value);
                this.value = value ? utils.formatNum(value) : '';
                calculateFields();
            });
        });
    }

    function bindButtonEvents() {
        elements.editBtn.addEventListener('click', toggleEditMode);

        elements.saveBtn.addEventListener('click', () => {
            if (!state.isEditMode) return;
            // 로컬 로직 대신 DB 저장 함수 호출
            saveFactoryData();
        });

        elements.excelBtn.addEventListener('click', () => {
            alert('엑셀 출력 기능은 하단 레이아웃과 DB 연결을 정리한 뒤 활성화할 예정입니다.');
        });
    }

    document.addEventListener('DOMContentLoaded', () => {
        document.title = '1공장 FT 일지';

        elements.wrapper = document.querySelector('.f1ft-wrapper');
        elements.dateText = document.getElementById('f1ftDateText');
        elements.prevBtn = document.getElementById('f1ftPrevBtn');
        elements.nextBtn = document.getElementById('f1ftNextBtn');
        elements.todayBtn = document.getElementById('f1ftTodayBtn');
        elements.editBtn = document.getElementById('f1ftEditBtn');
        elements.saveBtn = document.getElementById('f1ftSaveBtn');
        elements.excelBtn = document.getElementById('f1ftExcelBtn');

        // 초기 시작 날짜 설정 (오늘 날짜)
        const today = utils.getTodayStr();
        state.currentDate = today; 

        elements.editBtn.disabled = true; // DB 로딩 전까지는 수정 버튼 잠금
        
        initCalendar();
        bindDateEvents();
        bindInputEvents();
        bindButtonEvents();
        setReadOnlyMode(true);
        
        // 날짜 세팅 및 최초 DB 로딩 실행
        setDate(state.currentDate); 
    });
})();