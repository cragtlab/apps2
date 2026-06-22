// Refactored content.js to show 3 sections: #1 bookmarklets by domain, #2 late wiser bookmarks with open/snooze actions, #3 coder div


init();
function init(){
  if (!document || !document.body) {
    console.warn('No body yet. Retrying in 50ms...');
    return setTimeout(init, 50);
  }
  initializeBookmarkManager();
}

function initializeBookmarkManager() {
  setupBookmarkSidebar();
  fetchAndRenderBookmarks();
}

function setupBookmarkSidebar() {
  const sidebar = document.createElement('div');
  sidebar.id = 'mybookmarksDiv';
  sidebar.style = 'opacity: 0.8; background:lightgrey; width:28%; height:100%; position:fixed; right:0; top:0; overflow:auto; z-index:999999; padding:10px; box-shadow: -2px 0 6px rgba(0,0,0,0.2)';
  sidebar.innerHTML = `
    <div style="display:flex; justify-content:space-between;">
      <button id="closeSidebarBtn" style="color:red" title="Close">X</button>
      <input type="text" id="bookmarkSearch" placeholder="Search bookmarklets..." style="width:100%; padding: 4px;" />
    </div>
    <div id="bookmarkletListContainer"></div>
    <hr/>
    <div id="wiserListContainer"></div>
    <hr/>
    <div id="coderDiv"></div>`;

  document.body.appendChild(sidebar);

  document.getElementById('closeSidebarBtn').addEventListener('mouseover', () => {
    sidebar.style.display = 'none';
    document.getElementById('minDiv').style.display = 'block';
  });

  

  const minDiv = document.createElement('div');
  minDiv.id = 'minDiv';
  minDiv.style = 'display:block; position:fixed; top:0; right:0; background:lightgrey; padding:5px; z-index:999998;';
  minDiv.innerHTML = `<input type="button" value="?" title="Show Bookmarks" style="width:100%;" />`;
  minDiv.querySelector('input').addEventListener('mouseover', () => {
    sidebar.style.display = 'block';
    minDiv.style.display = 'none';
  });
  document.body.appendChild(minDiv);
}



