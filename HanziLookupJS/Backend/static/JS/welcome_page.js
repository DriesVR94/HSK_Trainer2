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

  const boardElem = document.createElement('div');
  boardElem.className = 'drawingBoard';

  boardElem.style.width = 'var(--char-box-size)';
  boardElem.style.height = 'var(--char-box-size)';
  boardElem.style.position = 'relative';

  wrap.appendChild(boardElem);

  wrap.innerHTML = `
        <div class="drawingBoard" 
        style="width: var(--char-box-size); 
        height: var(--char-box-size); 
        position: relative;">
        <div class="solutionAnimation"></div>
        </div>
        <div class="feedbackBar">
        <div class="segment noob">Noob</div>
        <div class="segment familiar">Familiar</div>
        <div class="segment good">Good</div>
        <div class="segment expert">Expert</div>
        </div>
    `;

  container.appendChild(wrap);

  const board = HanziLookup.DrawingBoard($(boardElem), () => {
    // Drawing completed
    // lookup(board);  // enable later if needed
  });

  requestAnimationFrame(() => {
    const canvas = boardElem.querySelector('canvas');

    if (canvas) {
      const size = boardElem.clientWidth;

      canvas.width = size;
      canvas.height = size;
      canvas.style.width = `${size}px`;
      canvas.style.height = `${size}px`;
    }

    addGridOverlay(boardElem);
  });

  // Optional: keep reference for later reset/clear functionality
  window._drawingBoard = board;
}

function addGridOverlay(boardElem) {
  const canvas = boardElem.querySelector('canvas');
  if (!canvas) return;

  const overlay = document.createElement('canvas');
  overlay.width = canvas.width;
  overlay.height = canvas.height;

  overlay.style.position = 'absolute';
  overlay.style.top = 0;
  overlay.style.left = 0;
  overlay.style.width = canvas.style.width;
  overlay.style.height = canvas.style.height;
  overlay.style.pointerEvents = 'none';
  overlay.style.zIndex = 10;

  boardElem.appendChild(overlay);

  const ctx = overlay.getContext('2d');
  drawGrid(ctx, overlay.width, overlay.height);
}

function drawGrid(ctx, w, h) {
  ctx.clearRect(0, 0, w, h);
  ctx.strokeStyle = "#ddd";
  ctx.lineWidth = 1;

  const step = w / 4;

  for (let i = 1; i < 4; i++) {
    ctx.beginPath();
    ctx.moveTo(step * i, 0);
    ctx.lineTo(step * i, h);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(0, step * i);
    ctx.lineTo(w, step * i);
    ctx.stroke();
  }
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