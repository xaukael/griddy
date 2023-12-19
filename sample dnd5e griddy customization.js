Hooks.on('renderGriddy', (app, html, options)=>{
  let actor = app.object
  let itemTypes = ["equipment", "weapon", "loot", "consumable", "backpack", "tool"];
  let grid = html.find(`div[class^="inventory-grid-"]`)
  const rarityColors = {
    common: 'gray',
    uncommon: 'green',
    rare: 'blue',
    veryRare: 'purple',
    legendary: 'orange'
  };
  html.find('.item').each(function(){
    let item = actor.items.get(this.id)
    if ($(this).css('outline').startsWith("rgb(255")) return true
    this.style.outline=` 1px solid ${rarityColors[item.system.rarity]||'#666'}`
  })
  if (grid[0].className.length>32) return;
  let {gridSize , cols, rows, gridColor} = options
  let showEquippedGrid = actor.getFlag('world', 'showEquippedGrid')
  let toggleEquippedGridButton = $(`<button style="margin-top: 1em">Toggle Equipped Grid</button>`).click(function(){
    actor.setFlag('world', 'showEquippedGrid', !showEquippedGrid)
  })
  grid.after(toggleEquippedGridButton)
  app.setPosition({})
  if (!showEquippedGrid) return 
  grid.after(`<div class="equipped"
  style="display: grid; grid-template-columns: repeat(${cols}, ${gridSize}px); grid-auto-rows: ${gridSize}px;
  margin-top: ${gridSize/3}px; border: 1px solid ${gridColor};
    background-image: 
      repeating-linear-gradient(${gridColor} 0 1px, transparent 1px 100%),
      repeating-linear-gradient(90deg, ${gridColor} 0 1px, transparent 1px 100%);
      background-position: top -1px left -1px;
      background-size: ${gridSize}px ${gridSize}px;
        "><img src="${app.object.img}" style="position: relative; grid-column: auto/span 2; grid-row: auto/span 2;max-width: 100%; max-height: 100%; ">
  ${app.object.items.filter(i=>itemTypes.includes(i.type)&&i.system.equipped).reduce((a,i)=>a+=
           `<div id="${i.id}" class="item" name="${i.name}" data-uuid="${i.uuid}" data-type="Item"
           data-tooltip="${i.name}${i.system.quantity>1?` (${i.system.quantity})`:''}" 
           style=" position: relative; grid-column: auto/span 1; grid-row: auto/span 1;cursor:pointer">
           <img src="${i.img}" style="transform: translate(-50%, -50%); border:unset;
              max-width: 100%; 
              max-height: 100%; 
              left:50%; top:50%; position:absolute;padding:2px;
              pointer-events: none;" >
           <span class="item-quantity" style="font-size:${gridSize/4.5}px;position: absolute; top: 2px; left: 2px; color: white; background: rgba(0, 0, 0, 0.5); padding:1px 3px; display: ${i.system.quanitity>1?'inline':'none'}">${i.system.quantity}</span>
           </div>`, ``) 
  }
  </div>`)
  html.find('.equipped > img').bind('drop', function(e){
    e.originalEvent.preventDefault();
    let data = JSON.parse(e.originalEvent.dataTransfer.getData("text"));
    if (!data) return;
    if (data.type != 'Item') return ui.notifications.warn('non-item dropped: '+ data.type)
    let item = fromUuidSync(data.uuid)
    item.update({"system.equipped":true})
  })
  html.find('.equipped > div')
  .click( function(e){
    if (e.shiftKey) return  app.object.items.get(this.id).update({"system.equipped":false})
    app.object.items.get(this.id).use()
    
  }).contextmenu( function(e){
    app.object.items.get(this.id).sheet.render(true)
  })
  app.setPosition({})
  // grid-column: auto/span ${i.flags.world?.position?.w}; grid-row: auto/span ${i.flags.world?.position?.h};
})//grid-auto-flow: dense;
Hooks.on('ready', ()=>{

  if (game.system.id != 'dnd5e') return true
  
  Hooks.on('preUpdateItem', (item, updates)=>{
    if (!foundry.utils.hasProperty(updates, "system.equipped")) return
    Object.assign(updates, {flags:{world:{position:{e:updates.system.equipped}}}})
  })
  
  Hooks.on('preUpdateActor', async (actor, updates, context)=>{
    return 
    if (foundry.utils.hasProperty(context, "syncCurrency")) return 
    if (!foundry.utils.hasProperty(updates, "system.currency")) return
    if (foundry.utils.hasProperty(updates, "system.currency.gp")) {
      let gold = actor.items.getName('Gold')
      if (!gold) 
        await actor.createEmbeddedDocuments("Item", [
          {type:"loot", name:"Gold", img: "icons/commodities/currency/coin-embossed-crown-gold.webp",
           system:{quantity:updates.system.currency.gp}}
        ])
      else await gold.update({system:{quantity:updates.system.currency.gp}}, )
    }
  })
  Hooks.on('updateItem', (item, updates, context, userId)=>{
    if (userId!= game.user.id) return
    let currency = {"Gold": "gp"}
    if (!item.uuid.startsWith('Actor')) return
    if (!Object.keys(currency).includes(item.name)) return
    if (!foundry.utils.hasProperty(updates, "system.quantity")) return
    item.parent.update({[`system.currency.${currency[item.name]}`]:updates.system.quantity}, {syncCurrency:false})
  })
})
