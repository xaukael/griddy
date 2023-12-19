/**
 * Function to open a Griddy Dialog
 * @constructor
 * @param {object} options - settings for the grid
 */
Actor.prototype.griddy = function(options={}) {
character = this

let itemTypes = game.settings.get('griddy', 'itemTypes').split(',').map(t=>t.trim())
let systemQuanityProp = game.settings.get('griddy', `systemQuanityProp`)
let gridSize = options.gridSize || game.settings.get('griddy', `gridSize`)
let rows = options.rows || character.getFlag('griddy', 'settings.rows') || 8
let cols = options.cols || character.getFlag('griddy', 'settings.cols') || 10
let background = options.background || game.settings.get('griddy', `background`)
let itemBackground = options.itemBackground || game.settings.get('griddy', `itemBackground`)
let gridColor = options.gridColor || game.settings.get('griddy', `gridColor`)
let itemOutlineColor = options.itemOutlineColor || game.settings.get('griddy', `itemOutlineColor`)
let resizing = game.settings.get('griddy', 'resizing')=="GM"?game.user.isGM:false||options.resizing
let container = options.container
let top = options.top
let left = options.left
let render = true
options = {gridSize, gridColor, rows, cols, background, itemBackground, itemOutlineColor, resizing, container, top, left}
console.log(resizing)
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
  let item = character.items.get(this.id)
  
  if (e.ctrlKey) {
    
  }

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
  
let conflicts = function(position, itemId, items){
  let positions = []
  for (let x=0; x<position.w; x++)
    for (let y=0; y<position.h; y++)
      positions.push({...position, ...{x: position.x+x, y: position.y+y}})
  let otherItems = items.filter(i=>i.flags.griddy?.position && i.id!=itemId && !i.flags.griddy?.position.e)
  let filledSlots = otherItems.map(i=>{ return {...i.flags.griddy?.position, id: i.id}})
  let sizeFilled = [];
  for (let slot of filledSlots.filter(c=>c.h>1 || c.w>1))
    for (let x=0; x<slot.w; x++)
      for (let y=0; y<slot.h; y++)
        sizeFilled.push({...slot, ...{x: slot.x+x, y: slot.y+y}})
  filledSlots = filledSlots.concat(sizeFilled)
  let conflicts = []
  for (let p of positions)
    conflicts = conflicts.concat(filledSlots.filter(f=>f.x==p.x && f.y==p.y))
  return conflicts
}
let outOfBounds = function(p){ return (p.x+(p.w)>cols||p.y+(p.h)>rows||p.x<0||p.y<0) }
  
let d = new Dialog({
  title: container?character.items.get(container).name:character.name +" Equipment",
  content: `
  <style>
  div.${id} { position: relative; overflow: hidden;}
  div.${id} > div.item {padding: 2px; cursor: pointer; position: absolute; background:${itemBackground};}
  div.${id} > div.item {outline: 1px solid ${itemOutlineColor}; outline-offset: -2px; transition: outline .25s;}
  div.${id} > div.conflicts {outline: 2px dotted red !important; opacity: 0.5;}
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
  div.${id} > div.item-drag-preview {
    outline: 2px solid ${itemOutlineColor}; outline-offset: -2px; position: absolute; pointer-events: none;
  }
  </style>
  <div class="${id}" style="height: ${rows*gridSize+1}px; width:${cols*gridSize+1}px;" data-grid-size="${gridSize}" data-rows="${rows}" data-cols="${cols}" data-color="${gridColor}"></div>`,
  buttons: {},
  render: async (html)=>{
    if (!render) return //console.log(`${id} render cancelled`);
    //console.log(`${id} render`)
    // STYLE THE DIALOG SECTION - COLOR MAY HAVE TO GO
    html.parent().css({background:background, color: 'white'})

    // FILTER ITEMS
    let items = character.items.filter(i=>itemTypes.includes(i.type)&&i.flags.griddy?.position?.e!=true)
    if (container) items = items.filter(i=>i.flags.griddy.position.n && i.flags.griddy.position.n==container)
    else items = items.filter(i=>!i.flags.griddy?.position.n)
    
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
           `<div id="${i.id}" name="${i.name}" class="item" draggable="true" data-uuid="${i.uuid}" data-stack-limit="${i.flags.griddy?.position?.s||0}"
           data-size="${i.flags.griddy?.position?.w*i.flags.griddy?.position?.h}" data-last-modified="${i._stats.createdTime}"
           data-tooltip="${i.name}${i.system[systemQuanityProp]>1?` (${i.system[systemQuanityProp]})`:''}" 
           style=" left: ${i.flags.griddy?.position?.x*gridSize}px; top: ${i.flags.griddy?.position?.y*gridSize}px; width:${i.flags.griddy?.position?.w*gridSize}px; height:${i.flags.griddy?.position?.h*gridSize}px; cursor:pointer">
           <img src="${i.img}" style="transform: translate(-50%, -50%); " >
           <span class="item-quantity" style="font-size:${gridSize/4.5}px;position: absolute; top: 2px; left: 2px; color: white; background: rgba(0, 0, 0, 0.5); padding:1px 3px; display: ${i.system[systemQuanityProp]>1?'inline':'none'}">${i.system[systemQuanityProp]}</span>
           </div>`, ``) 
    html.find(`div.${id}`).html(itemElements);
    
    // FUNCTION TO GET A POSISION (BAD NAME - RENAME?)
    function testPosition(position, item, g){
      
      let grid = Array(rows).fill().map(()=>Array(cols).fill(1))
      let otherItems = items.filter(i=>i.id!=item.id)
      let filledSlots = otherItems.map(i=>{ return {...i.flags.griddy?.position, id: i.id}})
      for (let slot of filledSlots.filter(c=>c.h>1 || c.w>1))
        for (let x=0; x<slot.w; x++)
          for (let y=0; y<slot.h; y++)
            filledSlots.push({...slot, ...{x: slot.x+x, y: slot.y+y}})
      for (let i of filledSlots)
        grid[i.y][i.x] = 0
      p = foundry.utils.deepClone(position)
      console.log(grid.join('\n'))
      let gridString = grid.map(a=>a.join('')).join('')
      let {w, h} = p
      let pattern = new RegExp([...Array(h)].map((r,i)=>'1{'+w+'}'+(i<h-1?'[01]{'+(cols-w)+'}':'')).join(''))
      let match = gridString.match(pattern)
      console.log(match)
      if (match) {
        let x = match.index%cols
        let y = Math.floor(match.index/cols)
        console.log('match 1', x,y,w,h)
        return Object.assign(p, {x, y, w, h})
      }
      [w, h] = [h, w]; // try rotated-
      pattern = new RegExp([...Array(h)].map((r,i)=>'1{'+w+'}'+(i<h-1?'[01]{'+(cols-w)+'}':'')).join(''))
      match = gridString.match(pattern)
      console.log(match)
      if (match) {
        let x = match.index%cols
        let y = Math.floor(match.index/cols)
        console.log('match 1', x,y,w,h)
        return Object.assign(p, {x, y, w, h})
      }
      return position
    }

    // ITEM DIV EVENTS
    html.find('div.item')
    .dblclick(function(e){
      let item = character.items.get(this.id)
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
      let item = character.items.get(this.id);
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
      if ([...html.find('div.item')].filter((e)=>elementsOverlap(this, e) && e.id != item.id).length||//conflicts(position, item.id, items).length
          position.x+(position.w)>cols||
          position.y+(position.h)>rows||
          position.x<0 ||position.y<0) {
        this.style.transform = `unset`
        let img = this.querySelector('img')
        img.style.transform = img.style.transform.split('rotate')[0]
        if (position.x+(position.w)>cols||position.y+(position.h)>rows
          ||position.x<0||position.y<0)
          return ui.notifications.warn("cannot rotate: out of bounds")
        return ui.notifications.warn("cannot rotate: conflict")
      }
      await item.setFlag('griddy', 'position', position)
      $(this).css({
        left: position.x*gridSize+'px', 
        top: position.y*gridSize+'px', 
        width: position.w*gridSize+'px', 
        height: position.h*gridSize+'px'})
    })
    
    ui.gridDragData = {} // offsetY, offsetX, x, y, h, w
    html.find('div.item').bind("dragstart", function(e) {
      $(`div[id^="${id}-"]`).each(function(){
        ui.windows[this.dataset.appid].bringToTop()
      })
      this.style.zIndex = 1
      
      if ((e.shiftKey||e.ctrlKey)) {
        let quantity = Number($(this).find('span').text())
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
      let data = {
        type:"Item", 
        uuid: `Actor.${character.id}.Item.${this.id}`,//.items.get(id).uuid,
        offsetX: ui.gridDragData.offsetX,
        offsetY: ui.gridDragData.offsetY,
        x: ui.gridDragData.x,
        y: ui.gridDragData.y,
        quantity: Number($(this).find('span').text()),
        split: (e.shiftKey||e.ctrlKey)
      }
      let text = JSON.stringify(data)
      e.originalEvent.dataTransfer.setData("text", text);
      e.originalEvent.dataTransfer.effectAllowed = "move";
      //$(this).css({opacity: 0})
      //e.originalEvent.dataTransfer.setDragImage(document.createElement('img'), 0, 0);
    })
    .bind('dragend', function(e){
      ui.gridDragData = {}
      $('div.item-drag-preview').remove()
      $('div.item.clone').remove()
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
      
      let preview = $(this).find('div.item-drag-preview')
      if (!preview.length) {
        preview = $(`<div class="item-drag-preview"></div>`)
        preview.css({left, top, width, height})
        $(this).append(preview)
      }else{
        preview.css({left, top, width, height})
      }
      let position = {x ,y ,w: ui.gridDragData.w||1,h: ui.gridDragData.h||0 }
      let oob = outOfBounds(position)
      if (oob) preview.addClass('conflicts')
      else preview.removeClass('conflicts')
      if ([...$(this).find('div.item')].find(e=>elementsOverlap(e, preview[0]) && e.id!=ui.gridDragData.id)) preview.addClass('conflicts')
    }).bind("dragleave", function(){
      $(this).find('div.item-drag-preview').remove()
    })
    .bind('drop', async function(e){
      this.style.zIndex = 'unset'
      let preview = $('div.item-drag-preview')
      e.originalEvent.preventDefault();
      let data = JSON.parse(e.originalEvent.dataTransfer.getData("text"));
      if (!data) return;
      if (data.type != 'Item') return ui.notifications.warn('non-item dropped: '+ data.type)
      const inventoryRect = this.getBoundingClientRect();
      let n = container || 0
      let x = Math.floor((e.clientX - inventoryRect.left)/gridSize)-(data.offsetX||0)
      let y = Math.floor((e.clientY - inventoryRect.top)/gridSize)-(data.offsetY|0)
      
      let item = await fromUuid(data.uuid)
      let position = foundry.utils.deepClone(item.flags.griddy?.position) || {x:0,y:0,w:1,h:1,e:false}
      position.x = x
      position.y = y
      position.n = n

      let test = $(`<div class="test" style="outline: 2px solid red; position: absolute; left: ${position.x*gridSize}px; top: ${position.y*gridSize}px; width: ${position.w*gridSize}px; height: ${position.h*gridSize}px;"></div>`)
      $(this).append(test)
      let overlapping = [...$(this).find('div.item')].filter((e)=>elementsOverlap(test[0], e) && !(e.id == item.id && !data.split))
      $(this).find('div.test').remove()
      //if (overlapping.map(e=>e.id).includes(item.id)) return await item.setFlag('griddy', 'position', position)
      let combined = false
      if (overlapping.length) {
        render = false
        for (let e of overlapping) {
          let i = character.items.get(e.id)
          if (i.getFlag('griddy', 'position.c')) {
            await item.setFlag('griddy', 'position.n', i.id)
            render = true
            return d.render(true)
          }
          if (i.name != item.name) continue;
          combined = true
          let iQuantity = foundry.utils.getProperty(i, `system.${systemQuanityProp}`)
          let itemQuantity =foundry.utils.getProperty(item, `system.${systemQuanityProp}`)
          if (item.id==i.id) return $(e).find('span').text(itemQuantity)
          await i.update({[`system.${systemQuanityProp}`]: iQuantity+data.quantity}, {render:false})
          if (data.split)  await item.update({[`system.${systemQuanityProp}`]: itemQuantity-data.quantity}, {render:false})
          else await item.delete()
          
        }
        render = true
        if (combined) return d.render(true)
        //return ui.notifications.warn("conflict")
      }
      
      if (preview.hasClass('conflicts')) 
        position = testPosition(position, item)
      /*
      if (outOfBounds(position, rows, cols)) {
        $(this).find('div.test').remove()
        return ui.notifications.warn("out of bounds")
      }
      */
      if (data.split) {
        render = false
        await item.update({[`system.${systemQuanityProp}`]:  foundry.utils.getProperty(item, `system.${systemQuanityProp}`)-data.quantity}, {render:false})
        let newItem = item.toObject()
        foundry.utils.setProperty(newItem, `system.${systemQuanityProp}`, data.quantity)
        foundry.utils.setProperty(newItem, "flags.griddy.position", position)
        await character.createEmbeddedDocuments("Item", [newItem])
        render = true
        return d.render(true)
      }
      if (!data.uuid.includes(character.id) || !data.uuid.startsWith('Actor')) {
        let newItem = item.toObject()
        foundry.utils.setProperty(newItem, "flags.griddy.position", position)
        let docs = await character.createEmbeddedDocuments("Item", [newItem])
        if (item.parent?.permission > 2 && docs.length)
          item.delete()
        return
      }
      return await item.setFlag('griddy', 'position', position)
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
      let item = character.items.get(this.parentElement.id)
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
    
    if (tooBigStack) {
      let stackLimit = Number(tooBigStack.dataset.stackLimit)
      let item = character.items.get(tooBigStack.id)
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
      .sort((a,b)=> (Number(b.dataset.lastModified)||0) - (Number(a.dataset.lastModified)||0))
      //.sort((a,b)=> Number(a.dataset.size - Number(b.dataset.size)))
      .filter((e,i,a)=> a.filter(x=>e.id!=x.id&&elementsOverlap(e,x)).length?e:false).map(e=>{
      $(e).addClass('conflicts')
      return e
    })
    for (let e of conflictingElements) {
      let item = character.items.get(e.id)
      let position = item.getFlag('griddy', 'position')
      let newPosition = testPosition(position, item)
      
      if (JSON.stringify(position) == JSON.stringify(newPosition)) continue;
      return item.setFlag('griddy', 'position', newPosition)
    }
  },
  close: (html)=>{
    delete character.apps[d.appId];
    return;
  }
}, {width:'auto',height:'auto', top, left, id}
)

Hooks.once('renderDialog', (app, html, options)=>{
  html.find('header > h4.window-title')
  .after($(`<a class="drag-lock" data-tooltip="Drag Lock"><i class="fa-solid fa-left-right"></i></a>`).click( function(e){
     //html.find('button').click(function(){
    app.element.find(`div.${id} > div.item`).each(function(){
      let p = character.items.get(this.id).getFlag('griddy', 'position')
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
      return {_id: e.id, flags: { griddy: { position: {x,y}}}}
    })
    character.updateEmbeddedDocuments("Item", updates)
    
  }).dblclick(function(e){e.stopPropagation();})
);
});
d.object = this
character.apps[d.appId] = d;
d.render(true);

}// end Actor.prototype.inventoryGrid 


if (Hooks.gridHooks)
for (let id of Hooks.gridHooks) Hooks.off('', id)
Hooks.gridHooks = [];
Hooks.gridHooks.push(
Hooks.on('getItemSheetHeaderButtons', (app, arr)=>{
  if (app.object.uuid.startsWith('Actor'))
  arr.unshift({
    class: "delete-item",
    icon: "fas fa-trash",
    label: "Delete",
    onclick: async (e)=>{
      event.preventDefault();
      let item = app.document
      let doDelete = await Dialog.wait({title: `Delete ${item.name}?`, content: ``,
        buttons: {
          yes: {label: "Delete", callback:()=>{return true}},
          no: {label: "Keep", callback:()=>{return false}}
        },close:()=>{return false}
      },{top: e.clientY , left: e.clientX, width: 200});
      if (!doDelete) return
      return item.delete()
    }
  })
  arr.unshift({
    class: "move-item",
    icon: "fa-solid fa-up-down-left-right",
    label: "Position on Grid",
    onclick: async (e)=>{
      let item = app.document
      let changeDialog = new Dialog({title:`${item.name} Position`,content:'', buttons:{},
        render: async (html)=>{
          let p = item.flags.griddy?.position
          if (!p) {
            await item.setFlag('griddy', 'position', {x:0, y:0, w:1, h:1, c: false, n:0, s: 0})
            p = item.flags.griddy?.position
          }
          
          let table = `<style>div.position-form span {line-height: var(--form-field-height);}</style>
          <div class="position-form" style="display:grid; grid-template-columns: repeat(4, 1fr); column-gap: 1em; row-gap: .2em">`
          if (app.object.uuid.startsWith('Actor'))
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
            if (position.c) position.s = 0
            await item.setFlag('griddy', 'position', position)
            ui.notifications.info(`Updated ${item.name} Griddy flags: ${JSON.stringify(position)}`)
            console.log(`${item.name} (${item.id}) flags updated`, position)
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
  })
})
) // end gridHooks push

Hooks.once("init", ()=>{
  
  game.settings.register('griddy', `itemTypes`, {
    name: `Item Types `,
    hint: `Comma separated. If you do not know your system item types. Use this in the dev console (F12): <code>Object.keys(game.system.model.Item)</code>`,
    scope: "world",
    type: String,
    default: "",
    config: true,
    restricted: true 
  });
  
  game.settings.register('griddy', `systemQuanityProp`, {
    name: `System Quantity Property `,
    hint: ``,
    scope: "world",
    type: String,
    default: "quantity",
    config: true,
    restricted: true 
  });

  game.settings.register('griddy', `resizing`, {
    name: `Resizing`,
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
    config: true
  });

  game.settings.register('griddy', `background`, {
    name: `Background`,
    hint: `This can be any valid CSS background value`,
    scope: "client",
    type: String,
    default: "#222",
    config: true
  });
  
  game.settings.register('griddy', `itemBackground`, {
    name: `Item Background`,
    hint: `This can be any valid CSS background value`,
    scope: "client",
    type: String,
    default: "#000",
    config: true
  });

  game.settings.register('griddy', `gridColor`, {
    name: `Item Background`,
    hint: `This can be any valid CSS background value`,
    scope: "client",
    type: String,
    default: "#333",
    config: true
  });

  game.settings.register('griddy', `itemOutlineColor`, {
    name: `Item Outline Color`,
    hint: `This can be any valid CSS color value`,
    scope: "client",
    type: String,
    default: "#555",
    config: true
  });

/*
let gridSize = options.gridSize || 60
let rows = options.rows || 8
let cols = options.cols || 8
let background = options.background || '#222'
let itemBackground = options.itemBackground || '#000'
let gridColor = options.gridColor || '#333'
let itemOutlineColor = options.itemOutlineColor || '#555'
*/
});

Hooks.on('ready', ()=>{
  if (game.user.isGM && game.settings.get('griddy', `itemTypes`) == "" && game.system.id == 'dnd5e')
    game.settings.set('griddy', `itemTypes`,"equipment,weapon,loot,consumable,backpack,tool")
})

Hooks.on('getActorSheetHeaderButtons', (app, buttons)=>{
  buttons.unshift({
    "label": "Inventory Grid",
    "class": "griddy",
    "icon": "fas fa-table-cells",
    onclick: (e)=>{
      app.object.griddy()
    }
  })
})

//actor.griddy({gridSize: 50, rows:6, cols: 10, locked: true})