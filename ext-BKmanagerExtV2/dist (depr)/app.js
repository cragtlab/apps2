var Board = {
  template:  /*html*/`
     <div class="h-full p-2 grid grid-cols-4 gap-5">
      <div class="col-span-4">
	<label><input type='checkbox' id='sound' @click='setSoundAlert()'> Alarm Sound upon countdown</label> <span id='timerCountdown'></span><span style='display:none' id='timerID'></span>
	
	<br/>Goal (Focus on Process Not Outcome) 
	<br/>
	<input type="text" size="50" class="bg-gray-50 border border-gray-300" value="write 1 article, 1 video, remove 1 useless process, exercise?" id="goalTxt"><button class="bg-blue-100" @click=createGoal()>Create Daily Goals</button>
	<br/>Sample Upgrade Script:<input class="bg-gray-50 border border-gray-300" onclick="this.select()" type="text" value='aa=JSON.parse(localStorage.columns);delete aa["onhold"];aa["onhold"]=[];localStorage.columns=JSON.stringify(aa);'>
      </div>
      <div class="bg-blue-100 p-2" v-for="(tasks, cTitle) in columns">
        <div class="flex justify-between text-gray-600 mb-3">
	   <h3 class="font-bold">{{ cTitle }}</h3>
	   <span @click="openAddModal(cTitle)" class="text-xs cursor-pointer hover:underline">+ Add</span>
	</div>
	
	<draggable @change="setItems" class="flex flex-col px-2 h-full" :list="tasks" group="tasks" animation="200" empty-insert-threshold="20" direction="vertical">
	  <div
	    class="card bg-white shadow-lg p-2 my-2 flex flex-col cursor-move"
            :class="{
              'border-l-4 border-red-300': element.taskColor == 'red',
              'border-l-4 border-yellow-300': element.taskColor == 'yellow',
              'border-l-4 border-green-300': element.taskColor == 'green',
              'border-l-4 border-blue-300': element.taskColor == 'blue',
            }"
            v-for="(element, index) in tasks"
            :id="element.id"
           >

            <span @dblclick="openEditModal(cTitle, element.id)" style="overflow-wrap: break-word;" v-html="createTextLinks(element.title)"></span>

            <span class="controls flex justify-between mt-2 text-gray-600> <!-- opacity-0 transition duration-300" 
             <!-- <div class="flex" title="Edit" @click="openEditModal(cTitle, element.id)">
                <svg class="cursor-pointer" width="17" stroke-width="1.5" height="17" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"> <path d="M20 12V5.74853C20 5.5894 19.9368 5.43679 19.8243 5.32426L16.6757 2.17574C16.5632 2.06321 16.4106 2 16.2515 2H4.6C4.26863 2 4 2.26863 4 2.6V21.4C4 21.7314 4.26863 22 4.6 22H11" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"/> <path d="M8 10H16M8 6H12M8 14H11" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"/> <path d="M16 5.4V2.35355C16 2.15829 16.1583 2 16.3536 2C16.4473 2 16.5372 2.03725 16.6036 2.10355L19.8964 5.39645C19.9628 5.46275 20 5.55268 20 5.64645C20 5.84171 19.8417 6 19.6464 6H16.6C16.2686 6 16 5.73137 16 5.4Z" fill="currentColor" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </div>
	    
	     <div class="flex" title="Open link" @click="doOpen(element.title)">
	        <svg class="cursor-pointer" xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-external-link"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>            
              </div> -->	
              <svg xmlns="http://www.w3.org/2000/svg" @click="removeAt(cTitle, element.id)"
                class="icon icon-tabler icon-tabler-trash cursor-pointer rounded-full hover:bg-red-300 hover:text-white"
                 width="17" height="17" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round">
                <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
                <line x1="4" y1="7" x2="20" y2="7" />
                <line x1="10" y1="11" x2="10" y2="17" />
                <line x1="14" y1="11" x2="14" y2="17" />
                <path d="M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2 -2l1 -12" />
                <path d="M9 7v-3a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v3" />
              </svg>
            </span>
    
          </div>
        </draggable>
	
     </div>

     

      <dialog :open="openDialog" class="w-2/3 mt-10 border-2 border-gray-500 shadow-2xl rounded-lg">
        <div class="flex justify-end mb-2">
          <span @click="openDialog = false" 
            class="cursor-pointer">
            <svg xmlns="http://www.w3.org/2000/svg" class="icon icon-tabler icon-tabler-square-x" width="25" height="25" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round">
              <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
              <rect x="4" y="4" width="16" height="16" rx="2" />
              <path d="M10 10l4 4m0 -4l-4 4" />
            </svg>
          </span>
        </div>
        <form @submit.prevent="submit" class="space-y-4">
          <div class="flex flex-col">
            <label class="text-xs mb-2">Task Title</label>
            <textarea v-model="title" id="diagText" class="bg-gray-100 px-3 py-1 rounded-lg" rows="4" required>
	    </textarea>
          </div>
          <div class="grid grid-cols-5 gap-5 w-full">
            <div class="col-span-1 w-full flex items-center justify-center pr-2">
              <button type="submit"
                class="bg-blue-300 px-3 py-3 w-full uppercase text-xs text-white rounded-lg hover:bg-blue-400">
                submit
              </button>
            </div>
	    <div class="col-span-2 flex flex-col w-full">
              <label class="text-xs mb-2">List</label>
              <select v-model="listSelected" class="bg-gray-100 px-3 py-1 rounded-lg" required>
                <option disabled value="">Please select one</option>
                <option value="backlog">Backlog</option>
                <option value="onhold">On hold</option>
                <option value="inprogress">In progress</option>
                <option value="done">Done</option>
              </select>
            </div>
            <div class="col-span-2 flex flex-col w-full">
              <label class="text-xs mb-2">Color</label>
              <select v-model="taskColor" class="bg-gray-100 px-3 py-1 rounded-lg">
                <option disabled value="">Please select one</option>
                <option value="red">Red</option>
                <option value="yellow">Yellow</option>
                <option value="green">Green</option>
                <option value="blue">Blue</option>
                <option value="null">None</option>
              </select>
            </div>
            
          <div>
        </form>
      </dialog>

    </div>
  `,
  data() {
    return {
      openDialog: false,
      drag: false,
      listSelected: '',
      title: null,
      id: null,
      taskColor: null,
      columns: {}
    };
  },
  created() {
    this.retrieveColumns();
  },
  methods: {
    retrieveColumns() {
      this.initializeColumns();
      this.columns = JSON.parse(localStorage.getItem('columns'));
    },
    initializeColumns() {
      if(!localStorage.getItem('columns')) {
        localStorage.setItem('columns', JSON.stringify({'backlog':[{id:1,title:"Add discount code to checkout page",date:"Sep 14",type:"Feature Request"},{id:2,title:"Provide documentation on integrations",date:"Sep 12"}], 'inprogress':[], 'onhold':[], 'done':[]}));
	//localStorage.setItem('columns', JSON.stringify([{title:"Backlog",tasks:[{id:1,title:"Add discount code to checkout page",date:"Sep 14",type:"Feature Request"},{id:2,title:"Provide documentation on integrations",date:"Sep 12"},{id:3,title:"Design shopping cart dropdown",date:"Sep 9",type:"Design"},{id:4,title:"Add discount code to checkout page",date:"Sep 14",type:"Feature Request"},{id:5,title:"Test checkout flow",date:"Sep 15",type:"QA"}]},{title:"In Progress",tasks:[{id:6,title:"Design shopping cart dropdown",date:"Sep 9",type:"Design"},{id:7,title:"Add discount code to checkout page",date:"Sep 14",type:"Feature Request"},{id:8,title:"Provide documentation on integrations",date:"Sep 12",type:"Backend"}]},{title:"Review",tasks:[{id:9,title:"Provide documentation on integrations",date:"Sep 12"},{id:10,title:"Design shopping cart dropdown",date:"Sep 9",type:"Design"},{id:11,title:"Add discount code to checkout page",date:"Sep 14",type:"Feature Request"},{id:12,title:"Design shopping cart dropdown",date:"Sep 9",type:"Design"},{id:13,title:"Add discount code to checkout page",date:"Sep 14",type:"Feature Request"}]},{title:"Done",tasks:[{id:14,title:"Add discount code to checkout page",date:"Sep 14",type:"Feature Request"},{id:15,title:"Design shopping cart dropdown",date:"Sep 9",type:"Design"},{id:16,title:"Add discount code to checkout page",date:"Sep 14",type:"Feature Request"}]}]));
      } 
    },
    openAddModal(cTitle) {
	    console.log(cTitle + " from add modal");
	this.openDialog = true;
	this.listSelected = cTitle;
	this.id = uuidv1(); 
	setTimeout(function() { 
		document.querySelector('#diagText').focus();
	}, 200);
    },
    openEditModal(cTitle, oldID) {
	console.log(cTitle + "//" + this.getTask(cTitle, oldID));
	this.openDialog = true;
	task=this.getTask(cTitle, oldID);
	this.title=task.title
	this.id = oldID;
	this.listSelected=cTitle;
	setTimeout(function() { 
		document.querySelector('#diagText').focus();
	}, 200);
    },
    submit() {
	console.log("submit " + this.id + "//" + this.getTask(this.listSelected, this.id));
	task = this.getTask(this.listSelected, this.id);
	if(task){
		task.title=this.title;
		task.taskColor=this.taskColor;
		console.log("updating " + task);
	}else{
		this.addTask(this.listSelected, this.title, this.id, this.taskColor);
	}
	this.title = '';
	this.openDialog = false;
	this.taskColor = null;
	this.setItems();
    },
    addTask(cTitle, title, id, taskColor){
	    this.columns[cTitle].unshift({ title: title, id: uuidv1(), taskColor: taskColor });
    },
    removeAt(cTitle, id) {
	taskIndex=this.getTaskIndex(cTitle, id);
	console.log("delete "+id + " at " + taskIndex + " from " + cTitle);
	if(taskIndex >= 0){
		this.columns[cTitle].splice(taskIndex, 1);
		this.setItems();
	}
    },
    doOpen(text) {
     var matches=text.match(/\b(file|https?):\/\/\S+/gi);
     if(!matches) return;
     for(i of matches){
	 window.open(i);
     }
    },
    setSoundAlert(){
	checked = document.querySelector("#sound").checked;
	var RESET_TIME=15*60;
	if(checked){
		document.querySelector("#timerCountdown").textContent=RESET_TIME;
		document.querySelector("#timerID").textContent=setInterval(function(){
			// not sure how to access external variable so put in UI
			timeLeft=(1*document.querySelector("#timerCountdown").textContent);	
			timeLeft--;
			//console.log("to set interval " + document.querySelector("#timerID").textContent + "//" + timeLeft);
			if(timeLeft <= 0){
				document.querySelector("#timerCountdown").textContent=RESET_TIME;
				var mp3_url = 'https://media.geeksforgeeks.org/wp-content/uploads/20190531135120/beep.mp3';
				audio=new Audio(mp3_url);
				audio.play();
				setTimeout(function(){audio.play();},1000);
				setTimeout(function(){audio.play();},2000);
			}else{
				document.title=timeLeft+"s";
				document.querySelector("#timerCountdown").textContent=timeLeft;
			}
		}, 1000);
	}else{
		clearInterval(document.querySelector("#timerID").textContent);
		document.querySelector("#timerCountdown").textContent="";
		//console.log("to clear interval if exist" + document.querySelector("#timerID").textContent);
	}
    },
    createGoal(){
	var arr=document.querySelector("#goalTxt").value.split(",");
	console.log("in progress "+arr.length + " = " + arr);
	for(title of arr){
		this.addTask("inprogress", title, uuidv1(), null);
	}
	this.setItems();
    },
    // helpers
    getTask(cTitle, id){
      return this.columns[cTitle].find(t=>t.id===id);
    },
    getTaskIndex(cTitle, id){
      //console.log("getTaskIndex "+cTitle + " for " + this.listSelected + "//" + this.columns[cTitle]);
      return this.columns[cTitle].findIndex(t=>t.id===id);
    },
    setItems() {
      localStorage.setItem('columns', JSON.stringify(this.columns));
    },
    createTextLinks(text) {
		  return (text || "").replace(/([^\S]|^)(((https?\:\/\/)|(www\.))(\S+))/gi,
		    function (match, space, url) {
		      var hyperlink = url;
		      if (!hyperlink.match("^https?://")) {
			hyperlink = "http://" + hyperlink;
		      }
		      return space + '<a target=_blank href="' + hyperlink + '">' + url + "</a>";
		    }
		  ).replace(/([^\S]|^)((file\:\/\/)(\S+))/gi,function(match,space,url){
			return space + '<a target=_blank href="' + url + '">' + url + "</a>";
		  });
    }
  }
}

var app = new Vue({
  el: '#app',
  components: {
    Board
  },
  template:  /*html*/`
    <section class="w-full h-full overflow-auto">
      <Board />
    </section>
  `
})

