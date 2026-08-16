// ==========================================
// PRICING BOXES
// ==========================================

const boxes = document.querySelectorAll('.pricing_boxes div');

boxes.forEach(box => {
    box.addEventListener('click', () => {
        boxes.forEach(b => b.classList.remove('selected'));
        box.classList.add('selected');
    });
});


// ==========================================
// HANZI DATA
// ==========================================

const givenHanzi = [
    { chinese: "水", pinyin: "shuǐ", english: "Water" },
    { chinese: "火", pinyin: "huǒ", english: "Fire" },
    { chinese: "山", pinyin: "shān", english: "Mountain" },
    { chinese: "气", pinyin: "qì", english: "Air" },
    { chinese: "土", pinyin: "tǔ", english: "Earth" },
    { chinese: "人", pinyin: "rén", english: "Person" },
    { chinese: "龙", pinyin: "lóng", english: "Dragon" },
    { chinese: "月", pinyin: "yuè", english: "Moon" },
    { chinese: "八", pinyin: "bā", english: "Eight" },
    { chinese: "米", pinyin: "mǐ", english: "Rice" },
];

let exampleWriter = null;
let resizeTimer = null;


// ==========================================
// LOAD RANDOM CHARACTER
// ==========================================

function loadGivenHanzi() {
    const randomEntry =
        givenHanzi[Math.floor(Math.random() * givenHanzi.length)];

    const targetCharBox = document.querySelector('.targetCharBox');

    if (!targetCharBox) {
        console.error('Could not find .targetCharBox');
        return;
    }

    targetCharBox.innerHTML = `
        <span>${randomEntry.pinyin}</span>
        <strong>${randomEntry.english}</strong>
    `;

    window.targetHanziEntry = randomEntry;
    window.targetCharacter = randomEntry.chinese;

    showExampleCharacter();
    buildBoards();
}


// ==========================================
// EXAMPLE CHARACTER
// ==========================================

function showExampleCharacter() {
    const container =
        document.getElementById('character-target-div');

    if (!container) {
        console.error(
            'Could not find #character-target-div'
        );
        return;
    }

    if (exampleWriter) {
        try {
            exampleWriter.cancelQuiz();
            exampleWriter.pauseAnimation();
        } catch (error) {
            // Ignore if these methods aren't active
        }
    }

    container.innerHTML = '';

    const charBox = document.createElement('div');
    charBox.className = 'exampleCharBox';

    container.appendChild(charBox);

    const size = charBox.clientWidth;

    if (size === 0) {
        console.warn(
            'Example character box has width 0.'
        );
        return;
    }

    exampleWriter = HanziWriter.create(
        charBox,
        window.targetCharacter,
        {
            width: size,
            height: size,
            padding: 5,
            strokeAnimationSpeed: 1,
            delayBetweenLoops: 3000
        }
    );

    exampleWriter.loopCharacterAnimation();
}


// ==========================================
// DRAWING GRID
// ==========================================

function drawGrid(ctx, width, height) {
    ctx.clearRect(0, 0, width, height);

    ctx.strokeStyle = '#ee1c25';

    // Outer border
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.rect(
        0.5,
        0.5,
        width - 1,
        height - 1
    );
    ctx.stroke();

    // Diagonal top-left -> bottom-right
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(width, height);
    ctx.stroke();

    // Diagonal top-right -> bottom-left
    ctx.beginPath();
    ctx.moveTo(width, 0);
    ctx.lineTo(0, height);
    ctx.stroke();

    // Vertical center
    ctx.beginPath();
    ctx.moveTo(width / 2, 0);
    ctx.lineTo(width / 2, height);
    ctx.stroke();

    // Horizontal center
    ctx.beginPath();
    ctx.moveTo(0, height / 2);
    ctx.lineTo(width, height / 2);
    ctx.stroke();
}


// ==========================================
// BUILD DRAWING BOARD
// ==========================================

