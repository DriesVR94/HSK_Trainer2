// Choose between development or production
const isDev = false; // set to false before deploying

const START_LEVEL = Number(document.body.dataset.level) || 1;

// Characters that should use Google Cloud Vision instead of
// HanziLookup.
//
// Add additional difficult characters here later.
const PADDLE_OCR_CHARS = new Set([
    '天',
]);


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
    if (!ok) {
        filesToLoad = -1;
        return;
    }

    if (--filesToLoad === 0) {
        assetsLoaded = true;
        maybeInitBoards();
    }
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
function maybeInitBoards() {
    if (hanziLoaded && assetsLoaded) {
        loadRandomHanzi();
    }
}


function buildBoards() {

    const container = document.getElementById('drawingBoardsContainer');
    container.innerHTML = '';

    const chars = [...window.targetCharacter]
        .slice(0, window.targetHanziEntry.charCount);

    const count = window.targetHanziEntry.charCount;

    const totalWidth = 810;
    const gap = 20;
    const availableWidth = totalWidth - gap * (count - 1);

    let boxSize = Math.floor(availableWidth / count);
    boxSize = Math.max(150, Math.min(250, boxSize));

    const fontSize = Math.max(
        12,
        Math.min(20, boxSize / 12)
    );

    window._drawingBoards = [];


    chars.forEach((char, idx) => {

        const wrap = document.createElement('div');
        wrap.className = 'boardWrap';
        wrap.style.flex = `0 0 ${boxSize}px`;

        wrap.innerHTML = `
            <div class="drawingBoard"
                 style="height: ${boxSize}px; position: relative;">
                <div class="solutionAnimation"></div>
            </div>

            <div class="feedbackBar">
                <div class="segment noob">Noob</div>
                <div class="segment familiar">Familiar</div>
                <div class="segment good">Good</div>
                <div class="segment expert">Expert</div>
            </div>

            <div class="commands">
                <div class="cmd cmdUndo">
                    <i class="fa-solid fa-rotate-left"></i>
                </div>

                <div class="cmd cmdClear">
                    <i class="fa-solid fa-xmark"></i>
                </div>

                <div class="cmd cmdRecognize dev-only">
                    Recognize
                </div>
            </div>

            <button class="show_solution_button">
                Show solution
            </button>

            <h2 class="dev-only"
                style="font-size: ${fontSize - 2}px;">
                Original HanziLookup data
            </h2>

            <div class="charPicker hanziLookupChars dev-only"></div>

            <h2 class="dev-only"
                style="font-size: ${fontSize - 2}px;">
                Make Me a Hanzi data
            </h2>

            <div class="charPicker mmahLookupChars dev-only"></div>

            <h2 class="dev-only"
                style="font-size: ${fontSize - 2}px;">
                OCR Result
            </h2>

            <div class="ocrResultBox dev-only">…</div>

            <div class="strokeCounter dev-only">
                Strokes: 0
            </div>

            <div class="timeTaken dev-only">
                Time: 0.00s
            </div>
        `;


        container.appendChild(wrap);

        if (!isDev) {
            document
                .querySelectorAll('.dev-only')
                .forEach(el => el.style.display = 'none');
        }


        const boardElem =
            wrap.querySelector('.drawingBoard');

        const resOrig =
            wrap.querySelector('.hanziLookupChars');

        const resMMAH =
            wrap.querySelector('.mmahLookupChars');


        let strokeCount = 0;
        let startTime = null;
        let endTime = null;

        const strokeCounterElement =
            wrap.querySelector('.strokeCounter');

        const timeTakenElement =
            wrap.querySelector('.timeTaken');


        const maxStrokes =
            window.targetHanziEntry.strokeCounts?.[idx] || 999;


        const board = HanziLookup.DrawingBoard(
            $(boardElem),
            () => {

                strokeCount++;

                strokeCounterElement.textContent =
                    `Strokes: ${strokeCount}`;


                /*
                 * While drawing:
                 *
                 * Normal characters:
                 *     use HanziLookup.
                 *
                 * Cloud Vision characters:
                 *     DO NOT send an API request after every stroke.
                 *
                 * Vision is only called when the character is complete.
                 */
                if (!PADDLE_OCR_CHARS.has(char)) {
                    lookup(
                        board,
                        resOrig,
                        resMMAH,
                        idx
                    );
                }


                const strokes = board.cloneStrokes();


                if (strokeCount === 1) {
                    startTime = performance.now();
                    endTime = null;
                }


                /*
                 * Character finished.
                 */
                if (
                    strokes.length === maxStrokes &&
                    !board._ocrSent
                ) {

                    board._ocrSent = true;


                    // Calculate elapsed time
                    if (startTime && !endTime) {

                        endTime = performance.now();

                        const elapsed =
                            (endTime - startTime) / 1000;

                        timeTakenElement.textContent =
                            `Time: ${elapsed.toFixed(2)}s`;
                    }


                    /*
                     * This function decides which OCR system
                     * should be used.
                     */
                    updateFeedbackBarForBoard(
                        board,
                        wrap,
                        idx
                    );
                }
            }
        );


        // ---------------------------------------
        // Show solution
        // ---------------------------------------

        const solutionButton =
            wrap.querySelector('.show_solution_button');

        const solutionContainer =
            wrap.querySelector('.solutionAnimation');

        let writer = null;


        solutionButton.addEventListener('click', () => {

            solutionContainer.style.display = 'flex';

            solutionContainer.innerHTML = '';

            const charDiv =
                document.createElement('div');

            solutionContainer.appendChild(charDiv);


            writer = HanziWriter.create(
                charDiv,
                char,
                {
                    width: boxSize,
                    height: boxSize,
                    padding: 10,
                    strokeAnimationSpeed: 1,
                    delayBetweenLoops: 1000,
                    showOutline: true
                }
            );


            solutionContainer.onclick = () => {

                solutionContainer.style.display = 'none';
                solutionContainer.innerHTML = '';

            };


            writer.loopCharacterAnimation();

        });


        // ---------------------------------------
        // Grid overlay
        // ---------------------------------------

        const strokeCanvas =
            boardElem.querySelector('canvas');

        strokeCanvas.style.position = 'relative';


        const overlayCanvas =
            document.createElement('canvas');

        overlayCanvas.width =
            strokeCanvas.width;

        overlayCanvas.height =
            strokeCanvas.height;

        overlayCanvas.style.position =
            'absolute';

        overlayCanvas.style.top =
            '0';

        overlayCanvas.style.left =
            '0';

        overlayCanvas.style.pointerEvents =
            'none';


        boardElem.appendChild(overlayCanvas);


        const overlayCtx =
            overlayCanvas.getContext('2d');


        function drawGrid(ctx, w, h) {

            ctx.clearRect(0, 0, w, h);

            ctx.setLineDash([1, 1]);

            ctx.lineWidth = 0.5;

            ctx.strokeStyle = 'grey';


            // Border

            ctx.beginPath();

            ctx.moveTo(0, 0);
            ctx.lineTo(w, 0);
            ctx.lineTo(w, h);
            ctx.lineTo(0, h);
            ctx.lineTo(0, 0);

            ctx.stroke();


            // Diagonal 1

            ctx.beginPath();

            ctx.moveTo(0, 0);
            ctx.lineTo(w, h);

            ctx.stroke();


            // Diagonal 2

            ctx.beginPath();

            ctx.moveTo(w, 0);
            ctx.lineTo(0, h);

            ctx.stroke();


            // Vertical middle

            ctx.beginPath();

            ctx.moveTo(w / 2, 0);
            ctx.lineTo(w / 2, h);

            ctx.stroke();


            // Horizontal middle

            ctx.beginPath();

            ctx.moveTo(0, h / 2);
            ctx.lineTo(w, h / 2);

            ctx.stroke();

        }


        drawGrid(
            overlayCtx,
            overlayCanvas.width,
            overlayCanvas.height
        );


        // ---------------------------------------
        // Undo
        // ---------------------------------------

        wrap.querySelector('.cmdUndo').onclick = () => {

            board.undoStroke();
            board.redraw();


            if (!PADDLE_OCR_CHARS.has(char)) {

                lookup(
                    board,
                    resOrig,
                    resMMAH,
                    idx
                );

            }


            board._ocrSent = false;

            strokeCount =
                board.cloneStrokes().length;

            strokeCounterElement.textContent =
                `Strokes: ${strokeCount}`;

            startTime = null;
            endTime = null;

            timeTakenElement.textContent =
                `Time: 0.00s`;

        };


        // ---------------------------------------
        // Clear
        // ---------------------------------------

        wrap.querySelector('.cmdClear').onclick = () => {

            board.clearCanvas();
            board.redraw();

            board._ocrSent = false;

            strokeCount = 0;

            startTime = null;
            endTime = null;


            strokeCounterElement.textContent =
                `Strokes: 0`;

            timeTakenElement.textContent =
                `Time: 0.00s`;


            /*
             * Clear the HanziLookup displays.
             */
            resOrig.innerHTML = '';
            resMMAH.innerHTML = '';

            wrap.querySelector('.ocrResultBox')
                .textContent = '…';


            /*
             * Re-run lookup only for normal
             * HanziLookup characters.
             */
            if (!PADDLE_OCR_CHARS.has(char)) {

                lookup(
                    board,
                    resOrig,
                    resMMAH,
                    idx
                );

            }

        };


        // ---------------------------------------
        // Development recognize button
        // ---------------------------------------

        const recognizeButton =
            wrap.querySelector('.cmdRecognize');


        recognizeButton.onclick = async () => {

            const expectedChar =
                window.targetCharacter[idx];

            try {

                if (
                    PADDLE_OCR_CHARS.has(
                        expectedChar
                    )
                ) {

                    const result =
                        await recognizeWithPaddleOCR(
                            board
                        );

                    wrap
                        .querySelector('.ocrResultBox')
                        .textContent =
                            result || '—';

                }

                else {

                    lookup(
                        board,
                        resOrig,
                        resMMAH,
                        idx
                    );

                    const gotOrig =
                        resOrig
                            .querySelector('span')
                            ?.textContent || '';

                    const gotMMAH =
                        resMMAH
                            .querySelector('span')
                            ?.textContent || '';

                    wrap
                        .querySelector('.ocrResultBox')
                        .textContent =
                            `orig: ${gotOrig || '—'} | mmah: ${gotMMAH || '—'}`;
                }

                recognizeButton.style.backgroundColor =
                    '#a6e3a1';

                recognizeButton.style.color =
                    '#000';

            }

            catch (err) {

                console.error(err);

                alert('Failed to recognize.');

                recognizeButton.style.backgroundColor =
                    '#f28b82';

                recognizeButton.style.color =
                    '#000';
            }
        };


        window._drawingBoards.push(board);

    });

}


