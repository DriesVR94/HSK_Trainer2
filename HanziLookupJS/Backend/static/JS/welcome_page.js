const boxes = document.querySelectorAll('.pricing_boxes div');

boxes.forEach(box => {
    box.addEventListener('click', () => {
    boxes.forEach(b => b.classList.remove('selected')); // Remove from all
    box.classList.add('selected'); // Add to clicked one
    });
});

let givenHanzi = [
    { chinese: "水", pinyin: "shuǐ", english: "water" },
    { chinese: "火", pinyin: "huǒ", english: "fire" },
    { chinese: "山", pinyin: "shān", english: "mountain" }
];

function loadGivenHanzi() {
  const randomEntry = givenHanzi[Math.floor(Math.random() * givenHanzi.length)];

  document.querySelector('.targetCharBox').innerHTML = `
    <strong>${randomEntry.english}</strong>
    <span>${randomEntry.pinyin}</span>
  `;

  window.targetHanziEntry = randomEntry;
  window.targetCharacter = randomEntry.chinese;

  showExampleCharacter();
  buildBoards();
}

function showExampleCharacter() {
  const container = document.getElementById('character-target-div');
  container.innerHTML = '';

  container.style.display = 'flex';
  container.style.justifyContent = 'center';

  const charBox = document.createElement('div');
  charBox.style.width = 'var(--char-box-size)';
  charBox.style.height = 'var(--char-box-size)';
  charBox.style.backgroundColor = '#fafafa';
  charBox.style.border = '3px solid #ee1c25';
  charBox.style.borderRadius = '12px';
  charBox.style.display = 'flex';
  charBox.style.justifyContent = 'center';
  charBox.style.alignItems = 'center';

  container.appendChild(charBox);

  const writer = HanziWriter.create(charBox, window.targetCharacter, {
    width: charBox.clientWidth,
    height: charBox.clientHeight,
    padding: 5,
    strokeAnimationSpeed: 1,
    delayBetweenLoops: 3000
  });

  writer.loopCharacterAnimation();
}

function buildBoards() {
  const container = document.getElementById('drawingBoardsContainer');
  container.innerHTML = '';

  const wrap = document.createElement('div');
  wrap.className = 'boardWrap';

  wrap.innerHTML = `
    <div class="drawingBoard" 
      style="
        width: var(--char-box-size);
        height: var(--char-box-size);
        position: relative;
      ">
    </div>

    <div class="feedbackBar">
      <div class="segment noob">Noob</div>
      <div class="segment familiar">Familiar</div>
      <div class="segment good">Good</div>
      <div class="segment expert">Expert</div>
    </div>
  `;

  container.appendChild(wrap);

  const boardElem = wrap.querySelector('.drawingBoard');


  const board = HanziLookup.DrawingBoard($(boardElem), () => {
    // Drawing completed
  });


  // ---- GRID OVERLAY (copied from working version) ----

  const overlayCanvas = document.createElement('canvas');

  const size = boardElem.clientWidth;

  overlayCanvas.width = size;
  overlayCanvas.height = size;

  overlayCanvas.style.width = `${size}px`;
  overlayCanvas.style.height = `${size}px`;

  overlayCanvas.style.position = 'absolute';
  overlayCanvas.style.top = '0';
  overlayCanvas.style.left = '0';
  overlayCanvas.style.pointerEvents = 'none';

  boardElem.appendChild(overlayCanvas);


  const overlayCtx = overlayCanvas.getContext('2d');


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


  drawGrid(
    overlayCtx,
    overlayCanvas.width,
    overlayCanvas.height
  );


  window._drawingBoard = board;
}

function addGridOverlay(boardElem) {
  const strokeCanvas = boardElem.querySelector('canvas');
  if (!strokeCanvas) return;

  const overlayCanvas = document.createElement('canvas');

  // Use the actual displayed board size
  const size = boardElem.clientWidth;

  overlayCanvas.width = size;
  overlayCanvas.height = size;

  overlayCanvas.style.position = 'absolute';
  overlayCanvas.style.top = '0';
  overlayCanvas.style.left = '0';
  overlayCanvas.style.width = `${size}px`;
  overlayCanvas.style.height = `${size}px`;
  overlayCanvas.style.pointerEvents = 'none';
  overlayCanvas.style.zIndex = '10';

  boardElem.appendChild(overlayCanvas);

  const ctx = overlayCanvas.getContext('2d');

  drawGrid(ctx, size, size);
}


document.addEventListener("DOMContentLoaded", () => {

    HanziLookup.init(
        'orig',
        "/static/dist/orig.json",
        () => {
            loadGivenHanzi();
        }
    );

});