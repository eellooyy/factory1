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
        isChanged: false // 변경사항 추적
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
        formatSignedNum(value) {
            if (!value) return '';
            const formatted = utils.formatNum(Math.abs(value));
            return value > 0 ? `+${formatted}` : `-${formatted}`;
        }
    };

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

    function setDate(dateStr) {
        state.currentDate = dateStr;
        syncDateLabel();

        if (state.fp && state.fp.selectedDates[0]) {
            const selected = state.fp.formatDate(state.fp.selectedDates[0], 'Y-m-d');
            if (selected !== dateStr) {
                state.fp.setDate(dateStr, false);
            }
        }
        
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
            
            const erpValue = utils.parseNum(erpInput?.value);
            const baseValue = utils.parseNum(diffInput?.dataset.base); 
            const savedValue = diffInput?.dataset.saved; 

            const hasTodayInput = validCounts[group] > 0 || (erpInput && erpInput.value.trim() !== '');

            let diffValue = 0;
            let shouldShowDiff = false;

            if (hasTodayInput) {
                const deltaValue = erpValue - realUsage;
                diffValue = baseValue + deltaValue; 
                shouldShowDiff = true;

                if (realInput) realInput.value = utils.formatNum(realUsage);
                if (deltaInput) {
                    deltaInput.value = deltaValue === 0 ? '0' : utils.formatSignedNum(deltaValue);
                    deltaInput.classList.toggle('delta-positive', deltaValue > 0);
                    deltaInput.classList.toggle('delta-negative', deltaValue < 0);
                }
            } 
            else {
                if (realInput) realInput.value = '';
                if (deltaInput) {
                    deltaInput.value = '';
                    deltaInput.classList.remove('delta-positive', 'delta-negative');
                }

                if (savedValue !== '') {
                    diffValue = utils.parseNum(savedValue);
                    shouldShowDiff = true;
                } else if (baseValue !== 0) {
                    diffValue = baseValue;
                    shouldShowDiff = true;
                }
            }

            // diffInput 값 및 디자인 업데이트 추가
            if (diffInput) {
                if (shouldShowDiff) {
                    diffInput.value = diffValue === 0 ? '0' : utils.formatSignedNum(diffValue);
                    diffInput.classList.toggle('delta-positive', diffValue > 0);
                    diffInput.classList.toggle('delta-negative', diffValue < 0);
                } else {
                    diffInput.value = '';
                    diffInput.classList.remove('delta-positive', 'delta-negative');
                }
            }
        });
    }

    // --- DB 연동 로직 시작 --- //

    function clearAllInputs() {
        elements.wrapper.querySelectorAll('.f1ft-input').forEach(input => {
            input.value = '';
            if(input.dataset.base) input.dataset.base = "0"; 
            if(input.dataset.saved) input.dataset.saved = ""; 
        });
        state.isChanged = false;
    }

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

        const prevContrast = yesterdayData.contrast_qty || {};
        const todayContrast = todayData.contrast_qty || {};

        ['A', 'C', 'D'].forEach(group => {
            const input = getInput('diff', group, 'group');
            if (input) {
                input.dataset.base = prevContrast[group] || 0; 
                input.dataset.saved = todayContrast[group] !== undefined ? todayContrast[group] : ''; 
            }
        });

        // [수정] 전날의 end_values에서 0인 항목은 이월하지 않도록 필터링
        let startValues = todayData.start_values;
        if (!startValues && yesterdayData.end_values) {
            startValues = {};
            Object.entries(yesterdayData.end_values).forEach(([col, val]) => {
                const numVal = utils.parseNum(val);
                if (numVal > 0) { // 0 초과인 경우만 이월
                    startValues[col] = numVal;
                }
            });
        }
        startValues = startValues || {};

        Object.entries(startValues).forEach(([col, val]) => {
            const input = getInput('start', col, 'col');
            if (input) input.value = utils.formatNum(val);
        });

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

        const memoInput = elements.wrapper.querySelector('.f1ft-input[data-field="memo"]');
        if (memoInput && todayData.memo) {
            memoInput.value = todayData.memo;
        }

        calculateFields(); 
        elements.editBtn.disabled = false;
        state.isChanged = false; 
    }

    async function saveFactoryData() {
        const columns = ['A1', 'A2', 'A3', 'A4', 'C1', 'C2', 'D1', 'D2'];
        let autoFilledCols = [];

        // 1. 화면 내 빈칸 자동 채우기 및 계산 반영
        columns.forEach((col) => {
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
            calculateFields();
            alert(`[자동 입력 안내]\n사용 후 잔량이 입력되지 않은 롤(${autoFilledCols.join(', ')})이 발견되었습니다.\n해당 항목들은 사용하지 않은 것으로 간주하여 '사용 전 잔량' 값이 자동으로 적용되었습니다.`);
        }

        elements.saveBtn.disabled = true;
        elements.saveBtn.textContent = '저장 중...';

        // 2. 화면 데이터 수집
        const startData = collectInputData('start', false);
        const endData = collectInputData('end', false);

        // 3. [핵심 로직] 사용 전/후 잔량을 짝지어 '사용 전 잔량' 기준 내림차순 자동 정렬
        const sortedStartData = {};
        const sortedEndData = {};
        const groupKeys = { 'A': ['A1', 'A2', 'A3', 'A4'], 'C': ['C1', 'C2'], 'D': ['D1', 'D2'] };

        Object.keys(groupKeys).forEach(group => {
            const keys = groupKeys[group];
            
            // 유효한 데이터 쌍(pair)만 추출
            let pairs = keys.map(k => ({
                start: startData[k] || 0,
                end: endData[k] || 0
            })).filter(p => p.start > 0 || p.end > 0);
            
            // 사용 전 잔량(start) 기준 내림차순(큰 숫자가 먼저 오도록) 정렬
            pairs.sort((a, b) => b.start - a.start);
            
            // 정렬된 결과를 좌측 열부터 차례대로 재배치
            keys.forEach((k, index) => {
                if (pairs[index]) {
                    if (pairs[index].start > 0) sortedStartData[k] = pairs[index].start;
                    if (pairs[index].end > 0 || pairs[index].end === 0) sortedEndData[k] = pairs[index].end;
                }
            });
        });

        const memoInput = elements.wrapper.querySelector('.f1ft-input[data-field="memo"]');

        // 4. 정렬된 데이터로 DB Payload 구성
        const payload = {
            log_date: state.currentDate,
            start_values: sortedStartData, // 정렬된 데이터
            end_values: sortedEndData,     // 짝맞춰 정렬된 데이터
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
        state.isChanged = false; 

        // [수정] 4일 이전 기준 과거 데이터 수정 경고창
        const fourDaysAgo = utils.addDays(utils.getTodayStr(), -4);
        if (state.currentDate < fourDaysAgo) {
            alert('[주의] 4일 이상 경과된 과거 데이터를 수정하셨습니다.\n수정하신 내역이 이후 날짜의 이월 및 누적 계산에 연쇄적으로 영향을 미칩니다.\n\n반드시 오늘 날짜까지 차례대로 확인하시고 재저장해 주세요.');
        }

        toggleEditMode(); 
        
        // 정렬된 결과를 화면(UI)에 즉시 렌더링하기 위해 데이터 리로드
        await loadFactoryData(state.currentDate);
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
                if (state.isChanged) {
                    if (!confirm('저장되지 않은 변경사항이 있습니다.\n저장하지 않고 선택한 날짜로 이동하시겠습니까?')) {
                        state.fp.setDate(state.currentDate, false); 
                        return;
                    }
                }
                setDate(dateStr);
            },
            onClose() {
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
            if (!confirmLeave()) return; 
            setDate(utils.addDays(state.currentDate, -1));
        });

        elements.nextBtn.addEventListener('click', () => {
            if (!confirmLeave()) return; 
            setDate(utils.addDays(state.currentDate, 1));
        });

        elements.todayBtn.addEventListener('click', () => {
            const today = utils.getTodayStr();
            if (state.currentDate !== today) {
                if (!confirmLeave()) return; 
                setDate(today);
            }
        });
    }

    function bindInputEvents() {
        // [수정] 드래그 복사/붙여넣기 방지 (실수 방지)
        elements.wrapper.addEventListener('dragstart', (e) => {
            if (e.target.classList.contains('f1ft-input')) e.preventDefault();
        });
        elements.wrapper.addEventListener('drop', (e) => {
            if (e.target.classList.contains('f1ft-input')) e.preventDefault();
        });

        elements.wrapper.addEventListener('input', (e) => {
            if (e.target.classList.contains('f1ft-input')) {
                state.isChanged = true;
            }
        });

        // [수정] 엑셀식 방향키 및 엔터 이동 (상하좌우 완벽 대응)
        elements.wrapper.addEventListener('keydown', (e) => {
            if (e.target.classList.contains('f1ft-input') && !e.target.readOnly) {
                const key = e.key;
                if (['Enter', 'ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight'].includes(key)) {
                    
                    // 입력 중 텍스트 수정(커서 이동)을 위한 예외 처리
                    if (key === 'ArrowLeft' && e.target.selectionStart > 0) return;
                    if (key === 'ArrowRight' && e.target.selectionEnd < e.target.value.length) return;

                    e.preventDefault();
                    
                    const td = e.target.closest('td');
                    if (!td) return;
                    const tr = td.closest('tr');
                    const tds = Array.from(tr.querySelectorAll('td'));
                    const colIndex = tds.indexOf(td);
                    
                    let nextInput = null;
                    
                    if (key === 'ArrowLeft') {
                        let prevTd = td.previousElementSibling;
                        while (prevTd && !prevTd.querySelector('.f1ft-input:not([readonly])')) {
                            prevTd = prevTd.previousElementSibling;
                        }
                        if (prevTd) nextInput = prevTd.querySelector('.f1ft-input:not([readonly])');
                    } 
                    else if (key === 'ArrowRight') {
                        let nextTd = td.nextElementSibling;
                        while (nextTd && !nextTd.querySelector('.f1ft-input:not([readonly])')) {
                            nextTd = nextTd.nextElementSibling;
                        }
                        if (nextTd) nextInput = nextTd.querySelector('.f1ft-input:not([readonly])');
                    } 
                    else if (key === 'ArrowUp') {
                        let prevTr = tr.previousElementSibling;
                        while (prevTr) {
                            const targetTd = Array.from(prevTr.querySelectorAll('td'))[colIndex];
                            if (targetTd && targetTd.querySelector('.f1ft-input:not([readonly])')) {
                                nextInput = targetTd.querySelector('.f1ft-input:not([readonly])');
                                break;
                            }
                            prevTr = prevTr.previousElementSibling;
                        }
                    } 
                    else if (key === 'ArrowDown' || key === 'Enter') {
                        let nextTr = tr.nextElementSibling;
                        while (nextTr) {
                            const targetTd = Array.from(nextTr.querySelectorAll('td'))[colIndex];
                            if (targetTd && targetTd.querySelector('.f1ft-input:not([readonly])')) {
                                nextInput = targetTd.querySelector('.f1ft-input:not([readonly])');
                                break;
                            }
                            nextTr = nextTr.nextElementSibling;
                        }
                    }
                    
                    if (nextInput) {
                        nextInput.focus();
                        // 셀 이동 시 내용 전체를 블록 지정해 엑셀처럼 바로 덮어쓸 수 있게 함
                        if (nextInput.type === 'text' || nextInput.type === 'number') {
                            nextInput.select();
                        }
                    }
                }
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
                if (this.value.trim() === '') {
                    this.value = '';
                } else {
                    const value = utils.parseNum(this.value);
                    this.value = utils.formatNum(value);
                }
                calculateFields();
            });
        });
    }

    function bindButtonEvents() {
        elements.editBtn.addEventListener('click', () => {
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