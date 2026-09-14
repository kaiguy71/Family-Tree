const peopleList = document.querySelector('#peopleList');
const treeCanvas = document.querySelector('#treeCanvas');
const treeScroll = document.querySelector('.tree-scroll');
const connections = document.querySelector('#connections');
const yearBands = document.querySelector('#yearBands');
const branchActions = document.querySelector('#branchActions');
const dialog = document.querySelector('#personDialog');
const loadDialog = document.querySelector('#loadDialog');
const saveDialog = document.querySelector('#saveDialog');
const createForm = document.querySelector('#createForm');
const loadForm = document.querySelector('#loadForm');
const saveForm = document.querySelector('#saveForm');
const editForm = document.querySelector('#editForm');
const emptyAdd = document.querySelector('#emptyAdd');
const addDisconnected = document.querySelector('#addDisconnected');
const editFather = document.querySelector('#editFather');
const editMother = document.querySelector('#editMother');
const editSpouse = document.querySelector('#editSpouse');
const editGender = document.querySelector('#editGender');
const savedTree = document.querySelector('#savedTree');
const saveName = document.querySelector('#saveName');
const zoomOut = document.querySelector('#zoomOut');
const zoomReset = document.querySelector('#zoomReset');
const zoomIn = document.querySelector('#zoomIn');

const state = {
  people: [],
  selectedId: null,
  positions: new Map(),
  zoom: 1,
  panX: 0,
  panY: 0,
  dragNodeId: null,
  viewportDrag: null,
  animationFrame: null
};

function request(url, options) {
  return fetch(url, options).then(async (response) => {
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Request failed');
    return result;
  });
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  }[character]));
}

function personName(id) {
  return state.people.find((person) => person.id === id)?.name || 'Unknown';
}

function apiDate(value) {
  if (!value) return '';
  const [year, month, day] = value.split('-');
  return `${month}-${day}-${year}`;
}

function inputDate(value) {
  if (!value) return '';
  const [month, day, year] = value.split('-');
  return year ? `${year}-${month}-${day}` : value;
}

function showFormError(form, message) {
  const error = form.querySelector('.form-error');
  if (!error) return;
  error.textContent = message || '';
  error.hidden = !message;
}

function normalizePerson(person) {
  return {
    ...person,
    birthday: typeof person.birthday === 'string' ? person.birthday : '',
    gender: person.gender === 'male' || person.gender === 'female' ? person.gender : 'unknown',
    children: Array.isArray(person.children) ? person.children : [],
    spouses: Array.isArray(person.spouses) ? person.spouses : [],
    siblings: Array.isArray(person.siblings) ? person.siblings : []
  };
}

function relationshipCount(person) {
  return (person.father !== null ? 1 : 0)
    + (person.mother !== null ? 1 : 0)
    + (Array.isArray(person.children) ? person.children.length : 0)
    + (Array.isArray(person.spouses) ? person.spouses.length : 0);
}

function yearOf(person) {
  return Number((person.birthday || '').slice(-4)) || 0;
}

function relationshipOptions(selectedIdValue, includeBlank = false, eligible = () => true) {
  const options = includeBlank ? '<option value="">None</option>' : '';
  return options + state.people
    .filter((person) => person.id !== selectedIdValue && eligible(person))
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((person) => `<option value="${person.id}">${escapeHtml(person.name)}</option>`)
    .join('');
}

function populateRelationshipFields(person) {
  const relatedIds = new Set(
    [person.father, person.mother, ...person.children, ...person.siblings]
      .filter((id) => id !== null)
  );

  editFather.innerHTML = relationshipOptions(person.id, true);
  editMother.innerHTML = relationshipOptions(person.id, true);
  editSpouse.innerHTML = relationshipOptions(person.id, true, (candidate) => !relatedIds.has(candidate.id) || person.spouses.includes(candidate.id));

  editFather.value = person.father ?? '';
  editMother.value = person.mother ?? '';
  editSpouse.value = person.spouses[0] ?? '';
  editGender.value = person.gender;
}