function buildBoards() {
    const container =
        document.getElementById(
            'drawingBoardsContainer'
        );

    if (!container) {
        console.error(
            'Could not find #drawingBoardsContainer'
        );
        return;
    }

    container.innerHTML = '';

    const wrap = document.createElement('div');
    wrap.className = 'boardWrap';

    wrap.innerHTML = `
        <div class="drawingBoard"></div>

        <div class="feedbackBar">
            <div class="segment noob">Noob</div>
            <div class="segment familiar">Familiar</div>
            <div class="segment good">Good</div>
            <div class="segment expert">Expert</div>
        </div>

        <div class="recognitionResults"
             style="display: none;">
        </div>
    `;

    container.appendChild(wrap);

    const boardElem =
        wrap.querySelector('.drawingBoard');

    const recognitionResults =
        wrap.querySelector('.recognitionResults');

    if (!boardElem) {
        console.error(
            'Could not find .drawingBoard'
        );
        return;
    }

    const size = boardElem.clientWidth;

    if (size === 0) {
        console.warn(
            'Drawing board has width 0.'
        );
        return;
    }

    let startTime = null;

    const board = HanziLookup.DrawingBoard(
        $(boardElem),
        () => {
            const strokes =
                board.cloneStrokes();

            if (
                strokes.length === 1 &&
                startTime === null
            ) {
                startTime = performance.now();
            }

            updateRecognition(
                board,
                recognitionResults,
                wrap,
                startTime
            );
        }
    );

    // Create grid overlay
    const overlayCanvas =
        document.createElement('canvas');

    overlayCanvas.className = 'gridOverlay';

    overlayCanvas.width = size;
    overlayCanvas.height = size;

    overlayCanvas.style.width = '100%';
    overlayCanvas.style.height = '100%';

    overlayCanvas.style.position = 'absolute';
    overlayCanvas.style.top = '0';
    overlayCanvas.style.left = '0';

    overlayCanvas.style.pointerEvents = 'none';
    overlayCanvas.style.zIndex = '10';

    boardElem.appendChild(overlayCanvas);

    const overlayCtx =
        overlayCanvas.getContext('2d');

    drawGrid(
        overlayCtx,
        overlayCanvas.width,
        overlayCanvas.height
    );

    window._drawingBoard = board;
}


// ==========================================
// CHARACTER RECOGNITION
// ==========================================

function updateRecognition(
    board,
    resultElement,
    wrap,
    startTime
) {
    const analysed =
        new HanziLookup.AnalyzedCharacter(
            board.cloneStrokes()
        );

    new HanziLookup.Matcher('orig')
        .match(
            analysed,
            5,
            matches => {
                const bestMatch =
                    matches.length > 0
                        ? matches[0].character
                        : '';

                resultElement.textContent =
                    bestMatch;

                updateFeedbackBar(
                    board,
                    wrap,
                    bestMatch,
                    startTime
                );
            }
        );
}


// ==========================================
// FEEDBACK BAR
// ==========================================

function updateFeedbackBar(
    board,
    wrap,
    recognizedChar,
    startTime
) {
    const feedbackBar =
        wrap.querySelector('.feedbackBar');

    if (!feedbackBar) {
        return;
    }

    const expectedChar =
        window.targetCharacter;

    const correct =
        recognizedChar === expectedChar;

    const strokes =
        board.cloneStrokes().length;

    let elapsedTime = 0;

    if (startTime !== null) {
        elapsedTime =
            (performance.now() - startTime) /
            1000;
    }

    const avgTimePerStroke =
        strokes > 0
            ? elapsedTime / strokes
            : 0;

    let levelClass = 'noob';

    if (correct) {
        if (avgTimePerStroke <= 0.365) {
            levelClass = 'expert';
        } else if (avgTimePerStroke <= 0.5) {
            levelClass = 'good';
        } else {
            levelClass = 'familiar';
        }
    }

    feedbackBar
        .querySelectorAll('.segment')
        .forEach(segment => {
            segment.style.opacity = '0.5';
        });

    const selected =
        feedbackBar.querySelector(
            `.${levelClass}`
        );

    if (selected) {
        selected.style.opacity = '1';
    }
}


// ==========================================
// RESPONSIVE RESIZING
// ==========================================

window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);

    resizeTimer = setTimeout(() => {
        if (!window.targetCharacter) {
            return;
        }

        showExampleCharacter();
        buildBoards();

    }, 150);
});


// ==========================================
// NEXT CHARACTER BUTTON
// ==========================================

document.addEventListener(
    'DOMContentLoaded',
    () => {

        const nextButton =
            document.querySelector(
                '.cmdNextButton'
            );

        if (nextButton) {
            nextButton.addEventListener(
                'click',
                () => {
                    loadGivenHanzi();
                }
            );
        }
    }
);


// ==========================================
// INITIALISE HANZI LOOKUP
// ==========================================

document.addEventListener(
    'DOMContentLoaded',
    () => {

        HanziLookup.init(
            'orig',
            '/static/dist/orig.json',
            () => {
                loadGivenHanzi();
            }
        );

    }
);