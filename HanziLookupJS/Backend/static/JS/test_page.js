// Choose between development or production
const isDev = false; // set to false before deploying

const START_LEVEL = Number(document.body.dataset.level) || 1;

// ----- 1.  fetch random HSK character -----
let hanziLoaded = false, assetsLoaded = false;
let hanziList = [];

function loadRandomHanzi() {
const randomEntry = hanziList[Math.floor(Math.random() * hanziList.length)];

document.querySelector('.targetCharBox').innerHTML = `
    <strong style="font-size: clamp(14px, 1.8vw, 35px)">
    ${randomEntry.english}
    </strong>
    <span style="font-size: clamp(12px, 1.5vw, 25px); font-style: italic;">
    ${randomEntry.pinyin}
    </span>
`;

// Store globally
window.targetHanziEntry = randomEntry;
window.targetCharacter = randomEntry.chinese;

buildBoards();
}

// ---- Sends proficiency update to backend ----
function sendProficiencyUpdate(word_id, proficiency) {
fetch("/update_proficiency", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
    word_id: word_id,
    proficiency: proficiency
    })
})
.then(r => r.json())
.then(data => {
    if (!data.success) {
    console.error("Update failed:", data.message);
    }
})
.catch(err => console.error("Error updating proficiency:", err));
}

// ----- 2.  load HanziLookup data files -----
let filesToLoad = 2;
function fileLoaded(ok) {
    if (!ok) { filesToLoad = -1; return; }
    if (--filesToLoad === 0) { assetsLoaded = true; maybeInitBoards(); }
}

function loadLevel(level) {
    hanziLoaded = false;
    document.querySelector('.targetCharBox').innerText = "loading…";

    fetch(`/get_vocabulary?level=${level}`)
    .then(r => r.json())
    .then(data => {
        hanziList = data;
        hanziLoaded = true;
        maybeInitBoards();
    })
    .catch(err => {
        console.error(err);
        document.querySelector('.targetCharBox').innerText = "⚠️ load error";
    });
}

HanziLookup.init('mmah', "/static/dist/mmah.json", fileLoaded);
HanziLookup.init('orig', "/static/dist/orig.json", fileLoaded);

// ----- 3.  create boards when BOTH kinds of data are ready -----
function maybeInitBoards() { if (hanziLoaded && assetsLoaded) loadRandomHanzi(); }