function getConnectedComponents() {
  const personMap = new Map(state.people.map((person) => [person.id, person]));
  const remaining = new Set(personMap.keys());
  const components = [];

  while (remaining.size) {
    const startId = [...remaining][0];
    const queue = [startId];
    const seen = new Set();
    const component = [];

    while (queue.length) {
      const id = queue.shift();
      if (seen.has(id)) continue;
      seen.add(id);
      component.push(id);
      remaining.delete(id);

      const person = personMap.get(id);
      if (!person) continue;

      const neighbors = [...new Set([
        person.father,
        person.mother,
        ...person.children,
        ...person.spouses
      ].filter((value) => value !== null && value !== undefined))];

      for (const neighborId of neighbors) {
        if (!seen.has(neighborId) && remaining.has(neighborId)) {
          queue.push(neighborId);
        }
      }
    }

    components.push(component);
  }

  return components;
}

function chooseRoot(component) {
  const candidates = component
    .map((id) => state.people.find((person) => person.id === id))
    .filter(Boolean);

  if (!candidates.length) return null;
  return [...candidates].sort((a, b) => relationshipCount(b) - relationshipCount(a))[0];
}

function seedPositions() {
  const personMap = new Map(state.people.map((person) => [person.id, person]));
  const components = getConnectedComponents();
  const nextPositions = new Map();

  components.forEach((component, index) => {
    const root = chooseRoot(component);
    if (!root) return;

    const centerX = 500 + (index % 3) * 900;
    const centerY = 350 + Math.floor(index / 3) * 700;
    const queue = [{ id: root.id, depth: 0 }];
    const depthMap = new Map([[root.id, 0]]);

    while (queue.length) {
      const current = queue.shift();
      const person = personMap.get(current.id);
      if (!person) continue;

      const neighbors = [...new Set([
        ...(person.father !== null ? [person.father] : []),
        ...(person.mother !== null ? [person.mother] : []),
        ...person.children,
        ...person.spouses
      ].filter((id) => id !== null && component.includes(id)))];

      for (const neighborId of neighbors) {
        if (!depthMap.has(neighborId)) {
          depthMap.set(neighborId, (depthMap.get(current.id) ?? 0) + 1);
          queue.push({ id: neighborId, depth: depthMap.get(neighborId) });
        }
      }
    }

    const byDepth = new Map();
    depthMap.forEach((depth, personId) => {
      if (!byDepth.has(depth)) byDepth.set(depth, []);
      byDepth.get(depth).push(personId);
    });

    byDepth.forEach((ids, depth) => {
      ids.sort((a, b) => (personMap.get(a)?.name || '').localeCompare(personMap.get(b)?.name || ''));
      const orbit = 120 + depth * 110;
      const step = (Math.PI * 2) / Math.max(1, ids.length);

      ids.forEach((personId, index) => {
        const theta = depth * 0.8 + index * step + (depth % 2 === 0 ? 0.5 : -0.5);
        const x = centerX + Math.cos(theta) * orbit;
        const y = centerY + Math.sin(theta) * orbit * 0.72;
        nextPositions.set(personId, { x, y, vx: 0, vy: 0 });
      });
    });
  });

  if (!nextPositions.size && state.people.length) {
    state.people.forEach((person, index) => {
      nextPositions.set(person.id, {
        x: 500 + (index % 6) * 160,
        y: 400 + Math.floor(index / 6) * 150,
        vx: 0,
        vy: 0
      });
    });
  }

  state.positions = nextPositions;
}

function relationshipLinks() {
  const links = [];
  state.people.forEach((person) => {
    [person.father, person.mother].filter((value) => value !== null).forEach((parentId) => {
      links.push([parentId, person.id, 'parent']);
    });

    person.spouses.forEach((spouseId) => {
      if (person.id < spouseId) {
        links.push([person.id, spouseId, 'spouse']);
      }
    });
  });
  return links;
}

function drawConnections() {
  const markup = [];
  const links = relationshipLinks();

  links.forEach(([fromId, toId, kind]) => {
    const from = state.positions.get(fromId);
    const to = state.positions.get(toId);
    if (!from || !to) return;

    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const distance = Math.hypot(dx, dy) || 1;
    const normalX = -dy / distance;
    const normalY = dx / distance;
    const curve = kind === 'spouse' ? 32 : 18;
    const curveX = (from.x + to.x) / 2 + normalX * curve;
    const curveY = (from.y + to.y) / 2 + normalY * curve;
    const path = `M ${from.x} ${from.y} Q ${curveX} ${curveY} ${to.x} ${to.y}`;
    markup.push(`<path class="edge-${kind}" d="${path}" />`);
  });

  connections.innerHTML = markup.join('');
}

