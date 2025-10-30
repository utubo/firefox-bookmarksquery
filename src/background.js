"use strict";

browser.menus.create({
  id: 'bookmarks_query_add',
  contexts: ['bookmark'],
  title: browser.i18n.getMessage('addQuery'),
});

browser.menus.create({
  id: 'bookmarks_query_edit',
  contexts: ['bookmark'],
  title: browser.i18n.getMessage('editQuery'),
  visible: false,
});

browser.menus.onShown.addListener(async info => {
  if (info.contexts[0] !== 'bookmark') return;
  const [bookmark] = await browser.bookmarks.get(info.bookmarkId);
  const isQuery = bookmark.type === 'bookmark' &&  bookmark.url.startsWith('place:');
  browser.menus.update('bookmarks_query_add', { visible: !isQuery });
  browser.menus.update('bookmarks_query_edit', { visible: isQuery });
  browser.menus.refresh();
});

let bookmarkId;
let menuItemId;

browser.menus.onClicked.addListener(info => {
  bookmarkId = info.bookmarkId;
  menuItemId = info.menuItemId;
  browser.action.openPopup();
});

const createTree = nodes => {
  const tree = [];
  for (const node of nodes ?? []) {
    if (node.type !== 'folder') continue;
    tree.push({
      id: node.id,
      title: node.title,
      children: createTree(node.children),
    });
  }
  return tree;
}

const createParams = async () => {
  const tree = createTree(await browser.bookmarks.getTree());
  tree[0].title = browser.i18n.getMessage('allBookmarks');
  tree[0].type = 'folder';
  const bookmark = bookmarkId && (await browser.bookmarks.get(bookmarkId))[0] || tree[0];
  const parentId = bookmark.type === 'folder'
    ? bookmark.id
    : bookmark.parentId ?? tree[0].id;
  return {
    bookmark: {
      parentId: parentId,
      id: menuItemId === 'bookmarks_query_edit' ? bookmark.id : '',
      title: bookmark.title,
      url: bookmark.url,
    },
    tree: tree,
  };
};

const msgHandler = async (msg, _, sendResponse) => {
  switch (msg.method) {
    case 'pre':
      sendResponse({ menuItemId: menuItemId });
      break;
    case 'get':
      sendResponse(await createParams());
      break;
    case 'put':
      if (msg.bookmark.id) {
        await browser.bookmarks.update(msg.bookmark.id, {
          title: msg.bookmark.title,
          url: msg.bookmark.url,
        });
      } else {
        await browser.bookmarks.create(msg.bookmark);
      }
      sendResponse(null);
      break;
  }
};

browser.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  msgHandler(msg, sender, sendResponse);
  return true;
});
