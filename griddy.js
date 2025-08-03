/**
 * Function to open a Griddy Dialog
 * @param {object} options - settings for the grid
 */
Actor.prototype.griddy = function(options={}) {
let character = this

let itemTypes = game.settings.get('griddy', 'itemTypes').split(',').map(t=>t.trim())
let systemQuanityProp = game.settings.get('griddy', `systemQuanityProp`)
let gridSize = options.gridSize || game.user.getFlag('griddy', 'gridSize') || game.settings.get('griddy', `gridSize`)
let rows = options.rows || character.getFlag('griddy', 'config.rows') || 8
let cols = options.cols || character.getFlag('griddy', 'config.cols') || 10
let background = options.background || game.user.getFlag('griddy', 'background') || game.settings.get('griddy', `background`)
let itemBackground = options.itemBackground || game.user.getFlag('griddy', 'itemBackground') || game.settings.get('griddy', `itemBackground`)
let gridColor = options.gridColor || game.user.getFlag('griddy', 'gridColor') || game.settings.get('griddy', `gridColor`)
let itemOutlineColor = options.itemOutlineColor || game.user.getFlag('griddy', 'itemOutlineColor') || game.settings.get('griddy', `itemOutlineColor`)
let resizing = game.settings.get('griddy', 'itemResizing')=="GM"?game.user.isGM:true||options.resizing
let showOneQuantity = game.user.getFlag('griddy', 'showOneQuantity') || game.settings.get('griddy', 'showOneQuantity')
let container = options.container
let top = options.top
let left = options.left
let render = true
options = {gridSize, gridColor, rows, cols, background, itemBackground, itemOutlineColor, resizing, container, top, left}

let id = `inventory-grid-${character.id}${container?`-${container}`:''}`;
if ($(`div#${id}`).length) 
  return ui.windows[$(`div#${id}`).data().appid].close();
  
let dblClickItem = function(e){
  let item = character.items.get(this.id)
  if (item.flags.griddy.position.c) {
    let p = item.flags.griddy.position
    return character.inventoryGrid({
      container:item.id, 
      gridSize, 
      rows: p.rows||0, 
      cols: p.cols||0, 
      top: e.clientY, 
      left:e.clientX
    })
  }
  //item.use()
}
let rightClickItem = async function(e){
  let item = fromUuidSync(this.dataset.uuid)//character.items.get(this.id)
  item.sheet.render(true)
}

function elementsOverlap(el1, el2) {
  const domRect1 = el1.getBoundingClientRect();
  const domRect2 = el2.getBoundingClientRect();

  return !(
    domRect1.top >= domRect2.bottom ||
    domRect1.right <= domRect2.left ||
    domRect1.bottom <= domRect2.top ||
    domRect1.left >= domRect2.right
  );
}

let outOfBounds = function(p){ return (p.x+(p.w)>cols||p.y+(p.h)>rows||p.x<0||p.y<0) }
  
let d = new Dialog({
  title: container?character.items.get(container).name:character.name,// +" Equipment",
  content: `
  <style>
  div.${id} { position: relative; overflow: hidden;}
  div.${id} > div.item {padding: 2px; cursor: pointer; position: absolute; background:${itemBackground};}
  div.${id} > div.item {outline: 1px solid ${itemOutlineColor}; outline-offset: -2px; transition: outline .25s;}
  div.${id} > div.conflicts {outline: 2px dotted red !important; opacity: 0.5;}
  div.${id} > div.drop-in {outline: 2px dashed white !important; opacity: 0.5;}
  div.${id} > div.combine {outline: 2px dashed green !important; opacity: 0.5;}
  div.${id} > div.item:hover {outline: 1px solid var(--color-shadow-highlight) !important;}
  div.${id} {
    border: 1px solid ${gridColor};
    background-image: 
      repeating-linear-gradient(${gridColor} 0 1px, transparent 1px 100%),
      repeating-linear-gradient(90deg, ${gridColor} 0 1px, transparent 1px 100%);
      background-position: top -1px left -1px;
      height: ${gridSize*rows}px; width:${gridSize*cols}px;
      background-size: ${gridSize}px ${gridSize}px;
  }
  div.${id} > div.item > img { 
    border:unset;
    max-width: 100%; 
    max-height: 100%; 
    left:50%; top:50%; position:absolute;padding:2px;
    pointer-events: none;
  }
  ${showOneQuantity?`div.${id} > div.item > span.item-quantity { display: inline !important;}`:''}
  div.${id} > div.item-drag-preview {
    outline: 2px solid ${itemOutlineColor}; outline-offset: -2px; position: absolute; pointer-events: none;
  }
  </style>
  <div class="${id}" style="height: ${rows*gridSize+1}px; width:${cols*gridSize+1}px;" data-grid-size="${gridSize}" data-rows="${rows}" data-cols="${cols}" data-color="${gridColor}"></div>`,
  buttons: {},
  render: async (html)=>{
    
    if (!render) return console.log(`${id} render cancelled`);
    //
    // STYLE THE DIALOG SECTION - COLOR MAY HAVE TO GO
    //console.log(html[0])
    $(html[0]).parent().css({background:background, color: 'white'})
    //html[0].innerHTML += 
    // FILTER ITEMS
    let items = character.items.filter(i=>itemTypes.includes(i.type)&&i.flags.griddy?.position?.e!=true)
    if (container) items = items.filter(i=>i.flags.griddy.position.n && i.flags.griddy.position.n==container)
    else items = items.filter(i=>!i.flags.griddy?.position.n)

    // making items a set temporarily so that set can be modified in the called hooks
    items = new Set(items);
    Hooks.call('filterGriddyItems', items)
    items = Array.from(items);
    
    //return console.log(items)
    // INITATE FLAGS FOR ITEMS
    let updates = items.filter(i => itemTypes.includes(i.type) && !foundry.utils.hasProperty(i, "flags.griddy.position")).map((i, index)=> { return {_id: i.id, flags: { griddy: { position: {
              x: index%cols,
              y: Math.floor(index/cols),
              w: 1,
              h: 1
            }
          }
        }
      }
    })
    //console.log('Flag Initiation', updates)
    if (updates.length) 
      await character.updateEmbeddedDocuments("Item", updates);
    
    let oob = items.filter(i=>foundry.utils.hasProperty(i, "flags.griddy.position")).filter(i=>{
      let p = i.flags.griddy.position
      if (p.x+(p.w)>cols) return true;
      if (p.y+(p.h)>rows) return true;
      if (p.x<0 || p.y<0) return true 
      return false
    })
    //console.log('Out of Bounds Updates', updates)
    updates = oob.map(i=>{ return {_id: i.id, flags:{griddy:{position:{x:0,y:0}}}}})
      await character.updateEmbeddedDocuments("Item", updates);

    // ADD ITEMS TO THE GRID
    let itemElements = items.reduce((a,i)=>a+=//${conflicts(i.flags.griddy?.position, i.id, items).length?'conflicts':''}
           `<div id="Item-${i.id}" data-name="${i.name}" data-id="${i.id}" class="item" draggable="true" data-uuid="${i.uuid}" data-stack-limit="${i.flags.griddy?.position?.s||0}" data-type="${i.type}"
           data-size="${i.flags.griddy?.position?.w*i.flags.griddy?.position?.h}" data-last-modified="${i._stats.modifiedTime}" data-container="${i.flags.griddy?.position?.c}"
           data-tooltip="${i.name}${foundry.utils.getProperty(i.system, systemQuanityProp)>1?` (${foundry.utils.getProperty(i.system, systemQuanityProp)})`:''}" 
           style=" left: ${i.flags.griddy?.position?.x*gridSize}px; top: ${i.flags.griddy?.position?.y*gridSize}px; width:${i.flags.griddy?.position?.w*gridSize}px; height:${i.flags.griddy?.position?.h*gridSize}px; cursor:pointer">
           <img src="${i.img}" style="transform: translate(-50%, -50%); " >
           <span class="item-quantity" style="font-size:${gridSize/4.5}px;position: absolute; top: 2px; left: 2px; color: white; background: rgba(0, 0, 0, 0.5); padding:1px 3px; display: ${foundry.utils.getProperty(i.system, systemQuanityProp)>1?'inline':'none'}">${foundry.utils.getProperty(i.system, systemQuanityProp)}</span>
           </div>`, ``) 
    html.find(`div.${id}`).html(itemElements);
    //html.find('div.item').mouseenter(()=>{game.audio.play('modules/griddy/off.ogg', {context: game.audio.interface})})
    
    // FUNCTION TO GET A POSISION (BAD NAME - RENAME?)
    function testPosition(position, item, g){
      
      let grid = Array(rows).fill().map(()=>Array(cols).fill(1))
      let otherItems = items.filter(i=>i.id!=item.id)
      let filledSlots = otherItems.map(i=>{ return {...i.flags.griddy?.position, id: i.id}})
      for (let slot of filledSlots.filter(c=>c.h>1 || c.w>1))
        for (let x=0; x<slot.w; x++)
          for (let y=0; y<slot.h; y++)
            filledSlots.push({...slot, ...{x: slot.x+x, y: slot.y+y}})
      for (let i of filledSlots) grid[i.y][i.x] = 0
      p = foundry.utils.deepClone(position)
      let gridString = grid.map(a=>a.join('')).join('0')
      let {w, h} = p
      let pattern = new RegExp([...Array(h)].map((r,i)=>'1{'+w+'}'+(i<h-1?'[01]{'+(cols-w+1)+'}':'')).join(''))
      let match = gridString.match(pattern)
      if (match) {
        let x = match.index%(cols+1)
        let y = Math.floor(match.index/(cols+1))
        //console.log('match 1', x,y,w,h)
        return Object.assign(p, {x, y, w, h})
      }
      [w, h] = [h, w]; // try rotated-
      pattern = new RegExp([...Array(h)].map((r,i)=>'1{'+w+'}'+(i<h-1?'[01]{'+(cols-w+1)+'}':'')).join(''))
      match = gridString.match(pattern)
      if (match) {
        let x = match.index%(cols+1)
        let y = Math.floor(match.index/(cols+1))
        //console.log('match 1', x,y,w,h)
        return Object.assign(p, {x, y, w, h})
      }
      return position
    }

    // ITEM DIV EVENTS
    html.find('div.item')
    .dblclick(function(e){
      let item = fromUuidSync(this.dataset.uuid)//character.items.get(this.id)
      if (item.flags.griddy.position.c) {
        let p = item.flags.griddy.position
        return character.griddy({
          container:item.id, 
          gridSize, 
          rows: p.rows||0, 
          cols: p.cols||0, 
          top: e.clientY, 
          left:e.clientX
        })
      }
    })
    .contextmenu(rightClickItem)
    .bind("wheel", async function(e) {
      let item = fromUuidSync(this.dataset.uuid)//character.items.get(this.id);
      let position = foundry.utils.deepClone(item.flags.griddy.position)

      if (e.ctrlKey && resizing) 
        if (e.originalEvent.wheelDelta>0)
          return item.setFlag('griddy', 'position.h', position.h+1)
        else 
          return item.setFlag('griddy', 'position.h', Math.max(position.h-1,1))
      if (e.shiftKey && resizing) 
        if (e.originalEvent.wheelDelta>0)
          return item.setFlag('griddy', 'position.w', position.w+1)
        else 
          return item.setFlag('griddy', 'position.w', Math.max(position.w-1,1))
      if (position.w==1 && position.h==1) return;
      const itemRect = this.getBoundingClientRect();
      const inventory = e.target.closest(`div.${id}`);
      const inventoryRect = inventory.getBoundingClientRect();
      let m = {
        x: Math.floor((e.clientX - itemRect.left)/gridSize)*gridSize+gridSize/2, 
        y: Math.floor((e.clientY - itemRect.top)/gridSize)*gridSize+gridSize/2
      }
      this.style.transformOrigin = `${m.x}px ${m.y}px`
      this.style.transform = `rotate(${e.originalEvent.wheelDelta<0?90:-90}deg)`
      let img = this.querySelector('img')
      img.style.transform = img.style.transform.split('rotate')[0] + ` rotate(${e.originalEvent.wheelDelta<0?-90:90}deg)`
      let rotatedRect = this.getBoundingClientRect()
      let x = Math.round((rotatedRect.left-inventoryRect.left)/gridSize)
      let y = Math.round((rotatedRect.top-inventoryRect.top)/gridSize)
      position = {x,y,w:position.h,h:position.w}
      
      //if ([...html.find('div.item')].filter((e)=>elementsOverlap(this, e) && !e.id.includes(item.id)).length||//conflicts(position, item.id, items).length
      if (position.x+(position.w)>cols||
          position.y+(position.h)>rows||
          position.x<0 ||position.y<0) {
        this.style.transform = `unset`
        let img = this.querySelector('img')
        img.style.transform = img.style.transform.split('rotate')[0]
        if (position.x+(position.w)>cols||position.y+(position.h)>rows
          ||position.x<0||position.y<0)
          return ui.notifications.warn("cannot rotate: out of bounds")
        //return ui.notifications.warn("cannot rotate: conflict")
      }
      
      await item.setFlag('griddy', 'position', position)
      $(this).css({
        left: position.x*gridSize+'px', 
        top: position.y*gridSize+'px', 
        width: position.w*gridSize+'px', 
        height: position.h*gridSize+'px'})
    })
    
    ui.gridDragData = {} // offsetY, offsetX, x, y, h, w
    //ui.dragPreviewClone 
    html.find('div.item').bind("dragstart", function(e) {
      $(`div[id^="${id}-"]`).each(function(){
        ui.windows[this.dataset.appid].bringToTop()
      })
      this.style.zIndex = 1
      let quantity = Number($(this).find('span').text())
      let split = false
      if ((e.shiftKey||e.ctrlKey) && quantity>1) {
        split = true
        let clone = $(this).clone()
        clone.css({'z-index': '1', 'pointer-events': 'none'})
        clone.addClass('clone')
        if (quantity>1) {
          if (e.ctrlKey) {
            clone.find('span').text(quantity-1)
            $(this).find('span').text(1)
          }
          if (e.shiftKey) {
            clone.find('span').text(Math.ceil(quantity/2))
            $(this).find('span').text(Math.floor(quantity/2))
          }
          
        }
        $(this).parent().append(clone)
      } 
      //ui.draggedItem = this
      //ui.draggedItem.style.pointerEvents = 'none'
      ui.dragPreviewClone = $(this).clone()
      ui.dragPreviewClone.addClass('item-drag-preview')
      this.style.opacity = 0
      
      
      const itemRect = this.getBoundingClientRect();
      const inventory = e.target.closest(`div.${id}`);
      const inventoryRect = inventory.getBoundingClientRect();
      ui.gridDragData.offsetX = Math.floor((e.clientX - itemRect.left)/gridSize),//(e.clientX - itemRect.left)
      ui.gridDragData.offsetY = Math.floor((e.clientY - itemRect.top)/gridSize),//(e.clientY - itemRect.top)
      ui.gridDragData.x = parseInt(this.style.left)/gridSize
      ui.gridDragData.y = parseInt(this.style.top)/gridSize
      ui.gridDragData.h = parseInt(this.style.height)/gridSize
      ui.gridDragData.w = parseInt(this.style.width)/gridSize
      ui.gridDragData.id = this.id
      ui.gridDragData.name = this.dataset.name
      let data = {
        type:"Item", 
        name: this.dataset.name,
        uuid: this.dataset.uuid, //`Actor.${character.id}.Item.${this.id}`,//.items.get(id).uuid,
        offsetX: ui.gridDragData.offsetX,
        offsetY: ui.gridDragData.offsetY,
        x: ui.gridDragData.x,
        y: ui.gridDragData.y,
        quantity: Number($(this).find('span').text()),
        split
      }
      let text = JSON.stringify(data)
      e.originalEvent.dataTransfer.setData("text", text);
      e.originalEvent.dataTransfer.effectAllowed = "move";
      //$(this).css({opacity: 0})
      var dragIcon = document.createElement("img");
      dragIcon.src = this.querySelector('img').src
      dragIcon.style.borderRadius="unset";
      var div = document.createElement('div');
      div.appendChild(dragIcon);
      div.classList.add("drag-img");
      div.style.position = "absolute"; 
      div.style.top = "-500px"; 
      div.style.left= "-500px";
      div.style.height = "20px";
      div.style.width = "20px";
      document.querySelector('body').appendChild(div);
      e.originalEvent.dataTransfer.setDragImage(div, 10, 10);
    })
    .bind('dragend', function(e){
      
      //game.audio.play('modules/griddy/on.ogg', {context: game.audio.interface})
      e.originalEvent.preventDefault();
      //console.log(ui.windows[this.closest('.app').dataset.appid].object)
      document.querySelectorAll('div.drag-img').forEach(e=>e.remove())
      
      $('div.item.clone').remove()
      let preview = $('div.item-drag-preview')
      //console.log(preview)
      if (preview.length && !preview.closest('.app')[0].id.includes(this.dataset.id)) preview.replaceWith(this)
      else this.style.opacity = 1
      ui.gridDragData = {}
      
      //
      const inventoryRect = this.parentElement.getBoundingClientRect();
      let x = (Math.floor((e.clientX - inventoryRect.left)/gridSize)-(ui.gridDragData.offsetX||0))
      let y = (Math.floor((e.clientY - inventoryRect.top)/gridSize)-(ui.gridDragData.offsetY|0))
      if (x == ui.gridDragData.x && y == ui.gridDragData.y) this.style.opacity = 1
      return preview.remove()
      //console.log(this)
      
      if (x == ui.gridDragData.x && y == ui.gridDragData.y) this.style.opacity = 1

      let item = fromUuidSync(this.dataset.uuid)
    })
    
    // INVENTORY DIV EVENTS
    html.find(`div.${id}`)
    .bind('dragover', function(e){
      e.originalEvent.preventDefault();
      const inventoryRect = this.getBoundingClientRect();
      let x = (Math.floor((e.clientX - inventoryRect.left)/gridSize)-(ui.gridDragData.offsetX||0))
      let y = (Math.floor((e.clientY - inventoryRect.top)/gridSize)-(ui.gridDragData.offsetY|0))
      let left = x*gridSize + 'px'
      let top = y*gridSize + 'px'
      let width = (ui.gridDragData.w||1)*gridSize + 'px'
      let height = (ui.gridDragData.h||1)*gridSize + 'px'
      if (!ui.dragPreviewClone) ui.dragPreviewClone = $(`<div class="item-drag-preview"></div>`)
      let preview = $(this).find('div.item-drag-preview')
      if (!preview.length && ui.dragPreviewClone) {
        preview = ui.dragPreviewClone.clone()//$(`<div class="item-drag-preview"></div>`)
        preview.css({left, top, width, height})
        $(this).append(preview)
      }else{
        preview.css({left, top, width, height})
      }
      /*
      ui.draggedItem.style.left = left
      ui.draggedItem.style.top = top
      if (!this.querySelector(`#${ui.draggedItem.id}`))
        $(this).append(ui.draggedItem)
      */
      let position = {x ,y ,w: ui.gridDragData.w||1,h: ui.gridDragData.h||0 }
      let oob = outOfBounds(position)
      if (oob) preview.addClass('conflicts')
      else preview.removeClass('conflicts')
      //console.log(ui.draggedItem.classList)
      if ([...$(this).find('div.item')].find(e=>elementsOverlap(e, preview[0])  && e.id!=ui.gridDragData.id) ) 
        preview.addClass('conflicts')
      if (e.target.dataset.container=="true") preview.addClass('drop-in')
      else preview.removeClass('drop-in')
      if (e.target.dataset.name==ui.gridDragData.name && !e.target.id.includes(ui.gridDragData.id)) preview.addClass('combine')
      else preview.removeClass('combine')
      //console.log(e.target.dataset.name,ui.gridDragData.name, e.target.dataset.container)
    }).bind("dragleave", function(e){
      e.originalEvent.preventDefault();
      return $(this).find('div.item-drag-preview').remove()
    })
    .bind('drop', async function(e){
      //game.audio.play('modules/griddy/on.ogg', {context: game.audio.interface})
      this.style.zIndex = 'unset';
      //let preview = $('div.item-drag-preview')
      let target = e.target.closest('div.item')
      //console.log(target)
      e.originalEvent.preventDefault();
      let data = JSON.parse(e.originalEvent.dataTransfer.getData("text"));
      if (!data) return;
      if (data.type != 'Item') return ui.notifications.warn('non-item dropped: '+ data.type)
      const inventoryRect = this.getBoundingClientRect();
      let n = container || 0
      let x = Math.floor((e.clientX - inventoryRect.left)/gridSize)-(data.offsetX||0)
      let y = Math.floor((e.clientY - inventoryRect.top)/gridSize)-(data.offsetY|0)
      
      let item = await fromUuid(data.uuid)
      
      if (item.id == container) return
      let position = foundry.utils.deepClone(item.flags.griddy?.position) || {x:0,y:0,w:1,h:1,e:false}
      position.x = x
      position.y = y
      position.n = n
      let i
      if (target) i = fromUuidSync(target.dataset.uuid)
      if (i) { // if dropped on another item
        
        render = false
        if (i.getFlag('griddy', 'position.c') && i.id != item.id) { // dropped on a container item
          await item.setFlag('griddy', 'position.n', i.id)
          ui.notifications.notify(`${item.name} added to ${i.name}`)
          render = true
          if (i.parent?.id == item.parent?.id) return d.render(true)//Object.values(character.apps).forEach(a=>a.render(true))//
        }
        if (i.name == item.name && i.id != item.id) { // dropped on an item of the same name
           // don't render until handling the updates
          let iQuantity = Number(foundry.utils.getProperty(i, `system.${systemQuanityProp}`))
          let itemQuantity = Number(foundry.utils.getProperty(item, `system.${systemQuanityProp}`))
          
          if (item.id==i.id) return $(e).find('span').text(itemQuantity)
          if (!data.split) data.quantity = itemQuantity
          await i.update({[`system.${systemQuanityProp}`]: iQuantity+data.quantity}, {render:false})
          if (data.split)  await item.update({[`system.${systemQuanityProp}`]: itemQuantity-data.quantity}, {render:false})
          else if (!item.uuid.startsWith('Item')) await item.delete()
          
          render = true
          return d.render(true)
        }
        render = true
      }
      if (data.split) {
        render = false
        await item.update({[`system.${systemQuanityProp}`]:  Number(foundry.utils.getProperty(item, `system.${systemQuanityProp}`))-Number(data.quantity)}, {render:false})
        let newItem = item.toObject()
        foundry.utils.setProperty(newItem, `system.${systemQuanityProp}`, Number(data.quantity))
        foundry.utils.setProperty(newItem, "flags.griddy.position", position)
        let newItems = await character.createEmbeddedDocuments("Item", [newItem])
        render = true
        return d.render(true)
      }
      // handle items dropped from another actor
      if (!(data.uuid.includes(character.id) || data.uuid.includes("Token")) || !data.uuid.startsWith('Actor')) {
        //console.log(data.uuid.includes(character.id) , data.uuid.includes("Token"), !data.uuid.startsWith('Actor'))
        let newItem = item.toObject()
        if (i && i.getFlag('griddy', 'position.c'))  position.n = i.id
        //console.log(newItem)
        foundry.utils.setProperty(newItem, "flags.griddy.position", position)
        let docs = await character.createEmbeddedDocuments("Item", [newItem])
        //console.log(docs)
        if (item.parent?.permission > 2 && docs.length) {// if the user has the ability to delete from source
          Object.values(ui.windows).filter(w=>w.id.includes(item.id)).forEach(w=>w.close())
          if (item.flags.griddy?.position?.c) {// move items in container
            
            let itemsInContainer = item.parent.items.filter(i=>i.flags.griddy?.position?.n == item.id)
            let newItems = itemsInContainer.map(i=>{
              let newItem = i.toObject()
              foundry.utils.setProperty(newItem, "flags.griddy.position.n", docs[0].id)
              return newItem
            })
            await character.createEmbeddedDocuments("Item", newItems)
            await item.parent.deleteEmbeddedDocuments("Item", itemsInContainer.map(i=>i.id))
          }
          item.delete()
        }
        return
      }
      //Object.values(character.apps).forEach(a=>a.render(true))
      await item.setFlag('griddy', 'position', position)
      
      d.render(true)
      return $(`div#Item-${item.id}`).css('opacity', '1')
    })
    
    // QUANTITY SPAN EVENTS
    html.find('div.item > span').click(function(e){
      e.stopPropagation();
      $(this).prop('role',"textbox")
      $(this).prop('contenteditable',"true") 
      $(this).trigger('focusin');
    }).focusin(function(){
      let selection = window.getSelection();
      let range = document.createRange();
      range.selectNodeContents(this);
      selection.removeAllRanges();
      selection.addRange(range);
    }).focusout(async function(){
      let item = fromUuidSync(this.parentElement.dataset.uuid)//character.items.get(this.parentElement.id)
      let input = $(this).text();
      if (input == "") input = '0'
      item.update({[`system.${systemQuanityProp}`]:Number(input)})
      $(this).prop('role',"")
      $(this).prop('contenteditable',"false")
    }).keypress(function(e){
      if (e.keyCode < 48 || e.keyCode > 57)  e.preventDefault()
    }).keydown(function(e){
      e.stopPropagation();
      if (e.key != "Enter") return;
      return $(this).blur();
    })
    
    html.parent().find('div.dialog-buttons').remove();
    Hooks.call('renderGriddy', d, html, options)
    //console.log('end render ', id)

    // STACK LIMIT HANDLING
    let tooBigStack = [...html.find('div.item')]
      .find(e=>e.dataset.stackLimit != "0" && Number(e.dataset.stackLimit)<Number($(e).find('span.item-quantity').text()))
    //console.log(tooBigStack)
    if (tooBigStack) {
      let stackLimit = Number(tooBigStack.dataset.stackLimit)
      let item = fromUuidSync(tooBigStack.dataset.uuid)//character.items.get(tooBigStack.id)
      let quantity = foundry.utils.getProperty(item, `system.${systemQuanityProp}`)
      render = false
      await item.update({[`system.${systemQuanityProp}`]:stackLimit})
      quantity-=stackLimit
      let newItem = item.toObject()
      foundry.utils.setProperty(newItem, `system.${systemQuanityProp}`, quantity)
      foundry.utils.setProperty(newItem, `flags.griddy.position`, {...item.getFlag('griddy', 'position'), ...{x:0,y:0}})
      await character.createEmbeddedDocuments("Item", [newItem]);
      render = true
      d.render(true)
    }
    
    // CONFLICT DETECTION AND RESOLUTION
    
    let conflictingElements = [...html.find('div.item')]
      .sort((a,b)=> (Number(a.dataset.lastModified)||0) - (Number(b.dataset.lastModified)||0))
      //.sort((a,b)=> Number(a.dataset.size - Number(b.dataset.size)))
      .filter((e,i,a)=> a.filter(x=>e.id!=x.id&&elementsOverlap(e,x)).length?e:false).map(e=>{
      $(e).addClass('conflicts')
      return e
    })
    //console.log(conflictingElements)
    for (let e of conflictingElements) {
      let item = fromUuidSync(e.dataset.uuid)//character.items.get(e.id)
      let position = item.getFlag('griddy', 'position')
      let newPosition = testPosition(position, item)
      
      if (JSON.stringify(position) == JSON.stringify(newPosition)) continue;
      item.setFlag('griddy', 'position', newPosition)
      break
    }
  },
  close: (html)=>{
    delete character.apps[d.appId];
    return;
  }
}, {width:'auto',height:'auto', top, left, id}
)

Hooks.once('renderDialog', (app, html, options)=>{
  let actor = app.object
  let header = html.find('header > h4.window-title')
  let autoSort = $(`<a class="auto-sort" data-tooltip="Compress"><i class="fa-solid fa-left-right"></i></a>`)
  autoSort.click( function(e){
    app.element.find(`div.${id} > div.item`).each(function(){
      let p = fromUuidSync(this.dataset.uuid).getFlag('griddy', 'position')//character.items.get(this.id).getFlag('griddy', 'position')
      $(this).css({
        left: 'unset',
        top: 'unset',
        position: 'relative',
        'grid-column': `auto/span ${p.w}`,
        'grid-row': `auto/span ${p.h}`
      })
    })
    app.element.find(`div.${id}`).css({
      display: 'grid',
      position: 'relative',
      'grid-template': `repeat(${rows}, ${gridSize}px) / repeat(${cols}, ${gridSize}px)`,
      'grid-auto-flow': 'dense'
    })
    let gridRect = app.element.find(`div.${id}`)[0].getBoundingClientRect();
    let updates = [...app.element.find('div.item')].map(e=>{
      let itemRect = e.getBoundingClientRect()
      let x = Math.floor((itemRect.x - gridRect.x)/gridSize)
      let y = Math.floor((itemRect.y - gridRect.y)/gridSize)
      return {_id: e.dataset.id, flags: { griddy: { position: {x,y}}}}
    })
    character.updateEmbeddedDocuments("Item", updates)
    
  })
  
  header.after(autoSort)
  if (!(game.settings.get('griddy', 'resizing')=="GM"?game.user.isGM:true)) return
  let gridConfig = $(`<a class="griddy-config" data-tooltip="Grid Config"><i class="fa-solid fa-cog"></i></a>`)
  gridConfig.click( function(e){
    let configDialog = new Dialog({title:`${actor.name} Grid Config`,content:'', buttons:{},
      render: async (html)=>{
        let p = actor.flags.griddy?.config
        if (!p) {
          await actor.setFlag('griddy', 'config', {rows: 6, cols: 10})
          p = actor.flags.griddy?.config
        }
        let table = `<style>div.position-form span {line-height: var(--form-field-height);}</style>
        <div class="position-form" style="display:grid; grid-template-columns: repeat(4, 1fr); column-gap: 1em; row-gap: .2em">`
        table += `
        <span>columns:</span><input  name="cols" type="number" value="${p.cols||1}" autofocus></input>
        <span>rows:</span><input  name="rows" type="number" value="${p.rows||1}"></input>`
        table+=`</div><button style="margin-top: .2em">Save</button>`
        html[0].innerHTML = table
        html.find('button').click(async function(){
          let config = [...html.find('input')].reduce((a, e)=>{
            return Object.assign(a, {[e.getAttribute('name')]: Number(e.value)})
          },{})
          await actor.setFlag('griddy', 'config', config)
          ui.notifications.info(`Updated ${actor.name} Griddy flags: ${JSON.stringify(config)}`)
          d.close()
          configDialog.close()
        }).on('keydown', function(e){
          e.stopPropagation()
          if (e.key=='Enter') this.click()
        })
        html.find('input').focusin(function(){this.select()}).on('keydown', function(e){
          e.stopPropagation()
          if (e.key=='Enter') html.find('button').click()
        })
        
      },
      close: ()=>{  return;}
      },{top: e.clientY , left: e.clientX, width: 250, height: 'auto'}).render(true)
    
  });
  if (container) return d.render(true);
  html.find('a.auto-sort').after(gridConfig)

});
d.object = this
d.render(true);
character.apps[d.appId] = d;


}// end Actor.prototype.inventoryGrid 



         
var itemHeaderOnClickDelete = async function (e, item) {
      event.preventDefault();
      let doDelete = await Dialog.wait({title: `Delete ${item.name}?`, content: ``,
        buttons: {
          yes: {label: "Delete", callback:()=>{return true}},
          no: {label: "Keep", callback:()=>{return false}}
        },close:()=>{return false}
      },{top: e.clientY , left: e.clientX, width: 200});
      if (!doDelete) return
      return item.delete()
    }
