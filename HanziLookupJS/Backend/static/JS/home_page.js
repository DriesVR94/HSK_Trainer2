document.addEventListener("DOMContentLoaded", () => {
const btnHSK2 = document.getElementById("btnHSK2");
const btnHSK3 = document.getElementById("btnHSK3");
const hsk2Section = document.querySelector(".HSK2_0");
const hsk3Section = document.querySelector(".HSK3_0");
const progressBar = document.getElementById("progressBar");

showHSK("2.0");

function showHSK(version) {
    if (version === "2.0") {
    hsk2Section.style.display = "block";
    hsk3Section.style.display = "none";
    btnHSK2.classList.add("active");
    btnHSK3.classList.remove("active");
    } else {
    hsk2Section.style.display = "none";
    hsk3Section.style.display = "block";
    btnHSK2.classList.remove("active");
    btnHSK3.classList.add("active");
    }
}

btnHSK2.addEventListener("click", () => showHSK("2.0"));
btnHSK3.addEventListener("click", () => showHSK("3.0"));

// existing behavior: set simple progress-bar-inner widths
document.querySelectorAll(".level-count").forEach((countDiv) => {
    const mastered = parseInt(countDiv.dataset.mastered) || 0;
    const total = parseInt(countDiv.dataset.total) || 0;
    const percent = total > 0 ? (mastered / total) * 100 : 0;

    const bar = countDiv.parentElement.querySelector(".progress-bar-inner");
    if (bar) {
    bar.style.width = percent + "%";
    }
});

// NEW: set segmented bars that were rendered server-side using data-* attributes
setSegmentedBarsFromDataset();
});


/** Fetch + render global segmented progress in #progressBar (already used) */
function loadProgress(level) {
fetch(`/get_progress?level=${level}`)
    .then(res => res.json())
    .then(data => {
    renderProgressBar(data);
    // If you also want to reflect fetched per-proficiency counts in ANY
    // server-rendered segmented bars, you could call setSegmentedBarsFromData(data)
    // but currently we keep server-rendered segmented-bars driven by data-* attrs.
    })
    .catch(err => console.error("Progress fetch failed:", err));
}

/** Renders the global progress widget (#progressBar) from fetch response (your existing fn) */
function renderProgressBar(progress) {
const bar = document.getElementById("progressBar");
bar.innerHTML = "";

const total = Number(progress.total) || 0;
if (total === 0) return;

// order left-to-right (expert first)
const order = ["expert", "good", "familiar", "noob"];
const colors = {
    expert: "#ee1c25",
    good: "#f03d46",
    familiar: "#f4676e",
    noob: "#f79297"
};

order.forEach(type => {
    const count = Number(progress[type]) || 0;
    if (count === 0) return;

    const seg = document.createElement("div");
    seg.style.width = ((count / total) * 100) + "%";
    seg.style.height = "100%";
    seg.style.display = "inline-block";
    seg.style.verticalAlign = "top";
    seg.style.backgroundColor = colors[type];
    bar.appendChild(seg);
});
}

/**
 * NEW FUNCTION:
 * Finds all elements with .segmented-bar and fills their .seg children
 * using the element's data-* attributes: data-expert, data-good, data-familiar, data-noob, data-total
 *
 * Expected HTML structure:
 * <div class="level-progress segmented-bar"
 *      data-total="40" data-expert="10" data-good="8" data-familiar="12" data-noob="10">
 *   <div class="seg expert"></div>
 *   <div class="seg good"></div>
 *   <div class="seg familiar"></div>
 *   <div class="seg noob"></div>
 * </div>
 */
