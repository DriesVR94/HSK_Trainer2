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
    { chinese: "水", pinyin: "shuǐ", english: "water" },
    { chinese: "火", pinyin: "huǒ", english: "fire" },
    { chinese: "山", pinyin: "shān", english: "mountain" }
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

    // Stop previous animation if one exists
    if (exampleWriter) {
        try {
            exampleWriter.cancelQuiz();
            exampleWriter.pauseAnimation();
        } catch (error) {
            // Ignore if these methods aren't currently active
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

    ctx.setLineDash([4, 4]);
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'grey';

    // Outer border
    ctx.beginPath();
    ctx.rect(
        0.5,
        0.5,
        width - 1,
        height - 1
    );
    ctx.stroke();

    // Diagonal top-left -> bottom-right
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
            <div class="segment noob">
                Noob
            </div>

            <div class="segment familiar">
                Familiar
            </div>

            <div class="segment good">
                Good
            </div>

            <div class="segment expert">
                Expert
            </div>
        </div>
    `;

    container.appendChild(wrap);

    const boardElem =
        wrap.querySelector('.drawingBoard');

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

    // Create drawing board
    const board = HanziLookup.DrawingBoard(
        $(boardElem),
        () => {
            // Drawing completed
        }
    );

    // Create grid overlay
    const overlayCanvas =
        document.createElement('canvas');

    overlayCanvas.className = 'gridOverlay';

    /*
     * Canvas internal dimensions
     */
    overlayCanvas.width = size;
    overlayCanvas.height = size;

    /*
     * Canvas displayed dimensions
     */
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
// RESPONSIVE RESIZING
// ==========================================

window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);

    /*
     * Wait until resizing has stopped briefly
     * before rebuilding everything.
     */
    resizeTimer = setTimeout(() => {
        if (!window.targetCharacter) {
            return;
        }

        showExampleCharacter();
        buildBoards();

    }, 150);
});


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