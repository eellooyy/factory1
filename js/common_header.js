/* common_header.js — 1공장 · 3공장 공통 헤더 컨트롤러
   ────────────────────────────────────────────────────────────────
   기존 factory3_header.js 를 그대로 승격한 파일입니다. (기능/동작 변경 없음)

   변경된 점은 딱 하나입니다:
   - 기존 elementId()는 idPrefix === 'f3i' 인 경우만 특별 취급하고
     그 외에는 무조건 'gf3' + prefix 로 조립하는 하드코딩 분기였습니다.
     → 이제는 각 페이지가 넘겨주는 idPrefix를 그대로 사용합니다.
        (예: 'f3i', 'gf3Io', 'f1Ft', 'f1FtIo', 'f1Ilji' 등 — 조합 자유)
     이렇게 하면 1공장/3공장 어떤 페이지든 이 파일 하나만 공유하면 됩니다.

   마스터 비밀번호(0000/edit0000/mk1324) 인증, 날짜 네비게이션(flatpickr),
   수정/저장/엑셀·PDF 버튼 제어는 기존과 완전히 동일합니다.
   ──────────────────────────────────────────────────────────────── */
window.CommonHeader = (function() {
    'use strict';

    const utils = window.Factory3Utils || window.CommonUtils;

    function elementId(prefix, name) {
        return `${prefix}${name}`;
    }

    function defaultExportExcel(elements) {
        const btnInner = elements.excelBtn.innerHTML;
        elements.excelBtn.innerHTML = '<span class="material-symbols-outlined" style="font-size: 16px; margin-right: 4px;">hourglass_empty</span>처리중...';
        elements.excelBtn.disabled = true;

        setTimeout(() => {
            elements.excelBtn.innerHTML = btnInner;
            elements.excelBtn.disabled = false;
            alert('엑셀 저장 기능은 준비 중입니다.');
        }, 400);
    }

    // 마스터 비밀번호 로직 (0000=master, edit0000=admin, mk1324=readonly)
    // sessionStorage 키(gf3_role)는 두 공장이 동일하게 사용합니다.
    function authenticate() {
        const savedRole = sessionStorage.getItem('gf3_role');

        if (savedRole === 'master') return 'master';
        if (savedRole === 'admin') return 'admin';
        if (savedRole === 'readonly') return 'readonly';

        const pwInput = prompt('접속 비밀번호를 입력하세요:');

        if (pwInput === '0000') {
            sessionStorage.setItem('gf3_role', 'master');
            return 'master';
        }
        if (pwInput === 'edit0000') {
            sessionStorage.setItem('gf3_role', 'admin');
            return 'admin';
        }
        if (pwInput === 'mk1324') {
            sessionStorage.setItem('gf3_role', 'readonly');
            return 'readonly';
        }

        alert('비밀번호가 올바르지 않습니다.');
        location.href = 'about:blank';
        return null;
    }

    function init(config) {
        const prefix = config.idPrefix || '';
        const wrapperSelector = config.wrapperSelector || '.gf3-wrapper';
        const inputSelector = config.inputSelector || '.gf3-td.editable .gf3-input';
        const onDateChange = config.onDateChange || null;
        const onSave = config.onSave || (() => alert('저장 기능은 준비 중입니다.'));
        const onExportExcel = config.onExportExcel || (() => defaultExportExcel(elements));
        // (1공장 페이지 전용 추가 옵션) 각 페이지 모듈이 readOnly 토글을 직접
        // 소유하고 있는 경우(예: factory1_*_render.js의 setReadOnlyMode) 이
        // 콜백으로 위임할 수 있습니다. 3공장처럼 inputSelector 하나로 충분한
        // 페이지는 그냥 생략하면 됩니다. (기존 3공장 동작에는 영향 없음)
        const onEditModeChange = config.onEditModeChange || null;

        const state = {
            currentDate: null,
            isEditMode: false,
            fp: null,
            isAdmin: false,
            role: null
        };

        const elements = {
            wrapper: null,
            dateText: null,
            prevBtn: null,
            nextBtn: null,
            todayBtn: null,
            editBtn: null,
            saveBtn: null,
            excelBtn: null
        };

        function confirmLeaveEditMode() {
            if (state.isEditMode) {
                return confirm('저장되지 않은 변경사항이 있습니다. 나가시겠습니까?');
            }
            return true;
        }

        function updateNextBtnState() {
            if (elements.nextBtn) {
                const today = utils.getTodayStr();
                if (state.currentDate >= today) {
                    elements.nextBtn.disabled = true;
                    elements.nextBtn.style.opacity = '0.3';
                    elements.nextBtn.style.pointerEvents = 'none';
                } else {
                    elements.nextBtn.disabled = false;
                    elements.nextBtn.style.opacity = '1';
                    elements.nextBtn.style.pointerEvents = 'auto';
                }
            }
        }

        function setCurrentDate(dateStr, triggerChange) {
            state.currentDate = dateStr;
            elements.dateText.innerText = utils.formatKoDate(dateStr);

            // ★ 모바일 방어 코드: fp 객체와 setDate 메서드가 유효한 경우에만 호출
            if (state.fp && typeof state.fp.setDate === 'function') {
                state.fp.setDate(dateStr, false);
            }

            updateNextBtnState();
            if (triggerChange !== false && onDateChange) {
                onDateChange(dateStr);
            }
        }

        // 수정 모드 토글 시 마스터 모드 연동 클래스 부여
        function toggleEditMode() {
            if (!state.isAdmin) return;
            state.isEditMode = !state.isEditMode;

            if (state.isEditMode) {
                elements.wrapper.classList.add('edit-mode');

                // 마스터 권한일 경우 공지사항 편집 모드 활성화
                if (state.role === 'master') {
                    elements.wrapper.classList.add('master-mode-active');
                    const infoLabel = document.getElementById('f1MasterNoticeInfo') || document.getElementById('f3iMasterNoticeInfo');
                    if (infoLabel) infoLabel.style.display = 'block';
                }

                elements.editBtn.textContent = '보기';
                elements.saveBtn.disabled = false;
                elements.wrapper.querySelectorAll(inputSelector).forEach(input => {
                    input.readOnly = false;
                });
                if (onEditModeChange) onEditModeChange(true);
            } else {
                elements.wrapper.classList.remove('edit-mode');
                elements.wrapper.classList.remove('master-mode-active');

                const infoLabel = document.getElementById('f1MasterNoticeInfo') || document.getElementById('f3iMasterNoticeInfo');
                if (infoLabel) infoLabel.style.display = 'none';

                elements.editBtn.textContent = '수정';
                elements.saveBtn.disabled = true;
                elements.wrapper.querySelectorAll(inputSelector).forEach(input => {
                    input.readOnly = true;
                });
                if (onEditModeChange) onEditModeChange(false);
            }

            // 모드 전환에 맞춰 공지사항 목록 실시간 갱신 (추가/삭제 버튼 활성/비활성화 연동)
            if (window.NoticeManager) {
                window.NoticeManager.renderList();
            }
        }

        const accessRole = authenticate();
        if (accessRole === null) return null;

        state.role = accessRole;
        // master나 admin일 경우 편집 권한을 true로 설정
        state.isAdmin = (accessRole === 'master' || accessRole === 'admin');

        window.addEventListener('beforeunload', function(e) {
            if (state.isEditMode) {
                e.preventDefault();
                e.returnValue = '';
            }
        });

        elements.wrapper = document.querySelector(wrapperSelector);
        if (!elements.wrapper) return null;

        elements.dateText = document.getElementById(elementId(prefix, 'DateText'));
        elements.prevBtn = document.getElementById(elementId(prefix, 'PrevBtn'));
        elements.nextBtn = document.getElementById(elementId(prefix, 'NextBtn'));
        elements.todayBtn = document.getElementById(elementId(prefix, 'TodayBtn'));
        elements.editBtn = document.getElementById(elementId(prefix, 'EditBtn'));
        elements.saveBtn = document.getElementById(elementId(prefix, 'SaveBtn'));
        elements.excelBtn = document.getElementById(elementId(prefix, 'ExcelBtn'));

        if (state.isAdmin) {
            elements.editBtn.disabled = false;
        }

        const today = utils.getTodayStr();
        state.currentDate = utils.addDays(today, -1);
        elements.dateText.innerText = utils.formatKoDate(state.currentDate);

        let justClosed = false;

        state.fp = flatpickr(`#${elementId(prefix, 'Flatpickr')}`, {
            locale: 'ko',
            dateFormat: 'Y-m-d',
            disableMobile: "true", // ★ 모바일에서도 PC와 동일하게 JS Flatpickr 객체를 고정
            defaultDate: state.currentDate,
            positionElement: elements.dateText,
            position: 'auto center',
            clickOpens: false,
            maxDate: utils.getTodayStr(),
            onReady: function(selectedDates, dateStr, instance) {
                instance.calendarContainer.style.marginTop = '10px';
            },
            onChange: (dates, str) => {
                if (!confirmLeaveEditMode()) {
                    if (state.fp && typeof state.fp.setDate === 'function') {
                        state.fp.setDate(state.currentDate, false);
                    }
                    return;
                }
                setCurrentDate(str);
            },
            onClose: () => {
                justClosed = true;
                setTimeout(() => { justClosed = false; }, 200);
            }
        });

        updateNextBtnState();

        elements.dateText.addEventListener('click', (e) => {
            e.stopPropagation();
            if (justClosed) return;
            if (state.fp) state.fp.toggle();
        });

        elements.prevBtn.addEventListener('click', () => {
            if (!confirmLeaveEditMode()) return;
            setCurrentDate(utils.addDays(state.currentDate, -1));
        });

        elements.nextBtn.addEventListener('click', () => {
            if (!confirmLeaveEditMode()) return;
            setCurrentDate(utils.addDays(state.currentDate, 1));
        });

        elements.todayBtn.addEventListener('click', () => {
            const todayStr = utils.getTodayStr();
            if (state.currentDate !== todayStr) {
                if (!confirmLeaveEditMode()) return;
                setCurrentDate(todayStr);
            }
        });

        elements.editBtn.addEventListener('click', toggleEditMode);
        elements.excelBtn.addEventListener('click', () => onExportExcel());

        // 저장 버튼 클릭 시 일지 데이터 저장만 실행
        elements.saveBtn.addEventListener('click', () => {
            if (!state.isEditMode) return;
            onSave();
        });

        return {
            state,
            elements,
            getCurrentDate: () => state.currentDate,
            isEditMode: () => state.isEditMode,
            confirmLeaveEditMode,
            toggleEditMode,
            setCurrentDate,
            destroy: () => {
                if (state.fp) {
                    state.fp.destroy();
                    state.fp = null;
                }
            }
        };
    }

    return { init };
})();

// 하위 호환: 기존 3공장 페이지들이 window.Factory3Header.init(...) 을 그대로 호출하므로
// 별칭을 걸어둡니다. (factory3_header.js 파일 자체는 이제 로드하지 않아도 됩니다)
window.Factory3Header = window.CommonHeader;
