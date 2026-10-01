using TacticalFPS.Data;
using UnityEngine;

namespace TacticalFPS.Player
{
    /// <summary>
    /// CharacterController-based first-person locomotion.
    /// It owns movement simulation only; look and presentation live in FirstPersonCamera.
    /// </summary>
    [RequireComponent(typeof(CharacterController))]
    [RequireComponent(typeof(PlayerInputReader))]
    public sealed class FirstPersonController : MonoBehaviour
    {
        [SerializeField]
        private PlayerMovementSettings movementSettings;

        [SerializeField]
        private Transform viewPivot;

        [SerializeField]
        private LayerMask groundMask = ~0;

        private CharacterController _characterController;
        private PlayerInputReader _input;
        private Vector3 _planarVelocity;
        private float _verticalVelocity;
        private float _currentHeight;
        private bool _isGrounded;
        private bool _isCrouched;
        private bool _isSprinting;
        private readonly Collider[] _groundCheckHits = new Collider[8];
        private readonly Collider[] _standCheckHits = new Collider[12];

        public Vector3 Velocity { get; private set; }
        public bool IsGrounded => _isGrounded;
        public bool IsCrouched => _isCrouched;
        public bool IsSprinting => _isSprinting;
        public float PlanarSpeed => _planarVelocity.magnitude;
        public float SprintSpeed => movementSettings == null ? 1f : movementSettings.SprintSpeed;

        private void Awake()
        {
            _characterController = GetComponent<CharacterController>();
            _input = GetComponent<PlayerInputReader>();

            if (viewPivot == null)
            {
                Debug.LogError($"{nameof(FirstPersonController)} on {name} needs a view pivot reference.", this);
            }

            if (movementSettings == null)
            {
                Debug.LogError($"{nameof(FirstPersonController)} on {name} needs movement settings.", this);
                enabled = false;
                return;
            }

            _currentHeight = movementSettings.StandingHeight;
            ConfigureCapsule(_currentHeight);
            ApplyViewHeight(movementSettings.StandingViewHeight);
        }

        private void Update()
        {
            if (movementSettings == null)
            {
                return;
            }

            UpdateGroundedState();
            UpdateCrouchState();
            UpdateHorizontalVelocity();
            UpdateVerticalVelocity();
            MoveCharacter();
        }

        private void UpdateGroundedState()
        {
            Vector3 checkPosition = transform.position + Vector3.up * movementSettings.GroundCheckOffset;
            int hitCount = Physics.OverlapSphereNonAlloc(
                checkPosition,
                movementSettings.GroundCheckRadius,
                _groundCheckHits,
                groundMask,
                QueryTriggerInteraction.Ignore);

            bool probeGrounded = false;
            for (int index = 0; index < hitCount; index++)
            {
                Collider hit = _groundCheckHits[index];
                if (hit != null && hit != _characterController && !hit.transform.IsChildOf(transform))
                {
                    probeGrounded = true;
                    break;
                }
            }

            _isGrounded = _characterController.isGrounded || probeGrounded;
        }

        private void UpdateCrouchState()
        {
            bool wantsCrouch = _input.CrouchHeld;
            if (!wantsCrouch && !CanStand())
            {
                // Do not force the capsule into an overhead obstruction.
                wantsCrouch = true;
            }

            _isCrouched = wantsCrouch;
            float targetHeight = _isCrouched
                ? movementSettings.CrouchingHeight
                : movementSettings.StandingHeight;

            _currentHeight = Mathf.MoveTowards(
                _currentHeight,
                targetHeight,
                movementSettings.CrouchTransitionSpeed * Time.deltaTime);

            ConfigureCapsule(_currentHeight);

            float targetViewHeight = _isCrouched
                ? movementSettings.CrouchingViewHeight
                : movementSettings.StandingViewHeight;
            float currentViewHeight = viewPivot == null ? targetViewHeight : viewPivot.localPosition.y;
            float nextViewHeight = Mathf.MoveTowards(
                currentViewHeight,
                targetViewHeight,
                movementSettings.CrouchTransitionSpeed * Time.deltaTime);
            ApplyViewHeight(nextViewHeight);
        }

