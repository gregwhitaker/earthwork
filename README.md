# Earthwork

Earthwork is a first-person JavaScript construction simulator. Dig a hole, load a dump truck, and tip the soil to build a spoil pile. Switch to the forklift to move pallets of water drums, form oil, and bagged cement into the striped delivery bay.

## Run locally

With Node.js installed, run this command from the repository root.

```sh
npm start
```

Open [localhost:5173](http://localhost:5173). The game includes Three.js, textures, and fonts and runs without a build or package installation.

## Controls

Choose a vehicle at the top of the screen or press **V** to switch cabs. Drag to look around, press **C** to center the view, and press **P** to pause. The on-screen buttons also work with touch.

| Vehicle | Controls |
| --- | --- |
| Excavator | Click the ground to aim. Press **Space** to scoop or empty the bucket. Click the truck bed or use **Aim at truck bed** to load it. For manual control, use **A/D** to swing, **W/S** for the boom, **↑/↓** for reach, and **Q/E** to curl or open the bucket. |
| Dump truck | Use **W/S** to drive or reverse and **A/D** to steer. Stop and press **Space** to tip or lower the bed. |
| Forklift | Use **W/S** to drive or reverse and **A/D** to steer. Slide the lowered forks straight into a pallet. Stop and press **Space** to pick it up or set it down. Use **↑/↓** to adjust the fork height. |

The browser source and assets are in `earthwork/dist/`. The local server is `earthwork/serve.mjs`. [Asset credits and licenses](earthwork/dist/assets/credits.txt)