function setSegmentedBarsFromDataset() {
document.querySelectorAll('.segmented-bar').forEach(bar => {
    const total = Number(bar.dataset.total) || 0;

    // prefer explicit dataset values; if missing, try reading inner counts (defensive)
    const expert = Number(bar.dataset.expert) || 0;
    const good = Number(bar.dataset.good) || 0;
    const familiar = Number(bar.dataset.familiar) || 0;
    const noob = Number(bar.dataset.noob) || 0;

    // if no .seg children exist but there are counts, create them
    const segMap = {
    expert: expert,
    good: good,
    familiar: familiar,
    noob: noob
    };

    // If total is zero but we have sum of parts, compute total from parts
    const sumParts = expert + good + familiar + noob;
    const effectiveTotal = total > 0 ? total : sumParts;

    // Ensure we have seg elements in expected order (expert, good, familiar, noob)
    const order = ['expert', 'good', 'familiar', 'noob'];
    order.forEach(key => {
    let seg = bar.querySelector('.seg.' + key);
    if (!seg) {
        seg = document.createElement('div');
        seg.className = 'seg ' + key;
        bar.appendChild(seg);
    }
    const count = segMap[key] || 0;
    const widthPct = effectiveTotal > 0 ? (count / effectiveTotal) * 100 : 0;
    seg.style.width = widthPct + '%';
    // make sure segment blocks are inline-flex children so width applies correctly
    seg.style.display = 'inline-block';
    seg.style.height = '100%';
    });
});
}

function addFloatingTooltips() {
const colors = {
expert: "#b1121b",
good: "#ee1c25",
familiar: "#f4676e",
noob: "#f9a1a6"
};

document.querySelectorAll(".level-progress").forEach(bar => {
bar.addEventListener("mouseenter", (e) => {
    // Remove any existing tooltip
    let existing = document.querySelector(".floating-tooltip");
    if (existing) existing.remove();

    // Create tooltip container
    const tooltip = document.createElement("div");
    tooltip.className = "floating-tooltip";
    tooltip.style.position = "absolute";
    tooltip.style.background = "#fff";
    tooltip.style.border = "1px solid #ccc";
    tooltip.style.padding = "6px 10px";
    tooltip.style.borderRadius = "4px";
    tooltip.style.boxShadow = "0 2px 8px rgba(0,0,0,0.2)";
    tooltip.style.zIndex = "1000";

    // Build tooltip content
    const ul = document.createElement("ul");
    ul.style.listStyle = "none";
    ul.style.margin = 0;
    ul.style.padding = 0;

    const total = Number(bar.dataset.total) || 0;

    const header = document.createElement("div");
    header.textContent = `Total: ${total} words`;
    header.style.fontWeight = "600";
    header.style.marginBottom = "6px";

    tooltip.appendChild(header);

        const labels = {
    expert: "Expert",
    good: "Good",
    familiar: "Familiar",
    noob: "Noob"
    };

    ["expert", "good", "familiar", "noob"].forEach(level => {
    const count = Number(bar.dataset[level]) || 0;

    const li = document.createElement("li");
    li.style.display = "flex";
    li.style.alignItems = "center";
    li.style.justifyContent = "space-between";
    li.style.gap = "8px";
    li.style.marginBottom = "4px";

    // Left side (color + label)
    const left = document.createElement("div");
    left.style.display = "flex";
    left.style.alignItems = "center";
    left.style.gap = "6px";

    const square = document.createElement("span");
    square.style.width = "12px";
    square.style.height = "12px";
    square.style.backgroundColor = colors[level];

    const label = document.createElement("span");
    label.textContent = labels[level];

    left.appendChild(square);
    left.appendChild(label);

    // Right side (count)
    const right = document.createElement("span");
    right.textContent = count;

    li.appendChild(left);
    li.appendChild(right);

    ul.appendChild(li);
    });

    tooltip.appendChild(ul);
    document.body.appendChild(tooltip);

    // Position the tooltip relative to the bar
    const rect = bar.getBoundingClientRect();
    tooltip.style.left = `${e.pageX + 10}px`;
    tooltip.style.top = `${e.pageY + 10}px`;
});

bar.addEventListener("mousemove", (e) => {
    const tooltip = document.querySelector(".floating-tooltip");
    if (!tooltip) return;

    tooltip.style.left = `${e.pageX + 10}px`;
    tooltip.style.top = `${e.pageY + 10}px`;
});

bar.addEventListener("mouseleave", () => {
    const tooltip = document.querySelector(".floating-tooltip");
    if (tooltip) tooltip.remove();
});
});
}

// Call after DOM content loaded
document.addEventListener("DOMContentLoaded", addFloatingTooltips);