function fetchAndRenderBookmarks() {
  const today = new Date();
  const host = window.location.hostname.replace(/^www\./, "");

  // Section 1: Bookmarklets
  chrome.runtime.sendMessage({ data: "allbkmarks"}, (results) => {
    const container = document.getElementById("bookmarkletListContainer");
    const searchInput = document.getElementById("bookmarkSearch");
    const all = results.data.filter(b => (b.url +"").startsWith("javascript:")); //  filter js since cannot via bookmark.search{url:javascipt:*}
  
	  
    const render = (filter = "") => {
      container.innerHTML = "";

      for (const b of all.filter(b => urlMatched(b, filter))) {
	const row = document.createElement('div');
        const link = document.createElement('a');	
	// add debug/edit button 
	const debugBtn = document.createElement('button');
	debugBtn.textContent = '🔧';
	debugBtn.title = 'Debug';
	debugBtn.onclick = () => {
		myDebugTxt.value=beautifyCode(link.href);
		myDebugTxt.focus();
		
	};
	row.appendChild(debugBtn);
	// add link next

	link.href = b.url;
	link.textContent = b.title;
	row.appendChild(link);
	style="padding:4px; border-bottom:1px solid #ccc;";
	if(b.title.endsWith("!")){
	  style+=" font-weight: bold;";
	}
        row.style = style; 
        container.appendChild(row);
	
	bkDomain=b.title.split(" ").pop().replace(/[!@*]/gi,""); 
	//if((b.title).endsWith("!") && b.title.toLowerCase().includes(location.hostname.split('.').slice(-2).join('.')) ){
	if(b.title.endsWith("!") && location.hostname.endsWith(bkDomain)){
		console.log("autorunning " + b.title);
		chrome.runtime.sendMessage({data:"runCode", id: beautifyCode(link.href)});
	}
      } // const b
    }; // const render

    searchInput.addEventListener('input', e => render(e.target.value));
    render(null);
  });

  function urlMatched(b, filter){
	if(filter){
		return b.title.includes(filter.toLowerCase());
	}else{
		matched = location.hostname.endsWith(b.title.split(" ").pop().replace(/[!@*]/gi,""));
		//if(matched){ console.log("null filter for "+b.title + " // " + b.href);}
		return matched;
	}
  }
  
  function beautifyCode(code) {
	  code=code.replaceAll("%27","'").replaceAll("%20"," ").replaceAll("%22","\"").replaceAll("%3E",">").replaceAll("%3C","<");
  let indentLevel = 0;

  // Split code into tokens by ; and process each token
  let tokens = code.split(/(;|\{|\})/).filter(token => token.trim() !== '').map(token => token.trim());

  let beautifiedCode = tokens.map(token => {
    if (token === '}') {
      indentLevel--;
    }

    let indentedLine = '  '.repeat(indentLevel) + token;
    
    if (token === '{') {
      indentLevel++;
    }
    
    if (token === ';') {
      indentedLine += '\n';
    }

    return indentedLine;
  }).join('');

  // Ensure proper new lines
  beautifiedCode = beautifiedCode.replace(/}\s*/g, '}\n').replace(/{\s*/g, '{\n');

  return beautifiedCode;
}
  // Section 2: Wiser due
chrome.runtime.sendMessage({ data: "getFolderChildrenByTitle", title: "wiser" }, (response) => {
  const wiserDiv = document.getElementById("wiserListContainer");
  const bookmarks = response?.data || [];
  const today = new Date();

  const dueToday = bookmarks.filter(b => {
    const parts = b.title.split(" ");
    const last = parts[parts.length - 1];
    const date = Date.parse(last);
    return isNaN(date) || new Date(date) <= today;
  });

  wiserDiv.innerHTML = '';

  if (dueToday.length === 0) {
    wiserDiv.textContent = 'No due bookmarks.';
    return;
  }

  let currentSnoozeIndex = 0;
  let popupWindow = null;

  function openAndSnooze(multiplier) {
    if (currentSnoozeIndex > 0 && currentSnoozeIndex <= dueToday.length) {
      const current = dueToday[currentSnoozeIndex - 1];
      const snoozeDays = multiplier * (5 + Math.floor(Math.random() * 3));
      const newDate = new Date(Date.now() + snoozeDays * 86400000).toISOString().split('T')[0];
      const newTitle = updateTitleWithDate(current.title, newDate);

      chrome.runtime.sendMessage({ data: 'saveBkmark', id: current.id, title: newTitle }, () => {
        const rowEl = document.getElementById(`row-${current.id}`);
        if (rowEl) rowEl.style.opacity = 0.5;
      });
    }

    if (currentSnoozeIndex < dueToday.length) {
      const next = dueToday[currentSnoozeIndex];
	    // TODO close snoozeWindow1, 2. .. onwards?
      if(next.children){ // folder, open all
	    i = 0;
	    for(child of next.children){
		// blank so wont overlap when opening 2 folder in a row without closing all
		window.open(child.url, '_blank', 'top='+(i*20+20)+',left='+(i*20)+',width=1200,height=900');
		i++;
	    }
	    
	    //popupWindow2 = window.open(next.url, 'snoozeWindow2', 'top=40,left=20,width=1200,height=900');
      
      }else{
        popupWindow = window.open(next.url, 'snoozeWindow0', 'top=20,width=1200,height=900');
      }	
      
      currentSnoozeIndex++;
    } else if (currentSnoozeIndex === dueToday.length) {
      if (popupWindow && !popupWindow.closed) {
        popupWindow.close();
      }
      currentSnoozeIndex++;
    }
  }

  const buttonConfigs = [
    { label: '1x', multiplier: 1 },
    { label: '2x', multiplier: 2 },
    { label: '4x', multiplier: 4 },
    { label: '8x', multiplier: 8 }
  ];

  buttonConfigs.forEach(cfg => {
    const btn = document.createElement('button');
    btn.textContent = cfg.label;
    btn.style = 'margin-right: 6px; margin-bottom: 10px;';
    btn.onclick = () => openAndSnooze(cfg.multiplier);
    wiserDiv.appendChild(btn);
  });

  for (const b of dueToday) {
    const row = document.createElement('div');
    row.id = `row-${b.id}`;
    row.style = "padding:4px; border-bottom:1px solid #ccc; display:flex; justify-content:space-between; align-items:center; gap:6px;";

    const link = document.createElement('a');
    link.href = b.url;
    link.textContent = b.title;
    link.target = '_blank';
    link.style = 'flex:1;';
     row.appendChild(link);
    
     if(b.children){
	// dont show delete for folder? or delete tree?
     }else{
    const deleteBtn = document.createElement('button');
    deleteBtn.textContent = '🗑';
    deleteBtn.title = 'Delete';
    deleteBtn.onclick = () => {
      if (confirm(`Delete bookmark:\n${b.title}?`)) {
        chrome.runtime.sendMessage({ data: 'delBkmark', id: b.id }, () => {
          const rowEl = document.getElementById(`row-${b.id}`);
          if (rowEl) rowEl.remove();
        });
      }
    };
     row.appendChild(deleteBtn);
	}

   
    wiserDiv.appendChild(row);
  }
});

//end section 2 - wiser
}

