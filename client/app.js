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
const deletePerson = document.querySelector('#deletePerson');

const state = {
  people: [],
  selectedId: null,
  positions: new Map(),
  zoom: 1,
  panX: 0,
  panY: 0,
  dragNodeId: null,
  viewportDrag: null,
  animationFrame: null,
  hoveredPersonId: null,
  press: null
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

function personNameLines(name) {
  const words = String(name || 'Unknown').trim().split(/\s+/).filter(Boolean);
  if (words.length < 2) return [words[0] || 'Unknown'];
  return [words[0], words.slice(1).join(' ')];
}

function visibleNameIds(orderedPeople, generationMemo) {
  const candidates = orderedPeople
    .map((person) => {
      const position = state.positions.get(person.id);
      if (!position) return null;
      const generation = getGeneration(person.id, generationMemo);
      const [firstLine, lastLine = ''] = personNameLines(person.name);
      const year = yearOf(person);
      const width = Math.min(
        22 * (3 ** generation) * 1.6,
        Math.max(firstLine.length, lastLine.length, year ? String(year).length * 0.85 : 0) * 7.2 + 8
      );
      const nameHeight = lastLine ? 28 : 16;
      return {
        id: person.id,
        generation,
        position,
        width,
        height: nameHeight + (state.zoom >= 0.8 && year ? 12 : 0)
      };
    })
    .filter(Boolean)
    .filter((candidate) => candidate.generation === Math.max(...orderedPeople.map((person) => getGeneration(person.id, generationMemo)))
      || state.zoom >= 0.55 + candidate.generation * 0.12)
    .sort((first, second) => second.generation - first.generation);

  const visible = [];
  candidates.forEach((candidate) => {
    const overlaps = visible.some((other) => {
      const horizontal = Math.abs(candidate.position.x - other.position.x) * state.zoom
        < (candidate.width + other.width) * state.zoom / 2;
      const vertical = Math.abs(candidate.position.y - other.position.y) * state.zoom
        < (candidate.height + other.height) * state.zoom / 2;
      return horizontal && vertical;
    });
    if (!overlaps) visible.push(candidate);
  });
  return new Set(visible.map((candidate) => candidate.id));
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

function getGeneration(personId, memo = new Map(), visiting = new Set()) {
  if (memo.has(personId)) return memo.get(personId);
  if (visiting.has(personId)) return 0;
  const person = state.people.find((entry) => entry.id === personId);
  if (!person) return 0;
  visiting.add(personId);
  const childGenerations = person.children
    .map((id) => getGeneration(id, memo, visiting));
  visiting.delete(personId);
  const generation = childGenerations.length ? Math.max(...childGenerations) + 1 : 0;
  memo.set(personId, generation);
  return generation;
}

function adjacentPeople(personId) {
  const person = state.people.find((entry) => entry.id === personId);
  return new Set(person ? [
    person.father, person.mother, ...person.children, ...person.spouses
  ].filter((id) => id !== null && id !== undefined) : []);
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
    const focused = state.hoveredPersonId === null
      || fromId === state.hoveredPersonId
      || toId === state.hoveredPersonId;
    markup.push(`<path class="edge-${kind}${focused ? '' : ' edge-dimmed'}" d="${path}" />`);
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
  const generationMemo = new Map();
  const neighbors = state.hoveredPersonId === null ? new Set() : adjacentPeople(state.hoveredPersonId);

  const orderedPeople = [...state.people].sort((a, b) => a.name.localeCompare(b.name));
  const visibleNames = visibleNameIds(orderedPeople, generationMemo);
  orderedPeople.forEach((person) => {
    const position = state.positions.get(person.id);
    if (!position) return;

    const node = document.createElement('article');
    const generation = getGeneration(person.id, generationMemo);
    const focused = state.hoveredPersonId === null
      || person.id === state.hoveredPersonId
      || neighbors.has(person.id);
    node.className = `person gender-${person.gender} ${state.selectedId === person.id ? 'selected' : ''}${focused ? '' : ' dimmed'}`;
    node.dataset.id = String(person.id);
    node.style.left = `${position.x}px`;
    node.style.top = `${position.y}px`;
    const radius = 22 * (3 ** generation);
    node.style.width = `${radius * 2}px`;
    node.style.height = `${radius * 2}px`;

    const year = yearOf(person);
    const [firstName, lastName] = personNameLines(person.name);
    const showYear = visibleNames.has(person.id) && state.zoom >= 0.8 && year;
    node.innerHTML = `
      <span class="planet-core"></span>
      <span class="planet-name${visibleNames.has(person.id) ? '' : ' label-hidden'}">${escapeHtml(firstName)}${lastName ? `<br>${escapeHtml(lastName)}` : ''}${showYear ? `<span class="planet-year">${year}</span>` : ''}</span>
    `;

    peopleList.appendChild(node);
  });

  drawConnections();
  applyWorldTransform();
  if (state.selectedId !== null) {
    placeBranchActions();
  }
}

function fitToNetwork() {
  const bounds = getWorldBounds();
  const viewportWidth = treeScroll.clientWidth || 1000;
  const viewportHeight = treeScroll.clientHeight || 700;

  if (state.people.length === 1) {
    const position = state.positions.get(state.people[0].id);
    if (position) {
      // Frame the first person closely, leaving room below for branch actions.
      state.zoom = Math.min(3, (viewportWidth - 80) / 220, (viewportHeight - 80) / 240);
      state.panX = viewportWidth / 2 - position.x * state.zoom;
      state.panY = viewportHeight / 2 - (position.y + 35) * state.zoom;
      return;
    }
  }

  const scaleX = (viewportWidth - 80) / Math.max(1, bounds.width);
  const scaleY = (viewportHeight - 80) / Math.max(1, bounds.height);
  state.zoom = Math.min(1.8, Math.min(scaleX, scaleY));

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

  // Match the selected circle's world size; the canvas supplies zoom scaling.
  const actionScale = Math.max(4 / 9, selectedNode.offsetWidth / 132);
  branchActions.style.fontSize = `${20 * actionScale}px`;
  const canvasRect = treeCanvas.getBoundingClientRect();
  const selectedRect = selectedNode.getBoundingClientRect();
  const gap = 16 * actionScale * state.zoom;
  const centerX = (selectedRect.left + selectedRect.right) / 2;
  // Include the labels below both the people and the action buttons.
  const obstacles = [...peopleList.querySelectorAll('.person')].map((node) => {
    const rectangles = [node, ...node.querySelectorAll('.planet-name, .planet-year')]
      .map((element) => element.getBoundingClientRect());
    return {
      node,
      left: Math.min(...rectangles.map((rect) => rect.left)),
      right: Math.max(...rectangles.map((rect) => rect.right)),
      top: Math.min(...rectangles.map((rect) => rect.top)),
      bottom: Math.max(...rectangles.map((rect) => rect.bottom))
    };
  });
  const width = (branchActions.offsetWidth + 24 * actionScale) * state.zoom;
  const height = (branchActions.offsetHeight + 28 * actionScale) * state.zoom;
  let top = obstacles.find((obstacle) => obstacle.node === selectedNode).bottom + gap;

  // Move below any neighboring circle or label that occupies the toolbar space.
  obstacles.sort((a, b) => a.top - b.top).forEach((obstacle) => {
    if (centerX + width / 2 + gap > obstacle.left
        && centerX - width / 2 - gap < obstacle.right
        && top + height + gap > obstacle.top
        && top < obstacle.bottom + gap) {
      top = obstacle.bottom + gap;
    }
  });
  branchActions.style.left = `${(centerX - canvasRect.left) / state.zoom}px`;
  branchActions.style.top = `${(top - canvasRect.top) / state.zoom}px`;
}

function openCreate(relation = '', role = '', relatedId = state.selectedId) {
  createForm.reset();
  if (relation === 'parent') {
    if (role === 'father') createForm.elements.gender.value = 'male';
    if (role === 'mother') createForm.elements.gender.value = 'female';
  }
  showFormError(createForm, '');
  createForm.elements.relation.value = relation;
  createForm.elements.relatedId.value = relatedId ?? '';
  createForm.elements.relatedId.dataset.name = (relatedId === null || relatedId === undefined || relatedId === '') ? '' : personName(relatedId);
  createForm.elements.role.value = role;
  document.querySelector('#createTitle').textContent = relation ? `Add ${relation}` : 'Add a person';
  document.querySelector('#createKicker').textContent = relation ? `New ${relation} / connected to ${personName(relatedId)}` : 'New person';
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
addDisconnected.addEventListener('click', () => openCreate('', '', null));

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

deletePerson.addEventListener('click', async () => {
  if (state.selectedId === null || !confirm(`Remove ${personName(state.selectedId)} from the family tree?`)) return;
  try {
    await request(`/api/people?id=${state.selectedId}`, { method: 'DELETE' });
    state.selectedId = null;
    document.body.classList.remove('person-selected');
    editForm.hidden = true;
    document.querySelector('#inspectorEmpty').hidden = false;
    branchActions.hidden = true;
    await refresh();
  } catch (error) {
    document.querySelector('#statusText').textContent = error.message;
  }
});

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
    const birthday = event.target.birthday.value;
    const parents = [editFather.value, editMother.value]
      .filter((id) => id !== '')
      .map((id) => state.people.find((entry) => entry.id === Number(id)));
    const children = state.people.filter((entry) => person.children.includes(entry.id));
    if (birthday && (parents.some((parent) => parent?.birthday && inputDate(parent.birthday) > birthday)
        || children.some((child) => child.birthday && birthday > inputDate(child.birthday)))) {
      throw new Error('A father or mother cannot be younger than their child. Please correct the birthdate.');
    }
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
  const viewportWidth = treeScroll.clientWidth || 1000;
  const viewportHeight = treeScroll.clientHeight || 700;
  const centerWorldX = (viewportWidth / 2 - state.panX) / state.zoom;
  const centerWorldY = (viewportHeight / 2 - state.panY) / state.zoom;
  state.zoom = Math.max(0.01, Math.min(12, nextZoom));
  state.panX = viewportWidth / 2 - centerWorldX * state.zoom;
  state.panY = viewportHeight / 2 - centerWorldY * state.zoom;
  render();
}

treeScroll.addEventListener('wheel', (event) => {
  event.preventDefault();
  const delta = event.deltaY < 0 ? 1.072 : 0.928;
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
  const action = event.target.closest('[data-relation]');
  if (action) return;
  const personNode = event.target.closest('.person');
  if (personNode) {
    const personId = Number(personNode.dataset.id);
    state.press = { personId, x: event.clientX, y: event.clientY, moved: false };
    state.dragNodeId = null;
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
  if (state.press && !state.press.moved && Math.hypot(event.clientX - state.press.x, event.clientY - state.press.y) > 6) {
    state.press.moved = true;
    state.dragNodeId = state.press.personId;
  }
  if (state.press && !state.press.moved) {
    const rect = treeScroll.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    let closest = null;
    let distance = Infinity;
    state.people.forEach((person) => {
      const position = state.positions.get(person.id);
      if (!position) return;
      const candidateDistance = Math.hypot(position.x * state.zoom + state.panX - x, position.y * state.zoom + state.panY - y);
      if (candidateDistance < distance) {
        distance = candidateDistance;
        closest = person.id;
      }
    });
    if (closest !== null && distance < 180 && state.hoveredPersonId !== closest) {
      state.hoveredPersonId = closest;
      render();
    }
  }
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
    return;
  }

  const hoveredNode = event.target.closest?.('.person');
  const hoveredId = hoveredNode ? Number(hoveredNode.dataset.id) : null;
  if (!hoveredNode && event.target.closest?.('.branch-actions')) {
    return;
  }
  if (hoveredId !== state.hoveredPersonId && hoveredId !== null) {
    state.hoveredPersonId = hoveredId;
    render();
  } else if (hoveredId === null && state.hoveredPersonId !== null) {
    state.hoveredPersonId = null;
    render();
  }
});

function releasePointer() {
  if (state.press && !state.press.moved) {
    selectPerson(state.press.personId);
  }
  state.press = null;
  state.dragNodeId = null;
  state.viewportDrag = null;
}

treeScroll.addEventListener('pointerup', releasePointer);
treeScroll.addEventListener('pointerleave', releasePointer);
treeScroll.addEventListener('pointerout', (event) => {
  if (!event.relatedTarget || !treeScroll.contains(event.relatedTarget)) {
    state.hoveredPersonId = null;
    render();
  }
});
window.addEventListener('resize', () => {
  if (state.people.length) {
    fitToNetwork();
  }
  render();
});

function stepPhysics() {
  if (!state.people.length) return;

  const nodes = new Map();
  const generationMemo = new Map();
  state.positions.forEach((value, key) => {
    const person = state.people.find((entry) => entry.id === key);
    const generation = person ? getGeneration(key, generationMemo) : 0;
    nodes.set(key, {
      ...value,
      vx: value.vx || 0,
      vy: value.vy || 0,
      generation,
      radius: 22 * (3 ** generation)
    });
  });

  const linked = new Set();
  const sharedChildConnections = new Set();
  const componentByPerson = new Map();
  const pairId = (firstId, secondId) => [firstId, secondId].sort((a, b) => a - b).join(':');

  getConnectedComponents().forEach((component) => {
    component.forEach((personId) => componentByPerson.set(personId, component));
  });

  state.people.forEach((person) => {
    [person.father, person.mother, ...person.children, ...person.spouses]
      .filter((value) => value !== null && value !== undefined)
      .forEach((id) => linked.add(pairId(person.id, id)));

    const parents = [person.father, person.mother]
      .filter((id) => id !== null && id !== undefined);
    if (parents.length === 2) {
      sharedChildConnections.add(pairId(parents[0], parents[1]));
    }
  });

  state.people.forEach((person) => {
    person.children.forEach((childId) => {
      const child = state.people.find((candidate) => candidate.id === childId);
      if (!child) return;
      [child.father, child.mother]
        .filter((id) => id !== null && id !== undefined)
        .forEach((parentId) => {
          if (parentId !== person.id) sharedChildConnections.add(pairId(person.id, parentId));
        });
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
      const forcefieldGap = 1.1 * (firstNode.radius + secondNode.radius);
      const pair = pairId(firstPerson.id, secondPerson.id);
      const isLinked = linked.has(pair);
      const sameBodySize = firstNode.generation === secondNode.generation;

      // A barely perceptible expansion gives disconnected clusters enough
      // motion to settle without competing with family forces.
      const universalRepel = 0.001;
      const universalFx = (dx / distance) * universalRepel;
      const universalFy = (dy / distance) * universalRepel;
      firstNode.vx -= universalFx;
      firstNode.vy -= universalFy;
      secondNode.vx += universalFx;
      secondNode.vy += universalFy;

      if (sameBodySize) {
        // Grandparent bodies are the spacing baseline. Scale the separation
        // up for larger bodies and down for smaller bodies by their radius.
        const grandparentRadius = 22 * (3 ** 2);
        const averageRadius = (firstNode.radius + secondNode.radius) / 2;
        const relativeSize = Math.max(0.25, averageRadius / grandparentRadius);
        const separationRange = forcefieldGap + (260 * 1.4) * relativeSize;
        if (distance < separationRange) {
          const repel = (separationRange - distance) * (0.08 * relativeSize);
          const fx = (dx / distance) * repel;
          const fy = (dy / distance) * repel;
          firstNode.vx -= fx;
          firstNode.vy -= fy;
          secondNode.vx += fx;
          secondNode.vy += fy;
        }
      } else if (isLinked) {
        const desired = forcefieldGap + 60;
        const springForce = (distance - desired) * 0.003;
        const fx = (dx / distance) * springForce;
        const fy = (dy / distance) * springForce;
        firstNode.vx += fx;
        firstNode.vy += fy;
        secondNode.vx -= fx;
        secondNode.vy -= fy;
      } else if (
        sharedChildConnections.has(pair)
        || componentByPerson.get(firstPerson.id) !== componentByPerson.get(secondPerson.id)
      ) {
        const separationRange = forcefieldGap + 180;
        if (distance < separationRange) {
          const repel = (separationRange - distance) * 0.045;
          const fx = (dx / distance) * repel;
          const fy = (dy / distance) * repel;
          firstNode.vx -= fx;
          firstNode.vy -= fy;
          secondNode.vx += fx;
          secondNode.vy += fy;
        }
      }

      if (distance < forcefieldGap) {
        // Forcefields prevent clipping while preserving tangential movement,
        // so another planet can roll across the boundary like a floor.
        const overlap = forcefieldGap - distance;
        const nx = dx === 0 && dy === 0 ? (firstPerson.id < secondPerson.id ? 1 : -1) : dx / distance;
        const ny = dx === 0 && dy === 0 ? 0 : dy / distance;
        const inverseMassTotal = (1 / firstNode.radius) + (1 / secondNode.radius);
        const firstShare = (1 / firstNode.radius) / inverseMassTotal;
        const secondShare = (1 / secondNode.radius) / inverseMassTotal;
        firstNode.x -= nx * overlap * firstShare;
        firstNode.y -= ny * overlap * firstShare;
        secondNode.x += nx * overlap * secondShare;
        secondNode.y += ny * overlap * secondShare;

        const relativeNormalVelocity =
          (secondNode.vx - firstNode.vx) * nx
          + (secondNode.vy - firstNode.vy) * ny;
        if (relativeNormalVelocity < 0) {
          // Cancel only the inward normal velocity. This is a zero-restitution
          // collision: tangential velocity remains available for sliding.
          const impulse = -relativeNormalVelocity;
          firstNode.vx -= nx * impulse * firstShare;
          firstNode.vy -= ny * impulse * firstShare;
          secondNode.vx += nx * impulse * secondShare;
          secondNode.vy += ny * impulse * secondShare;
        }
      }
    }
  }

  // Keep the force system centered on itself so it cannot introduce a
  // constant screen-direction drift.
  const center = [...nodes.values()].reduce((sum, node) => ({
    x: sum.x + node.x,
    y: sum.y + node.y
  }), { x: 0, y: 0 });
  center.x /= nodes.size;
  center.y /= nodes.size;

  const dampedVelocity = [...nodes.values()].reduce((sum, node) => {
    node.vx += (center.x - node.x) * 0.00035;
    node.vy += (center.y - node.y) * 0.00035;
    node.vx *= 0.82;
    node.vy *= 0.82;
    return { x: sum.x + node.vx, y: sum.y + node.vy };
  }, { x: 0, y: 0 });
  dampedVelocity.x /= nodes.size;
  dampedVelocity.y /= nodes.size;

  // Pairwise forces should cancel, but rounding and collision corrections can
  // accumulate a tiny net velocity. Remove only that shared drift.
  nodes.forEach((node) => {
    node.vx -= dampedVelocity.x;
    node.vy -= dampedVelocity.y;
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
  const previousPeople = new Map(state.people.map((person) => [person.id, person]));
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

  if (!state.positions.size) {
    seedPositions();
    fitToNetwork();
  } else {
    const existing = new Set(state.people.map((person) => person.id));
    state.positions.forEach((value, id) => {
      if (!existing.has(id)) state.positions.delete(id);
    });
    state.people.forEach((person, index) => {
      if (!state.positions.has(person.id)) {
        const anchor = person.father ?? person.mother ?? person.spouses[0];
        const source = anchor !== undefined ? state.positions.get(anchor) : null;
        state.positions.set(person.id, {
          x: source ? source.x + 100 : 500 + index * 90,
          y: source ? source.y + 100 : 400,
          vx: 0,
          vy: 0
        });
      }
    });
    if (previousPeople.size === 1 && state.people.length > 1) fitToNetwork();
  }
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
