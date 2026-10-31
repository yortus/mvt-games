---
'@mvtjs/utils': patch
---

A hidden `<Switch>` branch now sits out `updateView`, as it already sat out `refreshView`, so its update steps no longer run while another branch shows. Before, a branch's update steps went on reading the state it was built for after that state had gone, such as a puzzle view's open puzzle once the player closed it. The switch picks its branch afresh in an update step of its own, so the change holds from the update in which the model makes it. A switch whose branches have no update steps costs nothing more to update.