var itemHeaderOnClickPosition = async function (e, item) {
      let changeDialog = new Dialog({title:`${item.name} Position`,content:'', buttons:{},
        render: async (html)=>{
          let p = item.flags.griddy?.position
          if (!p) {
            await item.setFlag('griddy', 'position', {x:0, y:0, w:1, h:1, c: false, n:0, s: 0})
            p = item.flags.griddy?.position
          }
          
          let table = `<style>div.position-form span {line-height: var(--form-field-height);}</style>
          <div class="position-form" style="display:grid; grid-template-columns: repeat(4, 1fr); column-gap: 1em; row-gap: .2em">`
          if (item.uuid.startsWith('Actor'))
            table += `
          <span>x (left):</span><input  name="x" type="number" value="${p.x}"></input>
          <span>y (top):</span><input  name="y" type="number" value="${p.y}"></input>`
          table += `
          <span>width:</span><input name="w" type="number" value="${p.w}"></input>
          <span>height:</span><input  name="h" type="number" value="${p.h}"></input>`
          if (game.user.isGM) table +=`
          <span style="grid-column: auto / span 2;">stack size limit:</span><input style="grid-column: auto / span 2;" name="s" type="number" value="${p.s||0}"></input>
          <span>exclude:</span><input name="e" type="checkbox" ${p.e?'checked':''}></input>
          <span>container:</span><input name="c" type="checkbox" ${p.c?'checked':''}></input>`
          if (p.c) table += `
          <span>columns:</span><input  name="cols" type="number" value="${p.cols||1}"></input>
          <span>rows:</span><input  name="rows" type="number" value="${p.rows||1}"></input>`
          table+=`</div><button style="margin-top: .2em">Save</button>`
          html[0].innerHTML = table
          html.find('button').click(async function(){
            let position = [...html.find('input')].reduce((a, e)=>{
              return Object.assign(a, {[e.getAttribute('name')]: e.type=='number'?Number(e.value):e.checked})
            },{})
            if (position.c) {
              position.s = 1
              if (!position.rows) position.rows = 1
              if (!position.cols) position.cols = 1
            }
            if (position.s != item.flags.griddy?.position?.s && item.parent) {
              let items = item.parent.items.filter(i=>i.name==item.name && i.id != item.id)
              let updates = items.map(i=>{return {_id:i.id, "flags.griddy.position.s":position.s}})
              await item.parent.updateEmbeddedDocuments("Item", updates)
            }
            
            await item.setFlag('griddy', 'position', position)
            ui.notifications.info(`Updated ${item.name} Griddy flags: ${JSON.stringify(position)}`)
            //console.log(`${item.name} (${item.id}) flags updated`, position)
          })
          html.find('input').focusin(function(){this.select()}).on('keydown', function(e){
            e.stopPropagation()
            if (e.key=='Enter') html.find('button').click()
          })
        },
        close: ()=>{ 
          delete item.apps[changeDialog.appId];
          return;
        }
      },{top: e.clientY , left: e.clientX, width: 250, height: 'auto'}).render(true)
      item.apps[changeDialog.appId] = changeDialog;
    }
  