// ---------------------------------------
// Next word
// ---------------------------------------

document
    .querySelector('.cmdNextButton')
    .addEventListener('click', () => {

        loadRandomHanzi();

    });


// ---------------------------------------
// Feedback / proficiency
// ---------------------------------------

async function updateFeedbackBarForBoard(
    board,
    wrap,
    idx
) {

    const expectedChar =
        window.targetCharacter[idx];


    const resOrig =
        wrap.querySelector('.hanziLookupChars');

    const resMMAH =
        wrap.querySelector('.mmahLookupChars');

    const feedbackBar =
        wrap.querySelector('.feedbackBar');

    const timeTakenElement =
        wrap.querySelector('.timeTaken');


    let correct = false;


    /*
     * ==========================================
     * CLOUD VISION PATH
     * ==========================================
     *
     * If the expected character is in our
     * special list, Cloud Vision is the ONLY
     * recognition system used.
     */
    if (
        PADDLE_OCR_CHARS.has(
            expectedChar
        )
    ) {

        try {

            const result =
                await recognizeWithPaddleOCR(
                    board
                );


            // Show raw result in development mode
            wrap
                .querySelector('.ocrResultBox')
                .textContent =
                    result || '—';


            /*
             * Compare what Vision saw with
             * the character the user was
             * supposed to write.
             */
            correct =
                result === expectedChar;

        }

        catch (err) {

            console.error(
                'PaddleOCR failed:',
                err
            );


            wrap
                .querySelector('.ocrResultBox')
                .textContent =
                    'PaddleOCR error';


            correct = false;

        }

    }


    /*
     * ==========================================
     * HANZILOOKUP PATH
     * ==========================================
     */
    else {

        lookup(
            board,
            resOrig,
            resMMAH,
            idx
        );


        const gotOrig =
            resOrig
                .querySelector('span')
                ?.textContent || '';


        const gotMMAH =
            resMMAH
                .querySelector('span')
                ?.textContent || '';


        correct =
            gotOrig === expectedChar ||
            gotMMAH === expectedChar;

    }


    // ---------------------------------------
    // Timing
    // ---------------------------------------

    const timeText =
        timeTakenElement?.textContent || '';


    const match =
        timeText.match(/([\d.]+)s/);


    const elapsedTime =
        match
            ? parseFloat(match[1])
            : 0;


    const strokes =
        board.cloneStrokes().length;


    const avgTimePerStroke =
        strokes > 0
            ? elapsedTime / strokes
            : 0;


    // ---------------------------------------
    // Determine proficiency
    // ---------------------------------------

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


    let proficiencyValue = 0;


    if (levelClass === "familiar") {
        proficiencyValue = 1;
    }

    if (levelClass === "good") {
        proficiencyValue = 2;
    }

    if (levelClass === "expert") {
        proficiencyValue = 3;
    }


    sendProficiencyUpdate(
        window.targetHanziEntry.word_id,
        proficiencyValue
    );


    // ---------------------------------------
    // Feedback bar
    // ---------------------------------------

    feedbackBar
        .querySelectorAll('.segment')
        .forEach(seg => {

            seg.style.opacity = '0.5';

        });


    const highlightSegment =
        feedbackBar.querySelector(
            `.${levelClass}`
        );


    if (highlightSegment) {

        highlightSegment.style.opacity = '1';

    }

}


