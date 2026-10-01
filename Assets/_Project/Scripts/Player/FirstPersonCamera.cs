using TacticalFPS.Data;
using UnityEngine;

namespace TacticalFPS.Player
{
    /// <summary>
    /// Mouse/gamepad look and local camera presentation. The player body owns yaw;
    /// this pivot owns pitch so the two responsibilities remain independently reusable.
    /// </summary>
    public sealed class FirstPersonCamera : MonoBehaviour
    {
        [SerializeField]
        private FirstPersonCameraSettings cameraSettings;

        [SerializeField]
        private Transform bodyRoot;

        [SerializeField]
        private PlayerInputReader input;

        [SerializeField]
        private FirstPersonController controller;

        [SerializeField]
        private Camera targetCamera;

        private float _pitch;
        private float _fieldOfViewVelocity;
        private float _bobTime;
        private Vector3 _cameraBaseLocalPosition;
        private bool _cursorLocked;

        private void Awake()
        {
            if (input == null)
            {
                input = GetComponentInParent<PlayerInputReader>();
            }

            if (controller == null)
            {
                controller = GetComponentInParent<FirstPersonController>();
            }

            if (bodyRoot == null && controller != null)
            {
                bodyRoot = controller.transform;
            }

            if (targetCamera == null)
            {
                targetCamera = GetComponentInChildren<Camera>();
            }

            if (targetCamera == null)
            {
                Debug.LogError($"{nameof(FirstPersonCamera)} on {name} needs a Camera reference.", this);
                enabled = false;
                return;
            }

            _cameraBaseLocalPosition = targetCamera.transform.localPosition;
            _pitch = NormalizePitch(transform.localEulerAngles.x);
        }

        private void OnEnable()
        {
            SetCursorLocked(true);
        }

        private void OnDisable()
        {
            SetCursorLocked(false);
        }

        private void Update()
        {
            if (cameraSettings == null || input == null || bodyRoot == null)
            {
                return;
            }

            HandleCursorState();
            if (_cursorLocked)
            {
                ApplyLook(input.Look);
            }

            UpdateFieldOfView();
            UpdateCameraBob();
        }

        private void HandleCursorState()
        {
            if (input.ToggleCursorPressed)
            {
                SetCursorLocked(!_cursorLocked);
            }
            else if (!_cursorLocked && input.LockCursorPressed)
            {
                SetCursorLocked(true);
            }
        }

        private void ApplyLook(Vector2 lookInput)
        {
            float yaw = lookInput.x * cameraSettings.MouseSensitivity;
            float pitchInput = lookInput.y * cameraSettings.MouseSensitivity;
            float pitchDirection = cameraSettings.InvertY ? 1f : -1f;

            bodyRoot.Rotate(Vector3.up * yaw, Space.World);

            _pitch += pitchInput * pitchDirection;
            _pitch = Mathf.Clamp(_pitch, cameraSettings.MinimumPitch, cameraSettings.MaximumPitch);
            transform.localRotation = Quaternion.Euler(_pitch, 0f, 0f);
        }

        private void UpdateFieldOfView()
        {
            bool sprinting = controller != null && controller.IsSprinting;
            float targetFieldOfView = sprinting
                ? cameraSettings.SprintFieldOfView
                : cameraSettings.NormalFieldOfView;

            targetCamera.fieldOfView = Mathf.SmoothDamp(
                targetCamera.fieldOfView,
                targetFieldOfView,
                ref _fieldOfViewVelocity,
                cameraSettings.FieldOfViewSmoothTime);
        }

        private void UpdateCameraBob()
        {
            if (!cameraSettings.EnableCameraBob || controller == null || !controller.IsGrounded)
            {
                _bobTime = 0f;
                targetCamera.transform.localPosition = Vector3.Lerp(
                    targetCamera.transform.localPosition,
                    _cameraBaseLocalPosition,
                    Time.deltaTime * 12f);
                return;
            }

            float speed = controller.PlanarSpeed;
            if (speed < 0.1f)
            {
                targetCamera.transform.localPosition = Vector3.Lerp(
                    targetCamera.transform.localPosition,
                    _cameraBaseLocalPosition,
                    Time.deltaTime * 12f);
                return;
            }

            float speedFactor = Mathf.Clamp01(speed / Mathf.Max(1f, controller.SprintSpeed));
            _bobTime += Time.deltaTime * cameraSettings.BobFrequency * Mathf.Lerp(0.65f, 1.25f, speedFactor);
            Vector2 amplitude = cameraSettings.BobAmplitude * speedFactor;
            Vector3 bobOffset = new Vector3(
                Mathf.Cos(_bobTime) * amplitude.x,
                Mathf.Abs(Mathf.Sin(_bobTime)) * amplitude.y,
                0f);

            targetCamera.transform.localPosition = _cameraBaseLocalPosition + bobOffset;
        }

        private void SetCursorLocked(bool locked)
        {
            _cursorLocked = locked;
            Cursor.lockState = locked ? CursorLockMode.Locked : CursorLockMode.None;
            Cursor.visible = !locked;
        }

        private static float NormalizePitch(float angle)
        {
            if (angle > 180f)
            {
                angle -= 360f;
            }

            return angle;
        }
    }
}