function getWorldBounds() {
  const points = [...state.positions.values()];
  if (!points.length) {
    return { width: 1100, height: 800, minX: 0, minY: 0, maxX: 1100, maxY: 800 };
  }

  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const minX = Math.min(...xs) - 260;
  const minY = Math.min(...ys) - 260;
  const maxX = Math.max(...xs) + 260;
  const maxY = Math.max(...ys) + 260;

  return { width: maxX - minX + 120, height: maxY - minY + 120, minX, minY, maxX, maxY };
}

function applyWorldTransform() {
  const bounds = getWorldBounds();
  treeCanvas.style.width = `${Math.max(1000, bounds.width)}px`;
  treeCanvas.style.height = `${Math.max(700, bounds.height)}px`;
  treeCanvas.style.transform = `translate(${state.panX}px, ${state.panY}px) scale(${state.zoom})`;
  treeCanvas.style.transformOrigin = '0 0';
  treeCanvas.style.left = '0';
  treeCanvas.style.top = '0';
}

function render() {
  document.querySelector('#count').textContent = `${state.people.length} ${state.people.length === 1 ? 'person' : 'people'}`;
  document.querySelector('#statusText').textContent = state.people.length ? 'Map connected' : 'Empty map';
  emptyAdd.hidden = state.people.length > 0;
  addDisconnected.hidden = state.people.length === 0;

  peopleList.innerHTML = '';
  const nodeRadiusBase = 26;

  const orderedPeople = [...state.people].sort((a, b) => a.name.localeCompare(b.name));
  orderedPeople.forEach((person) => {
    const position = state.positions.get(person.id);
    if (!position) return;

    const node = document.createElement('article');
    node.className = `person gender-${person.gender} ${state.selectedId === person.id ? 'selected' : ''}`;
    node.dataset.id = String(person.id);
    node.style.left = `${position.x}px`;
    node.style.top = `${position.y}px`;
    const radius = nodeRadiusBase + relationshipCount(person) * 5;
    node.style.width = `${radius * 2}px`;
    node.style.height = `${radius * 2}px`;

    const year = yearOf(person);
    node.innerHTML = `
      <span class="planet-core"></span>
      <span class="planet-name">${escapeHtml(person.name)}</span>
      <span class="planet-year">${year || 'Unknown'}</span>
    `;

    peopleList.appendChild(node);
  });

  drawConnections();
  if (state.selectedId !== null) {
    placeBranchActions();
  }
  applyWorldTransform();
}

function fitToNetwork() {
  const bounds = getWorldBounds();
  const viewportWidth = treeScroll.clientWidth || 1000;
  const viewportHeight = treeScroll.clientHeight || 700;

  const scaleX = (viewportWidth - 80) / Math.max(1, bounds.width);
  const scaleY = (viewportHeight - 80) / Math.max(1, bounds.height);
  state.zoom = Math.max(0.35, Math.min(1.8, Math.min(scaleX, scaleY)));

  state.panX = (viewportWidth - bounds.width * state.zoom) / 2 - bounds.minX * state.zoom;
  state.panY = (viewportHeight - bounds.height * state.zoom) / 2 - bounds.minY * state.zoom;
}

function selectPerson(id) {
  state.selectedId = id;
  document.body.classList.add('person-selected');
  const person = state.people.find((entry) => entry.id === id);
  if (!person) return;

  document.querySelector('#inspectorEmpty').hidden = true;
  editForm.hidden = false;
  document.querySelector('#avatar').textContent = person.name.slice(0, 1).toUpperCase();
  document.querySelector('#personId').textContent = `PERSON ${person.id}`;
  document.querySelector('#editName').value = person.name;
  document.querySelector('#editBirthday').value = inputDate(person.birthday);
  populateRelationshipFields(person);

  branchActions.innerHTML = `
    <button type="button" title="Add father" aria-label="Add father" data-relation="parent" data-role="father">+<small>father</small></button>
    <button type="button" title="Add mother" aria-label="Add mother" data-relation="parent" data-role="mother">+<small>mother</small></button>
    <button type="button" title="Add sibling" aria-label="Add sibling" data-relation="sibling">+<small>sibling</small></button>
    <button type="button" title="Add marriage" aria-label="Add marriage" data-relation="spouse">+<small>marriage</small></button>
    <button type="button" title="Add child" aria-label="Add child" data-relation="child" data-role="father">+<small>child</small></button>
  `;
  branchActions.hidden = false;
  render();
}

