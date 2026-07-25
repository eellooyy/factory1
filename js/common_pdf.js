/* common_pdf.js — 1공장 · 3공장 공통 PDF 저장 유틸
   ────────────────────────────────────────────────────────────────
   기존에 factory3_ilji_render.js / factory3_io_main.js에 각각 따로
   구현되어 있던 html2canvas + jsPDF 로직을 하나로 합치면서, 발견된
   문제 3가지를 함께 고쳤습니다.

   1) 공통헤더의 공지사항 롤링 티커가 PDF에 같이 캡쳐되던 문제
      → hideDuringCapture 배열로 넘긴 요소(#f3iNoticeTicker 등)를
        캡쳐 직전에 display:none 처리했다가 캡쳐 후 원복합니다.

   2) (급지 일지 등) 셀 안의 입력값이 셀 위쪽에 붙어서 캡쳐되던 문제
      → html2canvas는 <input>/<select> 안의 텍스트를 실제 브라우저
        렌더링과 다르게(위쪽 정렬로) 그리는 고질적인 버그가 있습니다.
        캡쳐 직전에 모든 input/select의 line-height를 자기 높이에
        맞춰 잠깐 조정해서 세로 중앙에 그려지도록 유도하고, 캡쳐가
        끝나면 즉시 원복합니다. (화면에는 아무 변화도 보이지 않고,
        새 DOM 요소를 만들지 않으므로 캡쳐 범위 밖으로 빠져서 내용이
        비어버리는 일도 없습니다)

   3) 대용량 PDF 문제 (io 페이지는 압축 없는 PNG를 그대로 저장하고 있었음)
      → PNG 대신 JPEG(quality 0.72)로 인코딩 + jsPDF compress 옵션으로
        용량을 크게 줄입니다. (화질은 거의 차이 없이 보통 1/5~1/10 용량)
   ──────────────────────────────────────────────────────────────── */
window.CommonPdf = (function () {
    'use strict';

    // input/select 안의 값이 셀 위쪽에 붙어서 캡쳐되는 html2canvas의 고질적인 버그 보정.
    // (이전 버전은 화면에 새 <span>을 잠깐 겹쳐 그리는 방식이었는데, 캡쳐 범위가
    //  document.body 전체가 아닐 때 그 span이 캡쳐 대상 바깥에 생겨서 해당 부분이
    //  통째로 비어버리고, 화면에도 잠깐 보이는 부작용이 있었습니다.
    //  지금은 새 요소를 전혀 만들지 않고, 각 입력칸 자신의 line-height만
    //  자기 높이에 맞춰 잠깐 조정합니다 — 화면에는 아무 변화도 보이지 않고,
    //  html2canvas가 텍스트를 세로 중앙에 그리도록 유도만 합니다.)
    function fixInputVerticalAlign(root) {
        const patched = [];

        root.querySelectorAll('input, select').forEach(function (el) {
            const h = el.getBoundingClientRect().height;
            if (h <= 0) return;

            patched.push({ el: el, prevLineHeight: el.style.lineHeight });
            el.style.lineHeight = h + 'px';
        });

        return patched;
    }

    function restoreInputVerticalAlign(patched) {
        patched.forEach(function (p) {
            p.el.style.lineHeight = p.prevLineHeight;
        });
    }

    function hideElements(elements) {
        const targets = (elements || []).filter(Boolean);
        const prevDisplay = targets.map(function (el) { return el.style.display; });
        targets.forEach(function (el) { el.style.display = 'none'; });
        return function restore() {
            targets.forEach(function (el, i) { el.style.display = prevDisplay[i]; });
        };
    }

    /**
     * target 요소를 캡쳐해서 PDF로 저장합니다.
     * @param {Object} options
     * @param {HTMLElement} options.target - 캡쳐할 루트 엘리먼트
     * @param {string} options.filename - 저장 파일명
     * @param {HTMLElement[]} [options.hideDuringCapture] - 캡쳐 중 숨길 요소들 (공지 티커, 버튼 등)
     * @param {string} [options.backgroundColor]
     * @param {number} [options.scale]
     * @param {number} [options.imageQuality] - JPEG 압축 품질 0~1 (기본 0.72)
     * @param {Function} [options.onBusy] - 캡쳐 시작 시 버튼 등에 "처리중" 표시하고 싶을 때
     * @param {Function} [options.onDone] - 캡쳐 종료(성공/실패 무관) 후 복원 콜백
     */
    async function exportElementToPDF(options) {
        const target = options.target;
        const filename = options.filename;
        const hideDuringCapture = options.hideDuringCapture || [];
        const backgroundColor = options.backgroundColor || '#ffffff';
        const scale = options.scale || 1.5;
        const imageQuality = options.imageQuality != null ? options.imageQuality : 0.72;

        if (!window.html2canvas || !window.jspdf) {
            alert('PDF 모듈을 불러오는 데 실패했습니다. 잠시 후 다시 시도해주세요.');
            return;
        }
        if (!target) {
            alert('PDF로 저장할 영역을 찾지 못했습니다.');
            return;
        }

        if (options.onBusy) options.onBusy();
        const restoreHidden = hideElements(hideDuringCapture);

        // display:none이 레이아웃에 반영될 시간을 살짝 준 뒤 캡쳐 시작
        await new Promise(function (resolve) { setTimeout(resolve, 80); });

        const patchedInputs = fixInputVerticalAlign(target);

        try {
            const canvas = await html2canvas(target, {
                scale: scale,
                useCORS: true,
                backgroundColor: backgroundColor
            });

            restoreInputVerticalAlign(patchedInputs);
            restoreHidden();
            if (options.onDone) options.onDone();

            const jsPDF = window.jspdf.jsPDF;
            const imgData = canvas.toDataURL('image/jpeg', imageQuality);

            const pxToMm = 25.4 / 96;
            const pageWidthMm = (canvas.width / scale) * pxToMm;
            const pageHeightMm = (canvas.height / scale) * pxToMm;

            const pdf = new jsPDF({
                orientation: pageWidthMm >= pageHeightMm ? 'landscape' : 'portrait',
                unit: 'mm',
                format: [pageWidthMm, pageHeightMm],
                compress: true
            });

            pdf.addImage(imgData, 'JPEG', 0, 0, pageWidthMm, pageHeightMm, undefined, 'FAST');
            pdf.save(filename);
        } catch (err) {
            restoreInputVerticalAlign(patchedInputs);
            restoreHidden();
            if (options.onDone) options.onDone();
            alert('PDF 생성 중 오류가 발생했습니다: ' + err.message);
        }
    }

    return { exportElementToPDF: exportElementToPDF };
})();
