/* factory1_common.js — 1공장 공통 헤더 컨트롤러 · 페이지 라우터
   ────────────────────────────────────────────────────────────────
   헤더(제목/삼선메뉴/드롭다운/날짜 네비게이션/수정·저장·엑셀 버튼)는
   이 스크립트가 단 하나만 소유하고 제어합니다.

   각 하위 페이지 모듈은 아래 인터페이스를 구현합니다.
     window.<모듈이름>Module = {
         init()              // 콘텐츠가 DOM에 삽입된 직후 호출 (요소 캐싱/이벤트 바인딩)
         activate(dateStr)   // 해당 날짜의 데이터를 불러와 렌더링 (Promise 반환 가능)
         setEditMode(isEdit) // 편집/보기 모드 전환
         save()              // 저장 처리 (Promise 반환 가능)
         isChanged()         // 저장되지 않은 변경사항 여부
     }
   ──────────────────────────────────────────────────────────────── */
(function () {
    'use strict';

    // ── 페이지 레지스트리 ─────────────────────────────────────────────────────
    const PAGES = {
        ft: {
            key: 'ft',
            title: '1공장 FT 일지',
            url: 'factory1_ft.html',
            fragmentUrl: 'factory1_ft_content.html',
            moduleName: 'Factory1FtModule',
            appName: 'Factory1Ft',
            excelMessage: '엑셀 출력 기능은 하단 레이아웃과 DB 연결을 정리한 뒤 활성화할 예정입니다.'
        },
        ft_io: {
            key: 'ft_io',
            title: '1공장 FT 재고 종합',
            url: 'factory1_ft_io.html',
            fragmentUrl: 'factory1_ft_io_content.html',
            moduleName: 'Factory1FtIoModule',
            appName: 'Factory1FtIo',
            excelMessage: '재고 종합 페이지의 엑셀 출력 기능은 개발 진행 중입니다.'
        },
        ilji: {
            key: 'ilji',
            title: '1공장 급지 일지',
            url: 'factory1_ilji.html',
            fragmentUrl: 'factory1_ilji_content.html',
            moduleName: 'Factory1IljiModule',
            appName: 'Factory1Ilji',
            excelMessage: '엑셀 출력 기능은 DB 연결을 정리한 뒤 활성화할 예정입니다.'
        }
    };

    const els = {};
    const state = {
        currentPageKey: null,
        currentDate: null,
        isEditMode: false,
        fp: null
    };

    // ── 날짜 유틸리티 표준화 (내부는 항상 YYYY-MM-DD 유지) ──
    function getTodayStr() {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }
    
    function getYesterdayStr() {
        const d = new Date();
        d.setDate(d.getDate() - 1);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }
    
    function addDays(dateStr, days) {
        if (!dateStr) return getTodayStr();
        const d = new Date(`${dateStr}T00:00:00`);
        d.setDate(d.getDate() + days);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }
    
    function formatKoDate(dateStr) {
        if (!dateStr) return '';
        const d = new Date(`${dateStr}T00:00:00`);
        if (isNaN(d.getTime())) return dateStr;
        const days = ['일', '월', '화', '수', '목', '금', '토'];
        return `${d.getFullYear()}년 ${String(d.getMonth() + 1).padStart(2, '0')}월 ${String(d.getDate()).padStart(2, '0')}일 (${days[d.getDay()]})`;
    }
    
    function syncDateLabel() {
        if (els.dateText) els.dateText.textContent = formatKoDate(state.currentDate);
    }

    // ── 현재 활성 페이지의 App / Module 참조 ──
    function getActiveConf() {
        return PAGES[state.currentPageKey] || null;
    }
    function getActiveApp() {
        const conf = getActiveConf();
        return conf ? window[conf.appName] : null;
    }
    function getActiveModule() {
        const conf = getActiveConf();
        return conf ? window[conf.moduleName] : null;
    }

    // ── 페이지 이탈 전 저장 확인 ──
    function confirmLeave() {
        const app = getActiveApp();
        if (app && app.state && app.state.isChanged) {
            return confirm('저장하지 않은 변경사항이 있습니다.\n저장하지 않고 이동하시겠습니까?');
        }
        return true;
    }

    // ── 수정/보기 모드 토글 ──
    function toggleEditMode() {
        state.isEditMode = !state.isEditMode;
        const mod = getActiveModule();
        if (mod && mod.setEditMode) mod.setEditMode(state.isEditMode);
        els.editBtn.textContent = state.isEditMode ? '보기' : '수정';
        els.saveBtn.disabled = !state.isEditMode;
    }

    const headerApi = {
        isEditMode() { return state.isEditMode; },
        toggleEditMode() { toggleEditMode(); }
    };

    // ── 날짜 변경 및 하단 요약 UI 연쇄 동기화 ──
    function setDate(dateStr) {
        state.currentDate = dateStr;

        if (window.Factory1Ft) window.Factory1Ft.state.currentDate = dateStr;
        if (window.Factory1FtIo) window.Factory1FtIo.state.currentDate = dateStr;
        if (window.Factory1Ilji) window.Factory1Ilji.state.currentDate = dateStr;

        syncDateLabel();

        if (state.fp && state.fp.selectedDates[0]) {
            const selected = state.fp.formatDate(state.fp.selectedDates[0], 'Y-m-d');
            if (selected !== dateStr) state.fp.setDate(dateStr, false);
        }

        const mod = getActiveModule();
        if (!mod || !mod.activate) return;

        els.editBtn.disabled = true;
        Promise.resolve(mod.activate(dateStr)).then(() => {
            els.editBtn.disabled = false;
            
            // 데이터 렌더링 완료 직후 하단 요약 계산 강제 트리거
            setTimeout(() => {
                const mainInputs = els.pageRoot.querySelectorAll('.numeric-input, input[data-field]');
                mainInputs.forEach(input => {
                    input.dispatchEvent(new Event('input', { bubbles: true }));
                    input.dispatchEvent(new Event('change', { bubbles: true }));
                });

                // [버그 수정] 강제 이벤트 발생으로 인해 오염된 변경 감지 플래그(isChanged)를 깨끗하게 초기화
                const app = getActiveApp();
                if (app && app.state) {
                    app.state.isChanged = false;
                }
            }, 50);
        });
    }

    // ── flatpickr 캘린더 초기화 ──
    function initCalendar() {
        state.fp = flatpickr('#f1Flatpickr', {
            locale: 'ko',
            dateFormat: 'Y-m-d',
            defaultDate: state.currentDate || getYesterdayStr(),
            clickOpens: false,
            allowInput: false,
            positionElement: els.dateText,
            position: 'auto center',
            onReady(_, __, instance) {
                instance.calendarContainer.style.marginTop = '10px';
            },
            onChange(_, dateStr) {
                if (!dateStr) return;
                const app = getActiveApp();
                if (app && app.state.isChanged) {
                    if (!confirm('저장되지 않은 변경사항이 있습니다.\n저장하지 않고 선택한 날짜로 이동하시겠습니까?')) {
                        state.fp.setDate(state.currentDate, false);
                        return;
                    }
                }
                setDate(dateStr);
            },
            onClose() {
                if (els.dateText) {
                    els.dateText.classList.add('just-closed');
                    setTimeout(() => els.dateText.classList.remove('just-closed'), 200);
                }
            }
        });
    }

    // ── 날짜 버튼 이벤트 ──
    function bindDateEvents() {
        els.dateText.addEventListener('click', e => {
            e.stopPropagation();
            if (!state.fp) return;
            if (els.dateText.classList.contains('just-closed')) return;
            state.fp.isOpen ? state.fp.close() : state.fp.open();
        });

        els.prevBtn.addEventListener('click', () => {
            if (!confirmLeave()) return;
            setDate(addDays(state.currentDate, -1));
        });

        els.nextBtn.addEventListener('click', () => {
            if (!confirmLeave()) return;
            setDate(addDays(state.currentDate, 1));
        });

        els.todayBtn.addEventListener('click', () => {
            const today = getTodayStr();
            if (state.currentDate !== today) {
                if (!confirmLeave()) return;
                setDate(today);
            }
        });
    }

    // ── 삼선 메뉴 / 드롭다운 ──
    function closeDropdown() {
        if (els.dropdown) els.dropdown.classList.remove('show');
    }

    function bindDropdownEvents() {
        const toggleDropdown = e => {
            e.stopPropagation();
            els.dropdown.classList.toggle('show');
        };

        els.menuBtn.addEventListener('click', toggleDropdown);
        els.mainTitle.addEventListener('click', toggleDropdown);

        document.addEventListener('click', e => {
            if (!e.target.closest('.f1-title-area')) closeDropdown();
        });

        els.dropdown.querySelectorAll('.f1-dropdown-item[data-page]').forEach(item => {
            item.addEventListener('click', e => {
                e.preventDefault();
                e.stopPropagation();
                const key = item.dataset.page;
                if (key === state.currentPageKey) {
                    closeDropdown();
                    return;
                }
                switchPage(key);
            });
        });
    }

    // ── 버튼 이벤트 ──
    function bindButtonEvents() {
        els.editBtn.addEventListener('click', () => {
            if (state.isEditMode && !confirmLeave()) return;
            toggleEditMode();
        });

        els.saveBtn.addEventListener('click', () => {
            if (!state.isEditMode) return;
            const mod = getActiveModule();
            if (mod && mod.save) mod.save();
        });

        els.excelBtn.addEventListener('click', () => {
            const conf = getActiveConf();
            alert(conf ? conf.excelMessage : '엑셀 출력 기능을 준비 중입니다.');
        });

        window.addEventListener('beforeunload', e => {
            const app = getActiveApp();
            if (app && app.state && app.state.isChanged) {
                e.preventDefault();
                e.returnValue = '';
            }
        });
    }

    // ── 헤더 표시 갱신 ──
    function updateHeaderUI(key) {
        const conf = PAGES[key];
        if (!conf) return;
        document.title = conf.title;
        if (els.mainTitle) els.mainTitle.textContent = conf.title;
        if (els.dropdown) {
            els.dropdown.querySelectorAll('.f1-dropdown-item[data-page]').forEach(item => {
                item.classList.toggle('active', item.dataset.page === key);
            });
        }
        if (els.shell) {
            Object.keys(PAGES).forEach(k => els.shell.classList.remove(`f1-shell--${k}`));
            els.shell.classList.add(`f1-shell--${key}`);
        }
    }

    // ── 페이지 전환 ──
    function switchPage(key, opts) {
        opts = opts || {};
        if (key === state.currentPageKey && state.currentPageKey !== null) {
            closeDropdown();
            return;
        }

        const conf = PAGES[key];
        if (!conf) return;

        fetch(conf.fragmentUrl)
            .then(res => {
                if (!res.ok) throw new Error('페이지를 불러오지 못했습니다.');
                return res.text();
            })
            .then(html => {
                els.pageRoot.innerHTML = html;
                state.currentPageKey = key;
                updateHeaderUI(key);
                closeDropdown();

                state.isEditMode = false;
                els.editBtn.textContent = '수정';
                els.saveBtn.disabled = true;
                els.excelBtn.disabled = true;

                const mod = getActiveModule();
                if (mod && mod.init) mod.init();

                if (opts.pushState !== false) {
                    history.pushState({ page: key }, '', conf.url);
                }

                setDate(state.currentDate || getYesterdayStr());
            })
            .catch(err => {
                alert('페이지 전환 중 오류가 발생했습니다.\n' + err.message);
            });
    }

    function detectPageKeyFromLocation() {
        const path = location.pathname;
        for (const key in PAGES) {
            if (path.endsWith(PAGES[key].url)) return key;
        }
        return null;
    }

    // ── 초기화 ───────────────────────────────────────────────────────────────
    document.addEventListener('DOMContentLoaded', function () {
        els.shell     = document.querySelector('.f1-shell');
        els.menuBtn   = document.getElementById('f1MenuBtn');
        els.mainTitle = document.getElementById('f1MainTitle');
        els.dropdown  = document.getElementById('f1Dropdown');
        els.dateText  = document.getElementById('f1DateText');
        els.prevBtn   = document.getElementById('f1PrevBtn');
        els.nextBtn   = document.getElementById('f1NextBtn');
        els.todayBtn  = document.getElementById('f1TodayBtn');
        els.editBtn   = document.getElementById('f1EditBtn');
        els.saveBtn   = document.getElementById('f1SaveBtn');
        els.excelBtn  = document.getElementById('f1ExcelBtn');
        els.pageRoot  = document.getElementById('f1PageRoot');

        if (!els.pageRoot) return;

        [window.Factory1Ft, window.Factory1FtIo, window.Factory1Ilji].forEach(App => {
            if (!App) return;
            App.elements.dateText = els.dateText;
            App.elements.prevBtn  = els.prevBtn;
            App.elements.nextBtn  = els.nextBtn;
            App.elements.todayBtn = els.todayBtn;
            App.elements.editBtn  = els.editBtn;
            App.elements.saveBtn  = els.saveBtn;
            App.elements.excelBtn = els.excelBtn;
            App.headerApi = headerApi;
        });

        bindDropdownEvents();
        bindDateEvents();
        bindButtonEvents();
        initCalendar();

        // 브라우저 렌더링 스택 안전 확인 후 첫 페이지 로드 지시
        setTimeout(() => {
            const initialKey = document.body.dataset.initialPage || 'ft';
            switchPage(initialKey, { pushState: false });
        }, 50);

        window.addEventListener('popstate', e => {
            const key = (e.state && e.state.page) || detectPageKeyFromLocation() || initialKey;
            switchPage(key, { pushState: false });
        });
    });

})();