function placeBranchActions() {
  const selectedNode = peopleList.querySelector(`.person[data-id="${state.selectedId}"]`);
  if (!selectedNode) return;

  const left = selectedNode.offsetLeft + selectedNode.offsetWidth / 2;
  const top = selectedNode.offsetTop + selectedNode.offsetHeight / 2;
  branchActions.style.left = `${left}px`;
  branchActions.style.top = `${top + 44}px`;
}

function openCreate(relation = '', role = '') {
  createForm.reset();
  showFormError(createForm, '');
  createForm.elements.relation.value = relation;
  createForm.elements.relatedId.value = state.selectedId ?? '';
  createForm.elements.relatedId.dataset.name = state.selectedId !== null ? personName(state.selectedId) : '';
  createForm.elements.role.value = role;
  document.querySelector('#createTitle').textContent = relation ? `Add ${relation}` : 'Add a person';
  document.querySelector('#createKicker').textContent = relation ? `New ${relation} / connected to ${personName(state.selectedId)}` : 'New person';
  dialog.showModal();
}

peopleList.addEventListener('click', (event) => {
  const node = event.target.closest('.person');
  if (node) selectPerson(Number(node.dataset.id));
});

branchActions.addEventListener('click', (event) => {
  const button = event.target.closest('[data-relation]');
  if (button) openCreate(button.dataset.relation, button.dataset.role || '');
});

document.querySelector('#addFirst').addEventListener('click', () => openCreate());
addDisconnected.addEventListener('click', () => openCreate());

function clearSelection() {
  state.selectedId = null;
  document.body.classList.remove('person-selected');
  editForm.hidden = true;
  document.querySelector('#inspectorEmpty').hidden = false;
  branchActions.hidden = true;
  render();
}

document.querySelector('#closeInspector').addEventListener('click', clearSelection);

document.querySelector('#closeDialog').addEventListener('click', () => dialog.close());

async function updateRelationships(person) {
  const fatherId = editFather.value ? Number(editFather.value) : null;
  const motherId = editMother.value ? Number(editMother.value) : null;

  if (person.father !== fatherId) {
    if (person.father !== null) {
      await request(`/api/relationships?childId=${person.id}&role=father`, { method: 'DELETE' });
    }
    if (fatherId !== null) {
      await request('/api/relationships', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ childId: person.id, parentId: fatherId, role: 'father' })
      });
    }
  }

  if (person.mother !== motherId) {
    if (person.mother !== null) {
      await request(`/api/relationships?childId=${person.id}&role=mother`, { method: 'DELETE' });
    }
    if (motherId !== null) {
      await request('/api/relationships', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ childId: person.id, parentId: motherId, role: 'mother' })
      });
    }
  }

  const spouseId = editSpouse.value ? Number(editSpouse.value) : null;
  for (const existingId of person.spouses.filter((id) => id !== spouseId)) {
    await request(`/api/marriages?firstId=${person.id}&secondId=${existingId}`, { method: 'DELETE' });
  }

  if (spouseId !== null && !person.spouses.includes(spouseId)) {
    await request('/api/marriages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ firstId: person.id, secondId: spouseId })
    });
  }
}

editForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  showFormError(editForm, '');
  try {
    const person = state.people.find((entry) => entry.id === state.selectedId);
    await request('/api/people', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: state.selectedId,
        name: event.target.name.value,
        birthday: apiDate(event.target.birthday.value),
        gender: editGender.value
      })
    });
    await updateRelationships(person);
    await refresh();
    if (state.selectedId !== null) {
      selectPerson(state.selectedId);
    }
  } catch (error) {
    await refresh().catch(() => {});
    if (state.selectedId !== null) showFormError(editForm, error.message);
  }
});

createForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  try {
    const data = Object.fromEntries(new FormData(event.target));
    data.birthday = apiDate(data.birthday);
    data.relatedId = data.relatedId ? Number(data.relatedId) : null;
    await request('/api/people', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    dialog.close();
    await refresh();
  } catch (error) {
    const relatedId = createForm.elements.relatedId.value;
    await refresh().catch(() => {});
    const missing = relatedId !== '' && !state.people.some((person) => person.id === Number(relatedId));
    showFormError(createForm, missing
      ? `${createForm.elements.relatedId.dataset.name || 'That person'} is no longer on the server (it may have restarted or loaded another tree). The map has been reloaded; close this and pick someone again.`
      : error.message);
  }
});

