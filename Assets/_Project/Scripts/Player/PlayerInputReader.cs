using UnityEngine;
using UnityEngine.InputSystem;

namespace TacticalFPS.Player
{
    /// <summary>
    /// Owns the local player's action map and exposes frame-safe input values.
    /// Gameplay code never reads device APIs directly, which keeps input replaceable for networking later.
    /// </summary>
    public sealed class PlayerInputReader : MonoBehaviour
    {
        [SerializeField]
        private InputActionAsset inputActions;

        [SerializeField]
        private string actionMapName = "Gameplay";

        private InputActionAsset _runtimeActions;
        private InputActionMap _gameplayMap;
        private InputAction _moveAction;
        private InputAction _lookAction;
        private InputAction _jumpAction;
        private InputAction _sprintAction;
        private InputAction _walkAction;
        private InputAction _crouchAction;
        private InputAction _toggleCursorAction;
        private InputAction _lockCursorAction;

        public Vector2 Move => _moveAction == null ? Vector2.zero : _moveAction.ReadValue<Vector2>();
        public Vector2 Look => _lookAction == null ? Vector2.zero : _lookAction.ReadValue<Vector2>();
        public bool JumpPressed => _jumpAction != null && _jumpAction.WasPressedThisFrame();
        public bool SprintHeld => _sprintAction != null && _sprintAction.IsPressed();
        public bool WalkHeld => _walkAction != null && _walkAction.IsPressed();
        public bool CrouchHeld => _crouchAction != null && _crouchAction.IsPressed();
        public bool ToggleCursorPressed => _toggleCursorAction != null && _toggleCursorAction.WasPressedThisFrame();
        public bool LockCursorPressed => _lockCursorAction != null && _lockCursorAction.WasPressedThisFrame();

        private void Awake()
        {
            if (inputActions == null)
            {
                Debug.LogError($"{nameof(PlayerInputReader)} on {name} has no InputActionAsset assigned.", this);
                return;
            }

            // Each local reader gets an isolated action asset. This avoids shared action state
            // when the same player prefab is later used for prediction or split-screen tests.
            _runtimeActions = Instantiate(inputActions);
            _gameplayMap = _runtimeActions.FindActionMap(actionMapName, throwIfNotFound: false);

            if (_gameplayMap == null)
            {
                Debug.LogError($"Input action map '{actionMapName}' was not found in {inputActions.name}.", this);
                return;
            }

            _moveAction = FindAction("Move");
            _lookAction = FindAction("Look");
            _jumpAction = FindAction("Jump");
            _sprintAction = FindAction("Sprint");
            _walkAction = FindAction("Walk");
            _crouchAction = FindAction("Crouch");
            _toggleCursorAction = FindAction("ToggleCursor");
            _lockCursorAction = FindAction("LockCursor");
        }

        private void OnEnable()
        {
            _gameplayMap?.Enable();
        }

        private void OnDisable()
        {
            _gameplayMap?.Disable();
        }

        private void OnDestroy()
        {
            if (_runtimeActions != null)
            {
                Destroy(_runtimeActions);
            }
        }

        private InputAction FindAction(string actionName)
        {
            InputAction action = _gameplayMap.FindAction(actionName, throwIfNotFound: false);
            if (action == null)
            {
                Debug.LogWarning($"Input action '{actionName}' is missing from map '{actionMapName}'.", this);
            }

            return action;
        }
    }
}