Hooks.on('getHeaderControlsDocumentSheetV2', function (app, buttons) {
  
  if (!app.item) return;
  let item = app.item
  if (!game.settings.get('griddy', 'itemTypes').split(',').includes(item.type)) return;
  if (item.uuid.startsWith('Actor'))
    
  buttons.unshift({
    class: "delete-item",
    icon: "fas fa-trash",
    label: "Delete",
    onClick: (e)=>{itemHeaderOnClickDelete( e, item)}
  })
 
  if (game.settings.get('griddy', 'resizing')=="GM"?game.user.isGM:true)
  buttons.unshift({
    class: "move-item",
    icon: "fa-solid fa-up-down-left-right",
    label: "Position",
    onClick: (e)=>{itemHeaderOnClickPosition( e, item)}
  })
})

Hooks.on('getItemSheetHeaderButtons', function (app, buttons) {
  let item = app.item
  if (!game.settings.get('griddy', 'itemTypes').split(',').includes(item.type)) return;
  if (item.uuid.startsWith('Actor'))
  buttons.unshift({
    class: "delete-item",
    icon: "fas fa-trash",
    label: "Delete",
    onclick: (e)=>{itemHeaderOnClickDelete( e, item)}
  })
 
  if (game.settings.get('griddy', 'resizing')=="GM"?game.user.isGM:true)
  buttons.unshift({
    class: "move-item",
    icon: "fa-solid fa-up-down-left-right",
    label: "Position",
    onclick: (e)=>{itemHeaderOnClickPosition( e, item)}
  })
})