function buildBoards() {
    const container = document.getElementById('drawingBoardsContainer');
    container.innerHTML = '';

    const chars = [...window.targetCharacter].slice(0, window.targetHanziEntry.charCount);
    const count = window.targetHanziEntry.charCount;

    const totalWidth = 810;    // matches .colLeft width
    const gap = 20;            // match CSS gap
    const availableWidth = totalWidth - gap * (count - 1);
    let boxSize = Math.floor(availableWidth / count);
    boxSize = Math.max(150, Math.min(250, boxSize));  // clamp between 150–250

    const fontSize = Math.max(12, Math.min(20, boxSize / 12)); // adaptive font

    window._drawingBoards = [];

    chars.forEach((char, idx) => {
    const wrap = document.createElement('div');
    wrap.className = 'boardWrap';
    wrap.style.flex = `0 0 ${boxSize}px`;

    wrap.innerHTML = `
        <div class="drawingBoard" style="height: ${boxSize}px; position: relative;">
        <div class="solutionAnimation"></div>
        </div>
        <div class="feedbackBar">
        <div class="segment noob">Noob</div>
        <div class="segment familiar">Familiar</div>
        <div class="segment good">Good</div>
        <div class="segment expert">Expert</div>
        </div>
        
        <div class="commands">
        <div class="cmd cmdUndo"><i class="fa-solid fa-rotate-left"></i></div>
        <div class="cmd cmdClear"><i class="fa-solid fa-xmark"></i></div>
        <div class="cmd cmdRecognize dev-only">Recognize</div>
        </div>
        <button class="show_solution_button">Show solution</button>
        <h2 class= "dev-only" style="font-size: ${fontSize - 2}px;">Original HanziLookup data</h2>
        <div class="charPicker hanziLookupChars dev-only"></div>
        <h2 class= "dev-only" style="font-size: ${fontSize - 2}px;">Make Me a Hanzi data</h2>
        <div class="charPicker mmahLookupChars dev-only"></div>
        <h2 class= "dev-only" style="font-size: ${fontSize - 2}px;">OCR Result</h2>
        <div class="ocrResultBox dev-only">…</div>
        <div class="strokeCounter dev-only">Strokes: 0</div>
        <div class="timeTaken dev-only">Time: 0.00s</div>
    `;
    

    container.appendChild(wrap);
    if (!isDev) {document.querySelectorAll('.dev-only').forEach(el => el.style.display = 'none');}

    const boardElem = wrap.querySelector('.drawingBoard');
    const resOrig = wrap.querySelector('.hanziLookupChars');
    const resMMAH = wrap.querySelector('.mmahLookupChars');

    let strokeCount = 0;
    let startTime = null;
    let endTime = null;
    const strokeCounterElement = wrap.querySelector('.strokeCounter'); 
    const timeTakenElement = wrap.querySelector('.timeTaken'); 

    const maxStrokes = window.targetHanziEntry.strokeCounts?.[idx] || 999;

    const board = HanziLookup.DrawingBoard($(boardElem), () => {
        strokeCount++;
        strokeCounterElement.textContent = `Strokes: ${strokeCount}`;

        lookup(board, resOrig, resMMAH);

        const strokes = board.cloneStrokes();

        if (strokeCount === 1) {
        startTime = performance.now();
        endTime = null;
    }

    if (strokes.length === maxStrokes && !board._ocrSent) {
        board._ocrSent = true;

        // Calculate and display elapsed time
        if (startTime && !endTime) {
        endTime = performance.now();
        const elapsed = (endTime - startTime) / 1000;
        timeTakenElement.textContent = `Time: ${elapsed.toFixed(2)}s`;
        }


        updateFeedbackBarForBoard(board,wrap,idx);

    }
    });

    const solutionButton = wrap.querySelector('.show_solution_button');
    const solutionContainer = wrap.querySelector('.solutionAnimation');

    let writer = null;

    solutionButton.addEventListener('click', () => {
    solutionContainer.style.display = 'flex';

    // Clear previous animation
    solutionContainer.innerHTML = '';

    const charDiv = document.createElement('div');
    solutionContainer.appendChild(charDiv);

    // 👉 FIXED CHARACTER for now
    writer = HanziWriter.create(charDiv, char, {
        width: boxSize,
        height: boxSize,
        padding: 10,
        strokeAnimationSpeed: 1,
        delayBetweenLoops: 1000,
        showOutline: true
    });

    solutionContainer.onclick = () => {
    solutionContainer.style.display = 'none';
    solutionContainer.innerHTML = '';
    };

    writer.loopCharacterAnimation();
    });


    // ---- NEW: Create overlay canvas for the grid ----
    // HanziLookup.DrawingBoard creates a canvas inside boardElem
    // Find that canvas:
    const strokeCanvas = boardElem.querySelector('canvas');
    strokeCanvas.style.position = 'relative'; // ensure baseline

    // Create overlay canvas element
    const overlayCanvas = document.createElement('canvas');
    overlayCanvas.width = strokeCanvas.width;
    overlayCanvas.height = strokeCanvas.height;
    overlayCanvas.style.position = 'absolute';
    overlayCanvas.style.top = '0';
    overlayCanvas.style.left = '0';
    overlayCanvas.style.pointerEvents = 'none'; // so pointer events go to strokeCanvas
    boardElem.appendChild(overlayCanvas);

    const overlayCtx = overlayCanvas.getContext('2d');

    // Function to draw the grid lines on overlay canvas
    function drawGrid(ctx, w, h) {
        ctx.clearRect(0, 0, w, h);
        ctx.setLineDash([1, 1]);
        ctx.lineWidth = 0.5;
        ctx.strokeStyle = 'grey';

        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(w, 0);
        ctx.lineTo(w, h);
        ctx.lineTo(0, h);
        ctx.lineTo(0, 0);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(w, h);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(w, 0);
        ctx.lineTo(0, h);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(w / 2, 0);
        ctx.lineTo(w / 2, h);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(0, h / 2);
        ctx.lineTo(w, h / 2);
        ctx.stroke();
    }

    drawGrid(overlayCtx, overlayCanvas.width, overlayCanvas.height);

    // ---- Buttons handlers (undo, clear, recognize) ----
    wrap.querySelector('.cmdUndo').onclick = () => {
    board.undoStroke();
    board.redraw();
    lookup(board, resOrig, resMMAH);

    board._ocrSent = false;
    strokeCount = board.cloneStrokes().length;
    strokeCounterElement.textContent = `Strokes: ${strokeCount}`;
    startTime = null;
    endTime = null;
    timeTakenElement.textContent = `Time: 0.00s`;
    };

    wrap.querySelector('.cmdClear').onclick = () => {
    board.clearCanvas();
    board.redraw();

    board._ocrSent = false;
    strokeCount = 0;
    startTime = null;
    endTime = null;

    strokeCounterElement.textContent = `Strokes: 0`;
    timeTakenElement.textContent = `Time: 0.00s`;

    lookup(board, resOrig, resMMAH);
    };


    const recognizeButton = wrap.querySelector('.cmdRecognize');
    recognizeButton.onclick = () => {
        lookup(board, resOrig, resMMAH);

        const dataUrl = board.exportImage();

        fetch('/recognize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: dataUrl }),
        })
        .then(res => {
            if (!res.ok) throw new Error('Failed to fetch');
            return res.json();
        })
        .then(data => {
            wrap.querySelector('.ocrResultBox').textContent = data.result;
            recognizeButton.style.backgroundColor = '#a6e3a1'; // green
            recognizeButton.style.color = '#000';
        })
        .catch(err => {
            console.error(err);
            alert('Failed to recognize.');
            recognizeButton.style.backgroundColor = '#f28b82'; // red
            recognizeButton.style.color = '#000';
        });
    };

    window._drawingBoards.push(board);
    });
}

