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
    { chinese: "水", pinyin: "shuǐ", english: "Water", strokeCount: 4 },
    { chinese: "火", pinyin: "huǒ", english: "Fire", strokeCount: 4 },
    { chinese: "山", pinyin: "shān", english: "Mountain", strokeCount: 3 },
    { chinese: "气", pinyin: "qì", english: "Air", strokeCount: 4 },
    { chinese: "土", pinyin: "tǔ", english: "Earth", strokeCount: 3 },
    { chinese: "人", pinyin: "rén", english: "Person", strokeCount: 2 },
    { chinese: "龙", pinyin: "lóng", english: "Dragon", strokeCount: 5 },
    { chinese: "月", pinyin: "yuè", english: "Moon", strokeCount: 4 },
    { chinese: "八", pinyin: "bā", english: "Eight", strokeCount: 2 },
    { chinese: "米", pinyin: "mǐ", english: "Rice", strokeCount: 6 },
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

            <div class="commands">
                <div class="cmd cmdClear">
                    <i class="fa-solid fa-xmark"></i>
                </div>
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
    let endTime = null;

    const maxStrokes =
        window.targetHanziEntry.strokeCount;

    const board = HanziLookup.DrawingBoard(
        $(boardElem),
        () => {
            const strokes =
                board.cloneStrokes();

            // Start timer after first stroke
            if (
                strokes.length === 1 &&
                startTime === null
            ) {
                startTime = performance.now();
                endTime = null;
            }

            // Character is complete
            if (
                strokes.length === maxStrokes &&
                !board._feedbackSent
            ) {
                board._feedbackSent = true;

                endTime = performance.now();

                const elapsedTime =
                    startTime !== null
                        ? (endTime - startTime) / 1000
                        : 0;

                updateRecognition(
                    board,
                    recognitionResults,
                    wrap,
                    elapsedTime
                );
            }
        }
    );

    const clearButton =
        wrap.querySelector('.cmdClear');

    clearButton.addEventListener('click', () => {
        board.clearCanvas();
        board.redraw();

        // Allow feedback to be calculated again
        board._feedbackSent = false;

        // Restart timing
        startTime = null;
        endTime = null;

        // Reset feedback bar
        wrap.querySelectorAll(
            '.feedbackBar .segment'
        ).forEach(segment => {
            segment.style.opacity = '0.5';
            segment.classList.remove('highlight');
        });

        // Clear hidden recognition result
        recognitionResults.textContent = '';
    });

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
    elapsedTime
) {
    const analysed =
        new HanziLookup.AnalyzedCharacter(
            board.cloneStrokes()
        );

    let origResult = '';
    let mmahResult = '';

    let origFinished = false;
    let mmahFinished = false;

    function checkResults() {
        if (!origFinished || !mmahFinished) {
            return;
        }

        const expectedChar =
            window.targetCharacter;

        const recognizedCorrectly =
            origResult === expectedChar ||
            mmahResult === expectedChar;

        resultElement.textContent =
            `orig: ${origResult || '—'} | mmah: ${mmahResult || '—'}`;

        updateFeedbackBar(
            board,
            wrap,
            recognizedCorrectly,
            elapsedTime
        );
    }

    // Original HanziLookup dataset
    new HanziLookup.Matcher('orig')
        .match(
            analysed,
            5,
            matches => {
                origResult =
                    matches.length > 0
                        ? matches[0].character
                        : '';

                origFinished = true;

                checkResults();
            }
        );

    // Make Me a Hanzi dataset
    new HanziLookup.Matcher('mmah')
        .match(
            analysed,
            5,
            matches => {
                mmahResult =
                    matches.length > 0
                        ? matches[0].character
                        : '';

                mmahFinished = true;

                checkResults();
            }
        );
}


// ==========================================
// FEEDBACK BAR
// ==========================================

function updateFeedbackBar(
    board,
    wrap,
    correct,
    elapsedTime
) {
    const feedbackBar =
        wrap.querySelector('.feedbackBar');

    if (!feedbackBar) {
        return;
    }

    const strokes =
        board.cloneStrokes().length;

    const avgTimePerStroke =
        strokes > 0
            ? elapsedTime / strokes
            : 0;

    let levelClass = 'noob';

    if (correct) {
        if (avgTimePerStroke <= 0.365) {
            levelClass = 'expert';
        }
        else if (avgTimePerStroke <= 0.5) {
            levelClass = 'good';
        }
        else {
            levelClass = 'familiar';
        }
    }

    feedbackBar
        .querySelectorAll('.segment')
        .forEach(segment => {
            segment.style.opacity = '0.5';
            segment.classList.remove('highlight');
        });

    const selected =
        feedbackBar.querySelector(
            `.${levelClass}`
        );

    if (selected) {
        selected.style.opacity = '1';
        selected.classList.add('highlight');
    }

    console.log({
        expected: window.targetCharacter,
        correct,
        elapsedTime,
        strokes,
        avgTimePerStroke,
        levelClass
    });
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

        let filesLoaded = 0;

        function lookupFileLoaded(ok) {
            if (!ok) {
                console.error(
                    'Failed to load HanziLookup data.'
                );
                return;
            }

            filesLoaded++;

            if (filesLoaded === 2) {
                loadGivenHanzi();
            }
        }

        HanziLookup.init(
            'orig',
            '/static/dist/orig.json',
            lookupFileLoaded
        );

        HanziLookup.init(
            'mmah',
            '/static/dist/mmah.json',
            lookupFileLoaded
        );
    }
);