Hooks.once("init", ()=>{
  
  game.keybindings.register("griddy", "showGriddy", {
     name: "Griddy",
     hint: "Show Griddy for user character",
     editable: [{key: "KeyI", modifiers: [] }],
     onDown: (e) => {  },
     onUp: () => { return game.user.character.griddy() },      
     precedence: CONST.KEYBINDING_PRECEDENCE.PRIORITY
  });
  
  game.settings.register('griddy', `itemTypes`, {
    name: `Item Types `,
    hint: `Comma separated list of your system's item types to include on the grid. Double click for selection dialog`,
    scope: "world",
    type: String,
    default: "",
    config: true,
    restricted: true 
  });
  
  game.settings.register('griddy', `systemQuanityProp`, {
    name: `System Quantity Property `,
    hint: `Where in the system data quantity is stored. Double Click for sheet, Ctrl+Click the quantity input field to set.`,
    scope: "world",
    type: String,
    default: "quantity",
    config: true,
    restricted: true 
  });

  game.settings.register('griddy', 'showOneQuantity', {
    name: `Show Quantity of 1`,
    hint: `Show quantity of item even when it is 1`,
    scope: "client",
    type: Boolean,
    default: false,
    config: true,
    onChange: value => { game.user.setFlag('griddy', 'showOneQuantity', value) }
  });

  game.settings.register('griddy', `resizing`, {
    name: `Grid Resizing`,
    hint: `Who can resize the actor's grid`,
    scope: "world",
    type: String,
    default: "GM",
    choices: {"GM":"GM", "Everyone":"Everyone"},
    config: true,
    restricted: true 
  });

  game.settings.register('griddy', `itemResizing`, {
    name: `Item Resizing`,
    hint: `Who can resize items`,
    scope: "world",
    type: String,
    default: "GM",
    choices: {"GM":"GM", "Everyone":"Everyone"},
    config: true,
    restricted: true 
  });

  game.settings.register('griddy', `gridSize`, {
    name: `Grid Size`,
    hint: `Grid square size in pixels`,
    scope: "client",
    type: Number,
    default: "50",
    config: true,
    onChange: value => { game.user.setFlag('griddy', 'gridSize', value) }
  });

  game.settings.register('griddy', `background`, {
    name: `Background`,
    hint: `This can be any valid CSS background value`,
    scope: "client",
    type: String,
    default: "#222",
    config: true,
    onChange: value => { game.user.setFlag('griddy', 'background', value) }
  });
  
  game.settings.register('griddy', `itemBackground`, {
    name: `Item Background`,
    hint: `This can be any valid CSS background value`,
    scope: "client",
    type: String,
    default: "#000",
    config: true,
    onChange: value => { game.user.setFlag('griddy', 'itemBackground', value) }
  });

  game.settings.register('griddy', `gridColor`, {
    name: `Grid Color`,
    hint: `This can be any valid CSS background value`,
    scope: "client",
    type: String,
    default: "#333",
    config: true,
    onChange: value => { game.user.setFlag('griddy', 'gridColor', value) }
  });

  game.settings.register('griddy', `itemOutlineColor`, {
    name: `Item Outline Color`,
    hint: `This can be any valid CSS color value`,
    scope: "client",
    type: String,
    default: "#555",
    config: true,
    onChange: value => { game.user.setFlag('griddy', 'itemOutlineColor', value) }
  });

});