        private void UpdateHorizontalVelocity()
        {
            Vector2 moveInput = Vector2.ClampMagnitude(_input.Move, 1f);
            Vector3 localDirection = new Vector3(moveInput.x, 0f, moveInput.y);
            Vector3 desiredDirection = transform.TransformDirection(localDirection);
            desiredDirection.y = 0f;
            desiredDirection = Vector3.ClampMagnitude(desiredDirection, 1f);

            bool movingForward = moveInput.y > 0.1f;
            _isSprinting = !_isCrouched && !_input.WalkHeld && _input.SprintHeld && movingForward;

            float targetSpeed;
            if (_isCrouched)
            {
                targetSpeed = movementSettings.CrouchSpeed;
            }
            else if (_input.WalkHeld)
            {
                targetSpeed = movementSettings.WalkSpeed;
            }
            else if (_isSprinting)
            {
                targetSpeed = movementSettings.SprintSpeed;
            }
            else
            {
                targetSpeed = movementSettings.RunSpeed;
            }

            Vector3 desiredVelocity = desiredDirection * targetSpeed;
            float acceleration = desiredVelocity.sqrMagnitude > 0.001f
                ? movementSettings.GroundAcceleration
                : movementSettings.GroundDeceleration;

            _planarVelocity = Vector3.MoveTowards(
                _planarVelocity,
                desiredVelocity,
                acceleration * Time.deltaTime);
        }

        private void UpdateVerticalVelocity()
        {
            if (_isGrounded && _verticalVelocity < 0f)
            {
                _verticalVelocity = movementSettings.GroundedDownForce;
            }

            if (_input.JumpPressed && _isGrounded && !_isCrouched)
            {
                _verticalVelocity = Mathf.Sqrt(movementSettings.JumpHeight * -2f * movementSettings.Gravity);
            }

            _verticalVelocity += movementSettings.Gravity * Time.deltaTime;
        }

        private void MoveCharacter()
        {
            Velocity = new Vector3(_planarVelocity.x, _verticalVelocity, _planarVelocity.z);
            CollisionFlags collisionFlags = _characterController.Move(Velocity * Time.deltaTime);

            if ((collisionFlags & CollisionFlags.Above) != 0 && _verticalVelocity > 0f)
            {
                _verticalVelocity = 0f;
            }

            _isGrounded = _characterController.isGrounded || _isGrounded;
        }

        private bool CanStand()
        {
            if (movementSettings == null || _currentHeight >= movementSettings.StandingHeight - 0.01f)
            {
                return true;
            }

            float radius = Mathf.Min(movementSettings.CapsuleRadius, movementSettings.StandingHeight * 0.5f - 0.01f);
            Vector3 bottom = transform.position + Vector3.up * (radius + 0.03f);
            Vector3 top = transform.position + Vector3.up * (movementSettings.StandingHeight - radius);
            int hitCount = Physics.OverlapCapsuleNonAlloc(
                bottom,
                top,
                radius,
                _standCheckHits,
                groundMask,
                QueryTriggerInteraction.Ignore);

            for (int index = 0; index < hitCount; index++)
            {
                Collider hit = _standCheckHits[index];
                if (hit != null && hit != _characterController && !hit.transform.IsChildOf(transform))
                {
                    return false;
                }
            }

            return true;
        }

        private void ConfigureCapsule(float height)
        {
            float safeRadius = Mathf.Min(movementSettings.CapsuleRadius, height * 0.5f - 0.01f);
            _characterController.height = Mathf.Max(height, safeRadius * 2f + 0.02f);
            _characterController.radius = safeRadius;
            _characterController.center = Vector3.up * (_characterController.height * 0.5f);
        }

        private void ApplyViewHeight(float height)
        {
            if (viewPivot == null)
            {
                return;
            }

            Vector3 localPosition = viewPivot.localPosition;
            localPosition.y = height;
            viewPivot.localPosition = localPosition;
        }

        private void OnDrawGizmosSelected()
        {
            if (movementSettings == null)
            {
                return;
            }

            Gizmos.color = Color.yellow;
            Vector3 checkPosition = transform.position + Vector3.up * movementSettings.GroundCheckOffset;
            Gizmos.DrawWireSphere(checkPosition, movementSettings.GroundCheckRadius);
        }
    }
}
