document.documentElement.lang = navigator.language;
for (const e of document.getElementsByClassName('i18n')) {
  e.textContent = browser.i18n.getMessage(e.textContent) ?? e.textContent;
}

const byId = id => document.getElementById(id);

let popupArgs;
let isAutoTitle = false;
let selectedParents = [];
const $title = byId('title');
const $parent = byId('parent');
const $sort = byId('sort');
const $tag = byId('tag');
const $placesQuery = byId('placesQuery');
const $all = document.getElementsByClassName('q')

// Folder tree
const TREE_OPEN_KEYS = [' ', 'Enter'];

// NOTE: indent = 0.5 is default padding in CSS.
const addTree = (tree, f, parentNode = null, indent = 0.5) => {
  if (!tree) return;
  for (const t of tree) {
    const o = document.createElement('OPTION');
    o.value = t.id;
    o.id = `p-${t.id}`;
    o.textContent = `${t.title}`;
    o.className = 'folder';
    o.style.paddingLeft = `${indent}em`;
    o.setAttribute('data-parent', parentNode?.id);
    if (parentNode) {
      o.classList.add('hidden');
    }
    f.appendChild(o);
    addTree(t.children, f, t, indent + 1);
  }
};

const openTree = id => {
  const t = byId(`p-${id}`);
  if (!t) return {};
  if (t.getAttribute('data-open')) return t;
  t.setAttribute('data-open', true);
  const children = Array.from($parent.options)
    .filter(option => option.getAttribute('data-parent') === id);
  for (const c of children) {
    c.classList.remove('hidden');
  }
  openTree(t.getAttribute('data-parent'));
  return t;
};

const setParentMultiple = b => {
  if (b) {
    $parent.setAttribute('multiple', 'multiple');
  } else {
    $parent.removeAttribute('multiple');
  }
};

const onSelectParent = () => {
  const isMultiple = 2 < $parent.selectedIndex;
  setParentMultiple(isMultiple);
  selectedParents = isMultiple ? Array.from($parent.options)
    .filter(option => option.selected)
    .map(option => option.value) : [$parent.value];
  setPlacesQuery();
};

// Title
const createTitle = () => {
  const items = [];
  for (const id of ['sort', 'terms', 'tag']) {
    const f = byId(id);
    if (!f?.value) continue;
    if (id === 'sort') {
      const fmt = browser.i18n.getMessage('sortBy');
      const value = f.options[f.selectedIndex].text;
      items.push(fmt.replace(/value/, value));
    } else {
      const name = browser.i18n.getMessage(id);
      items.push(`${name}:${f.value}`);
    }
  }
  return items.join(', ');
};

const autoTitle = () => {
  if (!isAutoTitle) return;
  $title.value = createTitle();
};

const checkTitle = () => {
  isAutoTitle = !$title.value || $title.value === createTitle();
};

// Load / Save
const getPlacesQueryParams = () => {
  const p = new URLSearchParams($placesQuery.value.replace(/^place:/, ''));
  const q = { parent: [] };
  for (const [k, v] of p.entries()) {
    if (Array.isArray(q[k])) {
      q[k].push(v);
    } else {
      q[k] = v;
    }
  }
  return q;
};

const setPlacesQuery = () => {
  const q = getPlacesQueryParams();
  for (const i of $all) {
    q[i.id] = i.value;
  }
  q.parent = selectedParents;
  switch (q.parent?.[0]) {
    case '':
      delete q.type;
      delete q.queryType;
      delete q.parent;
      break;
    case 'history':
      q.queryType = '0';
      delete q.parent;
      delete q.type;
      break;
    case 'tags':
      q.type = '6';
      delete q.parent;
      delete q.queryType;
      break;
    default:
      delete q.type;
      delete q.queryType;
      break;
  }
  for (const [k,v] of Object.entries(q)) {
    if (!v) delete q[k];
  }
  const searchParams = new URLSearchParams();
  for (const [k, v] of Object.entries(q)) {
    for (const i of [v].flat()) {
      searchParams.append(k, i);
    }
  }
  const url = 'place:' + searchParams.toString();
  $placesQuery.value = url;
};

const setFormValues = () => {
  const q = getPlacesQueryParams();
  for (const i of $all) {
    i.value = q[i.id] ?? '';
  }
  $parent.selectedIndex = -1;
  setParentMultiple(1 < q.parent?.length);
  selectedParents = q.parent;
  for (const p of q.parent) {
    (byId(`p-${p}`) ?? {}).selected = true;
  }
  switch (q.type) {
    case '6':
      $parent.value = 'tags';
      break;
    default:
      if (!q.parent?.[0]) {
        $parent.value = '';
      }
  }
  switch (q.queryType) {
    case '0':
      $parent.value = 'history';
      break;
    case '1':
      if (!q.parent?.[0]) {
        $parent.value = popupArgs.tree[0].id;
      }
      break;
  }
};

// Event handler
let isChanging = false;
const onChangeParams = e => {
  if (e.target === $title) {
    checkTitle();
    return;
  }
  if (isChanging) return;
  isChanging = true;
  if (e.target.classList.contains('q')) {
    autoTitle();
    setPlacesQuery();
  } else if (e.target === $placesQuery) {
    checkTitle();
    setFormValues();
    autoTitle();
  }
  requestAnimationFrame(() => {
    isChanging = false;
  });
};

const onSubmit = async () => {
  // Do not fix query to save any query.
  // setPlacesQuery();
  const bookmark = {
    parentId: popupArgs.bookmark.parentId,
    title: $title.value,
    url: $placesQuery.value,
  };
  if (popupArgs.bookmark?.id) {
    bookmark.id = popupArgs.bookmark.id;
  }
  await browser.runtime.sendMessage({
    method: 'put',
    bookmark: bookmark,
  });
  close();
};

addEventListener('input', onChangeParams);
addEventListener('change', onChangeParams);
$parent.addEventListener('change', onSelectParent);
$parent.addEventListener('click', e => openTree(e.target.value));
$parent.addEventListener('keydown', e => TREE_OPEN_KEYS.includes(e.key) && openTree(e.target.value));
$parent.addEventListener('focus', () => $parent.parentNode.scrollTo(0, 0));
byId('submit').addEventListener('click', onSubmit);

// Main
const init = async () => {
  const pre = await browser.runtime.sendMessage({ method: 'pre' });

  if (pre.menuItemId === 'bookmarks_query_edit') {
    byId('submit').textContent = browser.i18n.getMessage('updateRestartRequired');
  }

  popupArgs = await browser.runtime.sendMessage({ method: 'get' });

  // Setup parent tree
  const f = document.createDocumentFragment();
  addTree(popupArgs.tree, f);
  $parent.appendChild(f);

  // Setup default parameters
  if (popupArgs.bookmark.id) {
    $title.value = popupArgs.bookmark.title;
    $placesQuery.value = popupArgs.bookmark.url;
    setFormValues();
  } else {
    selectedParents = [popupArgs.bookmark.parentId];
    $parent.value = selectedParents[0];
    setPlacesQuery();
  }
  for (const p of selectedParents) {
    openTree(p).selected = true;
  }
  checkTitle();

  // After initialized
  $title.focus();
  $parent.classList.remove('loading');
};
init();

