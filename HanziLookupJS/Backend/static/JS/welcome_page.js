const boxes = document.querySelectorAll('.pricing_boxes div');

boxes.forEach(box => {
    box.addEventListener('click', () => {
    boxes.forEach(b => b.classList.remove('selected')); // Remove from all
    box.classList.add('selected'); // Add to clicked one
    });
});

let hanziList = [
    { chinese: "水", pinyin: "shuǐ", english: "water" },
    { chinese: "火", pinyin: "huǒ", english: "fire" },
    { chinese: "山", pinyin: "shān", english: "mountain" }
];

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

  window.targetHanziEntry = randomEntry;
  window.targetCharacter = randomEntry.chinese;

  showExampleCharacter();
  buildBoards();
}

function showExampleCharacter() {
  const container = document.getElementById('character-target-div');
  container.innerHTML = '';

  const chars = Array.from(window.targetCharacter);

  // Put character boxes next to each other
  container.style.width = 'auto';
  container.style.height = 'auto';
  container.style.display = 'flex';
  container.style.flexDirection = 'row';
  container.style.gap = '10px';
  container.style.justifyContent = 'center';

  chars.forEach(char => {
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

    const writer = HanziWriter.create(charBox, char, {
      width: charBox.clientWidth,
      height: charBox.clientHeight,
      padding: 5,
      strokeAnimationSpeed: 1,
      delayBetweenLoops: 3000
    });

    writer.loopCharacterAnimation();
  });
}

function buildBoards() {
  const container = document.getElementById('drawingBoardsContainer');
  container.innerHTML = '';

  container.style.display = 'flex';
  container.style.justifyContent = 'center';

  const boardElem = document.createElement('div');
  boardElem.className = 'drawingBoard';
  boardElem.style.width = 'var(--char-box-size)';
  boardElem.style.height = 'var(--char-box-size)';
  boardElem.style.position = 'relative';

  container.appendChild(boardElem);

  const board = HanziLookup.DrawingBoard($(boardElem), () => {
    // Optional: handle completed drawing
    // lookup(board);
  });

  window._drawingBoards = [board];

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
            loadRandomHanzi();
        }
    );

});