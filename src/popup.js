document.documentElement.lang = navigator.language;
for (const e of document.getElementsByClassName('i18n')) {
  e.textContent = browser.i18n.getMessage(e.textContent) ?? e.textContent;
}

const byId = id => document.getElementById(id);

let params;
let isAutoTitle = false;
const $title = byId('title');
const $parent = byId('parent');
const $sort = byId('sort');
const $query = byId('query');
const $tag = byId('tag');
const $bookmarkURL = byId('bookmarkURL');

const addTree = (tree, f, parent = null, indent = '') => {
  if (!tree) return;
  for (const t of tree) {
    const o = document.createElement('OPTION');
    o.value = t.id;
    o.textContent = `${indent}📂${t.title}`;
    o.setAttribute('data-parent', parent?.id);
    o.style.display = (!parent || parent.opened) ? 'block' : 'none';
    f.appendChild(o);
    addTree(t.children, f, t, indent + '\u2003');
  }
};

const openTree = () => {
  let i = $parent.selectedIndex;
  while (true) {
    i ++;
    const o = $parent.options[i];
    if (o?.getAttribute('data-parent') !== $parent.value) return;
    o.style.display = 'block';
  }
}

const findParent = tree => {
  if (!tree) return;
  for (const t of tree) {
    if (t.id === params.bookmark.parentId || findParent(t.children)) {
      t.opened = true;
      return true;
    }
  }
}

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

const getURLParams = () => {
  const p = new URLSearchParams($bookmarkURL.value.replace(/^place:/, ''));
  const q = {};
  for (const [k, v] of p.entries()) {
    q[k] = v;
  }
  return q;
}

const setBookmarkURL = () => {
  const q = getURLParams();
  for (const i of document.getElementsByClassName('q')) {
    if (i.value) q[i.id] = i.value;
  }
  switch (q.parent) {
    case params.tree[0].id:
      q.type = '1';
      delete q.parent;
      break;
    case 'history':
      q.type = '2';
      delete q.parent;
      break;
    case 'tags':
      q.type = '6';
      delete q.parent;
      break;
    default:
      delete q.type;
      break;
  }
  const url = 'place:' + (new URLSearchParams(q)).toString();
  $bookmarkURL.value = url;
  return url;
}

const setFormValues = () => {
  const q = getURLParams();
  for (const [k, v] of Object.entries(q)) {
    const f = byId(k);
    if (f) {
      f.value = v;
    }
  }
  switch (q.type) {
    case '1':
      if (!q.parent) {
        $parent.value = params.tree[0].id;
      }
      break;
    case '2':
      $parent.value = 'history';
      break;
    case '6':
      $parent.value = 'tags';
      break;
    default:
      if (!q.parent) {
        $parent.value = '';
      }
  }
}

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
}

const onSubmit = async () => {
  // Do not fix query to save any query.
  // const url = setBookmarkURL();
  const bookmark = {
    parentId: params.bookmark.parentId,
    title: $title.value,
    url: $bookmarkURL.value,
  };
  if (params.bookmark?.id) {
    bookmark.id = params.bookmark.id;
  }
  await browser.runtime.sendMessage({
    method: 'put',
    bookmark: bookmark,
  });
  close();
};

// Event handler
addEventListener('input', onChangeParams);
addEventListener('change', onChangeParams);
$parent.addEventListener('change', openTree);
$parent.addEventListener('focus', () => $parent.parentNode.scrollTo(0, 0));
byId('submit').addEventListener('click', onSubmit);

// Main
const init = async () => {
  params = await browser.runtime.sendMessage({ method: 'get' });

  // Setup parent tree
  findParent(params.tree);
  const f = document.createDocumentFragment();
  addTree(params.tree, f);
  $parent.appendChild(f);

  // Setup default parameters
  $parent.value = params.bookmark.parentId;
  if (params.bookmark.id) {
    $title.value = params.bookmark.title;
    $bookmarkURL.value = params.bookmark.url;
    setFormValues();
    byId('restartRequired').style.display = 'inline';
  } else {
    setBookmarkURL();
  }
  checkTitle();
};
init();

