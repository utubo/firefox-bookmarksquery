document.documentElement.lang = navigator.language;
for (const e of document.getElementsByClassName('i18n')) {
  e.textContent = browser.i18n.getMessage(e.textContent) ?? e.textContent;
}

let params;
let isAutoTitle = false;
const $title = document.getElementById('title');
const $parent = document.getElementById('parent');
const $sort = document.getElementById('sort');
const $query = document.getElementById('query');
const $tag = document.getElementById('tag');

const addTree = (tree, f, indent) => {
  if (!tree) return;
  for (const t of tree) {
    const o = document.createElement('OPTION');
    o.value = t.id;
    o.textContent = `${indent}📂${t.title}`;
    f.appendChild(o);
    addTree(t.children, f, indent + '\u2003');
  }
};

const createTitle = () => {
  const items = [];
  for (const id of ['sort', 'query', 'tag']) {
    const f = document.getElementById(id);
    if (!f?.value) continue;
    if (id === 'sort') {
      const fmt = browser.i18n.getMessage('sort by');
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

// Event handler
document.getElementById('submit').addEventListener('click', async () => {
  const q = {};
  for (const i of document.getElementsByClassName('q')) {
    if (i.value) q[i.id] = i.value;
  }
  if (q.parent === 'history') {
    q.type = '2';
    delete q.parent;
  }
  const bookmark = {
    parentId: params.bookmark.parentId,
    title: $title.value,
    url: 'place:' + (new URLSearchParams(q)).toString(),
  };
  if (params.bookmark?.id) {
    bookmark.id = params.bookmark.id;
  }
  await browser.runtime.sendMessage({
    method: 'put',
    bookmark: bookmark,
  });
  close();
});

$title.addEventListener('input', checkTitle);
$sort.addEventListener('change', autoTitle);
$query.addEventListener('input', autoTitle);
$tag.addEventListener('input', autoTitle);

// Main
const init = async () => {
  params = await browser.runtime.sendMessage({ method: 'get' });

  // Setup parent tree
  const f = document.createDocumentFragment();
  addTree(params.tree, f, '');
  $parent.appendChild(f);

  // Setup default parameters
  $parent.value = params.bookmark.parentId;
  if (params.bookmark.id) {
    $title.value = params.bookmark.title;
    const q = new URLSearchParams(params.bookmark.url.replace('place:', ''));
    const p = {};
    for (const [k, v] of q.entries()) {
      p[k] = v;
      const f = document.getElementById(k);
      if (f) {
        f.value = v;
      }
    }
    if (p.type === '2') {
      $parent.value = 'history';
    }
  }
  checkTitle();
};
init();