//// section 3 - coder
var debugDiv=document.createElement("div");
debugDiv.innerHTML="<textarea rows='3' id='myDebugDOM' style='width:96%; background:black;color:white'></textarea>"
  + "RClick to toggle hoverMode. <input type='button' value='Up' onclick='upElement()'> <input type='button' value='Down' onclick='downElement()'>"
  +"<input type='button' value='Add2Code' onclick='add2Code()'>"  
  /*+"<select onchange='myDebugTxt.value+=\"\\n\"+this.value' style='width:99%' id='myDebugDOMSelect'></select>"*/
  +"<textarea id='myDebugTxt' style='font-size:small;width:96%;background:black;color:white;white-space: nowrap' rows='8'>"
  +"javascript:if(false==location.href.startsWith('"+location.href+"')){throw new Error('wrong url')}\n"  
  +"</textarea>"  
  +"<input type='button' value='Run' onclick='runMyDebugScript()'>"
  +"<input type='button' value='+Code' onclick='codes={\"1-textContent\":\""+escape("Array.from(document.querySelectorAll(\"button\")).filter(e=>e.textContent.trim()===\"xxx\")")+"\""
  +",\"2-indexOf\":\"Array.indexOf\""
  +",\"3-xhr\":\"xhr\""
  +",\"4-copy to clipboard\":\""+escape("copyToClipboard(out);  function copyToClipboard(str){if (navigator && navigator.clipboard && navigator.clipboard.writeText){return navigator.clipboard.writeText(str).then(() => {alert(\"successfully copied\");}).catch((e) => {alert(\"something went wrong.\"+e); });}}")+"\""
  +",\"5-link loop\":\""+escape("all = [];for (asset of document.querySelectorAll(\"a[href*='/token/']\")) {        data = asset.href.split(\":\");        tokenid = data[2];          if (isNaN(tokenid) == false && all.indexOf(tokenid) < 0) {            all.push(tokenid);        }    }alert(all.join(\",\"))")+"\""
  +",\"6-setNativeValue(elem,val)\":\""+escape("function setNativeValue(element, value) {    let lastValue = element.value;    element.value = value;    let event = new Event(\"input\", { target: element, bubbles: true });        event.simulated = true;        let tracker = element._valueTracker;    if (tracker) {        tracker.setValue(lastValue);    }    element.dispatchEvent(event);}")+"\""
  +",\"7-click game(refer to auto next in winkhunt)\":\"refer to auto next in winkhunt bookmark\""
  +",\"8-table(TODO)\":\"TODO\""
  +"};txt=\"\";for(i in codes){txt+=i+\"\\n\";}val=prompt(txt);if(val){myDebugTxt.value+=unescape(codes[Array.from(Object.keys(codes))[val*1-1]])+\"\\n\"}'>"
  +"<input type='button' value='FrmFiller' onclick='elemTypes=[\"input\",\"select\"];for(e of elemTypes){for(i of document.querySelectorAll(e)){if(i.name && i.value){myDebugTxt.value+=\"document.getElementsByName(\\\"\" + i.name + \"\\\")[0].value=\\\"\"+i.value+\"\\\";\";}}}\'>"
  // use document.write('<input name="j b" value=k>') and write the above text to debug in new page the text
//do  +"<input type='button' value='Close Tab' onclick='window.close()'>"
  +"Logs<input type='button' value='Clear' onclick='clearDebugLogs()'>"
  +"<br/><div id='myDebugDiv'>R-Click DOM to capture</div>"
coderDiv.append(debugDiv); 
//// end section 3 - coder

function updateTitleWithDate(title, newDate) {
  const parts = title.trim().split(" ");
  const last = parts[parts.length - 1];
  return isValidDate(last) ? parts.slice(0, -1).join(" ") + " " + newDate : title + " " + newDate;
}

function isValidDate(str) {
  return !isNaN(Date.parse(str));
}
