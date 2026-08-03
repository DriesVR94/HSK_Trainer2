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

  container.style.display = 'flex';
  container.style.flexDirection = 'row';
  container.style.flexWrap = 'wrap';
  container.style.justifyContent = 'center';
  container.style.gap = '20px';
  container.style.width = '100%';
  container.style.maxWidth = '1400px';
  container.style.margin = '0 auto';

  window._drawingBoards = [];

  // Keep the character section because the layout/CSS depends on it.
  const charSection = document.createElement('div');
  charSection.className = 'characterPracticeSection';
  charSection.style.width = '100%';
  charSection.style.gap = '16px';
  charSection.style.justifyContent = 'center';
  charSection.style.maxWidth = '1400px';
  charSection.style.margin = '0 auto';

  container.appendChild(charSection);

  // Create a single drawing board.
  const wrap = document.createElement('div');
  wrap.className = 'boardWrap';

  const inner = document.createElement('div');
  inner.className = 'drawingBoard';
  inner.style.width = 'var(--char-box-size)';
  inner.style.height = 'var(--char-box-size)';
  inner.style.position = 'relative';

  wrap.appendChild(inner);
  charSection.appendChild(wrap);

  const board = HanziLookup.DrawingBoard($(inner), () => {
    // lookup(board);
  });

  window._drawingBoards.push(board);

  requestAnimationFrame(() => {
    const canvas = inner.querySelector('canvas');

    if (canvas) {
      const size = inner.clientWidth;

      canvas.width = size;
      canvas.height = size;
      canvas.style.width = `${size}px`;
      canvas.style.height = `${size}px`;
    }

    addGridOverlay(inner);
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