function setZoom(nextZoom) {
  state.zoom = Math.max(0.18, Math.min(12, nextZoom));
  render();
}

zoomOut.addEventListener('click', () => setZoom(state.zoom / 1.2));
zoomReset.addEventListener('click', () => {
  state.zoom = 1;
  fitToNetwork();
  render();
});
zoomIn.addEventListener('click', () => setZoom(state.zoom * 1.2));

document.querySelector('.tree-scroll').addEventListener('wheel', (event) => {
  event.preventDefault();
  const delta = event.deltaY < 0 ? 1.12 : 0.9;
  setZoom(state.zoom * delta);
}, { passive: false });

function pointerToWorld(clientX, clientY) {
  const rect = treeScroll.getBoundingClientRect();
  const localX = clientX - rect.left;
  const localY = clientY - rect.top;
  return {
    x: (localX - state.panX) / state.zoom,
    y: (localY - state.panY) / state.zoom
  };
}

treeScroll.addEventListener('pointerdown', (event) => {
  const personNode = event.target.closest('.person');
  if (personNode) {
    const personId = Number(personNode.dataset.id);
    state.dragNodeId = personId;
    const personPosition = state.positions.get(personId);
    if (personPosition) {
      const world = pointerToWorld(event.clientX, event.clientY);
      personPosition.vx = 0;
      personPosition.vy = 0;
      personPosition.x = world.x;
      personPosition.y = world.y;
    }
    personNode.setPointerCapture?.(event.pointerId);
    return;
  }

  state.viewportDrag = {
    startX: event.clientX,
    startY: event.clientY,
    panX: state.panX,
    panY: state.panY
  };
});

treeScroll.addEventListener('pointermove', (event) => {
  if (state.dragNodeId !== null) {
    const world = pointerToWorld(event.clientX, event.clientY);
    const node = state.positions.get(state.dragNodeId);
    if (node) {
      node.x = world.x;
      node.y = world.y;
      node.vx = 0;
      node.vy = 0;
    }
    render();
    return;
  }

  if (state.viewportDrag) {
    state.panX = state.viewportDrag.panX + (event.clientX - state.viewportDrag.startX);
    state.panY = state.viewportDrag.panY + (event.clientY - state.viewportDrag.startY);
    render();
  }
});

function releasePointer() {
  state.dragNodeId = null;
  state.viewportDrag = null;
}

treeScroll.addEventListener('pointerup', releasePointer);
treeScroll.addEventListener('pointerleave', releasePointer);
window.addEventListener('resize', () => {
  if (state.people.length) {
    fitToNetwork();
  }
  render();
});

function stepPhysics() {
  if (!state.people.length) return;

  const nodes = new Map();
  state.positions.forEach((value, key) => {
    nodes.set(key, { ...value, vx: value.vx || 0, vy: value.vy || 0, radius: 22 + relationshipCount(state.people.find((person) => person.id === key) || { children: [], spouses: [] }) * 4 });
  });

  const linked = new Set();
  state.people.forEach((person) => {
    [person.father, person.mother, ...person.children, ...person.spouses].filter((value) => value !== null).forEach((id) => {
      const pair = [person.id, id].sort((a, b) => a - b).join(':');
      linked.add(pair);
    });
  });

  for (let index = 0; index < state.people.length; index += 1) {
    const firstPerson = state.people[index];
    const firstNode = nodes.get(firstPerson.id);
    if (!firstNode) continue;

    for (let otherIndex = index + 1; otherIndex < state.people.length; otherIndex += 1) {
      const secondPerson = state.people[otherIndex];
      const secondNode = nodes.get(secondPerson.id);
      if (!secondNode) continue;

      const dx = secondNode.x - firstNode.x;
      const dy = secondNode.y - firstNode.y;
      const distance = Math.hypot(dx, dy) || 1;
      const minGap = (firstNode.radius || 22) + (secondNode.radius || 22) + 18;
      const pairId = [firstPerson.id, secondPerson.id].sort((a, b) => a - b).join(':');
      const isLinked = linked.has(pairId);

      if (isLinked) {
        const desired = 190;
        const springForce = (distance - desired) * 0.012;
        const fx = (dx / distance) * springForce;
        const fy = (dy / distance) * springForce;
        firstNode.vx += fx;
        firstNode.vy += fy;
        secondNode.vx -= fx;
        secondNode.vy -= fy;
      } else if (distance < 200) {
        const repel = (200 - distance) * 0.04;
        const fx = (dx / distance) * repel;
        const fy = (dy / distance) * repel;
        firstNode.vx -= fx;
        firstNode.vy -= fy;
        secondNode.vx += fx;
        secondNode.vy += fy;
      }

      if (distance < minGap) {
        const push = (minGap - distance) * 0.2;
        const nx = dx / distance;
        const ny = dy / distance;
        firstNode.vx -= nx * push;
        firstNode.vy -= ny * push;
        secondNode.vx += nx * push;
        secondNode.vy += ny * push;
      }
    }
  }

  const centerX = 850;
  const centerY = 500;

  nodes.forEach((node) => {
    node.vx += (centerX - node.x) * 0.00035;
    node.vy += (centerY - node.y) * 0.00035;
    node.vx *= 0.82;
    node.vy *= 0.82;
    node.x += node.vx;
    node.y += node.vy;
  });

  state.positions = nodes;
}

