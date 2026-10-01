# Tactical FPS Prototype — Milestones 0 and 1

This repository now contains the Unity 2022.3 LTS project foundation for an original tactical FPS prototype. The project uses the fictional working title **Tactical FPS Prototype**; it does not use third-party game IP, names, or assets.

## Assumptions

- Unity Editor **2022.3.39f1** or another Unity 2022.3 LTS patch is used on Windows.
- The Built-in Render Pipeline is intentional for the first slice. It keeps the prototype dependency-light; URP can be introduced later without changing gameplay interfaces.
- The local player is the only simulated player in Milestone 1. Network ownership, server validation, and bot simulation are reserved for later milestones.
- Crouch is hold-to-crouch: Left Ctrl changes the capsule and camera height while held.
- Sprint is hold-to-sprint and only engages while moving forward. Left Alt is hold-to-walk.
- Escape releases the mouse cursor. A left mouse click re-locks it.
- The repository started as a small web-project scaffold. The Unity project is now the gameplay source of truth; the original web files remain untouched and are not part of the Unity build.

## Project structure

```text
Assets/
  _Project/
    Input/
      TacticalFPS.inputactions
    Materials/
      RangeCover.mat
      RangeFloor.mat
    Prefabs/
      Player/PrototypePlayer.prefab
    Scenes/
      Milestone1_TestScene.unity
    ScriptableObjects/
      FirstPersonCameraSettings.asset
      PlayerMovementSettings.asset
    Scripts/
      Core/GameManager.cs
      Data/FirstPersonCameraSettings.cs
      Data/PlayerMovementSettings.cs
      Player/FirstPersonCamera.cs
      Player/FirstPersonController.cs
      Player/PlayerInputReader.cs
      TacticalFPS.asmdef
    Audio/                 # Reserved for later placeholder audio
    AI/                    # Reserved for Milestone 6
    Combat/                # Reserved for Milestone 3
    Economy/               # Reserved for Milestone 5
    Rounds/                # Reserved for Milestone 4
    UI/                    # Reserved for Milestone 7
    Weapons/               # Reserved for Milestone 2
Packages/
  manifest.json
  packages-lock.json
ProjectSettings/
  EditorBuildSettings.asset
  ProjectSettings.asset
  ProjectVersion.txt
  TagManager.asset
Documentation/
  Milestone0-1.md
```

## Setup

1. Install Unity Hub and a Unity **2022.3 LTS** editor with Windows build support.
2. In Unity Hub, choose **Add > Add project from disk** and select this repository root, not the `Assets` folder.
3. Let Unity import the Input System package. If prompted to switch active input handling, accept **Input System Package (New)** and restart the editor.
4. Open `Assets/_Project/Scenes/Milestone1_TestScene.unity`.
5. Press Play. The cursor locks automatically and the local player starts at the near end of the primitive practice range.
6. If the project is opened in a different 2022.3 patch, allow Unity to update generated package-lock or project settings files, then review that diff before committing it.

The first import creates Unity's ignored `Library/`, `Temp/`, and IDE files. Those are intentionally excluded from Git.

## Input actions

The asset at `Assets/_Project/Input/TacticalFPS.inputactions` contains one action map:

```text
Gameplay
├── Move          Value / Vector2       WASD, Gamepad left stick
├── Look          Value / Vector2       Mouse delta, Gamepad right stick
├── Jump          Button               Space, Gamepad south button
├── Sprint        Button               Left Shift
├── Walk          Button               Left Alt
├── Crouch        Button               Left Ctrl
├── ToggleCursor  Button               Escape
└── LockCursor    Button               Left mouse button
```

`PlayerInputReader` clones the asset at runtime, enables only the `Gameplay` map, and exposes action values to gameplay code. No legacy `UnityEngine.Input` API is used.

## Scene hierarchy

```text
Milestone1_TestScene
├── GameManager                         GameManager.cs
├── PrototypeRange
│   ├── Floor                              primitive cube + BoxCollider
│   ├── Cover_Center                      primitive cover
│   ├── Cover_Left                        primitive cover
│   ├── Cover_Right                       primitive cover
│   └── Backstop                          primitive wall
├── Player                              Prototype player root
│   └── ViewPivot                        FirstPersonCamera.cs
│       └── Main Camera                  Camera + AudioListener
├── Directional Light
└── ControlsHint                        reserved scene marker
```

The scene's player uses a `CharacterController`, a data asset for movement tuning, a separate camera pivot for pitch, and a child camera. The body rotates on yaw while the pivot rotates on pitch. The primitive cover objects provide immediate collision and reference geometry.

## Code file responsibilities

- `Assets/_Project/Scripts/Core/GameManager.cs` — minimal session lifecycle singleton with `SessionStarted` and `SessionStopped` events. Later round systems can subscribe without owning application bootstrapping.
- `Assets/_Project/Scripts/Data/PlayerMovementSettings.cs` — ScriptableObject for speeds, gravity, jump, capsule, ground check, and view heights.
- `Assets/_Project/Scripts/Data/FirstPersonCameraSettings.cs` — ScriptableObject for sensitivity, pitch limits, FOV, and camera bob.
- `Assets/_Project/Scripts/Player/PlayerInputReader.cs` — isolated new-Input-System action reader; gameplay code does not touch devices directly.
- `Assets/_Project/Scripts/Player/FirstPersonController.cs` — acceleration-based CharacterController movement, sprint/walk/crouch, jump, gravity, grounded probe, and overhead clearance check.
- `Assets/_Project/Scripts/Player/FirstPersonCamera.cs` — mouse/gamepad look, cursor state, FOV response, and optional camera bob.

All runtime scripts are included by `Assets/_Project/Scripts/TacticalFPS.asmdef`, which references `Unity.InputSystem`.

## Test checklist

- [ ] Unity opens with no compiler errors in the Console.
- [ ] The active scene is `Milestone1_TestScene` and contains the hierarchy above.
- [ ] Pressing W/A/S/D moves the capsule relative to body yaw.
- [ ] Mouse movement rotates yaw and pitch independently; pitch clamps near vertical limits.
- [ ] Left Shift increases forward speed and smoothly widens FOV.
- [ ] Left Alt produces the slower walk speed.
- [ ] Left Ctrl smoothly lowers the capsule and camera; releasing it restores standing height when overhead is clear.
- [ ] Space jumps only while grounded and gravity returns the capsule to the floor.
- [ ] The floor and cover block movement; the player does not fall through the range.
- [ ] Escape unlocks the cursor and left click locks it again.
- [ ] No `Input.GetAxis`, `Input.GetKey`, or other legacy Input Manager call exists in the runtime scripts.

## Verification note

The checkout environment does not include a Unity Editor binary, so editor compilation and Play Mode cannot be executed here. The project includes Unity 2022.3-compatible package, scene, prefab, ScriptableObject, input, assembly, and ProjectSettings files; the static checks run for this change validate JSON, GUID references, scene file IDs, and C# source structure. The final Play Mode checklist above is the required editor verification.

## Next milestone

Milestone 2 should add data-driven weapon definitions, a reusable weapon base, hitscan queries, ammo state, reload, recoil, and spread without coupling those systems to the movement or camera scripts.
