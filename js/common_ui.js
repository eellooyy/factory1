/* common_ui.js — 1공장 · 3공장 공통 UI 로직 (기존 js/common_ui.js를 승격)
   ────────────────────────────────────────────────────────────────
   변경점은 딱 하나, "공지사항 스코프(scope) 필터" 추가뿐입니다.

   - <body data-notice-scope="factory1"> 처럼 body에 data-notice-scope
     속성을 넣어두면, 그 값과 일치하거나 scope가 비어있는(레거시) 공지만
     불러옵니다. 속성이 아예 없으면 기존 3공장처럼 전체를 그대로 불러옵니다
     (하위 호환 100%, 기존 3공장 페이지는 아무것도 안 건드려도 그대로 동작).
   - 새로 작성하는 공지는 현재 페이지의 scope 값을 함께 저장합니다.

   ※ Supabase notice 테이블에 scope 컬럼(text, nullable)이 없다면 아래 SQL을
     먼저 한 번 실행해 주세요.
       alter table notice add column if not exists scope text;
   ──────────────────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
    // 1. 상단 메뉴 드롭다운 관리자 로직
    const titleWraps = document.querySelectorAll('.gf3-title-wrap, .f3i-title-wrap');

    titleWraps.forEach(wrap => {
        wrap.addEventListener('click', (e) => {
            e.stopPropagation();
            const dropdown = wrap.querySelector('.gf3-dropdown, .f3i-dropdown');

            if (dropdown) {
                document.querySelectorAll('.gf3-dropdown.show, .f3i-dropdown.show').forEach(d => {
                    if (d !== dropdown) {
                        d.classList.remove('show');
                    }
                });

                dropdown.classList.toggle('show');
            }
        });
    });

    document.querySelectorAll('.gf3-dropdown-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.stopPropagation();
        });
    });

    document.addEventListener('click', () => {
        document.querySelectorAll('.gf3-dropdown.show, .f3i-dropdown.show').forEach(dropdown => {
            dropdown.classList.remove('show');
        });
    });

    // 2. 공지사항 롤링 바 및 상세 모달 인터랙션 관리 모듈 (Supabase DB 연동 버전)
    const NoticeManager = {
        supabase: null,
        notices: [],
        currentIdx: 0,
        tickerInterval: null,
        activeDetailIdx: null,
        scope: document.body.dataset.noticeScope || null,

        init: async function() {
            if (window.Factory3Utils && typeof window.Factory3Utils.initSupabase === 'function') {
                this.supabase = window.Factory3Utils.initSupabase();
            } else {
                console.error("Factory3Utils 또는 Supabase 라이브러리를 로드할 수 없습니다.");
                return;
            }

            await this.loadNotices();

            this.renderTicker();
            this.startTicker();
            this.bindEvents();
            this.renderList();
        },

        // DB로부터 공지사항 데이터 로드 (id 오름차순 정렬)
        // scope가 지정된 페이지는 "내 scope + scope 미지정(레거시) 공지"만 불러옵니다.
        loadNotices: async function() {
            try {
                let query = this.supabase.from('notice').select('*').order('id', { ascending: true });

                if (this.scope) {
                    query = query.or(`scope.is.null,scope.eq.${this.scope}`);
                }

                const { data, error } = await query;

                if (error) throw error;
                this.notices = data || [];
            } catch (err) {
                console.error("공지사항 DB 로드 실패:", err.message);
                this.notices = [];
            }
        },

        renderTicker: function() {
            const wrapper = document.getElementById('f3iTickerWrapper');
            if (!wrapper) return;

            if (this.notices.length === 0) {
                wrapper.innerHTML = `<div class="f3i-ticker-item active" style="color: #8e8e93;">📢 등록된 공지사항이 없습니다.</div>`;
                return;
            }

            wrapper.innerHTML = this.notices.map((n, idx) => `
                <div class="f3i-ticker-item ${idx === 0 ? 'active' : ''}" data-idx="${idx}">${n.title}</div>
            `).join('');
            this.currentIdx = 0;
        },

        startTicker: function() {
            if (this.tickerInterval) clearInterval(this.tickerInterval);

            const items = document.querySelectorAll('.f3i-ticker-item');
            if (items.length <= 1) return;

            this.tickerInterval = setInterval(() => {
                if (items.length === 0) return;
                items[this.currentIdx].classList.remove('active');
                this.currentIdx = (this.currentIdx + 1) % items.length;
                items[this.currentIdx].classList.add('active');
            }, 10000);
        },

        bindEvents: function() {
            const tickerBar = document.getElementById('f3iNoticeTicker');
            const modal = document.getElementById('f3iNoticeModal');
            const closeBtn = document.getElementById('f3iNoticeCloseBtn');
            const backBtn = document.getElementById('f3iNoticeBackBtn');

            if (tickerBar) {
                tickerBar.addEventListener('click', () => {
                    modal.classList.add('show');
                    this.renderList();
                });
            }

            if (closeBtn) {
                closeBtn.addEventListener('click', () => {
                    modal.classList.remove('show');
                });
            }

            if (backBtn) {
                backBtn.addEventListener('click', () => {
                    this.renderList();
                });
            }
        },

        renderList: function() {
            const body = document.getElementById('f3iNoticeModalBody');
            const title = document.getElementById('f3iNoticeModalTitle');
            const backBtn = document.getElementById('f3iNoticeBackBtn');
            if (!body) return;

            title.innerText = "전체 공지사항 목록";
            if (backBtn) backBtn.style.display = "none";
            this.activeDetailIdx = null;

            const wrapper = document.querySelector('.f3i-wrapper') || document.querySelector('.gf3-wrapper[data-page-module]');
            const isMasterMode = wrapper && wrapper.classList.contains('master-mode-active');

            let html = '<div class="f3i-nlist-container" style="display: flex; flex-direction: column; height: 100%; justify-content: space-between;">';

            html += '<div style="flex: 1; overflow-y: auto;">';
            if (this.notices.length === 0) {
                html += '<div style="text-align: center; color: #8e8e93; padding: 40px 0; font-size: 13px;">등록된 공지사항이 없습니다.</div>';
            } else {
                this.notices.forEach((n, idx) => {
                    html += `
                        <div class="f3i-nlist-item" data-idx="${idx}">
                            <span style="flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; padding-right: 12px;">${n.title}</span>
                            <div style="display: flex; align-items: center; gap: 8px;">
                                ${isMasterMode ? `<span class="material-symbols-outlined f3i-ndelete-btn" data-delete-idx="${idx}">delete</span>` : ''}
                                <span class="material-symbols-outlined arrow">chevron_right</span>
                            </div>
                        </div>
                    `;
                });
            }
            html += '</div>';

            if (isMasterMode) {
                html += `
                    <div class="f3i-nadd-wrap">
                        <button type="button" id="f3iNoticeAddBtn" class="f3i-nbtn f3i-nbtn-add">
                            <span class="material-symbols-outlined" style="font-size: 16px;">add</span> 새 공지사항 추가
                        </button>
                    </div>
                `;
            }

            html += '</div>';
            body.innerHTML = html;

            body.querySelectorAll('.f3i-nlist-item').forEach(item => {
                item.addEventListener('click', (e) => {
                    if (e.target.classList.contains('f3i-ndelete-btn')) return;

                    const idx = parseInt(item.getAttribute('data-idx'));
                    this.renderDetail(idx);
                });
            });

            if (isMasterMode) {
                body.querySelectorAll('.f3i-ndelete-btn').forEach(btn => {
                    btn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        const idx = parseInt(btn.getAttribute('data-delete-idx'));
                        if (confirm('이 공지사항을 정말로 삭제하시겠습니까?')) {
                            this.deleteNotice(idx);
                        }
                    });
                });

                const addBtn = document.getElementById('f3iNoticeAddBtn');
                if (addBtn) {
                    addBtn.addEventListener('click', () => {
                        this.addNotice();
                    });
                }
            }
        },

        // 새 공지사항 데이터 추가 로직 (DB 연동) — 현재 페이지의 scope를 함께 저장
        addNotice: async function() {
            const newNotice = {
                title: "📢 [새 공지] 공지사항 제목을 입력하세요",
                content: "여기에 새로운 공지사항 세부 내용을 입력하세요."
            };
            if (this.scope) newNotice.scope = this.scope;

            try {
                const { data, error } = await this.supabase
                    .from('notice')
                    .insert([newNotice])
                    .select();

                if (error) throw error;

                if (data && data.length > 0) {
                    this.notices.push(data[0]);
                    this.renderTicker();
                    this.startTicker();
                    this.renderDetail(this.notices.length - 1);
                }
            } catch (err) {
                alert('공지사항을 생성하지 못했습니다: ' + err.message);
            }
        },

        deleteNotice: async function(idx) {
            const targetNotice = this.notices[idx];
            if (!targetNotice || !targetNotice.id) return;

            try {
                const { error } = await this.supabase
                    .from('notice')
                    .delete()
                    .eq('id', targetNotice.id);

                if (error) throw error;

                this.notices.splice(idx, 1);

                if (this.currentIdx >= this.notices.length) {
                    this.currentIdx = 0;
                }

                this.renderTicker();
                this.startTicker();
                this.renderList();
            } catch (err) {
                alert('공지사항 삭제에 실패했습니다: ' + err.message);
            }
        },

        renderDetail: function(idx) {
            const body = document.getElementById('f3iNoticeModalBody');
            const title = document.getElementById('f3iNoticeModalTitle');
            const backBtn = document.getElementById('f3iNoticeBackBtn');
            if (!body) return;

            this.activeDetailIdx = idx;
            const targetNotice = this.notices[idx];
            title.innerText = "공지사항 상세 내용";
            if (backBtn) backBtn.style.display = "flex";

            const masterWrapper = document.querySelector('.f3i-wrapper') || document.querySelector('.gf3-wrapper[data-page-module]');
            const isMasterMode = masterWrapper ? masterWrapper.classList.contains('master-mode-active') : false;

            let editActionsHtml = '';
            if (isMasterMode) {
                editActionsHtml = `
                    <div class="f3i-nedit-actions">
                        <button type="button" id="f3iNoticeImgBtn" class="f3i-nbtn f3i-nbtn-secondary">
                            <span class="material-symbols-outlined" style="font-size: 16px;">image</span> 이미지 링크 삽입
                        </button>
                        <button type="button" id="f3iNoticeSaveBtn" class="f3i-nbtn f3i-nbtn-primary">
                            <span class="material-symbols-outlined" style="font-size: 16px;">save</span> 이 공지만 저장
                        </button>
                    </div>
                `;
            }

            body.innerHTML = `
                <div class="f3i-ndetail-wrapper" style="display: flex; flex-direction: column; height: 100%; justify-content: space-between;">
                    <div style="flex: 1; overflow-y: auto; padding-right: 4px; display: flex; flex-direction: column;">
                        <h3 id="f3iEditTitle" class="${isMasterMode ? 'f3i-nedit-target' : ''}"
                            contenteditable="${isMasterMode}" style="margin: 0; padding: 4px 0;">${targetNotice.title}</h3>
                        <hr style="border:0; border-top:1px solid #e5e5ea; margin:12px 0;">
                        <div id="f3iEditContent" class="f3i-ndetail-content ${isMasterMode ? 'f3i-nedit-target' : ''}"
                             contenteditable="${isMasterMode}" style="flex: 1; min-height: 180px; outline: none;">${targetNotice.content}</div>
                    </div>
                    ${editActionsHtml}
                </div>
            `;

            if (isMasterMode) {
                const imgBtn = document.getElementById('f3iNoticeImgBtn');
                const saveBtn = document.getElementById('f3iNoticeSaveBtn');

                if (imgBtn) {
                    imgBtn.addEventListener('click', () => {
                        const url = prompt("삽입할 이미지 링크(URL)를 입력해주세요:");
                        if (url && url.trim() !== "") {
                            const editContent = document.getElementById('f3iEditContent');
                            if (editContent) {
                                editContent.focus();
                                const imgHtml = `<br><img src="${url.trim()}" alt="첨부 이미지"><br>`;
                                try {
                                    if (!document.execCommand('insertHTML', false, imgHtml)) {
                                        editContent.innerHTML += imgHtml;
                                    }
                                } catch (e) {
                                    editContent.innerHTML += imgHtml;
                                }
                            }
                        }
                    });
                }

                if (saveBtn) {
                    saveBtn.addEventListener('click', () => {
                        this.saveChanges();
                    });
                }
            }
        },

        saveChanges: async function() {
            if (this.activeDetailIdx === null) return;

            const editTitle = document.getElementById('f3iEditTitle');
            const editContent = document.getElementById('f3iEditContent');

            if (editTitle && editContent) {
                const targetNotice = this.notices[this.activeDetailIdx];
                const updatedTitle = editTitle.innerText.trim();
                const updatedContent = editContent.innerHTML.trim();

                try {
                    const { error } = await this.supabase
                        .from('notice')
                        .update({
                            title: updatedTitle,
                            content: updatedContent
                        })
                        .eq('id', targetNotice.id);

                    if (error) throw error;

                    targetNotice.title = updatedTitle;
                    targetNotice.content = updatedContent;

                    this.renderTicker();
                    this.startTicker();
                    alert('공지사항 변경 사항이 성공적으로 저장되었습니다.');
                } catch (err) {
                    alert('공지사항을 저장하지 못했습니다: ' + err.message);
                }
            }
        }
    };

    window.NoticeManager = NoticeManager;
    NoticeManager.init();
});
