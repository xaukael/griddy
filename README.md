# Griddy

This module provides core functionality for managing items, but some assembly will be required 

It is system agnostic, but that means the module will have to be told 
- what type of items should be included
- where in the item's data the quantity variable is
- how many items can be in a stack
- the dimensions of the items
- whether the items are containers
- what to do when you click the items

What the module handles
- tracking position and dimensions of items on the grid
- combining of items of the same name
- storing items in items defined as containers
- dragging and dropping of items to and from the grid

Item splitting is handled by pressing Ctrl or Shift for splitting 1 or half respectively. 

Items dragged to items marked as containers will move the item into that container.

![image](https://github.com/xaukael/griddy/assets/37848032/e7f016ed-124c-42ee-af9c-74916a8975b2)

## Updates
1.0.17
- items dragged on top of containers will show white outline instead of the usual red that indicates conflict
- items dragged on top of items of the same name will have a green outline to indicate that they will combine

1.0.16
- containers can no longer be dropped inside their own grid
- simplified drop handline to drop target rather than handling on overlap
- items added to containers will now notify user of that
- enhanced item conflict handling to prioritize the position of the last item moved
- so you can drop an item on top of other items, the conflicting items will be moved
- and items can now be rotated despite conflicts, the conflicting items will be moved

1.0.15
- fixed item opacity not being set back to 1 when there was a conflict in dragging
  
1.0.14
- improved drag preview
- items in containers moved between actors will now take their contents with them

1.0.13
- fixed error in free space finder

  
