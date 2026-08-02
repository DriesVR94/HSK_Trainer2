const boxes = document.querySelectorAll('.pricing_boxes div');

boxes.forEach(box => {
    box.addEventListener('click', () => {
    boxes.forEach(b => b.classList.remove('selected')); // Remove from all
    box.classList.add('selected'); // Add to clicked one
    });
});