/* factory1_common.js — 1공장 공통 헤더 컨트롤러 · 페이지 라우터
   ────────────────────────────────────────────────────────────────
   헤더(제목/삼선메뉴/드롭다운/날짜 네비게이션/수정·저장·엑셀 버튼)는
   이 스크립트가 단 하나만 소유하고 제어합니다.

   각 하위 페이지(factory1_ft_main.js, factory1_ilji_main.js)는
   더 이상 헤더 요소를 직접 다루지 않고, 아래 인터페이스만 구현합니다.

     window.<모듈이름>Module = {
         init()              // 콘텐츠가 DOM에 삽입된 직후 호출 (요소 캐싱/이벤트 바인딩)
         activate(dateStr)   // 해당 날짜의 데이터를 불러와 렌더링 (Promise 반환 가능)
         setEditMode(isEdit) // 편집/보기 모드 전환
         save()              // 저장 처리 (Promise 반환 가능)
         isChanged()         // 저장되지 않은 변경사항 여부
     }

   페이지를 이동(dropdown 클릭)해도 <header> 는 그대로 유지되고,
   #f1PageRoot 안쪽 콘텐츠만 fetch 로 받아와 교체됩니다(새로고침 없음).
   ──────────────────────────────────────────────────────────────── */
(function () {
    'use strict';

    // ── 페이지 레지스트리 ─────────────────────────────────────────────────────
    // 새로운 하위 페이지를 추가할 때는 이 객체에만 등록하면 됩니다.
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

    // ── 날짜 유틸 (헤더가 공통으로 소유) ─────────────────────────────────────
    function getTodayStr() {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }
    function getYesterdayStr() {
        return addDays(getTodayStr(), -1);
    }
    function addDays(dateStr, days) {
        const d = new Date(`${dateStr}T00:00:00`);
        d.setDate(d.getDate() + days);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }
    function formatKoDate(dateStr) {
        if (!dateStr) return '';
        const d = new Date(`${dateStr}T00:00:00`);
        const days = ['일', '월', '화', '수', '목', '금', '토'];
        return `${d.getFullYear()}년 ${String(d.getMonth() + 1).padStart(2, '0')}월 ${String(d.getDate()).padStart(2, '0')}일 (${days[d.getDay()]})`;
    }
    function syncDateLabel() {
        if (els.dateText) els.dateText.textContent = formatKoDate(state.currentDate);
    }

    // ── 현재 활성 페이지의 App / Module 참조 ──────────────────────────────────
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

    // ── 페이지 이탈(날짜 변경/페이지 전환) 전 저장 확인 ───────────────────────
    function confirmLeave() {
        const app = getActiveApp();
        if (app && app.state && app.state.isChanged) {
            return confirm('저장하지 않은 변경사항이 있습니다.\n저장하지 않고 이동하시겠습니까?');
        }
        return true;
    }

    // ── 수정/보기 모드 토글 (헤더 버튼 1개로 공통 제어) ───────────────────────
    function toggleEditMode() {
        state.isEditMode = !state.isEditMode;
        const mod = getActiveModule();
        if (mod && mod.setEditMode) mod.setEditMode(state.isEditMode);
        els.editBtn.textContent = state.isEditMode ? '보기' : '수정';
        els.saveBtn.disabled = !state.isEditMode;
    }

    // 각 페이지의 api.js 가 "저장 후 자동으로 보기 모드로 전환"할 때 사용하는 훅
    const headerApi = {
        isEditMode() { return state.isEditMode; },
        toggleEditMode() { toggleEditMode(); }
    };

    // ── 날짜 변경 ─────────────────────────────────────────────────────────────
    function setDate(dateStr) {
        state.currentDate = dateStr;

        // 두 페이지 App 모두 같은 날짜를 바라보도록 동기화 (페이지 전환 시 날짜 유지)
        if (window.Factory1Ft) window.Factory1Ft.state.currentDate = dateStr;
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
        });
    }

    // ── flatpickr 캘린더 초기화 (헤더에 단 하나만 존재) ───────────────────────
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

    // ── 날짜 버튼 이벤트 ─────────────────────────────────────────────────────
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

    // ── 삼선 메뉴 / 드롭다운 ─────────────────────────────────────────────────
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

        els.dropdown.querySelectorAll('.f1-dropdown-item').forEach(item => {
            item.addEventListener('click', e => {
                e.preventDefault();
                const key = item.dataset.page;
                if (item.classList.contains('active')) {
                    closeDropdown();
                    return;
                }
                switchPage(key);
            });
        });
    }

    // ── 버튼(오늘/수정/저장/엑셀) ────────────────────────────────────────────
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

    // ── 헤더 표시 갱신 (제목/드롭다운 active 상태) ────────────────────────────
    function updateHeaderUI(key) {
        const conf = PAGES[key];
        if (!conf) return;
        document.title = conf.title;
        if (els.mainTitle) els.mainTitle.textContent = conf.title;
        if (els.dropdown) {
            els.dropdown.querySelectorAll('.f1-dropdown-item').forEach(item => {
                item.classList.toggle('active', item.dataset.page === key);
            });
        }
        // 셸의 좌우 폭(max-width)은 이제 페이지와 무관하게 항상 고정입니다
        // (factory1_common_style.css 의 .f1-shell 참고 — 헤더가 페이지 전환 시
        //  절대 움직이지 않도록 하기 위함). 페이지별로 다른 건 zoom 배율 뿐이라,
        // 그 차이만 클래스로 부여합니다 (예: 급지일지는 f1-shell--ilji 로 zoom:1).
        if (els.shell) {
            Object.keys(PAGES).forEach(k => els.shell.classList.remove(`f1-shell--${k}`));
            els.shell.classList.add(`f1-shell--${key}`);
        }
    }

    // ── 페이지 전환 (핵심: 헤더는 그대로, 콘텐츠만 교체) ──────────────────────
    function switchPage(key, opts) {
        opts = opts || {};

        if (key === state.currentPageKey) {
            closeDropdown();
            return;
        }

        const conf = PAGES[key];
        if (!conf) return;

        if (!confirmLeave()) return;

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

                // 새 페이지는 항상 보기 모드로 진입
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

        // 각 하위 페이지 App 에 "공통 헤더 요소"와 headerApi 주입
        [window.Factory1Ft, window.Factory1Ilji].forEach(App => {
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

        const initialKey = document.body.dataset.initialPage || 'ft';
        state.currentPageKey = initialKey;
        updateHeaderUI(initialKey);

        const mod = getActiveModule();
        if (mod && mod.init) mod.init();

        setDate(getYesterdayStr());

        window.addEventListener('popstate', e => {
            const key = (e.state && e.state.page) || detectPageKeyFromLocation() || initialKey;
            switchPage(key, { pushState: false });
        });
    });

})();