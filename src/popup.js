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
const $query = byId('query');
const $tag = byId('tag');
const $bookmarkURL = byId('bookmarkURL');

// Folder tree
const addTree = (tree, f, parentNode = null, indent = '') => {
  if (!tree) return;
  for (const t of tree) {
    const o = document.createElement('OPTION');
    o.value = t.id;
    o.id = `p-${t.id}`;
    o.textContent = `${indent}📂${t.title}`;
    o.setAttribute('data-parent', parentNode?.id);
    o.style.display = !parentNode ? 'block' : 'none';
    f.appendChild(o);
    addTree(t.children, f, t, indent + '\u2003');
  }
};

const openTree = id => {
  const t = byId(`p-${id}`);
  if (!t) return {};
  if (t.getAttribute('data-open')) return t;
  t.setAttribute('data-open', true);
  const p = t.getAttribute('data-parent');
  const children = Array.from($parent.options)
    .filter(option => option.getAttribute('data-parent') === id);
  for (const o of children) {
    o.style.display = 'block';
  }
  openTree(p);
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
  let i = $parent.selectedIndex;
  setParentMultiple(2 < i);
  selectedParents = Array.from($parent.options)
    .filter(option => option.selected)
    .map(option => option.value);
  setBookmarkURL();
  openTree($parent.options[i].value);
};

// Title
const createTitle = () => {
  const items = [];
  for (const id of ['sort', 'query', 'tag']) {
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
const getURLParams = () => {
  const p = new URLSearchParams($bookmarkURL.value.replace(/^place:/, ''));
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

const setBookmarkURL = () => {
  const q = getURLParams();
  for (const i of document.getElementsByClassName('q')) {
    if (i.value) q[i.id] = i.value;
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
  const searchParams = new URLSearchParams();
  for (const [k, v] of Object.entries(q)) {
    for (const i of [v].flat()) {
      searchParams.append(k, i);
    }
  }
  const url = 'place:' + searchParams.toString();
  $bookmarkURL.value = url;
};

const setFormValues = () => {
  const q = getURLParams();
  for (const [k, v] of Object.entries(q)) {
    (byId(k) ?? {}).value = v;
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
let isOnChangeParams = false;
const onChangeParams = e => {
  if (isOnChangeParams) return;
  isOnChangeParams = true;
  requestAnimationFrame(() => {
    isOnChangeParams = false;
  });
  if (e.target.classList.contains('q')) {
    autoTitle();
    setBookmarkURL();
  } else if (e.target.id = 'bookmarkURL') {
    checkTitle();
    setFormValues();
    autoTitle();
  }
};

const onSubmit = async () => {
  // Do not fix query to save any query.
  // setBookmarkURL();
  const bookmark = {
    parentId: popupArgs.bookmark.parentId,
    title: $title.value,
    url: $bookmarkURL.value,
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
$parent.addEventListener('focus', () => $parent.parentNode.scrollTo(0, 0));
byId('submit').addEventListener('click', onSubmit);

// Main
const init = async () => {
  popupArgs = await browser.runtime.sendMessage({ method: 'get' });

  // Setup parent tree
  const f = document.createDocumentFragment();
  addTree(popupArgs.tree, f);
  $parent.appendChild(f);

  // Setup default parameters
  if (popupArgs.bookmark.id) {
    $title.value = popupArgs.bookmark.title;
    $bookmarkURL.value = popupArgs.bookmark.url;
    setFormValues();
    byId('restartRequired').style.display = 'inline';
  } else {
    selectedParents = [popupArgs.bookmark.parentId];
    $parent.value = selectedParents[0];
    setBookmarkURL();
  }
  for (const p of selectedParents) {
    openTree(p).selected = true;
  }
  checkTitle();
};
init();

