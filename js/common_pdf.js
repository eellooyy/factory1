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
        캡쳐 직전에 모든 input/select를 "정확히 같은 위치·크기의
        가운데 정렬 <span>"으로 잠깐 오버레이해서 캡쳐하고, 캡쳐가
        끝나면 바로 제거합니다. (원본 DOM 값은 전혀 건드리지 않음)

   3) 대용량 PDF 문제 (io 페이지는 압축 없는 PNG를 그대로 저장하고 있었음)
      → PNG 대신 JPEG(quality 0.72)로 인코딩 + jsPDF compress 옵션으로
        용량을 크게 줄입니다. (화질은 거의 차이 없이 보통 1/5~1/10 용량)
   ──────────────────────────────────────────────────────────────── */
window.CommonPdf = (function () {
    'use strict';

    // input/select 요소를 화면에 보이는 그대로의 값을 가진 가운데 정렬 <span>으로 임시 오버레이
    function overlayFormFields(root) {
        const overlays = [];

        root.querySelectorAll('input, select').forEach(function (el) {
            const rect = el.getBoundingClientRect();
            if (rect.width === 0 || rect.height === 0) return;

            const cs = getComputedStyle(el);
            const isSelect = el.tagName === 'SELECT';
            const text = isSelect
                ? (el.options[el.selectedIndex] ? el.options[el.selectedIndex].text : '')
                : el.value;

            const justify = cs.textAlign === 'center' ? 'center'
                : cs.textAlign === 'right' ? 'flex-end'
                : 'flex-start';

            const span = document.createElement('span');
            span.textContent = text;
            span.style.cssText = [
                'position: fixed',
                'left: ' + rect.left + 'px',
                'top: ' + rect.top + 'px',
                'width: ' + rect.width + 'px',
                'height: ' + rect.height + 'px',
                'display: flex',
                'align-items: center',
                'justify-content: ' + justify,
                'font: ' + cs.font,
                'color: ' + cs.color,
                'background: transparent',
                'box-sizing: border-box',
                'padding: ' + cs.padding,
                'pointer-events: none',
                'white-space: nowrap',
                'overflow: hidden',
                'z-index: 99999'
            ].join(';');

            document.body.appendChild(span);
            el.style.visibility = 'hidden';
            overlays.push({ el: el, span: span });
        });

        return overlays;
    }

    function restoreFormFields(overlays) {
        overlays.forEach(function (o) {
            o.el.style.visibility = '';
            o.span.remove();
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

        const overlays = overlayFormFields(target);

        try {
            const canvas = await html2canvas(target, {
                scale: scale,
                useCORS: true,
                backgroundColor: backgroundColor
            });

            restoreFormFields(overlays);
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
            restoreFormFields(overlays);
            restoreHidden();
            if (options.onDone) options.onDone();
            alert('PDF 생성 중 오류가 발생했습니다: ' + err.message);
        }
    }

    return { exportElementToPDF: exportElementToPDF };
})();