// ----- 4. lookup helpers -----


/*
 * Normal HanziLookup recognition.
 *
 * This is NOT used for characters listed in
 * PADDLE_OCR_CHARS.
 */

function lookup(
    board,
    elmOrig,
    elmMMAH,
    idx = null
) {

    const expectedChar =
        idx !== null
            ? window.targetCharacter[idx]
            : null;

    /*
     * PaddleOCR characters should not
     * accidentally go through HanziLookup.
     */
    if (
        expectedChar &&
        PADDLE_OCR_CHARS.has(expectedChar)
    ) {
        return;
    }

    const analysed =
        new HanziLookup.AnalyzedCharacter(
            board.cloneStrokes()
        );

    new HanziLookup.Matcher('orig')
        .match(
            analysed,
            5,
            m => show(elmOrig, m)
        );

    new HanziLookup.Matcher('mmah')
        .match(
            analysed,
            5,
            m => show(elmMMAH, m)
        );
}

/*
 * PaddleOCR recognition.
 *
 * The browser sends the completed canvas image
 * to the Flask backend, where PaddleOCR runs locally.
 */
async function recognizeWithPaddleOCR(board) {

    const dataUrl =
        board.exportImage();

    const response =
        await fetch(
            '/recognize_paddle',
            {
                method: 'POST',

                headers: {
                    'Content-Type':
                        'application/json'
                },

                body: JSON.stringify({
                    image: dataUrl
                })
            }
        );

    if (!response.ok) {

        throw new Error(
            `PaddleOCR request failed: ${response.status}`
        );

    }

    const data =
        await response.json();

    if (!data.success) {

        throw new Error(
            data.error ||
            'PaddleOCR recognition failed'
        );

    }

    return (data.result || '').trim();
}

function show(elm, matches) {

    elm.innerHTML =
        matches
            .map(
                o =>
                    `<span>${o.character}</span>`
            )
            .join('');

}


// ---------------------------------------
// Start
// ---------------------------------------

loadLevel(START_LEVEL);