Hooks.on('ready', ()=>{
  if (game.user.isGM && game.settings.get('griddy', `itemTypes`) == "" && game.system.id == 'dnd5e')
    game.settings.set('griddy', `itemTypes`,"equipment,weapon,loot,consumable,backpack,tool")

  if (game.settings.get('griddy', `itemTypes`) == "" && game.user.isGM) {
    let itemTypes = game.settings.get('griddy', 'itemTypes')
    new Dialog({
      title: 'Griddy Item Types',
      content: ``,
      buttons:{
        submit: {
          label: 'submit',
          callback: (html) => {
            let itemTypes = [...html.find('input:checked')].map(e=> e.getAttribute('name')).join(',')
            //console.log(itemTypes)
            game.settings.set('griddy', 'itemTypes', itemTypes)
          }
        }
      },
      render: (html)=>{
        let table = `<style>div.types-form span {line-height: var(--form-field-height);}</style><p>What items types should be included in Griddy?</p>
              <div class="types-form" style="display:grid; grid-template-columns: 1.5em auto ; column-gap: 1em; row-gap: .2em; margin-bottom: .5em">${ Object.keys(game.release.generation<12?game.system.model.Item:CONFIG.Item.typeLabels).reduce((a,x)=>a+=`
              <input name="${x}" type="checkbox" ${itemTypes.includes(x)?'checked':''}></input><span>${x}</span>`,``)}</div>`
              html[0].innerHTML = table
      }
    },{width:250}).render(true)
  }
})

