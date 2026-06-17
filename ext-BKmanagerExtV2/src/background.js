let wiserBookmarkID = null;
const DAYMILLIS = 86400000;

function getNextMillisTill(hrIn24, min) {
  const now = new Date();
  let millisTill = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hrIn24, min, 0, 0) - now;
  if (millisTill < 0) millisTill += DAYMILLIS;
  return millisTill;
}


// Set 12pm timer
/*
setTimeout(() => {
  console.log("Logging start 12pm code");
  daily12pm();
  setInterval(daily12pm, DAYMILLIS);
}, getNextMillisTill(12, 0));
*/
function isFutureBookmark(title) {
  const parts = title.split(" ");
  return Date.parse(parts[parts.length - 1]) > new Date();
}

function getTitleWithoutDate(title) {
  const parts = title.split(" ");
  const last = parts[parts.length - 1];
  return Date.parse(last) ? parts.slice(0, -1).join(" ") : title;
}

function daily12pm() {
  sendWiser1pm();
}

function sendWiser1pm() {
  chrome.bookmarks.search({ title: "wiser" }, (results) => {
    if (!results[0]?.url && results[0]?.id) {
      chrome.bookmarks.getSubTree(results[0].id, (tree) => {
        let mailBody = "";
        const lineBreak = "%0D%0A"; // CRLF for mailto

        for (const folder of tree[0].children) {
          if (isFutureBookmark(folder.title)) continue;
          if (folder.url) {
            mailBody += `${lineBreak}${encodeURIComponent(getTitleWithoutDate(folder.title))}${lineBreak}${encodeURIComponent(folder.url)}${lineBreak}`;
          } else {
            mailBody += `${lineBreak}${encodeURIComponent(getTitleWithoutDate(folder.title) + ` (${folder.children.length})`)}${lineBreak}`;
            for (const child of folder.children) {
              mailBody += `${encodeURIComponent(child.title)}${lineBreak}${encodeURIComponent(child.url)}${lineBreak}`;
            }
          }
        }

        if (mailBody) {
          chrome.tabs.create({
            url: `mailto:bnxx6778@gmail.com?subject=MYBK Daily Next&body=${mailBody}`
          });
        }
      });
    }
  });
}

chrome.bookmarks.search({ title: "wiser" }, (results) => {
  if (results[0]) wiserBookmarkID = results[0].id;
});

/* dont work, maybe use userscript when ready
function getTitle(code) { eval('alert('+code+')'); }

 function runBookmarkletCode(bookmarkId, tabId){
	console.log(bookmarkId+" runBookmarkId");
	chrome.bookmarks.get(bookmarkId, (results) => {
	  console.log(results);
	  chrome.scripting.executeScript({
	    target: { tabId },
	    world: 'MAIN',
	    func:  getTitle(results[0].url);
	  }) 
	});
}*/
// MESSAGE HANDLING
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const { data, id, title, url, parentId, json } = message;

  switch (data) {
    case "runCode":
	const chromeTabId = sender.tab && sender.tab.id;
	const codeToRun = id; 
	console.log('[SW] ? Received runCode :', id, 'from tab', chromeTabId);
	 chrome.userScripts.execute({injectImmediately: true,target: {tabId: chromeTabId}, js:[{code:id}]});

	/* dont work, maybe use userscript when ready */
	  //runBookmarkletCode(id+"", tabId);
  break;
	  
    case "allbkmarks":
	    chrome.bookmarks.search({}, (results)=>
		sendResponse({data: results}));  
	break;
     	  
	  
    case "saveBkmark":
      if (id && title) {
        chrome.bookmarks.update(id, { title }, r => sendResponse({ data: `Updated title: ${title}` }));
      } else if (id && url) {
        chrome.bookmarks.update(id, { url }, r => sendResponse({ data: `Updated URL: ${url}` }));
      }
      break;

    case "delBkmark":
      if (id) chrome.bookmarks.remove(id, () => sendResponse({ data: `Deleted: ${title}` }));
      break;

    case "delBkmarkFolder":
      if (id) chrome.bookmarks.removeTree(id, () => sendResponse({ data: `Deleted folder: ${title}` }));
      break;

    case "getFolderChildrenByTitle":
      if (title) {
        chrome.bookmarks.search({ title }, (results) => {
          if (!results[0]?.url && results[0]?.id) {
            chrome.bookmarks.getSubTree(results[0].id, (res) => sendResponse({ data: res[0].children }));
          }
        });
      }
      break;

/* not used? */
    case "getFolderChildrenByID":
      if (id) {
        chrome.bookmarks.getSubTree(id, (res) => sendResponse({ data: res[0].children }));
      }
      break;
/* not used? */
    case "moveBookmarkToFolder":
      if (id && parentId) {
        chrome.bookmarks.move(id, { parentId }, (res) => sendResponse({ data: res }));
      }
      break;
/* not used? */
    case "createFolder":
      if (title && wiserBookmarkID) {
        chrome.bookmarks.create({ parentId: wiserBookmarkID, title, index: 0 }, (res) => sendResponse({ data: res }));
      }
      break;
/* not used? */
    case "createFolderAndMoveBookmarkToFolder":
      if (title && id && wiserBookmarkID) {
        chrome.bookmarks.create({ parentId: wiserBookmarkID, title, index: 0 }, (folder) => {
          chrome.bookmarks.move(id, { parentId: folder.id }, (res) => sendResponse({ data: res }));
        });
      }
      break;


    case "removeTree":
      if (id) {
        chrome.bookmarks.removeTree(id, (res) => sendResponse({ data: res }));
      }
      break;

    case "createBookmarkInFolder":
      if (url && parentId) {
        chrome.bookmarks.create({ parentId, url, index: 0 }, (res) => sendResponse({ data: res }));
      }
      break;

    default:
      sendResponse({ error: "Unknown message type" });
  }

  return true; // Needed for async sendResponse
});
