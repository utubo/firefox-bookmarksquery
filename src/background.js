"use strict";

browser.menus.create({
	id: 'bookmark_query_add',
	contexts: ['bookmark'],
	title: browser.i18n.getMessage('Add query'),
});

browser.menus.create({
	id: 'bookmark_query_edit',
	contexts: ['bookmark'],
	title: browser.i18n.getMessage('Edit'),
	visible: false,
});

browser.menus.onShown.addListener(async info => {
	if (info.contexts[0] !== 'bookmark') return;
	const [bookmark] = await browser.bookmarks.get(info.bookmarkId);
	browser.menus.update('bookmark_query_edit', {
		visible: bookmark.type === 'bookmark' &&  bookmark.url.startsWith('place:')
	});
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
	const [bookmark] = await browser.bookmarks.get(bookmarkId);
	const tree = createTree(await browser.bookmarks.getTree());
	tree[0].title = browser.i18n.getMessage('all_bookmarks');
	const parentId = bookmark.type === 'folder'
		? bookmark.id
		: bookmark.parentId ?? tree[0].id;
	return {
		bookmark: {
			parentId: parentId,
			id: menuItemId === 'bookmark_query_edit' ? bookmark.id : '',
			title: bookmark.title,
			url: bookmark.url,
		},
		tree: tree,
	};
};

const msgHandler = async (msg, _, sendResponse) => {
	switch (msg.method) {
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
