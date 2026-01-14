// Minimal draft app logic
const playersFile = document.getElementById('playersFile');
const coachesFile = document.getElementById('coachesFile');
const loadSamples = document.getElementById('loadSamples');
const startBtn = document.getElementById('startBtn');
const pickOrderEl = document.getElementById('pickOrder');
const playersTable = document.getElementById('playersTable');
const playersTbody = playersTable.querySelector('tbody');
const playersHeaderRow = document.getElementById('playersHeaderRow');
const rostersEl = document.getElementById('rosters');
const draftSection = document.getElementById('draft');
const setupSection = document.getElementById('setup');
const currentCoachEl = document.getElementById('currentCoach');
const passBtn = document.getElementById('passBtn');
const statusEl = document.getElementById('status');
const prevBtn = document.getElementById('prevBtn');
const endBtn = document.getElementById('endBtn');
// new export and teams references
const exportBtn = document.getElementById('exportBtn');
const teamsSection = document.getElementById('teams');
const teamsContainer = document.getElementById('teamsContainer');

const draftModeRadios = document.querySelectorAll('input[name="draftMode"]');

let players = []; // {id,name,group,assigned}
let coaches = []; // {id,name,roster:[],skipNext:false}
let pickOrder = []; // base coach id order (reorderable)
let pickOrderCycle = []; // computed cycle used at runtime (linear or snake)
let currentPickIndex = 0;
let history = [];

function parseCSV(text) {
    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    return lines.map(line => line.split(',').map(s => s.trim()));
}

function updatePickOrderCycle() {
    const mode = document.querySelector('input[name="draftMode"]:checked')?.value || 'linear';
    if (mode === 'linear') {
        pickOrderCycle = [...pickOrder];
    } else {
        // snake: forward then reversed (ends get consecutive picks)
        pickOrderCycle = [...pickOrder, ...[...pickOrder].slice().reverse()];
    }
}

function loadPlayersFromText(text) {
    const rows = parseCSV(text);
    players = rows.map((r, i) => ({ id: String(i), name: r[0] || `Player ${i + 1}`, group: r[1] || '', assigned: false }));
    renderPlayers();
}

function loadCoachesFromText(text) {
    const rows = parseCSV(text);
    coaches = rows.map((r, i) => ({ id: String(i), name: r[0] || `Coach ${i + 1}`, roster: [], skipNext: false }));
    pickOrder = coaches.map(c => c.id);
    updatePickOrderCycle();
    renderPickOrder();
    renderRosters();
}

function renderPickOrder() {
    pickOrderEl.innerHTML = '';
    pickOrder.forEach((cid, idx) => {
        const coach = coaches.find(c => c.id === cid);
        const li = document.createElement('li');
        li.draggable = true;
        li.dataset.index = idx;
        li.innerHTML = `<span>${idx + 1}. ${coach.name}${coach.skipNext ? ' (skip next)' : ''}</span><span class="drag">↕</span>`;
        pickOrderEl.appendChild(li);
    });
    enableDragReorder(pickOrderEl, (from, to) => {
        const item = pickOrder.splice(from, 1)[0];
        pickOrder.splice(to, 0, item);
        updatePickOrderCycle();
        renderPickOrder();
    });
}

function enableDragReorder(ul, onDrop) {
    let start = null;
    ul.querySelectorAll('li').forEach(li => {
        li.addEventListener('dragstart', e => start = +li.dataset.index);
        li.addEventListener('dragover', e => e.preventDefault());
        li.addEventListener('drop', e => {
            const to = +li.dataset.index;
            onDrop(start, to);
        });
    });
}

function renderPlayers() {
    // render available players into a fixed 4-column table evenly spaced across the width
    const available = players.filter(p => !p.assigned);
    const columns = 4;
    const rows = Math.max(1, Math.ceil(available.length / columns));

    // header: four equal columns
    playersHeaderRow.innerHTML = '';
    for (let c = 0; c < columns; c++) {
        const th = document.createElement('th');
        th.textContent = c === 0 ? 'Available Players' : '';
        playersHeaderRow.appendChild(th);
    }

    // build rows
    playersTbody.innerHTML = '';
    for (let r = 0; r < rows; r++) {
        const tr = document.createElement('tr');
        for (let c = 0; c < columns; c++) {
            const td = document.createElement('td');
            const idx = c * rows + r;
            if (idx < available.length) {
                const p = available[idx];
                const nameSpan = document.createElement('span');
                nameSpan.className = 'player-name';
                nameSpan.textContent = p.name + (p.group ? ` [${p.group}]` : '');
                const btn = document.createElement('button');
                btn.textContent = 'Pick';
                btn.dataset.id = p.id;
                btn.addEventListener('click', () => pickPlayer(btn.dataset.id));
                td.appendChild(nameSpan);
                td.appendChild(btn);
            } else {
                td.innerHTML = '';
            }
            tr.appendChild(td);
        }
        playersTbody.appendChild(tr);
    }
}

function renderRosters() {
    rostersEl.innerHTML = '';
    coaches.forEach(c => {
        const box = document.createElement('div');
        box.innerHTML = `<h4>${c.name}${c.skipNext ? ' (skip next)' : ''}</h4>`;
        const ul = document.createElement('ul');
        ul.className = 'list';
        c.roster.forEach(p => {
            const li = document.createElement('li');
            li.innerHTML = `<span class="roster-player">${p.name}${p.group ? ` <span class="brother">[${p.group}]</span>` : ''}</span>`;
            ul.appendChild(li);
        });
        box.appendChild(ul);
        rostersEl.appendChild(box);
    });
}

