# Tactical FPS Prototype

An original Unity 2022.3 LTS tactical first-person shooter vertical-slice foundation. The working fiction uses placeholder factions and geometry only; no existing game's names, maps, weapons, logos, or audio are used.

## Current status

- **Milestone 0 complete:** Unity project structure, Input System package, assembly definition, session bootstrap, ScriptableObject tuning assets, materials, prefab, and test scene.
- **Milestone 1 complete:** precise first-person movement, mouse/gamepad look, sprint, walk, crouch, jump, gravity, ground detection, capsule clearance, camera FOV response, and optional camera bob.
- **Not yet included:** weapons, combat, rounds, economy, objectives, bots, or HUD. Those belong to Milestones 2–7.

## Open the prototype

Open the repository root in Unity Hub using Unity 2022.3 LTS, then open:

```text
Assets/_Project/Scenes/Milestone1_TestScene.unity
```

Press Play. Controls:

| Action | Binding |
| --- | --- |
| Move | WASD |
| Look | Mouse |
| Sprint | Hold Left Shift while moving forward |
| Walk | Hold Left Alt |
| Crouch | Hold Left Ctrl |
| Jump | Space |
| Release/lock cursor | Escape / Left mouse button |

The project uses the new Input System only. No legacy `UnityEngine.Input` calls are present in the runtime code.

## Documentation

See [`Documentation/Milestone0-1.md`](Documentation/Milestone0-1.md) for assumptions, setup steps, the scene hierarchy, input action map, code responsibilities, and the Play Mode checklist.

## Repository note

The repository originally contained a small Persian-language web scaffold (`index.html` and `styles.css`). Those files remain for history and are unrelated to the Unity build. Unity source lives under `Assets/`, `Packages/`, and `ProjectSettings/`.