document.querySelector('.cmdNextButton').addEventListener('click', () => {
    loadRandomHanzi();
});


function updateFeedbackBarForBoard(board, wrap, idx) {
    const expectedChar = window.targetCharacter[idx];
    const resOrig = wrap.querySelector('.hanziLookupChars');
    const resMMAH = wrap.querySelector('.mmahLookupChars');
    const feedbackBar = wrap.querySelector('.feedbackBar');
    const timeTakenElement = wrap.querySelector('.timeTaken');

    lookup(board, resOrig, resMMAH);

    const gotOrig = resOrig.querySelector('span')?.textContent || '';
    const gotMMAH = resMMAH.querySelector('span')?.textContent || '';
    const correct = gotOrig === expectedChar || gotMMAH === expectedChar;

    // Get elapsed time from DOM
    const timeText = timeTakenElement?.textContent || '';
    const match = timeText.match(/([\d.]+)s/);
    const elapsedTime = match ? parseFloat(match[1]) : 0;

    // Calculate average time per stroke
    const strokes = board.cloneStrokes().length;
    const avgTimePerStroke = strokes > 0 ? elapsedTime / strokes : 0;

    // Determine level class
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

    let proficiencyValue = 0;
    if (levelClass === "familiar") proficiencyValue = 1;
    if (levelClass === "good") proficiencyValue = 2;
    if (levelClass === "expert") proficiencyValue = 3;

    sendProficiencyUpdate(window.targetHanziEntry.word_id, proficiencyValue);


    // Reset all segments opacity
    feedbackBar.querySelectorAll('.segment').forEach(seg => {
    seg.style.opacity = '0.5';
    });

    // Highlight the correct segment
    const highlightSegment = feedbackBar.querySelector(`.${levelClass}`);
    if (highlightSegment) {
    highlightSegment.style.opacity = '1';
    }
}

// ----- 4.  lookup helpers -----
function lookup(board, elmOrig, elmMMAH) {
    const analysed = new HanziLookup.AnalyzedCharacter(board.cloneStrokes());
    new HanziLookup.Matcher('orig').match(analysed, 5, m => show(elmOrig, m));
    new HanziLookup.Matcher('mmah').match(analysed, 5, m => show(elmMMAH, m));
}
function show(elm, matches) {
    elm.innerHTML = matches.map(o => `<span>${o.character}</span>`).join('');
}

loadLevel(START_LEVEL);