function startDraft() {
    if (coaches.length === 0 || players.length === 0) { alert('Load players and coaches first'); return; }
    updatePickOrderCycle();
    setupSection.style.display = 'none';
    draftSection.style.display = '';
    currentPickIndex = 0;
    history = [];
    // disable export until draft ends
    if (exportBtn) exportBtn.disabled = true;
    updateTurnUI();
}

function getCurrentCoach() {
    if (pickOrderCycle.length === 0) return null;
    const cid = pickOrderCycle[currentPickIndex % pickOrderCycle.length];
    return coaches.find(c => c.id === cid);
}

function updateTurnUI() {
    const coach = getCurrentCoach();
    if (!coach) { currentCoachEl.textContent = 'No coaches'; return; }
    if (coach.skipNext) {
        coach.skipNext = false;
        statusEl.textContent = `${coach.name} skipped (was flagged).`;
        advanceTurn();
        return;
    }
    currentCoachEl.textContent = `${coach.name} — pick ${Math.floor(currentPickIndex / Math.max(1, pickOrderCycle.length)) + 1}`;
    statusEl.textContent = '';
    renderRosters();
    renderPlayers();
}

function advanceTurn() {
    currentPickIndex = (currentPickIndex + 1) % Math.max(1, pickOrderCycle.length);
    updateTurnUI();
}

function pickPlayer(playerId) {
    const coach = getCurrentCoach();
    if (!coach) return;
    const p = players.find(x => x.id === playerId && !x.assigned);
    if (!p) return;
    const group = p.group;
    const picked = [];
    if (group) {
        players.filter(x => x.group === group && !x.assigned).forEach(b => {
            b.assigned = true;
            coach.roster.push(b);
            picked.push(b);
        });
        coach.skipNext = true;
    } else {
        p.assigned = true;
        coach.roster.push(p);
        picked.push(p);
    }
    history.push({ coachId: coach.id, picks: picked.map(x => x.id) });
    statusEl.textContent = `Picked: ${picked.map(x => x.name).join(', ')}`;
    renderPlayers();
    renderRosters();

    // if no players remain after this pick, finish draft and export
    const remaining = players.filter(p => !p.assigned).length;
    if (remaining === 0) {
        // ensure UI updates before showing teams/export
        setTimeout(() => showTeamsAndExport(), 50);
        return;
    }

    advanceTurn();
}

function passTurn() {
    const coach = getCurrentCoach();
    if (!coach) return;
    history.push({ coachId: coach.id, picks: [] });
    statusEl.textContent = `${coach.name} passed.`;
    advanceTurn();
}

function prevTurn() {
    const last = history.pop();
    if (!last) return;
    const coach = coaches.find(c => c.id === last.coachId);
    last.picks.forEach(pid => {
        const p = players.find(x => x.id === pid);
        if (p) {
            p.assigned = false;
            coach.roster = coach.roster.filter(r => r.id !== pid);
        }
    });
    currentPickIndex = (currentPickIndex - 1 + Math.max(1, pickOrderCycle.length)) % Math.max(1, pickOrderCycle.length);
    updateTurnUI();
}

function endDraft() {
    // finish draft: show teams view and export
    showTeamsAndExport();
}

// build teams view and trigger CSV download
function showTeamsAndExport() {
    // hide other UI
    setupSection.style.display = 'none';
    draftSection.style.display = 'none';
    teamsSection.style.display = '';

    // populate teams container (one column per coach)
    teamsContainer.innerHTML = '';
    coaches.forEach(c => {
        const col = document.createElement('div');
        col.className = 'team-column';
        const h = document.createElement('h4');
        h.textContent = c.name;
        col.appendChild(h);
        const ul = document.createElement('ul');
        const roster = c.roster && c.roster.length ? c.roster : [];
        if (roster.length === 0) {
            const li = document.createElement('li');
            li.textContent = '(no picks)';
            ul.appendChild(li);
        } else {
            roster.forEach(p => {
                const li = document.createElement('li');
                li.textContent = p.name + (p.group ? ` [${p.group}]` : '');
                ul.appendChild(li);
            });
        }
        col.appendChild(ul);
        teamsContainer.appendChild(col);
    });

    // enable manual export button as well
    if (exportBtn) exportBtn.disabled = false;

    // trigger CSV download automatically (slight delay to allow render)
    setTimeout(() => exportRostersCSV(), 150);
}

// file input handlers
playersFile.addEventListener('change', e => {
    const f = e.target.files[0]; if (!f) return;
    f.text().then(txt => loadPlayersFromText(txt));
});
coachesFile.addEventListener('change', e => {
    const f = e.target.files[0]; if (!f) return;
    f.text().then(txt => loadCoachesFromText(txt));
});

draftModeRadios.forEach(r => r.addEventListener('change', () => {
    updatePickOrderCycle();
}));

loadSamples.addEventListener('click', () => {
    const samplePlayers = `Alice,1
Bob,1
Carl,
Diana,2
Evan,2
Frank,`;
    const sampleCoaches = `Coach A
Coach B
Coach C`;
    loadPlayersFromText(samplePlayers);
    loadCoachesFromText(sampleCoaches);
});

startBtn.addEventListener('click', startDraft);
passBtn.addEventListener('click', passTurn);
prevBtn.addEventListener('click', prevTurn);
endBtn.addEventListener('click', endDraft);

// wire export button
if (exportBtn) exportBtn.addEventListener('click', exportRostersCSV);

window.addEventListener('resize', () => {
    if (draftSection.style.display !== 'none') renderPlayers();
});

renderPickOrder();
renderPlayers();
renderRosters();