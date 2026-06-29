(function () {
    'use strict';

    // Supabase 설정 (본인 프로젝트 정보)
    const supabaseUrl = 'https://npiflqoscsvnnauvqhrr.supabase.co';
    const supabaseKey = 'sb_publishable_ir-mHSsX6SSIQwHerkLbfA_2qCOP3KW'; 
    const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

    const state = {
        currentDate: null,
        fp: null,
        isEditMode: false,
        isChanged: false // [신규] 변경사항 추적을 위한 상태 변수
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

    // [신규] 변경사항이 있을 때 다른 액션(날짜 이동 등)을 막는 공통 함수
    function confirmLeave() {
        if (state.isChanged) {
            return confirm('저장하지 않은 변경사항이 있습니다.\n저장하지 않고 이동하시겠습니까?');
        }
        return true;
    }

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
        const validCounts = { A: 0, C: 0, D: 0 }; 
        const columns = ['A1', 'A2', 'A3', 'A4', 'C1', 'C2', 'D1', 'D2'];

        columns.forEach((col) => {
            const startInput = getInput('start', col);
            const endInput = getInput('end', col);
            const usageInput = getInput('usage', col);
            const start = utils.parseNum(startInput?.value);
            const end = utils.parseNum(endInput?.value);
            const group = startInput?.dataset.group;

            // 실무적 로직: 사용 후 잔량(end)에 값이 입력된 경우에만 사용량 실 계산 실행
            if (endInput && endInput.value.trim() !== '') {
                const usage = start - end;
                if (usageInput) {
                    usageInput.value = utils.formatNum(usage);
                }

                if (group && Object.prototype.hasOwnProperty.call(groups, group)) {
                    groups[group] += usage;
                    validCounts[group]++; 
                }
            } else {
                if (usageInput) {
                    usageInput.value = ''; 
                }
            }
        });

        Object.entries(groups).forEach(([group, realUsage]) => {
            const realInput = getInput('real', group, 'group');
            const erpInput = getInput('erp', group, 'group');
            const deltaInput = getInput('delta', group, 'group');
            const diffInput = getInput('diff', group, 'group');
            
            if (validCounts[group] > 0 || (erpInput && erpInput.value.trim() !== '')) {
                const erpValue = utils.parseNum(erpInput?.value);
                const baseValue = utils.parseNum(diffInput?.dataset.base);
                const deltaValue = erpValue - realUsage;
                const diffValue = baseValue + deltaValue;

                if (realInput) realInput.value = utils.formatNum(realUsage);
                if (deltaInput) {
                    deltaInput.value = deltaValue === 0 ? '0' : utils.formatSignedNum(deltaValue);
                    deltaInput.classList.toggle('delta-positive', deltaValue > 0);
                    deltaInput.classList.toggle('delta-negative', deltaValue < 0);
                }
                if (diffInput) diffInput.value = utils.formatNum(diffValue);
            } else {
                if (realInput) realInput.value = '';
                if (deltaInput) {
                    deltaInput.value = '';
                    deltaInput.classList.remove('delta-positive', 'delta-negative');
                }
                if (diffInput) diffInput.value = '';
            }
        });
    }

    // --- DB 연동 로직 시작 --- //

    // 화면의 입력값 초기화
    function clearAllInputs() {
        elements.wrapper.querySelectorAll('.f1ft-input').forEach(input => {
            input.value = '';
            if(input.dataset.base) input.dataset.base = "0"; 
        });
        state.isChanged = false; // 새로운 날짜를 로드했으므로 변경사항 상태 리셋
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
        elements.editBtn.disabled = true; 

        const yesterdayStr = utils.addDays(dateStr, -1);

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

        // 2. 사용 전 잔량 불러오기
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

        calculateFields(); 
        elements.editBtn.disabled = false;
        state.isChanged = false; // 최초 데이터 로드 시점에는 변경 이력이 없는 것으로 설정
    }

    // 데이터 DB에 저장하기
    async function saveFactoryData() {
        // [신규] 3번 요구사항: 사용 전 잔량은 있는데 사용 후 잔량이 없는 셀을 검사하여 자동 처리
        const columns = ['A1', 'A2', 'A3', 'A4', 'C1', 'C2', 'D1', 'D2'];
        let autoFilledCols = [];

        columns.forEach((col) => {
            const startInput = getInput('start', col);
            const endInput = getInput('end', col);

            if (startInput && endInput) {
                const startVal = startInput.value.trim();
                const endVal = endInput.value.trim();

                // 사용 전 잔량은 기입되어 있으나 사용 후 잔량이 완전히 비어있다면 자동 이월
                if (startVal !== '' && endVal === '') {
                    endInput.value = startVal;
                    autoFilledCols.push(col);
                }
            }
        });

        // 자동 입력된 내역이 있을 경우, 전체 필드를 다시 계산하고 작업자에게 경고창으로 알림
        if (autoFilledCols.length > 0) {
            calculateFields();
            alert(`[자동 입력 안내]\n사용 후 잔량이 입력되지 않은 롤(${autoFilledCols.join(', ')})이 발견되었습니다.\n해당 항목들은 사용하지 않은 것으로 간주하여 '사용 전 잔량' 값이 자동으로 적용되었습니다.`);
        }

        elements.saveBtn.disabled = true;
        elements.saveBtn.textContent = '저장 중...';

        const memoInput = elements.wrapper.querySelector('.f1ft-input[data-field="memo"]');

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
        state.isChanged = false; // 저장 성공 시 변경 상태 리셋

        // [전략 A] 과거 데이터 수정 시 연쇄 영향 경고 알림
        if (state.currentDate < utils.getTodayStr()) {
            alert('[주의] 과거 데이터를 수정하셨습니다.\n수정하신 내역이 이후 날짜의 "시작 잔량" 및 "실재고" 계산에 연쇄적으로 영향을 미칩니다.\n\n반드시 오늘 날짜까지 차례대로 확인하시고 재저장해 주세요.');
        }

        toggleEditMode(); 
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
                // [신규] 달력에서 날짜를 바꿀 때 데이터 미저장 시 차단하는 로직
                if (state.isChanged) {
                    if (!confirm('저장되지 않은 변경사항이 있습니다.\n저장하지 않고 선택한 날짜로 이동하시겠습니까?')) {
                        state.fp.setDate(state.currentDate, false); // 원래 취소하면 원래 날짜로 복구
                        return;
                    }
                }
                setDate(dateStr);
            },
            onClose() {
                // [신규] 2번 요구사항: 캘린더가 닫힐 때 '방금 닫힘' 상태 클래스를 일시 부여해서 다시 눌렀을 때 중복 실행 차단
                if (elements.dateText) {
                    elements.dateText.classList.add('just-closed');
                    setTimeout(() => {
                        elements.dateText.classList.remove('just-closed');
                    }, 200);
                }
            }
        });
    }

    function bindDateEvents() {
        elements.dateText.addEventListener('click', (event) => {
            event.stopPropagation();
            if (!state.fp) return;

            // [신규] 방금 막 닫힌 시점의 버블링 클릭이라면 무시하여 다시 열리는 현상 제거
            if (elements.dateText.classList.contains('just-closed')) {
                return;
            }

            if (state.fp.isOpen) {
                state.fp.close();
            } else {
                state.fp.open();
            }
        });

        elements.prevBtn.addEventListener('click', () => {
            if (!confirmLeave()) return; // [신규] 이전 날짜 클릭 시 차단
            setDate(utils.addDays(state.currentDate, -1));
        });

        elements.nextBtn.addEventListener('click', () => {
            if (!confirmLeave()) return; // [신규] 다음 날짜 클릭 시 차단
            setDate(utils.addDays(state.currentDate, 1));
        });

        elements.todayBtn.addEventListener('click', () => {
            const today = utils.getTodayStr();
            if (state.currentDate !== today) {
                if (!confirmLeave()) return; // [신규] 오늘 버튼 클릭 시 차단
                setDate(today);
            }
        });
    }

    function bindInputEvents() {
        // [신규] 일지 내부 엘리먼트에서 값을 입력(타이핑)하기 시작하면 즉시 변경 상태 감지 활성화
        elements.wrapper.addEventListener('input', (e) => {
            if (e.target.classList.contains('f1ft-input')) {
                state.isChanged = true;
            }
        });

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
        elements.editBtn.addEventListener('click', () => {
            // 수정모드 활성화되어 있는 상태에서 '보기(수정취소)' 누를 때 데이터 유실 경고
            if (state.isEditMode && !confirmLeave()) return;
            toggleEditMode();
        });

        elements.saveBtn.addEventListener('click', () => {
            if (!state.isEditMode) return;
            saveFactoryData();
        });

        elements.excelBtn.addEventListener('click', () => {
            alert('엑셀 출력 기능은 하단 레이아웃과 DB 연결을 정리한 뒤 활성화할 예정입니다.');
        });
        
        // [신규] 브라우저 종료 탭 닫기, 새로고침 시 이탈 방지 표준 경고 활성화
        window.addEventListener('beforeunload', (e) => {
            if (state.isChanged) {
                e.preventDefault();
                e.returnValue = '';
            }
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

        elements.editBtn.disabled = true; 
        
        initCalendar();
        bindDateEvents();
        bindInputEvents();
        bindButtonEvents();
        setReadOnlyMode(true);
        
        setDate(state.currentDate); 
    });
})();