function animationLoop() {
  if (!state.people.length) {
    state.animationFrame = requestAnimationFrame(animationLoop);
    return;
  }

  stepPhysics();
  render();
  state.animationFrame = requestAnimationFrame(animationLoop);
}

async function refresh() {
  state.people = (await request('/api/people')).map(normalizePerson);
  if (state.selectedId !== null && !state.people.some((person) => person.id === state.selectedId)) clearSelection();
  if (!state.people.length) {
    state.positions.clear();
    state.panX = 0;
    state.panY = 0;
    state.zoom = 1;
    render();
    return;
  }

  seedPositions();
  fitToNetwork();
  render();
}

// Keep the page in step with the server (e.g. after a restart) without resetting the view when nothing changed.
document.addEventListener('visibilitychange', async () => {
  if (document.hidden || document.querySelector('dialog[open]')) return;
  try {
    const people = (await request('/api/people')).map(normalizePerson);
    if (JSON.stringify(people) !== JSON.stringify(state.people)) await refresh();
  } catch {
    // Server unreachable; leave the current map in place.
  }
});

async function loadSavedTree() {
  const [files, current] = await Promise.all([request('/api/savefiles'), request('/api/people')]);
  // Only offer a startup load on an empty map, so refreshing the page never replaces live data.
  if (!files.length || current.length) return;
  savedTree.innerHTML = files.map((file) => `<option value="${escapeHtml(file)}">${escapeHtml(file)}</option>`).join('');
  loadDialog.showModal();
}

loadForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  showFormError(loadForm, '');
  try {
    const current = await request('/api/people');
    if (current.length && !confirm(`Loading ${savedTree.value} replaces the ${current.length} ${current.length === 1 ? 'person' : 'people'} currently on the map. Continue?`)) return;
    await request('/api/load', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ treename: savedTree.value })
    });
    loadDialog.close();
    await refresh();
  } catch (error) {
    showFormError(loadForm, error.message);
  }
});

document.querySelector('#skipLoad').addEventListener('click', () => loadDialog.close());

loadSavedTree().then(refresh).catch((error) => {
  document.querySelector('#statusText').textContent = error.message;
});

document.querySelector('#savePeople').addEventListener('click', () => {
  saveName.value = '';
  showFormError(saveForm, '');
  saveDialog.showModal();
});

document.querySelector('#closeSaveDialog').addEventListener('click', () => saveDialog.close());

saveForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  try {
    await request('/api/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ treename: saveName.value.trim() })
    });
    saveDialog.close();
    document.querySelector('#statusText').textContent = `Saved ${saveName.value.trim()}.save`;
  } catch (error) {
    showFormError(saveForm, error.message);
  }
});

document.querySelector('#clearPeople').addEventListener('click', async () => {
  if (!state.people.length || !confirm('Clear every person from the family map?')) return;
  try {
    await request('/api/people', { method: 'DELETE' });
    state.selectedId = null;
    document.querySelector('#inspectorEmpty').hidden = false;
    editForm.hidden = true;
    branchActions.hidden = true;
    await refresh();
  } catch (error) {
    document.querySelector('#statusText').textContent = error.message;
  }
});

if (state.animationFrame === null) {
  state.animationFrame = requestAnimationFrame(animationLoop);
}