Hooks.on('renderSettingsConfig', (app, html)=>{
  console.log("html:",html)
 //let faLink = $(`<a href="https://fontawesome.com/search?o=r&m=free" target="_blank">Find Icons</a>`);
  if (html.nodeName) html = $(html)
    let itemTypesButton = $(`<button>Select</button>`).click(async function(e) {
    e.stopPropagation();
    e.preventDefault();
    let input = this.previousElementSibling
    let itemTypes = input.value//game.settings.get('griddy', 'itemTypes')
    itemTypes = await Dialog.prompt({
      title: 'Griddy Item Types',
      content: ``,
      callback: (html) => {
        let itemTypes = [...html.find('input:checked')].map(e=> e.getAttribute('name')).join(',')
        return itemTypes
      },
      render: (html)=>{
        let table = `<style>div.types-form span {line-height: var(--form-field-height);}</style><p>What items types should be included in Griddy?</p>
              <div class="types-form" style="display:grid; grid-template-columns: 1.5em auto ; column-gap: 1em; row-gap: .2em; margin-bottom: .5em">
              ${ Object.keys(game.release.generation<12?game.system.model.Item:CONFIG.Item.typeLabels).reduce((a,x)=>a+=`
              <input name="${x}" type="checkbox" ${itemTypes.includes(x)?'checked':''}></input><span>${x}</span>`,``)}</div>`
              html[0].innerHTML = table
      }
    },{width:250})
    input.value = itemTypes
  })
  html.find('input[name="griddy.itemTypes"]').after(itemTypesButton)
  let systemQuanityPropButton = $(`<button>Select</button>`).click(async function(e) {
    e.stopPropagation();
    e.preventDefault();
    let input = this.previousElementSibling
    let itemTypes = game.settings.get('griddy', 'itemTypes')
    let type = itemTypes.split(',')[0]
    let item = new Item.implementation({name: 'Ctrl+Click Quantity Property Input', type})
    Hooks.once('renderItemSheet', (app, html)=>{
      html.find('input').click(function(e){
        if (!e.ctrlKey) return;
        let prop = this.getAttribute('name').replace('system.','')
        input.value = prop
        game.settings.set('griddy', 'systemQuanityProp', prop)
        app.close()
      })
      Dialog.prompt({content:"<center>Ctrl+Click the quantity input field</center>"})
    })
    item.sheet.render(true)
    
  })
  html.find('input[name="griddy.systemQuanityProp"]').after(systemQuanityPropButton)
});

Hooks.on('getActorSheetHeaderButtons', (app, buttons)=>{
  buttons.unshift({
    "label": "Griddy",
    "class": "griddy",
    "icon": "fas fa-table-cells",
    onclick: (e)=>{
      app.actor.griddy()
    }
  })
})

Hooks.on('getHeaderControlsActorSheetV2', (app, buttons)=>{
  console.log("buttons", buttons)
  buttons.unshift({
    "label": "Griddy",
    "class": "griddy",
    "icon": "fas fa-table-cells",
    onClick: (e)=>{
      console.log(app)
      app.actor.griddy()
    }
  })
  //Array.from(document.querySelectorAll('#context-menu > menu > li ')).find(el => el.textContent === 'Griddy').addEventListener('click', )
})


Hooks.on('deleteItem', (item, context, userId)=>{
  if (game.user.id!=userId) return
  if (!item.parent) return
  if (!item.flags.griddy?.position?.c) return
  let itemsInContainer = item.parent.items.filter(i=>i.flags.griddy?.position?.n == item.id)
  let updates = itemsInContainer.map(i=>{ return {_id:i.id, "flags.griddy.position.n": null} })
  item.parent.updateEmbeddedDocuments("Item", updates)
})
